/**
 * app/api/location-search/route.ts
 * Yahoo!ローカルサーチAPIを安全に呼び出すサーバーレス関数
 * クライアントIDはサーバー側で管理してブラウザに露出しない
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://map.yahooapis.jp/search/local/V1/localSearch?appid=${clientId}&query=${encodedQuery}&results=5&output=json&detail=simple`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.Feature || data.Feature.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    // レスポンスを整形
    const candidates = data.Feature.map((f: any) => {
      const geo = f.Geometry?.Coordinates?.split(",") || [];
      const lon = parseFloat(geo[0]);
      const lat = parseFloat(geo[1]);
      const property = f.Property || {};

      // 住所を整形
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

    return NextResponse.json({ candidates });

  } catch (e) {
    console.error("Yahoo API error:", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
