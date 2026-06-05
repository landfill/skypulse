// SKYPULSE — 레이더 좌표 변환 유틸

const EARTH_RADIUS_KM = 6371;

/**
 * 위경도 → Canvas XY 변환 (명세 제공 로직 기반)
 * @param targetLat  대상 위도
 * @param targetLng  대상 경도
 * @param centerLat  레이더 중심 위도
 * @param centerLng  레이더 중심 경도
 * @param radiusKm   레이더 반경 (km)
 * @param canvasRadius Canvas 반지름 (px)
 */
export function geoToCanvas(
  targetLat: number,
  targetLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  canvasRadius: number
): { x: number; y: number } {
  const dLat = ((targetLat - centerLat) * Math.PI) / 180;
  const dLng = ((targetLng - centerLng) * Math.PI) / 180;
  const dx = dLng * EARTH_RADIUS_KM * Math.cos((centerLat * Math.PI) / 180);
  const dy = dLat * EARTH_RADIUS_KM;
  const scale = canvasRadius / radiusKm;
  return {
    x: canvasRadius + dx * scale,
    y: canvasRadius - dy * scale, // Canvas Y축 반전
  };
}

/**
 * 반경 km → OpenSky 바운딩 박스
 * 간단한 위경도 오프셋 근사 (적위 보정 포함)
 */
export function radiusKmToBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): { lamin: number; lomin: number; lamax: number; lomax: number } {
  const latDelta = radiusKm / EARTH_RADIUS_KM * (180 / Math.PI);
  const lngDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos((centerLat * Math.PI) / 180)) * (180 / Math.PI);
  return {
    lamin: centerLat - latDelta,
    lomin: centerLng - lngDelta,
    lamax: centerLat + latDelta,
    lomax: centerLng + lngDelta,
  };
}

/**
 * 두 지점 간 거리 계산 (Haversine, km)
 */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 반경 내 포함 여부
 */
export function isWithinRadius(
  targetLat: number,
  targetLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number
): boolean {
  return distanceKm(centerLat, centerLng, targetLat, targetLng) <= radiusKm;
}

/**
 * 바운딩 박스를 coarse grid(0.5° 단위)로 스냅 — 프록시 캐시 키용
 */
export function snapBoundingBox(
  box: { lamin: number; lomin: number; lamax: number; lomax: number },
  gridDeg = 0.5
): { lamin: number; lomin: number; lamax: number; lomax: number } {
  const snap = (v: number) => Math.round(v / gridDeg) * gridDeg;
  return {
    lamin: snap(box.lamin),
    lomin: snap(box.lomin),
    lamax: snap(box.lamax),
    lomax: snap(box.lomax),
  };
}
