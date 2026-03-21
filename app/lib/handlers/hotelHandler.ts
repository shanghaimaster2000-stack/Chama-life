/**
 * hotelHandler.ts
 * 宿泊施設ログの音声入力解析ハンドラー
 * 入力例: 「宿泊 ヒルトン大阪 15000円 快適だった 評価4.2 同行者キーちゃん計2人」
 */

import type { HotelGenre } from "../../type";
import { normalizeText, extractPrice, extractRating, extractComment, extractCompanions } from "../normalize";

const HOTEL_GENRE_RULES: { genre: HotelGenre; keywords: string[] }[] = [
  { genre: "ryokan",         keywords: ["旅館", "温泉宿", "和室"] },
  { genre: "resort",         keywords: ["リゾート", "resort"] },
  { genre: "guesthouse",     keywords: ["ゲストハウス", "民宿", "ホステル"] },
  { genre: "capsule",        keywords: ["カプセル"] },
  { genre: "pension",        keywords: ["ペンション"] },
  { genre: "business_hotel", keywords: ["ビジネスホテル", "ホテル", "hotel"] },
];

const ALL_HOTEL_WORDS = HOTEL_GENRE_RULES.flatMap(r => r.keywords);

const HOTEL_REMOVE_WORDS = [
  ...ALL_HOTEL_WORDS,
  "チェックイン", "チェックアウト", "泊まった", "宿泊した",
];

export type HotelResult = {
  type: "hotel";
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: HotelGenre;
  companions: string;
  totalPeople: number | null;
  memo: string;
};

function detectHotelGenre(text: string): HotelGenre {
  for (const rule of HOTEL_GENRE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.genre;
  }
  return "other";
}

export function analyzeHotel(rawText: string): HotelResult {
  const normalized = normalizeText(rawText);

  const { companions, totalPeople, cleanText } = extractCompanions(normalized);

  const price  = extractPrice(cleanText);
  const rating = extractRating(cleanText);
  const genre  = detectHotelGenre(cleanText);

  // 施設名: ホテルジャンルキーワードの前の単語
  let name = "";
  for (const kw of ALL_HOTEL_WORDS) {
    const idx = cleanText.indexOf(kw);
    if (idx > 0) {
      const before = cleanText.slice(0, idx).trim();
      name = before.split(" ").pop() || "";
      break;
    }
  }

  // キーワードが先頭にない場合は最初の単語
  if (!name) {
    let candidate = cleanText
      .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
      .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
      .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "");
    for (const word of HOTEL_REMOVE_WORDS) candidate = candidate.replace(word, "");
    candidate = candidate.trim();
    name = candidate.split(" ")[0] || "名称未設定";
  }

  const comment = extractComment(cleanText, name, HOTEL_REMOVE_WORDS);

  const memoParts = [
    name,
    price       !== null ? `${price.toLocaleString()}円` : null,
    rating      !== null ? `評価${rating}` : null,
    comment     || null,
    companions  ? `同行者:${companions}` : null,
    totalPeople !== null ? `計${totalPeople}人` : null,
  ].filter(Boolean) as string[];

  return { type: "hotel", name, price, rating, comment, genre, companions, totalPeople, memo: memoParts.join(" / ") };
}
