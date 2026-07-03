import { writeFileSync, mkdirSync } from 'fs';
import { HDate, months } from '@hebcal/hdate';

const MONTH_NAMES = {
  [months.NISAN]: 'Nisan', [months.IYYAR]: 'Iyar', [months.SIVAN]: 'Sivan',
  [months.TAMUZ]: 'Tammuz', [months.AV]: 'Av', [months.ELUL]: 'Elul',
  [months.TISHREI]: 'Tishri', [months.CHESHVAN]: 'Cheshvan', [months.KISLEV]: 'Kislev',
  [months.TEVET]: 'Tevet', [months.SHVAT]: 'Shevat', [months.ADAR_I]: 'Adar I',
  [months.ADAR_II]: 'Adar II',
};
const FEAST_NAMES = {
  [months.NISAN]: [{ day: 15, name: 'Passover' }, { day: 21, name: 'Last Day Unleavened Bread' }],
  [months.SIVAN]: [{ day: 6, name: 'Shavuot' }],
  [months.TISHREI]: [{ day: 1, name: 'Rosh Hashanah' }, { day: 10, name: 'Yom Kippur' }, { day: 15, name: 'Sukkot' }, { day: 22, name: 'Shemini Atzeret' }],
};
const TRIBE = { [months.NISAN]: 'Judah', [months.TISHREI]: 'Ephraim', [months.IYYAR]: null, [months.SIVAN]: 'Reuben' };

const hebrewStart = 5707;
const hebrewEnd = 5810;

function generateYearData(hy) {
  const hd = new HDate(1, months.TISHREI, hy);
  const tishri1 = hd.greg();
  const isLeap = hd.isLeapYear();
  const monthCount = isLeap ? 13 : 12;

  // Determine which months exist in this year
  const monthIndices = [];
  const keyMonths = [months.NISAN, months.IYYAR, months.SIVAN, months.TAMUZ, months.AV, months.ELUL, months.TISHREI, months.CHESHVAN, months.KISLEV, months.TEVET, months.SHVAT];
  if (isLeap) { keyMonths.push(months.ADAR_I); keyMonths.push(months.ADAR_II); }
  else { keyMonths.push(months.ADAR_I); } // ADAR_I = regular Adar when not leap

  const monthsData = [];
  for (const mi of keyMonths) {
    try {
      const monthHd = new HDate(1, mi, hy);
      const gregStart = monthHd.greg();
      const daysInMonth = monthHd.daysInMonth();
      const name = MONTH_NAMES[mi];
      monthsData.push({
        index: mi,
        name,
        days: daysInMonth,
        gregStart: `${gregStart.getFullYear()}-${String(gregStart.getMonth() + 1).padStart(2, '0')}-${String(gregStart.getDate()).padStart(2, '0')}`,
        tribe: TRIBE[mi] || null,
        theme: mi === months.IYYAR ? 'Month of War' : null,
        feasts: FEAST_NAMES[mi] || [],
      });
    } catch (e) {
      // skip invalid month
    }
  }

  // Sort by month index
  monthsData.sort((a, b) => a.index - b.index);

  const passoverHd = new HDate(15, months.NISAN, hy);
  const sukkotHd = new HDate(15, months.TISHREI, hy);
  const passoverDate = passoverHd.greg();
  const sukkotDate = sukkotHd.greg();

  return {
    hebrewYear: hy,
    gregYear: tishri1.getFullYear(),
    tishri1: `${tishri1.getFullYear()}-${String(tishri1.getMonth() + 1).padStart(2, '0')}-${String(tishri1.getDate()).padStart(2, '0')}`,
    isLeap,
    shemitah: hy % 7 === 0,
    jubileeNext: hy % 49 === 0,
    months: monthsData,
    passover: `${passoverDate.getFullYear()}-${String(passoverDate.getMonth() + 1).padStart(2, '0')}-${String(passoverDate.getDate()).padStart(2, '0')}`,
    sukkot: `${sukkotDate.getFullYear()}-${String(sukkotDate.getMonth() + 1).padStart(2, '0')}-${String(sukkotDate.getDate()).padStart(2, '0')}`,
  };
}

