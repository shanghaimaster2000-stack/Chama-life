"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import NavBar from "../components/NavBar";
import { useMapData } from "./useMapData";
import {
  getLineWeight,
  getLineColor,
  getCircleColor,
  getLogIcon,
} from "./mapUtils";

// Leafletコンポーネント（SSR無効）
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import("react-leaflet").then(m => m.Marker),       { ssr: false });
const Popup        = dynamic(() => import("react-leaflet").then(m => m.Popup),        { ssr: false });
const Polyline     = dynamic(() => import("react-leaflet").then(m => m.Polyline),     { ssr: false });
const Circle       = dynamic(() => import("react-leaflet").then(m => m.Circle),       { ssr: false });

// 表示モード
type MapMode = "routes" | "spots";

export default function MapPage() {
  const [position, setPosition]   = useState<[number, number] | null>(null);
  const [progress, setProgress]   = useState(0);
  const [mode, setMode]           = useState<MapMode>("routes");
  const { logs, homeRoutes, clusters, bounds, totalDistKm, isLoaded } = useMapData();

  // GPS取得
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setPosition([pos.coords.latitude, pos.coords.longitude]),
      err => console.log("GPS error:", err)
    );
  }, []);

  // アーチ線アニメーション
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setInterval(() => {
      setProgress(p => p >= 1 ? 1 : p + 0.015);
    }, 30);
    return () => clearInterval(timer);
  }, [isLoaded]);

  // アーチ線の現在位置計算
  function getAnimatedPositions(route: any) {
    const [s, m, e] = [route.start, route.mid, route.end];
    return [
      s,
      [s[0] + (m[0] - s[0]) * progress, s[1] + (m[1] - s[1]) * progress] as [number, number],
      [s[0] + (e[0] - s[0]) * progress, s[1] + (e[1] - s[1]) * progress] as [number, number],
    ];
  }

  const NAVBAR_H = 60;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* コントロールバー */}
      <div style={{
        background: "#1a1a2e", color: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", zIndex: 1000, flexShrink: 0,
      }}>
        <div style={{ fontSize: "13px" }}>
          <span style={{ color: "#ff4d6d", fontWeight: "bold" }}>🌏</span>
          <span style={{ marginLeft: "6px", color: "#aaa" }}>
            訪問地点 {clusters.length}箇所
            {totalDistKm > 0 && ` • 総移動 ${totalDistKm.toLocaleString()}km`}
          </span>
        </div>

        {/* モード切替 */}
        <div style={{ display: "flex", gap: "6px" }}>
          {([
            { key: "routes", label: "✈️ 移動" },
            { key: "spots",  label: "📍 地点" },
          ] as { key: MapMode; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                padding: "4px 10px", fontSize: "12px", borderRadius: "6px",
                border: "none", cursor: "pointer",
                background: mode === key ? "#ff4d6d" : "#2a2a4e",
                color: "white", touchAction: "manipulation",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* 地図エリア */}
      <div style={{ flex: 1, position: "relative" }}>
        {!isLoaded ? (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "#1a1a2e", color: "#aaa",
          }}>
            読み込み中...
          </div>
        ) : logs.length === 0 ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#1a1a2e", color: "#aaa", gap: "12px",
          }}>
            <div style={{ fontSize: "48px" }}>🌏</div>
            <div style={{ fontSize: "14px" }}>まだログがありません</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              ホーム画面で音声入力するとここに表示されます
            </div>
          </div>
        ) : (
          <MapContainer
            bounds={bounds}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {/* モード: 移動線図 */}
            {mode === "routes" && homeRoutes.map((route, i) => (
              <Polyline
                key={i}
                positions={getAnimatedPositions(route) as any}
                pathOptions={{
                  color:   getLineColor(route.travelType),
                  weight:  getLineWeight(route.count),
                  opacity: 0.8,
                }}
              />
            ))}

            {/* モード: 訪問地点 */}
            {mode === "spots" && clusters.map((cluster, i) => (
              <Circle
                key={i}
                {...({
                  center: [cluster.lat, cluster.lon],
                  radius: 300 + cluster.count * 200,
                  pathOptions: {
                    color:       getCircleColor(cluster.count),
                    fillColor:   getCircleColor(cluster.count),
                    fillOpacity: 0.35,
                    weight:      1,
                  },
                } as any)}
              />
            ))}

            {/* マーカー（両モード共通） */}
            {clusters.map((cluster, i) => (
              <Marker key={i} position={[cluster.lat, cluster.lon]}>
                <Popup>
                  <div style={{ fontSize: "13px", minWidth: "140px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "6px", color: "#ff4d6d" }}>
                      📍 訪問 {cluster.count}回
                    </div>
                    {cluster.logs.slice(0, 4).map((log: any, j: number) => (
                      <div key={j} style={{ marginTop: "4px", fontSize: "12px" }}>
                        {getLogIcon(log.type)} {log.name}
                        {log.price !== null && log.price !== undefined && (
                          <span style={{ color: "#888" }}>　{log.price.toLocaleString()}円</span>
                        )}
                        {log.rating !== null && log.rating !== undefined && (
                          <span style={{ color: "#f90" }}>　⭐{log.rating}</span>
                        )}
                      </div>
                    ))}
                    {cluster.logs.length > 4 && (
                      <div style={{ color: "#aaa", marginTop: "4px", fontSize: "11px" }}>
                        他 {cluster.logs.length - 4}件
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* 現在地マーカー */}
            {position && (
              <Circle
                {...({
                  center: position,
                  radius: 100,
                  pathOptions: { color: "#4fc3f7", fillColor: "#4fc3f7", fillOpacity: 0.8 },
                } as any)}
              />
            )}
          </MapContainer>
        )}
      </div>

      <NavBar />
    </div>
  );
}
