// =============================================================================
// mapUtils.ts
// 地図計算ユーティリティ
//
// 設計方針:
//   - 型定義は type.ts に集約し、ここでは import して使う
//   - 純粋関数のみ（副作用なし）
//   - 将来の3D地球儀・海外対応を見越した計算式を使用
// =============================================================================

import type { LatLon, ArcRoute, LocationCluster, TravelType, ChamaLog } from "../../type";

// -----------------------------------------------------------------------------
// アーチ線生成
// -----------------------------------------------------------------------------

/**
 * 2点間のアーチ中間点を計算
 * 距離に応じてアーチの高さを可変にする（近距離は低く、長距離は高く）
 *
 * 将来拡張:
 *   - 3D地球儀モードでは球面補間（Slerp）に切り替える
 */
export function createArc(start: LatLon, end: LatLon): [LatLon, LatLon, LatLon] {
  const midLat = (start[0] + end[0]) / 2;
  const midLon = (start[1] + end[1]) / 2;

  const distKm = calcDistanceKm(start, end);

  // 距離に応じてアーチ高さを調整
  // 近距離（〜50km）: 低いアーチ / 長距離（500km〜）: 高いアーチ
  const curveRatio =
    distKm < 50   ? 0.15 :
    distKm < 200  ? 0.25 :
    distKm < 500  ? 0.35 :
                    0.45;

  const dx = end[1] - start[1];
  const dy = end[0] - start[0];
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curve = distance * curveRatio;

  const mid: LatLon = [midLat + curve, midLon];
  return [start, mid, end];
}

// -----------------------------------------------------------------------------
// 線の表示スタイル
// -----------------------------------------------------------------------------

/**
 * 訪問回数に応じた線の太さ
 */
export function getLineWeight(count: number): number {
  if (count >= 10) return 5.0;
  if (count >= 5)  return 4.0;
  if (count >= 3)  return 3.0;
  if (count >= 2)  return 2.2;
  return 1.5;
}

/**
 * 旅行種別に応じた線の色
 *
 * daily    = ピンク（日常）
 * travel   = 赤（旅行）
 * business = 白（仕事）
 * none     = ピンク（未分類）
 *
 * 将来拡張: テーマカラー設定に対応
 */
export function getLineColor(travelType: TravelType): string {
  switch (travelType) {
    case "travel":   return "#ff4d6d";
    case "business": return "#ffffff";
    case "daily":    return "#ff9eb5";
    case "none":
    default:         return "#ff4d6d";
  }
}

/**
 * 旅行種別に応じた線の透明度
 */
export function getLineOpacity(travelType: TravelType): number {
  switch (travelType) {
    case "business": return 0.6;
    default:         return 0.8;
  }
}

// -----------------------------------------------------------------------------
// マーカー表示スタイル
// -----------------------------------------------------------------------------

/**
 * 訪問回数に応じた円の色
 * 1回: 水色 → 多いほど赤に近づく
 */
export function getCircleColor(count: number): string {
  if (count > 10) return "#ff0000";
  if (count > 5)  return "#ff4400";
  if (count > 3)  return "#ff8800";
  if (count > 1)  return "#ffee00";
  return "#66ccff";
}

/**
 * 訪問回数に応じた円のサイズ（半径px）
 */
export function getCircleRadius(count: number): number {
  if (count >= 10) return 14;
  if (count >= 5)  return 11;
  if (count >= 3)  return 9;
  if (count >= 2)  return 7;
  return 5;
}

/**
 * ログタイプのアイコン
 */
export function getLogIcon(type: string): string {
  const icons: Record<string, string> = {
    restaurant:  "🍜",
    hotel:       "🏨",
    sightseeing: "🗼",
    leisure:     "🎡",
    sports:      "⚽",
    watching:    "🏟️",
    live:        "🎵",
    hospital:    "🏥",
    pharmacy:    "💊",
    shopping:    "🛍️",
    ceremony:    "💐",
    work:        "💼",
  };
  return icons[type] || "📍";
}

// -----------------------------------------------------------------------------
// 距離計算
// -----------------------------------------------------------------------------

/**
 * 2点間の距離をkm単位で計算（Haversine公式）
 * 将来の3D地球儀・総移動距離計算でも使用
 */
export function calcDistanceKm(a: LatLon, b: LatLon): number {
  const R  = 6371; // 地球の半径(km)
  const d1 = (b[0] - a[0]) * Math.PI / 180;
  const d2 = (b[1] - a[1]) * Math.PI / 180;
  const h  =
    Math.sin(d1 / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) *
    Math.cos(b[0] * Math.PI / 180) *
    Math.sin(d2 / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * 地球一周に対する進捗率を計算
 * 将来の「地球何周分か」表示に使用
 */
export function calcEarthLaps(totalDistKm: number): {
  laps: number;
  progressPercent: number;
  nextMilestoneKm: number;
} {
  const EARTH_CIRCUMFERENCE_KM = 40075;
  const laps = totalDistKm / EARTH_CIRCUMFERENCE_KM;
  const progressPercent = (laps % 1) * 100;
  const nextMilestone = Math.ceil(laps) * EARTH_CIRCUMFERENCE_KM;
  return {
    laps: Math.floor(laps),
    progressPercent: Math.round(progressPercent * 10) / 10,
    nextMilestoneKm: Math.round(nextMilestone - totalDistKm),
  };
}

// -----------------------------------------------------------------------------
// 地図bounds計算
// -----------------------------------------------------------------------------

/**
 * ログ一覧から地図のboundsを計算
 * 余白を持たせて全ポイントが見えるようにする
 */
export function calcBounds(logs: ChamaLog[]): [[number, number], [number, number]] {
  const withCoords = logs.filter(l => l.lat && l.lon);
  if (withCoords.length === 0) {
    return [[30, 128], [46, 146]]; // 日本デフォルト
  }
  const lats = withCoords.map(l => l.lat as number);
  const lons = withCoords.map(l => l.lon as number);

  // 距離に応じてパディングを調整
  const latRange = Math.max(...lats) - Math.min(...lats);
  const lonRange = Math.max(...lons) - Math.min(...lons);
  const padding = Math.max(0.3, Math.min(latRange, lonRange) * 0.2);

  return [
    [Math.min(...lats) - padding, Math.min(...lons) - padding],
    [Math.max(...lats) + padding, Math.max(...lons) + padding],
  ];
}

// -----------------------------------------------------------------------------
// クラスタリング
// -----------------------------------------------------------------------------

/**
 * ログを緯度経度でクラスタリング
 * 同じ場所への複数訪問をまとめる
 *
 * @param precision 小数点以下の桁数（大きいほど細かく分ける）
 */
export function clusterLogs(
  logs: ChamaLog[],
  precision: number = 4
): LocationCluster[] {
  const clusterMap: Record<string, LocationCluster> = {};

  logs
    .filter(l => l.lat && l.lon)
    .forEach(log => {
      const key = `${(log.lat as number).toFixed(precision)},${(log.lon as number).toFixed(precision)}`;
      if (!clusterMap[key]) {
        clusterMap[key] = {
          lat:        log.lat as number,
          lon:        log.lon as number,
          count:      0,
          logs:       [],
          prefecture: log.prefecture,
          city:       log.city,
        };
      }
      clusterMap[key].count++;
      clusterMap[key].logs.push(log);
    });

  return Object.values(clusterMap);
}
