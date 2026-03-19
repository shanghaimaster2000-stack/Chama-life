export type LogType = "restaurant" | "hotel" | "spot" | "work";

export type FoodGenre =
  | "ramen"
  | "sushi"
  | "yakiniku"
  | "yakitori"
  | "horumon"
  | "nabe"
  | "teppanyaki"
  | "okonomiyaki"
  | "kushikatsu"
  | "tonkatsu"
  | "curry"
  | "donburi"
  | "udon_soba"
  | "kaiseki_kappo"
  | "set_meal"
  | "izakaya"
  | "japanese"
  | "french"
  | "italian"
  | "western"
  | "chinese"
  | "thai"
  | "indian"
  | "asian_other"
  | "cafe"
  | "sweets"
  | "bakery"
  | "fast_food"
  | "other";

export type ChamaLog = {
  id: string;
  type: LogType;
  name: string;
  price: number | null;
  rating: number | null;
  comment: string;
  genre: FoodGenre | "";
  memo: string;

  lat?: number;
  lon?: number;

  country?: string
  prefecture?: string
  city?: string

  visitedAt: string;
};