const years = {};
for (let hy = hebrewStart; hy <= hebrewEnd; hy++) {
  years[hy] = generateYearData(hy);
  if (hy === hebrewStart || hy === hebrewEnd || hy % 20 === 0) {
    console.log(`  Generated year ${hy}`);
  }
}

const historicalEvents = [
  { year: 1948, hebYear: 5708, event: 'Israel becomes a nation', type: 'foundation', shemitahBoundary: false },
  { year: 1949, hebYear: 5709, event: 'Blood moon tetrad begins', type: 'eclipse', shemitahBoundary: false },
  { year: 1967, hebYear: 5727, event: 'Six-Day War — Jerusalem recaptured', type: 'war', shemitahBoundary: true, row: 1 },
  { year: 1973, hebYear: 5734, event: 'Yom Kippur War — first day of Jubilee cycle', type: 'war', shemitahBoundary: true, row: 1 },
  { year: 1981, hebYear: 5741, event: 'Osirak nuclear reactor destroyed', type: 'war', shemitahBoundary: true, row: 1 },
  { year: 1987, hebYear: 5748, event: 'First Intifada begins', type: 'conflict', shemitahBoundary: true, row: 1 },
  { year: 1994, hebYear: 5755, event: 'Jordan-Israel Peace Treaty', type: 'peace', shemitahBoundary: true, row: 1 },
  { year: 2001, hebYear: 5762, event: '9/11 attacks', type: 'attack', shemitahBoundary: true, row: 1 },
  { year: 2008, hebYear: 5769, event: 'Global financial crash', type: 'crash', shemitahBoundary: true, row: 1 },
  { year: 2014, hebYear: 5774, event: 'Blood moon tetrad begins (2014-15)', type: 'eclipse', shemitahBoundary: false, row: 2 },
  { year: 2023, hebYear: 5784, event: 'Oct 7 War — Last day of Jubilee cycle', type: 'war', shemitahBoundary: true, row: 2 },
  { year: 2024, hebYear: 5785, event: 'Great American Eclipse (Apr 8) on Nisan 1', type: 'eclipse', shemitahBoundary: false, row: 2 },
  { year: 2024, hebYear: 5785, event: 'Iran attacks Israel directly — first time in history', type: 'war', shemitahBoundary: false, row: 2 },
  { year: 2026, hebYear: 5787, event: 'Total lunar eclipse on Purim (Mar 3)', type: 'eclipse', shemitahBoundary: false, row: 2 },
  { year: 2029, hebYear: 5790, event: 'Shemitah cycle begins — earliest Tribulation start', type: 'prophetic', shemitahBoundary: true, row: 2 },
  { year: 2033, hebYear: 5793, event: 'Total solar on Nisan 1 + Total lunar on Passover', type: 'eclipse', shemitahBoundary: false, row: 2 },
];

