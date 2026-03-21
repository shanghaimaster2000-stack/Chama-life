/**
 * mapUtils.ts
 * 地図計算ユーティリティ
 * アーチ線・距離計算・色決定など
 */

export type LatLon = [number, number];

export type ArcRoute = {
  start:      LatLon;
  mid:        LatLon;
  end:        LatLon;
  count:      number;
  travelType: "travel" | "work" | "unknown";
};

export type LocationCluster = {
  lat:    number;
  lon:    number;
  count:  number;
  logs:   any[];
};

/**
 * 2点間のアーチ中間点を計算（上方向アーチ）
 */
export function createArc(start: LatLon, end: LatLon): [LatLon, LatLon, LatLon] {
  const midLat  = (start[0] + end[0]) / 2;
  const midLon  = (start[1] + end[1]) / 2;
  const dx      = end[1] - start[1];
  const dy      = end[0] - start[0];
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curve   = distance * 0.35;
  const mid: LatLon = [midLat + curve, midLon];
  return [start, mid, end];
}

/**
 * 訪問回数に応じた線の太さ
 */
export function getLineWeight(count: number): number {
  if (count >= 5) return 4.0;
  if (count >= 3) return 3.0;
  if (count >= 2) return 2.2;
  return 1.5;
}

/**
 * 旅行種別に応じた線の色
 * 赤: 旅行、白: 仕事
 */
export function getLineColor(travelType: "travel" | "work" | "unknown"): string {
  switch (travelType) {
    case "travel":  return "#ff4d6d";
    case "work":    return "#ffffff";
    default:        return "#ff4d6d";
  }
}

/**
 * 訪問回数に応じた円の色
 */
export function getCircleColor(count: number): string {
  if (count > 5) return "#ff0000";
  if (count > 3) return "#ff8800";
  if (count > 1) return "#ffee00";
  return "#66ccff";
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

/**
 * 2点間の距離をkm単位で計算（Haversine公式）
 */
export function calcDistanceKm(a: LatLon, b: LatLon): number {
  const R  = 6371;
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
 * 地図のboundsを計算
 */
export function calcBounds(logs: any[]): [[number, number], [number, number]] {
  const withCoords = logs.filter(l => l.lat && l.lon);
  if (withCoords.length === 0) {
    return [[30, 128], [46, 146]]; // 日本デフォルト
  }
  const lats = withCoords.map(l => l.lat);
  const lons = withCoords.map(l => l.lon);
  const minLat = Math.min(...lats) - 0.5;
  const maxLat = Math.max(...lats) + 0.5;
  const minLon = Math.min(...lons) - 0.5;
  const maxLon = Math.max(...lons) + 0.5;
  return [[minLat, minLon], [maxLat, maxLon]];
}
