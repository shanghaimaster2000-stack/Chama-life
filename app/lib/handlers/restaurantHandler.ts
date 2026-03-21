/**
 * restaurantHandler.ts
 * 飲食店ログの音声入力解析ハンドラー
 * 入力例: 「飲食 一蘭天王寺店 1800円 美味しかった 評価3.5」
 */

import type { FoodGenre } from "../../type";
import {
  normalizeText, extractPrice, extractRating,
  normalizeShopName, extractComment, extractCompanions
} from "../normalize";

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
  companions: string;
  totalPeople: number | null;
  memo: string;
};

function detectGenre(text: string): FoodGenre {
  for (const rule of GENRE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.genre;
  }
  return "other";
}

/**
 * 店名を抽出する
 * 「一蘭天王寺店」→「一蘭天王寺店」（店舗名として丸ごと取得）
 * スペース区切りで最初のトークンを店名とする
 */
function extractShopName(text: string, placeName?: string): string {
  // 辞書マッチを先に試みる
  const fromDict = normalizeShopName(text);
  if (fromDict) return fromDict;

  // 価格・評価・ジャンルワードを除去した残りの最初のトークンを店名とする
  let candidate = text
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/[一二三四五六七八九十百千万〇零]+\s*円/g, "")
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "")
    .replace(/同行者.+?(?:計\s*[0-9]+\s*[人名]|$)/g, "");

  // ジャンルワードを除去（ただし店名の一部になってる場合は残す）
  // 例: 「天王寺店 ラーメン食べた」→「天王寺店」を残す
  for (const word of ALL_GENRE_WORDS) {
    // ジャンルワードの前後にスペースがある場合のみ除去
    candidate = candidate.replace(new RegExp(`(^|\\s)${word}(\\s|$)`, 'g'), ' ');
  }

  candidate = candidate.replace(/\s+/g, " ").trim();

  // 最初の単語を店名として返す
  const firstToken = candidate.split(" ")[0] || "";

  if (firstToken) return firstToken;
  if (placeName) return placeName;
  return "名称未設定";
}

export function analyzeRestaurant(rawText: string, placeName?: string): RestaurantResult {
  const normalized = normalizeText(rawText);

  // 同行者を先に抽出
  const { companions, totalPeople, cleanText } = extractCompanions(normalized);

  const price  = extractPrice(cleanText);
  const rating = extractRating(cleanText);
  const genre  = detectGenre(cleanText);
  const shop   = extractShopName(cleanText, placeName);
  const comment = extractComment(cleanText, shop, ALL_GENRE_WORDS);

  const memoParts = [
    shop,
    price       !== null ? `${price.toLocaleString()}円` : null,
    rating      !== null ? `評価${rating}` : null,
    comment     || null,
    companions  ? `同行者:${companions}` : null,
    totalPeople !== null ? `計${totalPeople}人` : null,
  ].filter(Boolean) as string[];

  return {
    type: "restaurant",
    name: shop,
    price,
    rating,
    comment,
    genre,
    companions,
    totalPeople,
    memo: memoParts.join(" / "),
  };
}