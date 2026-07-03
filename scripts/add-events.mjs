import { readFileSync, writeFileSync } from 'fs';
import { HDate } from '@hebcal/hdate';

const DATA = JSON.parse(readFileSync('src/data/calendar-data.json', 'utf-8'));
const EVENTS = DATA.historicalEvents;

// Exact known dates for existing events
const EVENT_DATES = {
  'Israel becomes a nation': '1948-05-14',
  'Blood moon tetrad begins': '1949-04-13',
  'Six-Day War — Jerusalem recaptured': '1967-06-05',
  'Yom Kippur War — first day of Jubilee cycle': '1973-10-06',
  'Osirak nuclear reactor destroyed': '1981-06-07',
  'First Intifada begins': '1987-12-08',
  'Jordan-Israel Peace Treaty': '1994-10-26',
  '9/11 attacks': '2001-09-11',
  'Global financial crash': '2008-09-15',
  'Blood moon tetrad begins (2014-15)': '2014-04-15',
  'Oct 7 War — Last day of Jubilee cycle': '2023-10-07',
  'Great American Eclipse (Apr 8) on Nisan 1': '2024-04-08',
  'Iran attacks Israel directly — first time in history': '2024-04-13',
  'Total lunar eclipse on Purim (Mar 3)': '2026-03-03',
  'Shemitah cycle begins — earliest Tribulation start': '2029-09-11',
  'Total solar on Nisan 1 + Total lunar on Passover': '2033-03-30',
};

// New events to add (years with feast-aligned eclipses that have no event yet)
const NEW_EVENTS = [
  { year: 1950, hebYear: 5711, event: 'Israel\'s Law of Return passed', type: 'foundation', eventDate: '1950-07-05' },
  { year: 1968, hebYear: 5728, event: 'Israel begins settlement construction', type: 'foundation', eventDate: '1968-04-15' },
  { year: 1986, hebYear: 5747, event: 'Chernobyl nuclear disaster', type: 'crash', eventDate: '1986-04-26' },
  { year: 1988, hebYear: 5749, event: 'Hamas founded', type: 'foundation', eventDate: '1988-08-18' },
  { year: 1995, hebYear: 5756, event: 'Prime Minister Rabin assassinated', type: 'attack', eventDate: '1995-11-04' },
  { year: 1996, hebYear: 5757, event: 'Netanyahu elected Prime Minister', type: 'foundation', eventDate: '1996-05-29' },
  { year: 2005, hebYear: 5766, event: 'Gaza disengagement', type: 'conflict', eventDate: '2005-08-15' },
  { year: 2006, hebYear: 5767, event: 'Second Lebanon War begins', type: 'war', eventDate: '2006-07-12' },
  { year: 2015, hebYear: 5776, event: 'Iran nuclear deal (JCPOA) signed', type: 'peace', eventDate: '2015-07-14' },
];

// Add eventDate to existing events
for (const ev of EVENTS) {
  const date = EVENT_DATES[ev.event];
  if (date) {
    ev.eventDate = date;
  }
}

// Add new events (skip if already exists)
for (const n of NEW_EVENTS) {
  const exists = EVENTS.some(e => e.event === n.event);
  if (!exists) {
    EVENTS.push(n);
  }
}

// Sort all events by eventDate
EVENTS.sort((a, b) => {
  if (a.eventDate < b.eventDate) return -1;
  if (a.eventDate > b.eventDate) return 1;
  return 0;
});

console.log(`Total events: ${EVENTS.length}`);
console.log('Events with eventDate:', EVENTS.filter(e => e.eventDate).length);
console.log('Events without eventDate:', EVENTS.filter(e => !e.eventDate).length);
for (const ev of EVENTS) {
  console.log(`  ${ev.eventDate || '???'.padStart(10)}  ${ev.event}`);
}

writeFileSync('src/data/calendar-data.json', JSON.stringify(DATA, null, 2));
console.log('\nWritten to src/data/calendar-data.json');
