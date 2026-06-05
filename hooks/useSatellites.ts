'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RadarObject, DataLayerStatus } from '@/lib/types';
import { parseTleText, computePosition, type TleEntry } from '@/lib/satellite';

// visual 그룹 (밝은 육안 관측 위성 ~150개)
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
const TLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const RECALC_INTERVAL = 30_000;
const MIN_ELEVATION_DEG = 5; // 지평선 위 5° 이상인 위성만 표시

interface TleCache {
  entries: TleEntry[];
  fetchedAt: number;
}

let tleCache: TleCache | null = null;

async function fetchTle(): Promise<TleEntry[]> {
  const now = Date.now();
  if (tleCache && now - tleCache.fetchedAt < TLE_CACHE_TTL_MS) {
    return tleCache.entries;
  }
  const res = await fetch(TLE_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Celestrak ${res.status}`);
  const text = await res.text();
  const entries = parseTleText(text);
  tleCache = { entries, fetchedAt: now };
  return entries;
}

export function useSatellites(
  centerLat: number,
  centerLng: number,
  _radiusKm: number,  // 위성은 elevation 기반 필터이므로 radius 미사용
  enabled: boolean
): { objects: RadarObject[]; status: DataLayerStatus } {
  const [objects, setObjects] = useState<RadarObject[]>([]);
  const [status, setStatus] = useState<DataLayerStatus>({ loading: false, error: null, lastUpdated: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compute = useCallback(async () => {
    if (!enabled) return;

    setStatus(s => ({ ...s, loading: s.lastUpdated === null }));

    try {
      const entries = await fetchTle();
      const now = new Date();
      const result: RadarObject[] = [];

      for (const entry of entries) {
        const info = computePosition(entry, centerLat, centerLng, 0, now);
        if (!info) continue;
        // 고도각 5° 이상인 위성만 표시 (지평선 위 + 약간의 여유)
        if (info.elevationDeg < MIN_ELEVATION_DEG) continue;

        result.push({
          id: `sat-${info.id}`,
          lat: info.lat,
          lng: info.lng,
          layer: 'satellite',
          label: info.name,
          // sky view 투영에 사용될 az/el
          azimuthDeg: info.azimuthDeg,
          elevationDeg: info.elevationDeg,
          detail: {
            '위성명': info.name,
            '고도': `${Math.round(info.altKm)}km`,
            '속도': `${info.speedKms.toFixed(1)}km/s`,
            '고도각': `${info.elevationDeg.toFixed(1)}°`,
            '방위각': `${info.azimuthDeg.toFixed(1)}°`,
            '거리': `${Math.round(info.rangeKm)}km`,
          },
        });
      }

      setObjects(result);
      setStatus({ loading: false, error: null, lastUpdated: Date.now() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '위성 데이터 오류';
      setStatus(s => ({ ...s, loading: false, error: msg }));
    }

    timerRef.current = setTimeout(compute, RECALC_INTERVAL);
  }, [centerLat, centerLng, enabled]);

  useEffect(() => {
    if (!enabled) {
      setObjects([]);
      return;
    }
    compute();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, [compute, enabled]);

  return { objects, status };
}
