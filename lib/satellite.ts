// SKYPULSE — satellite.js TLE 계산 래퍼

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
  degreesLat,
  degreesLong,
  degreesToRadians,
} from 'satellite.js';

export interface SatelliteInfo {
  id: string;
  name: string;
  lat: number;       // 지표 직하점 위도
  lng: number;       // 지표 직하점 경도
  altKm: number;
  speedKms: number;  // 속도 km/s
  azimuthDeg: number;   // 관측자 기준 방위각 (도, 0=북)
  elevationDeg: number; // 관측자 기준 고도각 (도, 0=지평선 90=천정)
  rangeKm: number;      // 관측자까지 직선거리 (km)
}

export interface TleEntry {
  name: string;
  tle1: string;
  tle2: string;
}

/**
 * Celestrak TLE 텍스트 파싱 (3-line 포맷)
 */
export function parseTleText(text: string): TleEntry[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: TleEntry[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].replace(/^0 /, '').trim();
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    if (tle1.startsWith('1 ') && tle2.startsWith('2 ')) {
      entries.push({ name, tle1, tle2 });
    }
  }
  return entries;
}

/**
 * TLE → 현재 시각 기준 위치/속도 + 관측자 기준 방위각/고도각 계산
 * 실패 시 null 반환
 */
export function computePosition(
  entry: TleEntry,
  observerLat: number,  // 도
  observerLng: number,  // 도
  observerAltKm = 0,
  date: Date = new Date()
): SatelliteInfo | null {
  try {
    const satrec = twoline2satrec(entry.tle1, entry.tle2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = propagate(satrec, date);
    if (!result || !result.position || result.position === false) return null;

    const gmst = gstime(date);

    // 지표 직하점
    const geo = eciToGeodetic(result.position, gmst);
    const lat = degreesLat(geo.latitude);
    const lng = degreesLong(geo.longitude);
    const altKm = geo.height;

    // 속도 (km/s)
    let speedKms = 0;
    if (result.velocity && result.velocity !== false) {
      const { x, y, z } = result.velocity as { x: number; y: number; z: number };
      speedKms = Math.sqrt(x * x + y * y + z * z);
    }

    // 관측자 기준 방위각/고도각
    const observerGd = {
      longitude: degreesToRadians(observerLng),
      latitude: degreesToRadians(observerLat),
      height: observerAltKm,
    };
    const satEcf = eciToEcf(result.position, gmst);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lookAngles: any = ecfToLookAngles(observerGd, satEcf);

    const azimuthDeg = (lookAngles.azimuth * 180) / Math.PI;
    const elevationDeg = (lookAngles.elevation * 180) / Math.PI;
    const rangeKm = lookAngles.rangeSat;

    return {
      id: entry.tle1.slice(2, 7).trim(),
      name: entry.name,
      lat,
      lng,
      altKm,
      speedKms,
      azimuthDeg,
      elevationDeg,
      rangeKm,
    };
  } catch {
    return null;
  }
}
