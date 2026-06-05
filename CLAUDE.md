# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
```

테스트 프레임워크 없음 — 브라우저에서 직접 확인.

## Architecture

PPI 레이더 스타일 실시간 웹앱. 모바일 브라우저 우선.

**데이터 흐름**
- `app/page.tsx` — 최상위 상태 관리: `visibility`, `radiusKm`, `tooltip`, 포인트 좌표
- `hooks/use*.ts` — 레이어별 폴링/계산 (항공기 10초, 위성 30초, 지진 60초)
- `components/RadarCanvas.tsx` — Canvas RAF 루프. 배경·스윕·오브젝트 렌더링 후 `onPointsUpdate`로 좌표 전달
- `components/ObjectTooltip.tsx` — 탭 히트 반경 20px 이내 가장 가까운 포인트 표시

**레이어별 데이터 소스**
| 레이어 | 소스 | 방식 |
|--------|------|------|
| 항공기 | OpenSky Network | `/api/aircraft` 프록시 경유 (0.5° 그리드 스냅 캐시) |
| 위성 | Celestrak TLE + `satellite.js` | 클라이언트 계산, TLE 6시간 캐시 |
| 지진 | USGS Earthquake API | `/api/earthquakes` 프록시 경유 |

**좌표 변환 방식**
- 항공기·지진: `lib/radar.ts`의 `geoToCanvas()` — 위경도 → Canvas XY (지리 투영)
- 위성: sky view 투영 — `azimuthDeg`/`elevationDeg` 기반, elevation 90°=중심 / 0°=가장자리

**공통 타입** (`lib/types.ts`)
- `RadarObject` — 모든 레이어 오브젝트의 단일 인터페이스
- `GeoLocation.isFallback` — GPS 불가 시 서울(37.5665, 126.9780)로 폴백
- `RadiusKm` — `50 | 100 | 200` (km)

**Canvas 렌더링 주의사항**
- DPR(devicePixelRatio) 최대 2배 적용, `canvas.style.width`/`.height`와 실제 픽셀 크기 분리
- 탭 히트 판정은 `canvas.getBoundingClientRect()` 기준 CSS 좌표 사용
- `visibilitychange` 이벤트로 탭 비활성 시 RAF 정지
