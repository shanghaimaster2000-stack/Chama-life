/**
 * spotHandler.ts
 * 観光地・スポットログの音声入力解析ハンドラー
 * 入力例: 「観光 東京タワー 1500円 値段ちょっと高い 評価3.1 同行者キーちゃん計2人」
 */

import { normalizeText, extractPrice, extractRating, extractComment, extractCompanions } from "../normalize";

export type SpotGenre =
  | "shrine_temple" | "castle" | "museum" | "park"
  | "theme_park" | "aquarium" | "zoo" | "stadium"
  | "cinema" | "onsen" | "nature" | "other";

const SPOT_GENRE_RULES: { genre: SpotGenre; keywords: string[] }[] = [
  { genre: "shrine_temple", keywords: ["神社", "寺", "お寺", "仏閣", "神宮"] },
  { genre: "castle",        keywords: ["城", "お城"] },
  { genre: "museum",        keywords: ["博物館", "美術館", "記念館", "資料館"] },
  { genre: "park",          keywords: ["公園", "庭園", "植物園"] },
  { genre: "theme_park",    keywords: ["テーマパーク", "遊園地"] },
  { genre: "aquarium",      keywords: ["水族館"] },
  { genre: "zoo",           keywords: ["動物園"] },
  { genre: "stadium",       keywords: ["スタジアム", "球場", "競技場", "アリーナ"] },
  { genre: "cinema",        keywords: ["映画館", "映画"] },
  { genre: "onsen",         keywords: ["温泉", "銭湯", "スパ"] },
  { genre: "nature",        keywords: ["海", "山", "滝", "湖", "渓谷", "森", "展望台"] },
];

const ALL_SPOT_WORDS = SPOT_GENRE_RULES.flatMap(r => r.keywords);

export type SpotResult = {
  type: "spot";
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: SpotGenre;
  companions: string;
  totalPeople: number | null;
  memo: string;
};

export function isSpot(text: string): boolean {
  return ALL_SPOT_WORDS.some((kw) => text.includes(kw));
}

function detectSpotGenre(text: string): SpotGenre {
  for (const rule of SPOT_GENRE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.genre;
  }
  return "other";
}

export function analyzeSpot(rawText: string): SpotResult {
  const normalized = normalizeText(rawText);

  const { companions, totalPeople, cleanText } = extractCompanions(normalized);

  const price  = extractPrice(cleanText);
  const rating = extractRating(cleanText);
  const genre  = detectSpotGenre(cleanText);

  // 施設名: 最初の単語（価格・評価・ジャンルワード除去後）
  let candidate = cleanText
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "");

  for (const word of ALL_SPOT_WORDS) candidate = candidate.replace(word, "");
  candidate = candidate.replace(/\s+/g, " ").trim();
  const name = candidate.split(" ")[0] || "名称未設定";

  const comment = extractComment(cleanText, name, ALL_SPOT_WORDS);

  const memoParts = [
    name,
    price       !== null ? `${price.toLocaleString()}円` : null,
    rating      !== null ? `評価${rating}` : null,
    comment     || null,
    companions  ? `同行者:${companions}` : null,
    totalPeople !== null ? `計${totalPeople}人` : null,
  ].filter(Boolean) as string[];

  return { type: "spot", name, price, rating, comment, genre, companions, totalPeople, memo: memoParts.join(" / ") };
}
