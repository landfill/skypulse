'use client';

import { useState, useCallback, useRef } from 'react';
import RadarCanvas from '@/components/RadarCanvas';
import RadarHUD from '@/components/RadarHUD';
import LayerControls from '@/components/LayerControls';
import ObjectTooltip from '@/components/ObjectTooltip';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAircraft } from '@/hooks/useAircraft';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useSatellites } from '@/hooks/useSatellites';
import type { LayerVisibility, RadiusKm, RadarObject, CanvasPoint } from '@/lib/types';

export default function HomePage() {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    aircraft: true,
    satellite: true,
    earthquake: true,
  });
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(50);
  const [tooltip, setTooltip] = useState<{
    obj: RadarObject;
    x: number;
    y: number;
  } | null>(null);
  const [canvasSize, setCanvasSize] = useState(300);
  const pointsRef = useRef<CanvasPoint[]>([]);

  const location = useGeolocation();
  const { objects: aircraft, status: acStatus } = useAircraft(
    location.lat, location.lng, radiusKm, visibility.aircraft
  );
  const { objects: earthquakes, status: eqStatus } = useEarthquakes(
    location.lat, location.lng, radiusKm, visibility.earthquake
  );
  const { objects: satellites, status: satStatus } = useSatellites(
    location.lat, location.lng, radiusKm, visibility.satellite
  );

  const allObjects: RadarObject[] = [
    ...(visibility.aircraft ? aircraft : []),
    ...(visibility.satellite ? satellites : []),
    ...(visibility.earthquake ? earthquakes : []),
  ];

  const handleToggle = (layer: keyof LayerVisibility) => {
    setVisibility(v => ({ ...v, [layer]: !v[layer] }));
  };

  const handlePointsUpdate = useCallback((pts: CanvasPoint[]) => {
    pointsRef.current = pts;
    // 캔버스 크기 추론 (첫 렌더 후 안정화됨)
    if (pts.length > 0) return;
    const el = document.querySelector('canvas');
    if (el) setCanvasSize(parseInt(el.style.width ?? '300'));
  }, []);

  // 캔버스 크기 업데이트
  const updateCanvasSize = useCallback(() => {
    const el = document.querySelector('canvas');
    if (el) setCanvasSize(parseInt(el.style.width ?? '300'));
  }, []);

  const handleTap = useCallback((x: number, y: number) => {
    // 캔버스 크기 갱신
    updateCanvasSize();

    const pts = pointsRef.current;
    if (pts.length === 0) {
      setTooltip(null);
      return;
    }

    // 가장 가까운 포인트 찾기 (히트 반경 20px)
    const HIT_RADIUS = 20;
    let closest: CanvasPoint | null = null;
    let minDist = HIT_RADIUS;

    for (const pt of pts) {
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }

    if (closest) {
      setTooltip({ obj: closest.obj, x: closest.x, y: closest.y });
    } else {
      setTooltip(null);
    }
  }, [updateCanvasSize]);

  return (
    <main className="flex items-center justify-center w-full h-full bg-black select-none overflow-hidden">
      {/* 레이더 영역 (relative) */}
      <div className="relative flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
        <RadarCanvas
          centerLat={location.lat}
          centerLng={location.lng}
          radiusKm={radiusKm}
          objects={allObjects}
          onPointsUpdate={handlePointsUpdate}
          onTap={handleTap}
        />

        <RadarHUD
          location={location}
          objectCount={allObjects.length}
          aircraftStatus={acStatus}
          satelliteStatus={satStatus}
          earthquakeStatus={eqStatus}
          radiusKm={radiusKm}
        />

        <LayerControls
          visibility={visibility}
          onToggle={handleToggle}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
        />

        {/* 말풍선 */}
        {tooltip && (
          <ObjectTooltip
            obj={tooltip.obj}
            x={tooltip.x}
            y={tooltip.y}
            canvasSize={canvasSize}
            onClose={() => setTooltip(null)}
          />
        )}
      </div>
    </main>
  );
}
