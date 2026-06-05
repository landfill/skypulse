'use client';

import type { RadarObject } from '@/lib/types';

interface ObjectTooltipProps {
  obj: RadarObject;
  x: number;
  y: number;
  canvasSize: number;
  onClose: () => void;
}

const LAYER_COLORS: Record<RadarObject['layer'], string> = {
  aircraft: '#00ff41',
  satellite: '#00bfff',
  earthquake: '#ff4444',
};

const LAYER_ICONS: Record<RadarObject['layer'], string> = {
  aircraft: '✈',
  satellite: '🛰',
  earthquake: '🌍',
};

export default function ObjectTooltip({
  obj,
  x,
  y,
  canvasSize,
  onClose,
}: ObjectTooltipProps) {
  const color = LAYER_COLORS[obj.layer];
  const icon = LAYER_ICONS[obj.layer];

  // 화면 밖 넘침 방지: 말풍선 너비/높이 추정 후 오프셋 조정
  const tipW = 180;
  const tipH = Object.keys(obj.detail).length * 22 + 40;
  const margin = 8;

  let left = x + 12;
  let top = y - 12;

  if (left + tipW > canvasSize - margin) left = x - tipW - 12;
  if (left < margin) left = margin;
  if (top + tipH > canvasSize - margin) top = canvasSize - tipH - margin;
  if (top < margin) top = margin;

  return (
    <div
      className="absolute pointer-events-auto font-mono-radar select-none"
      style={{
        left,
        top,
        width: tipW,
        background: 'rgba(0,0,0,0.88)',
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '8px 10px',
        fontSize: 12,
        color,
        boxShadow: `0 0 10px ${color}40`,
        zIndex: 50,
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {icon} {obj.label}
        </span>
        <button
          onClick={onClose}
          style={{
            color,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
          aria-label="닫기"
        >
          ×
        </button>
      </div>
      {/* 상세 정보 */}
      {Object.entries(obj.detail).map(([k, v]) => (
        <div key={k} className="flex justify-between" style={{ marginTop: 3 }}>
          <span style={{ color: `${color}99` }}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
