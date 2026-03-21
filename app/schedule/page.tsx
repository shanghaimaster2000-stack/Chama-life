"use client";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

type Schedule = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string;
  createdAt: string;
};

function resolveDate(dateStr: string): string {
  const now = new Date();
  if (dateStr === "今日") return `${now.getMonth()+1}月${now.getDate()}日`;
  if (dateStr === "明日") { const d = new Date(now); d.setDate(d.getDate()+1); return `${d.getMonth()+1}月${d.getDate()}日`; }
  if (dateStr === "明後日") { const d = new Date(now); d.setDate(d.getDate()+2); return `${d.getMonth()+1}月${d.getDate()}日`; }
  return dateStr;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Schedule>>({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
    // 日付を実際の日付に変換して表示
    const resolved = stored.map((s: Schedule) => ({
      ...s,
      date: resolveDate(s.date),
    }));
    setSchedules(resolved);
  }, []);

  function saveEdit(id: string) {
    const updated = schedules.map(s => s.id === id ? { ...s, ...editData } : s);
    setSchedules(updated);
    localStorage.setItem("chamaSchedules", JSON.stringify(updated));
    setEditingId(null);
    setEditData({});
  }

  function deleteSchedule(id: string) {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    localStorage.setItem("chamaSchedules", JSON.stringify(updated));
  }

  // 日付でグループ化
  const grouped = schedules.reduce((acc: Record<string, Schedule[]>, s) => {
    const key = s.date || "日付未設定";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    // 「N月N日」形式をソート
    const toNum = (s: string) => {
      const m = s.match(/([0-9]+)月([0-9]+)日/);
      return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
    };
    return toNum(a) - toNum(b);
  });

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      <div style={{ padding: "20px 20px 10px", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>📅 予定</h1>
      </div>

      <div style={{ padding: "16px" }}>
        {schedules.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", marginTop: "40px", fontSize: "14px" }}>
            予定はありません<br />
            ホーム画面のマイクから追加できます
          </div>
        ) : (
          sortedKeys.map(dateKey => (
            <div key={dateKey} style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#ff4d6d",
                marginBottom: "6px", paddingLeft: "4px" }}>
                📆 {dateKey}
              </div>
              {grouped[dateKey].map(s => (
                <div key={s.id} style={{
                  background: "white", borderRadius: "12px", padding: "14px",
                  marginBottom: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
                }}>
                  {editingId === s.id ? (
                    <div>
                      <input value={editData.date ?? s.date}
                        onChange={e => setEditData({...editData, date: e.target.value})}
                        placeholder="日付" style={{ width: "100%", marginBottom: "6px" }} />
                      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                        <input value={editData.startTime ?? s.startTime}
                          onChange={e => setEditData({...editData, startTime: e.target.value})}
                          placeholder="開始 10:00" style={{ flex: 1 }} />
                        <span style={{ lineHeight: "28px" }}>〜</span>
                        <input value={editData.endTime ?? s.endTime}
                          onChange={e => setEditData({...editData, endTime: e.target.value})}
                          placeholder="終了" style={{ flex: 1 }} />
                      </div>
                      <input value={editData.title ?? s.title}
                        onChange={e => setEditData({...editData, title: e.target.value})}
                        placeholder="内容" style={{ width: "100%", marginBottom: "8px" }} />
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => saveEdit(s.id)}
                          style={{ flex: 1, padding: "6px", background: "#ff4d6d", color: "white",
                            border: "none", borderRadius: "6px", touchAction: "manipulation" }}>
                          保存
                        </button>
                        <button onClick={() => setEditingId(null)}
                          style={{ flex: 1, padding: "6px", background: "#eee",
                            border: "none", borderRadius: "6px", touchAction: "manipulation" }}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        {s.startTime && (
                          <div style={{ color: "#ff4d6d", fontSize: "13px", marginBottom: "4px" }}>
                            ⏰ {s.startTime}{s.endTime ? `〜${s.endTime}` : "〜"}
                          </div>
                        )}
                        <div style={{ fontSize: "15px", fontWeight: "bold" }}>{s.title}</div>
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => { setEditingId(s.id); setEditData({}); }}
                          style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                            border: "1px solid #ddd", background: "#f5f5f5",
                            touchAction: "manipulation" }}>修正</button>
                        <button onClick={() => deleteSchedule(s.id)}
                          style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                            border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                            touchAction: "manipulation" }}>削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <NavBar />
    </div>
  );
}
