/**
 * normalize.ts
 * 音声入力テキストの正規化ユーティリティ
 * 新しい誤認識パターンが見つかったらここに追加するだけでOK
 */

// -----------------------------------------------
// iOS Safari / Android Chrome の誤認識パターン辞書
// 新しいパターンが見つかったらここに追加！
// -----------------------------------------------
const MISRECOGNITION_PATTERNS: [RegExp, string][] = [
  [/ご縁/g,         "円"],
  [/五円/g,         "円"],
  [/えん/g,         "円"],
  [/苑/g,           "円"],
  [/まんえん/g,     "万円"],
  [/(?<![0-9])8日/g, "評価"],  // 「28日」などは変換しない
  [/8にち/g,        "評価"],
  [/一覧/g,         "一蘭"],
  [/吉在門/g,       "吉左衛門"],
  [/きちざえもん/g, "吉左衛門"],
  [/1大門/g,        "吉左衛門"],
  [/一大門/g,       "吉左衛門"],
  [/はーぶす/gi,    "ハーブス"],
  [/harbs/gi,       "ハーブス"],
  [/いちらん/gi,    "一蘭"],
  [/スターバック(?!ス)/g, "スターバックス"],
  [/スタバックス/g,  "スターバックス"],
  [/スター バックス/g, "スターバックス"],
  [/プランニュー酒場/g, "ブランニュー酒場"],
  // 日付・曜日の誤認識パターン
  [/未週/g,   "来週"],
  [/来集/g,   "来週"],
  [/らいしゅう/g, "来週"],
  [/再来集/g, "再来週"],
  // 医療・施設名の誤認識パターン
  [/半医者/g, "歯医者"],
  [/歯医者/g, "歯医者"],  // 正規化
  // 同行者の誤認識パターン
  [/投稿者/g,   "同行者"],
  [/登校者/g,   "同行者"],
  [/同行しゃ/g, "同行者"],
  [/どうこうしゃ/g, "同行者"],
  // 商品名の誤認識パターン
  [/ピンス/g, "リンス"],
  [/びんす/g, "リンス"],
];

// -----------------------------------------------
// 店名の正規化辞書
// 新しい店名が見つかったらここに追加！
// -----------------------------------------------
export const SHOP_ALIASES: { canonical: string; aliases: string[] }[] = [
  { canonical: "ハーブス",       aliases: ["ハーブス", "HARBS", "はーぶす", "harbs"] },
  { canonical: "一蘭",           aliases: ["一蘭", "いちらん"] },
  { canonical: "スターバックス", aliases: ["スターバックス", "スタバ", "スターバック", "スタバックス", "スター バックス"] },
  { canonical: "亀寿司",         aliases: ["亀寿司", "亀寿し", "かめずし"] },
  { canonical: "ブランニュー酒場", aliases: ["ブランニュー酒場", "プランニュー酒場"] },
  { canonical: "吉左衛門",       aliases: ["吉左衛門", "1大門", "一大門", "きちざえもん", "吉在門"] },
];

/**
 * 感想キーワード（全ハンドラー共通）
 * 新しい感想表現が見つかったらここに追加！
 */
export const COMMENT_HINTS = [
  // 肯定系
  "美味しかった", "美味しい", "うまかった", "うまい", "おいしかった",
  "最高", "良かった", "また行きたい", "また来たい", "おすすめ",
  "すごかった", "きれい", "感動", "快適", "素晴らしかった",
  "コスパ良い", "コスパ最高", "安くて良い",
  // 否定系
  "残念", "微妙", "いまいち", "もう行かない", "高かった",
  "混んでた", "うるさかった", "狭かった", "汚かった",
  "値段が高い", "値段高い", "ちょっと高い", "高いな", "高いね",
  "値段ちょっと高い", "少し高い", "やや高い",
  "コスパ悪い", "コスパが悪い",
  // 普通系
  "ふつう", "普通", "まあまあ", "悪くない", "そこそこ",
];


/**
 * テキストから感想を抽出する（残余テキスト方式）
 * 評価・価格・店名・ジャンル・行動キーワード以外の残りを感想とみなす
 */
export function extractComment(
  text: string,
  shopName: string = "",
  removeWords: string[] = []
): string {
  let candidate = text;

  // 店名を除去
  if (shopName) candidate = candidate.replace(shopName, "");

  // 価格を除去
  candidate = candidate
    .replace(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\s*(円|万円)/g, "")
    .replace(/[一二三四五六七八九十百千万〇零]+\s*円/g, "");

  // 評価を除去
  candidate = candidate
    .replace(/(?:評価|ひょうか)\s*[0-9]+(?:\.[0-9]+)?/g, "")
    .replace(/[0-9]+(?:\.[0-9]+)?\s*点/g, "");

  // 行動・場所キーワードを除去
  const ACTION_WORDS = [
    "観光", "見学", "訪問", "行った", "行ってきた", "来た", "訪れた",
    "した", "してきた", "でした", "行きました",
    "チェックイン", "チェックアウト", "宿泊", "泊まった",
    "食べた", "食べてきた",
  ];
  for (const word of [...ACTION_WORDS, ...removeWords]) {
    candidate = candidate.replace(word, "");
  }

  candidate = candidate.replace(/\s+/g, " ").trim();

  // 残ったテキストが2文字以上なら感想とみなす
  return candidate.length >= 2 ? candidate : "";
}

