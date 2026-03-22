// =============================================================================
// useMapData.ts
// 地図用データ処理フック
//
// 設計方針:
//   - データ取得・集計・整形だけを担当（描画はmap/page.tsxが担当）
//   - データソースは将来 localStorage → Supabase に差し替えるだけでOK
//   - GPS移動線生成はネイティブ移行後に追加予定
// =============================================================================

"use client";
import { useEffect, useState } from "react";
import type { ChamaLog, MapData, ArcRoute, TravelType, LatLon } from "../type";
import {
  createArc,
  calcBounds,
  calcDistanceKm,
  clusterLogs,
} from "./mapUtils";

// -----------------------------------------------------------------------------
// 自宅座標
// 将来: 設定画面で変更できるようにする（Supabase の user_settings テーブルへ）
// -----------------------------------------------------------------------------
export const HOME_LAT = 34.58371;
export const HOME_LON = 135.524963;
export const HOME: LatLon = [HOME_LAT, HOME_LON];

// 自宅とみなす範囲（度）
const HOME_THRESHOLD = 0.001;

// -----------------------------------------------------------------------------
// データ取得
// 将来: この関数を Supabase クエリに差し替えるだけでOK
// -----------------------------------------------------------------------------
async function fetchLogs(): Promise<ChamaLog[]> {
  // TODO: Supabase移行時はここを差し替える
  // return await supabase.from("chama_logs").select("*");
  const raw = JSON.parse(localStorage.getItem("chamaLogs") || "[]");
  return raw as ChamaLog[];
}

// -----------------------------------------------------------------------------
// アーチ線生成
// 自宅 → 訪問地点 のアーチ線データを生成する
// -----------------------------------------------------------------------------
function buildHomeRoutes(logs: ChamaLog[]): ArcRoute[] {
  const clusters = clusterLogs(logs);

  return clusters
    // 自宅と同じ地点は除外
    .filter(c => !(
      Math.abs(c.lat - HOME_LAT) < HOME_THRESHOLD &&
      Math.abs(c.lon - HOME_LON) < HOME_THRESHOLD
    ))
    .map(c => {
      const dest: LatLon = [c.lat, c.lon];
      const [start, mid, end] = createArc(HOME, dest);

      // 旅行種別を判定（logsのtravelTypeから多数決）
      const travelTypes = c.logs.map((l: ChamaLog) => l.travelType ?? "none");
      const travelType = decideTravelType(travelTypes);

      // 距離を計算
      const distKm = Math.round(calcDistanceKm(HOME, dest));

      return { start, mid, end, count: c.count, travelType, distKm };
    });
}

/**
 * 複数のtravelTypeから代表値を決める
 * 優先度: travel > business > daily > none
 */
function decideTravelType(types: (TravelType | undefined)[]): TravelType {
  if (types.some(t => t === "travel"))   return "travel";
  if (types.some(t => t === "business")) return "business";
  if (types.some(t => t === "daily"))    return "daily";
  return "none";
}

// -----------------------------------------------------------------------------
// 総移動距離計算
// Haversine公式で正確に計算（将来の「地球何周分か」表示に使用）
// -----------------------------------------------------------------------------
function calcTotalDistKm(routes: ArcRoute[]): number {
  const total = routes.reduce((sum, r) => {
    return sum + (r.distKm ?? 0) * r.count;
  }, 0);
  return Math.round(total);
}

// -----------------------------------------------------------------------------
// メインフック
// -----------------------------------------------------------------------------
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
    (async () => {
      const allLogs  = await fetchLogs();
      const logs     = allLogs.filter(l => l.lat && l.lon);
      const clusters = clusterLogs(logs);
      const homeRoutes   = buildHomeRoutes(logs);
      const totalDistKm  = calcTotalDistKm(homeRoutes);
      const bounds       = calcBounds(logs);

      setData({
        logs,
        homeRoutes,
        clusters,
        bounds,
        totalDistKm,
        isLoaded: true,
      });
    })();
  }, []);

  return data;
}
