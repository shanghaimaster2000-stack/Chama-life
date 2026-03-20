/**
 * restaurantHandler.ts
 * 飲食店ログの音声入力解析ハンドラー
 */

import type { FoodGenre } from "../../type";
import { normalizeText, extractPrice, extractRating, normalizeShopName, COMMENT_HINTS } from "../normalize";

const GENRE_RULES: { genre: FoodGenre; keywords: string[] }[] = [
  { genre: "ramen",        keywords: ["ラーメン", "中華そば", "つけ麺"] },
  { genre: "sushi",        keywords: ["寿司", "寿し", "すし", "鮨"] },
  { genre: "yakiniku",     keywords: ["焼肉"] },
  { genre: "yakitori",     keywords: ["焼鳥", "焼き鳥"] },
  { genre: "horumon",      keywords: ["ホルモン"] },
  { genre: "nabe",         keywords: ["鍋", "もつ鍋", "しゃぶしゃぶ", "すき焼き"] },
  { genre: "teppanyaki",   keywords: ["鉄板焼"] },
  { genre: "okonomiyaki",  keywords: ["お好み焼", "たこ焼"] },
  { genre: "kushikatsu",   keywords: ["串カツ", "串揚げ"] },
  { genre: "tonkatsu",     keywords: ["トンカツ", "とんかつ", "カツ"] },
  { genre: "curry",        keywords: ["カレー"] },
  { genre: "donburi",      keywords: ["丼", "親子丼", "牛丼", "海鮮丼"] },
  { genre: "udon_soba",    keywords: ["うどん", "蕎麦", "そば"] },
  { genre: "kaiseki_kappo",keywords: ["懐石", "割烹", "会席"] },
  { genre: "set_meal",     keywords: ["定食", "御膳"] },
  { genre: "izakaya",      keywords: ["居酒屋", "酒場", "バル"] },
  { genre: "japanese",     keywords: ["和食", "天ぷら", "うなぎ"] },
  { genre: "french",       keywords: ["フレンチ", "ビストロ"] },
  { genre: "italian",      keywords: ["イタリアン", "パスタ", "ピザ"] },
  { genre: "western",      keywords: ["洋食", "ハンバーグ", "オムライス"] },
  { genre: "chinese",      keywords: ["中華", "餃子", "麻婆", "炒飯"] },
  { genre: "thai",         keywords: ["タイ料理", "ガパオ", "トムヤム"] },
  { genre: "indian",       keywords: ["インド料理", "ナン", "キーマ"] },
  { genre: "asian_other",  keywords: ["ベトナム", "韓国料理", "アジア料理"] },
  { genre: "cafe",         keywords: ["カフェ", "コーヒー", "喫茶"] },
  { genre: "sweets",       keywords: ["ケーキ", "クレープ", "パフェ", "スイーツ", "タルト"] },
  { genre: "bakery",       keywords: ["パン", "ベーカリー", "クロワッサン"] },
  { genre: "fast_food",    keywords: ["マクドナルド", "バーガー", "ファストフード"] },
];

const ALL_GENRE_WORDS = GENRE_RULES.flatMap((r) => r.keywords);

const NON_RESTAURANT_KEYWORDS = [
  "観光", "見学", "訪問", "訪れた", "神社", "寺", "城", "博物館", "美術館",
  "公園", "展望台", "テーマパーク", "水族館", "動物園", "世界遺産",
  "ホテル", "旅館", "宿泊", "チェックイン", "チェックアウト", "泊まった",
];

export type RestaurantResult = {
  type: "restaurant";
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: FoodGenre;
  memo: string;
};

export function isRestaurant(text: string): boolean {
  if (NON_RESTAURANT_KEYWORDS.some((kw) => text.includes(kw))) return false;
  return ALL_GENRE_WORDS.some((word) => text.includes(word)) ||
    COMMENT_HINTS.some((hint) => text.includes(hint));
}

function detectGenre(text: string): FoodGenre {
  for (const rule of GENRE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.genre;
  }
  return "other";
}

function detectComment(text: string, shopName: string): string {
  const textWithoutShop = shopName ? text.replace(shopName, "").trim() : text;
  for (const hint of COMMENT_HINTS) {
    if (textWithoutShop.includes(hint)) {
      const beforeHint = textWithoutShop.split(hint)[0]
        .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
        .replace(/[一二三四五六七八九十百千万〇零]+円/g, "")
        .replace(/評価\s*[0-9]+(?:\.[0-9]+)?/g, "")
        .trim();
      return `${beforeHint}${hint}`.trim();
    }
  }
  return "";
}

export function analyzeRestaurant(rawText: string, placeName?: string): RestaurantResult {
  const normalized = normalizeText(rawText);

  let shop     = normalizeShopName(normalized);
  const price  = extractPrice(normalized);
  const rating = extractRating(normalized);
  const genre  = detectGenre(normalized);
  const comment = detectComment(normalized, shop);

  if (!shop) {
    let candidate = normalized
      .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
      .replace(/[一二三四五六七八九十百千万〇零]+\s*円/g, "")
      .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
      .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "");

    if (comment) candidate = candidate.replace(comment, "");
    for (const word of ALL_GENRE_WORDS) candidate = candidate.replace(word, "");
    candidate = candidate.trim();

    const fromAlias = normalizeShopName(candidate);
    shop = fromAlias || candidate.split(" ")[0] || "";
  }

  if (!shop && placeName) shop = placeName;
  if (!shop) shop = normalized.split(" ")[0] || "名称未設定";

  const memoParts = [
    shop,
    price  !== null ? `${price.toLocaleString()}円` : null,
    rating !== null ? `評価${rating}` : null,
    comment || null,
  ].filter(Boolean) as string[];

  return { type: "restaurant", name: shop, price, rating, comment, genre, memo: memoParts.join(" / ") };
}
