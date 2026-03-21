/**
 * analyzeVoiceInput.ts
 * 万能音声入力解析エンジン（先頭キーワード優先方式）
 *
 * 入力ルール（最初にカテゴリーキーワードを言う）:
 *   飲食/食事/外食 → restaurantHandler
 *   宿泊/ホテル    → hotelHandler
 *   観光           → sightseeingHandler
 *   レジャー       → leisureHandler
 *   スポーツ       → sportsHandler
 *   観戦           → watchingHandler
 *   ライブ         → liveHandler
 *   病院           → hospitalHandler
 *   薬局           → pharmacyHandler
 *   買物/ショッピング → shoppingHandler
 *   冠婚葬祭/結婚式/葬式 → ceremonyHandler
 *   予定           → scheduleHandler
 *   メモ           → memoHandler
 *   仕事           → workHandler（今後実装）
 */

import { normalizeText } from "./normalize";
import { analyzeRestaurant,   type RestaurantResult  } from "./handlers/restaurantHandler";
import { analyzeHotel,        type HotelResult       } from "./handlers/hotelHandler";
import { analyzeSpot,         type SpotResult        } from "./handlers/spotHandler";
import { analyzeSchedule,     type ScheduleResult    } from "./handlers/scheduleHandler";
import { analyzeMemo,         type MemoResult        } from "./handlers/memoHandler";
import { analyzeGenericLog,   type GenericLogResult  } from "./handlers/genericLogHandler";

export type VoiceInputResult =
  | RestaurantResult
  | HotelResult
  | SpotResult
  | ScheduleResult
  | MemoResult
  | GenericLogResult
  | { type: "unknown"; memo: string };

// 先頭キーワードと種別のマッピング（順序重要: 長いキーワードを先に）
const PREFIX_MAP: { keywords: string[]; logType: string }[] = [
  { keywords: ["飲食", "食事", "外食"],                    logType: "restaurant" },
  { keywords: ["宿泊", "ホテル", "旅館"],                  logType: "hotel" },
  { keywords: ["レジャー", "遊園地", "アミューズメント"],   logType: "leisure" },
  { keywords: ["観戦"],                                     logType: "watching" },
  { keywords: ["観光", "見学", "スポット"],                 logType: "sightseeing" },
  { keywords: ["スポーツ", "ジム", "ゴルフ"],              logType: "sports" },
  { keywords: ["ライブ", "コンサート", "舞台"],            logType: "live" },
  { keywords: ["病院", "クリニック", "診察"],              logType: "hospital" },
  { keywords: ["薬局", "ドラッグストア", "調剤"],          logType: "pharmacy" },
  { keywords: ["買物", "買い物", "ショッピング"],          logType: "shopping" },
  { keywords: ["冠婚葬祭", "結婚式", "葬式", "法事"],     logType: "ceremony" },
  { keywords: ["予定", "スケジュール"],                    logType: "schedule" },
  { keywords: ["メモ", "覚えて", "備忘"],                  logType: "memo" },
  { keywords: ["仕事", "商談", "営業"],                    logType: "work" },
];

function detectPrefix(text: string): { logType: string; cleanText: string } | null {
  for (const entry of PREFIX_MAP) {
    for (const kw of entry.keywords) {
      if (text.startsWith(kw)) {
        return { logType: entry.logType, cleanText: text.slice(kw.length).trim() };
      }
      // 先頭3文字以内にキーワードがある場合も対応
      const idx = text.indexOf(kw);
      if (idx >= 0 && idx <= 3) {
        return {
          logType: entry.logType,
          cleanText: (text.slice(0, idx) + text.slice(idx + kw.length)).trim(),
        };
      }
    }
  }
  return null;
}

export function analyzeVoiceInput(
  rawText: string,
  placeName?: string
): VoiceInputResult {
  const normalized = normalizeText(rawText);
  const prefix = detectPrefix(normalized);

  if (!prefix) {
    return { type: "memo", content: normalized, memo: normalized };
  }

  switch (prefix.logType) {
    case "restaurant":  return analyzeRestaurant(prefix.cleanText, placeName);
    case "hotel":       return analyzeHotel(prefix.cleanText);
    case "sightseeing": return analyzeSpot(prefix.cleanText);
    case "schedule":    return analyzeSchedule(prefix.cleanText);
    case "memo":        return analyzeMemo(prefix.cleanText);
    case "work":        return { type: "unknown", memo: prefix.cleanText };
    // 新カテゴリーは汎用ハンドラーで処理
    default:
      return analyzeGenericLog(prefix.cleanText, prefix.logType as any);
  }
}
