"use client";
import { useEffect, useState } from "react";

export default function RankingPage(){

const [logs,setLogs] = useState<any[]>([]);

useEffect(()=>{
  const saved = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
  setLogs(saved);
},[]);

const restaurants = logs.filter(l => l.type==="restaurant");
const hotels = logs.filter(l => l.type==="hotel");
const spots = logs.filter(l => l.type==="spot");

const topRestaurants =
[...restaurants].sort((a,b)=>b.rating-a.rating).slice(0,5);

const expensiveRestaurants =
[...restaurants].sort((a,b)=>b.price-a.price).slice(0,5);

const expensiveHotels =
[...hotels].sort((a,b)=>b.price-a.price).slice(0,5);

return(

<div style={{padding:30}}>

<h1>🏆 This is my life! Rankings</h1>

<h2>🍜 Restaurant Rating</h2>

{topRestaurants.map((r,i)=>(
<div key={i}>
{i+1}位 {r.name} ⭐{r.rating}
</div>
))}

<h2>💰 Expensive Restaurants</h2>

{expensiveRestaurants.map((r,i)=>(
<div key={i}>
{i+1}位 {r.name} {r.price}円
</div>
))}

<h2>🏨 Expensive Hotels</h2>

{expensiveHotels.map((h,i)=>(
<div key={i}>
{i+1}位 {h.name} {h.price}円
</div>
))}

</div>

);

}