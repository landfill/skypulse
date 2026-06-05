'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RadarObject, DataLayerStatus } from '@/lib/types';
import { format } from 'date-fns';

const POLL_INTERVAL = 60_000;

// USGS GeoJSON feature
interface UsgsFeature {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: {
    mag: number;
    place: string;
    time: number;
  };
}

function featureToRadarObject(f: UsgsFeature): RadarObject {
  const [lng, lat] = f.geometry.coordinates;
  const { mag, place, time } = f.properties;
  const depth = f.geometry.coordinates[2];
  const timeStr = format(new Date(time), 'MM/dd HH:mm');

  return {
    id: `eq-${f.id}`,
    lat,
    lng,
    layer: 'earthquake',
    label: `M${mag.toFixed(1)}`,
    magnitude: mag,
    detail: {
      '규모': `M${mag.toFixed(1)}`,
      '발생시각': timeStr,
      '위치': place,
      '깊이': `${depth}km`,
    },
  };
}

export function useEarthquakes(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  enabled: boolean
): { objects: RadarObject[]; status: DataLayerStatus } {
  const [objects, setObjects] = useState<RadarObject[]>([]);
  const [status, setStatus] = useState<DataLayerStatus>({ loading: false, error: null, lastUpdated: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setStatus(s => ({ ...s, loading: true }));
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const url = `/api/earthquakes?latitude=${centerLat}&longitude=${centerLng}&maxradiuskm=${radiusKm}&minmagnitude=2.0`;
      const res = await fetch(url, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const features: UsgsFeature[] = data.features ?? [];
      setObjects(features.map(featureToRadarObject));
      setStatus({ loading: false, error: null, lastUpdated: Date.now() });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '지진 데이터 오류';
      setStatus({ loading: false, error: msg, lastUpdated: null });
    }

    timerRef.current = setTimeout(fetchData, POLL_INTERVAL);
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
