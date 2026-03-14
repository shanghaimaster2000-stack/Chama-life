"use client";
import { useState } from "react";

export default function LogPage(){
const [today, setToday] = useState("");
const [type,setType] = useState("restaurant");
const [name,setName] = useState("");
const [price,setPrice] = useState("");
const [rating,setRating] = useState("");

function saveLog(){

navigator.geolocation.getCurrentPosition((pos)=>{

const lat = pos.coords.latitude;
const lon = pos.coords.longitude;

const newLog = {
lat,
lon,
type,
name,
price: Number(price),
rating: Number(rating),
visitedAt: new Date().toISOString()
};

let logs:any[] = [];

if(typeof window !== "undefined"){
logs = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
}

logs.push(newLog);

localStorage.setItem("chamaLogs",JSON.stringify(logs));

alert("保存したよ🍜");

});

}

return(

<div style={{padding:30}}>

<h1>🍜 食ログ</h1>

<select
value={type}
onChange={(e)=>setType(e.target.value)}
>
<option value="restaurant">🍜 レストラン</option>
<option value="hotel">🏨 ホテル</option>
<option value="spot">📍 観光</option>
<option value="work">💼 仕事</option>
</select>

<input
placeholder="名前"
value={name}
onChange={(e)=>setName(e.target.value)}
/>

<input
placeholder="価格"
value={price}
onChange={(e)=>setPrice(e.target.value)}
/>

<input
placeholder="評価(1-5)"
value={rating}
onChange={(e)=>setRating(e.target.value)}
/>

<br/><br/>

<button onClick={saveLog}>
保存
</button>

</div>

);

}