'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { RadarObject, CanvasPoint } from '@/lib/types';
import { geoToCanvas } from '@/lib/radar';

interface RadarCanvasProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  objects: RadarObject[];
  onPointsUpdate: (points: CanvasPoint[]) => void;
  onTap: (x: number, y: number) => void;
}

const RADAR_COLOR = '#00ff41';
const AIRCRAFT_COLOR = '#00ff41';
const SATELLITE_COLOR = '#00bfff';
const QUAKE_COLOR = '#ff4444';
const WIFI_COLOR = '#ffaa00';
const SWEEP_PERIOD = 4000; // ms per 360°
const TRAIL_SEGMENTS = 60; // 잔광 세그먼트 수

export default function RadarCanvas({
  centerLat,
  centerLng,
  radiusKm,
  objects,
  onPointsUpdate,
  onTap,
}: RadarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const pointsRef = useRef<CanvasPoint[]>([]);

  // 캔버스 크기 계산
  const getSize = () => {
    const s = Math.min(window.innerWidth, window.innerHeight) * 0.9;
    return Math.floor(s);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, r: number) => {
    const cx = r;
    const cy = r;

    // 배경
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r * 2, r * 2);

    // 외곽 원
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.strokeStyle = RADAR_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 외곽 원 내부 클리핑 설정 (이후 렌더에서 잘라냄)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();

    // 동심원 3개 + km 라벨
    const rings = [0.25, 0.5, 0.75, 1.0];
    const ringKm = rings.map(f => Math.round(radiusKm * f));
    rings.forEach((f, i) => {
      const rr = (r - 2) * f;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = f === 1 ? RADAR_COLOR : 'rgba(0,255,65,0.25)';
      ctx.lineWidth = f === 1 ? 1.5 : 0.8;
      ctx.stroke();

      // km 라벨 (12시 방향)
      if (f < 1) {
        ctx.fillStyle = 'rgba(0,255,65,0.6)';
        ctx.font = `${Math.max(9, r * 0.025)}px var(--font-share-tech-mono, monospace)`;
        ctx.textAlign = 'center';
        ctx.fillText(`${ringKm[i]}km`, cx, cy - rr + 12);
      }
    });

    // 십자선
    ctx.beginPath();
    ctx.moveTo(cx, cy - (r - 2));
    ctx.lineTo(cx, cy + (r - 2));
    ctx.moveTo(cx - (r - 2), cy);
    ctx.lineTo(cx + (r - 2), cy);
    ctx.strokeStyle = 'rgba(0,255,65,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  };

  const drawSweep = (ctx: CanvasRenderingContext2D, r: number, angle: number) => {
    const cx = r;
    const cy = r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();

    // 잔광 그라데이션 (스윕 뒤 90도)
    const trailAngle = Math.PI / 2; // 90도 잔광
    const gradient = ctx.createConicalGradient
      ? null // 표준 미지원 — 수동 구현
      : null;

    // Canvas 표준 코닉 그라데이언트 미지원이므로 arc로 구현
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const frac = i / TRAIL_SEGMENTS;
      const a = angle - trailAngle * frac;
      const alpha = (1 - frac) * 0.35;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 2, a, a + trailAngle / TRAIL_SEGMENTS + 0.01);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,255,65,${alpha})`;
      ctx.fill();
    }

    // 스윕 라인
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 2), cy + Math.sin(angle) * (r - 2));
    ctx.strokeStyle = RADAR_COLOR;
    ctx.lineWidth = 2;
    ctx.shadowColor = RADAR_COLOR;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  const drawObjects = useCallback(
    (ctx: CanvasRenderingContext2D, r: number, sweepAngle: number) => {
      const cx = r;
      const cy = r;
      const points: CanvasPoint[] = [];

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
      ctx.clip();

      for (const obj of objects) {
        let x: number, y: number;

        if (obj.layer === 'satellite' && obj.azimuthDeg !== undefined && obj.elevationDeg !== undefined) {
          // 위성: sky view 투영 (중심=천정, 가장자리=지평선)
          // elevation 90° → 중심, 0° → 가장자리
          const radialFrac = 1 - obj.elevationDeg / 90;
          const azRad = (obj.azimuthDeg * Math.PI) / 180; // 0=북=위
          x = cx + Math.sin(azRad) * radialFrac * (r - 2);
          y = cy - Math.cos(azRad) * radialFrac * (r - 2);
        } else {
          // 항공기/지진: 지리 투영
          const pos = geoToCanvas(obj.lat, obj.lng, centerLat, centerLng, radiusKm, r);
          x = pos.x;
          y = pos.y;
          if (x < 0 || x > r * 2 || y < 0 || y > r * 2) continue;
        }

        points.push({ obj, x, y });

        // 스윕 통과 후 밝기 계산
        const objAngle = Math.atan2(y - cy, x - cx);
        let diff = sweepAngle - objAngle;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        const alpha = diff < Math.PI / 2 ? 1 : Math.max(0.3, 1 - (diff - Math.PI / 2) / (Math.PI * 1.5));

        if (obj.layer === 'aircraft') {
          drawAircraft(ctx, x, y, obj.heading ?? 0, alpha);
        } else if (obj.layer === 'satellite') {
          drawSatellite(ctx, x, y, alpha);
        } else if (obj.layer === 'earthquake') {
          drawEarthquake(ctx, x, y, obj.magnitude ?? 2, alpha);
        } else if (obj.layer === 'wifi') {
          drawWifi(ctx, x, y, alpha);
        }
      }

      ctx.restore();
      return points;
    },
    [objects, centerLat, centerLng, radiusKm]
  );

  const drawAircraft = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    headingDeg: number,
    alpha: number
  ) => {
    const s = 9;
    const rad = ((headingDeg - 90) * Math.PI) / 180;
    const color = `rgba(0,255,65,${alpha})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.fillStyle = color;
    ctx.shadowColor = AIRCRAFT_COLOR;
    ctx.shadowBlur = 5;

    // 동체 (가늘고 긴 방추형)
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.15, -s * 0.5, s * 0.15, s * 0.35, 0, s * 0.65);
    ctx.bezierCurveTo(-s * 0.15, s * 0.35, -s * 0.15, -s * 0.5, 0, -s);
    ctx.fill();

    // 오른쪽 주익 (후퇴익)
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.05);
    ctx.lineTo(s * 1.1, s * 0.28);
    ctx.lineTo(s * 0.5, s * 0.45);
    ctx.lineTo(s * 0.13, s * 0.18);
    ctx.closePath();
    ctx.fill();

    // 왼쪽 주익
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.05);
    ctx.lineTo(-s * 1.1, s * 0.28);
    ctx.lineTo(-s * 0.5, s * 0.45);
    ctx.lineTo(-s * 0.13, s * 0.18);
    ctx.closePath();
    ctx.fill();

    // 오른쪽 수평꼬리날개 (작음)
    ctx.beginPath();
    ctx.moveTo(s * 0.12, s * 0.38);
    ctx.lineTo(s * 0.46, s * 0.62);
    ctx.lineTo(s * 0.12, s * 0.65);
    ctx.closePath();
    ctx.fill();

    // 왼쪽 수평꼬리날개
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.38);
    ctx.lineTo(-s * 0.46, s * 0.62);
    ctx.lineTo(-s * 0.12, s * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawSatellite = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number
  ) => {
    const size = 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);

    // 외곽 글로우 링
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,191,255,${alpha * 0.25})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 다이아몬드 본체
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(0,191,255,${alpha})`;
    ctx.shadowColor = SATELLITE_COLOR;
    ctx.shadowBlur = 10;
    ctx.fill();

    // 중심 하이라이트
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,240,255,${alpha * 0.9})`;
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();
  };

  const drawEarthquake = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    magnitude: number,
    alpha: number
  ) => {
    const baseSize = Math.max(4, magnitude * 2.5);
    ctx.save();
    ctx.translate(x, y);

    // 펄스 링 (규모에 비례)
    const now = performance.now();
    const pulseFrac = ((now % 2000) / 2000); // 2초 주기
    const pulseR = baseSize * (1 + pulseFrac * 1.5);
    const pulseAlpha = (1 - pulseFrac) * 0.6 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,68,68,${pulseAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 중심 원
    ctx.beginPath();
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,68,68,${alpha})`;
    ctx.shadowColor = QUAKE_COLOR;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  };

  const drawWifi = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number
  ) => {
    const color = `rgba(255,170,0,${alpha})`;
    ctx.save();
    ctx.translate(x, y);

    // 3단 호 (225°→315°, 위쪽 방향 WiFi 신호 아이콘)
    const start = (Math.PI * 5) / 4;
    const end = (Math.PI * 7) / 4;
    ctx.shadowColor = WIFI_COLOR;
    ctx.shadowBlur = 5;
    [3.5, 6, 8.5].forEach((r) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, start, end, false);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 중심 점
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // 메인 RAF 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animating = true;

    const resize = () => {
      const size = getSize();
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      if (!animating) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = parseInt(canvas.style.width ?? '300');
      const r = size / 2;
      const elapsed = now - startTimeRef.current;
      const angle = ((elapsed % SWEEP_PERIOD) / SWEEP_PERIOD) * Math.PI * 2 - Math.PI / 2;

      drawBackground(ctx, r);
      drawSweep(ctx, r, angle);
      const pts = drawObjects(ctx, r, angle);

      // 포인트 업데이트 (변경 시에만)
      if (JSON.stringify(pts.map(p => p.obj.id)) !== JSON.stringify(pointsRef.current.map(p => p.obj.id))) {
        pointsRef.current = pts;
        onPointsUpdate(pts);
      } else {
        // x,y 좌표는 항상 업데이트 (렌더 크기 변경 가능)
        pointsRef.current = pts;
        onPointsUpdate(pts);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // visibility 변경 시 RAF 일시정지
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        animating = false;
      } else {
        animating = true;
        startTimeRef.current = performance.now() - ((Date.now() % SWEEP_PERIOD) / SWEEP_PERIOD) * SWEEP_PERIOD;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [drawObjects, onPointsUpdate]);

  // 탭/클릭 핸들러
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onTap(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      className="touch-none"
      onPointerDown={handlePointerDown}
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  );
}

// Canvas conical gradient polyfill 타입 확장
declare global {
  interface CanvasRenderingContext2D {
    createConicalGradient?: (angle: number, x: number, y: number) => CanvasGradient;
  }
}
