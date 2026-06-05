# RADAR UI — Claude Code 작업 명세서

## 프로젝트 개요

PPI(Plan Position Indicator) 스타일의 레이더 UI 웹앱.
SF/잠수함 영화에서 보이는 원형 스캔 레이더를 모티프로, 실제 실시간 데이터를 시각화.
모바일 브라우저(핸드폰)에서 사용하는 것이 주 목적.

---

## 기술 스택

- **프레임워크**: Next.js (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **캔버스 렌더링**: HTML5 Canvas API (레이더 UI)
- **배포**: Vercel

---

## 데이터 소스 (3개 레이어)

### 1. 항공기 — OpenSky Network
- **API**: `https://opensky-network.org/api/states/all`
- **인증**: 불필요 (익명 사용 가능, rate limit 있음)
- **파라미터**: `lamin`, `lomin`, `lamax`, `lomax` (위경도 바운딩 박스)
- **서울 기준 박스**: `lamin=37.4&lomin=126.7&lamax=37.7&lomax=127.3`
- **주요 필드**:
  - `icao24` — 고유 ID
  - `callsign` — 콜사인
  - `longitude`, `latitude` — 위치
  - `velocity` — 속도 (m/s)
  - `true_track` — 방향 (도)
  - `geo_altitude` — 고도 (m)
- **갱신 주기**: 10초 권장 (rate limit 고려)
- **CORS**: 직접 fetch 가능

### 2. 위성 — Celestrak
- **API**: `https://celestrak.org/SOCRATES/query.php` 또는 TLE 데이터
- **더 간단한 방법**: `https://api.n2yo.com/rest/v1/satellite/above/{lat}/{lng}/{alt}/{radius}/{category_id}`
  - N2YO는 API 키 필요 (무료 발급, [n2yo.com](https://www.n2yo.com/api/))
- **또는 Celestrak TLE + satellite.js 라이브러리로 클라이언트 계산**
  - TLE 데이터: `https://celestrak.org/SOCRATES/` 또는 `https://celestrak.org/NORAD/elements/stations.txt`
  - `satellite.js` npm 패키지로 현재 위치 계산
  - API 키 불필요
- **권장**: Celestrak TLE + satellite.js (API 키 없음, 클라이언트 계산)
- **갱신 주기**: 30초 (위성 이동 반영)

### 3. 지진 — USGS Earthquake
- **API**: `https://earthquake.usgs.gov/fdsnws/event/1/query`
- **인증**: 불필요
- **파라미터 예시**:
  ```
  format=geojson
  latitude=37.5665
  longitude=126.9780
  maxradiuskm=500
  minmagnitude=2.0
  orderby=time
  limit=20
  ```
- **주요 필드**:
  - `mag` — 규모
  - `place` — 위치명
  - `time` — 발생시각
  - `coordinates` — [경도, 위도, 깊이]
- **특성**: 실시간 이벤트성. 평상시엔 점이 적고 지진 발생시 나타남
- **갱신 주기**: 60초
- **CORS**: 직접 fetch 가능

---

## 레이더 UI 명세

### 기본 구조
- 전체 화면을 꽉 채우는 원형 레이더 (`viewport 기준 min(vw, vh) * 0.9`)
- 중앙 = 현재 내 위치 (`navigator.geolocation`)
- 반경 = 설정 가능 (기본 50km, 100km, 200km 토글)

### 레이더 요소
```
- 동심원: 3~4개 (거리 눈금)
- 십자선: 중앙 기준 수평/수직
- 스윕 라인: 회전하는 스캔 선 (360도, 4초 1회전)
- 잔광(Trail): 스윕이 지나간 자리에 fade-out 효과
- 격자 색상: 녹색 (#00ff41) — 군용 레이더 감성
  또는 청록색 (#00ffff) — SF 감성
  (다크 배경 필수)
```

### 데이터 포인트 표현
| 레이어 | 색상 | 모양 | 애니메이션 |
|--------|------|------|-----------|
| 항공기 | 밝은 초록 `#00ff41` | 삼각형 (방향 표시) | 실제 이동 |
| 위성 | 하늘색 `#00bfff` | 다이아몬드 ◆ | 실제 이동 |
| 지진 | 빨간색 `#ff4444` | 원 + 펄스 링 | 규모에 따라 크기 변화 |

### 호버/탭 인터랙션
- 점 탭시 말풍선 표시
  - 항공기: 콜사인, 고도, 속도, 방향
  - 위성: 위성명, 고도, 속도
  - 지진: 규모, 발생시각, 위치명

### 레이어 토글
- 화면 하단 또는 우측에 3개 버튼
  - ✈ 항공기 on/off
  - 🛰 위성 on/off
  - 🌍 지진 on/off

### 기타 UI 요소
- 좌상단: 현재 시각 (디지털 폰트)
- 우상단: 탐지된 오브젝트 수 카운트
- 좌하단: 현재 위치 좌표
- 스캔 중 표시: "SCANNING..." 텍스트 깜빡임

---

## 프로젝트 구조

```
radar-app/
├── app/
│   ├── page.tsx              # 메인 페이지
│   ├── layout.tsx
│   └── api/
│       ├── aircraft/route.ts # OpenSky proxy (CORS 우회용)
│       └── earthquakes/route.ts # USGS proxy
├── components/
│   ├── RadarCanvas.tsx       # Canvas 레이더 렌더러
│   ├── RadarHUD.tsx          # 오버레이 UI (시각, 카운트 등)
│   └── LayerControls.tsx     # 레이어 토글 버튼
├── hooks/
│   ├── useGeolocation.ts     # 내 위치
│   ├── useAircraft.ts        # OpenSky 폴링
│   ├── useSatellites.ts      # Celestrak TLE + satellite.js
│   └── useEarthquakes.ts     # USGS 폴링
├── lib/
│   ├── radar.ts              # 위경도 → Canvas 좌표 변환
│   ├── satellite.ts          # TLE 계산 래퍼
│   └── types.ts              # 공통 타입 정의
└── public/
```

---

## 공통 타입 정의 (참고)

```typescript
interface RadarObject {
  id: string;
  lat: number;
  lng: number;
  layer: 'aircraft' | 'satellite' | 'earthquake';
  label: string;
  detail: Record<string, string | number>;
  heading?: number;    // 항공기/위성 방향
  magnitude?: number;  // 지진 규모
}
```

---

## 좌표 변환 핵심 로직

```typescript
// 위경도 → Canvas XY 변환
function geoToCanvas(
  targetLat: number,
  targetLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  canvasRadius: number
): { x: number; y: number } {
  const R = 6371;
  const dLat = ((targetLat - centerLat) * Math.PI) / 180;
  const dLng = ((targetLng - centerLng) * Math.PI) / 180;
  const dx = dLng * R * Math.cos((centerLat * Math.PI) / 180);
  const dy = dLat * R;
  const scale = canvasRadius / radiusKm;
  return {
    x: canvasRadius + dx * scale,
    y: canvasRadius - dy * scale, // Canvas Y축 반전
  };
}
```

---

## API Route 필요 여부

| API | 직접 fetch | Proxy 필요 |
|-----|-----------|-----------|
| OpenSky | ✅ 직접 가능 | 선택적 (rate limit 우회용) |
| Celestrak TLE | ✅ 직접 가능 | 불필요 |
| USGS | ✅ 직접 가능 | 불필요 |

---

## 작업 순서 권장

1. `RadarCanvas.tsx` — 레이더 배경 (동심원, 스윕 애니메이션)
2. `useGeolocation.ts` — 내 위치
3. `useAircraft.ts` + 항공기 점 렌더링
4. `useEarthquakes.ts` + 지진 점 렌더링
5. `useSatellites.ts` + 위성 점 렌더링 (satellite.js 연동)
6. 탭 인터랙션 (말풍선)
7. 레이어 토글
8. HUD 요소 (시각, 카운트, 좌표)
9. 모바일 최적화 (터치, viewport)
10. Vercel 배포

---

## 참고 라이브러리

- `satellite.js` — TLE 기반 위성 위치 계산
- `date-fns` — 시각 포맷
- Canvas API 직접 사용 (Three.js 불필요)
