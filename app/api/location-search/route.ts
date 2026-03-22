/**
 * app/api/location-search/route.ts
 * Yahoo!ローカルサーチAPIを安全に呼び出すサーバーレス関数
 * クライアントIDはサーバー側で管理してブラウザに露出しない
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  const lat   = req.nextUrl.searchParams.get("lat");
  const lon   = req.nextUrl.searchParams.get("lon");

  console.log("[location-search] query:", query, "lat:", lat, "lon:", lon);

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  console.log("[location-search] clientId exists:", !!clientId);

  if (!clientId) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // 末尾の「店」を除去して検索精度UP（例: "一蘭 阿倍野店" → "一蘭 阿倍野"）
    const cleanQuery = query.replace(/　/g, " ").replace(/\s+/g, " ").trim().replace(/店$/, "");
    const encodedQuery = encodeURIComponent(cleanQuery);

    // 緯度経度はgcパラメータで渡す（distは使わない）
    // gc=lon,lat の順番で渡すのがYahoo!ローカルサーチの仕様
    const geoParam = lat && lon ? `&gc=${lon}%2C${lat}` : "";

    const url = `https://map.yahooapis.jp/search/local/V1/localSearch?appid=${clientId}&query=${encodedQuery}&results=5&output=json&detail=simple${geoParam}`;

    console.log("[location-search] request URL:", url);

    const res = await fetch(url);
    console.log("[location-search] response status:", res.status);

    const text = await res.text();
    console.log("[location-search] raw response:", text.slice(0, 500));

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[location-search] JSON parse error:", text.slice(0, 200));
      return NextResponse.json({ error: "Invalid API response" }, { status: 500 });
    }

    console.log("[location-search] Feature count:", data.Feature?.length ?? 0);

    if (!data.Feature || data.Feature.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    const candidates = data.Feature.map((f: any) => {
      const geo = f.Geometry?.Coordinates?.split(",") || [];
      const lon = parseFloat(geo[0]);
      const lat = parseFloat(geo[1]);
      const property = f.Property || {};

      const address = [
        property.Country?.Name,
        property.Address,
      ].filter(Boolean).join(" ") || f.Name;

      return {
        lat,
        lon,
        address: `${f.Name}（${address}）`,
        name: f.Name,
      };
    }).filter((c: any) => c.lat && c.lon);

    console.log("[location-search] candidates:", candidates);

    return NextResponse.json({ candidates });

  } catch (e) {
    console.error("[location-search] fetch error:", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
