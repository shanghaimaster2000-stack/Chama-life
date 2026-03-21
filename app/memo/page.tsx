"use client";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

type Memo = {
  id: string;
  content: string;
  reminder: boolean;
  reminderType: string;
  reminderDatetime: string;
  reminderDistance: number;
  createdAt: string;
};

export default function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [searchWord, setSearchWord] = useState("");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chamaMemos") || "[]");
    setMemos(stored.reverse()); // 新しい順
  }, []);

  function saveEdit(id: string) {
    const updated = memos.map(m => m.id === id ? { ...m, content: editContent } : m);
    setMemos(updated);
    localStorage.setItem("chamaMemos", JSON.stringify([...updated].reverse()));
    setEditingId(null);
  }

  function deleteMemo(id: string) {
    const updated = memos.filter(m => m.id !== id);
    setMemos(updated);
    localStorage.setItem("chamaMemos", JSON.stringify([...updated].reverse()));
  }

  const filtered = searchWord
    ? memos.filter(m => m.content.includes(searchWord))
    : memos;

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "20px 20px 10px", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>📓 メモ帳</h1>
        <input
          value={searchWord}
          onChange={e => setSearchWord(e.target.value)}
          placeholder="🔍 メモを検索..."
          style={{ width: "100%", marginTop: "10px", padding: "8px 12px",
            borderRadius: "10px", border: "1px solid #ddd", fontSize: "14px",
            boxSizing: "border-box" }}
        />
      </div>

      <div style={{ padding: "16px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", marginTop: "40px", fontSize: "14px" }}>
            メモはありません<br />
            ホーム画面のマイクから追加できます
          </div>
        ) : (
          filtered.map(m => (
            <div key={m.id} style={{
              background: "white", borderRadius: "12px", padding: "14px",
              marginBottom: "10px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
            }}>
              {editingId === m.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{ width: "100%", minHeight: "80px", borderRadius: "6px",
                      border: "1px solid #ddd", padding: "6px", fontSize: "14px",
                      marginBottom: "8px", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => saveEdit(m.id)}
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
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontSize: "12px", color: "#999" }}>
                      {new Date(m.createdAt).toLocaleDateString("ja-JP")}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => { setEditingId(m.id); setEditContent(m.content); }}
                        style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                          border: "1px solid #ddd", background: "#f5f5f5",
                          touchAction: "manipulation" }}>修正</button>
                      <button onClick={() => deleteMemo(m.id)}
                        style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                          border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                          touchAction: "manipulation" }}>削除</button>
                    </div>
                  </div>
                  <div style={{ fontSize: "15px", lineHeight: "1.6" }}>{m.content}</div>
                  {m.reminder && (
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "#5856d6",
                      background: "#f0f0ff", padding: "4px 8px", borderRadius: "6px",
                      display: "inline-block" }}>
                      🔔 {m.reminderType === "datetime"
                        ? `${new Date(m.reminderDatetime).toLocaleString("ja-JP")}`
                        : `帰宅${m.reminderDistance}km以内`}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <NavBar />
    </div>
  );
}
