import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'src', 'eonet-history.json');
const CAT_FILTER = 'wildfires,floods,volcanoes,severeStorms';
const CAT_MAP = { wildfires: 'wildfire', volcanoes: 'volcano', floods: 'flood', severeStorms: 'cyclone' };
const BATCH = 5;
const CY = new Date().getFullYear();

async function fetchYear(year) {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${CAT_FILTER}&status=all&start=${year}-01-01&end=${year}-12-31`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${year}`);
  const data = await resp.json();
  const counts = { flood: 0, cyclone: 0, volcano: 0, wildfire: 0 };
  for (const f of (data.features || [])) {
    const cats = f.properties?.categories || [];
    const eonetType = cats[0]?.id || '';
    const type = CAT_MAP[eonetType];
    if (type && counts[type] !== undefined) counts[type]++;
  }
  return { year, counts };
}

async function main() {
  const allYears = [];
  for (let y = 2000; y <= CY; y++) allYears.push(y);
  console.log(`Fetching ${allYears.length} years (${allYears[0]}–${allYears[allYears.length-1]})...`);

  const result = { flood: [], cyclone: [], volcano: [], wildfire: [] };

  for (let i = 0; i < allYears.length; i += BATCH) {
    const batch = allYears.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(y => fetchYear(y)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { year, counts } = r.value;
        for (const [type, count] of Object.entries(counts)) {
          result[type].push({ year, count });
        }
        console.log(`  ${year}: ${JSON.stringify(counts)}`);
      } else {
        console.warn(`  Failed: ${r.reason?.message || r.reason}`);
      }
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
  const size = (Buffer.byteLength(JSON.stringify(result), 'utf8') / 1024).toFixed(1);
  console.log(`\nWritten to ${OUTPUT} (${size} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
