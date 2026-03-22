// =============================================================================
// app/page.tsx
// ホーム画面
//
// 追加機能:
//   - 週間天気予報（OpenWeatherMap forecast API）
//   - 誕生日・記念日カード（1週間前から表示）
//
// 設計方針:
//   - 将来コンポーネント分割しやすいよう機能ごとにブロックコメントを入れる
//   - データ取得関数は上部に集約（Supabase移行時の差し替えポイント）
// =============================================================================

"use client";
import { useEffect, useState, useRef } from "react";
import type { ChamaLog, FoodGenre } from "./type";
import { analyzeVoiceInput } from "./lib/analyzeVoiceInput";
import { LOG_TYPE_CONFIG } from "./lib/handlers/genericLogHandler";
import NavBar from "./components/NavBar";

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------
const OWM_API_KEY = "86ca6b2b34afed3e3ee7ea0a15929519";
const OWM_CITY    = "Osaka";

// 誕生日・記念日の表示開始日数（何日前から表示するか）
const ANNIVERSARY_NOTICE_DAYS = 7;

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------
type AnniversaryEntry = {
  id:    string;
  label: string;   // 「キーちゃんの誕生日」など
  type:  "birthday_family" | "birthday_friend" | "wedding" | "other";
  month: number;   // 1〜12
  day:   number;   // 1〜31
  year?: number;   // 結婚記念日など年が必要な場合
};

type WeatherForecastDay = {
  date:      string;  // "3/22"
  weekday:   string;  // "土"
  icon:      string;  // OWMアイコンコード
  tempMax:   number;
  tempMin:   number;
  pop:       number;  // 降水確率 0〜1
};

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

function getPollenLevel(temp: number, humidity: number, wind: number): string {
  if (temp < 10) return "少ない";
  if (wind > 5 && humidity < 60) return "非常に多い";
  if (wind > 3 && humidity < 70) return "多い";
  if (temp > 15) return "やや多い";
  return "少ない";
}

