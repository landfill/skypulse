'use client';

import type { LayerVisibility, RadiusKm } from '@/lib/types';

interface LayerControlsProps {
  visibility: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility) => void;
  radiusKm: RadiusKm;
  onRadiusChange: (r: RadiusKm) => void;
}

const RADII: RadiusKm[] = [50, 100, 200];

const LAYERS: { key: keyof LayerVisibility; icon: string; label: string; color: string }[] = [
  { key: 'aircraft', icon: '✈', label: 'AIR', color: '#00ff41' },
  { key: 'satellite', icon: '🛰', label: 'SAT', color: '#00bfff' },
  { key: 'earthquake', icon: '🌍', label: 'EQ', color: '#ff4444' },
];

export default function LayerControls({
  visibility,
  onToggle,
  radiusKm,
  onRadiusChange,
}: LayerControlsProps) {
  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 items-center"
      style={{ zIndex: 40 }}
    >
      {/* 레이어 토글 버튼 */}
      {LAYERS.map(({ key, icon, label, color }) => {
        const active = visibility[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className="flex flex-col items-center font-radar"
            style={{
              width: 54,
              padding: '6px 0',
              background: active ? `${color}22` : 'rgba(0,0,0,0.6)',
              border: `1px solid ${active ? color : '#333'}`,
              borderRadius: 6,
              color: active ? color : '#444',
              fontSize: 18,
              cursor: 'pointer',
              transition: 'all 0.15s',
              textShadow: active ? `0 0 8px ${color}` : 'none',
              boxShadow: active ? `0 0 8px ${color}40` : 'none',
            }}
            aria-label={`${label} ${active ? 'off' : 'on'}`}
          >
            <span>{icon}</span>
            <span style={{ fontSize: 9, letterSpacing: '0.1em', marginTop: 2 }}>{label}</span>
          </button>
        );
      })}

      {/* 구분선 */}
      <div style={{ width: 1, height: 40, background: '#333', margin: '0 4px' }} />

      {/* 반경 토글 */}
      {RADII.map((r) => (
        <button
          key={r}
          onClick={() => onRadiusChange(r)}
          className="font-radar"
          style={{
            width: 46,
            padding: '6px 0',
            background: r === radiusKm ? 'rgba(0,255,65,0.15)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${r === radiusKm ? '#00ff41' : '#333'}`,
            borderRadius: 6,
            color: r === radiusKm ? '#00ff41' : '#444',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.05em',
          }}
          aria-label={`반경 ${r}km`}
        >
          {r}km
        </button>
      ))}
    </div>
  );
}
