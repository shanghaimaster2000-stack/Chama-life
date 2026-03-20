/**
 * analyzeVoiceInput.ts
 * 万能音声入力解析エンジン
 *
 * 音声テキストを受け取り、種別を自動判定して各ハンドラーに振り分ける。
 * 新しい種別を追加する時は:
 *   1. handlers/xxxHandler.ts を作る
 *   2. ここに isXxx と analyzeXxx をimportして追加するだけ！
 */
 
import { normalizeText } from "./normalize";
import { isRestaurant, analyzeRestaurant, type RestaurantResult } from "./handlers/restaurantHandler";
import { isHotel,      analyzeHotel,      type HotelResult      } from "./handlers/hotelHandler";
import { isSpot,       analyzeSpot,       type SpotResult        } from "./handlers/spotHandler";
import { isSchedule,   analyzeSchedule,   type ScheduleResult   } from "./handlers/scheduleHandler";
import { isMemo,       analyzeMemo,       type MemoResult        } from "./handlers/memoHandler";
 
// 解析結果の型（全種別のユニオン型）
export type VoiceInputResult =
  | RestaurantResult
  | HotelResult
  | SpotResult
  | ScheduleResult
  | MemoResult
  | { type: "unknown"; memo: string };
 
/**
 * 音声テキストを解析して種別を判定し、結果を返す
 * @param rawText 音声入力テキスト（正規化前）
 * @param placeName GPS近隣の店舗名（任意）
 */
export function analyzeVoiceInput(
  rawText: string,
  placeName?: string
): VoiceInputResult {
  const normalized = normalizeText(rawText);
 
  // 判定順序が重要: 上から優先度が高い順に判定
  // 予定は先に判定（「明日ラーメン食べる」は飲食より予定優先）
  if (isSchedule(normalized)) {
    return analyzeSchedule(rawText);
  }
 
  if (isHotel(normalized)) {
    return analyzeHotel(rawText);
  }
 
  if (isSpot(normalized)) {
    return analyzeSpot(rawText);
  }
 
  if (isRestaurant(normalized)) {
    return analyzeRestaurant(rawText, placeName);
  }
 
  if (isMemo(normalized)) {
    return analyzeMemo(rawText);
  }
 
  // どれにも当てはまらない場合はメモとして保存
  return {
    type: "unknown",
    memo: normalized,
  };
}