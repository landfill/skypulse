'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RadarObject, DataLayerStatus } from '@/lib/types';
import { radiusKmToBoundingBox } from '@/lib/radar';

// OpenSky states/all 응답 타입 (일부 필드)
interface OpenSkyState {
  0: string;   // icao24
  1: string | null; // callsign
  5: number | null; // longitude
  6: number | null; // latitude
  9: number | null; // velocity (m/s)
  10: number | null; // true_track (도)
  13: number | null; // geo_altitude (m)
}

function stateToRadarObject(state: OpenSkyState): RadarObject | null {
  const lat = state[6];
  const lng = state[5];
  if (lat === null || lng === null) return null;

  const icao = state[0] ?? 'UNKNOWN';
  const callsign = (state[1] ?? '').trim() || icao;
  const alt = state[13];
  const vel = state[9];
  const track = state[10];

  return {
    id: `ac-${icao}`,
    lat,
    lng,
    layer: 'aircraft',
    label: callsign,
    heading: track ?? 0,
    detail: {
      '콜사인': callsign,
      '고도': alt !== null ? `${Math.round(alt)}m` : '-',
      '속도': vel !== null ? `${Math.round(vel * 3.6)}km/h` : '-',
      '방향': track !== null ? `${Math.round(track)}°` : '-',
    },
  };
}

// OpenSky 익명 rate limit: 1req/30s 권장 (10s는 너무 빠름)
const POLL_INTERVAL = 30_000;
const MAX_BACKOFF = 120_000;

export function useAircraft(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  enabled: boolean
): { objects: RadarObject[]; status: DataLayerStatus } {
  const [objects, setObjects] = useState<RadarObject[]>([]);
  const [status, setStatus] = useState<DataLayerStatus>({ loading: false, error: null, lastUpdated: null });
  const backoffRef = useRef(POLL_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setStatus(s => ({ ...s, loading: true }));
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const box = radiusKmToBoundingBox(centerLat, centerLng, radiusKm);
      const url = `/api/aircraft?lamin=${box.lamin}&lomin=${box.lomin}&lamax=${box.lamax}&lomax=${box.lomax}`;
      const res = await fetch(url, { signal: abortRef.current.signal });

      if (res.status === 429) {
        // Retry-After 헤더 우선, 없으면 지수 백오프 (POLL_INTERVAL의 2배씩)
        const retryAfter = res.headers.get('Retry-After');
        backoffRef.current = retryAfter
          ? Math.min(parseInt(retryAfter) * 1000, MAX_BACKOFF)
          : Math.min(backoffRef.current * 2, MAX_BACKOFF);
        throw new Error('429 rate limit');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const states: OpenSkyState[] = data.states ?? [];
      const parsed = states.map(stateToRadarObject).filter(Boolean) as RadarObject[];

      setObjects(parsed);
      setStatus({ loading: false, error: null, lastUpdated: Date.now() });
      backoffRef.current = POLL_INTERVAL; // 성공 시 리셋
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '항공기 데이터 오류';
      setStatus({ loading: false, error: msg, lastUpdated: null });
      // 지수 백오프
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
    }

    // 다음 폴링 예약
    timerRef.current = setTimeout(fetchData, backoffRef.current);
  }, [centerLat, centerLng, radiusKm, enabled]);

  useEffect(() => {
    if (!enabled) {
      setObjects([]);
      return;
    }
    fetchData();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [fetchData, enabled]);

  return { objects, status };
}
