#!/usr/bin/env node
/**
 * update-conflicts.mjs
 *
 * Fetches armed conflict data from Wikipedia's "List of ongoing armed conflicts,"
 * applies strict quality criteria, merges with curated entries, and writes to
 * src/conflict-data.json.
 *
 * Criteria:
 *   - Fatality threshold: ≥ 1,000 combat-related deaths
 *   - Location accuracy: resolution via actual Wikipedia article coordinates
 *   - Source: every entry links to its Wikipedia article
 *   - Scope: interstate / intrastate armed conflicts only; no gang/criminal violence
 *   - Update: weekly via GitHub Actions
 *
 * Run:  node scripts/update-conflicts.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'src', 'conflict-data.json');
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'TLG-ConflictUpdater/1.0 (https://thelastgeneration.com)';
const MIN_FATALITIES = 1000;

/* ── Helpers ── */
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function strip(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseNum(s) {
  const n = parseInt(s.replace(/[,+[\]]/g, '').trim(), 10);
  return isNaN(n) ? null : n;
}

/* ── Wikipedia Table Parser ── */

/**
 * Extract the primary Wikipedia article title from a table cell.
 * Prefers the first meaningful <a> whose href starts with /wiki/.
 */
const EXCLUDE_HREF = [
  'Arab–Israeli conflict', 'Congolese Civil War (disambiguation)',
  'Iran–Israel conflict', 'Middle Eastern crisis (2023–present)',
  'Iran–Israel proxy conflict', 'Israeli–Palestinian conflict',
];

const EXCLUDE_PATTERNS = [
  /disambiguation/i, /List_of/i, /Template:/i, /Category:/i,
  /gang/i, /drug war/i, /cartel/i,
];

const COUNTRY_COORDS = {
  Ukraine: { lat: 48.38, lng: 31.17 },
  Russia: { lat: 61.52, lng: 105.32 },
  Sudan: { lat: 15.50, lng: 30.00 },
  'South Sudan': { lat: 6.88, lng: 31.31 },
  Myanmar: { lat: 21.92, lng: 95.96 },
  Somalia: { lat: 5.15, lng: 46.20 },
  Afghanistan: { lat: 33.94, lng: 67.71 },
  Syria: { lat: 34.80, lng: 39.00 },
  Iran: { lat: 32.43, lng: 53.69 },
  Nigeria: { lat: 9.08, lng: 8.68 },
  Ecuador: { lat: -1.83, lng: -78.18 },
  Haiti: { lat: 18.97, lng: -72.29 },
  Ethiopia: { lat: 9.15, lng: 40.49 },
  Yemen: { lat: 15.55, lng: 48.52 },
  'DRC': { lat: -4.04, lng: 21.76 },
  'Congo': { lat: -4.04, lng: 21.76 },
  'Democratic Republic of the Congo': { lat: -4.04, lng: 21.76 },
  'Maghreb': { lat: 28.0, lng: 3.0 },
  Israel: { lat: 31.05, lng: 34.85 },
  Palestine: { lat: 31.95, lng: 35.23 },
  Armenia: { lat: 40.07, lng: 45.04 },
  Azerbaijan: { lat: 40.14, lng: 47.58 },
  Mali: { lat: 17.57, lng: -3.99 },
  Colombia: { lat: 4.57, lng: -74.30 },
  Niger: { lat: 17.61, lng: 8.08 },
  Burkina: { lat: 12.24, lng: -1.56 },
  Chad: { lat: 15.45, lng: 19.93 },
};

const NAME_TO_COUNTRY = [
  [/\bMyanmar/i, 'Myanmar'],
  [/Sudanese civil/i, 'Sudan'],
  [/Somali/i, 'Somalia'],
  [/Russo-Ukrain/i, 'Ukraine'],
  [/Afghan/i, 'Afghanistan'],
  [/Syrian/i, 'Syria'],
  [/Iran/i, 'Iran'],
  [/Nigeria/i, 'Nigeria'],
  [/Ecuador/i, 'Ecuador'],
  [/Haiti/i, 'Haiti'],
  [/Ethiopi/i, 'Ethiopia'],
  [/Yemen/i, 'Yemen'],
  [/Congolese|DR Congo|Congo/i, 'DRC'],
  [/Maghreb/i, 'Maghreb'],
  [/Ukrain/i, 'Ukraine'],
  [/Colombi/i, 'Colombia'],
  [/Sahel|Mali|Burkina|Niger/i, 'Mali'],
  [/Armenia|Azerbaijan/i, 'Armenia'],
  [/Israel|Gaza|Houthi|Red Sea/i, 'Israel'],
];

function resolveFallbackCoords(name) {
  for (const [pattern, country] of NAME_TO_COUNTRY) {
    if (pattern.test(name) && COUNTRY_COORDS[country]) return COUNTRY_COORDS[country];
  }
  return null;
}

function extractArticle(cellHtml) {
  /* Only the first meaningful link defines the row — sub-links use the row's aggregate fatality count, not their own */
  const links = [...cellHtml.matchAll(/<a\s+href="\/wiki\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const [, href, inner] of links) {
    if (EXCLUDE_PATTERNS.some(p => p.test(href) || p.test(inner))) return null;
    const text = strip(inner);
    const decoded = decodeURIComponent(href).replace(/_/g, ' ');
    if (EXCLUDE_HREF.includes(decoded)) return null;
    if (text.length < 3) continue;
    if (href.includes('disambiguation')) return null;
    const name = text;
    const n = name.toLowerCase();
    if (n.includes('gang') || n.includes('drug') || n.includes('cartel') || n.includes('criminal')) return null;
    return { title: decoded, displayName: name };
  }
  return null;
}

function regionFromContinent(html) {
  const text = strip(html);
  if (text.includes('Africa')) return 'Africa';
  if (text.includes('Asia')) return 'Asia';
  if (text.includes('Europe')) return 'Europe';
  if (text.includes('Middle East')) return 'Middle East';
  if (text.includes('America')) return 'Americas';
  return 'Other';
}

function classifyType(name) {
  const n = name.toLowerCase();
  if (n.includes('civil war') || n.includes('insurgency') || n.includes('conflict in')) return 'intrastate';
  if (n.includes('war between') || n.includes('russo-ukrain')) return 'interstate';
  return 'intrastate';
}

function parseWikiTable(html) {
  const conflicts = [];
  const tables = html.match(/<table[^>]*class="wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/g);
  if (!tables) return conflicts;

  for (const tbl of tables) {
    const rows = tbl.match(/<tr>[\s\S]*?<\/tr>/g);
    if (!rows) continue;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 5) continue;

      /* Start year */
      const startRaw = strip(cells[0]);
      const startYear = startRaw.match(/\b(19|20)\d{2}\b/);
      if (!startYear) continue;
      const start = startYear[0] + '-01-01';

      /* Article link */
      const article = extractArticle(cells[1]);
      if (!article) continue;
      const { title, displayName: name } = article;
      if (name.length < 4) continue;

      /* Region */
      const region = regionFromContinent(cells[2]);

      /* Fatalities — take the last numeric column */
      const fatStr = strip(cells[cells.length - 1]);
      const fatalities = parseNum(fatStr);
      if (fatalities === null || fatalities < MIN_FATALITIES) continue;

      const source = `https://en.wikipedia.org/wiki/${encodeURIComponent(title).replace(/%2F/g, '/').replace(/%20/g, '_')}`;

      conflicts.push({
        wikiTitle: title,
        name,
        start,
        region,
        fatalities,
        type: classifyType(name),
        _source: source,
      });
    }
  }
  return conflicts;
}

/* ── Coordinate Resolution ── */

async function pageCoords(title) {
  try {
    const data = await fetchJson(
      `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=coordinates&format=json`
    );
    const pages = data.query?.pages || {};
    for (const id of Object.keys(pages)) {
      const c = pages[id].coordinates;
      if (c && c.length > 0) return { lat: c[0].lat, lng: c[0].lon };
    }
  } catch {}
  return null;
}

async function resolveLocations(list) {
  console.log('  Resolving coordinates...');
  let resolved = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i]._coords) continue;
    /* Try 1: Wikipedia article coordinates */
    let coords = await pageCoords(list[i].wikiTitle);
    if (coords) {
      list[i]._coords = coords; resolved++;
      console.log(`    ✓ ${list[i].name} (article coords)`);
      if (i % 2 === 1) await new Promise(r => setTimeout(r, 300));
      continue;
    }
    /* Try 2: Fallback country-level coords */
    coords = resolveFallbackCoords(list[i].name);
    if (coords) {
      list[i]._coords = coords; resolved++;
      console.log(`    ~ ${list[i].name} (country coords)`);
      continue;
    }
    console.log(`    ✗ ${list[i].name} (no coords)`);
    if (i % 2 === 1) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`    ${resolved}/${list.length} resolved`);
  return list;
}

