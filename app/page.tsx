"use client";
import { useEffect, useState, useRef } from "react";
import type { ChamaLog, FoodGenre } from "./type";

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
    genre: FoodGenre;
    memo: string;
  } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [savedLog, setSavedLog] = useState<{
    name: string;
    price: number | null;
    rating: number | null;
    comment: string;
    genre: FoodGenre;
    memo: string;
    id: string;
  } | null>(null);
  const [editingSavedLog, setEditingSavedLog] = useState(false);
  const [ratingInput, setRatingInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  // どのフィールドを音声入力中か ("name"|"price"|"comment"|null)
  const [fieldRecording, setFieldRecording] = useState<string | null>(null);
  const [today, setToday] = useState("");

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
          analyzeFoodLog(transcript);
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

  // --- 以下の関数群は変更なし ---

  function normalizeVoiceText(text: string) {
    return text
      .replace(/，/g, ",")
      .replace(/．/g, ".")
      .replace(/。/g, " ")
      .replace(/　/g, " ")
      .replace(/\s+/g, " ")
      .replace(/えん/g, "円")
      .replace(/苑/g, "円")
      .replace(/まんえん/g, "万円")
      .replace(/テン/g, ".")
      .replace(/てん/g, ".")
      // iOS Safari の誤認識パターン
      .replace(/ご縁/g, "円")            // 「円」が「ご縁」になる
      .replace(/五円/g, "円")
      .replace(/一覧/g, "一蘭")          // 「一蘭」が「一覧」になる
      .replace(/8日/g, "評価")           // 「評価」が「8日」になる
      .replace(/8にち/g, "評価")
      .replace(/はーぶす/gi, "ハーブス")
      .replace(/harbs/gi, "ハーブス")
      .replace(/いちらん/gi, "一蘭")
      .replace(/スターバック/g, "スターバックス")
      .replace(/スタバックス/g, "スターバックス")
      .replace(/スター バックス/g, "スターバックス")
      .replace(/プランニュー酒場/g, "ブランニュー酒場")
      .replace(/1大門/g, "吉左衛門")
      .replace(/一大門/g, "吉左衛門")
      .replace(/吉在門/g, "吉左衛門")
      .replace(/きちざえもん/g, "吉左衛門")
      .replace(/吉左衛門/g, "吉左衛門")  // 正規化
      .trim();
  }

  function parseJapaneseNumber(text: string) {
    const normalized = text.replace(/,/g, "").trim();
    if (/^\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
    const digitMap: Record<string, number> = {
      零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4,
      五: 5, 六: 6, 七: 7, 八: 8, 九: 9
    };
    let total = 0;
    let current = 0;
    for (const char of normalized) {
      if (char in digitMap) {
        current = digitMap[char];
      } else if (char === "十") { total += (current || 1) * 10; current = 0; }
      else if (char === "百") { total += (current || 1) * 100; current = 0; }
      else if (char === "千") { total += (current || 1) * 1000; current = 0; }
      else if (char === "万") { total = (total + (current || 0)) * 10000; current = 0; }
      else return null;
    }
    return total + current;
  }

  function normalizeShopName(text: string) {
    const shopAliases = [
      { canonical: "ハーブス", aliases: ["ハーブス", "HARBS", "はーぶす", "harbs"] },
      { canonical: "一蘭", aliases: ["一蘭", "いちらん"] },
      { canonical: "スターバックス", aliases: ["スターバックス", "スタバ", "スターバック", "スタバックス", "スター バックス"] },
      { canonical: "亀寿司", aliases: ["亀寿司", "亀寿し", "かめずし"] },
      { canonical: "ブランニュー酒場", aliases: ["ブランニュー酒場", "プランニュー酒場"] },
      { canonical: "吉左衛門", aliases: ["吉左衛門", "1大門", "一大門", "きちざえもん"] }
    ];
    for (const shop of shopAliases) {
      if (shop.aliases.some((alias) => text.includes(alias))) return shop.canonical;
    }
    return "";
  }

  function detectGenre(text: string): FoodGenre {
    const genreRules = [
      { genre: "ramen", keywords: ["ラーメン", "中華そば", "つけ麺"] },
      { genre: "sushi", keywords: ["寿司", "寿し", "すし", "鮨"] },
      { genre: "yakiniku", keywords: ["焼肉"] },
      { genre: "yakitori", keywords: ["焼鳥", "焼き鳥"] },
      { genre: "horumon", keywords: ["ホルモン"] },
      { genre: "nabe", keywords: ["鍋", "もつ鍋", "しゃぶしゃぶ", "すき焼き"] },
      { genre: "teppanyaki", keywords: ["鉄板焼"] },
      { genre: "okonomiyaki", keywords: ["お好み焼", "たこ焼"] },
      { genre: "kushikatsu", keywords: ["串カツ", "串揚げ"] },
      { genre: "tonkatsu", keywords: ["トンカツ", "とんかつ", "カツ"] },
      { genre: "curry", keywords: ["カレー"] },
      { genre: "donburi", keywords: ["丼", "親子丼", "牛丼", "海鮮丼"] },
      { genre: "udon_soba", keywords: ["うどん", "蕎麦", "そば"] },
      { genre: "kaiseki_kappo", keywords: ["懐石", "割烹", "会席"] },
      { genre: "set_meal", keywords: ["定食", "御膳"] },
      { genre: "izakaya", keywords: ["居酒屋", "酒場", "バル"] },
      { genre: "japanese", keywords: ["和食", "天ぷら", "うなぎ"] },
      { genre: "french", keywords: ["フレンチ", "ビストロ"] },
      { genre: "italian", keywords: ["イタリアン", "パスタ", "ピザ"] },
      { genre: "western", keywords: ["洋食", "ハンバーグ", "オムライス"] },
      { genre: "chinese", keywords: ["中華", "餃子", "麻婆", "炒飯"] },
      { genre: "thai", keywords: ["タイ料理", "ガパオ", "トムヤム"] },
      { genre: "indian", keywords: ["インド料理", "ナン", "キーマ"] },
      { genre: "asian_other", keywords: ["ベトナム", "韓国料理", "アジア料理"] },
      { genre: "cafe", keywords: ["カフェ", "コーヒー", "喫茶"] },
      { genre: "sweets", keywords: ["ケーキ", "クレープ", "パフェ", "スイーツ", "タルト"] },
      { genre: "bakery", keywords: ["パン", "ベーカリー", "クロワッサン"] },
      { genre: "fast_food", keywords: ["マクドナルド", "バーガー", "ファストフード"] }
    ];
    for (const rule of genreRules) {
      if (rule.keywords.some((k) => text.includes(k))) return rule.genre as FoodGenre;
    }
    return "other";
  }

  function detectComment(text: string) {
    const commentHints = ["美味しかった","美味しい","うまかった","うまい","最高","残念","微妙","良かった","また行きたい","もう行かない","おいしかった"];
    for (const hint of commentHints) {
      if (text.includes(hint)) {
        const beforeHint = text.split(hint)[0]
          .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
          .replace(/[一二三四五六七八九十百千万〇零]+円/g, "")
          .replace(/評価\s*[0-9]+(?:\.[0-9]+)?/g, "")
          .replace(/ハーブス|一蘭|スターバックス|スタバ|亀寿司|ブランニュー酒場/g, "")
          .trim();
        return `${beforeHint}${hint}`.trim();
      }
    }
    // 感想キーワードが見つからなければ空文字（全文を感想にしない）
    return "";
  }

  function analyzeFoodLog(text: string) {
    const normalized = normalizeVoiceText(text);
    if (!normalized) return;

    let shop = "";
    let price: number | null = null;
    let rating: number | null = null;
    let comment = "";
    let genre: FoodGenre = "other";

    const shopFromWholeText = normalizeShopName(normalized);
    if (shopFromWholeText) shop = shopFromWholeText;

    const numericPriceMatch = normalized.match(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(円|万円)/);
    if (numericPriceMatch) {
      const value = Number(numericPriceMatch[1].replace(/,/g, ""));
      price = numericPriceMatch[2] === "万円" ? value * 10000 : value;
    } else {
      const japanesePriceMatch = normalized.match(/([一二三四五六七八九十百千万〇零]+)\s*(円)/);
      if (japanesePriceMatch) {
        const parsed = parseJapaneseNumber(japanesePriceMatch[1]);
        if (parsed !== null) price = parsed;
      }
    }

    const ratingMatch =
      normalized.match(/(?:評価|ひょうか|8日)\s*([0-9]+(?:\.[0-9]+)?)/) ||
      normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*点/);
    if (ratingMatch) rating = Number(ratingMatch[1]);

    genre = detectGenre(normalized);
    // shop名を除去してからcomment検出（店名が感想に混入しないように）
    const textForComment = shop
      ? normalized.replace(shop, "").trim()
      : normalized;
    comment = detectComment(textForComment);

    if (!shop) {
      let shopCandidate = normalized
        .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
        .replace(/[一二三四五六七八九十百千万〇零]+\s*(円)/g, "")
        .replace(/(?:評価|ひょうか|8日)\s*[0-9]+(?:\.[0-9]+)?/g, "")
        .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "");

      if (comment) shopCandidate = shopCandidate.replace(comment, "");

      const genreWords = ["ラーメン","中華そば","つけ麺","寿司","寿し","すし","鮨","焼肉","焼鳥","焼き鳥","ホルモン","鍋","もつ鍋","しゃぶしゃぶ","すき焼き","鉄板焼","お好み焼","たこ焼","串カツ","串揚げ","トンカツ","とんかつ","カレー","丼","親子丼","牛丼","海鮮丼","うどん","蕎麦","そば","居酒屋","酒場","バル","和食","天ぷら","うなぎ","フレンチ","ビストロ","イタリアン","パスタ","ピザ","洋食","ハンバーグ","オムライス","中華","餃子","麻婆","炒飯","タイ料理","ガパオ","トムヤム","インド料理","ナン","キーマ","ベトナム","韓国料理","アジア料理","カフェ","コーヒー","喫茶","ケーキ","クレープ","パフェ","スイーツ","タルト","パン","ベーカリー","クロワッサン","マクドナルド","バーガー","ファストフード"];
      for (const word of genreWords) shopCandidate = shopCandidate.replace(word, "");
      shopCandidate = shopCandidate.trim();

      const normalizedCandidate = normalizeShopName(shopCandidate);
      if (normalizedCandidate) {
        shop = normalizedCandidate;
      } else if (shopCandidate.length > 0) {
        shop = shopCandidate.split(" ")[0];
      }
    }

    if (!shop && placeName) shop = placeName;
    if (!shop) {
      const firstWord = normalized.split(" ")[0]?.trim();
      if (firstWord) shop = firstWord;
    }

    // memoは「店名 / 価格 / 評価 / 感想」の要約にする（全文ではなく）
    const memoParts = [
      shop || "名称未設定",
      price !== null ? `${price.toLocaleString()}円` : null,
      rating !== null ? `評価${rating}` : null,
      comment || null
    ].filter(Boolean) as string[];

    setFoodLog({
      name: shop || "名称未設定",
      price,
      rating,
      comment,
      genre,
      memo: memoParts.join(" / ")
    });

    setConfirmSave(true);
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
      <main style={{ padding: "20px", paddingBottom: "90px" }}>
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
          📅 本日の予定
          <div>予定はありません</div>
        </div>

        {/* 昨日の支出 */}
        <div style={card}>
          💰 昨日の支出
          <div>0円</div>
        </div>

        {/* ToDo */}
        <div style={card}>
          ✅ ToDo
          <div>なし</div>
        </div>

        {foodLog && !savedLog && (
          <div style={card}>
            🍜 外食ログ（確認中）
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
              <span style={{ fontWeight: "bold", fontSize: "15px" }}>🍜 最新の外食ログ</span>
              <button
                onClick={() => {
                  if (!editingSavedLog) {
                    setRatingInput(savedLog.rating !== null ? String(savedLog.rating) : "");
                    setPriceInput(savedLog.price !== null ? String(savedLog.price) : "");
                    setNameInput(savedLog.name || "");
                    setCommentInput(savedLog.comment || "");
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
                <div>🏠 {savedLog.name}</div>
                {savedLog.price !== null && <div>💰 {savedLog.price.toLocaleString()}円</div>}
                {savedLog.rating !== null && <div>⭐ 評価 {savedLog.rating}</div>}
                {savedLog.comment && <div>💬 {savedLog.comment}</div>}
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
                <div style={{ marginTop: "10px" }}>
                  店名
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                    <button onClick={() => startFieldRecording("name")} disabled={!!fieldRecording}
                      style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent", touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                  </div>
                </div>
                <div style={{ marginTop: "10px" }}>
                  価格
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      style={{ flex: 1 }}
                      type="text"
                      inputMode="numeric"
                    />
                    <span>円</span>
                  </div>
                </div>
                <div style={{ marginTop: "10px" }}>
                  評価
                  <input value={ratingInput} onChange={(e) => setRatingInput(e.target.value)} style={{ width: "100%" }} type="text" inputMode="decimal" />
                </div>
                <div style={{ marginTop: "10px" }}>
                  感想
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
                    <button onClick={() => startFieldRecording("comment")} disabled={!!fieldRecording}
                      style={{ padding: "4px 8px", fontSize: "16px", border: "none", background: "transparent", touchAction: "manipulation", opacity: fieldRecording ? 0.4 : 1 }}>🎤</button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!savedLog) return;
                    const parsedPrice = priceInput === "" ? null : Number(priceInput);
                    const parsedRating = ratingInput === "" ? null : Number(ratingInput);
                    const updatedLog = {
                      ...savedLog,
                      name: nameInput || savedLog.name,
                      comment: commentInput,
                      price: isNaN(parsedPrice as number) ? savedLog.price : parsedPrice,
                      rating: isNaN(parsedRating as number) ? savedLog.rating : parsedRating,
                    };
                    const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                    const idx = logs.findIndex((l) => l.id === savedLog.id);
                    if (idx !== -1) {
                      logs[idx] = {
                        ...logs[idx],
                        name: updatedLog.name,
                        price: updatedLog.price,
                        rating: updatedLog.rating,
                        comment: updatedLog.comment,
                        memo: [
                          updatedLog.name,
                          updatedLog.price !== null ? updatedLog.price.toLocaleString() + "円" : null,
                          updatedLog.rating !== null ? "評価" + updatedLog.rating : null,
                          updatedLog.comment || null
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
            この外食ログ保存する？
          </div>
          <div style={{ fontSize: "14px" }}>{foodLog.memo}</div>
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={async () => {
                if (!foodLog) return;
                const logs: ChamaLog[] = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
                const address = location
                  ? await getAddressFromLatLon(location.lat, location.lon)
                  : { country: "", prefecture: "", city: "" };
                const newLog: ChamaLog = {
                  id: createLogId(),
                  type: "restaurant",
                  name: foodLog.name,
                  price: foodLog.price,
                  rating: foodLog.rating,
                  comment: foodLog.comment,
                  genre: foodLog.genre,
                  memo: foodLog.memo,
                  lat: location?.lat,
                  lon: location?.lon,
                  country: address.country,
                  prefecture: address.prefecture,
                  city: address.city,
                  visitedAt: new Date().toISOString()
                };
                logs.push(newLog);
                localStorage.setItem("chamaLogs", JSON.stringify(logs));
                setSavedLog({ ...foodLog, id: newLog.id });
                setEditingSavedLog(false);
                setConfirmSave(false);
                setFoodLog(null);
                alert("保存しました！");
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

      {/* ✅ マイクボタン — onClick のみ、長押し対策済み */}
      <div
        onClick={handleMicTap}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        className="no-select"
        style={{
          position: "fixed", bottom: "20px", left: "50%",
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
