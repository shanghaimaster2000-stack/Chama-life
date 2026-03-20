/**
 * spotHandler.ts
 * 観光地・スポットログの音声入力解析ハンドラー
 */

import { normalizeText, extractPrice, extractRating } from "../normalize";

const SPOT_KEYWORDS = [
  "観光", "見学", "訪問", "行った", "行ってきた", "来た", "訪れた",
  "神社", "寺", "お寺", "城", "博物館", "美術館", "公園", "展望台",
  "テーマパーク", "水族館", "動物園", "遊園地", "名所", "スポット",
  "世界遺産", "温泉", "海", "山", "滝", "湖",
];

export type SpotGenre =
  | "shrine_temple"
  | "castle"
  | "museum"
  | "park"
  | "theme_park"
  | "nature"
  | "onsen"
  | "other";

const SPOT_GENRE_RULES: { genre: SpotGenre; keywords: string[] }[] = [
  { genre: "shrine_temple", keywords: ["神社", "寺", "お寺", "仏閣", "神宮"] },
  { genre: "castle",        keywords: ["城", "お城"] },
  { genre: "museum",        keywords: ["博物館", "美術館", "記念館", "資料館"] },
  { genre: "park",          keywords: ["公園", "庭園", "植物園"] },
  { genre: "theme_park",    keywords: ["テーマパーク", "遊園地", "水族館", "動物園"] },
  { genre: "onsen",         keywords: ["温泉", "銭湯", "スパ"] },
  { genre: "nature",        keywords: ["海", "山", "滝", "湖", "渓谷", "森"] },
];

const COMMENT_HINTS = [
  "良かった", "最高", "残念", "微妙", "すごかった", "きれい", "感動",
  "また来たい", "おすすめ", "混んでた", "空いてた",
];

export type SpotResult = {
  type: "spot";
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: SpotGenre;
  memo: string;
};

export function isSpot(text: string): boolean {
  return SPOT_KEYWORDS.some((kw) => text.includes(kw));
}

function detectSpotGenre(text: string): SpotGenre {
  for (const rule of SPOT_GENRE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.genre;
  }
  return "other";
}

function detectComment(text: string): string {
  for (const hint of COMMENT_HINTS) {
    if (text.includes(hint)) return hint;
  }
  return "";
}

export function analyzeSpot(rawText: string): SpotResult {
  const normalized = normalizeText(rawText);

  const price   = extractPrice(normalized);
  const rating  = extractRating(normalized);
  const genre   = detectSpotGenre(normalized);
  const comment = detectComment(normalized);

  // スポット名: キーワードの前の単語を名称とみなす
  let name = "";
  for (const kw of SPOT_KEYWORDS) {
    const idx = normalized.indexOf(kw);
    if (idx > 0) {
      const before = normalized.slice(0, idx).trim();
      name = before.split(" ").pop() || "";
      break;
    }
  }
  if (!name) name = normalized.split(" ")[0] || "名称未設定";

  const memoParts = [
    name,
    price  !== null ? `${price.toLocaleString()}円` : null,
    rating !== null ? `評価${rating}` : null,
    comment || null,
  ].filter(Boolean) as string[];

  return {
    type: "spot",
    name,
    price,
    rating,
    comment,
    genre,
    memo: memoParts.join(" / "),
  };
}
