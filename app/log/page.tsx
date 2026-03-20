"use client";
import { useState } from "react";
import type { ChamaLog, LogType } from "../../type"; // ✅ パス修正（sなし）

function createLogId() {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

export default function LogPage() {
  const [type, setType] = useState<LogType>("restaurant");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [rating, setRating] = useState("");

  function saveLog() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const newLog: ChamaLog = {
        id: createLogId(),
        lat,
        lon,
        type,
        name,
        price: price ? Number(price) : null,
        rating: rating ? Number(rating) : null,
        comment: "",
        genre: "other",
        memo: "",
        visitedAt: new Date().toISOString()
      };

      let logs: ChamaLog[] = [];
      if (typeof window !== "undefined") {
        logs = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
      }
      logs.push(newLog);
      localStorage.setItem("chamaLogs", JSON.stringify(logs));
      alert("保存したよ🍜");
    });
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>🍜 食ログ</h1>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as LogType)} // ✅ 型キャスト追加
      >
        <option value="restaurant">🍜 レストラン</option>
        <option value="hotel">🏨 ホテル</option>
        <option value="spot">📍 観光</option>
        <option value="work">💼 仕事</option>
      </select>

      <input
        placeholder="名前"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="価格"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <input
        placeholder="評価(1-5)"
        value={rating}
        onChange={(e) => setRating(e.target.value)}
      />

      <br /><br />

      <button onClick={saveLog}>保存</button>
    </div>
  );
}
