// 자치단체 코드별 WiFi 포인트 평균 좌표(centroid) 생성
// 실행: node scripts/gen-wifi-centroids.mjs
// 출력: lib/wifi-centroids.json

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SERVICE_KEY =
  'kkczjLCsRv2RjL0OJxGRL8DNHJ6BCI8rzOzhv8M8OkL2MEwTfr5R70i1YCy7fMhmRTVvm9AovF+mqZjV/B6CMA==';
const BASE_URL = 'https://apis.data.go.kr/1741000/free_wifi_info/info';

// 시/도 단위 코드 — 하위 구/시/군 코드가 별도 존재하므로 centroid 불필요
const SKIP_CODES = new Set([
  '6410000', // 경기도
  '6480000', // 경상남도
  '6470000', // 경상북도
  '6290000', // 광주광역시
  '6270000', // 대구광역시
  '6300000', // 대전광역시
  '6260000', // 부산광역시
  '6110000', // 서울특별시
  '6310000', // 울산광역시
  '6280000', // 인천광역시
  '6460000', // 전라남도
  '6540000', // 전북특별자치도
  '6500000', // 제주도 (6510000/6520000 사용)
  '6440000', // 충청남도
  '6430000', // 충청북도
  '6530000', // 강원특별자치도
  // 5690000 (세종) 은 하위 코드 없으므로 유지
]);

function parseCodes() {
  const md = readFileSync(resolve(ROOT, 'docs/code.md'), 'utf8');
  const results = [];
  for (const line of md.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('자치단체명')) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const code = parts[1].trim();
    if (code.endsWith('_ALL') || SKIP_CODES.has(code)) continue;
    results.push({ name, code });
  }
  return results;
}

async function fetchCentroid(code) {
  const url = new URL(BASE_URL);
  url.searchParams.set('serviceKey', SERVICE_KEY);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('returnType', 'json');
  url.searchParams.set('cond[OPN_ATMY_GRP_CD::EQ]', code);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    const data = await res.json();
    const raw = data?.response?.body?.items?.item;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const coords = arr
      .map(i => ({ lat: parseFloat(i.WGS84_LAT), lng: parseFloat(i.WGS84_LOT) }))
      .filter(c => !isNaN(c.lat) && !isNaN(c.lng) && c.lat > 30 && c.lat < 40 && c.lng > 124 && c.lng < 132);

    if (coords.length === 0) return null;
    return {
      lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
      lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
    };
  } catch {
    return null;
  }
}

async function runBatch(items, concurrency = 8) {
  const results = [];
  const failed = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchOut = await Promise.all(
      batch.map(async ({ name, code }) => {
        const c = await fetchCentroid(code);
        if (c) {
          process.stdout.write(`✓ ${name}(${code}) ${c.lat.toFixed(4)},${c.lng.toFixed(4)}\n`);
          return { name, code, lat: c.lat, lng: c.lng };
        }
        process.stdout.write(`✗ ${name}(${code}) no data\n`);
        failed.push({ name, code });
        return null;
      })
    );
    results.push(...batchOut.filter(Boolean));
    if (i + concurrency < items.length) await new Promise(r => setTimeout(r, 150));
  }
  if (failed.length) console.log('\n데이터 없음:', failed.map(f => f.name).join(', '));
  return results;
}

const codes = parseCodes();
console.log(`${codes.length}개 자치단체 코드 처리 중...\n`);
const centroids = await runBatch(codes);
console.log(`\n완료: ${centroids.length}/${codes.length} centroid 생성`);

writeFileSync(resolve(ROOT, 'lib/wifi-centroids.json'), JSON.stringify(centroids, null, 2));
console.log('lib/wifi-centroids.json 저장 완료');
