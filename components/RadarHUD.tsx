'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { GeoLocation, DataLayerStatus } from '@/lib/types';

interface RadarHUDProps {
  location: GeoLocation;
  objectCount: number;
  aircraftStatus: DataLayerStatus;
  satelliteStatus: DataLayerStatus;
  earthquakeStatus: DataLayerStatus;
  radiusKm: number;
}

export default function RadarHUD({
  location,
  objectCount,
  aircraftStatus,
  satelliteStatus,
  earthquakeStatus,
  radiusKm,
}: RadarHUDProps) {
  // null로 초기화하여 SSR/클라이언트 hydration 불일치 방지
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date()); // 마운트 직후 클라이언트에서만 설정
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const errors = [
    aircraftStatus.error ? `✈ ${aircraftStatus.error}` : null,
    satelliteStatus.error ? `🛰 ${satelliteStatus.error}` : null,
    earthquakeStatus.error ? `🌍 ${earthquakeStatus.error}` : null,
  ].filter(Boolean);

  return (
    <>
      {/* 좌상단: 현재 시각 */}
      <div
        className="absolute top-3 left-3 font-radar pointer-events-none"
        style={{ color: '#00ff41', textShadow: '0 0 8px #00ff41' }}
      >
        <div style={{ fontSize: 22, letterSpacing: '0.1em', fontWeight: 700 }}>
          {now ? format(now, 'HH:mm:ss') : '--:--:--'}
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
          {now ? format(now, 'yyyy-MM-dd') : '----'}
        </div>
      </div>

      {/* 우상단: 탐지 수 */}
      <div
        className="absolute top-3 right-3 text-right font-radar pointer-events-none"
        style={{ color: '#00ff41', textShadow: '0 0 8px #00ff41' }}
      >
        <div style={{ fontSize: 11, opacity: 0.7 }}>DETECTED</div>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
          {objectCount.toString().padStart(3, '0')}
        </div>
        <div style={{ fontSize: 9, opacity: 0.5 }}>R:{radiusKm}km</div>
      </div>

      {/* 좌하단: 좌표 + SCANNING */}
      <div
        className="absolute bottom-20 left-3 font-mono-radar pointer-events-none"
        style={{ color: '#00ff41' }}
      >
        <div className="blink" style={{ fontSize: 11, letterSpacing: '0.15em', marginBottom: 4 }}>
          SCANNING...
        </div>
        <div style={{ fontSize: 10, opacity: 0.8 }}>
          {location.isFallback && (
            <span style={{ color: '#ffaa00', marginRight: 4 }}>⚠ FALLBACK</span>
          )}
          <span>
            {Math.abs(location.lat).toFixed(4)}°{location.lat >= 0 ? 'N' : 'S'}{' '}
            {Math.abs(location.lng).toFixed(4)}°{location.lng >= 0 ? 'E' : 'W'}
          </span>
        </div>
      </div>

      {/* 에러 표시 (우하단) */}
      {errors.length > 0 && (
        <div
          className="absolute bottom-20 right-3 text-right font-mono-radar pointer-events-none"
          style={{ fontSize: 9, color: '#ff4444', opacity: 0.8, maxWidth: 160 }}
        >
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
    </>
  );
}
