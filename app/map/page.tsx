// =============================================================================
// map/page.tsx
// 地図画面
//
// 設計方針:
//   - 描画のみを担当（データ取得・集計は useMapData.ts が担当）
//   - モード切替: 移動線図 / 訪問地点 / 線非表示
//   - アニメーション: 自宅起点から各地点へ線が伸びる演出
//   - 将来拡張: 県・市ポリゴン色塗り、旅行ストーリー再生
// =============================================================================

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import NavBar from "../components/NavBar";
import { useMapData } from "./useMapData";
import {
  getLineWeight,
  getLineColor,
  getLineOpacity,
  getCircleColor,
  getCircleRadius,
  getLogIcon,
  calcEarthLaps,
} from "./mapUtils";
import type { ArcRoute, LatLon } from "../../type";

// -----------------------------------------------------------------------------
// Leafletコンポーネント（SSR無効）
// -----------------------------------------------------------------------------
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import("react-leaflet").then(m => m.Marker),       { ssr: false });
const Popup        = dynamic(() => import("react-leaflet").then(m => m.Popup),        { ssr: false });
const Polyline     = dynamic(() => import("react-leaflet").then(m => m.Polyline),     { ssr: false });
const Circle       = dynamic(() => import("react-leaflet").then(m => m.Circle),       { ssr: false });

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------
const ANIMATION_STEP        = 0.015;
const ANIMATION_INTERVAL_MS = 30;
const BEZIER_SEGMENTS       = 30;

// -----------------------------------------------------------------------------
// 表示モード
// -----------------------------------------------------------------------------
type MapMode = "routes" | "spots";

// -----------------------------------------------------------------------------
// ベジェ曲線補間
// -----------------------------------------------------------------------------
function calcBezierPoints(
  start: LatLon,
  mid: LatLon,
  end: LatLon,
  progress: number
): LatLon[] {
  const points: LatLon[] = [];
  const steps = Math.ceil(BEZIER_SEGMENTS * progress);

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : (i / steps) * progress;
    const lat =
      (1 - t) * (1 - t) * start[0] +
      2 * (1 - t) * t * mid[0] +
      t * t * end[0];
    const lon =
      (1 - t) * (1 - t) * start[1] +
      2 * (1 - t) * t * mid[1] +
      t * t * end[1];
    points.push([lat, lon]);
  }
  return points;
}

// -----------------------------------------------------------------------------
// 地球周回テキスト生成
// 1周未満も含めて常に表示する
// 例: 0.46周 / 1.2周 / 3周
// -----------------------------------------------------------------------------
function formatEarthLaps(totalDistKm: number): string {
  const { laps, progressPercent } = calcEarthLaps(totalDistKm);
  const totalLaps = laps + progressPercent / 100;

  if (totalLaps === 0) return "";

  // 小数点1桁で表示（ちょうど整数の時は整数表示）
  const formatted = totalLaps % 1 === 0
    ? `${totalLaps}`
    : `${totalLaps.toFixed(1)}`;

  return `地球${formatted}周分`;
}

