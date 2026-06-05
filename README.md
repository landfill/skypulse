# SKYPULSE

PPI(Plan Position Indicator) 레이더 스타일의 실시간 항공기·위성·지진 시각화 웹앱.

군용 레이더 감성의 원형 스캔 UI로 현재 위치 주변의 실제 데이터를 표시합니다. 모바일 브라우저에서의 사용을 주 목적으로 설계했습니다.

## 기능

- **항공기** — OpenSky Network 실시간 데이터. 방향에 따라 회전하는 항공기 아이콘 (`#00ff41`)
- **위성** — Celestrak TLE 데이터 + satellite.js로 클라이언트에서 직접 계산. sky view 투영 (중심=천정, 가장자리=지평선). 다이아몬드 아이콘 (`#00bfff`)
- **지진** — USGS Earthquake API. 규모에 비례하는 펄스 링 (`#ff4444`)
- 레이어별 on/off 토글, 탐지 반경 50/100/200km 전환
- 오브젝트 탭 시 상세 말풍선
- GPS 불가 시 서울 좌표로 자동 폴백

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속. GPS 권한 허용 시 현재 위치 기준으로 동작합니다.

## 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint 검사
```

## 기술 스택

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **HTML5 Canvas API** — 레이더 렌더링 (Three.js 미사용)
- **satellite.js** — TLE 기반 위성 위치 계산
- **date-fns** — 시각 포맷

## 데이터 소스

| 레이어 | API | 갱신 주기 |
|--------|-----|---------|
| 항공기 | [OpenSky Network](https://opensky-network.org/api/states/all) (`/api/aircraft` 프록시) | 10초 |
| 위성 | [Celestrak TLE](https://celestrak.org/NORAD/elements/gp.php?GROUP=visual) (직접 fetch) | 30초 |
| 지진 | [USGS Earthquake](https://earthquake.usgs.gov/fdsnws/event/1/query) (`/api/earthquakes` 프록시) | 60초 |

OpenSky는 익명 접근 시 rate limit이 있습니다. 서버 프록시에서 0.5° 그리드 스냅 + 10초 인메모리 캐시로 요청을 줄입니다.

## 배포

Vercel에 바로 배포 가능합니다.

```bash
npm run build
```
