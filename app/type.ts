// =============================================================================
// type.ts
// Chama Life 全型定義
//
// 設計方針:
//   - 全ての型はここに集約する（散らばらせない）
//   - ChamaLog は既存データとの後方互換を維持する
//   - VisitEvent / VisitGroup はネイティブ移行後のGPSログ用
//   - 拡張する時はここに追加するだけでOK
// =============================================================================

// -----------------------------------------------------------------------------
// ログ種別
// -----------------------------------------------------------------------------

export type LogType =
  | "restaurant"  // 🍜 食事/飲食
  | "hotel"       // 🏨 宿泊
  | "sightseeing" // 🗼 観光
  | "work"        // 💼 仕事
  | "leisure"     // 🎡 レジャー
  | "sports"      // ⚽ スポーツ
  | "watching"    // 🏟️ 観戦
  | "live"        // 🎵 ライブ
  | "hospital"    // 🏥 病院
  | "pharmacy"    // 💊 薬局
  | "shopping"    // 🛍️ 買物
  | "ceremony";   // 💐 冠婚葬祭

// -----------------------------------------------------------------------------
// ジャンル種別
// -----------------------------------------------------------------------------

export type FoodGenre =
  | "ramen" | "sushi" | "yakiniku" | "yakitori" | "horumon"
  | "nabe" | "teppanyaki" | "okonomiyaki" | "kushikatsu" | "tonkatsu"
  | "curry" | "donburi" | "udon_soba" | "kaiseki_kappo" | "set_meal"
  | "izakaya" | "japanese" | "french" | "italian" | "western"
  | "chinese" | "thai" | "indian" | "asian_other"
  | "cafe" | "sweets" | "bakery" | "fast_food" | "other";

export type HotelGenre =
  | "business_hotel" | "ryokan" | "resort" | "guesthouse"
  | "capsule" | "pension" | "other";

export type SightseeingGenre =
  | "shrine_temple" | "castle" | "museum" | "park"
  | "nature" | "onsen" | "other";

export type LeisureGenre =
  | "theme_park" | "aquarium" | "zoo" | "arcade"
  | "karaoke" | "escape_room" | "other";

export type SportsGenre =
  | "golf" | "tennis" | "gym" | "pool" | "bowling"
  | "climbing" | "ski" | "other";

export type WatchingGenre =
  | "baseball" | "soccer" | "basketball" | "sumo" | "other";

export type LiveGenre =
  | "music" | "comedy" | "theater" | "other";

// -----------------------------------------------------------------------------
// 旅行種別
// "daily"   = 日常（近所の外食・買物など）
// "travel"  = 旅行
// "business"= 仕事・出張
// "none"    = 未分類（後方互換用）
// -----------------------------------------------------------------------------

export type TravelType = "daily" | "travel" | "business" | "none";

// -----------------------------------------------------------------------------
// 予定ログ
// -----------------------------------------------------------------------------

export type ScheduleLog = {
  id: string;
  title: string;
  date: string;       // "3月28日" / "明日"
  startTime: string;  // "10:00"
  endTime: string;    // "17:00" or ""
  memo: string;
  createdAt: string;
};

// -----------------------------------------------------------------------------
// ChamaLog（メインログ）
// 既存データとの後方互換を維持しながら拡張
// -----------------------------------------------------------------------------

export type ChamaLog = {
  id: string;
  type: LogType;
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: string;
  memo: string;

  // 買物専用
  itemsBought?: string;

  // 位置情報
  lat?: number;
  lon?: number;
  country?: string;
  prefecture?: string;
  city?: string;

  // 同行者情報
  companions?: string;
  totalPeople?: number | null;

  // 旅行種別（"daily"追加、"none"は後方互換用）
  travelType?: TravelType;

  // 旅行グループ連携（VisitGroupのidを参照）
  // 将来: 同一旅行内の複数ログをグループ化する
  visitGroupId?: string;

  // 旅行グループ内での訪問順序（1始まり）
  // 将来: A市→B市→C市 の順番再生に使用
  routeOrder?: number;

  visitedAt: string; // ISO8601形式
};

