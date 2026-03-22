// =============================================================================
// analyze/page.tsx
// 分析画面 - タブ形式・グラフ・ランキング・ログ一覧（編集・削除対応）
//
// タブ構成:
//   📊 サマリー  : 集計数値・主要統計
//   📈 グラフ    : 月別支出・カテゴリ別支出
//   🏆 ランキング: 地域別・人別・時間別
//   📋 ログ一覧  : 絞り込み・編集・削除
//
// 設計方針:
//   - データ取得は fetchLogs() に集約（将来Supabase差し替え用）
//   - グラフは Chart.js（軽量・SSR対応）
//   - 将来タブを追加する時は TABS 配列に追加するだけ
// =============================================================================

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { ChamaLog } from "../type";
import NavBar from "../components/NavBar";

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const STORAGE_KEY = "chamaLogs";

const LOG_TYPE_LABELS: Record<string, string> = {
  restaurant:  "🍜 食事/飲食",
  hotel:       "🏨 宿泊",
  sightseeing: "🗼 観光",
  leisure:     "🎡 レジャー",
  sports:      "⚽ スポーツ",
  watching:    "🏟️ 観戦",
  live:        "🎵 ライブ",
  hospital:    "🏥 病院",
  pharmacy:    "💊 薬局",
  shopping:    "🛍️ 買物",
  ceremony:    "💐 冠婚葬祭",
  work:        "💼 仕事",
};

type SortOption =
  | "visitedAt_desc" | "visitedAt_asc"
  | "price_desc"     | "price_asc"
  | "rating_desc"    | "rating_asc"
  | "area_asc";

type TabKey = "summary" | "graph" | "ranking" | "logs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary",  label: "📊 サマリー" },
  { key: "graph",    label: "📈 グラフ" },
  { key: "ranking",  label: "🏆 ランキング" },
  { key: "logs",     label: "📋 ログ一覧" },
];

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

