"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr:false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr:false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr:false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr:false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr:false });
const Circle = dynamic(() => import("react-leaflet").then(m => m.Circle), { ssr:false });

export default function MapPage() {

const [visibleRoutes,setVisibleRoutes] = useState(1);
const [routeProgress,setRouteProgress] = useState(0);
const [progress,setProgress] = useState(0);
const [visibleLocations,setVisibleLocations] = useState(1);
const [position,setPosition] = useState<[number,number] | null>(null);
const center = position ?? [35,135];
const HOME:[number,number] = [34.58371,135.52496300000004];

useEffect(()=>{

  navigator.geolocation.getCurrentPosition((pos)=>{
    setPosition([
      pos.coords.latitude,
      pos.coords.longitude
    ]);
  });

},[]);

useEffect(()=>{

  const timer = setInterval(()=>{
  setProgress(p => {
    if(p >= 1) return 1;
    return p + 0.02;
  });
},30);

  return ()=>clearInterval(timer);

},[]);

  let logs:any[] = [];

  if (typeof window !== "undefined") {
    logs = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
  }



const routeCounts: Record<string, any> = {};

for(let i=1;i<logs.length;i++){

  const key =
    logs[i-1].lat + "," + logs[i-1].lon +
    "_" +
    logs[i].lat + "," + logs[i].lon;

  if(!routeCounts[key]){
    routeCounts[key] = {
      route:[
        [logs[i-1].lat, logs[i-1].lon],
        [logs[i].lat, logs[i].lon]
      ],
      count:0
    };
  }

  routeCounts[key].count++;
}

const routes = Object.values(routeCounts);
function createArc(start:[number,number],end:[number,number]){

const midLat = (start[0] + end[0]) / 2;
const midLon = (start[1] + end[1]) / 2;

const dx = end[1] - start[1];
const dy = end[0] - start[0];

const distance = Math.sqrt(dx*dx + dy*dy);

const curve = distance * 0.3;

const midPoint:[number,number] = [
midLat + curve,
midLon
];

return [start,midPoint,end];

}

const locationCounts: Record<string, any> = {};

logs.forEach((log)=>{
  const key = log.lat + "," + log.lon;

  if(!locationCounts[key]){
    locationCounts[key] = {
      lat: log.lat,
      lon: log.lon,
      count:0
    };
  }

  locationCounts[key].count++;
});

const locations = Object.values(locationCounts);
let minLat = 90;
let maxLat = -90;
let minLon = 180;
let maxLon = -180;

logs.forEach((log)=>{

if(log.lat < minLat) minLat = log.lat;
if(log.lat > maxLat) maxLat = log.lat;

if(log.lon < minLon) minLon = log.lon;
if(log.lon > maxLon) maxLon = log.lon;

});

const bounds = [
  [minLat,minLon],
  [maxLat,maxLon]
];

const homeRoutes:any[] = [];

locations.forEach((loc)=>{

const lat = loc.lat;
const lon = loc.lon;

if(lat === HOME[0] && lon === HOME[1]) return;

const arc = createArc(HOME,[lat,lon]);

homeRoutes.push({
route:arc,
count:loc.count
});

});

  return (
    <div style={{height:"100vh"}}>

      {position && (
      <MapContainer
        bounds={bounds}
        style={{ height:"100vh", width:"100%" }}
      >

        <TileLayer
         url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />
      {logs.map((log,i)=>(
        <Circle
         key={i}
         center={[log.lat,log.lon]}
         radius={5000}
    >
        <Popup>
        {log.type === "restaurant" ? "🍜" :
         log.type === "hotel" ? "🏨" :
         log.type === "spot" ? "📍" :
         "💼"} {log.name}

        <br/>

        💰 {log.price}円

        <br/>

        ⭐ {log.rating}
        </Popup>
      </Circle>
   ))}

        {homeRoutes.slice(0,visibleRoutes).map((r,i)=>(
        <Polyline
        key={i}
        positions={[
          r.route[0],
          [
            r.route[0][0] + (r.route[1][0]-r.route[0][0]) * progress,
            r.route[0][1] + (r.route[1][1]-r.route[0][1]) * progress
          ],
          [
            r.route[0][0] + (r.route[2][0]-r.route[0][0]) * progress,
            r.route[0][1] + (r.route[2][1]-r.route[0][1]) * progress
          ]
        ]}
        pathOptions={{
        color:"#ff5500",
        weight:2 + r.count*2,
        opacity:0.5
        }}
        />
        ))}
        
        {locations.slice(0,visibleLocations).map((loc,i)=>(
         <div key={i}>

        <Circle
          center={[loc.lat,loc.lon]}
          radius={300 + loc.count * 200}
          pathOptions={{
          color: loc.count > 5 ? "#ff0000" :
                 loc.count > 3 ? "#ff8800" :
                 loc.count > 1 ? "#ffee00" :
                 "#66ccff",

          fillColor: loc.count > 5 ? "#ff0000" :
                     loc.count > 3 ? "#ff8800" :
                     loc.count > 1 ? "#ffee00" :
                     "#66ccff",

          fillOpacity:0.35
         }}
       />
          <Marker
            key={i}
            position={[loc.lat,loc.lon]}
          >
            <Popup>
              📍 訪問回数：{loc.count}
              <br/>
              🍜 食ログあり
            </Popup>
          </Marker>
         </div>   
        ))}

      </MapContainer>
     )}
    </div>
  );
}