async function getAddressFromLatLon(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res  = await fetch(url);
  const data = await res.json();
  const addr = data.address || {};
  return {
    country:    addr.country    || "",
    prefecture: addr.state      || "",
    city:       addr.city || addr.town || addr.village || "",
  };
}

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 今日から何日後にその月日が来るか（0=今日、-1=過ぎた） */
function daysUntil(month: number, day: number): number {
  const now    = new Date();
  const target = new Date(now.getFullYear(), month - 1, day);
  if (target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    target.setFullYear(now.getFullYear() + 1);
  }
  const diff = Math.floor((target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  return diff;
}

/** 記念日の経過年数 */
function yearsElapsed(year: number): number {
  return new Date().getFullYear() - year;
}

/** 誕生日・記念日タイプのアイコン */
function getAnniversaryIcon(type: AnniversaryEntry["type"]): string {
  switch (type) {
    case "birthday_family": return "🎂";
    case "birthday_friend": return "🎉";
    case "wedding":         return "💍";
    default:                return "🌟";
  }
}

// -----------------------------------------------------------------------------
// 週間天気予報の整形
// OpenWeatherMap 5day/3hour forecast → 日別に集約
// -----------------------------------------------------------------------------
function parseForecast(data: any): WeatherForecastDay[] {
  const WEEKDAYS = ["日","月","火","水","木","金","土"];
  const dayMap: Record<string, {
    temps: number[]; icons: string[]; pops: number[];
  }> = {};

  (data.list ?? []).forEach((item: any) => {
    const d   = new Date(item.dt * 1000);
    const key = `${d.getMonth()+1}/${d.getDate()}`;
    if (!dayMap[key]) dayMap[key] = { temps: [], icons: [], pops: [] };
    dayMap[key].temps.push(item.main.temp_max ?? item.main.temp);
    dayMap[key].temps.push(item.main.temp_min ?? item.main.temp);
    dayMap[key].icons.push(item.weather[0].icon);
    dayMap[key].pops.push(item.pop ?? 0);
  });

  return Object.entries(dayMap).slice(0, 7).map(([dateStr, v]) => {
    const [m, d] = dateStr.split("/").map(Number);
    const dt     = new Date(new Date().getFullYear(), m - 1, d);
    return {
      date:    dateStr,
      weekday: WEEKDAYS[dt.getDay()],
      icon:    v.icons[Math.floor(v.icons.length / 2)] ?? v.icons[0],
      tempMax: Math.round(Math.max(...v.temps)),
      tempMin: Math.round(Math.min(...v.temps)),
      pop:     Math.round(Math.max(...v.pops) * 100),
    };
  });
}

// =============================================================================
// メインコンポーネント
// =============================================================================
export default function Home() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [weather,       setWeather]       = useState<any>(null);
  const [forecast,      setForecast]      = useState<WeatherForecastDay[]>([]);
  const [recording,     setRecording]     = useState(false);
  const [voiceText,     setVoiceText]     = useState("");
  const [location,      setLocation]      = useState<{ lat: number; lon: number } | null>(null);
  const [placeName,     setPlaceName]     = useState("");
  const [today,         setToday]         = useState("");

  // 誕生日・記念日
  const [anniversaries, setAnniversaries] = useState<AnniversaryEntry[]>([]);

  // ログ関連
  const [foodLog,       setFoodLog]       = useState<{
    name: string; price: number | null; rating: number | null;
    comment: string; genre: string; companions: string;
    totalPeople: number | null; itemsBought: string; memo: string; logType: string;
  } | null>(null);
  const [confirmSave,   setConfirmSave]   = useState(false);
  const [savedLog,      setSavedLog]      = useState<{
    name: string; price: number | null; rating: number | null;
    comment: string; genre: string; companions: string;
    totalPeople: number | null; itemsBought: string; memo: string; id: string; logType: string;
  } | null>(null);

  // 予定関連
  const [scheduleLog,         setScheduleLog]         = useState<{ title: string; date: string; startTime: string; endTime: string; memo: string; } | null>(null);
  const [confirmScheduleSave, setConfirmScheduleSave] = useState(false);
  const [savedSchedules,      setSavedSchedules]      = useState<any[]>([]);
  const [showAllSchedules,    setShowAllSchedules]    = useState(false);
  const [editingScheduleId,   setEditingScheduleId]   = useState<string | null>(null);

  // メモ関連
  const [savedMemos,      setSavedMemos]      = useState<any[]>([]);
  const [showAllMemos,    setShowAllMemos]    = useState(false);
  const [pendingMemo,     setPendingMemo]     = useState<any | null>(null);
  const [confirmMemoSave, setConfirmMemoSave] = useState(false);

  // 編集関連
  const [editingSavedLog,   setEditingSavedLog]   = useState(false);
  const [ratingInput,       setRatingInput]       = useState("");
  const [priceInput,        setPriceInput]        = useState("");
  const [nameInput,         setNameInput]         = useState("");
  const [commentInput,      setCommentInput]      = useState("");
  const [companionsInput,   setCompanionsInput]   = useState("");
  const [totalPeopleInput,  setTotalPeopleInput]  = useState("");
  const [fieldRecording,    setFieldRecording]    = useState<string | null>(null);

  // 位置検索
  const [searchedLocation,    setSearchedLocation]    = useState<{ lat: number; lon: number; address: string; } | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationCandidates,  setLocationCandidates]  = useState<{ lat: number; lon: number; address: string; }[]>([]);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");

  // Refs
  const recognitionRef        = useRef<any>(null);
  const latestTranscriptRef   = useRef("");
  const isRecognitionEndedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setToday(new Date().toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    }));
    setSavedSchedules(JSON.parse(localStorage.getItem("chamaSchedules") || "[]"));
    setSavedMemos(JSON.parse(localStorage.getItem("chamaMemos") || "[]"));

    // 誕生日・記念日読み込み（将来: Supabase差し替えポイント）
    const stored = JSON.parse(localStorage.getItem("chamaAnniversaries") || "[]");
    setAnniversaries(stored);
  }, []);

  // ---------------------------------------------------------------------------
  // 現在地天気
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${OWM_CITY}&units=metric&lang=ja&appid=${OWM_API_KEY}`)
      .then(r => r.json()).then(setWeather);
  }, []);

  // ---------------------------------------------------------------------------
  // 週間天気予報
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${OWM_CITY}&units=metric&lang=ja&appid=${OWM_API_KEY}`)
      .then(r => r.json())
      .then(data => setForecast(parseForecast(data)));
  }, []);

  // ---------------------------------------------------------------------------
  // GPS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => console.log("GPS error", err)
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    const query = `[out:json];node(around:50,${location.lat},${location.lon})["amenity"~"restaurant|cafe|fast_food"];out;`;
    fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query })
      .then(r => r.json())
      .then(data => {
        const name = data.elements?.[0]?.tags?.name;
        if (name) setPlaceName(name);
      });
  }, [location]);

  // ---------------------------------------------------------------------------
  // 音声認識
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const rec   = new SpeechRecognition();
    rec.lang           = "ja-JP";
    rec.interimResults = !isIOS;
    rec.continuous     = !isIOS;

    rec.onresult = (event: any) => {
      if (isIOS) {
        const last = event.results[event.results.length - 1];
        const transcript = last[0].transcript;
        if (last.isFinal && !latestTranscriptRef.current) {
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
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
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
        if (transcript) handleVoiceResult(transcript);
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "aborted") return;
      console.error("音声認識エラー:", event.error);
      setRecording(false);
      isRecognitionEndedRef.current = false;
    };

    recognitionRef.current = rec;
  }, []);

  // ---------------------------------------------------------------------------
  // 誕生日・記念日：1週間以内に迫っているものを取得
  // ---------------------------------------------------------------------------
  const upcomingAnniversaries = anniversaries.filter(a => {
    const days = daysUntil(a.month, a.day);
    return days >= 0 && days <= ANNIVERSARY_NOTICE_DAYS;
  }).sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day));

  // ---------------------------------------------------------------------------
  // マイクボタン
  // ---------------------------------------------------------------------------
  function handleMicTap() {
    const rec = recognitionRef.current;
    if (!rec || fieldRecording) return;
    if (!recording) {
      setConfirmSave(false); setFoodLog(null);
      setVoiceText(""); latestTranscriptRef.current = "";
      isRecognitionEndedRef.current = false;
      try { rec.start(); setRecording(true); } catch (e) { console.error("start error:", e); }
    } else {
      isRecognitionEndedRef.current = true;
      try { rec.stop(); } catch (e) { console.error("stop error:", e); }
    }
  }

  // ---------------------------------------------------------------------------
  // 位置検索
  // ---------------------------------------------------------------------------
  async function searchLocation(name: string) {
    if (!name) return;
    setIsSearchingLocation(true);
    setSearchedLocation(null);
    setLocationCandidates([]);
    try {
      const queryText = locationSearchQuery.trim() || name;
      const q         = encodeURIComponent(queryText);
      const geoParams = location ? `&lat=${location.lat}&lon=${location.lon}` : "";
      const res  = await fetch(`/api/location-search?q=${q}${geoParams}`);
      const data = await res.json();
      if (data.candidates?.length > 0) {
        if (data.candidates.length === 1) setSearchedLocation(data.candidates[0]);
        else setLocationCandidates(data.candidates);
      } else {
        alert("位置が見つかりませんでした。店名をもう少し詳しく入力してみてください。");
      }
    } catch { alert("位置検索に失敗しました。"); }
    finally { setIsSearchingLocation(false); }
  }

  // ---------------------------------------------------------------------------
  // フィールド音声入力
  // ---------------------------------------------------------------------------
  function startFieldRecording(field: string) {
    const rec = recognitionRef.current;
    if (!rec || fieldRecording) return;
    setFieldRecording(field);
    try { rec.start(); } catch (e) { console.error("field rec start error:", e); setFieldRecording(null); }
  }

  function stopFieldRecording() {
    const rec = recognitionRef.current;
    if (!rec || !fieldRecording) return;
    const field = fieldRecording;
    isRecognitionEndedRef.current = false;
    try { rec.stop(); } catch { /* ignore */ }
    setTimeout(() => {
      const transcript = latestTranscriptRef.current;
      if (!transcript) { setFieldRecording(null); return; }
      const normalized = transcript
        .replace(/。/g, " ").replace(/　/g, " ").replace(/\s+/g, " ")
        .replace(/吉在門/g, "吉左衛門").replace(/一覧/g, "一蘭")
        .replace(/8日/g, "評価").trim();
      if (field === "name")    setNameInput(normalized.split(" ")[0]);
      if (field === "comment") setCommentInput(normalized);
      latestTranscriptRef.current = "";
      setFieldRecording(null);
    }, 400);
  }

  // ---------------------------------------------------------------------------
  // 音声入力ハンドラー
  // ---------------------------------------------------------------------------
  function handleVoiceResult(text: string) {
    const result = analyzeVoiceInput(text, placeName);

    if (result.type === "restaurant") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: result.genre, companions: result.companions,
        totalPeople: result.totalPeople, itemsBought: "", memo: result.memo, logType: "restaurant" });
      setConfirmSave(true); return;
    }
    if (result.type === "hotel") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: "other", companions: result.companions,
        totalPeople: result.totalPeople, itemsBought: "", memo: result.memo, logType: "hotel" });
      setConfirmSave(true); return;
    }
    if (result.type === "spot") {
      setFoodLog({ name: result.name, price: result.price, rating: result.rating,
        comment: result.comment, genre: "other", companions: result.companions,
        totalPeople: result.totalPeople, itemsBought: "", memo: result.memo, logType: "spot" });
      setConfirmSave(true); return;
    }
    if (result.type === "schedule") {
      const r = result as any;
      setScheduleLog({ title: r.title, date: r.date, startTime: r.startTime, endTime: r.endTime, memo: r.memo });
      setConfirmScheduleSave(true); return;
    }
    if (result.type === "memo") {
      setPendingMemo({
        id: createLogId(), content: (result as any).content || result.memo,
        reminder: false, reminderType: "datetime", reminderDatetime: "",
        reminderDistance: 2, createdAt: new Date().toISOString(),
      });
      setConfirmMemoSave(true); return;
    }
    const genericTypes = ["leisure","sports","watching","live","hospital","pharmacy","shopping","ceremony"];
    if (genericTypes.includes(result.type)) {
      const r = result as any;
      setFoodLog({ name: r.name, price: r.price, rating: r.rating, comment: r.comment,
        genre: r.genre || "other", companions: r.companions || "",
        totalPeople: r.totalPeople ?? null, itemsBought: r.itemsBought || "",
        memo: r.memo, logType: result.type as any });
      setConfirmSave(true); return;
    }
    if (result.type === "unknown") {
      setFoodLog({ name: "メモ", price: null, rating: null, comment: "", genre: "other",
        companions: "", totalPeople: null, itemsBought: "", memo: result.memo, logType: "memo" as any });
      setConfirmSave(true);
    }
  }

  // ---------------------------------------------------------------------------
  // ヘルパー
  // ---------------------------------------------------------------------------
  function getLogTypeLabel(logType: string) {
    const cfg = LOG_TYPE_CONFIG[logType];
    return cfg ? { icon: cfg.icon, label: cfg.label + "ログ" } : { icon: "📌", label: "ログ" };
  }
  function getFieldLabels(logType: string) {
    const cfg = LOG_TYPE_CONFIG[logType];
    return cfg ? { name: cfg.nameLabel, price: cfg.priceLabel || "料金" } : { name: "名称", price: "料金" };
  }

  const card: React.CSSProperties = {
    background: "#ffffff", borderRadius: "14px", padding: "18px",
    marginTop: "15px", boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
  };

  // ==========================================================================
  // レンダリング
  // ==========================================================================
  return (
    <div className="no-select" style={{
      maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", WebkitTouchCallout: "none",
    }}>
      <main style={{ padding: "20px", paddingBottom: "130px" }}>
        <h1 style={{ textAlign: "center" }}>チャマLife</h1>
        <div style={{ textAlign: "center" }}>📅 {today}</div>

        {/* ── 天気カード ── */}
        <div style={card}>
          <div style={{ fontSize: "14px", color: "#666" }}>📍現在地</div>
          {weather ? (
            <>
              {/* 現在の天気 */}
              <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
                <img src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                  alt="weather" style={{ width: "50px", height: "50px" }} />
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
              {placeName && <div style={{ marginTop: "6px", fontSize: "14px" }}>🍴 {placeName}</div>}

              {/* 週間天気予報 */}
              {forecast.length > 0 && (
                <div style={{ marginTop: "14px", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>📅 週間天気予報</div>
                  <div style={{ display: "flex", overflowX: "auto", gap: "6px", paddingBottom: "4px" }}>
                    {forecast.map((day, i) => (
                      <div key={i} style={{
                        minWidth: "46px", textAlign: "center", padding: "6px 4px",
                        borderRadius: "10px",
                        background: i === 0 ? "#fff0f3" : "#f9f9f9",
                        border: i === 0 ? "1px solid #ffcdd2" : "1px solid #f0f0f0",
                      }}>
                        <div style={{
                          fontSize: "11px", fontWeight: "bold",
                          color: day.weekday === "日" ? "#ff4d6d" : day.weekday === "土" ? "#5856d6" : "#555",
                        }}>
                          {i === 0 ? "今日" : day.weekday}
                        </div>
                        <div style={{ fontSize: "10px", color: "#999" }}>{day.date}</div>
                        <img
                          src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                          alt="icon" style={{ width: "32px", height: "32px" }}
                        />
                        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#ff4d6d" }}>
                          {day.tempMax}°
                        </div>
                        <div style={{ fontSize: "11px", color: "#5856d6" }}>
                          {day.tempMin}°
                        </div>
                        {day.pop > 0 && (
                          <div style={{ fontSize: "10px", color: "#5856d6", marginTop: "2px" }}>
                            💧{day.pop}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: "10px", color: "#aaa", fontSize: "14px" }}>読み込み中...</div>
          )}
        </div>

        {/* ── 誕生日・記念日カード ── */}
        {upcomingAnniversaries.length > 0 && (
          <div style={{ ...card, borderLeft: "4px solid #ff9500" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#ff9500", marginBottom: "8px" }}>
              🎊 もうすぐ記念日
            </div>
            {upcomingAnniversaries.map(a => {
              const days = daysUntil(a.month, a.day);
              return (
                <div key={a.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid #fff5e6",
                }}>
                  <div>
                    <span style={{ marginRight: "6px" }}>{getAnniversaryIcon(a.type)}</span>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>{a.label}</span>
                    {a.year && a.type === "wedding" && (
                      <span style={{ fontSize: "12px", color: "#999", marginLeft: "6px" }}>
                        ({yearsElapsed(a.year)}周年)
                      </span>
                    )}
                    {a.year && a.type !== "wedding" && (
                      <span style={{ fontSize: "12px", color: "#999", marginLeft: "6px" }}>
                        ({new Date().getFullYear() - a.year}歳)
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: "13px", fontWeight: "bold",
                    color: days === 0 ? "#ff4d6d" : "#ff9500",
                    background: days === 0 ? "#fff0f3" : "#fff8ee",
                    padding: "3px 8px", borderRadius: "8px",
                  }}>
                    {days === 0 ? "🎉 今日！" : `あと${days}日`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 本日の予定 ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📅 本日の予定</span>
            <button onClick={() => setShowAllSchedules(!showAllSchedules)}
              style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "6px",
                border: "1px solid #ccc", background: "#f0f0f0", touchAction: "manipulation" }}>
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
            return (showAllSchedules ? todaySchedules : todaySchedules.slice(0, 3)).map((s: any) => (
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

        {/* ── 本日追加した新規予定 ── */}
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
                >{editingScheduleId === latest.id ? "閉じる" : "修正する"}</button>
              </div>
              {editingScheduleId !== latest.id ? (
                <div style={{ marginTop: "10px", fontSize: "14px", lineHeight: "1.8" }}>
                  {latest.date      && <div>📆 {latest.date}</div>}
                  {latest.startTime && <div>⏰ {latest.startTime}{latest.endTime ? `〜${latest.endTime}` : "〜"}</div>}
                  <div>📝 {latest.title}</div>
                </div>
              ) : (
                <div style={{ marginTop: "10px" }}>
                  <div style={{ marginBottom: "6px" }}>
                    日付
                    <input id={`date-${latest.id}`} defaultValue={latest.date}
                      placeholder="例: 3月28日" style={{ width: "100%", marginTop: "2px" }} />
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
                    <input id={`title-${latest.id}`} defaultValue={latest.title}
                      placeholder="内容" style={{ width: "100%", marginTop: "2px" }} />
                  </div>
                  <button
                    onClick={() => {
                      const allS = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
                      const idx  = allS.findIndex((x: any) => x.id === latest.id);
                      if (idx !== -1) {
                        allS[idx] = {
                          ...allS[idx],
                          date:      (document.getElementById(`date-${latest.id}`)  as HTMLInputElement)?.value || latest.date,
                          startTime: (document.getElementById(`start-${latest.id}`) as HTMLInputElement)?.value || latest.startTime,
                          endTime:   (document.getElementById(`end-${latest.id}`)   as HTMLInputElement)?.value || latest.endTime,
                          title:     (document.getElementById(`title-${latest.id}`) as HTMLInputElement)?.value || latest.title,
                        };
                        localStorage.setItem("chamaSchedules", JSON.stringify(allS));
                        setSavedSchedules([...allS]);
                      }
                      setEditingScheduleId(null);
                    }}
                    style={{ width: "100%", padding: "8px", background: "#5856d6", color: "white",
                      border: "none", borderRadius: "8px", fontSize: "14px", touchAction: "manipulation" }}
                  >修正を保存する</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 昨日の支出 ── */}
        <div style={card}>
          💰 昨日の支出
          <div>0円</div>
        </div>

        {/* ── メモ帳 ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📓 メモ帳</span>
            <button onClick={() => setShowAllMemos(!showAllMemos)}
              style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "6px",
                border: "1px solid #ccc", background: "#f0f0f0", touchAction: "manipulation" }}>
              {showAllMemos ? "閉じる" : "全て表示"}
            </button>
          </div>
          {savedMemos.length === 0 ? (
            <div style={{ marginTop: "6px", fontSize: "14px", color: "#999" }}>メモはありません</div>
          ) : (
            (showAllMemos ? savedMemos : savedMemos.slice(-3).reverse()).map((m: any) => (
              <div key={m.id} style={{ marginTop: "6px", padding: "6px 8px", borderRadius: "6px",
                background: "#f9f9f9", fontSize: "14px" }}>
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

        {/* ── 確認中ログ ── */}
        {foodLog && !savedLog && (
          <div style={card}>
            {(() => { const {icon, label} = getLogTypeLabel(foodLog.logType); return `${icon} ${label}（確認中）`; })()}
            <div style={{ marginTop: "10px" }}>
              店名
              <input value={foodLog.name || ""} onChange={e => setFoodLog({ ...foodLog, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div style={{ marginTop: "10px" }}>
              価格
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input value={foodLog.price ?? ""}
                  onChange={e => { const v = e.target.value; setFoodLog({ ...foodLog, price: v === "" ? null : Number(v) }); }}
                  style={{ width: "100%" }} type="text" inputMode="numeric" />
                <span>円</span>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              評価
              <input value={foodLog.rating ?? ""}
                onChange={e => { const v = e.target.value; setFoodLog({ ...foodLog, rating: v === "" ? null : Number(v) }); }}
                style={{ width: "100%" }} type="text" inputMode="decimal" />
            </div>
            <div style={{ marginTop: "10px" }}>
              感想
              <input value={foodLog.comment || ""} onChange={e => setFoodLog({ ...foodLog, comment: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {/* ── 保存済みログ ── */}
        {savedLog && (
          <div style={{ ...card, borderLeft: "4px solid #ff4d6d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", fontSize: "15px" }}>
                {(() => { const {icon, label} = getLogTypeLabel(savedLog.logType); return `${icon} 最新の${label}`; })()}
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
                style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: editingSavedLog ? "#ff4d6d" : "#f0f0f0",
                  color: editingSavedLog ? "white" : "#333", touchAction: "manipulation" }}
              >{editingSavedLog ? "閉じる" : "修正する"}</button>
            </div>
            {!editingSavedLog ? (
              <div style={{ marginTop: "10px", fontSize: "14px", lineHeight: "1.8" }}>
                {(() => { const fl = getFieldLabels(savedLog.logType); return (
                  <>
                    <div>🏠 {fl.name}：{savedLog.name}</div>
                    {savedLog.logType === "shopping" && (savedLog as any).itemsBought && (
                      <div>🛒 買った物：{(savedLog as any).itemsBought}</div>
                    )}
                    {savedLog.price  !== null && <div>💰 {fl.price}：{savedLog.price.toLocaleString()}円</div>}
                    {savedLog.rating !== null && <div>⭐ 評価：{savedLog.rating}</div>}
                    {savedLog.logType !== "shopping" && savedLog.comment && <div>💬 感想：{savedLog.comment}</div>}
                    {savedLog.logType === "shopping" && savedLog.comment && <div>📝 メモ：{savedLog.comment}</div>}
                    {savedLog.companions  && <div>👥 同行者：{savedLog.companions}</div>}
                    {savedLog.totalPeople !== null && <div>👤 合計：{savedLog.totalPeople}人</div>}
                  </>
                ); })()}
              </div>
            ) : (
              <div>
                {fieldRecording && (
                  <div style={{ marginTop: "10px", padding: "8px", borderRadius: "8px",
                    background: "#fff0f3", border: "1px solid #ff4d6d",
                    fontSize: "13px", textAlign: "center", color: "#ff2d55" }}>
                    🎤 {fieldRecording === "name" ? "店名" : fieldRecording === "comment" ? "感想" : "入力"}中…
                    <button onClick={stopFieldRecording}
                      style={{ marginLeft: "10px", padding: "2px 10px", background: "#ff2d55",
                        color: "white", border: "none", borderRadius: "6px", fontSize: "12px",
                        touchAction: "manipulation" }}>停止</button>
                  </div>
                )}
                {(() => {
                  const fl = getFieldLabels(savedLog.logType);
                  return (
                    <>
                      <div style={{ marginTop: "10px" }}>
                        {fl.name}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={nameInput} onChange={e => setNameInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                          <button onClick={() => startFieldRecording("name")} disabled={!!fieldRecording}
                            style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent",
                              touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        {fl.price}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={priceInput} onChange={e => setPriceInput(e.target.value)}
                            style={{ flex: 1 }} type="text" inputMode="numeric" />
                          <span>円</span>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        評価
                        <input value={ratingInput} onChange={e => setRatingInput(e.target.value)}
                          style={{ width: "100%" }} type="text" inputMode="decimal" />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        感想
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={commentInput} onChange={e => setCommentInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                          <button onClick={() => startFieldRecording("comment")} disabled={!!fieldRecording}
                            style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent",
                              touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        👥 同行者
                        <input value={companionsInput} onChange={e => setCompanionsInput(e.target.value)}
                          style={{ width: "100%" }} placeholder="例: キーちゃん" autoComplete="off" />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        👤 合計人数
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input value={totalPeopleInput} onChange={e => setTotalPeopleInput(e.target.value)}
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
                    const parsedPrice      = priceInput      === "" ? null : Number(priceInput);
                    const parsedRating     = ratingInput     === "" ? null : Number(ratingInput);
                    const parsedTotalPeople = totalPeopleInput === "" ? null : Number(totalPeopleInput);
                    const updatedLog = {
                      ...savedLog,
                      name:        nameInput || savedLog.name,
                      comment:     commentInput,
                      companions:  companionsInput,
                      totalPeople: isNaN(parsedTotalPeople as number) ? savedLog.totalPeople : parsedTotalPeople,
                      price:       isNaN(parsedPrice  as number) ? savedLog.price  : parsedPrice,
                      rating:      isNaN(parsedRating as number) ? savedLog.rating : parsedRating,
                    };
                    const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                    const idx = logs.findIndex(l => l.id === savedLog.id);
                    if (idx !== -1) {
                      logs[idx] = {
                        ...logs[idx], name: updatedLog.name, price: updatedLog.price,
                        rating: updatedLog.rating, comment: updatedLog.comment,
                        companions: updatedLog.companions, totalPeople: updatedLog.totalPeople,
                        memo: [
                          updatedLog.name,
                          updatedLog.price  !== null ? updatedLog.price.toLocaleString()  + "円" : null,
                          updatedLog.rating !== null ? "評価" + updatedLog.rating : null,
                          updatedLog.comment || null,
                          updatedLog.companions ? "同行者:" + updatedLog.companions : null,
                          updatedLog.totalPeople !== null ? "計" + updatedLog.totalPeople + "人" : null,
                        ].filter(Boolean).join(" / "),
                      };
                      localStorage.setItem("chamaLogs", JSON.stringify(logs));
                      setSavedLog(updatedLog);
                      alert("修正を保存しました！");
                      setEditingSavedLog(false);
                    }
                  }}
                  style={{ marginTop: "12px", width: "100%", padding: "8px",
                    background: "#ff4d6d", color: "white", border: "none",
                    borderRadius: "8px", fontSize: "14px", touchAction: "manipulation" }}
                >修正を保存する</button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── 録音ポップアップ ── */}
      {recording && (
        <div className="no-select" onTouchStart={e => e.preventDefault()}
          onTouchEnd={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
          style={{ position: "fixed", top: "40%", left: "50%", transform: "translateX(-50%)",
            background: "white", padding: "20px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", textAlign: "center", width: "260px",
            zIndex: 1000, userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "none" }}>
          <div style={{ fontSize: "20px" }}>🎤 録音中...</div>
          {voiceText && <div style={{ marginTop: "8px", fontSize: "13px", color: "#333" }}>{voiceText}</div>}
          <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            もう一度マイクをタップすると録音終了
          </div>
        </div>
      )}

      {/* ── 保存確認ポップアップ ── */}
      {confirmSave && foodLog && (
        <div className="no-select" onContextMenu={e => e.preventDefault()}
          style={{ position: "fixed", bottom: "180px", left: "50%", transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", width: "260px", textAlign: "center",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          <div style={{ fontSize: "16px", marginBottom: "10px" }}>
            {(() => { const {icon, label} = getLogTypeLabel(foodLog.logType); return `${icon} この${label}を保存する？`; })()}
          </div>
          <div style={{ fontSize: "14px" }}>{foodLog.memo}</div>
          {!["memo","schedule"].includes(foodLog.logType) && (
            <div style={{ marginTop: "10px" }}>
              {searchedLocation ? (
                <div style={{ fontSize: "12px", color: "#2d7a2d", background: "#f0fff4",
                  padding: "6px 8px", borderRadius: "6px", marginBottom: "4px",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📍 {searchedLocation.address}</span>
                  <button onClick={() => { setSearchedLocation(null); setLocationCandidates([]); }}
                    style={{ fontSize: "10px", border: "none", background: "transparent",
                      color: "#999", cursor: "pointer", padding: "0 4px" }}>✕</button>
                </div>
              ) : locationCandidates.length > 0 ? (
                <div style={{ background: "#f8f8f8", borderRadius: "6px", border: "1px solid #ddd", overflow: "hidden" }}>
                  <div style={{ fontSize: "11px", color: "#666", padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                    候補を選んでください
                  </div>
                  {locationCandidates.map((c, i) => (
                    <button key={i} onClick={() => { setSearchedLocation(c); setLocationCandidates([]); }}
                      style={{ width: "100%", padding: "6px 8px", fontSize: "12px", textAlign: "left",
                        border: "none", borderBottom: i < locationCandidates.length-1 ? "1px solid #eee" : "none",
                        background: "transparent", cursor: "pointer", color: "#333", touchAction: "manipulation" }}>
                      📍 {c.address}
                    </button>
                  ))}
                  <button onClick={() => setLocationCandidates([])}
                    style={{ width: "100%", padding: "4px", fontSize: "11px", border: "none",
                      background: "#f0f0f0", color: "#999", cursor: "pointer", touchAction: "manipulation" }}>
                    キャンセル
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    <input
                      value={locationSearchQuery !== "" ? locationSearchQuery : foodLog.name}
                      onChange={e => setLocationSearchQuery(e.target.value)}
                      placeholder="店名・住所で検索"
                      style={{ flex: 1, padding: "5px 8px", fontSize: "12px",
                        borderRadius: "6px", border: "1px solid #ddd" }}
                    />
                    <button onClick={() => searchLocation(foodLog.name)} disabled={isSearchingLocation}
                      style={{ padding: "5px 10px", fontSize: "12px", borderRadius: "6px",
                        border: "none", background: "#ff4d6d", color: "white",
                        cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap" }}>
                      {isSearchingLocation ? "..." : "🔍"}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    例: 「大阪市阿倍野区 一蘭」のように詳しく入力すると精度UP
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={async () => {
                if (!foodLog) return;
                const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                const finalLat = searchedLocation?.lat ?? location?.lat;
                const finalLon = searchedLocation?.lon ?? location?.lon;
                const address  = searchedLocation
                  ? { country: "", prefecture: "", city: searchedLocation.address }
                  : location ? await getAddressFromLatLon(location.lat, location.lon)
                  : { country: "", prefecture: "", city: "" };
                const newLog: ChamaLog = {
                  id: createLogId(),
                  type: (["restaurant","hotel","sightseeing","leisure","sports","watching",
                    "live","hospital","pharmacy","shopping","ceremony","work"]
                    .includes(foodLog.logType) ? foodLog.logType : "restaurant") as ChamaLog["type"],
                  name: foodLog.name, price: foodLog.price, rating: foodLog.rating,
                  comment: foodLog.comment, genre: foodLog.genre, companions: foodLog.companions,
                  totalPeople: foodLog.totalPeople, itemsBought: foodLog.itemsBought,
                  memo: foodLog.memo, lat: finalLat, lon: finalLon,
                  country: address.country, prefecture: address.prefecture, city: address.city,
                  visitedAt: new Date().toISOString(),
                };
                logs.push(newLog);
                localStorage.setItem("chamaLogs", JSON.stringify(logs));
                setSavedLog({ ...foodLog, id: newLog.id, logType: foodLog.logType, itemsBought: foodLog.itemsBought });
                setEditingSavedLog(false); setConfirmSave(false); setFoodLog(null);
                setSearchedLocation(null); setLocationCandidates([]); setLocationSearchQuery("");
              }}
              style={{ marginRight: "10px", padding: "6px 12px", userSelect: "none",
                WebkitUserSelect: "none", WebkitTouchCallout: "none",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >YES</button>
            <button
              onClick={() => { setConfirmSave(false); setFoodLog(null); setSearchedLocation(null); setLocationCandidates([]); setLocationSearchQuery(""); }}
              style={{ padding: "6px 12px", userSelect: "none", WebkitUserSelect: "none",
                WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >NO</button>
          </div>
        </div>
      )}

      {/* ── メモ保存確認ポップアップ ── */}
      {confirmMemoSave && pendingMemo && (
        <div className="no-select" onContextMenu={e => e.preventDefault()}
          style={{ position: "fixed", bottom: "180px", left: "50%", transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", width: "290px",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          <div style={{ fontSize: "16px", marginBottom: "10px", textAlign: "center" }}>📓 このメモを保存する？</div>
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>
            📅 {new Date().toLocaleDateString("ja-JP")}
          </div>
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>内容</div>
            <textarea value={pendingMemo.content}
              onChange={e => setPendingMemo({ ...pendingMemo, content: e.target.value })}
              style={{ width: "100%", minHeight: "60px", fontSize: "14px",
                borderRadius: "6px", border: "1px solid #ddd", padding: "6px" }} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={pendingMemo.reminder}
                onChange={e => setPendingMemo({ ...pendingMemo, reminder: e.target.checked })} />
              🔔 リマインダーを設定する
            </label>
            {pendingMemo.reminder && (
              <div style={{ marginTop: "8px", paddingLeft: "8px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  {["datetime","gps"].map(type => (
                    <label key={type} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input type="radio" name="reminderType" value={type}
                        checked={pendingMemo.reminderType === type}
                        onChange={() => setPendingMemo({ ...pendingMemo, reminderType: type })} />
                      {type === "datetime" ? "日時指定" : "帰宅時GPS"}
                    </label>
                  ))}
                </div>
                {pendingMemo.reminderType === "datetime" && (
                  <input type="datetime-local" value={pendingMemo.reminderDatetime}
                    onChange={e => setPendingMemo({ ...pendingMemo, reminderDatetime: e.target.value })}
                    style={{ width: "100%", fontSize: "13px", padding: "4px",
                      borderRadius: "6px", border: "1px solid #ddd" }} />
                )}
                {pendingMemo.reminderType === "gps" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    自宅から
                    <input type="number" value={pendingMemo.reminderDistance}
                      onChange={e => setPendingMemo({ ...pendingMemo, reminderDistance: Number(e.target.value) })}
                      style={{ width: "50px", padding: "2px 4px", borderRadius: "4px", border: "1px solid #ddd" }} />
                    km以内で通知
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => {
              const memos = JSON.parse(localStorage.getItem("chamaMemos") || "[]");
              memos.push(pendingMemo);
              localStorage.setItem("chamaMemos", JSON.stringify(memos));
              setSavedMemos([...memos]); setConfirmMemoSave(false); setPendingMemo(null);
            }} style={{ flex: 1, padding: "8px", background: "#ff4d6d", color: "white",
              border: "none", borderRadius: "8px", fontSize: "14px", touchAction: "manipulation" }}>保存</button>
            <button onClick={() => { setConfirmMemoSave(false); setPendingMemo(null); }}
              style={{ flex: 1, padding: "8px", background: "#f0f0f0",
                border: "none", borderRadius: "8px", fontSize: "14px", touchAction: "manipulation" }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* ── 予定保存確認ポップアップ ── */}
      {confirmScheduleSave && scheduleLog && (
        <div className="no-select" onContextMenu={e => e.preventDefault()}
          style={{ position: "fixed", bottom: "180px", left: "50%", transform: "translateX(-50%)",
            background: "white", padding: "16px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", width: "280px", textAlign: "center",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          <div style={{ fontSize: "16px", marginBottom: "10px" }}>📅 この予定を保存する？</div>
          <div style={{ fontSize: "14px", color: "#333", marginBottom: "4px" }}>
            {scheduleLog.date      && <div>📆 {scheduleLog.date}</div>}
            {scheduleLog.startTime && <div>⏰ {scheduleLog.startTime}{scheduleLog.endTime ? `〜${scheduleLog.endTime}` : "〜"}</div>}
            <div>📝 {scheduleLog.title}</div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <button onClick={() => {
              const schedules = JSON.parse(localStorage.getItem("chamaSchedules") || "[]");
              const newSchedule = { id: createLogId(), ...scheduleLog, createdAt: new Date().toISOString() };
              schedules.push(newSchedule);
              localStorage.setItem("chamaSchedules", JSON.stringify(schedules));
              setSavedSchedules(schedules); setConfirmScheduleSave(false); setScheduleLog(null);
            }} style={{ marginRight: "10px", padding: "6px 12px", touchAction: "manipulation" }}>YES</button>
            <button onClick={() => { setConfirmScheduleSave(false); setScheduleLog(null); }}
              style={{ padding: "6px 12px", touchAction: "manipulation" }}>NO</button>
          </div>
        </div>
      )}

      <NavBar />

      {/* ── マイクボタン ── */}
      <div onClick={handleMicTap} onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.preventDefault()} className="no-select"
        style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          width: "80px", height: "80px", borderRadius: "50%",
          background: recording ? "#ff2d55" : "#ff4d6d", color: "white", fontSize: "32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)", cursor: "pointer", zIndex: 999,
          userSelect: "none", WebkitUserSelect: "none",
          WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
        🎤
      </div>
    </div>
  );
}
