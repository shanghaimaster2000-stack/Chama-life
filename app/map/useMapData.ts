/**
 * useMapData.ts
 * 地図用データ処理フック
 * localStorageからログを読んで集計・整形する
 */

"use client";
import { useEffect, useState } from "react";
import {
  createArc,
  calcBounds,
  type LatLon,
  type ArcRoute,
  type LocationCluster,
} from "./mapUtils";

// 自宅座標（設定画面で変更できるようにする予定）
export const HOME_LAT = 34.58371;
export const HOME_LON = 135.524963;

export type MapData = {
  logs:         any[];
  homeRoutes:   ArcRoute[];
  clusters:     LocationCluster[];
  bounds:       [[number, number], [number, number]];
  totalDistKm:  number;
  isLoaded:     boolean;
};

export function useMapData(): MapData {
  const [data, setData] = useState<MapData>({
    logs:        [],
    homeRoutes:  [],
    clusters:    [],
    bounds:      [[30, 128], [46, 146]],
    totalDistKm: 0,
    isLoaded:    false,
  });

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
    const logs = raw.filter((l: any) => l.lat && l.lon);

    // 訪問地点クラスタリング
    const clusterMap: Record<string, LocationCluster> = {};
    logs.forEach((log: any) => {
      const key = `${log.lat.toFixed(4)},${log.lon.toFixed(4)}`;
      if (!clusterMap[key]) {
        clusterMap[key] = { lat: log.lat, lon: log.lon, count: 0, logs: [] };
      }
      clusterMap[key].count++;
      clusterMap[key].logs.push(log);
    });
    const clusters = Object.values(clusterMap);

    // 自宅起点アーチ線
    const HOME: LatLon = [HOME_LAT, HOME_LON];
    const homeRoutes: ArcRoute[] = clusters
      .filter(c => !(
        Math.abs(c.lat - HOME_LAT) < 0.001 &&
        Math.abs(c.lon - HOME_LON) < 0.001
      ))
      .map(c => {
        const dest: LatLon = [c.lat, c.lon];
        const [start, mid, end] = createArc(HOME, dest);

        // travelTypeを判定（logsのtypeから）
        const types = c.logs.map((l: any) => l.type as string);
        const hasWork = types.some(t => t === "work");
        const hasTravel = types.some(t => t !== "work");
        const travelType = hasWork && !hasTravel ? "work"
          : hasTravel ? "travel"
          : "unknown";

        return { start, mid, end, count: c.count, travelType };
      });

    // 総移動距離（自宅↔各地点の往復）
    const totalDistKm = homeRoutes.reduce((sum, r) => {
      const dx = r.end[0] - HOME_LAT;
      const dy = r.end[1] - HOME_LON;
      const dist = Math.sqrt(dx * dx + dy * dy) * 111; // 緯度1度≈111km
      return sum + dist * 2 * r.count;
    }, 0);

    setData({
      logs,
      homeRoutes,
      clusters,
      bounds:      calcBounds(logs),
      totalDistKm: Math.round(totalDistKm),
      isLoaded:    true,
    });
  }, []);

  return data;
}
