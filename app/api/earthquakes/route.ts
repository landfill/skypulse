// SKYPULSE — USGS 지진 프록시

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("latitude") ?? "37.5665";
  const lng = sp.get("longitude") ?? "126.9780";
  const radius = sp.get("maxradiuskm") ?? "500";
  const minmag = sp.get("minmagnitude") ?? "2.0";

  const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  url.searchParams.set("format", "geojson");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lng);
  url.searchParams.set("maxradiuskm", radius);
  url.searchParams.set("minmagnitude", minmag);
  url.searchParams.set("orderby", "time");
  url.searchParams.set("limit", "30");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 60 }, // Next.js fetch 캐시 60초
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `USGS API Error (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch 실패";
    return NextResponse.json({ error: msg, features: [] }, { status: 503 });
  }
}
