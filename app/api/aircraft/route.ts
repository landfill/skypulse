// SKYPULSE — OpenSky 항공기 프록시
// 바운딩 박스를 0.5° grid로 스냅하여 캐시 히트율 향상

import { NextRequest, NextResponse } from "next/server";
import { snapBoundingBox } from "@/lib/radar";

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10_000;

// OAuth2 액세스 토큰 캐시
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getBearerToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }

  const res = await fetch(
    "https://auth.opensky-network.org/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) return null;

  const json = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return tokenCache.token;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lamin = parseFloat(sp.get("lamin") ?? "");
  const lomin = parseFloat(sp.get("lomin") ?? "");
  const lamax = parseFloat(sp.get("lamax") ?? "");
  const lomax = parseFloat(sp.get("lomax") ?? "");

  if ([lamin, lomin, lamax, lomax].some(isNaN)) {
    return NextResponse.json({ error: "lamin/lomin/lamax/lomax 필수" }, { status: 400 });
  }

  const snapped = snapBoundingBox({ lamin, lomin, lamax, lomax });
  const cacheKey = `${snapped.lamin},${snapped.lomin},${snapped.lamax},${snapped.lomax}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json(hit.data, { headers: { "X-Cache": "HIT" } });
  }

  const url = new URL("https://opensky-network.org/api/states/all");
  url.searchParams.set("lamin", snapped.lamin.toString());
  url.searchParams.set("lomin", snapped.lomin.toString());
  url.searchParams.set("lamax", snapped.lamax.toString());
  url.searchParams.set("lomax", snapped.lomax.toString());

  const headers: Record<string, string> = { "Accept": "application/json" };
  try {
    const token = await getBearerToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    // 토큰 획득 실패 시 비인증으로 진행
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers,
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