// -----------------------------------------------------------------------------
// VisitEvent（将来のGPSログ用）
// ネイティブ移行後、バックグラウンドGPSで自動生成される
// ChamaLog と紐づけて「移動の事実」を記録する
//
// 使い分け:
//   GPS = 移動の事実（VisitEvent）
//   レビュー入力 = 意味づけ（ChamaLog）
// -----------------------------------------------------------------------------

export type VisitEventType =
  | "food"    // 飲食
  | "hotel"   // 宿泊
  | "spot"    // 観光・スポット
  | "work"    // 仕事
  | "move";   // 移動中（GPS通過点）

export type VisitEvent = {
  id: string;
  timestamp: string;       // ISO8601形式

  lat: number;
  lon: number;

  // 場所情報（逆ジオコーディングで自動取得）
  placeName?: string;
  city?: string;
  prefecture?: string;
  country?: string;

  eventType: VisitEventType;
  travelType: TravelType;

  // ChamaLogとの紐づけ（レビュー入力と連携）
  chamaLogId?: string;

  // 旅行グループとの紐づけ
  visitGroupId?: string;

  // グループ内での順序
  routeOrder?: number;

  // 滞在時間（分）
  stayMinutes?: number;

  // 将来拡張用（写真・音声メモなど）
  attachments?: string[];
};

// -----------------------------------------------------------------------------
// VisitGroup（旅行・外出グループ）
// 「自宅→A市→B市→自宅」を1つの外出としてまとめる
//
// 将来: 旅行ストーリー再生、移動線の連続表示に使用
// -----------------------------------------------------------------------------

export type VisitGroup = {
  id: string;
  title?: string;             // "大阪観光" など（省略可）
  type: TravelType;

  startedAt: string;          // ISO8601形式
  endedAt?: string;           // 帰宅時に自動セット

  originIsHome: boolean;      // 自宅出発かどうか
  closedByReturnHome: boolean;// 自宅帰宅で締めたかどうか

  // グループに含まれるVisitEventのid一覧（順序保証）
  eventIds: string[];

  // グループに含まれるChamaLogのid一覧
  logIds: string[];

  // 総移動距離（km）
  totalDistKm?: number;

  // 訪問した都市一覧（自動集計）
  cities?: string[];

  // 訪問した都道府県一覧（自動集計）
  prefectures?: string[];
};

// -----------------------------------------------------------------------------
// LocationCluster（地図表示用・集計済みデータ）
// useMapData.ts で生成してmap/page.tsxに渡す
// -----------------------------------------------------------------------------

export type LocationCluster = {
  lat: number;
  lon: number;
  count: number;              // 訪問回数
  logs: ChamaLog[];           // このクラスタに属するログ
  prefecture?: string;        // 都道府県
  city?: string;              // 市区町村
};

// -----------------------------------------------------------------------------
// ArcRoute（アーチ線表示用）
// 自宅 → 訪問地点 の弧を描くための3点座標
// -----------------------------------------------------------------------------

export type LatLon = [number, number]; // [lat, lon]

export type ArcRoute = {
  start: LatLon;              // 出発地（自宅）
  mid: LatLon;                // アーチの頂点（中間点）
  end: LatLon;                // 到着地
  count: number;              // 訪問回数（線の太さに反映）
  travelType: TravelType;     // 旅行種別（線の色に反映）
  distKm?: number;            // 距離（km）
};

// -----------------------------------------------------------------------------
// MapData（useMapData.ts の戻り値）
// -----------------------------------------------------------------------------

export type MapData = {
  logs: ChamaLog[];
  homeRoutes: ArcRoute[];
  clusters: LocationCluster[];
  bounds: [[number, number], [number, number]];
  totalDistKm: number;
  isLoaded: boolean;
};
