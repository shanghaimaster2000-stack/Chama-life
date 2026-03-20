/**
 * scheduleHandler.ts
 * 予定の音声入力解析ハンドラー
 * 例: "明日14時に歯医者" / "来週月曜日に会議"
 */

import { normalizeText } from "../normalize";

const SCHEDULE_KEYWORDS = [
  "予定", "約束", "アポ", "会議", "打ち合わせ", "ミーティング",
  "明日", "明後日", "今日", "今週", "来週", "再来週",
  "月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜",
  "午前", "午後", "時に", "時から", "時まで",
  "病院", "歯医者", "健診", "検診",
];

// 日付・時刻を表すキーワード
const DATE_KEYWORDS = [
  "今日", "明日", "明後日", "来週", "再来週", "今週",
  "月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜",
  "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日",
];

export type ScheduleResult = {
  type: "schedule";
  title: string;
  dateHint: string;   // "明日" "来週月曜" など（後でカレンダーに変換）
  timeHint: string;   // "14時" "午後3時" など
  memo: string;
};

export function isSchedule(text: string): boolean {
  return SCHEDULE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractDateHint(text: string): string {
  for (const kw of DATE_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  // "3月15日" のようなパターン
  const dateMatch = text.match(/([0-9]+月[0-9]+日)/);
  if (dateMatch) return dateMatch[1];
  return "";
}

function extractTimeHint(text: string): string {
  // "14時" "午後3時" "13時30分" パターン
  const timeMatch =
    text.match(/(?:午前|午後)?\s*([0-9]+)\s*時\s*(?:([0-9]+)\s*分)?/) ||
    text.match(/([0-9]+:[0-9]+)/);
  if (timeMatch) return timeMatch[0];
  return "";
}

function extractTitle(text: string, dateHint: string, timeHint: string): string {
  let title = text;

  // 日付・時刻・予定キーワードを除去してタイトルを抽出
  if (dateHint) title = title.replace(dateHint, "");
  if (timeHint) title = title.replace(timeHint, "");

  for (const kw of ["予定", "約束", "アポ", "に", "で", "の"]) {
    title = title.replace(kw, "");
  }

  return title.trim() || "予定";
}

export function analyzeSchedule(rawText: string): ScheduleResult {
  const normalized = normalizeText(rawText);

  const dateHint = extractDateHint(normalized);
  const timeHint = extractTimeHint(normalized);
  const title    = extractTitle(normalized, dateHint, timeHint);

  return {
    type: "schedule",
    title,
    dateHint,
    timeHint,
    memo: normalized,
  };
}
