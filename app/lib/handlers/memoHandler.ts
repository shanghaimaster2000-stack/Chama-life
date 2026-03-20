/**
 * memoHandler.ts
 * メモの音声入力解析ハンドラー
 * 他のどの種別にも当てはまらなかった場合のフォールバック
 */

import { normalizeText } from "../normalize";

const MEMO_KEYWORDS = [
  "メモ", "覚えておいて", "忘れずに", "記録", "備忘", "ノート",
  "買い物", "買う", "購入", "ToDo", "todo", "やること", "やらないと",
];

export type MemoResult = {
  type: "memo";
  content: string;
  memo: string;
};

export function isMemo(text: string): boolean {
  return MEMO_KEYWORDS.some((kw) => text.includes(kw));
}

export function analyzeMemo(rawText: string): MemoResult {
  const normalized = normalizeText(rawText);

  // "メモ:" や "覚えておいて:" などのプレフィックスを除去
  let content = normalized;
  for (const kw of MEMO_KEYWORDS) {
    content = content.replace(kw, "").trim();
  }
  content = content.replace(/^[：:]\s*/, "").trim() || normalized;

  return {
    type: "memo",
    content,
    memo: normalized,
  };
}
