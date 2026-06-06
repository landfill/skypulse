// SKYPULSE — 행안부 무료와이파이정보 프록시

import { NextRequest, NextResponse } from "next/server";

const SERVICE_KEY =
  "kkczjLCsRv2RjL0OJxGRL8DNHJ6BCI8rzOzhv8M8OkL2MEwTfr5R70i1YCy7fMhmRTVvm9AovF+mqZjV/B6CMA==";
const BASE_URL = "https://apis.data.go.kr/1741000/free_wifi_info";

// 위경도 → 지역명 매핑 (LCTN_ROAD_NM_ADDR LIKE 필터용)
function getRegionName(lat: number, lng: number): string {
  if (lat > 37.4 && lat < 37.7 && lng > 126.7 && lng < 127.2) return "서울특별시";
  if (lat > 35.0 && lat < 35.4 && lng > 128.7 && lng < 129.4) return "부산광역시";
  if (lat > 35.7 && lat < 36.1 && lng > 128.4 && lng < 128.8) return "대구광역시";
  if (lat > 37.2 && lat < 37.6 && lng > 126.3 && lng < 126.8) return "인천광역시";
  if (lat > 35.0 && lat < 35.3 && lng > 126.7 && lng < 127.0) return "광주광역시";
  if (lat > 36.2 && lat < 36.5 && lng > 127.2 && lng < 127.6) return "대전광역시";
  if (lat > 35.4 && lat < 35.7 && lng > 129.0 && lng < 129.5) return "울산광역시";
  if (lat > 36.4 && lat < 36.6 && lng > 127.2 && lng < 127.5) return "세종특별자치시";
  if (lat > 33.1 && lat < 33.6 && lng > 126.1 && lng < 127.0) return "제주";
  // 경기 주요 도시
  if (lat > 37.2 && lat < 37.35 && lng > 127.0 && lng < 127.1) return "수원시";
  if (lat > 37.4 && lat < 37.5 && lng > 127.1 && lng < 127.2) return "성남시";
  if (lat > 37.6 && lat < 37.75 && lng > 126.8 && lng < 126.95) return "고양시";
  if (lat > 37.47 && lat < 37.54 && lng > 126.73 && lng < 126.82) return "부천시";
  if (lat > 37.6 && lat < 37.72 && lng > 127.15 && lng < 127.25) return "남양주시";
  if (lat > 37.3 && lat < 37.42 && lng > 126.8 && lng < 126.9) return "안산시";
  if (lat > 36.8 && lat < 38.3 && lng > 126.4 && lng < 127.9) return "경기도";
  if (lat > 37.0 && lat < 38.7 && lng > 127.6 && lng < 129.4) return "강원";
  if (lat > 36.3 && lat < 37.2 && lng > 127.3 && lng < 128.5) return "충청북도";
  if (lat > 35.8 && lat < 37.1 && lng > 126.1 && lng < 127.6) return "충청남도";
  if (lat > 35.3 && lat < 36.2 && lng > 126.4 && lng < 127.8) return "전북특별자치도";
  if (lat > 34.1 && lat < 35.4 && lng > 125.7 && lng < 127.9) return "전라남도";
  if (lat > 35.6 && lat < 37.2 && lng > 127.8 && lng < 129.6) return "경상북도";
  if (lat > 34.6 && lat < 35.9 && lng > 127.5 && lng < 129.4) return "경상남도";
  return "서울특별시";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "37.5665");
  const lng = parseFloat(sp.get("lng") ?? "126.9780");

  const region = getRegionName(lat, lng);

  try {
    // 2페이지(200건) 병렬 요청 — 지역 내 분포 확보
    const pages = [1, 2];
    const responses = await Promise.all(
      pages.map((pageNo) => {
        const url = new URL(BASE_URL);
        url.searchParams.set("serviceKey", SERVICE_KEY);
        url.searchParams.set("pageNo", String(pageNo));
        url.searchParams.set("numOfRows", "100");
        url.searchParams.set("returnType", "json");
        url.searchParams.set("cond[LCTN_ROAD_NM_ADDR::LIKE]", region);
        return fetch(url.toString(), {
          signal: AbortSignal.timeout(10_000),
          next: { revalidate: 21600 }, // 6시간 캐시
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
      { items, region, totalCount },
      { headers: { "Cache-Control": "public, s-maxage=21600" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch 실패";
    return NextResponse.json({ error: msg, items: [] }, { status: 503 });
  }
}
