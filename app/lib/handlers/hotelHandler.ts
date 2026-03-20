/**
 * hotelHandler.ts
 * 宿泊施設ログの音声入力解析ハンドラー
 */

import { normalizeText, extractPrice, extractRating } from "../normalize";

// -----------------------------------------------
// 宿泊施設タイプキーワード辞書
// -----------------------------------------------
const HOTEL_KEYWORDS = [
  "ホテル", "旅館", "宿", "宿泊", "チェックイン", "チェックアウト",
  "泊まった", "泊まる", "泊", "inn", "hotel", "resort", "リゾート",
  "ペンション", "民宿", "ゲストハウス", "カプセル", "ビジネスホテル",
];

export type HotelGenre =
  | "business_hotel"
  | "ryokan"
  | "resort"
  | "guesthouse"
  | "capsule"
  | "pension"
  | "other";

const HOTEL_GENRE_RULES: { genre: HotelGenre; keywords: string[] }[] = [
  { genre: "ryokan",         keywords: ["旅館", "温泉宿", "和室"] },
  { genre: "resort",         keywords: ["リゾート", "resort"] },
  { genre: "guesthouse",     keywords: ["ゲストハウス", "民宿", "ホステル"] },
  { genre: "capsule",        keywords: ["カプセル"] },
  { genre: "pension",        keywords: ["ペンション"] },
  { genre: "business_hotel", keywords: ["ビジネスホテル", "ホテル", "hotel"] },
];

const COMMENT_HINTS = [
  "良かった", "最高", "残念", "微妙", "快適", "不満", "また泊まりたい",
  "きれい", "汚かった", "広かった", "狭かった", "おすすめ",
];

export type HotelResult = {
  type: "hotel";
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: HotelGenre;
  memo: string;
};

export function isHotel(text: string): boolean {
  return HOTEL_KEYWORDS.some((kw) => text.includes(kw));
}

function detectHotelGenre(text: string): HotelGenre {
  for (const rule of HOTEL_GENRE_RULES) {
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

export function analyzeHotel(rawText: string): HotelResult {
  const normalized = normalizeText(rawText);

  const price   = extractPrice(normalized);
  const rating  = extractRating(normalized);
  const genre   = detectHotelGenre(normalized);
  const comment = detectComment(normalized);

  // 施設名の抽出: キーワードの前にある単語を施設名とみなす
  let name = "";
  for (const kw of HOTEL_KEYWORDS) {
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
    type: "hotel",
    name,
    price,
    rating,
    comment,
    genre,
    memo: memoParts.join(" / "),
  };
}
