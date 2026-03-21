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

// 店名の終端パターン（これで終わる単語は店名として扱う）
const SHOP_SUFFIX_PATTERN = /^.+?(店|支店|本店|分店|号店|館|亭|屋|楼|苑|園|堂|庵|処|所|邸)$/;

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
 * 「一蘭阿倍野店 1800円」→「一蘭阿倍野店」
 * 「一蘭 阿倍野店 1800円」→「一蘭 阿倍野店」（2トークンが店名）
 */
function extractShopName(text: string, placeName?: string): string {
  // 辞書マッチを先に試みる
  const fromDict = normalizeShopName(text);
  if (fromDict) return fromDict;

  // 数値情報・評価・同行者を除去
  let candidate = text
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/[一二三四五六七八九十百千万〇零]+\s*円/g, "")
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "")
    .replace(/同行者.+/g, "")
    .replace(/\s+/g, " ").trim();

  // ジャンルワードをスペース区切りで除去（単独トークンのみ）
  const tokens = candidate.split(" ");
  const filteredTokens: string[] = [];
  for (const token of tokens) {
    const isGenreWord = ALL_GENRE_WORDS.includes(token);
    if (!isGenreWord) filteredTokens.push(token);
  }

  if (filteredTokens.length === 0) {
    return placeName || "名称未設定";
  }

  // 「〇〇店」「〇〇亭」などで終わるトークンが連続している場合は全部店名とみなす
  // 例: ["一蘭", "阿倍野店", "チャーシュー麺", "美味しかった"]
  //   → "一蘭 阿倍野店" が店名
  let shopTokens: string[] = [filteredTokens[0]];

  for (let i = 1; i < filteredTokens.length; i++) {
    const token = filteredTokens[i];
    // 次のトークンが「〇〇店」系のサフィックスで終わる場合は店名に追加
    if (SHOP_SUFFIX_PATTERN.test(token)) {
      shopTokens.push(token);
    } else {
      break;
    }
  }

  // ただし最初のトークン自体が「〇〇店」で終わる場合はそれだけで店名
  const shopName = shopTokens.join(" ");
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
