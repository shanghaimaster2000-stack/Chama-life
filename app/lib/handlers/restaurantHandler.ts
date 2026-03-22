/**
 * restaurantHandler.ts
 * 飲食店ログの音声入力解析ハンドラー
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

// 店名サフィックス（これで終わるトークンは店名の一部）
const SHOP_SUFFIXES = ["店", "支店", "本店", "分店", "号店", "館", "亭", "屋", "楼", "苑", "園", "堂", "庵", "処", "所", "邸", "軒"];

// 感想・評価キーワード（これ以降は店名ではない）
const COMMENT_START_WORDS = [
  "美味しかった", "美味しい", "うまかった", "うまい", "おいしかった",
  "最高", "良かった", "残念", "微妙", "いまいち", "ふつう", "普通",
  "また行きたい", "もう行かない", "高かった", "安かった",
  "値段", "コスパ", "混んでた", "快適", "感動",
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

function hasShopSuffix(token: string): boolean {
  return SHOP_SUFFIXES.some(s => token.endsWith(s));
}

function isCommentStart(token: string): boolean {
  return COMMENT_START_WORDS.some(w => token.includes(w));
}

function isGenreWord(token: string): boolean {
  return ALL_GENRE_WORDS.includes(token);
}

/**
 * 店名を抽出する
 *
 * ロジック:
 * 1. 表記ゆれを正規化（例: "スタバ" → "スターバックス"、"一覧" → "一蘭"）
 * 2. 数値・評価・同行者を除去
 * 3. スペース区切りでトークン化
 * 4. 最初のトークンから始めて、以下の条件で店名トークンを集める:
 *    - ジャンルワード単独 → 店名終了
 *    - 感想キーワード → 店名終了
 *    - 「〇〇店」「〇〇亭」などのサフィックス → 店名に追加して終了
 *    - それ以外 → 店名に追加して継続
 */
function extractShopName(text: string, placeName?: string): string {
  // ① 表記ゆれを正規化してからトークン解析（店名の"確定"はしない）
  const normalizedText = normalizeShopName(text);

  console.log("extractShopName input:", normalizedText);

  // ② 数値情報・評価・同行者を除去
  let candidate = normalizedText
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/[一二三四五六七八九十百千万〇零]+\s*円/g, "")
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "")
    .replace(/同行者.+/g, "")
    .replace(/\s+/g, " ").trim();

  const tokens = candidate.split(" ").filter(Boolean);
  console.log("tokens:", tokens);

  if (tokens.length === 0) return placeName || "名称未設定";

  const shopTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // 感想キーワードが来たら終了
    if (isCommentStart(token)) break;

    // ジャンルワード単独なら終了（ただし店名が空の場合は続ける）
    if (isGenreWord(token) && shopTokens.length > 0) break;

    // トークンを追加
    shopTokens.push(token);

    // 店舗サフィックスで終わるなら店名終了
    if (hasShopSuffix(token)) break;
  }

  const shopName = shopTokens.join(" ").trim();
  if (shopName) return shopName;
  if (placeName) return placeName;
  return "名称未設定";
}

export function analyzeRestaurant(rawText: string, placeName?: string): RestaurantResult {
  const normalized = normalizeText(rawText);

  // 同行者を先に抽出
  const { companions, totalPeople, cleanText } = extractCompanions(normalized);

  const price   = extractPrice(cleanText);
  const rating  = extractRating(cleanText);
  const genre   = detectGenre(cleanText);
  const shop    = extractShopName(cleanText, placeName);
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
