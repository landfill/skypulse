# SKYPULSE

PPI(Plan Position Indicator) 레이더 스타일의 실시간 다중 레이어 시각화 웹앱.

군용 레이더 감성의 원형 스캔 UI로 현재 위치 주변의 실제 데이터를 표시합니다. 모바일 브라우저에서의 사용을 주 목적으로 설계했습니다.

🌐 **배포:** https://skypulse-lemon.vercel.app

## 기능

- **공공 와이파이** — 공공데이터포털 API. 구단위 범위 자치단체 코드 기반 조회. 황색 점 아이콘 (`#ffaa00`)
- **항공기** — OpenSky Network 실시간 데이터 (OAuth2 인증). 방향에 따라 회전하는 아이콘 (`#00ff41`) — **로컬 전용**
- **위성** — Celestrak TLE 데이터 + satellite.js로 클라이언트 직접 계산. sky view 투영 (중심=천정, 가장자리=지평선). 다이아몬드 아이콘 (`#00bfff`)
- **지진** — USGS Earthquake API. 규모에 비례하는 펄스 링 (`#ff4444`)
- 레이어별 on/off 토글
- 탐지 반경 1 / 5 / 50 / 100 / 200km 전환 (핀치 줌으로도 조정 가능)
- 오브젝트 탭 시 상세 말풍선
- GPS 불가 시 서울 좌표로 자동 폴백

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속. GPS 권한 허용 시 현재 위치 기준으로 동작합니다.

## 환경변수

`.env.local` 파일을 생성하고 아래 값을 설정합니다.

```env
# OpenSky Network OAuth2 (항공기 레이어, 로컬 전용)
OPENSKY_CLIENT_ID=your-client-id
OPENSKY_CLIENT_SECRET=your-client-secret

# 공공데이터포털 API 키 (공공 와이파이)
PUBLIC_DATA_API_KEY=your-api-key

# Vercel 배포 시 항공기 버튼 숨기기
NEXT_PUBLIC_DISABLE_AIRCRAFT=true
```

## 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
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

| 레이어 | API | 갱신 주기 | 배포 환경 |
|--------|-----|---------|---------|
| 공공 와이파이 | [공공데이터포털](https://www.data.go.kr) (`/api/wifi` 프록시) | 10분 | ✅ |
| 항공기 | [OpenSky Network](https://opensky-network.org) (`/api/aircraft` 프록시, OAuth2) | 30초 | 로컬 전용 |
| 위성 | [Celestrak TLE](https://celestrak.org/NORAD/elements/gp.php?GROUP=visual) (클라이언트 계산) | 30초 | ✅ |
| 지진 | [USGS Earthquake](https://earthquake.usgs.gov/fdsnws/event/1/query) (`/api/earthquakes` 프록시) | 60초 | ✅ |

> 항공기 레이어는 OpenSky Network가 클라우드 서버 IP를 차단하므로 로컬 환경에서만 동작합니다.
> Vercel 배포 시 `NEXT_PUBLIC_DISABLE_AIRCRAFT=true` 설정으로 버튼을 숨깁니다.
