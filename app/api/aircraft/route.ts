// SKYPULSE — OpenSky 항공기 프록시
// 바운딩 박스를 0.5° grid로 스냅하여 캐시 히트율 향상

import { NextRequest, NextResponse } from "next/server";
import { snapBoundingBox } from "@/lib/radar";

// 간단한 서버 인메모리 캐시 (Edge Runtime 미사용 시 유효)
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10_000; // 10초

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lamin = parseFloat(sp.get("lamin") ?? "");
  const lomin = parseFloat(sp.get("lomin") ?? "");
  const lamax = parseFloat(sp.get("lamax") ?? "");
  const lomax = parseFloat(sp.get("lomax") ?? "");

  if ([lamin, lomin, lamax, lomax].some(isNaN)) {
    return NextResponse.json({ error: "lamin/lomin/lamax/lomax 필수" }, { status: 400 });
  }

  // 그리드 스냅 → 캐시 키
  const snapped = snapBoundingBox({ lamin, lomin, lamax, lomax });
  const cacheKey = `${snapped.lamin},${snapped.lomin},${snapped.lamax},${snapped.lomax}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json(hit.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const url = new URL("https://opensky-network.org/api/states/all");
  url.searchParams.set("lamin", snapped.lamin.toString());
  url.searchParams.set("lomin", snapped.lomin.toString());
  url.searchParams.set("lamax", snapped.lamax.toString());
  url.searchParams.set("lomax", snapped.lomax.toString());

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenSky ${res.status}`, states: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    cache.set(cacheKey, { data, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json(data, { headers: { "X-Cache": "MISS" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch 실패";
    return NextResponse.json({ error: msg, states: [] }, { status: 503 });
  }
}
