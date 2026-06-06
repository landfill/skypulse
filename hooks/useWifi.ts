'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RadarObject, DataLayerStatus } from '@/lib/types';
import { distanceKm } from '@/lib/radar';

interface WifiItem {
  MNG_NO: string;
  WGS84_LAT: string;
  WGS84_LOT: string;
  INSTL_PLC_NM: string;
  WIFI_SSID: string;
  INSTL_FCLT_SE_NM: string;
  LCTN_ROAD_NM_ADDR: string;
  SRVC_PROV_NM: string;
  INSTL_YM: string;
}

function itemToRadarObject(item: WifiItem): RadarObject | null {
  const lat = parseFloat(item.WGS84_LAT);
  const lng = parseFloat(item.WGS84_LOT);
  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    id: `wifi-${item.MNG_NO}`,
    lat,
    lng,
    layer: 'wifi',
    label: item.INSTL_PLC_NM || '공공 와이파이',
    detail: {
      'SSID': item.WIFI_SSID || '-',
      '시설': item.INSTL_FCLT_SE_NM || '-',
      '주소': item.LCTN_ROAD_NM_ADDR || '-',
      '제공': item.SRVC_PROV_NM || '-',
      '설치': item.INSTL_YM || '-',
    },
  };
}

// WiFi는 정적 데이터 — 10분 간격 폴링
const POLL_INTERVAL = 600_000;

export function useWifi(
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
      const url = `/api/wifi?lat=${centerLat}&lng=${centerLng}`;
      const res = await fetch(url, { signal: abortRef.current.signal });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const items: WifiItem[] = data.items ?? [];
      const parsed = items
        .map(itemToRadarObject)
        .filter((o): o is RadarObject => o !== null)
        .filter(o => distanceKm(centerLat, centerLng, o.lat, o.lng) <= radiusKm);

      setObjects(parsed);
      setStatus({ loading: false, error: null, lastUpdated: Date.now() });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '와이파이 데이터 오류';
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
