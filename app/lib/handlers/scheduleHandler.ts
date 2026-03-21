/**
 * scheduleHandler.ts
 * 予定の音声入力解析ハンドラー
 *
 * 入力例:
 *   「予定 3月28日10時から ドンキホーテ彦根店で打ち合わせ」
 *   「予定 3月20日16時から17時 健康診断」
 *   「予定 明日14時から15時30分 歯医者」
 *   「予定 来週月曜10時 会議」
 */

import { normalizeText } from "../normalize";

export type ScheduleResult = {
  type: "schedule";
  title: string;
  date: string;       // "3月28日" / "明日" / "来週月曜"
  startTime: string;  // "10:00"
  endTime: string;    // "11:00" or ""
  memo: string;
};

// 相対日付キーワード
const RELATIVE_DATE_KEYWORDS = [
  "今日", "明日", "明後日", "来週", "再来週", "今週",
  "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日",
  "月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜",
  "来週月曜", "来週火曜", "来週水曜", "来週木曜", "来週金曜", "来週土曜", "来週日曜",
];

/**
 * テキストから日付を抽出
 * 例: "3月28日" / "明日" / "来週月曜"
 */
function extractDate(text: string): { date: string; cleanText: string } {
  // 絶対日付: "3月28日" / "3/28"
  const absoluteMatch = text.match(/([0-9]+)\s*月\s*([0-9]+)\s*日/);
  if (absoluteMatch) {
    const date = `${absoluteMatch[1]}月${absoluteMatch[2]}日`;
    return { date, cleanText: text.replace(absoluteMatch[0], "").trim() };
  }

  // スラッシュ形式: "3/28"
  const slashMatch = text.match(/([0-9]+)\/([0-9]+)/);
  if (slashMatch) {
    const date = `${slashMatch[1]}月${slashMatch[2]}日`;
    return { date, cleanText: text.replace(slashMatch[0], "").trim() };
  }

  // 相対日付
  for (const kw of RELATIVE_DATE_KEYWORDS) {
    if (text.includes(kw)) {
      return { date: kw, cleanText: text.replace(kw, "").trim() };
    }
  }

  return { date: "", cleanText: text };
}

/**
 * テキストから時刻を抽出
 * 例: "10時から17時" → start: "10:00", end: "17:00"
 *     "16時から17時30分" → start: "16:00", end: "17:30"
 *     "14時30分から" → start: "14:30", end: ""
 */
function extractTime(text: string): {
  startTime: string;
  endTime: string;
  cleanText: string;
} {
  // "X時Y分からA時B分" パターン
  const fullMatch = text.match(
    /([0-9]+)\s*時\s*(?:([0-9]+)\s*分)?\s*(?:から|〜|~)\s*([0-9]+)\s*時\s*(?:([0-9]+)\s*分)?/
  );
  if (fullMatch) {
    const startH = fullMatch[1].padStart(2, "0");
    const startM = (fullMatch[2] || "0").padStart(2, "0");
    const endH   = fullMatch[3].padStart(2, "0");
    const endM   = (fullMatch[4] || "0").padStart(2, "0");
    return {
      startTime: `${startH}:${startM}`,
      endTime:   `${endH}:${endM}`,
      cleanText: text.replace(fullMatch[0], "").trim(),
    };
  }

  // "X時から" のみ（終了なし）
  const startOnlyMatch = text.match(/([0-9]+)\s*時\s*(?:([0-9]+)\s*分)?\s*(?:から|〜|~)?/);
  if (startOnlyMatch) {
    const startH = startOnlyMatch[1].padStart(2, "0");
    const startM = (startOnlyMatch[2] || "0").padStart(2, "0");
    return {
      startTime: `${startH}:${startM}`,
      endTime:   "",
      cleanText: text.replace(startOnlyMatch[0], "").trim(),
    };
  }

  return { startTime: "", endTime: "", cleanText: text };
}

export function analyzeSchedule(rawText: string): ScheduleResult {
  const normalized = normalizeText(rawText);

  // 日付抽出
  const { date, cleanText: afterDate } = extractDate(normalized);

  // 時刻抽出
  const { startTime, endTime, cleanText: afterTime } = extractTime(afterDate);

  // 残りのテキストが内容（「で」「に」「の」などの助詞を除去）
  let title = afterTime
    .replace(/^[でにをはがのへと]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) title = "予定";

  // memoは整形した全情報
  const timePart = startTime
    ? (endTime ? `${startTime}〜${endTime}` : `${startTime}〜`)
    : "";

  const memoParts = [
    date     || null,
    timePart || null,
    title,
  ].filter(Boolean) as string[];

  return {
    type: "schedule",
    title,
    date,
    startTime,
    endTime,
    memo: memoParts.join(" "),
  };
}

/**
 * 相対日付を実際の日付文字列に変換する
 * 例: "明日" → "3月22日" / "来週月曜" → "3月28日"
 * カレンダーページで使用する
 */
export function resolveRelativeDate(dateStr: string): string {
  const now = new Date();

  if (dateStr === "今日") {
    return `${now.getMonth() + 1}月${now.getDate()}日`;
  }
  if (dateStr === "明日") {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  if (dateStr === "明後日") {
    const d = new Date(now); d.setDate(d.getDate() + 2);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const DOW_MAP: Record<string, number> = {
    "日曜": 0, "月曜": 1, "火曜": 2, "水曜": 3,
    "木曜": 4, "金曜": 5, "土曜": 6,
    "日曜日": 0, "月曜日": 1, "火曜日": 2, "水曜日": 3,
    "木曜日": 4, "金曜日": 5, "土曜日": 6,
  };

  // 「来週○曜」パターン
  for (const [key, dow] of Object.entries(DOW_MAP)) {
    if (dateStr.includes("来週") && dateStr.includes(key.replace("曜日", "曜"))) {
      const d = new Date(now);
      const diff = (dow - d.getDay() + 7) % 7 || 7; // 最低7日後
      d.setDate(d.getDate() + diff + 7);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    // 「今週○曜」または単独「○曜」
    if (dateStr === key || dateStr === key.replace("曜日", "曜")) {
      const d = new Date(now);
      const diff = (dow - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
  }

  // すでに「3月28日」形式なら変換不要
  return dateStr;
}
