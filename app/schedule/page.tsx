// =============================================================================
// schedule/page.tsx
// 予定画面 - カレンダー3モード切り替え対応
//
// モード:
//   A: シンプル月表示（ドット）
//   B: イベントバー表示
//   C: ミニカレンダー + アジェンダ
//
// 設計方針:
//   - モード選択は localStorage に保存（次回起動時も維持）
//   - 編集・削除は全モード共通
//   - 将来: Supabase 移行時は fetchSchedules() を差し替えるだけ
// =============================================================================

"use client";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import type { ScheduleLog } from "../type";

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------
const STORAGE_KEY_SCHEDULES = "chamaSchedules";
const STORAGE_KEY_MODE      = "chamaCalendarMode";

type CalendarMode = "A" | "B" | "C";

const MODE_LABELS: { key: CalendarMode; label: string }[] = [
  { key: "A", label: "A" },
  { key: "B", label: "B" },
  { key: "C", label: "C" },
];

// 予定種別カラー（将来: 予定にtypeを追加して色分け）
const SCHEDULE_COLORS = {
  default:  "#ff4d6d",
  work:     "#5856d6",
  personal: "#34c759",
};

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

/** 「今日」「明日」などを実際の日付文字列に変換 */
function resolveDate(dateStr: string): string {
  const now = new Date();
  if (dateStr === "今日")  return `${now.getMonth()+1}月${now.getDate()}日`;
  if (dateStr === "明日")  { const d = new Date(now); d.setDate(d.getDate()+1); return `${d.getMonth()+1}月${d.getDate()}日`; }
  if (dateStr === "明後日"){ const d = new Date(now); d.setDate(d.getDate()+2); return `${d.getMonth()+1}月${d.getDate()}日`; }
  if (dateStr === "来週")  { const d = new Date(now); d.setDate(d.getDate()+7); return `${d.getMonth()+1}月${d.getDate()}日`; }
  return dateStr;
}

