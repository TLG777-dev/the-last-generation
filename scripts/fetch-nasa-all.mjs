// Fetch NASA solar AND lunar eclipse catalogs, parse for 1940-2060,
// compute Hebrew dates, write to JSON
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { HDate, months } from '@hebcal/hdate';

function parseSolarLine(line) {
  // Format example:
  // 7226  179  2026 Feb 17  12:13:06  338  2835   81   A   -0.0123  0.9630  19.1S  13.1E  83  136  167  00m50s
  const dateRe = line.match(/(\d{4}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2})/);
  if (!dateRe) return null;
  const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const year = parseInt(dateRe[1]);
  const month = monthMap[dateRe[2]];
  const day = parseInt(dateRe[3]);
  // Type is after Saros number - find the eclipse type code (T, A, H, P)
  const typeMatch = line.match(/\s+(T|A|H|P)\s+/);
  if (!typeMatch) {
    // Try harder - it might be at a specific position
    const types = line.substring(60, 80).match(/\b(T|A|H|P|-\b)/);
    if (!types) return null;
  }
  const typeCode = typeMatch ? typeMatch[1] : null;
  if (!typeCode) return null;
  
  const typeMap = { 'T': 'total-solar', 'A': 'annular-solar', 'H': 'hybrid-solar', 'P': 'partial-solar' };
  return { date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, type: typeMap[typeCode] || `solar-${typeCode}` };
}

function parseLunarLine(line) {
  // Lunar catalog format:
  // 1050  126  2026 Mar 03  11:34:55  13330  113   83   T   -0.3762  1.1509  45.3N  29.0E   ... 
  const dateRe = line.match(/(\d{4}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2})/);
  if (!dateRe) return null;
  const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const year = parseInt(dateRe[1]);
  const month = monthMap[dateRe[2]];
  const day = parseInt(dateRe[3]);
  // Type is at around col 55-57
  const typeCodes = line.substring(50, 70).match(/\b(T|P|N)\b/);
  if (!typeCodes) return null;
  const typeCode = typeCodes[0];
  const typeMap = { 'T': 'total-lunar', 'P': 'partial-lunar', 'N': 'penumbral-lunar' };
  return { date: `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, type: typeMap[typeCode] };
}

function addHebrewDates(eclipses) {
  for (const ec of eclipses) {
    const [y, m, d] = ec.date.split('-').map(Number);
    try {
      const hebrew = new HDate(new Date(y, m - 1, d));
      ec.hebYear = hebrew.getFullYear();
      ec.hebMonth = hebrew.getMonth();
      ec.hebDay = hebrew.getDate();  // day of month
      ec.magnitude = ec.magnitude || 0;
      // Feast detection is done separately by fix-feast-detection.mjs
      ec.feastRelated = false;
      ec.feastName = null;
    } catch(e) {
      // If conversion fails, try next day (eclipses can span midnight)
      try {
        const hebrew = new HDate(new Date(y, m - 1, d + 1));
        ec.hebYear = hebrew.getFullYear();
        ec.hebMonth = hebrew.getMonth();
        ec.hebDay = hebrew.getDate();
        ec.magnitude = ec.magnitude || 0;
        ec.feastRelated = false;
        ec.feastName = null;
      } catch(e2) {
        ec.hebYear = 0; ec.hebMonth = 0; ec.hebDay = 0;
        ec.feastRelated = false;
        ec.feastName = null;
        ec.magnitude = 0;
      }
    }
  }
  return eclipses;
}

async function main() {
  // Fetch solar catalog
  console.log('Fetching solar catalog...');
  const solarResp = await fetch('https://eclipse.gsfc.nasa.gov/5MCSE/5MCSEcatalog.txt');
  const solarText = await solarResp.text();
  
  // Fetch lunar catalog
  console.log('Fetching lunar catalog...');
  const lunarResp = await fetch('https://eclipse.gsfc.nasa.gov/5MCLE/5MKLEcatalog.txt');
  const lunarText = await lunarResp.text();
  
  // Parse solar eclipses 1940-2060
  const solarLines = solarText.split('\n');
  const solarEclipses = [];
  for (const line of solarLines) {
    const ec = parseSolarLine(line);
    if (ec) {
      const year = parseInt(ec.date.substring(0, 4));
      if (year >= 1940 && year <= 2060) {
        solarEclipses.push(ec);
      }
    }
  }
  
  // Parse lunar eclipses 1940-2060
  const lunarLines = lunarText.split('\n');
  const lunarEclipses = [];
  for (const line of lunarLines) {
    const ec = parseLunarLine(line);
    if (ec) {
      const year = parseInt(ec.date.substring(0, 4));
      if (year >= 1940 && year <= 2060) {
        lunarEclipses.push(ec);
      }
    }
  }
  
  console.log(`Solar: ${solarEclipses.length}, Lunar: ${lunarEclipses.length}`);
  
  // Show some parsed examples
  console.log('\nSample solar:');
  for (const ec of solarEclipses.slice(0, 3)) console.log(JSON.stringify(ec));
  console.log('\nSample lunar:');
  for (const ec of lunarEclipses.slice(0, 3)) console.log(JSON.stringify(ec));
  
  // Add Hebrew dates
  const all = [...solarEclipses, ...lunarEclipses];
  all.sort((a, b) => a.date.localeCompare(b.date));
  
  addHebrewDates(all);
  
  console.log(`\nTotal: ${all.length}`);

  // Merge with existing year data and other metadata
  // Read existing calendar-data.json to preserve years, events, undeniableEvents
  let existing;
  try {
    existing = JSON.parse(readFileSync('src/data/calendar-data.json', 'utf-8'));
  } catch(e) {
    existing = { years: {}, historicalEvents: [], undeniableEvents: [] };
  }
  
  const output = {
    years: existing.years,
    historicalEvents: existing.historicalEvents || [],
    eclipseData: all,
    undeniableEvents: existing.undeniableEvents || [],
  };
  
  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/calendar-data.json', JSON.stringify(output, null, 2));
  console.log(`\nWritten to src/data/calendar-data.json`);
  console.log(`Total eclipses: ${all.length}`);
  console.log('\nRun `node scripts/fix-feast-detection.mjs` to apply Biltz feast alignment.');
}

main().catch(console.error);
