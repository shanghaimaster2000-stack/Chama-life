"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChamaLog, LogType } from "../type"; // ✅ パス修正

type SortOption =
  | "visitedAt_desc"
  | "visitedAt_asc"
  | "price_desc"
  | "price_asc"
  | "rating_desc"
  | "rating_asc";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "日付不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTypeLabel(type: LogType) {
  const labels: Record<LogType, string> = {
    restaurant: "🍜 外食",
    hotel: "🏨 ホテル",
    spot: "📍 観光",
    work: "💼 仕事"
  };
  return labels[type] ?? "その他";
}

function getAreaLabel(log: ChamaLog) {
  if (log.country || log.prefecture || log.city) {
    return [log.country, log.prefecture, log.city].filter(Boolean).join(" / ");
  }
  return "地域未設定";
}

export default function RankingPage() {
  const [logs, setLogs] = useState<ChamaLog[]>([]);
  const [typeFilter, setTypeFilter] = useState<LogType | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("visitedAt_desc");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
    setLogs(saved);
  }, []);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (typeFilter !== "all") {
      result = result.filter((log) => log.type === typeFilter);
    }

    if (keyword.trim()) {
      const lowerKeyword = keyword.trim().toLowerCase();
      result = result.filter((log) =>
        [log.name, log.comment, log.genre, log.memo]
          .join(" ")
          .toLowerCase()
          .includes(lowerKeyword)
      );
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
  }, [logs, typeFilter, keyword, sortBy]);

  const totalCount = filteredLogs.length;
  const totalPrice = filteredLogs.reduce((sum, log) => sum + (log.price ?? 0), 0);

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px",
    borderRadius: "10px", border: "1px solid #ddd"
  };

  return (
    <div style={{
      padding: "20px", maxWidth: "1000px", margin: "0 auto",
      background: "#f5f6f8", minHeight: "100vh", fontFamily: "sans-serif"
    }}>
      <h1 style={{ marginBottom: "8px" }}>📚 Chama Life 分析ページ</h1>
      <div style={{ color: "#666", marginBottom: "20px" }}>
        全ログを時系列・並び替え・絞り込みで確認するページ
      </div>

      {/* フィルター */}
      <div style={{
        background: "#fff", borderRadius: "14px", padding: "16px",
        boxShadow: "0 3px 8px rgba(0,0,0,0.08)", marginBottom: "20px"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px"
        }}>
          <div>
            <div style={{ fontSize: "13px", marginBottom: "6px", color: "#666" }}>種類で絞り込み</div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as LogType | "all")} style={selectStyle}>
              <option value="all">すべて</option>
              <option value="restaurant">🍜 外食</option>
              <option value="hotel">🏨 ホテル</option>
              <option value="spot">📍 観光</option>
              <option value="work">💼 仕事</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: "13px", marginBottom: "6px", color: "#666" }}>並び替え</div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} style={selectStyle}>
              <option value="visitedAt_desc">新しい順</option>
              <option value="visitedAt_asc">古い順</option>
              <option value="price_desc">金額が高い順</option>
              <option value="price_asc">金額が安い順</option>
              <option value="rating_desc">評価が高い順</option>
              <option value="rating_asc">評価が低い順</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: "13px", marginBottom: "6px", color: "#666" }}>キーワード検索</div>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="店名、感想、ジャンルなど"
              style={selectStyle}
            />
          </div>
        </div>
      </div>

      {/* サマリー */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px", marginBottom: "20px"
      }}>
        {[
          { label: "表示件数", value: `${totalCount}件` },
          { label: "合計金額", value: `${totalPrice.toLocaleString()}円` }
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "#fff", borderRadius: "14px", padding: "16px",
            boxShadow: "0 3px 8px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: "13px", color: "#666" }}>{label}</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "8px" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ログ一覧 */}
      <div style={{ display: "grid", gap: "14px" }}>
        {filteredLogs.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: "14px", padding: "20px",
            boxShadow: "0 3px 8px rgba(0,0,0,0.08)"
          }}>
            条件に合うログがありません
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} style={{
              background: "#fff", borderRadius: "14px", padding: "16px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.08)"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "16px" }}>
                {/* 左カラム */}
                <div>
                  <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>地域</div>
                  <div style={{ fontWeight: "bold", fontSize: "16px" }}>{getAreaLabel(log)}</div>
                  <div style={{ marginTop: "14px", fontSize: "12px", color: "#888" }}>種類</div>
                  <div>{getTypeLabel(log.type)}</div>
                  <div style={{ marginTop: "14px", fontSize: "12px", color: "#888" }}>訪問日時</div>
                  <div>{formatDate(log.visitedAt)}</div>
                </div>

                {/* 右カラム */}
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "12px" }}>
                    {log.name || "名称なし"}
                  </div>
                  <div style={{ display: "grid", gap: "8px", fontSize: "14px" }}>
                    {[
                      { label: "金額",     value: log.price  !== null ? `${log.price.toLocaleString()}円` : "-" },
                      { label: "評価",     value: log.rating !== null ? String(log.rating) : "-" },
                      { label: "ジャンル", value: log.genre  || "-" },
                      { label: "感想",     value: log.comment || "-" },
                      { label: "メモ",     value: log.memo   || "-" },
                      { label: "位置情報", value: log.lat && log.lon ? `${log.lat.toFixed(4)}, ${log.lon.toFixed(4)}` : "-" }
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span style={{ color: "#666" }}>{label}: </span>{value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