/* ── Curated Entries (always kept, never removed) ── */

const CURATED_RAW = [
  { id: 'ukraine-russia',          name: 'Russo-Ukrainian War',             start: '2022-02-24', region: 'Europe',      lat: 48.5,  lng: 31.5,  parties: ['Ukraine', 'Russia'],                  fatalities: '25,000+',  displaced: '6,500,000+', status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/Russo-Ukrainian_War' },
  { id: 'israel-gaza',             name: 'Israel–Hamas War',               start: '2023-10-07', region: 'Middle East', lat: 31.5,  lng: 34.5,  parties: ['Israel', 'Hamas'],                    fatalities: '40,000+',  displaced: '1,900,000+', status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/Israel–Hamas_War' },
  { id: 'israel-hezbollah',        name: 'Israel–Hezbollah Conflict',      start: '2023-10-08', region: 'Middle East', lat: 33.0,  lng: 35.5,  parties: ['Israel', 'Hezbollah'],                 fatalities: '2,000+',   displaced: '100,000+',  status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/Israel–Hezbollah_conflict_(2023–present)' },
  { id: 'israel-iran',             name: 'Israel–Iran Conflict',           start: '2024-04-01', region: 'Middle East', lat: 33.0,  lng: 47.0,  parties: ['Israel', 'Iran'],                      fatalities: '500+',     displaced: null,        status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/2024_Iran–Israel_conflict' },
  { id: 'sudan-civil-war',         name: 'Sudan Civil War',                start: '2023-04-15', region: 'Africa',      lat: 15.5,  lng: 30.0,  parties: ['SAF', 'RSF'],                          fatalities: '30,000+',  displaced: '8,000,000+', status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Sudanese_civil_war_(2023–present)' },
  { id: 'myanmar-civil-war',       name: 'Myanmar Civil War',              start: '2021-02-01', region: 'Asia',        lat: 22.0,  lng: 96.0,  parties: ['SAC', 'PDF', 'EAOs'],                  fatalities: '50,000+',  displaced: '1,500,000+', status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Myanmar_civil_war_(2021–present)' },
  { id: 'ethiopia-tigray',         name: 'Tigray War',                     start: '2020-11-03', region: 'Africa',      lat: 13.5,  lng: 39.5,  parties: ['ENDF', 'TPLF'],                        fatalities: '600,000+', displaced: null,        status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Tigray_War' },
  { id: 'yemen-civil-war',         name: 'Yemen Civil War',                start: '2014-09-16', region: 'Middle East', lat: 15.5,  lng: 44.5,  parties: ['PLC', 'Houthis'],                      fatalities: '380,000+', displaced: '4,500,000+', status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Yemeni_civil_war_(2014–present)' },
  { id: 'sahel-conflict',          name: 'Sahel Insurgency',               start: '2011-01-01', region: 'Africa',      lat: 15.0,  lng: 0.0,   parties: ['G5 Sahel states', 'Jihadist groups'],  fatalities: '25,000+',  displaced: '2,000,000+', status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Sahel_conflict' },
  { id: 'haiti-gang-war',          name: 'Haiti Gang Conflict',            start: '2021-07-07', region: 'Americas',    lat: 19.0,  lng: -72.5, parties: ['Haitian government', 'Gangs'],          fatalities: '5,000+',   displaced: '362,000+',  status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/Haitian_crisis' },
  { id: 'armenia-azerbaijan',      name: 'Nagorno-Karabakh Conflict',      start: '2020-09-27', region: 'Asia',        lat: 40.0,  lng: 47.0,  parties: ['Armenia', 'Azerbaijan'],               fatalities: '7,000+',   displaced: '100,000+',  status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/Nagorno-Karabakh_conflict' },
  { id: 'dr-congo-conflict',       name: 'DRC Conflict (M23)',             start: '2022-03-27', region: 'Africa',      lat: -1.5,  lng: 29.0,  parties: ['DRC', 'M23'],                           fatalities: '10,000+',  displaced: '6,700,000+', status: 'ongoing', type: 'intrastate',  source: 'https://en.wikipedia.org/wiki/M23_rebellion' },
  { id: 'us-houthi-red-sea',       name: 'Red Sea Crisis',                 start: '2023-10-19', region: 'Middle East', lat: 15.0,  lng: 43.0,  parties: ['US/UK', 'Houthis'],                     fatalities: '100+',     displaced: null,        status: 'ongoing', type: 'interstate',  source: 'https://en.wikipedia.org/wiki/Red_Sea_crisis' },
];

const CURATED_IDS = new Set(CURATED_RAW.map(e => e.id));

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function merge(incoming) {
  const result = CURATED_RAW.map(e => ({ ...e }));
  const resultById = new Map(result.map(e => [e.id, e]));

  for (const inc of incoming) {
    const n = inc.name.toLowerCase();
    let match = null;

    /* Try matching to curated entries by wikiTitle or name overlap */
    for (const [, ex] of resultById) {
      if (ex._wikiTitle && ex._wikiTitle.toLowerCase() === inc.wikiTitle.toLowerCase()) {
        match = ex; break;
      }
      const en = ex.name.toLowerCase();
      if ((n.includes(en) && en.length > 6) || (en.includes(n) && n.length > 6)) {
        match = ex; break;
      }
    }

    if (match) {
      /* Update curated entry with fresh fatality data */
      const num = inc.fatalities;
      match.fatalities = num >= 1000
        ? `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace('.0', '')}K+`
        : `${num}+`;
      match._wikiTitle = inc.wikiTitle;
      if (inc._coords && !match.lat) { match.lat = inc._coords.lat; match.lng = inc._coords.lng; }
    } else {
      /* New auto-resolved entry */
      const num = inc.fatalities;
      const entry = {
        id: slug(inc.name),
        name: inc.name,
        start: inc.start,
        region: inc.region,
        lat: inc._coords?.lat || null,
        lng: inc._coords?.lng || null,
        parties: [],
        fatalities: num >= 1000
          ? `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace('.0', '')}K+`
          : `${num}+`,
        displaced: null,
        status: 'ongoing',
        type: inc.type,
        source: inc._source,
        _auto: true,
      };
      resultById.set(entry.id, entry);
      result.push(entry);
    }
  }

  result.sort((a, b) => {
    const af = parseInt(String(a.fatalities).replace(/[^0-9]/g, '')) || 0;
    const bf = parseInt(String(b.fatalities).replace(/[^0-9]/g, '')) || 0;
    return bf - af;
  });
  return result;
}

/* ── Main ── */
async function main() {
  console.log('Update conflicts data\n');

  const sections = [
    { id: 3, name: 'Major wars' },
    { id: 4, name: 'Minor wars' },
  ];

  let raw = [];

  for (const s of sections) {
    console.log(`  Section: ${s.name}`);
    try {
      const data = await fetchJson(
        `${WIKI_API}?action=parse&page=List_of_ongoing_armed_conflicts&format=json&prop=text&section=${s.id}`
      );
      const html = data.parse?.text?.['*'];
      if (html) {
        const parsed = parseWikiTable(html);
        console.log(`    → ${parsed.length} conflicts (≥${MIN_FATALITIES} fatalities, no gang entries)`);
        raw.push(...parsed);
      }
    } catch (e) {
      console.error(`    ✗ ${e.message}`);
    }
  }

  console.log(`\n  Total qualified: ${raw.length}`);
  raw = await resolveLocations(raw);

  const withCoords = raw.filter(c => c._coords).length;
  const noCoords = raw.filter(c => !c._coords);
  if (noCoords.length) {
    console.log(`  No coords: ${noCoords.map(c => c.name).join(', ')}`);
  }

  const merged = merge(raw);
  const auto = merged.filter(e => e._auto);
  const curated = merged.filter(e => CURATED_IDS.has(e.id));

  for (const entry of merged) {
    const { _auto, _wikiTitle, _source, _coords, ...clean } = entry;
    Object.assign(entry, clean);
  }

  const output = {
    _meta: {
      lastUpdated: new Date().toISOString(),
      source: 'Wikipedia (List of ongoing armed conflicts)',
      minFatalities: MIN_FATALITIES,
      entries: merged.length,
      curatedCount: curated.length,
      autoCount: auto.length,
    },
    conflicts: merged,
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  console.log(`\n  ── Results ──`);
  console.log(`  Curated:            ${curated.length}`);
  console.log(`  Auto-resolved:      ${auto.length}`);
  console.log(`  Total:              ${merged.length}`);
  console.log(`  With coordinates:   ${withCoords}`);
  console.log(`\n  ✓ Written to src/conflict-data.json`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
