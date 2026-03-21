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

export type TravelType = "travel" | "business" | "none";

export type ScheduleLog = {
  id: string;
  title: string;
  date: string;       // "3月28日" / "明日"
  startTime: string;  // "10:00"
  endTime: string;    // "17:00" or ""
  memo: string;
  createdAt: string;
};

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

  // 旅行種別
  travelType?: TravelType;

  visitedAt: string;
};
