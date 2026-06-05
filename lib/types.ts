// SKYPULSE — 공통 타입 정의

export interface RadarObject {
  id: string;
  lat: number;
  lng: number;
  layer: 'aircraft' | 'satellite' | 'earthquake';
  label: string;
  detail: Record<string, string | number>;
  heading?: number;      // 항공기 방향 (도)
  magnitude?: number;    // 지진 규모
  // 위성 sky view 전용 — elevation 기반 투영에 사용
  azimuthDeg?: number;   // 방위각 (0=북, 90=동)
  elevationDeg?: number; // 고도각 (0=지평선, 90=천정)
}

export interface GeoLocation {
  lat: number;
  lng: number;
  isFallback: boolean; // true = 서울 폴백
}

export type RadiusKm = 50 | 100 | 200;

export interface LayerVisibility {
  aircraft: boolean;
  satellite: boolean;
  earthquake: boolean;
}

export interface DataLayerStatus {
  loading: boolean;
  error: string | null;
  lastUpdated: number | null; // timestamp ms
}

export interface CanvasPoint {
  obj: RadarObject;
  x: number;
  y: number;
}