/** 「N月N日」→ ソート用数値 */
function dateStrToNum(s: string): number {
  const m = s.match(/([0-9]+)月([0-9]+)日/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 9999;
}

/** 今日の日付文字列「N月N日」を返す */
function todayStr(): string {
  const now = new Date();
  return `${now.getMonth()+1}月${now.getDate()}日`;
}

/** 指定年月の日数 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 指定年月1日の曜日（0=日） */
function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** カレンダー上の日付文字列「N月N日」 */
function toDateStr(year: number, month: number, day: number): string {
  return `${month}月${day}日`;
}

// -----------------------------------------------------------------------------
// 編集フォーム（全モード共通）
// -----------------------------------------------------------------------------
function EditForm({
  schedule,
  onSave,
  onCancel,
}: {
  schedule: ScheduleLog;
  onSave: (data: Partial<ScheduleLog>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<Partial<ScheduleLog>>({});
  return (
    <div style={{ padding: "10px 0" }}>
      <input
        value={data.date ?? schedule.date}
        onChange={e => setData({ ...data, date: e.target.value })}
        placeholder="日付 例: 3月28日"
        style={{ width: "100%", marginBottom: "6px", padding: "6px 8px",
          borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }}
      />
      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
        <input
          value={data.startTime ?? schedule.startTime}
          onChange={e => setData({ ...data, startTime: e.target.value })}
          placeholder="開始 10:00"
          style={{ flex: 1, padding: "6px 8px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "14px" }}
        />
        <span style={{ lineHeight: "34px", color: "#999" }}>〜</span>
        <input
          value={data.endTime ?? schedule.endTime}
          onChange={e => setData({ ...data, endTime: e.target.value })}
          placeholder="終了"
          style={{ flex: 1, padding: "6px 8px", borderRadius: "6px",
            border: "1px solid #ddd", fontSize: "14px" }}
        />
      </div>
      <input
        value={data.title ?? schedule.title}
        onChange={e => setData({ ...data, title: e.target.value })}
        placeholder="内容"
        style={{ width: "100%", marginBottom: "8px", padding: "6px 8px",
          borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" }}
      />
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={() => onSave(data)}
          style={{ flex: 1, padding: "8px", background: "#ff4d6d", color: "white",
            border: "none", borderRadius: "8px", fontSize: "14px",
            touchAction: "manipulation" }}
        >保存</button>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: "8px", background: "#eee",
            border: "none", borderRadius: "8px", fontSize: "14px",
            touchAction: "manipulation" }}
        >キャンセル</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// モードA: シンプル月表示（ドット）
// -----------------------------------------------------------------------------
function ModeA({
  schedules, year, month, selectedDate, onSelectDate, onPrevMonth, onNextMonth,
  editingId, onEdit, onSave, onCancelEdit, onDelete,
}: {
  schedules: ScheduleLog[];
  year: number; month: number;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onPrevMonth: () => void; onNextMonth: () => void;
  editingId: string | null;
  onEdit: (id: string) => void;
  onSave: (id: string, data: Partial<ScheduleLog>) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const days    = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const today   = todayStr();

  // 日付→予定リスト のマップ
  const scheduleMap: Record<string, ScheduleLog[]> = {};
  schedules.forEach(s => {
    if (!scheduleMap[s.date]) scheduleMap[s.date] = [];
    scheduleMap[s.date].push(s);
  });

  const selectedSchedules = selectedDate ? (scheduleMap[selectedDate] ?? []) : [];

  return (
    <div>
      {/* カレンダー */}
      <CalendarHeader year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />
      <WeekDayHeader />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {/* 前月の空白 */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ padding: "6px 0", textAlign: "center" }} />
        ))}
        {/* 日付セル */}
        {Array.from({ length: days }).map((_, i) => {
          const day     = i + 1;
          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === today;
          const isSel   = dateStr === selectedDate;
          const dots    = scheduleMap[dateStr] ?? [];

          return (
            <div
              key={day}
              onClick={() => onSelectDate(dateStr)}
              style={{
                padding: "4px 0 6px", textAlign: "center", cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "30px", height: "30px", borderRadius: "50%",
                background: isToday ? "#ff4d6d" : isSel ? "#ffe0e6" : "transparent",
                color: isToday ? "white" : day === 0 ? "#ff4d6d" : "#333",
                fontWeight: isToday ? "bold" : "normal",
                fontSize: "14px",
              }}>
                {day}
              </div>
              {/* ドット（最大3件） */}
              <div style={{ display: "flex", justifyContent: "center", gap: "2px", marginTop: "2px", minHeight: "6px" }}>
                {dots.slice(0, 3).map((_, j) => (
                  <div key={j} style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: j === 0 ? "#ff4d6d" : j === 1 ? "#5856d6" : "#34c759",
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 選択日の予定リスト */}
      {selectedDate && (
        <div style={{ borderTop: "1px solid #eee", marginTop: "8px", paddingTop: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
            {selectedDate}の予定
          </div>
          {selectedSchedules.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#aaa" }}>予定はありません</div>
          ) : (
            selectedSchedules.map(s => (
              <ScheduleItem
                key={s.id} schedule={s}
                editingId={editingId}
                onEdit={onEdit} onSave={onSave}
                onCancelEdit={onCancelEdit} onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// モードB: イベントバー表示
// -----------------------------------------------------------------------------
function ModeB({
  schedules, year, month, onPrevMonth, onNextMonth,
  editingId, onEdit, onSave, onCancelEdit, onDelete,
}: {
  schedules: ScheduleLog[];
  year: number; month: number;
  onPrevMonth: () => void; onNextMonth: () => void;
  editingId: string | null;
  onEdit: (id: string) => void;
  onSave: (id: string, data: Partial<ScheduleLog>) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const days     = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const today    = todayStr();

  const scheduleMap: Record<string, ScheduleLog[]> = {};
  schedules.forEach(s => {
    if (!scheduleMap[s.date]) scheduleMap[s.date] = [];
    scheduleMap[s.date].push(s);
  });

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const BAR_COLORS = ["#ff4d6d", "#5856d6", "#34c759", "#ff9500", "#00c7be"];

  return (
    <div>
      <CalendarHeader year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />
      <WeekDayHeader />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: "52px" }} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day     = i + 1;
          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === today;
          const items   = scheduleMap[dateStr] ?? [];

          return (
            <div
              key={day}
              onClick={() => setExpandedDate(expandedDate === dateStr ? null : dateStr)}
              style={{ minHeight: "52px", padding: "2px", cursor: "pointer",
                touchAction: "manipulation" }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "28px", height: "28px", borderRadius: "50%",
                background: isToday ? "#ff4d6d" : "transparent",
                color: isToday ? "white" : "#333",
                fontWeight: isToday ? "bold" : "normal",
                fontSize: "13px", marginBottom: "2px",
              }}>
                {day}
              </div>
              {/* イベントバー（最大2件） */}
              {items.slice(0, 2).map((s, j) => (
                <div key={j} style={{
                  fontSize: "10px", padding: "1px 4px", borderRadius: "3px",
                  background: BAR_COLORS[j % BAR_COLORS.length] + "22",
                  color: BAR_COLORS[j % BAR_COLORS.length],
                  marginBottom: "1px", overflow: "hidden", whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}>
                  {s.title}
                </div>
              ))}
              {items.length > 2 && (
                <div style={{ fontSize: "9px", color: "#aaa" }}>他{items.length - 2}件</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 展開された日の予定詳細 */}
      {expandedDate && (scheduleMap[expandedDate] ?? []).length > 0 && (
        <div style={{ borderTop: "1px solid #eee", marginTop: "8px", paddingTop: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
            {expandedDate}の予定
          </div>
          {(scheduleMap[expandedDate] ?? []).map(s => (
            <ScheduleItem
              key={s.id} schedule={s}
              editingId={editingId}
              onEdit={onEdit} onSave={onSave}
              onCancelEdit={onCancelEdit} onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// モードC: ミニカレンダー + アジェンダ
// -----------------------------------------------------------------------------
function ModeC({
  schedules, year, month, selectedDate, onSelectDate, onPrevMonth, onNextMonth,
  editingId, onEdit, onSave, onCancelEdit, onDelete,
}: {
  schedules: ScheduleLog[];
  year: number; month: number;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onPrevMonth: () => void; onNextMonth: () => void;
  editingId: string | null;
  onEdit: (id: string) => void;
  onSave: (id: string, data: Partial<ScheduleLog>) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const days     = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const today    = todayStr();

  const scheduleMap: Record<string, ScheduleLog[]> = {};
  schedules.forEach(s => {
    if (!scheduleMap[s.date]) scheduleMap[s.date] = [];
    scheduleMap[s.date].push(s);
  });

  // 今日以降の予定を日付順で取得
  const todayNum = dateStrToNum(today);
  const upcomingSchedules = schedules
    .filter(s => dateStrToNum(s.date) >= todayNum)
    .sort((a, b) => dateStrToNum(a.date) - dateStrToNum(b.date));

  return (
    <div>
      {/* ミニカレンダー */}
      <CalendarHeader year={year} month={month} onPrev={onPrevMonth} onNext={onNextMonth} />
      <WeekDayHeader small />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ padding: "3px 0" }} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day     = i + 1;
          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === today;
          const isSel   = dateStr === selectedDate;
          const dots    = scheduleMap[dateStr] ?? [];

          return (
            <div
              key={day}
              onClick={() => onSelectDate(dateStr)}
              style={{ padding: "2px 0 4px", textAlign: "center", cursor: "pointer",
                touchAction: "manipulation" }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "26px", height: "26px", borderRadius: "50%",
                background: isToday ? "#ff4d6d" : isSel ? "#ffe0e6" : "transparent",
                color: isToday ? "white" : "#333",
                fontSize: "12px",
                fontWeight: isToday ? "bold" : "normal",
              }}>
                {day}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "2px",
                marginTop: "1px", minHeight: "5px" }}>
                {dots.slice(0, 3).map((_, j) => (
                  <div key={j} style={{
                    width: "4px", height: "4px", borderRadius: "50%",
                    background: j === 0 ? "#ff4d6d" : j === 1 ? "#5856d6" : "#34c759",
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* アジェンダ */}
      <div style={{ borderTop: "1px solid #eee", marginTop: "10px", paddingTop: "12px" }}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          今後の予定
        </div>
        {upcomingSchedules.length === 0 ? (
          <div style={{ fontSize: "13px", color: "#aaa" }}>予定はありません</div>
        ) : (
          upcomingSchedules.map(s => (
            <div key={s.id} style={{
              display: "flex", gap: "12px", marginBottom: "12px",
              paddingBottom: "12px", borderBottom: "1px solid #f0f0f0",
            }}>
              {/* 日付列 */}
              <div style={{ minWidth: "36px", textAlign: "center" }}>
                <div style={{
                  fontSize: s.date === today ? "11px" : "13px",
                  fontWeight: "bold", color: "#ff4d6d",
                }}>
                  {s.date.replace("月", "/").replace("日", "")}
                </div>
                {s.date === today && (
                  <div style={{ fontSize: "10px", color: "#ff4d6d" }}>今日</div>
                )}
                <div style={{ fontSize: "10px", color: "#aaa" }}>
                  {getDayOfWeek(year, month, s.date)}
                </div>
              </div>

              {/* 内容列 */}
              <div style={{ flex: 1 }}>
                {editingId === s.id ? (
                  <EditForm
                    schedule={s}
                    onSave={data => onSave(s.id, data)}
                    onCancel={onCancelEdit}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "2px" }}>
                      {s.title}
                    </div>
                    {s.startTime && (
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {s.startTime}{s.endTime ? `〜${s.endTime}` : "〜"}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                      <span style={{
                        fontSize: "11px", padding: "2px 8px", borderRadius: "10px",
                        background: "#ffe0e6", color: "#ff4d6d",
                      }}>予定</span>
                      <button
                        onClick={() => onEdit(s.id)}
                        style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
                          border: "1px solid #ddd", background: "#f5f5f5",
                          touchAction: "manipulation" }}
                      >修正</button>
                      <button
                        onClick={() => onDelete(s.id)}
                        style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
                          border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                          touchAction: "manipulation" }}
                      >削除</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 共通部品
// -----------------------------------------------------------------------------

function CalendarHeader({ year, month, onPrev, onNext }: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: "8px" }}>
      <div>
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>{year}年{month}月</div>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={onPrev} style={navBtnStyle}>‹</button>
        <button onClick={onNext} style={navBtnStyle}>›</button>
      </div>
    </div>
  );
}

function WeekDayHeader({ small = false }: { small?: boolean }) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
      marginBottom: "4px" }}>
      {days.map((d, i) => (
        <div key={d} style={{
          textAlign: "center",
          fontSize: small ? "11px" : "12px",
          color: i === 0 ? "#ff4d6d" : i === 6 ? "#5856d6" : "#999",
          fontWeight: "bold", padding: "2px 0",
        }}>{d}</div>
      ))}
    </div>
  );
}

function ScheduleItem({ schedule, editingId, onEdit, onSave, onCancelEdit, onDelete }: {
  schedule: ScheduleLog;
  editingId: string | null;
  onEdit: (id: string) => void;
  onSave: (id: string, data: Partial<ScheduleLog>) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ background: "#f9f9f9", borderRadius: "10px", padding: "10px 12px",
      marginBottom: "8px" }}>
      {editingId === schedule.id ? (
        <EditForm
          schedule={schedule}
          onSave={data => onSave(schedule.id, data)}
          onCancel={onCancelEdit}
        />
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {schedule.startTime && (
              <div style={{ color: "#ff4d6d", fontSize: "13px", marginBottom: "4px" }}>
                ⏰ {schedule.startTime}{schedule.endTime ? `〜${schedule.endTime}` : "〜"}
              </div>
            )}
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>{schedule.title}</div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={() => onEdit(schedule.id)}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                border: "1px solid #ddd", background: "#f5f5f5",
                touchAction: "manipulation" }}>修正</button>
            <button onClick={() => onDelete(schedule.id)}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                touchAction: "manipulation" }}>削除</button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: "28px", height: "28px", borderRadius: "6px",
  border: "1px solid #ddd", background: "#f5f5f5",
  cursor: "pointer", fontSize: "16px", lineHeight: "1",
  display: "flex", alignItems: "center", justifyContent: "center",
  touchAction: "manipulation",
};

/** 日付文字列から曜日を返す */
function getDayOfWeek(year: number, month: number, dateStr: string): string {
  const m = dateStr.match(/([0-9]+)月([0-9]+)日/);
  if (!m) return "";
  const d = new Date(year, Number(m[1]) - 1, Number(m[2]));
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

// -----------------------------------------------------------------------------
// メインページ
// -----------------------------------------------------------------------------
export default function SchedulePage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [schedules, setSchedules]     = useState<ScheduleLog[]>([]);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr());
  const [mode, setMode] = useState<CalendarMode>("C"); // デフォルトはC

  // データ読み込み
  useEffect(() => {
    const stored: ScheduleLog[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY_SCHEDULES) || "[]"
    );
    const resolved = stored.map(s => ({ ...s, date: resolveDate(s.date) }));
    setSchedules(resolved);

    // モード復元
    const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as CalendarMode | null;
    if (savedMode) setMode(savedMode);
  }, []);

  // モード変更時に保存
  function changeMode(m: CalendarMode) {
    setMode(m);
    localStorage.setItem(STORAGE_KEY_MODE, m);
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function handleSave(id: string, data: Partial<ScheduleLog>) {
    const updated = schedules.map(s => s.id === id ? { ...s, ...data } : s);
    setSchedules(updated);
    localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(updated));
    setEditingId(null);
  }

  function handleDelete(id: string) {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(updated));
  }

  const commonProps = {
    schedules, year, month,
    editingId,
    onEdit:       (id: string) => setEditingId(id),
    onSave:       handleSave,
    onCancelEdit: () => setEditingId(null),
    onDelete:     handleDelete,
    onPrevMonth:  prevMonth,
    onNextMonth:  nextMonth,
  };

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "16px 20px 12px", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>📅 予定</h1>

        {/* モード切替 */}
        <div style={{ display: "flex", gap: "4px" }}>
          {MODE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changeMode(key)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                border: mode === key ? "2px solid #ff4d6d" : "1px solid #ddd",
                background: mode === key ? "#ffe0e6" : "#f5f5f5",
                color: mode === key ? "#ff4d6d" : "#999",
                fontWeight: mode === key ? "bold" : "normal",
                fontSize: "13px", cursor: "pointer",
                touchAction: "manipulation",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* カレンダー本体 */}
      <div style={{ margin: "16px", background: "white", borderRadius: "16px",
        padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

        {mode === "A" && (
          <ModeA
            {...commonProps}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
        {mode === "B" && (
          <ModeB {...commonProps} />
        )}
        {mode === "C" && (
          <ModeC
            {...commonProps}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </div>

      <NavBar />
    </div>
  );
}
