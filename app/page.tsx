"use client";
import { useEffect, useState } from "react";

const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

let recognition: any = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = true;
  recognition.continuous = true;
}

function getPollenLevel(temp:number, humidity:number, wind:number){
  if(temp < 10) return "少ない";
  if(wind > 5 && humidity < 60) return "非常に多い";
  if(wind > 3 && humidity < 70) return "多い";
  if(temp > 15) return "やや多い";
  return "少ない";
}

export default function Home() {
const [weather,setWeather] = useState<any>(null);
const [recording, setRecording] = useState(false);
const [voiceText, setVoiceText] = useState("");
const [location, setLocation] = useState<any>(null);
const [placeName, setPlaceName] = useState("");
const [foodLog, setFoodLog] = useState<any>(null);
const [confirmSave, setConfirmSave] = useState(false);
const [today, setToday] = useState("");

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

function analyzeFoodLog(text:string){
  let shop = placeName || "";
  let food = "";
  let price = "";
  let rating = "";
  let comment = "";

  const priceMatch = text.match(/([0-9]+)\s*円/);
  if(priceMatch) price = priceMatch[1];

  const ratingMatch = text.match(/評価\s*([0-9\.]+)/);
  if(ratingMatch) rating = ratingMatch[1];

  const shopWords = ["ラーメン","寿司","カフェ","食堂","バー"];
  shopWords.forEach(word=>{
    if(text.includes(word)){
      shop = text.split(word)[0] + word;
    }
  });

  const foodMatch = text.match(/(ラーメン|チャーシュー麺|カレー|寿司|パスタ)/);
  if(foodMatch) food = foodMatch[0];

  if(text.includes("美味")){
    comment = "美味しかった";
  }

  setFoodLog({
    shop,
    food,
    price,
    rating,
    comment,
    memo:text
  });

  setConfirmSave(true);
}

useEffect(() => {
  if (!recognition) return;
  recognition.onresult = (event: any) => {
    let text = "";
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }

    setVoiceText(text);
  };
}, []);

  useEffect(()=>{
    fetch("https://api.openweathermap.org/data/2.5/weather?q=Osaka&units=metric&lang=ja&appid=86ca6b2b34afed3e3ee7ea0a15929519")
      .then(res=>res.json())
      .then(data=>{
        setWeather(data);
      });
  },[]);

useEffect(() => {

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLocation({
        lat: position.coords.latitude,
        lon: position.coords.longitude
      });
    },
    (error) => {
      console.log("GPS error", error);
    }
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
  .then(res => res.json())
  .then(data => {
    if (data.elements && data.elements.length > 0) {
      const name = data.elements[0].tags.name;
      if (name) setPlaceName(name);
    }
  });
}, [location]);

  const card = {
    background:"#ffffff",
    borderRadius:"14px",
    padding:"18px",
    marginTop:"15px",
    boxShadow:"0 3px 8px rgba(0,0,0,0.08)"
  }; 

  return(
    <div style={{
      maxWidth:"420px",
      margin:"auto",
      fontFamily:"sans-serif",
      background:"#f4f6f8",
      minHeight:"100vh"
    }}>
      <main style={{padding:"20px",paddingBottom:"90px"}}>
        <h1 style={{textAlign:"center"}}>チャマLife</h1>

        <div style={{textAlign:"center"}}>
          📅 {today}
        </div>

        {/* 天気 */}
        <div style={card}>
          <div style={{fontSize:"14px",color:"#666"}}>
            📍現在地
          </div>

          {weather ? (
            <>
        <div style={{
          display:"flex",
          alignItems:"center",
          marginTop:"10px"
    }}>
        <img
          src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
          alt="weather"
          style={{width:"50px",height:"50px"}}
        />

        <div style={{
          fontSize:"28px",
          fontWeight:"bold",
          marginLeft:"6px"
       }}>
          {Math.round(weather.main.temp)}℃
        </div>
      </div>

  <div style={{marginTop:"5px",fontSize:"14px"}}>
    体感 {Math.round(weather.main.feels_like)}℃　
    湿度 {weather.main.humidity}%　
    風速 {weather.wind.speed} m/s
  </div>

  <div style={{marginTop:"4px",fontSize:"14px"}}>
    🌸 花粉 {getPollenLevel(
      weather.main.temp,
      weather.main.humidity,
      weather.wind.speed
    )}
</div>

{placeName && (
  <div style={{marginTop:"6px",fontSize:"14px"}}>
    🍴 {placeName}
  </div>
)}
            </>
          ):(
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
{foodLog && (
  <div style={card}>
    🍜 外食ログ候補
    <div>店: {foodLog.shop}</div>
    <div>料理: {foodLog.food}</div>
    <div>価格: {foodLog.price}円</div>
    <div>評価: {foodLog.rating}</div>
    <div>{foodLog.comment}</div>
  </div>
)}

      </main>
{/* 録音ポップアップ */}
{recording && (
  <div
    style={{
      position:"fixed",
      top:"40%",
      left:"50%",
      transform:"translateX(-50%)",
      background:"white",
      padding:"20px",
      borderRadius:"12px",
      boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
      textAlign:"center",
      width:"260px",
      zIndex:1000
    }}
  >
    <div style={{fontSize:"20px"}}>🎤 録音中...</div>

    <div style={{marginTop:"10px"}}>
      {voiceText}
    </div>
  </div>
)}

{confirmSave && foodLog && (
  <div
    style={{
      position:"fixed",
      bottom:"180px",
      left:"50%",
      transform:"translateX(-50%)",
      background:"white",
      padding:"16px",
      borderRadius:"12px",
      boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
      width:"260px",
      textAlign:"center"
    }}
  >
    <div style={{fontSize:"16px",marginBottom:"10px"}}>
      この外食ログ保存する？
    </div>

    <div style={{fontSize:"14px"}}>
      {foodLog.memo}
    </div>

    <div style={{marginTop:"12px"}}>

      <button
        onClick={()=>{
        const logs = JSON.parse(localStorage.getItem("chamaLogs") || "[]");

        logs.push({
         ...foodLog,
         lat: location?.lat,
         lon: location?.lon,
         date: new Date().toISOString()
        });

        localStorage.setItem("chamaLogs", JSON.stringify(logs));

        alert("保存しました！");
          setConfirmSave(false);
        }}
        style={{
          marginRight:"10px",
          padding:"6px 12px"
        }}
      >
        YES
      </button>

      <button
        onClick={()=>setConfirmSave(false)}
        style={{
          padding:"6px 12px"
        }}
      >
        NO
      </button>

    </div>
  </div>
)}

{/* マイクボタン */}
<div
  onMouseDown={()=>{
    if(!recognition) return;
    setVoiceText("");
    recognition.start();
    setRecording(true);
  }}
  onMouseUp={()=>{
    if(!recognition) return;
    recognition.stop();
    setRecording(false);
    analyzeFoodLog(voiceText);
  }}
  onTouchStart={()=>{
    if(!recognition) return;
    setVoiceText("");
    recognition.start();
    setRecording(true);
  }}
  onTouchEnd={()=>{
    if(!recognition) return;
    recognition.stop();
    setRecording(false);
    analyzeFoodLog(voiceText);
  }}
  style={{
    position:"fixed",
    bottom:"20px",
    left:"50%",
    transform:"translateX(-50%)",
    width:"80px",
    height:"80px",
    borderRadius:"50%",
    background:"#ff4d6d",
    color:"white",
    fontSize:"32px",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    boxShadow:"0 6px 16px rgba(0,0,0,0.25)",
    cursor:"pointer",
    zIndex:999
  }}
>
🎤
</div>

</div>

  )
}