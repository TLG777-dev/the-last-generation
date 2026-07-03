import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, '..', 'src', 'eonet-history.json');
const CAT_MAP = { wildfires: 'wildfire', volcanoes: 'volcano', floods: 'flood', severeStorms: 'cyclone' };
const CY = new Date().getFullYear();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchYear(year) {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=wildfires,floods,volcanoes,severeStorms&status=all&start=${year}-01-01&end=${year}-12-31`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const counts = { flood: 0, cyclone: 0, volcano: 0, wildfire: 0 };
  for (const f of (data.features || [])) {
    const cats = f.properties?.categories || [];
    const eonetType = cats[0]?.id || '';
    const type = CAT_MAP[eonetType];
    if (type && counts[type] !== undefined) counts[type]++;
  }
  return counts;
}

async function main() {
  const existing = JSON.parse(readFileSync(INPUT, 'utf8'));
  const found = {};
  for (const [type, arr] of Object.entries(existing)) {
    for (const d of arr) found[d.year] = true;
  }

  const missing = [];
  for (let y = 2000; y <= CY; y++) {
    if (!found[y]) missing.push(y);
  }

  if (missing.length === 0) {
    console.log('All years present!');
    return;
  }

  console.log(`Retrying ${missing.length} missing years: ${missing.join(', ')}`);

  for (let i = 0; i < missing.length; i++) {
    const y = missing[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await sleep(3000); // 3s delay between requests to avoid rate limiting
        const counts = await fetchYear(y);
        for (const [type, count] of Object.entries(counts)) {
          existing[type].push({ year: y, count });
        }
        console.log(`  ${y}: ${JSON.stringify(counts)}`);
        break;
      } catch (e) {
        console.warn(`  ${y} attempt ${attempt+1} failed: ${e.message}`);
        if (attempt === 2) console.warn(`  Giving up on ${y}`);
      }
    }
  }

  // Sort each type by year
  for (const type of Object.keys(existing)) {
    existing[type].sort((a, b) => a.year - b.year);
  }

  writeFileSync(INPUT, JSON.stringify(existing, null, 2));
  const size = (Buffer.byteLength(JSON.stringify(existing), 'utf8') / 1024).toFixed(1);
  console.log(`\nWritten (${size} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