export function normalizeText(text: string): string {
  let result = text
    .replace(/，/g, ",")
    .replace(/．/g, ".")
    .replace(/。/g, " ")
    .replace(/　/g, " ")
    .replace(/テン/g, ".")
    .replace(/てん/g, ".");

  // 誤認識パターンを修正
  for (const [pattern, replacement] of MISRECOGNITION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * 日本語の数字表現を数値に変換
 * 例: "千五百" → 1500
 */
export function parseJapaneseNumber(text: string): number | null {
  const normalized = text.replace(/,/g, "").trim();

  if (/^\d+(\.\d+)?$/.test(normalized)) return Number(normalized);

  const digitMap: Record<string, number> = {
    零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4,
    五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };

  let total = 0;
  let current = 0;

  for (const char of normalized) {
    if (char in digitMap) {
      current = digitMap[char];
    } else if (char === "十") { total += (current || 1) * 10;    current = 0; }
    else if  (char === "百") { total += (current || 1) * 100;   current = 0; }
    else if  (char === "千") { total += (current || 1) * 1000;  current = 0; }
    else if  (char === "万") { total = (total + (current || 0)) * 10000; current = 0; }
    else return null;
  }

  return total + current;
}

/**
 * テキストから価格を抽出
 * 例: "1800円" → 1800 / "1万2千円" → 12000
 */
export function extractPrice(text: string): number | null {
  // 数字+円/万円
  const numericMatch = text.match(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(万円|円)/);
  if (numericMatch) {
    const value = Number(numericMatch[1].replace(/,/g, ""));
    return numericMatch[2] === "万円" ? value * 10000 : value;
  }

  // 漢数字+円
  const japaneseMatch = text.match(/([一二三四五六七八九十百千万〇零]+)\s*円/);
  if (japaneseMatch) {
    return parseJapaneseNumber(japaneseMatch[1]);
  }

  return null;
}

/**
 * テキストから評価を抽出
 * 例: "評価3.5" → 3.5 / "4点" → 4
 */
export function extractRating(text: string): number | null {
  const match =
    text.match(/(?:評価|ひょうか)\s*([0-9]+(?:\.[0-9]+)?)/i) ||
    text.match(/([0-9]+(?:\.[0-9]+)?)\s*点/);

  if (match) return Number(match[1]);
  return null;
}

/**
 * 店名の正規化（辞書マッチ）
 */
export function normalizeShopName(text: string): string {
  for (const shop of SHOP_ALIASES) {
    if (shop.aliases.some((alias) => text.includes(alias))) {
      return shop.canonical;
    }
  }
  return "";
}

/**
 * 同行者情報を抽出する（合計人数は同行者数+自分1名で自動計算）
 *
 * パターン例:
 *   「同行者キーちゃん1名」       → companions: "キーちゃん", totalPeople: 2 (1+自分)
 *   「同行者キーちゃん家族3名」   → companions: "キーちゃん家族", totalPeople: 4 (3+自分)
 *   「同行者池ちゃん他2名」       → companions: "池ちゃん他2名", totalPeople: 4 (1+2+自分)
 *   「同行者キーちゃん計2人」     → companions: "キーちゃん", totalPeople: 2 (明示された合計)
 */
export function extractCompanions(text: string): {
  companions: string;
  totalPeople: number | null;
  cleanText: string;
} {
  // 「同行者」がなければスキップ
  if (!text.includes("同行者")) {
    return { companions: "", totalPeople: null, cleanText: text };
  }

  // パターン1: 「同行者○○計N人/名」→ 合計人数が明示されている
  const totalMatch = text.match(/同行者\s*(.+?)\s*(?:の)?計\s*([0-9]+)\s*[人名]/);
  if (totalMatch) {
    const companions = totalMatch[1].trim();
    const totalPeople = Number(totalMatch[2]);
    const cleanText = text.replace(totalMatch[0], "").trim();
    return { companions, totalPeople, cleanText };
  }

  // パターン2: 「同行者○○他N名」→ メイン1人+他N人+自分
  const otherMatch = text.match(/同行者\s*(.+?)\s*他\s*([0-9]+)\s*[人名]/);
  if (otherMatch) {
    const companions = `${otherMatch[1].trim()}他${otherMatch[2]}名`;
    const otherCount = Number(otherMatch[2]);
    const totalPeople = 1 + otherCount + 1; // メイン1人 + 他N人 + 自分
    const cleanText = text.replace(otherMatch[0], "").trim();
    return { companions, totalPeople, cleanText };
  }

  // パターン3: 「同行者○○N名/人」→ 同行者N名+自分1名
  const countMatch = text.match(/同行者\s*(.+?)\s*([0-9]+)\s*[人名]/);
  if (countMatch) {
    const companions = countMatch[1].trim();
    const companionCount = Number(countMatch[2]);
    const totalPeople = companionCount + 1; // 同行者N名 + 自分
    const cleanText = text.replace(countMatch[0], "").trim();
    return { companions, totalPeople, cleanText };
  }

  // パターン4: 人数なし「同行者キーちゃん」→ 同行者1名+自分=計2名
  const noCountMatch = text.match(/同行者\s*([^\s]+)/);
  if (noCountMatch) {
    const companions = noCountMatch[1].trim();
    const cleanText = text.replace(noCountMatch[0], "").trim();
    return { companions, totalPeople: 2, cleanText }; // 同行者1名+自分
  }

  return { companions: "", totalPeople: null, cleanText: text };
}