const eclipseData = [
  { date: '2024-04-08', type: 'total-solar', hebYear: 5785, hebMonth: months.NISAN, hebDay: 1, magnitude: 1.057, feastRelated: true },
  { date: '2026-03-03', type: 'total-lunar', hebYear: 5787, hebMonth: months.ADAR_I, hebDay: 14, magnitude: 1.151, feastRelated: true },
  { date: '2029-06-26', type: 'total-lunar', hebYear: 5790, hebMonth: months.TAMUZ, hebDay: 14, magnitude: 1.014, feastRelated: false },
  { date: '2029-12-20', type: 'total-lunar', hebYear: 5791, hebMonth: months.KISLEV, hebDay: 13, magnitude: 1.059, feastRelated: false },
  { date: '2030-06-15', type: 'partial-lunar', hebYear: 5791, hebMonth: months.SIVAN, hebDay: 14, magnitude: 0.502, feastRelated: false },
  { date: '2030-12-09', type: 'penumbral-lunar', hebYear: 5792, hebMonth: months.KISLEV, hebDay: 14, magnitude: 0.942, feastRelated: false },
  { date: '2032-04-25', type: 'total-lunar', hebYear: 5793, hebMonth: months.NISAN, hebDay: 15, magnitude: 1.187, feastRelated: true },
  { date: '2032-10-18', type: 'total-lunar', hebYear: 5794, hebMonth: months.TISHREI, hebDay: 15, magnitude: 1.070, feastRelated: true },
  { date: '2033-03-30', type: 'total-solar', hebYear: 5794, hebMonth: months.NISAN, hebDay: 1, magnitude: 1.005, feastRelated: true },
  { date: '2033-04-14', type: 'total-lunar', hebYear: 5794, hebMonth: months.NISAN, hebDay: 15, magnitude: 1.350, feastRelated: true },
  { date: '2033-09-23', type: 'partial-solar', hebYear: 5795, hebMonth: months.TISHREI, hebDay: 1, magnitude: 0.803, feastRelated: true },
  { date: '2033-10-08', type: 'total-lunar', hebYear: 5795, hebMonth: months.TISHREI, hebDay: 15, magnitude: 1.112, feastRelated: true },
];

const undeniableEvents = [
  {
    title: 'The Jubilee Bookend — 50 Years Apart',
    description: 'Two wars on the exact same festival season, exactly 50 years apart, bookending a single Jubilee cycle, both preceded by blood moon tetrads exactly 7 years prior.',
    events: ['Yom Kippur War (Oct 6, 1973)', 'Oct 7 War (Oct 7, 2023)'],
    pattern: ['1967 tetrad → 7yr → 1973 war', '2014 tetrad → 7yr → 2023 war'],
    odds: '~1 in 18,000 for two wars at same festival 50 years apart by chance',
  },
  {
    title: 'Iran Attack Predicted Before It Happened',
    description: 'Biltz wrote in 2023 on page 124 of America at War that Iran would attack Israel in April 2024. It happened exactly as written — the first direct Iranian attack on Israel in 75 years.',
    events: ['Apr 13-14, 2024: Iran launches ~300 drones/missiles at Israel'],
    pattern: ['Book published 2023 → Prediction → April 2024 fulfillment'],
    odds: 'First direct Iranian attack in 75 years, predicted months in advance',
  },
  {
    title: 'Every Shemitah Boundary Since 1967 Has a Major Event',
    description: 'The Rosh Hashanah starting each 7-year shemitah cycle has consistently marked a major war, attack, or financial crash involving Israel or the US.',
    events: ['1967: Six-Day War', '1973: Yom Kippur War', '1980: Osirak strike', '1987: First Intifada', '1994: Jordan Peace', '2001: 9/11', '2008: Global crash', '2023: Oct 7 War'],
    pattern: ['1967 ● 1973 ● 1981 ● 1987 ● 1994 ● 2001 ● 2008 ● 2023'],
    odds: '8 shemitah boundaries, 7 wars/attacks — too consistent for chance',
  },
  {
    title: 'The 2033 Eclipse Pair — Solar on Nisan 1, Lunar on Passover',
    description: 'A total solar eclipse on Nisan 1 followed 14 days later by a total lunar eclipse on Passover (Nisan 15). This exact configuration maps to Revelation 11: the two witnesses.',
    events: ['Mar 30, 2033: Total solar eclipse on Nisan 1', 'Apr 14, 2033: Total lunar eclipse on Passover'],
    pattern: ['Solar on Nisan 1 → 14 days → Lunar on Nisan 15'],
    odds: 'Occurs once in several centuries',
  },
];

const output = { years, historicalEvents, eclipseData, undeniableEvents };
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/calendar-data.json', JSON.stringify(output, null, 2));
console.log(`Generated data for years ${hebrewStart}-${hebrewEnd} (${Object.keys(years).length} years)`);
console.log(`Events: ${historicalEvents.length}, Eclipses: ${eclipseData.length}, Undeniable Events: ${undeniableEvents.length}`);
