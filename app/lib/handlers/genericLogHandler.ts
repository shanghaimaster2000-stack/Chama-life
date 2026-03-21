/**
 * genericLogHandler.ts
 * レジャー・スポーツ・観戦・ライブ・病院・薬局・買物・冠婚葬祭
 * の汎用ログ解析ハンドラー
 */

import type { LogType } from "../../type";
import { normalizeText, extractPrice, extractRating, extractComment, extractCompanions } from "../normalize";

export const LOG_TYPE_CONFIG: Record<string, {
  icon: string;
  label: string;
  nameLabel: string;
  priceLabel: string;
  hasCompanions: boolean;
  hasMemo: boolean;
  hasItems: boolean;
}> = {
  restaurant:  { icon: "🍜", label: "食事/飲食",  nameLabel: "店名",      priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  hotel:       { icon: "🏨", label: "宿泊",        nameLabel: "施設名",    priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  sightseeing: { icon: "🗼", label: "観光",        nameLabel: "施設/場所", priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  work:        { icon: "💼", label: "仕事",        nameLabel: "社名",      priceLabel: "交通費", hasCompanions: false, hasMemo: true,  hasItems: false },
  leisure:     { icon: "🎡", label: "レジャー",    nameLabel: "施設/場所", priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  sports:      { icon: "⚽", label: "スポーツ",    nameLabel: "施設/場所", priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  watching:    { icon: "🏟️", label: "観戦",        nameLabel: "施設名",    priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  live:        { icon: "🎵", label: "ライブ",      nameLabel: "施設/場所", priceLabel: "料金",   hasCompanions: true,  hasMemo: false, hasItems: false },
  hospital:    { icon: "🏥", label: "病院",        nameLabel: "施設名",    priceLabel: "料金",   hasCompanions: false, hasMemo: true,  hasItems: false },
  pharmacy:    { icon: "💊", label: "薬局",        nameLabel: "施設名",    priceLabel: "料金",   hasCompanions: false, hasMemo: true,  hasItems: false },
  shopping:    { icon: "🛍️", label: "買物",        nameLabel: "店名",      priceLabel: "支払額", hasCompanions: false, hasMemo: false, hasItems: true  },
  ceremony:    { icon: "💐", label: "冠婚葬祭",    nameLabel: "施設名",    priceLabel: "料金",   hasCompanions: true,  hasMemo: true,  hasItems: false },
  schedule:    { icon: "📅", label: "予定",        nameLabel: "タイトル",  priceLabel: "",       hasCompanions: false, hasMemo: true,  hasItems: false },
  memo:        { icon: "📝", label: "メモ",        nameLabel: "タイトル",  priceLabel: "",       hasCompanions: false, hasMemo: true,  hasItems: false },
};

export type GenericLogResult = {
  type: LogType;
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  companions: string;
  totalPeople: number | null;
  itemsBought: string;
  genre: string;
  memo: string;
};

/**
 * 買物の場合: 店名の次から価格の前までを「買った物」として抽出
 * 例: 「ドンキホーテ シャンプー プロテイン 3000円」
 *   → 店名: ドンキホーテ, 買った物: シャンプー プロテイン, 価格: 3000円
 */
function extractShoppingItems(text: string): {
  shopName: string;
  items: string;
  cleanText: string;
} {
  // 価格を除去したテキスト
  const withoutPrice = text
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/\s+/g, " ").trim();

  const parts = withoutPrice.split(" ").filter(Boolean);

  if (parts.length === 0) return { shopName: "名称未設定", items: "", cleanText: text };
  if (parts.length === 1) return { shopName: parts[0], items: "", cleanText: text };

  // 最初の単語を店名、残りを買った物とする
  const shopName = parts[0];
  const items = parts.slice(1).join(" ");

  return { shopName, items, cleanText: text };
}

export function analyzeGenericLog(rawText: string, logType: LogType): GenericLogResult {
  const normalized = normalizeText(rawText);
  const config = LOG_TYPE_CONFIG[logType];

  // 同行者抽出
  const { companions, totalPeople, cleanText: afterCompanions } = extractCompanions(normalized);

  const price  = extractPrice(afterCompanions);
  const rating = extractRating(afterCompanions);

  let name = "";
  let itemsBought = "";
  let comment = "";

  if (logType === "shopping") {
    // 買物専用解析
    const { shopName, items } = extractShoppingItems(afterCompanions);
    name = shopName;
    itemsBought = items;
    comment = ""; // 買物に感想は不要
  } else {
    // 通常解析: 最初の単語を施設名に
    let candidate = afterCompanions
      .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
      .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
      .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "")
      .replace(/\s+/g, " ").trim();

    name = candidate.split(" ")[0] || "名称未設定";
    comment = extractComment(afterCompanions, name, []);
  }

  const memoParts = [
    name,
    itemsBought   ? `買った物:${itemsBought}` : null,
    price  !== null ? `${price.toLocaleString()}円` : null,
    rating !== null ? `評価${rating}` : null,
    comment       || null,
    companions    ? `同行者:${companions}` : null,
    totalPeople  !== null ? `計${totalPeople}人` : null,
  ].filter(Boolean) as string[];

  return {
    type: logType,
    name,
    price,
    rating,
    comment,
    companions,
    totalPeople,
    itemsBought,
    genre: "other",
    memo: memoParts.join(" / "),
  };
}
