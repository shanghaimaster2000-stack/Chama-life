"use client";
import { useEffect, useState, useRef } from "react";
import type { ChamaLog, FoodGenre } from "./type";
import { analyzeVoiceInput } from "./lib/analyzeVoiceInput";
import { LOG_TYPE_CONFIG } from "./lib/handlers/genericLogHandler";
import NavBar from "./components/NavBar";

function getPollenLevel(temp: number, humidity: number, wind: number) {
  if (temp < 10) return "少ない";
  if (wind > 5 && humidity < 60) return "非常に多い";
  if (wind > 3 && humidity < 70) return "多い";
  if (temp > 15) return "やや多い";
  return "少ない";
}

async function getAddressFromLatLon(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url);
  const data = await res.json();
  const address = data.address || {};
  return {
    country: address.country || "",
    prefecture: address.state || "",
    city: address.city || address.town || address.village || ""
  };
}

function createLogId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [weather, setWeather] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [foodLog, setFoodLog] = useState<{
    name: string;
    price: number | null;
    rating: number | null;
    comment: string;
    genre: string;
    companions: string;
    totalPeople: number | null;
    itemsBought: string;
    memo: string;
    logType: string;
  } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [savedLog, setSavedLog] = useState<{
    name: string;
    price: number | null;
    rating: number | null;
    comment: string;
    genre: string;
    companions: string;
    totalPeople: number | null;
    itemsBought: string;
    memo: string;
    id: string;
    logType: string;
  } | null>(null);
  const [scheduleLog, setScheduleLog] = useState<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    memo: string;
  } | null>(null);
  const [confirmScheduleSave, setConfirmScheduleSave] = useState(false);
  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [savedMemos, setSavedMemos] = useState<any[]>([]);
  const [showAllMemos, setShowAllMemos] = useState(false);
  const [pendingMemo, setPendingMemo] = useState<any | null>(null);
  const [confirmMemoSave, setConfirmMemoSave] = useState(false);
  const [editingSavedLog, setEditingSavedLog] = useState(false);
  const [ratingInput, setRatingInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [companionsInput, setCompanionsInput] = useState("");
  const [totalPeopleInput, setTotalPeopleInput] = useState("");
  // どのフィールドを音声入力中か ("name"|"price"|"comment"|null)
  const [fieldRecording, setFieldRecording] = useState<string | null>(null);
  const [today, setToday] = useState("");
  // 位置検索
  const [searchedLocation, setSearchedLocation] = useState<{
    lat: number; lon: number; address: string;
  } | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // ✅ 修正①: recognition を useRef で管理（グローバル変数をやめる）
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef("");
  // ✅ 修正③: 保存問題の対策 — 音声認識が終わったか管理するフラグ
  const isRecognitionEndedRef = useRef(false);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      })
    );
    // localStorageから予定を読み込む
    const stored = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
    setSavedSchedules(stored);
    // localStorageからメモを読み込む
    const storedMemos = JSON.parse(localStorage.getItem("chamaMemos") || "[]");
    setSavedMemos(storedMemos);
  }, []);

  // recognition の初期化
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    // iOSのSafariはcontinuous/interimResultsに非対応なので切り替える
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    const rec = new SpeechRecognition();
    rec.lang = "ja-JP";
    rec.interimResults = !isIOS; // iOSはfalseにしないと誤作動する
    rec.continuous = !isIOS;     // iOSはfalseにしないとabortedエラーになる

    rec.onresult = (event: any) => {
      if (isIOS) {
        // iOSは累積しないよう最後の結果だけ取る、かつ確定済みなら無視
        const last = event.results[event.results.length - 1];
        const transcript = last[0].transcript;
        if (last.isFinal && !latestTranscriptRef.current) {
          // 初回の確定結果のみ採用（2回目以降は無視）
          latestTranscriptRef.current = transcript;
          setVoiceText(transcript);
        } else if (!last.isFinal) {
          setVoiceText(transcript);
        }
      } else {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        const current = finalTranscript || interimTranscript;
        if (finalTranscript) latestTranscriptRef.current = finalTranscript;
        setVoiceText(current);
      }
    };

    rec.onend = () => {
      if (isRecognitionEndedRef.current) {
        isRecognitionEndedRef.current = false;
        setRecording(false);
        const transcript = latestTranscriptRef.current;
        if (transcript) {
          handleVoiceResult(transcript);
        }
      }
    };

    rec.onerror = (event: any) => {
      // abortedはこちらからstop()した時の正常な動作なので無視する
      if (event.error === "aborted") return;
      console.error("音声認識エラー:", event.error);
      setRecording(false);
      isRecognitionEndedRef.current = false;
    };

    recognitionRef.current = rec;
  }, []);

  useEffect(() => {
    fetch(
      "https://api.openweathermap.org/data/2.5/weather?q=Osaka&units=metric&lang=ja&appid=86ca6b2b34afed3e3ee7ea0a15929519"
    )
      .then((res) => res.json())
      .then((data) => setWeather(data));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => console.log("GPS error", error)
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    const query = `
      [out:json];
      node
        (around:50,${location.lat},${location.lon})
        ["amenity"~"restaurant|cafe|fast_food"];
      out;
    `;
    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.elements && data.elements.length > 0) {
          const name = data.elements[0].tags.name;
          if (name) setPlaceName(name);
        }
      });
  }, [location]);

  // ✅ マイクボタンのタップ処理
  function handleMicTap() {
    const rec = recognitionRef.current;
    if (!rec || fieldRecording) return; // フィールド録音中は無効

    if (!recording) {
      // 録音開始
      setConfirmSave(false);
      setFoodLog(null);
      setVoiceText("");
      latestTranscriptRef.current = "";
      isRecognitionEndedRef.current = false;
      setVoiceText("");
      try {
        rec.start();
        setRecording(true);
      } catch (e) {
        console.error("start error:", e);
      }
    } else {
      // 録音停止 → onend が発火してから analyzeFoodLog が呼ばれる
      isRecognitionEndedRef.current = true;
      try {
        rec.stop();
      } catch (e) {
        console.error("stop error:", e);
      }
    }
  }

  // 施設名で位置を検索（Nominatim API）
  async function searchLocation(name: string) {
    if (!name) return;
    setIsSearchingLocation(true);
    setSearchedLocation(null);
    try {
      const query = encodeURIComponent(name + " 日本");
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
        { headers: { "Accept-Language": "ja" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const r = data[0];
        const addr = r.address || {};
        const addressStr = [
          addr.country, addr.state, addr.city || addr.town || addr.village,
          addr.road, r.display_name.split(",")[0]
        ].filter(Boolean).slice(0, 3).join(" ");
        setSearchedLocation({
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          address: addressStr,
        });
      } else {
        alert("位置が見つかりませんでした。店名をもう少し詳しく入力してみてください。");
      }
    } catch (e) {
      alert("位置検索に失敗しました。");
    } finally {
      setIsSearchingLocation(false);
    }
  }

  // フィールド個別の音声入力
  function startFieldRecording(field: string) {
    const rec = recognitionRef.current;
    if (!rec || fieldRecording) return;
    setFieldRecording(field);
    try {
      rec.start();
    } catch (e) {
      console.error("field rec start error:", e);
      setFieldRecording(null);
    }
  }

  function stopFieldRecording() {
    const rec = recognitionRef.current;
    if (!rec || !fieldRecording) return;
    const field = fieldRecording;
    isRecognitionEndedRef.current = false; // analyzeFoodLogは呼ばせない
    try { rec.stop(); } catch (e) { /* ignore */ }

    // onresultで取れた最新テキストを該当フィールドへ
    setTimeout(() => {
      const transcript = latestTranscriptRef.current;
      if (!transcript) { setFieldRecording(null); return; }
      const normalized = transcript
        .replace(/。/g, " ").replace(/　/g, " ").replace(/\s+/g, " ")
        .replace(/吉在門/g, "吉左衛門").replace(/一覧/g, "一蘭")
        .replace(/8日/g, "評価").trim();
      if (field === "name") {
        // 店名は最初のスペース区切りの単語だけ使う
        const shopOnly = normalized.split(" ")[0];
        setNameInput(shopOnly);
      } else if (field === "comment") {
        // 感想は全文そのまま
        setCommentInput(normalized);
      }
      latestTranscriptRef.current = "";
      setFieldRecording(null);
    }, 400);
  }


    // 万能音声入力ハンドラー（analyzeVoiceInputに委譲）
  function handleVoiceResult(text: string) {
    const result = analyzeVoiceInput(text, placeName);

    if (result.type === "restaurant") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: result.genre,
        companions: result.companions, totalPeople: result.totalPeople,
        itemsBought: "", memo: result.memo, logType: "restaurant" });
      setConfirmSave(true);
      return;
    }
    if (result.type === "hotel") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: "other",
        companions: result.companions, totalPeople: result.totalPeople,
        itemsBought: "", memo: result.memo, logType: "hotel" });
      setConfirmSave(true);
      return;
    }
    if (result.type === "spot") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: "other",
        companions: result.companions, totalPeople: result.totalPeople,
        itemsBought: "", memo: result.memo, logType: "spot" });
      setConfirmSave(true);
      return;
    }
    if (result.type === "schedule") {
      const r = result as any;
      setScheduleLog({
        title: r.title, date: r.date,
        startTime: r.startTime, endTime: r.endTime, memo: r.memo,
      });
      setConfirmScheduleSave(true);
      return;
    }
    if (result.type === "memo") {
      setPendingMemo({
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        content: (result as any).content || result.memo,
        reminder: false,
        reminderType: "datetime",
        reminderDatetime: "",
        reminderDistance: 2,
        createdAt: new Date().toISOString(),
      });
      setConfirmMemoSave(true);
      return;
    }
    // 新カテゴリー（GenericLogResult）の処理
    const genericTypes = ["leisure","sports","watching","live","hospital","pharmacy","shopping","ceremony"];
    if (genericTypes.includes(result.type)) {
      const r = result as any;
      setFoodLog({
        name: r.name, price: r.price, rating: r.rating,
        comment: r.comment, genre: r.genre || "other",
        companions: r.companions || "", totalPeople: r.totalPeople ?? null,
        itemsBought: r.itemsBought || "",
        memo: r.memo, logType: result.type as any,
      });
      setConfirmSave(true);
      return;
    }
    if (result.type === "unknown") {
      setFoodLog({
        name: "メモ", price: null, rating: null, comment: "", genre: "other",
        companions: "", totalPeople: null, itemsBought: "",
        memo: result.memo, logType: "memo" as any,
      });
      setConfirmSave(true);
    }
  }


  // LOG_TYPE_CONFIGからラベル・アイコン・フィールド名を取得
  function getLogTypeLabel(logType: string) {
    const cfg = LOG_TYPE_CONFIG[logType];
    if (cfg) return { icon: cfg.icon, label: cfg.label + "ログ" };
    return { icon: "📌", label: "ログ" };
  }

  function getFieldLabels(logType: string) {
    const cfg = LOG_TYPE_CONFIG[logType];
    if (cfg) return { name: cfg.nameLabel, price: cfg.priceLabel || "料金" };
    return { name: "名称", price: "料金" };
  }

  const card = {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "18px",
    marginTop: "15px",
    boxShadow: "0 3px 8px rgba(0,0,0,0.08)"
  };

  return (
    <div
      className="no-select"
      style={{
        maxWidth: "420px",
        margin: "auto",
        fontFamily: "sans-serif",
        background: "#f4f6f8",
        minHeight: "100vh",
        WebkitTouchCallout: "none"
      }}
    >
      <main style={{ padding: "20px", paddingBottom: "130px" }}>
        <h1 style={{ textAlign: "center" }}>チャマLife</h1>

        <div style={{ textAlign: "center" }}>📅 {today}</div>

        {/* 天気 */}
        <div style={card}>
          <div style={{ fontSize: "14px", color: "#666" }}>📍現在地</div>
          {weather ? (
            <>
              <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
                <img
                  src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                  alt="weather"
                  style={{ width: "50px", height: "50px" }}
                />
                <div style={{ fontSize: "28px", fontWeight: "bold", marginLeft: "6px" }}>
                  {Math.round(weather.main.temp)}℃
                </div>
              </div>
              <div style={{ marginTop: "5px", fontSize: "14px" }}>
                体感 {Math.round(weather.main.feels_like)}℃　湿度 {weather.main.humidity}%　風速 {weather.wind.speed} m/s
              </div>
              <div style={{ marginTop: "4px", fontSize: "14px" }}>
                🌸 花粉 {getPollenLevel(weather.main.temp, weather.main.humidity, weather.wind.speed)}
              </div>
              {placeName && (
                <div style={{ marginTop: "6px", fontSize: "14px" }}>🍴 {placeName}</div>
              )}
            </>
          ) : (
            <div>読み込み中...</div>
          )}
        </div>

        {/* 今日の予定 */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📅 本日の予定</span>
            <button
              onClick={() => setShowAllSchedules(!showAllSchedules)}
              style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "6px",
                border: "1px solid #ccc", background: "#f0f0f0", touchAction: "manipulation" }}
            >
              {showAllSchedules ? "閉じる" : "全て表示"}
            </button>
          </div>
          {(() => {
            const todayStr = new Date().toLocaleDateString("ja-JP",
              { month: "numeric", day: "numeric" }).replace(/\//g, "月") + "日";
            const todaySchedules = savedSchedules.filter((s: any) =>
              s.date === todayStr || s.date === "今日"
            );
            if (todaySchedules.length === 0) {
              return <div style={{ marginTop: "6px", fontSize: "14px", color: "#999" }}>今日の予定はありません</div>;
            }
            const displaySchedules = showAllSchedules ? todaySchedules : todaySchedules.slice(0, 3);
            return displaySchedules.map((s: any) => (
              <div key={s.id} style={{ marginTop: "6px", fontSize: "14px" }}>
                {s.startTime && (
                  <span style={{ color: "#ff4d6d", marginRight: "6px" }}>
                    ⏰ {s.startTime}{s.endTime ? `〜${s.endTime}` : ""}
                  </span>
                )}
                {s.title}
              </div>
            ));
          })()}
        </div>

        {/* 本日追加した新規予定 */}
        {savedSchedules.length > 0 && (() => {
          const latest = savedSchedules[savedSchedules.length - 1];
          return (
            <div style={{ ...card, borderLeft: "4px solid #5856d6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>📋 本日追加した新規予定</span>
                <button
                  onClick={() => setEditingScheduleId(editingScheduleId === latest.id ? null : latest.id)}
                  style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px",
                    border: "1px solid #ccc",
                    background: editingScheduleId === latest.id ? "#5856d6" : "#f0f0f0",
                    color: editingScheduleId === latest.id ? "white" : "#333",
                    touchAction: "manipulation" }}
                >
                  {editingScheduleId === latest.id ? "閉じる" : "修正する"}
                </button>
              </div>

              {editingScheduleId !== latest.id ? (
                <div style={{ marginTop: "10px", fontSize: "14px", lineHeight: "1.8" }}>
                  {latest.date && <div>📆 {latest.date}</div>}
                  {latest.startTime && (
                    <div>⏰ {latest.startTime}{latest.endTime ? `〜${latest.endTime}` : "〜"}</div>
                  )}
                  <div>📝 {latest.title}</div>
                </div>
              ) : (
                <div style={{ marginTop: "10px" }}>
                  <div style={{ marginBottom: "6px" }}>
                    日付
                    <input
                      id={`date-${latest.id}`}
                      defaultValue={latest.date}
                      placeholder="例: 3月28日"
                      style={{ width: "100%", marginTop: "2px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    時間
                    <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                      <input id={`start-${latest.id}`} defaultValue={latest.startTime}
                        placeholder="開始 10:00" style={{ flex: 1 }} />
                      <span style={{ lineHeight: "28px" }}>〜</span>
                      <input id={`end-${latest.id}`} defaultValue={latest.endTime}
                        placeholder="終了 11:00" style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    内容
                    <input
                      id={`title-${latest.id}`}
                      defaultValue={latest.title}
                      placeholder="内容"
                      style={{ width: "100%", marginTop: "2px" }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const allS = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
                      const idx = allS.findIndex((x: any) => x.id === latest.id);
                      if (idx !== -1) {
                        allS[idx] = {
                          ...allS[idx],
                          date:      (document.getElementById(`date-${latest.id}`) as HTMLInputElement)?.value || latest.date,
                          startTime: (document.getElementById(`start-${latest.id}`) as HTMLInputElement)?.value || latest.startTime,
                          endTime:   (document.getElementById(`end-${latest.id}`) as HTMLInputElement)?.value || latest.endTime,
                          title:     (document.getElementById(`title-${latest.id}`) as HTMLInputElement)?.value || latest.title,
                        };
                        localStorage.setItem("chamaSchedules", JSON.stringify(allS));
                        setSavedSchedules([...allS]);
                      }
                      setEditingScheduleId(null);
                    }}
                    style={{
                      width: "100%", padding: "8px",
                      background: "#5856d6", color: "white",
                      border: "none", borderRadius: "8px", fontSize: "14px",
                      touchAction: "manipulation"
                    }}
                  >修正を保存する</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* 昨日の支出 */}
        <div style={card}>
          💰 昨日の支出
          <div>0円</div>
        </div>

        {/* メモ帳 */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📓 メモ帳</span>
            <button
              onClick={() => setShowAllMemos(!showAllMemos)}
              style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "6px",
                border: "1px solid #ccc", background: "#f0f0f0", touchAction: "manipulation" }}
            >
              {showAllMemos ? "閉じる" : "全て表示"}
            </button>
          </div>
          {savedMemos.length === 0 ? (
            <div style={{ marginTop: "6px", fontSize: "14px", color: "#999" }}>メモはありません</div>
          ) : (
            (showAllMemos ? savedMemos : savedMemos.slice(-3).reverse()).map((m: any) => (
              <div key={m.id} style={{
                marginTop: "6px", padding: "6px 8px", borderRadius: "6px",
                background: "#f9f9f9", fontSize: "14px"
              }}>
                <div style={{ color: "#999", fontSize: "11px" }}>{m.createdAt?.slice(0,10)}</div>
                <div>{m.content}</div>
                {m.reminder && (
                  <div style={{ fontSize: "11px", color: "#5856d6", marginTop: "2px" }}>
                    🔔 {m.reminderType === "datetime" ? m.reminderDatetime :
                        m.reminderType === "gps" ? `帰宅${m.reminderDistance}km以内` : "リマインダーあり"}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {foodLog && !savedLog && (
          <div style={card}>
            {foodLog && (() => { const {icon, label} = getLogTypeLabel(foodLog.logType); return `${icon} ${label}（確認中）`; })()}
            <div style={{ marginTop: "10px" }}>
              店名
              <input value={foodLog.name || ""} onChange={(e) => setFoodLog({ ...foodLog, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div style={{ marginTop: "10px" }}>
              価格
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  value={foodLog.price ?? ""}
                  onChange={(e) => { const v = e.target.value; setFoodLog({ ...foodLog, price: v === "" ? null : Number(v) }); }}
                  style={{ width: "100%" }}
                  type="text"
                  inputMode="numeric"
                />
                <span>円</span>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              評価
              <input value={foodLog.rating ?? ""} onChange={(e) => { const v = e.target.value; setFoodLog({ ...foodLog, rating: v === "" ? null : Number(v) }); }} style={{ width: "100%" }} type="text" inputMode="decimal" />
            </div>
            <div style={{ marginTop: "10px" }}>
              感想
              <input value={foodLog.comment || ""} onChange={(e) => setFoodLog({ ...foodLog, comment: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {savedLog && (
          <div style={{ ...card, borderLeft: "4px solid #ff4d6d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", fontSize: "15px" }}>
                {savedLog && (() => { const {icon, label} = getLogTypeLabel(savedLog.logType); return `${icon} 最新の${label}`; })()}
              </span>
              <button
                onClick={() => {
                  if (!editingSavedLog) {
                    setRatingInput(savedLog.rating !== null ? String(savedLog.rating) : "");
                    setPriceInput(savedLog.price !== null ? String(savedLog.price) : "");
                    setNameInput(savedLog.name || "");
                    setCommentInput(savedLog.comment || "");
                    setCompanionsInput(savedLog.companions || "");
                    setTotalPeopleInput(savedLog.totalPeople !== null ? String(savedLog.totalPeople) : "");
                  }
                  setEditingSavedLog(!editingSavedLog);
                }}
                style={{
                  fontSize: "12px", padding: "4px 10px",
                  borderRadius: "6px", border: "1px solid #ccc",
                  background: editingSavedLog ? "#ff4d6d" : "#f0f0f0",
                  color: editingSavedLog ? "white" : "#333",
                  touchAction: "manipulation"
                }}
              >
                {editingSavedLog ? "閉じる" : "修正する"}
              </button>
            </div>

            {!editingSavedLog ? (
              <div style={{ marginTop: "10px", fontSize: "14px", lineHeight: "1.8" }}>
                {(() => { const fl = getFieldLabels(savedLog.logType); return (
                  <>
                    <div>🏠 {fl.name}：{savedLog.name}</div>
                    {savedLog.logType === "shopping" && (savedLog as any).itemsBought && (
                      <div>🛒 買った物：{(savedLog as any).itemsBought}</div>
                    )}
                    {savedLog.price !== null && <div>💰 {fl.price}：{savedLog.price.toLocaleString()}円</div>}
                    {savedLog.rating !== null && <div>⭐ 評価：{savedLog.rating}</div>}
                    {savedLog.logType !== "shopping" && savedLog.comment && <div>💬 感想：{savedLog.comment}</div>}
                    {savedLog.logType === "shopping" && savedLog.comment && <div>📝 メモ：{savedLog.comment}</div>}
                    {savedLog.companions && <div>👥 同行者：{savedLog.companions}</div>}
                    {savedLog.totalPeople !== null && <div>👤 合計：{savedLog.totalPeople}人</div>}
                  </>
                ); })()}
              </div>
            ) : (
              <div>
                {/* フィールド音声入力中バナー */}
                {fieldRecording && (
                  <div style={{
                    marginTop: "10px", padding: "8px", borderRadius: "8px",
                    background: "#fff0f3", border: "1px solid #ff4d6d",
                    fontSize: "13px", textAlign: "center", color: "#ff2d55"
                  }}>
                    🎤 {fieldRecording === "name" ? "店名" : fieldRecording === "price" ? "価格" : fieldRecording === "rating" ? "評価" : "感想"}を音声入力中…
                    <button
                      onClick={stopFieldRecording}
                      style={{
                        marginLeft: "10px", padding: "2px 10px",
                        background: "#ff2d55", color: "white",
                        border: "none", borderRadius: "6px", fontSize: "12px",
                        touchAction: "manipulation"
                      }}
                    >停止</button>
                  </div>
                )}
                {(() => {
                  const fl = getFieldLabels(savedLog.logType);
                  return (
                    <>
                      <div style={{ marginTop: "10px" }}>
                        {fl.name}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                          <button onClick={() => startFieldRecording("name")} disabled={!!fieldRecording}
                            style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent", touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        {fl.price}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                            style={{ flex: 1 }} type="text" inputMode="numeric" />
                          <span>円</span>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        評価
                        <input value={ratingInput} onChange={(e) => setRatingInput(e.target.value)}
                          style={{ width: "100%" }} type="text" inputMode="decimal" />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        感想
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                          <button onClick={() => startFieldRecording("comment")} disabled={!!fieldRecording}
                            style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent", touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        👥 同行者
                        <input value={companionsInput} onChange={(e) => setCompanionsInput(e.target.value)}
                          style={{ width: "100%" }} placeholder="例: キーちゃん" autoComplete="off" />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        👤 合計人数
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={totalPeopleInput} onChange={(e) => setTotalPeopleInput(e.target.value)}
                            style={{ flex: 1 }} type="text" inputMode="numeric" />
                          <span>人</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={() => {
                    if (!savedLog) return;
                    const parsedPrice = priceInput === "" ? null : Number(priceInput);
                    const parsedRating = ratingInput === "" ? null : Number(ratingInput);
                    const parsedTotalPeople = totalPeopleInput === "" ? null : Number(totalPeopleInput);
                    const updatedLog = {
                      ...savedLog,
                      name:        nameInput || savedLog.name,
                      comment:     commentInput,
                      companions:  companionsInput,
                      totalPeople: isNaN(parsedTotalPeople as number) ? savedLog.totalPeople : parsedTotalPeople,
                      price:       isNaN(parsedPrice as number) ? savedLog.price : parsedPrice,
                      rating:      isNaN(parsedRating as number) ? savedLog.rating : parsedRating,
                    };
                    const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                    const idx = logs.findIndex((l) => l.id === savedLog.id);
                    if (idx !== -1) {
                      logs[idx] = {
                        ...logs[idx],
                        name:        updatedLog.name,
                        price:       updatedLog.price,
                        rating:      updatedLog.rating,
                        comment:     updatedLog.comment,
                        companions:  updatedLog.companions,
                        totalPeople: updatedLog.totalPeople,
                        memo: [
                          updatedLog.name,
                          updatedLog.price !== null ? updatedLog.price.toLocaleString() + "円" : null,
                          updatedLog.rating !== null ? "評価" + updatedLog.rating : null,
                          updatedLog.comment || null,
                          updatedLog.companions ? "同行者:" + updatedLog.companions : null,
                          updatedLog.totalPeople !== null ? "計" + updatedLog.totalPeople + "人" : null,
                        ].filter(Boolean).join(" / ")
                      };
                      localStorage.setItem("chamaLogs", JSON.stringify(logs));
                      setSavedLog(updatedLog);
                      alert("修正を保存しました！");
                      setEditingSavedLog(false);
                    }
                  }}
                  style={{
                    marginTop: "12px", width: "100%", padding: "8px",
                    background: "#ff4d6d", color: "white",
                    border: "none", borderRadius: "8px", fontSize: "14px",
                    touchAction: "manipulation"
                  }}
                >
                  修正を保存する
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 録音ポップアップ */}
      {recording && (
        <div
          className="no-select"
          onTouchStart={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed", top: "40%", left: "50%",
            transform: "translateX(-50%)",
            background: "white", padding: "20px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            textAlign: "center", width: "260px", zIndex: 1000,
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
            touchAction: "none"
          }}
        >
          <div style={{ fontSize: "20px" }}>🎤 録音中...</div>
          {voiceText && (
            <div style={{ marginTop: "8px", fontSize: "13px", color: "#333" }}>
              {voiceText}
            </div>
          )}
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            もう一度マイクをタップすると録音終了
          </div>
        </div>
      )}

      {/* 保存確認ポップアップ */}
      {confirmSave && foodLog && (
        <div
          className="no-select"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed", bottom: "180px", left: "50%",
            transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            width: "260px", textAlign: "center",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation"
          }}
        >
          <div style={{ fontSize: "16px", marginBottom: "10px" }}>
            {foodLog && (() => { const {icon, label} = getLogTypeLabel(foodLog.logType); return `${icon} この${label}を保存する？`; })()}
          </div>
          <div style={{ fontSize: "14px" }}>{foodLog.memo}</div>

          {/* 位置検索 */}
          {!["memo","schedule"].includes(foodLog.logType) && (
            <div style={{ marginTop: "10px" }}>
              {searchedLocation ? (
                <div style={{ fontSize: "12px", color: "#333", background: "#f0fff4",
                  padding: "6px 8px", borderRadius: "6px", marginBottom: "4px" }}>
                  📍 {searchedLocation.address}
                  <button onClick={() => setSearchedLocation(null)}
                    style={{ marginLeft: "8px", fontSize: "10px", border: "none",
                      background: "transparent", color: "#999", cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => searchLocation(foodLog.name)}
                  disabled={isSearchingLocation}
                  style={{ width: "100%", padding: "6px", fontSize: "12px",
                    borderRadius: "6px", border: "1px solid #ddd",
                    background: "#f8f8f8", cursor: "pointer", touchAction: "manipulation" }}
                >
                  {isSearchingLocation ? "🔍 検索中..." : `🔍 「${foodLog.name}」の位置を検索`}
                </button>
              )}
            </div>
          )}

          <div style={{ marginTop: "12px" }}>
            <button
              onClick={async () => {
                if (!foodLog) return;
                const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                // 検索済み位置 > GPS位置 の優先順位
                const finalLat = searchedLocation?.lat ?? location?.lat;
                const finalLon = searchedLocation?.lon ?? location?.lon;
                const address = searchedLocation
                  ? { country: "", prefecture: "", city: searchedLocation.address }
                  : location
                    ? await getAddressFromLatLon(location.lat, location.lon)
                    : { country: "", prefecture: "", city: "" };
                const newLog: ChamaLog = {
                  id: createLogId(),
                  type: (["restaurant","hotel","sightseeing","leisure","sports","watching",
                    "live","hospital","pharmacy","shopping","ceremony","work"]
                    .includes(foodLog.logType) ? foodLog.logType : "restaurant") as ChamaLog["type"],
                  name:        foodLog.name,
                  price:       foodLog.price,
                  rating:      foodLog.rating,
                  comment:     foodLog.comment,
                  genre:       foodLog.genre,
                  companions:  foodLog.companions,
                  totalPeople: foodLog.totalPeople,
                  itemsBought: foodLog.itemsBought,
                  memo:        foodLog.memo,
                  lat:         finalLat,
                  lon:         finalLon,
                  country:     address.country,
                  prefecture:  address.prefecture,
                  city:        address.city,
                  visitedAt:   new Date().toISOString()
                };
                logs.push(newLog);
                localStorage.setItem("chamaLogs", JSON.stringify(logs));
                setSavedLog({ ...foodLog, id: newLog.id, logType: foodLog.logType, itemsBought: foodLog.itemsBought });
                setEditingSavedLog(false);
                setConfirmSave(false);
                setFoodLog(null);
                setSearchedLocation(null);
              }}
              style={{
                marginRight: "10px", padding: "6px 12px",
                userSelect: "none", WebkitUserSelect: "none",
                WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation"
              }}
            >
              YES
            </button>
            <button
              onClick={() => { setConfirmSave(false); setFoodLog(null); }}
              style={{
                padding: "6px 12px",
                userSelect: "none", WebkitUserSelect: "none",
                WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation"
              }}
            >
              NO
            </button>
          </div>
        </div>
      )}

      {/* メモ保存確認ポップアップ */}
      {confirmMemoSave && pendingMemo && (
        <div
          className="no-select"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed", bottom: "180px", left: "50%",
            transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            width: "290px",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation"
          }}
        >
          <div style={{ fontSize: "16px", marginBottom: "10px", textAlign: "center" }}>
            📓 このメモを保存する？
          </div>

          {/* 入力日 */}
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>
            📅 {new Date().toLocaleDateString("ja-JP")}
          </div>

          {/* 内容 */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>内容</div>
            <textarea
              value={pendingMemo.content}
              onChange={(e) => setPendingMemo({ ...pendingMemo, content: e.target.value })}
              style={{ width: "100%", minHeight: "60px", fontSize: "14px",
                borderRadius: "6px", border: "1px solid #ddd", padding: "6px" }}
            />
          </div>

          {/* リマインダー */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                checked={pendingMemo.reminder}
                onChange={(e) => setPendingMemo({ ...pendingMemo, reminder: e.target.checked })}
              />
              🔔 リマインダーを設定する
            </label>

            {pendingMemo.reminder && (
              <div style={{ marginTop: "8px", paddingLeft: "8px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="radio" name="reminderType" value="datetime"
                      checked={pendingMemo.reminderType === "datetime"}
                      onChange={() => setPendingMemo({ ...pendingMemo, reminderType: "datetime" })}
                    />
                    日時指定
                  </label>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="radio" name="reminderType" value="gps"
                      checked={pendingMemo.reminderType === "gps"}
                      onChange={() => setPendingMemo({ ...pendingMemo, reminderType: "gps" })}
                    />
                    帰宅時GPS
                  </label>
                </div>

                {pendingMemo.reminderType === "datetime" && (
                  <input
                    type="datetime-local"
                    value={pendingMemo.reminderDatetime}
                    onChange={(e) => setPendingMemo({ ...pendingMemo, reminderDatetime: e.target.value })}
                    style={{ width: "100%", fontSize: "13px", padding: "4px",
                      borderRadius: "6px", border: "1px solid #ddd" }}
                  />
                )}

                {pendingMemo.reminderType === "gps" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    自宅から
                    <input
                      type="number"
                      value={pendingMemo.reminderDistance}
                      onChange={(e) => setPendingMemo({ ...pendingMemo, reminderDistance: Number(e.target.value) })}
                      style={{ width: "50px", padding: "2px 4px",
                        borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                    km以内で通知
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                const memos = JSON.parse(localStorage.getItem("chamaMemos") || "[]");
                memos.push(pendingMemo);
                localStorage.setItem("chamaMemos", JSON.stringify(memos));
                setSavedMemos([...memos]);
                setConfirmMemoSave(false);
                setPendingMemo(null);
              }}
              style={{
                flex: 1, padding: "8px", background: "#ff4d6d", color: "white",
                border: "none", borderRadius: "8px", fontSize: "14px",
                touchAction: "manipulation"
              }}
            >保存</button>
            <button
              onClick={() => { setConfirmMemoSave(false); setPendingMemo(null); }}
              style={{
                flex: 1, padding: "8px", background: "#f0f0f0",
                border: "none", borderRadius: "8px", fontSize: "14px",
                touchAction: "manipulation"
              }}
            >キャンセル</button>
          </div>
        </div>
      )}

      {/* 予定保存確認ポップアップ */}
      {confirmScheduleSave && scheduleLog && (
        <div
          className="no-select"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed", bottom: "180px", left: "50%",
            transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            width: "280px", textAlign: "center",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation"
          }}
        >
          <div style={{ fontSize: "16px", marginBottom: "10px" }}>
            📅 この予定を保存する？
          </div>
          <div style={{ fontSize: "14px", color: "#333", marginBottom: "4px" }}>
            {scheduleLog.date && <div>📆 {scheduleLog.date}</div>}
            {scheduleLog.startTime && (
              <div>⏰ {scheduleLog.startTime}{scheduleLog.endTime ? `〜${scheduleLog.endTime}` : "〜"}</div>
            )}
            <div>📝 {scheduleLog.title}</div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={() => {
                if (!scheduleLog) return;
                const schedules = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
                const newSchedule = {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                  ...scheduleLog,
                  createdAt: new Date().toISOString(),
                };
                schedules.push(newSchedule);
                localStorage.setItem("chamaSchedules", JSON.stringify(schedules));
                setSavedSchedules(schedules);
                setConfirmScheduleSave(false);
                setScheduleLog(null);
              }}
              style={{
                marginRight: "10px", padding: "6px 12px",
                touchAction: "manipulation"
              }}
            >YES</button>
            <button
              onClick={() => { setConfirmScheduleSave(false); setScheduleLog(null); }}
              style={{ padding: "6px 12px", touchAction: "manipulation" }}
            >NO</button>
          </div>
        </div>
      )}

      <NavBar />

      {/* ✅ マイクボタン — onClick のみ、長押し対策済み */}
      <div
        onClick={handleMicTap}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        className="no-select"
        style={{
          position: "fixed", bottom: "80px", left: "50%",
          transform: "translateX(-50%)",
          width: "80px", height: "80px", borderRadius: "50%",
          background: recording ? "#ff2d55" : "#ff4d6d",
          color: "white", fontSize: "32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          cursor: "pointer", zIndex: 999,
          userSelect: "none", WebkitUserSelect: "none",
          WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation"
        }}
      >
        🎤
      </div>
    </div>
  );
}