// -----------------------------------------------------------------------------
// メインコンポーネント
// -----------------------------------------------------------------------------
export default function MapPage() {
  const [position, setPosition]     = useState<LatLon | null>(null);
  const [progress, setProgress]     = useState(0);
  const [mode, setMode]             = useState<MapMode>("routes");
  const [showRoutes, setShowRoutes] = useState(true);

  const {
    logs, homeRoutes, clusters, bounds, totalDistKm, isLoaded,
  } = useMapData();

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
    setProgress(0);
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 1) { clearInterval(timer); return 1; }
        return p + ANIMATION_STEP;
      });
    }, ANIMATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isLoaded]);

  const earthLapsText = formatEarthLaps(totalDistKm);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── コントロールバー ── */}
      <div style={{
        background: "#1a1a2e", color: "white",
        padding: "8px 16px", zIndex: 1000, flexShrink: 0,
      }}>
        {/* 上段: 統計情報 */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "6px",
        }}>
          <div style={{ fontSize: "13px" }}>
            <span style={{ color: "#ff4d6d", fontWeight: "bold" }}>🌏</span>
            <span style={{ marginLeft: "6px", color: "#aaa" }}>
              {clusters.length}箇所訪問
              {totalDistKm > 0 && (
                <>
                  {" • "}
                  <span style={{ color: "#ff9eb5" }}>
                    {totalDistKm.toLocaleString()}km
                  </span>
                  {earthLapsText && (
                    <span style={{ color: "#888", fontSize: "11px" }}>
                      {" "}（{earthLapsText}）
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* 線の表示/非表示トグル */}
          {mode === "routes" && (
            <button
              onClick={() => setShowRoutes(v => !v)}
              style={{
                padding: "3px 8px", fontSize: "11px", borderRadius: "6px",
                border: "1px solid #444", cursor: "pointer",
                background: showRoutes ? "#2a2a4e" : "#444",
                color: showRoutes ? "#aaa" : "#fff",
                touchAction: "manipulation",
              }}
            >
              {showRoutes ? "✈️ 線を隠す" : "✈️ 線を表示"}
            </button>
          )}
        </div>

        {/* 下段: モード切替 */}
        <div style={{ display: "flex", gap: "6px" }}>
          {([
            { key: "routes", label: "✈️ 移動線図" },
            { key: "spots",  label: "📍 訪問地点" },
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

      {/* ── 地図エリア ── */}
      <div style={{ flex: 1, position: "relative" }}>

        {/* 読み込み中 */}
        {!isLoaded && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "#1a1a2e", color: "#aaa",
          }}>
            読み込み中...
          </div>
        )}

        {/* ログなし */}
        {isLoaded && logs.length === 0 && (
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
        )}

        {/* 地図表示 */}
        {isLoaded && logs.length > 0 && (
          <MapContainer
            bounds={bounds}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 移動線図モード: アーチ線 */}
            {mode === "routes" && showRoutes && homeRoutes.map((route: ArcRoute, i: number) => (
              <Polyline
                key={i}
                positions={calcBezierPoints(
                  route.start, route.mid, route.end, progress
                ) as [number, number][]}
                pathOptions={{
                  color:   getLineColor(route.travelType),
                  weight:  getLineWeight(route.count),
                  opacity: getLineOpacity(route.travelType),
                }}
              />
            ))}

            {/* 訪問地点モード: 円マーカー */}
            {mode === "spots" && clusters.map((cluster, i) => (
              <Circle
                key={i}
                {...({
                  center:      [cluster.lat, cluster.lon],
                  radius:      getCircleRadius(cluster.count) * 60,
                  pathOptions: {
                    color:       getCircleColor(cluster.count),
                    fillColor:   getCircleColor(cluster.count),
                    fillOpacity: 0.35,
                    weight:      1,
                  },
                } as any)}
              />
            ))}

            {/* クラスタマーカー（両モード共通） */}
            {clusters.map((cluster, i) => (
              <Marker key={i} position={[cluster.lat, cluster.lon]}>
                <Popup>
                  <div style={{ fontSize: "13px", minWidth: "160px" }}>
                    <div style={{
                      fontWeight: "bold", marginBottom: "6px", color: "#ff4d6d",
                    }}>
                      📍 訪問 {cluster.count}回
                      {cluster.city && (
                        <span style={{ color: "#888", fontWeight: "normal", fontSize: "11px" }}>
                          {" "}{cluster.city}
                        </span>
                      )}
                    </div>

                    {cluster.logs.slice(0, 4).map((log, j) => (
                      <div key={j} style={{
                        marginTop: "4px", fontSize: "12px",
                        paddingBottom: "4px",
                        borderBottom: j < Math.min(cluster.logs.length, 4) - 1
                          ? "1px solid #f0f0f0" : "none",
                      }}>
                        <div>{getLogIcon(log.type)} {log.name}</div>
                        <div style={{ color: "#888", fontSize: "11px", marginTop: "2px" }}>
                          {log.price !== null && log.price !== undefined && (
                            <span>{log.price.toLocaleString()}円</span>
                          )}
                          {log.rating !== null && log.rating !== undefined && (
                            <span style={{ marginLeft: "6px", color: "#f90" }}>
                              ⭐{log.rating}
                            </span>
                          )}
                          {log.visitedAt && (
                            <span style={{ marginLeft: "6px" }}>
                              {new Date(log.visitedAt).toLocaleDateString("ja-JP", {
                                month: "numeric", day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
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
                  center:      position,
                  radius:      100,
                  pathOptions: {
                    color: "#4fc3f7", fillColor: "#4fc3f7", fillOpacity: 0.8,
                  },
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