// 将来: Supabase移行時はここを差し替えるだけ
async function fetchLogs(): Promise<ChamaLog[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveLogs(logs: ChamaLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "日付不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function getAreaLabel(log: ChamaLog) {
  return [log.country, log.prefecture, log.city].filter(Boolean).join(" / ") || "地域未設定";
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// -----------------------------------------------------------------------------
// スタイル定数
// -----------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: "white", borderRadius: "12px", padding: "14px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  borderRadius: "10px", border: "1px solid #ddd",
  fontSize: "14px", background: "white",
};

// -----------------------------------------------------------------------------
// サマリータブ
// -----------------------------------------------------------------------------
function SummaryTab({ logs }: { logs: ChamaLog[] }) {
  const withPrice  = logs.filter(l => l.price !== null && l.price > 0);
  const withRating = logs.filter(l => l.rating !== null);
  const totalPrice = withPrice.reduce((s, l) => s + (l.price ?? 0), 0);
  const avgPrice   = withPrice.length > 0 ? Math.round(totalPrice / withPrice.length) : 0;
  const avgRating  = withRating.length > 0
    ? Math.round(avg(withRating.map(l => l.rating ?? 0)) * 10) / 10 : 0;

  // カテゴリ別件数
  const typeCounts: Record<string, number> = {};
  logs.forEach(l => { typeCounts[l.type] = (typeCounts[l.type] ?? 0) + 1; });
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 今月・今週の件数
  const now = new Date();
  const thisMonth = logs.filter(l => {
    const d = new Date(l.visitedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = logs.filter(l => new Date(l.visitedAt) >= oneWeekAgo).length;

  const stats = [
    { label: "総記録件数",   value: `${logs.length}件`,               color: "#ff4d6d" },
    { label: "総支出",       value: `${totalPrice.toLocaleString()}円`, color: "#5856d6" },
    { label: "平均支出",     value: `${avgPrice.toLocaleString()}円`,   color: "#ff9500" },
    { label: "平均評価",     value: avgRating > 0 ? `⭐${avgRating}` : "なし", color: "#34c759" },
    { label: "今月の記録",   value: `${thisMonth}件`,                  color: "#00c7be" },
    { label: "直近7日",      value: `${thisWeek}件`,                   color: "#ff2d55" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* 数値グリッド */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* カテゴリ別件数 */}
      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          📂 カテゴリ別件数 TOP5
        </div>
        {topTypes.length === 0 ? (
          <div style={{ color: "#aaa", fontSize: "13px" }}>データがありません</div>
        ) : topTypes.map(([type, count]) => {
          const pct = Math.round((count / logs.length) * 100);
          return (
            <div key={type} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                fontSize: "13px", marginBottom: "3px" }}>
                <span>{LOG_TYPE_LABELS[type] ?? type}</span>
                <span style={{ color: "#999" }}>{count}件 ({pct}%)</span>
              </div>
              <div style={{ height: "6px", background: "#f0f0f0", borderRadius: "3px" }}>
                <div style={{ height: "100%", width: `${pct}%`,
                  background: "#ff4d6d", borderRadius: "3px",
                  transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// グラフタブ
// -----------------------------------------------------------------------------
function GraphTab({ logs }: { logs: ChamaLog[] }) {
  const monthlyCanvasRef  = useRef<HTMLCanvasElement>(null);
  const categoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const weekdayCanvasRef  = useRef<HTMLCanvasElement>(null);
  const chartRefs = useRef<any[]>([]);

  // 月別支出データ（直近12ヶ月）
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => {
      if (!l.price || !l.visitedAt) return;
      const d = new Date(l.visitedAt);
      const key = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}`;
      map[key] = (map[key] ?? 0) + l.price;
    });
    const sorted = Object.entries(map).sort().slice(-12);
    return { labels: sorted.map(([k]) => k), values: sorted.map(([,v]) => v) };
  }, [logs]);

  // カテゴリ別支出データ
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => {
      if (!l.price) return;
      map[l.type] = (map[l.type] ?? 0) + l.price;
    });
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]);
    return {
      labels: sorted.map(([k]) => LOG_TYPE_LABELS[k]?.replace(/^.\s/,"") ?? k),
      values: sorted.map(([,v]) => v),
    };
  }, [logs]);

  // 曜日別件数
  const weekdayData = useMemo(() => {
    const days = ["日","月","火","水","木","金","土"];
    const counts = [0,0,0,0,0,0,0];
    logs.forEach(l => {
      if (!l.visitedAt) return;
      counts[new Date(l.visitedAt).getDay()]++;
    });
    return { labels: days, values: counts };
  }, [logs]);

  useEffect(() => {
    // Chart.jsを動的にimport
    import("chart.js/auto").then(({ default: Chart }) => {
      // 既存チャートを破棄
      chartRefs.current.forEach(c => c?.destroy());
      chartRefs.current = [];

      if (monthlyCanvasRef.current && monthlyData.labels.length > 0) {
        chartRefs.current.push(new Chart(monthlyCanvasRef.current, {
          type: "bar",
          data: {
            labels: monthlyData.labels,
            datasets: [{
              label: "支出(円)",
              data: monthlyData.values,
              backgroundColor: "#ff4d6d88",
              borderColor: "#ff4d6d",
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { ticks: { callback: (v: any) => `${Number(v).toLocaleString()}円` } },
            },
          },
        }));
      }

      if (categoryCanvasRef.current && categoryData.labels.length > 0) {
        const COLORS = [
          "#ff4d6d","#5856d6","#34c759","#ff9500","#00c7be",
          "#ff2d55","#af52de","#5ac8fa","#ffcc00","#8e8e93",
        ];
        chartRefs.current.push(new Chart(categoryCanvasRef.current, {
          type: "doughnut",
          data: {
            labels: categoryData.labels,
            datasets: [{
              data: categoryData.values,
              backgroundColor: COLORS.slice(0, categoryData.labels.length),
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: "bottom", labels: { font: { size: 11 } } },
            },
          },
        }));
      }

      if (weekdayCanvasRef.current) {
        chartRefs.current.push(new Chart(weekdayCanvasRef.current, {
          type: "bar",
          data: {
            labels: weekdayData.labels,
            datasets: [{
              label: "件数",
              data: weekdayData.values,
              backgroundColor: weekdayData.labels.map((_, i) =>
                i === 0 ? "#ff4d6d88" : i === 6 ? "#5856d688" : "#ff9eb588"
              ),
              borderColor: weekdayData.labels.map((_, i) =>
                i === 0 ? "#ff4d6d" : i === 6 ? "#5856d6" : "#ff9eb5"
              ),
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { stepSize: 1 } } },
          },
        }));
      }
    });

    return () => { chartRefs.current.forEach(c => c?.destroy()); };
  }, [monthlyData, categoryData, weekdayData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          📅 月別支出（直近12ヶ月）
        </div>
        {monthlyData.labels.length === 0 ? (
          <div style={{ color: "#aaa", fontSize: "13px" }}>データがありません</div>
        ) : (
          <canvas ref={monthlyCanvasRef} />
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          🍩 カテゴリ別支出
        </div>
        {categoryData.labels.length === 0 ? (
          <div style={{ color: "#aaa", fontSize: "13px" }}>データがありません</div>
        ) : (
          <canvas ref={categoryCanvasRef} />
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          📆 曜日別件数
        </div>
        <canvas ref={weekdayCanvasRef} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ランキングタブ
// -----------------------------------------------------------------------------
type RankingCategory = "prefecture" | "country" | "companion" | "name";

function RankingTab({ logs }: { logs: ChamaLog[] }) {
  const [category, setCategory] = useState<RankingCategory>("prefecture");
  const [metric, setMetric] = useState<"count" | "totalPrice" | "avgPrice" | "pricePerHour">("count");

  const rankingData = useMemo(() => {
    const map: Record<string, {
      count: number; totalPrice: number; totalMinutes: number; logs: ChamaLog[];
    }> = {};

    logs.forEach(l => {
      let key = "";
      if (category === "prefecture") key = l.prefecture || "不明";
      else if (category === "country") key = l.country || "不明";
      else if (category === "companion") key = (l as any).companions || "単独";
      else if (category === "name") key = l.name || "名称不明";

      if (!map[key]) map[key] = { count: 0, totalPrice: 0, totalMinutes: 0, logs: [] };
      map[key].count++;
      map[key].totalPrice += l.price ?? 0;
      map[key].logs.push(l);
    });

    return Object.entries(map).map(([key, v]) => ({
      key,
      count:        v.count,
      totalPrice:   v.totalPrice,
      avgPrice:     v.count > 0 ? Math.round(v.totalPrice / v.count) : 0,
      pricePerHour: 0, // 将来: 滞在時間データが揃ったら実装
    })).sort((a, b) => {
      if (metric === "count")        return b.count - a.count;
      if (metric === "totalPrice")   return b.totalPrice - a.totalPrice;
      if (metric === "avgPrice")     return b.avgPrice - a.avgPrice;
      if (metric === "pricePerHour") return b.pricePerHour - a.pricePerHour;
      return 0;
    }).slice(0, 20);
  }, [logs, category, metric]);

  const MEDAL = ["🥇","🥈","🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* カテゴリ切替 */}
      <div style={card}>
        <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>集計単位</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {([
            { key: "prefecture", label: "🗾 都道府県" },
            { key: "country",    label: "🌍 国" },
            { key: "companion",  label: "👥 同行者" },
            { key: "name",       label: "🏠 施設名" },
          ] as { key: RankingCategory; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setCategory(key)} style={{
              padding: "5px 10px", fontSize: "12px", borderRadius: "8px",
              border: "none", cursor: "pointer", touchAction: "manipulation",
              background: category === key ? "#ff4d6d" : "#f0f0f0",
              color: category === key ? "white" : "#555",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px", marginTop: "10px" }}>
          指標
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {([
            { key: "count",        label: "訪問回数" },
            { key: "totalPrice",   label: "総支出" },
            { key: "avgPrice",     label: "1回あたり支出" },
            { key: "pricePerHour", label: "時間あたり支出" },
          ] as { key: typeof metric; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setMetric(key)} style={{
              padding: "5px 10px", fontSize: "12px", borderRadius: "8px",
              border: "none", cursor: "pointer", touchAction: "manipulation",
              background: metric === key ? "#5856d6" : "#f0f0f0",
              color: metric === key ? "white" : "#555",
              opacity: key === "pricePerHour" ? 0.5 : 1,
            }}>
              {label}{key === "pricePerHour" ? "（準備中）" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* ランキング一覧 */}
      <div style={card}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "10px" }}>
          🏆 ランキング（TOP20）
        </div>
        {rankingData.length === 0 ? (
          <div style={{ color: "#aaa", fontSize: "13px" }}>データがありません</div>
        ) : rankingData.map((item, i) => {
          const value =
            metric === "count"        ? `${item.count}回` :
            metric === "totalPrice"   ? `${item.totalPrice.toLocaleString()}円` :
            metric === "avgPrice"     ? `${item.avgPrice.toLocaleString()}円` :
            "準備中";

          const maxVal =
            metric === "count"      ? rankingData[0].count :
            metric === "totalPrice" ? rankingData[0].totalPrice :
            metric === "avgPrice"   ? rankingData[0].avgPrice : 1;

          const pct = maxVal > 0
            ? Math.round(((metric === "count" ? item.count :
                metric === "totalPrice" ? item.totalPrice : item.avgPrice) / maxVal) * 100)
            : 0;

          return (
            <div key={item.key} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", fontSize: "13px", marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ minWidth: "24px", fontWeight: "bold",
                    color: i < 3 ? "#ff4d6d" : "#aaa" }}>
                    {i < 3 ? MEDAL[i] : `${i+1}.`}
                  </span>
                  <span style={{ fontWeight: i < 3 ? "bold" : "normal" }}>{item.key}</span>
                </div>
                <span style={{ color: "#ff4d6d", fontWeight: "bold" }}>{value}</span>
              </div>
              <div style={{ height: "5px", background: "#f0f0f0", borderRadius: "3px" }}>
                <div style={{ height: "100%", width: `${pct}%`,
                  background: i < 3 ? "#ff4d6d" : "#ffb3c1",
                  borderRadius: "3px", transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ログ一覧タブ
// -----------------------------------------------------------------------------
function LogsTab({
  logs, onUpdate, onDelete,
}: {
  logs: ChamaLog[];
  onUpdate: (id: string, data: Partial<ChamaLog>) => void;
  onDelete: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [keyword,    setKeyword]    = useState("");
  const [sortBy,     setSortBy]     = useState<SortOption>("visitedAt_desc");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editData,   setEditData]   = useState<Partial<ChamaLog>>({});

  const filtered = useMemo(() => {
    let result = [...logs];
    if (typeFilter !== "all") result = result.filter(l => l.type === typeFilter);
    if (keyword.trim()) {
      const lw = keyword.trim().toLowerCase();
      result = result.filter(l =>
        [l.name, l.comment, l.genre, l.memo, l.prefecture, l.city, l.country]
          .join(" ").toLowerCase().includes(lw)
      );
    }
    if (startDate) result = result.filter(l => new Date(l.visitedAt) >= new Date(startDate));
    if (endDate)   result = result.filter(l => new Date(l.visitedAt) <= new Date(endDate + "T23:59:59"));
    result.sort((a, b) => {
      switch (sortBy) {
        case "visitedAt_desc": return new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime();
        case "visitedAt_asc":  return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
        case "price_desc":     return (b.price ?? 0) - (a.price ?? 0);
        case "price_asc":      return (a.price ?? 0) - (b.price ?? 0);
        case "rating_desc":    return (b.rating ?? 0) - (a.rating ?? 0);
        case "rating_asc":     return (a.rating ?? 0) - (b.rating ?? 0);
        case "area_asc":       return getAreaLabel(a).localeCompare(getAreaLabel(b));
        default:               return 0;
      }
    });
    return result;
  }, [logs, typeFilter, keyword, sortBy, startDate, endDate]);

  const totalPrice = filtered.reduce((s, l) => s + (l.price ?? 0), 0);

  function startEdit(log: ChamaLog) {
    setEditingId(log.id);
    setEditData({
      name: log.name, price: log.price, rating: log.rating,
      comment: log.comment, companions: (log as any).companions,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* フィルター */}
      <div style={card}>
        <div style={{ display: "grid", gap: "8px" }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
            <option value="all">すべてのカテゴリ</option>
            {Object.entries(LOG_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} style={selectStyle}>
            <option value="visitedAt_desc">新しい順</option>
            <option value="visitedAt_asc">古い順</option>
            <option value="price_desc">金額が高い順</option>
            <option value="price_asc">金額が安い順</option>
            <option value="rating_desc">評価が高い順</option>
            <option value="rating_asc">評価が低い順</option>
            <option value="area_asc">地域順</option>
          </select>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...selectStyle, flex: 1 }} />
            <span style={{ fontSize: "12px", color: "#999" }}>〜</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ ...selectStyle, flex: 1 }} />
          </div>
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="🔍 店名・感想・地域などで検索" style={selectStyle} />
        </div>
      </div>

      {/* サマリーバー */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {[
          { label: "件数", value: `${filtered.length}件` },
          { label: "合計", value: `${totalPrice.toLocaleString()}円` },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...card, textAlign: "center", padding: "10px" }}>
            <div style={{ fontSize: "11px", color: "#999" }}>{label}</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#ff4d6d" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ログ一覧 */}
      {filtered.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#999", padding: "30px" }}>
          条件に合うログがありません
        </div>
      ) : filtered.map(log => (
        <div key={log.id} style={{ ...card, marginBottom: "2px" }}>
          {editingId === log.id ? (
            // 編集フォーム
            <div>
              <div style={{ fontSize: "12px", color: "#ff4d6d", marginBottom: "8px", fontWeight: "bold" }}>
                {LOG_TYPE_LABELS[log.type] ?? log.type} を編集
              </div>
              {[
                { key: "name",    label: "名称",  type: "text" },
                { key: "price",   label: "金額",  type: "number" },
                { key: "rating",  label: "評価",  type: "number" },
                { key: "comment", label: "感想",  type: "text" },
                { key: "companions", label: "同行者", type: "text" },
              ].map(({ key, label, type }) => (
                <div key={key} style={{ marginBottom: "6px" }}>
                  <div style={{ fontSize: "11px", color: "#999", marginBottom: "2px" }}>{label}</div>
                  <input
                    type={type}
                    value={(editData as any)[key] ?? ""}
                    onChange={e => setEditData({ ...editData, [key]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })}
                    style={{ ...selectStyle, padding: "6px 8px" }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button
                  onClick={() => { onUpdate(log.id, editData); setEditingId(null); }}
                  style={{ flex: 1, padding: "8px", background: "#ff4d6d", color: "white",
                    border: "none", borderRadius: "8px", fontSize: "14px",
                    touchAction: "manipulation" }}
                >保存</button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{ flex: 1, padding: "8px", background: "#eee",
                    border: "none", borderRadius: "8px", fontSize: "14px",
                    touchAction: "manipulation" }}
                >キャンセル</button>
              </div>
            </div>
          ) : (
            // 表示モード
            <div>
              {/* ヘッダー行 */}
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#ff4d6d", fontWeight: "bold" }}>
                  {LOG_TYPE_LABELS[log.type] ?? log.type}
                </span>
                <span style={{ fontSize: "11px", color: "#bbb" }}>
                  {formatDate(log.visitedAt)}
                </span>
              </div>

              {/* 施設名 */}
              <div
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px",
                  cursor: "pointer", touchAction: "manipulation" }}
              >
                {log.name || "名称なし"}
                <span style={{ fontSize: "12px", color: "#ccc", marginLeft: "6px" }}>
                  {expandedId === log.id ? "▲" : "▼"}
                </span>
              </div>

              {/* 基本情報（常時表示） */}
              <div style={{ display: "flex", gap: "10px", fontSize: "13px", color: "#666" }}>
                {log.price !== null && log.price !== undefined && (
                  <span>💰 {log.price.toLocaleString()}円</span>
                )}
                {log.rating !== null && log.rating !== undefined && (
                  <span>⭐ {log.rating}</span>
                )}
                {log.city && <span style={{ color: "#bbb", fontSize: "12px" }}>📍{log.city}</span>}
              </div>

              {/* 展開詳細 */}
              {expandedId === log.id && (
                <div style={{ marginTop: "10px", paddingTop: "10px",
                  borderTop: "1px solid #f0f0f0", fontSize: "13px", color: "#555" }}>
                  {log.comment && (
                    <div style={{ marginBottom: "6px" }}>💬 {log.comment}</div>
                  )}
                  {log.memo && log.memo !== log.comment && (
                    <div style={{ marginBottom: "6px", color: "#888" }}>📝 {log.memo}</div>
                  )}
                  {(log as any).companions && (
                    <div style={{ marginBottom: "6px" }}>👥 {(log as any).companions}</div>
                  )}
                  {(log as any).totalPeople && (
                    <div style={{ marginBottom: "6px" }}>👤 計{(log as any).totalPeople}人</div>
                  )}
                  <div style={{ color: "#bbb", fontSize: "12px", marginBottom: "8px" }}>
                    📍 {getAreaLabel(log)}
                  </div>

                  {/* 操作ボタン */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => startEdit(log)}
                      style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "6px",
                        border: "1px solid #ddd", background: "#f5f5f5",
                        touchAction: "manipulation" }}>修正</button>
                    <button onClick={() => {
                      if (confirm(`「${log.name}」を削除しますか？`)) onDelete(log.id);
                    }}
                      style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "6px",
                        border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                        touchAction: "manipulation" }}>削除</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// メインページ
// -----------------------------------------------------------------------------
export default function AnalyzePage() {
  const [logs, setLogs]   = useState<ChamaLog[]>([]);
  const [tab, setTab]     = useState<TabKey>("summary");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchLogs().then(data => { setLogs(data); setIsLoaded(true); });
  }, []);

  function handleUpdate(id: string, data: Partial<ChamaLog>) {
    const updated = logs.map(l => l.id === id ? { ...l, ...data } : l);
    setLogs(updated);
    saveLogs(updated);
  }

  function handleDelete(id: string) {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
  }

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "16px 20px 0", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)", marginBottom: "0" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "20px" }}>📊 分析</h1>

        {/* タブ */}
        <div style={{ display: "flex", gap: "2px", overflowX: "auto" }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "8px 12px", fontSize: "12px", whiteSpace: "nowrap",
                border: "none", cursor: "pointer", touchAction: "manipulation",
                background: "transparent",
                color: tab === key ? "#ff4d6d" : "#999",
                fontWeight: tab === key ? "bold" : "normal",
                borderBottom: tab === key ? "2px solid #ff4d6d" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ padding: "14px 16px" }}>
        {!isLoaded ? (
          <div style={{ textAlign: "center", color: "#aaa", marginTop: "40px" }}>
            読み込み中...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#999", padding: "40px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
            <div>まだログがありません</div>
            <div style={{ fontSize: "12px", color: "#bbb", marginTop: "6px" }}>
              ホーム画面の音声入力から記録してみよう！
            </div>
          </div>
        ) : (
          <>
            {tab === "summary"  && <SummaryTab  logs={logs} />}
            {tab === "graph"    && <GraphTab    logs={logs} />}
            {tab === "ranking"  && <RankingTab  logs={logs} />}
            {tab === "logs"     && <LogsTab     logs={logs} onUpdate={handleUpdate} onDelete={handleDelete} />}
          </>
        )}
      </div>

      <NavBar />
    </div>
  );
}
