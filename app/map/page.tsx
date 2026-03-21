"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import NavBar from "../components/NavBar";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr:false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr:false });
const Marker       = dynamic(() => import("react-leaflet").then(m => m.Marker),       { ssr:false });
const Popup        = dynamic(() => import("react-leaflet").then(m => m.Popup),        { ssr:false });
const Polyline     = dynamic(() => import("react-leaflet").then(m => m.Polyline),     { ssr:false });
const Circle       = dynamic(() => import("react-leaflet").then(m => m.Circle),       { ssr:false });

// ログタイプのアイコン
function getLogIcon(type: string) {
  switch (type) {
    case "restaurant":  return "🍜";
    case "hotel":       return "🏨";
    case "sightseeing": return "🗼";
    case "leisure":     return "🎡";
    case "sports":      return "⚽";
    case "watching":    return "🏟️";
    case "live":        return "🎵";
    case "hospital":    return "🏥";
    case "pharmacy":    return "💊";
    case "shopping":    return "🛍️";
    case "ceremony":    return "💐";
    case "work":        return "💼";
    default:            return "📍";
  }
}

export default function MapPage() {
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const HOME: [number, number] = [34.58371, 135.524963];

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition([pos.coords.latitude, pos.coords.longitude]);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => p >= 1 ? 1 : p + 0.02);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  let logs: any[] = [];
  if (typeof window !== "undefined") {
    logs = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
  }

  // 訪問地点の集計
  const locationCounts: Record<string, any> = {};
  logs.forEach((log) => {
    if (!log.lat || !log.lon) return;
    const key = `${log.lat},${log.lon}`;
    if (!locationCounts[key]) {
      locationCounts[key] = { lat: log.lat, lon: log.lon, count: 0, logs: [] };
    }
    locationCounts[key].count++;
    locationCounts[key].logs.push(log);
  });
  const locations = Object.values(locationCounts);

  // 自宅起点のアーチ線
  function createArc(start: [number, number], end: [number, number]) {
    const midLat  = (start[0] + end[0]) / 2;
    const midLon  = (start[1] + end[1]) / 2;
    const dx      = end[1] - start[1];
    const dy      = end[0] - start[0];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curve   = distance * 0.3;
    return [start, [midLat + curve, midLon] as [number, number], end];
  }

  const homeRoutes: any[] = locations
    .filter(loc => !(loc.lat === HOME[0] && loc.lon === HOME[1]))
    .map(loc => ({
      route: createArc(HOME, [loc.lat, loc.lon]),
      count: loc.count,
    }));

  // 地図のbounds
  const logsWithCoords = logs.filter(l => l.lat && l.lon);
  const bounds = logsWithCoords.length > 0 ? [
    [Math.min(...logsWithCoords.map(l => l.lat)), Math.min(...logsWithCoords.map(l => l.lon))],
    [Math.max(...logsWithCoords.map(l => l.lat)), Math.max(...logsWithCoords.map(l => l.lon))],
  ] : [[30, 130], [45, 145]];

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      {position && (
        <MapContainer
          bounds={bounds as any}
          style={{ height: "calc(100vh - 60px)", width: "100%" }}
        >
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
          />

          {/* 訪問地点の円 */}
          {locations.map((loc, i) => (
            <Circle
              key={i}
              {...({
                center: [loc.lat, loc.lon],
                radius: 300 + loc.count * 200,
                pathOptions: {
                  color: loc.count > 5 ? "#ff0000" :
                         loc.count > 3 ? "#ff8800" :
                         loc.count > 1 ? "#ffee00" : "#66ccff",
                  fillColor: loc.count > 5 ? "#ff0000" :
                             loc.count > 3 ? "#ff8800" :
                             loc.count > 1 ? "#ffee00" : "#66ccff",
                  fillOpacity: 0.35,
                },
              } as any)}
            />
          ))}

          {/* マーカーとポップアップ */}
          {locations.map((loc, i) => (
            <Marker key={i} position={[loc.lat, loc.lon]}>
              <Popup>
                <div style={{ fontSize: "13px", minWidth: "120px" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    📍 訪問回数：{loc.count}回
                  </div>
                  {loc.logs.slice(0, 3).map((log: any, j: number) => (
                    <div key={j} style={{ marginTop: "4px" }}>
                      {getLogIcon(log.type)} {log.name}
                      {log.price !== null && <span>　💰{log.price.toLocaleString()}円</span>}
                      {log.rating !== null && <span>　⭐{log.rating}</span>}
                    </div>
                  ))}
                  {loc.logs.length > 3 && (
                    <div style={{ color: "#999", marginTop: "4px" }}>他{loc.logs.length - 3}件...</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 自宅起点アーチ線 */}
          {homeRoutes.map((r, i) => (
            <Polyline
              key={i}
              positions={[
                r.route[0],
                [
                  r.route[0][0] + (r.route[1][0] - r.route[0][0]) * progress,
                  r.route[0][1] + (r.route[1][1] - r.route[0][1]) * progress,
                ],
                [
                  r.route[0][0] + (r.route[2][0] - r.route[0][0]) * progress,
                  r.route[0][1] + (r.route[2][1] - r.route[0][1]) * progress,
                ],
              ]}
              pathOptions={{
                color: "#ff5500",
                weight: 2 + r.count * 2,
                opacity: 0.5,
              }}
            />
          ))}
        </MapContainer>
      )}

      {/* 地図がまだ読み込み中 */}
      {!position && (
        <div style={{
          height: "calc(100vh - 60px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#1a1a2e", color: "white", fontSize: "14px",
        }}>
          🌏 地図を読み込み中...
        </div>
      )}

      <NavBar />
    </div>
  );
}
