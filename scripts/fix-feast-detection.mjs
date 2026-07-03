// Fix feast detection for all eclipse events using Gregorian date proximity (±1 day)
// Genesis 1:14 — feasts are determined by observable lunar phases (new moon = solar, full moon = lunar)
// The fixed Hebrew calendar (postponement rules) can differ by 1-3 days from astronomical reality.
// Biltz uses NASA astronomical data, not the calculated calendar. So we check:
//   |eclipse Gregorian date - feast Gregorian date| ≤ 1 day
// for Nisan 1, Nisan 15 (Passover), Tishrei 1 (Rosh Hashanah), Tishrei 15 (Sukkot).
//
// Non-astronomical feasts (Shavuot, Yom Kippur, etc.) keep exact HDate match.
// Biltz-verified ±2/±3 day offsets get a manual override.

import { readFileSync, writeFileSync } from 'fs';
import { HDate, months } from '@hebcal/hdate';

const DATA = JSON.parse(readFileSync('src/data/calendar-data.json', 'utf-8'));
const ECLIPSES = DATA.eclipseData;

// Astronomical feasts determined by new moon / full moon (Gen 1:14 "signs and seasons")
const ASTRONOMICAL_FEASTS = [
  { month: months.NISAN, day: 1, name: 'Nisan 1' },
  { month: months.NISAN, day: 15, name: 'Passover' },
  { month: months.TISHREI, day: 1, name: 'Rosh Hashanah' },
  { month: months.TISHREI, day: 15, name: 'Sukkot' },
];

// Biltz-verified overrides: cases where HDate differs from astronomical feast alignment
// ±1 day (postponement rules): caught by Gregorian proximity check below
// ±28-29 days (leap year / Metonic cycle mismatch): need explicit override
// Sources: Biltz transcripts, CBN News, Wikipedia blood moon prophecy page, Five Doves
const BILTZ_OVERRIDES = {
  '2032-04-25': 'Passover',       // ±29 day: HDate says Iyar 14; Biltz says Nisan 15 (tetrad #1)
  '2032-10-18': 'Sukkot',         // ±28 day: HDate says Cheshvan 13; Biltz says Tishrei 15 (tetrad #2)
  '2033-09-23': 'Rosh Hashanah',  // ±3 day: HDate says Elul 29; Biltz says Tishrei 1
};

// Non-astronomical feasts (calculated dates, not determined by new/full moon)
// Keep exact HDate match only — these are calendar-defined dates
const EXACT_FEASTS = [
  { month: months.NISAN, day: 21, name: 'Last Day Unleavened Bread' },
  { month: months.SIVAN, day: 6, name: 'Shavuot' },
  { month: months.TISHREI, day: 10, name: 'Yom Kippur' },
  { month: months.TISHREI, day: 22, name: 'Shemini Atzeret' },
];

function getFeastGregDates(hebYear) {
  const result = [];
  for (const feast of ASTRONOMICAL_FEASTS) {
    try {
      const hd = new HDate(feast.day, feast.month, hebYear);
      result.push({ name: feast.name, date: hd.greg(), hebYear });
    } catch (e) {
      // skip invalid date (shouldn't happen)
    }
  }
  return result;
}

function daysBetween(a, b) {
  return Math.round((a - b) / 86400000);
}

let updated = 0;
let unchanged = 0;
let overrideMatch = 0;

for (const ec of ECLIPSES) {
  const [y, m, d] = ec.date.split('-').map(Number);
  const eclipseDate = new Date(y, m - 1, d);

  let newFeastRelated = false;
  let newFeastName = null;

  // 1. Check Biltz overrides first (transparent exception list)
  if (BILTZ_OVERRIDES[ec.date]) {
    newFeastRelated = true;
    newFeastName = BILTZ_OVERRIDES[ec.date];
    overrideMatch++;
  }

  // 2. Check exact match for non-astronomical feasts
  if (!newFeastRelated) {
    for (const f of EXACT_FEASTS) {
      if (ec.hebMonth === f.month && ec.hebDay === f.day) {
        newFeastRelated = true;
        newFeastName = f.name;
        break;
      }
    }
  }

  // 3. Check astronomical feasts with ±1 day Gregorian proximity
  //    (Biltz's method: feast = astronomical lunar phase, not calculated calendar)
  if (!newFeastRelated) {
    const searchYears = [ec.hebYear - 1, ec.hebYear, ec.hebYear + 1];
    for (const hy of searchYears) {
      if (hy < 5600 || hy > 6000) continue;
      const feasts = getFeastGregDates(hy);
      for (const feast of feasts) {
        if (Math.abs(daysBetween(eclipseDate, feast.date)) <= 1) {
          newFeastRelated = true;
          newFeastName = feast.name;
          break;
        }
      }
      if (newFeastRelated) break;
    }
  }

  if (ec.feastRelated !== newFeastRelated || ec.feastName !== newFeastName) {
    ec.feastRelated = newFeastRelated;
    ec.feastName = newFeastName;
    updated++;
  } else {
    unchanged++;
  }
}

console.log(`Updated: ${updated}, Unchanged: ${unchanged}, Override matches: ${overrideMatch}`);
console.log('');

// Print feast-aligned events (grouped by type)
const feastAligned = ECLIPSES.filter(e => e.feastRelated);
console.log(`Feast-aligned eclipses (${feastAligned.length} total):`);
for (const ec of feastAligned) {
  const override = BILTZ_OVERRIDES[ec.date] ? ' [Biltz override]' : '';
  console.log(`  ${ec.date}  ${ec.type.padEnd(20)}  ${ec.feastName}${override}`);
}

writeFileSync('src/data/calendar-data.json', JSON.stringify(DATA, null, 2));
console.log('\nWritten to src/data/calendar-data.json');
