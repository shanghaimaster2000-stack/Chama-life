"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChamaLog, LogType } from "../type";
import NavBar from "../components/NavBar";

// ログタイプのラベル
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
  | "rating_desc"    | "rating_asc";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "日付不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function getAreaLabel(log: ChamaLog) {
  if (log.country || log.prefecture || log.city) {
    return [log.country, log.prefecture, log.city].filter(Boolean).join(" / ");
  }
  return "地域未設定";
}

export default function AnalyzePage() {
  const [logs, setLogs] = useState<ChamaLog[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("visitedAt_desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
    setLogs(saved);
  }, []);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (typeFilter !== "all") {
      result = result.filter(log => log.type === typeFilter);
    }

    if (keyword.trim()) {
      const lw = keyword.trim().toLowerCase();
      result = result.filter(log =>
        [log.name, log.comment, log.genre, log.memo].join(" ").toLowerCase().includes(lw)
      );
    }

    if (startDate) {
      result = result.filter(log => new Date(log.visitedAt) >= new Date(startDate));
    }
    if (endDate) {
      result = result.filter(log => new Date(log.visitedAt) <= new Date(endDate + "T23:59:59"));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "visitedAt_desc": return new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime();
        case "visitedAt_asc":  return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
        case "price_desc":     return (b.price ?? 0) - (a.price ?? 0);
        case "price_asc":      return (a.price ?? 0) - (b.price ?? 0);
        case "rating_desc":    return (b.rating ?? 0) - (a.rating ?? 0);
        case "rating_asc":     return (a.rating ?? 0) - (b.rating ?? 0);
        default:               return 0;
      }
    });

    return result;
  }, [logs, typeFilter, keyword, sortBy, startDate, endDate]);

  const totalPrice = filteredLogs.reduce((sum, log) => sum + (log.price ?? 0), 0);

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px",
    borderRadius: "10px", border: "1px solid #ddd",
    fontSize: "14px", background: "white"
  };

  const card: React.CSSProperties = {
    background: "white", borderRadius: "12px", padding: "14px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
  };

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "20px 20px 10px", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)", marginBottom: "12px" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>📊 分析</h1>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* フィルター */}
        <div style={{ ...card, marginBottom: "12px" }}>
          <div style={{ display: "grid", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>種類で絞り込み</div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
                <option value="all">すべて</option>
                {Object.entries(LOG_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>並び替え</div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} style={selectStyle}>
                <option value="visitedAt_desc">新しい順</option>
                <option value="visitedAt_asc">古い順</option>
                <option value="price_desc">金額が高い順</option>
                <option value="price_asc">金額が安い順</option>
                <option value="rating_desc">評価が高い順</option>
                <option value="rating_asc">評価が低い順</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>期間選択</div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ ...selectStyle, flex: 1 }} />
                <span style={{ fontSize: "12px", color: "#999" }}>〜</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ ...selectStyle, flex: 1 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>キーワード検索</div>
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder="店名、感想、ジャンルなど" style={selectStyle} />
            </div>
          </div>
        </div>

        {/* サマリー */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          {[
            { label: "件数", value: `${filteredLogs.length}件` },
            { label: "合計金額", value: `${totalPrice.toLocaleString()}円` }
          ].map(({ label, value }) => (
            <div key={label} style={{ ...card, textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "#666" }}>{label}</div>
              <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ログ一覧 */}
        {filteredLogs.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#999", padding: "30px" }}>
            条件に合うログがありません
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} style={{ ...card, marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#ff4d6d", fontWeight: "bold" }}>
                  {LOG_TYPE_LABELS[log.type] || log.type}
                </span>
                <span style={{ fontSize: "11px", color: "#999" }}>
                  {formatDate(log.visitedAt)}
                </span>
              </div>
              <div style={{ fontSize: "17px", fontWeight: "bold", marginBottom: "6px" }}>
                {log.name || "名称なし"}
              </div>
              <div style={{ fontSize: "13px", color: "#555", display: "grid", gap: "3px" }}>
                {log.price !== null && <div>💰 {log.price.toLocaleString()}円</div>}
                {log.rating !== null && <div>⭐ 評価 {log.rating}</div>}
                {log.comment && <div>💬 {log.comment}</div>}
                {(log as any).companions && <div>👥 {(log as any).companions}</div>}
                <div style={{ color: "#bbb", fontSize: "11px" }}>{getAreaLabel(log)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <NavBar />
    </div>
  );
}
