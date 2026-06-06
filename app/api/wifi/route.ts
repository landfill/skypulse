// SKYPULSE — 행안부 무료와이파이정보 프록시 (자치단체 코드 기반)

import { NextRequest, NextResponse } from "next/server";
import centroids from "@/lib/wifi-centroids.json";

const SERVICE_KEY =
  "kkczjLCsRv2RjL0OJxGRL8DNHJ6BCI8rzOzhv8M8OkL2MEwTfr5R70i1YCy7fMhmRTVvm9AovF+mqZjV/B6CMA==";
const BASE_URL = "https://apis.data.go.kr/1741000/free_wifi_info/info";

type CentroidEntry = { name: string; code: string; lat: number; lng: number };

// 위경도 → 가장 가까운 자치단체 코드 (Euclidean 근사)
function nearestCode(lat: number, lng: number): CentroidEntry {
  let best = centroids[0] as CentroidEntry;
  let minDist = Infinity;
  for (const entry of centroids as CentroidEntry[]) {
    const d = (lat - entry.lat) ** 2 + (lng - entry.lng) ** 2;
    if (d < minDist) { minDist = d; best = entry; }
  }
  return best;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "37.5665");
  const lng = parseFloat(sp.get("lng") ?? "126.9780");

  const { code, name } = nearestCode(lat, lng);

  try {
    const pages = [1, 2];
    const responses = await Promise.all(
      pages.map((pageNo) => {
        const url = new URL(BASE_URL);
        url.searchParams.set("serviceKey", SERVICE_KEY);
        url.searchParams.set("pageNo", String(pageNo));
        url.searchParams.set("numOfRows", "100");
        url.searchParams.set("returnType", "json");
        url.searchParams.set("cond[OPN_ATMY_GRP_CD::EQ]", code);
        return fetch(url.toString(), {
          signal: AbortSignal.timeout(10_000),
          next: { revalidate: 21600 },
        });
      })
    );

    const items: unknown[] = [];
    let totalCount = 0;

    for (const res of responses) {
      if (!res.ok) {
        return NextResponse.json(
          { error: `API ${res.status}`, items: [] },
          { status: res.status }
        );
      }
      const data = await res.json();
      const body = data?.response?.body;
      if (!totalCount) totalCount = body?.totalCount ?? 0;
      const raw = body?.items?.item;
      if (Array.isArray(raw)) items.push(...raw);
      else if (raw) items.push(raw);
    }

    return NextResponse.json(
      { items, region: name, code, totalCount },
      { headers: { "Cache-Control": "public, s-maxage=21600" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch 실패";
    return NextResponse.json({ error: msg, items: [] }, { status: 503 });
  }
}
