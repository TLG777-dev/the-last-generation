import { HDate, months } from '@hebcal/hdate';
import rawData from './data/calendar-data.json';

// ─── DATA ───
const DATA = rawData;
const YEARS = DATA.years;
const EVENTS = DATA.historicalEvents;
const ECLIPSES = DATA.eclipseData;
const UNDENIABLE = DATA.undeniableEvents;
const HEBREW_START = Math.min(...Object.keys(YEARS).map(Number));
const HEBREW_END = Math.max(...Object.keys(YEARS).map(Number));

// Build Gregorian → Hebrew year lookup
const GREG_TO_HEB = {};
for (const [hy, yd] of Object.entries(YEARS)) {
  const gYear = yd.gregYear;
  if (!GREG_TO_HEB[gYear]) GREG_TO_HEB[gYear] = [];
  GREG_TO_HEB[gYear].push(parseInt(hy));
  if (!GREG_TO_HEB[gYear + 1]) GREG_TO_HEB[gYear + 1] = [];
  GREG_TO_HEB[gYear + 1].push(parseInt(hy));
}

function eclipseClass(type) {
  if (type === 'hybrid-solar') return 'hybrid';
  return type.includes('solar') ? 'solar' : 'lunar';
}
function eclipseIconClass(ec) {
  const base = eclipseClass(ec.type);
  if (ec.feastRelated) {
    if (ec.type === 'total-lunar' && (ec.feastName === 'Passover' || ec.feastName === 'Sukkot')) return base + ' blood-moon';
    return base;
  }
  if (ec.exceptional) return base;
  return base + ' subtle';
}

// ─── 6000-YEAR CONSTANTS ───
const MILLENNIA = [
  { label: 'Creation', start: -4000, end: -3001, desc: 'Creation to Flood', icon: '\u2726' },
  { label: 'Patriarchs', start: -3000, end: -2001, desc: 'Abraham to Joseph', icon: '\u2605' },
  { label: 'Exodus & Kings', start: -2000, end: -1001, desc: 'Moses to David', icon: '\u2727' },
  { label: 'Prophets', start: -1000, end: -1, desc: 'Isaiah to Malachi', icon: '\u2726' },
  { label: 'Early Church', start: 1, end: 1000, desc: 'Christ to Medieval', icon: '\u2020' },
  { label: 'Modern Era', start: 1001, end: 2100, desc: 'Israel to Present', icon: '\u2605' },
];

function gregYearToCycle(gYear) {
  const hy = gYear + 3761;
  return Math.max(1, Math.floor((hy - 1) / 7) + 1);
}

function centuryBlocks(idx) {
  const m = MILLENNIA[idx];
  if (!m) return [];
  const blocks = [];
  const total = (m.end - m.start + 1) / 100;
  for (let i = 0; i < total; i++) {
    const cs = m.start + i * 100;
    const ce = cs + 99;
    let label = `${Math.abs(cs)}-${Math.abs(ce)}`;
    if (cs < 0 && ce < 0) label = `${Math.abs(cs)}-${Math.abs(ce)} BCE`;
    else if (cs < 0 && ce >= 0) label = `1-100 CE`;
    else label = `${cs}-${ce} CE`;
    blocks.push({ label, start: cs, end: ce, index: i });
  }
  return blocks;
}

const TODAY = new Date();
const CURRENT_GREG_YEAR = TODAY.getFullYear();

function getCurrentHebYear() {
  return new HDate(TODAY).getFullYear();
}
function getCurrentCycle() {
  const hy = getCurrentHebYear();
  let start = hy;
  while (start % 7 !== 1) start--;
  return Math.floor((start - 1) / 7) + 1;
}

// ─── ZOOM LEVEL HIERARCHY (ordered deepest-first) ───
const ZOOM_ORDER = ['day', 'month', 'heb-year', 'shemitah-grid', 'year', 'greg-year', 'century', 'millennia'];

// ─── STATE ───
const STATE = {
  zoomLevel: 'millennia',
  centerGregYear: CURRENT_GREG_YEAR,
  centerYear: CURRENT_GREG_YEAR,
  hebYear: getCurrentHebYear(),
  monthIndex: 1,
  selectedDay: null,
  millenniumIdx: 5,
  centuryIdx: 9,
  filters: {
    shemitah: true, jubilee: true, eclipses: true, feasts: true, events: true, tribes: true, countdown: false, propheticSigns: true,
  },
  viewStack: [],
  centerCycle: null,
};

// ─── HELPERS ───
function getEventsForHebYear(hy) { return EVENTS.filter(e => e.hebYear === hy); }
function getEclipsesForHebYear(hy) { return ECLIPSES.filter(e => e.hebYear === hy); }
function getEclipsesForHebYearMonth(hy, mi) { return ECLIPSES.filter(e => e.hebYear === hy && e.hebMonth === mi); }
function getYearData(gYear) {
  const hd = new HDate(new Date(gYear, 6, 1));
  return YEARS[hd.getFullYear()] || null;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${MONTH_NAMES_SHORT[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

function getDayInfo(gy, gm, gd) {
  const dateStr = `${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')}`;
  const eclipse = ECLIPSES.find(e => e.date === dateStr);
  for (const [hy, yd] of Object.entries(YEARS)) {
    for (const md of yd.months) {
      const gs = md.gregStart;
      if (!gs) continue;
      const [gsy, gsm, gsd] = gs.split('-').map(Number);
      const startDate = new Date(gsy, gsm - 1, gsd);
      const thisDate = new Date(gy, gm - 1, gd);
      const diffDays = Math.round((thisDate - startDate) / 86400000);
      if (diffDays >= 0 && diffDays < (md.days || 30)) {
        const hebDay = diffDays + 1;
        let feast = null;
        if (md.feasts && md.feasts.length > 0) {
          for (const f of md.feasts) {
            if (f.day === hebDay) feast = f.name;
          }
        }
        return {
          hebMonth: md.name, hebDay, hebYear: parseInt(hy),
          feast, eclipse: eclipse ? eclipse.type : null,
          shemitah: parseInt(hy) % 7 === 0,
          jubileeNext: parseInt(hy) % 49 === 0,
        };
      }
    }
  }
  return null;
}

// ─── TRANSITIONS ───
let transitionTimer = null;
function transitionRender(dir) {
  const container = document.getElementById('view-container');
  if (!container) return;
  const animClass = dir === 'in' ? 'view-zoom-in' : dir === 'out' ? 'view-zoom-out' : dir === 'left' ? 'view-slide-left' : dir === 'right' ? 'view-slide-right' : 'view-zoom-in';
  container.classList.remove('view-zoom-in', 'view-zoom-out', 'view-slide-left', 'view-slide-right');
  void container.offsetWidth;
  container.classList.add(animClass);
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => container.classList.remove(animClass), 400);
}

// ─── RENDER: MILLENNIA ───
function renderMillennia() {
  let html = `<div class="view">`;
  html += `<div class="mv-title">6,000 Years of History</div>`;
  html += `<div class="mv-subtitle">Click a millennium to explore</div><div class="mill-grid">`;
  for (let i = 0; i < MILLENNIA.length; i++) {
    const m = MILLENNIA[i];
    const isCurrent = m.start <= CURRENT_GREG_YEAR && m.end >= CURRENT_GREG_YEAR;
    html += `<div class="mill-block${isCurrent ? ' current' : ''}" data-action="zoom-century" data-milli="${i}">`;
    html += `<div class="mill-icon">${m.icon}</div>`;
    html += `<div class="mill-label">${m.label}</div>`;
    html += `<div class="mill-range">${m.start}–${m.end}</div>`;
    html += `<div class="mill-desc">${m.desc}</div>`;
    if (isCurrent) html += `<div class="mill-here">● You are here</div>`;
    html += `</div>`;
  }
  html += `</div></div>`;
  return html;
}

// ─── RENDER: CENTURY ───
function renderCentury() {
  const blocks = centuryBlocks(STATE.millenniumIdx);
  const m = MILLENNIA[STATE.millenniumIdx];
  let html = `<div class="view">`;
  html += `<div class="cv-title">${m.label} <span style="font-size:0.6em;opacity:0.5">${m.start}–${m.end}</span></div>`;
  html += `<div class="cv-subtitle">Click a century to see shemitah cycles</div>`;
  html += `<div class="cent-grid">`;
  for (const b of blocks) {
    const isCurrent = b.start <= CURRENT_GREG_YEAR && b.end >= CURRENT_GREG_YEAR;
    html += `<div class="cent-block${isCurrent ? ' current' : ''}" data-action="zoom-grid" data-cidx="${b.index}">`;
    html += `<div class="cent-label">${b.label}</div>`;
    if (isCurrent) html += `<div class="cent-here">●</div>`;
    html += `</div>`;
  }
  html += `</div></div>`;
  return html;
}

// ─── RENDER: SHEMITAH GRID ───
function renderShemitahGrid() {
  const currentHy = getCurrentHebYear();
  let curCycleStart = currentHy;
  while (curCycleStart % 7 !== 1) curCycleStart--;
  const curCycleIdx = Math.floor((curCycleStart - 1) / 7) + 1;
  const dataStart = Math.min(...Object.keys(YEARS).map(Number));
  const dataEnd = Math.max(...Object.keys(YEARS).map(Number));

  const centerCycle = STATE.centerCycle || curCycleIdx;
  const cycleStart = Math.max(1, centerCycle - 14);
  const cycleEnd = Math.min(centerCycle + 5, curCycleIdx + 2);
  STATE.sgWindow = { start: cycleStart, end: cycleEnd };

  const COL_LABELS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Shemitah'];
  let html = `<div class="shemitah-grid view"><div class="sg-row-header">`;
  COL_LABELS.forEach(h => { html += `<div class="sg-header-cell">${h}</div>`; });
  html += `</div>`;

  for (let ci = cycleStart; ci <= cycleEnd; ci++) {
    const isCurrent = ci === curCycleIdx;
    const cls = ['sg-row'];
    if (isCurrent) cls.push('current-cycle');
    html += `<div class="${cls.join(' ')}" data-ci="${ci}">`;
    html += `<div class="sg-cycle-label">Cycle ${ci}</div>`;
    // hyStart = 7*(ci-1)+1 so column 0 is year 1 (hy ≡ 1 mod 7), column 6 is shemitah (hy ≡ 0 mod 7)
    const hyStart = 7 * (ci - 1) + 1;
    for (let col = 0; col < 7; col++) {
      const hy = hyStart + col;
      const yd = YEARS[hy];
      const hasData = hy >= dataStart && hy <= dataEnd && yd;
      if (!hasData) {
        html += `<div class="sg-cell empty${col === 0 && ci === 1 ? ' sg-genesis-cell' : ''}">`;
        if (col === 0 && ci === 1) html += `<div class="sg-cell-placeholder">Genesis</div>`;
        html += `</div>`;
        continue;
      }
      const gYear = yd.gregYear;
      const cellCls = ['sg-cell'];
      if (yd.shemitah) cellCls.push('shemitah');
      if (hy % 7 === 1) cellCls.push('year1');
      if (isCurrent && hy === currentHy) cellCls.push('current');
      if (gYear < CURRENT_GREG_YEAR) cellCls.push('past');
      if (gYear > CURRENT_GREG_YEAR) cellCls.push('future');
      if (yd.jubileeNext && STATE.filters.jubilee) cellCls.push('jubilee-next-year');
      const eclipses = getEclipsesForHebYear(hy);
      const showEclipses = STATE.filters.eclipses ? eclipses : [];
      const cellEclipses = STATE.filters.propheticSigns ? showEclipses.filter(e => e.feastRelated || e.exceptional) : showEclipses;
      html += `<div class="${cellCls.join(' ')}" data-action="zoom-heb-year" data-hy="${hy}" data-gy="${gYear}">`;
      html += `<div class="sg-year">${gYear}–${gYear + 1}</div>`;
      html += `<div class="sg-hyear">${hy || ''}</div>`;
      if (cellEclipses.length > 0) {
        html += `<div class="sg-eclipses">`;
        for (const ec of cellEclipses) {
          const cls = eclipseIconClass(ec);
          html += `<span class="sg-ec-icon ${cls}" title="${ec.type}\n${ec.date}"></span>`;
        }
        html += `</div>`;
      } else if (showEclipses.length > 0) {
        html += `<div class="sg-no-events" style="opacity:0.4">—</div>`;
      } else {
        html += `<div class="sg-no-events">—</div>`;
      }
      // Phase A: Generic [Feast] / [Event] pills
      // Feast = feast-aligned eclipse (visible). Event = event + visible eclipse (potential sign by timing)
      const hasFeast = cellEclipses.some(e => e.feastRelated);
      const hasVisibleEclipse = cellEclipses.length > 0;
      const hasEvent = hasVisibleEclipse && EVENTS.some(e => e.year === gYear || e.hebYear === hy);
      if (hasFeast || hasEvent) {
        html += `<div class="sg-pills">`;
        if (hasFeast) html += `<span class="sg-pill feast">Feast</span>`;
        if (hasEvent) html += `<span class="sg-pill event">Event</span>`;
        html += `</div>`;
      }
      if (isCurrent && hy === currentHy) html += `<div class="sg-here">● We are Here</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ─── RENDER: SHEMITAH VIEWPORT (bottom panel) ───
function renderShemitahViewport() {
  const currentHy = getCurrentHebYear();
  let cs = currentHy;
  while (cs % 7 !== 1) cs--;
  const curCycleIdx = Math.floor((cs - 1) / 7) + 1;
  const yrInCycle = currentHy % 7 || 7;

  // Next shemitah
  let nextShe = currentHy;
  while (nextShe % 7 !== 0) nextShe++;
  const nextYd = YEARS[nextShe];

  // Visible cycles from current render (match renderShemitahGrid)
  const cycleStart = Math.max(1, (STATE.centerCycle || curCycleIdx) - 14);
  const cycleEnd = Math.min((STATE.centerCycle || curCycleIdx) + 5, curCycleIdx + 2);

  let html = `<div class="sg-viewport" id="sg-viewport">`;

  // Top-left: Current Cycle
  html += `<div class="sg-vp-block sg-vp-current">`;
  html += `<div class="sg-vp-label">Current Cycle</div>`;
  html += `<div class="sg-vp-value">Cycle ${curCycleIdx} · Year ${yrInCycle}/7</div>`;
  html += `<div class="sg-vp-bar"><div class="sg-vp-bar-fill" style="width:${(yrInCycle / 7) * 100}%"></div></div>`;
  html += `</div>`;

  // Top-right: Next Shemitah
  html += `<div class="sg-vp-block sg-vp-next">`;
  html += `<div class="sg-vp-label">Next Shemitah</div>`;
  html += `<div class="sg-vp-value">${nextShe} (${nextYd ? nextYd.gregYear + '\u2013' + (nextYd.gregYear + 1) : '?'})</div>`;
  html += `<div class="sg-vp-countdown" id="sg-countdown"></div>`;
  html += `</div>`;

  // Bottom-left: Celestial Events Legend
  html += `<div class="sg-vp-block sg-vp-legend-eclipses">`;
  html += `<div class="sg-vp-label">Celestial Events<span class="sg-vp-info">i<span class="sg-vp-info-tip">`;
  html += `<strong>How This Calendar Works</strong><br><br>`;
  html += `Eclipses from NASA's Five Millennium Canon (1800–2050). `;
  html += `Feasts follow <em>Genesis 1:14 KJV</em>: determined by observable new moons and full moons — not the later fixed rabbinical calendar with postponement rules.<br><br>`;
  html += `A ±1 day proximity check against the astronomical feast date catches standard postponement shifts. `;
  html += `Three transparent overrides correct a 28–29 day Metonic cycle mismatch in the fixed calendar for 2032–2033 (documented).<br><br>`;
  html += `Default view shows only feast-aligned eclipses — toggle <strong>Signs</strong> to see all eclipses independently.`;
  html += `</span></span></div>`;
  html += `<div class="sg-vp-legend-items">`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-solar"></span>Solar</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-lunar"></span>Lunar</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-hybrid"></span>Hybrid</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-blood"></span>Blood</span>`;
  html += `</div>`;
  html += `</div>`;

  // Bottom-right: Legend + Next Jubilee
  html += `<div class="sg-vp-block sg-vp-right">`;
  html += `<div class="sg-vp-label">Legend</div>`;
  html += `<div class="sg-vp-legend-items">`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-shemitah"></span>She</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-jubilee"></span>Jub</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-current"></span>Cur</span>`;
  html += `<span class="sg-vp-item"><span class="sg-vp-swatch sg-vp-sw-events"></span>Evt</span>`;
  html += `</div>`;
  const lastJubileeProclamation = 5782;
  const nextJubileeProclamation = lastJubileeProclamation + 49;
  const nextJubileeGreg = nextJubileeProclamation - 3761;
  const hasVisible = cycleEnd >= 819;
  html += `<div class="sg-vp-jubilee-note${!hasVisible ? ' dim' : ''}${!STATE.filters.jubilee ? ' hidden' : ''}">`;
  html += `<div class="sg-vp-jub-info">Next Jub: ~${nextJubileeGreg} CE <span class="sg-vp-jub-beyond">(beyond data)</span></div>`;
  if (!hasVisible) html += `<div class="sg-vp-jub-hint">Scroll back to see past jubilees</div>`;
  html += `</div>`;
  html += `</div>`;

  html += `</div>`;
  return html;
}

// ─── COUNTDOWN ───
let countdownInterval = null;
let sidebarCdInterval = null;

function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (sidebarCdInterval) { clearInterval(sidebarCdInterval); sidebarCdInterval = null; }
}

function startSidebarCountdowns() {
  if (sidebarCdInterval) clearInterval(sidebarCdInterval);
  function tick() {
    const els = document.querySelectorAll('.cntdwn-timer[data-target]');
    for (const el of els) {
      const d = new Date(el.dataset.target);
      const diff = d - Date.now();
      if (diff <= 0) { el.textContent = 'Now!'; continue; }
      const dd = Math.floor(diff / 86400000);
      const hh = Math.floor((diff % 86400000) / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      el.textContent = `${dd}d ${hh}h ${mm}m ${ss}s`;
    }
  }
  tick();
  sidebarCdInterval = setInterval(tick, 1000);
}

function startCountdown() {
  stopCountdown();
  const el = document.getElementById('sg-countdown');
  if (!el) return;
  const currentHy = getCurrentHebYear();
  let nextShe = currentHy;
  while (nextShe % 7 !== 0) nextShe++;
  const nextYd = YEARS[nextShe];
  if (!nextYd || !nextYd.tishri1) { el.textContent = '\u2014'; return; }
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(nextYd.tishri1 + 'T00:00:00');
  const dateLabel = MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  function tick() {
    const diff = d - Date.now();
    if (diff <= 0) { el.innerHTML = '<span class="sg-vp-countdown-num">Now!</span>'; stopCountdown(); return; }
    const dd = Math.floor(diff / 86400000);
    const hh = Math.floor((diff % 86400000) / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `<div class="sg-vp-countdown-end">Ends: ${dateLabel}</div><span class="sg-vp-countdown-num">${dd}d ${hh}h ${mm}m ${ss}s</span> away`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ─── RENDER: HEBREW YEAR ───
function renderHebYearView() {
  const hebYear = STATE.hebYear;
  const yd = YEARS[hebYear];
  if (!yd) return `<div class="view">Data not available</div>`;

  const events = getEventsForHebYear(hebYear);
  const eclipses = getEclipsesForHebYear(hebYear);
  const isCurrent = hebYear === getCurrentHebYear();

  let html = `<div class="year-view view">`;
  html += `<div class="yv-header">`;
  html += `<div class="yv-title">${yd.gregYear}–${yd.gregYear + 1} <span style="font-size:0.6em;opacity:0.5">/</span> ${hebYear}</div>`;
  html += `<div class="yv-subtitle">Tishri 1: ${formatDate(yd.tishri1)} · ${yd.isLeap ? 'Leap year' : 'Common year'}</div>`;
  if (yd.shemitah) html += `<span class="yv-badge shemitah">⚡ Shemitah Year</span>`;
  if (yd.jubileeNext && STATE.filters.jubilee) html += `<span class="yv-badge jubilee-next-year">⌛ Jubilee Proclaimed</span>`;
  if (isCurrent) html += `<span class="yv-badge" style="border-color:var(--red);color:var(--red)">● CURRENT</span>`;
  html += `</div><div class="yv-grid">`;

  // Reorder months to civil year order: Tishri first
  const tishriIdx = yd.months.findIndex(m => m.name === 'Tishri');
  const orderedMonths = tishriIdx > 0
    ? [...yd.months.slice(tishriIdx), ...yd.months.slice(0, tishriIdx)]
    : yd.months;

  for (const m of orderedMonths) {
    const monthEclipses = eclipses.filter(e => e.hebMonth === m.index);
    const hasEclipse = monthEclipses.length > 0;
    // Phase B: Specific feast/event pills for this month
    const monthFeastEclipses = monthEclipses.filter(e => e.feastRelated);
    const feastNames = [...new Set(monthFeastEclipses.map(e => e.feastName))];
    const feastDateMap = {};
    for (const fe of monthFeastEclipses) {
      if (!feastDateMap[fe.feastName]) feastDateMap[fe.feastName] = fe.date;
    }
    const monthEvents = events.filter(ev => {
      if (!ev.eventDate) return false;
      const [ey, em, ed] = ev.eventDate.split('-').map(Number);
      const evDate = new Date(ey, em - 1, ed);
      const mStart = new Date(m.gregStart);
      const mEnd = new Date(mStart);
      mEnd.setDate(mEnd.getDate() + m.days - 1);
      return evDate >= mStart && evDate <= mEnd;
    });
    const isCurrentMonth = isCurrent && (() => {
      const mStart = new Date(m.gregStart);
      const mEnd = new Date(mStart);
      mEnd.setDate(mEnd.getDate() + m.days);
      return TODAY >= mStart && TODAY < mEnd;
    })();
    const monthCls = ['yv-month'];
    if (isCurrentMonth) monthCls.push('current');
    html += `<div class="${monthCls.join(' ')}" data-action="zoom-month" data-hy="${hebYear}" data-mi="${m.index}">`;
    html += `<div class="yv-month-name">${m.name}${isCurrentMonth ? ' <span class="yv-here">● We are Here</span>' : ''}</div>`;
    if (feastNames.length > 0 || monthEvents.length > 0) {
      html += `<div class="yv-pills">`;
      for (const fn of feastNames) {
        const fd = feastDateMap[fn];
        const short = fd ? fd.split('-').slice(1).join('/') : '';
        html += `<span class="yv-pill feast${!STATE.filters.feasts ? ' filter-off' : ''}">${fn}${short ? ' ' + short : ''}</span>`;
      }
      for (const ev of monthEvents) html += `<span class="yv-pill event">${ev.event}</span>`;
      html += `</div>`;
    }
    html += `<div class="yv-month-tribe${!STATE.filters.tribes || !m.tribe ? ' filter-off' : ''}">${m.tribe || '\u00A0'}</div>`;
    if (m.theme) html += `<div class="yv-month-theme">${m.theme}</div>`;
    html += `<div class="yv-month-range">${formatDate(m.gregStart)}</div>`;
    html += `<div style="font-size:0.55rem;color:var(--text-muted)">${m.days} days</div>`;
    html += `<div class="yv-month-eclipses${!STATE.filters.eclipses || !hasEclipse ? ' filter-off' : ''}">`;
    if (hasEclipse) {
      for (const ec of monthEclipses) {
        const cls = eclipseClass(ec.type);
        html += `<div class="yv-eclipse ${cls}">${ec.type.includes('total') ? '●' : '○'} ${ec.type} (${ec.date})</div>`;
      }
    } else {
      html += `<span class="yv-eclipse-placeholder"></span>`;
    }
    html += `</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  if (events.length > 0 && STATE.filters.events) {
    html += `<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border-light)">`;
    html += `<div style="font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.5rem">Events This Year</div>`;
    for (const ev of events) {
      html += `<div style="font-size:0.7rem;color:var(--text-secondary);padding:0.15rem 0">`;
      html += `<span class="sg-event-dot ${ev.type}" style="margin-right:0.3rem">●</span>${ev.event}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

// ─── RENDER: MONTH ───
function renderMonthView() {
  const hebYear = STATE.hebYear;
  const monthIndex = STATE.monthIndex;
  const yd = YEARS[hebYear];
  if (!yd) return `<div class="view">Data not available</div>`;
  const monthData = yd.months.find(m => m.index === monthIndex);
  if (!monthData) return `<div class="view">Month data not available</div>`;
  const monthEclipses = getEclipsesForHebYearMonth(hebYear, monthIndex);

  const [gy, gm, gd] = monthData.gregStart.split('-').map(Number);
  const firstDate = new Date(gy, gm - 1, gd);
  const monStart = (firstDate.getDay() + 6) % 7;
  const daysInMonth = monthData.days;

  const feastLookup = {};
  for (const f of monthData.feasts) feastLookup[f.day] = f.name;
  const eclipseLookup = {};
  for (const ec of monthEclipses) eclipseLookup[ec.hebDay] = ec;
  const yearEvents = getEventsForHebYear(hebYear);
  const eventLookup = {};
  const monthStart = new Date(gy, gm - 1, gd);
  const monthEnd = new Date(monthStart);
  monthEnd.setDate(monthEnd.getDate() + daysInMonth - 1);
  for (const ev of yearEvents) {
    if (!ev.eventDate) continue;
    const [ey, em, ed] = ev.eventDate.split('-').map(Number);
    const evDate = new Date(ey, em - 1, ed);
    if (evDate >= monthStart && evDate <= monthEnd) {
      const hebDay = Math.round((evDate - monthStart) / 86400000) + 1;
      eventLookup[hebDay] = ev;
    }
  }

  const isCurrentHebYear = hebYear === getCurrentHebYear();

  let html = `<div class="month-view view">`;
  html += `<div class="mv-header">`;
  html += `<div><div class="mv-title">${monthData.name} ${hebYear}</div>`;
  if (monthData.tribe) html += `<div style="font-size:0.6rem;color:var(--text-muted);letter-spacing:0.15em">Tribe of ${monthData.tribe}</div>`;
  if (monthData.theme) html += `<div style="font-size:0.6rem;color:var(--gold);font-style:italic">${monthData.theme}</div>`;
  html += `</div><div style="text-align:right">`;
  html += `<div style="font-size:0.65rem;color:var(--text-secondary)">${formatDate(monthData.gregStart)}</div>`;
  html += `<div style="font-size:0.6rem;color:var(--text-muted)">${daysInMonth} days</div></div></div>`;

  html += `<div class="mv-grid">`;
  for (const d of DOW_NAMES) html += `<div class="mv-day-header">${d}</div>`;
  for (let i = 0; i < monStart; i++) html += `<div class="mv-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const classes = ['mv-day'];
    const dow = (monStart + day - 1) % 7;
    if (dow === 5 || dow === 6) classes.push('weekend');
    if (isCurrentHebYear) {
      const todayHD = new HDate(TODAY);
      if (todayHD.getDate() === day && todayHD.getMonth() === monthIndex) classes.push('today');
    }
    const isTodayDay = classes.includes('today');
    const dt = new Date(gy, gm - 1, gd + day - 1);
    const gy2 = dt.getFullYear(), gm2 = dt.getMonth() + 1, gd2 = dt.getDate();
    const feast = feastLookup[day];
    const eclipse = eclipseLookup[day];
    const event = eventLookup[day];
    const isSel = STATE.selectedDay && STATE.selectedDay.gy === gy2 && STATE.selectedDay.gm === gm2 && STATE.selectedDay.gd === gd2;
    if (isSel) classes.push('selected');
    html += `<div class="${classes.join(' ')}" data-action="zoom-day" data-gy="${gy2}" data-gm="${gm2}" data-gd="${gd2}">`;
    html += `<div class="mv-day-number">${day}</div>`;
    html += `<div class="mv-day-greg">${MONTH_NAMES_SHORT[gm2-1]} ${gd2}</div>`;
    if (feast) html += `<div class="mv-day-feast">✡ ${feast}</div>`;
    if (eclipse) html += `<div class="mv-day-eclipse">${eclipse.type.includes('total') ? '●' : '○'} ${eclipse.type}</div>`;
    if (event) html += `<div class="mv-day-event">● ${event.event}</div>`;
    if (isTodayDay) html += `<div class="mv-here">● We are Here</div>`;
    html += `</div>`;
  }
  html += `</div></div>`;
  return html;
}

// ─── RENDER: DAY ───
function renderDayView() {
  const day = STATE.selectedDay;
  if (!day) return `<div class="view">No day selected</div>`;
  const { gy, gm, gd } = day;
  const d = new Date(gy, gm - 1, gd);
  const info = getDayInfo(gy, gm, gd);
  const dow = DOW_NAMES_FULL[d.getDay()];
  const weekday = d.getDay();
  const isToday = gy === CURRENT_GREG_YEAR && gm === TODAY.getMonth() + 1 && gd === TODAY.getDate();
  const isWeekend = weekday === 5 || weekday === 6;

  let html = `<div class="day-view view">`;
  html += `<div class="dv-date-large">${MONTH_NAMES_SHORT[gm-1]} ${gd}, ${gy}</div>`;
  html += `<div class="dv-dow${isWeekend ? ' dv-weekend' : ''}">${dow}${isToday ? ' · Today' : ''}</div>`;
  if (isToday) html += `<div class="dv-here">● We are Here</div>`;

  if (info) {
    html += `<div class="dv-heb-section">`;
    html += `<div class="dv-heb-date">${info.hebDay} ${info.hebMonth}</div>`;
    html += `<div class="dv-heb-year">Hebrew Year ${info.hebYear}</div>`;
    html += `</div>`;

    html += `<div class="dv-badges">`;
    if (info.feast) html += `<span class="day-badge feast">✡ ${info.feast}</span>`;
    if (info.eclipse) {
      const cls = info.eclipse.includes('solar') ? 'solar' : 'lunar';
      html += `<span class="day-badge eclipse ${cls}">● ${info.eclipse}</span>`;
    }
    if (info.shemitah) html += `<span class="day-badge shemitah">⚡ Shemitah Year</span>`;
    if (info.jubileeNext && STATE.filters.jubilee) html += `<span class="day-badge jubilee-next-year">⌛ Jubilee Proclaimed</span>`;
    html += `</div>`;

    if (info.feast && info.eclipse) {
      html += `<div class="dv-note">Feast + eclipse on same date — statistically rare.</div>`;
    }
  }

  // Events on this date
  const dateStr = `${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')}`;
  const dayEvents = EVENTS.filter(e => e.eventDate === dateStr);
  const dayEclipses = ECLIPSES.filter(e => e.date === dateStr);
  if (dayEvents.length > 0 || dayEclipses.length > 0) {
    html += `<div class="dv-section">`;
    html += `<div class="dv-section-title">This Day in History</div>`;
    for (const ev of dayEvents) {
      html += `<div class="dv-event-card">`;
      html += `<div class="dv-event-head"><span class="event-marker ${ev.type}">●</span>${ev.event}</div>`;
      if (ev.description) html += `<div class="dv-event-desc">${ev.description}</div>`;
      if (ev.newsUrl) html += `<a class="dv-event-link" href="${ev.newsUrl}" target="_blank" rel="noopener">Read more at ${ev.newsSource || 'source'}</a>`;
      html += `</div>`;
    }
    for (const ec of dayEclipses) {
      html += `<div class="dv-event-card eclipse-card">`;
      html += `<div class="dv-event-head"><span class="event-marker eclipse">●</span>${ec.type}</div>`;
      html += `<div class="dv-event-desc">`;
      if (ec.magnitude) html += `Magnitude: ${ec.magnitude}. `;
      if (ec.feastRelated) html += `Occurs on ${ec.feastName} — a feast-aligned sign. `;
      if (!ec.feastRelated) html += `Not aligned to a biblical feast. `;
      html += `Type: ${ec.type}.`;
      html += `</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// ─── COMPONENT: NAV BAR ───
function renderNavBar() {
  let centerLabel = '', subLabel = '';
  const z = STATE.zoomLevel;

  if (z === 'millennia') { centerLabel = '6,000 Years'; subLabel = 'Biblical Timeline'; }
  else if (z === 'century') {
    const m = MILLENNIA[STATE.millenniumIdx];
    centerLabel = m.label; subLabel = `${m.start}–${m.end}`;
  } else if (z === 'greg-year') { centerLabel = `${STATE.centerGregYear}`; subLabel = 'Calendar'; }
  else if (z === 'shemitah-grid') {
    const cc = STATE.centerCycle || getCurrentCycle();
    centerLabel = 'Shemitah Cycles'; subLabel = `Cycle ${cc}`;
  } else if (z === 'heb-year') {
    const yd = YEARS[STATE.hebYear];
    if (yd) { centerLabel = `Hebrew Year ${STATE.hebYear}`; subLabel = `${yd.gregYear}–${yd.gregYear + 1}${yd.shemitah ? ' ⚡' : ''}`; }
  } else if (z === 'month') {
    const yd = YEARS[STATE.hebYear];
    if (yd) {
      const md = yd.months.find(m => m.index === STATE.monthIndex);
      if (md) { centerLabel = `${md.name} ${yd.gregYear}`; subLabel = `${md.tribe ? 'Tribe of ' + md.tribe : ''}${md.theme ? ' · ' + md.theme : ''}`; }
    }
  } else if (z === 'day') {
    if (STATE.selectedDay) {
      const { gy, gm, gd } = STATE.selectedDay;
      centerLabel = `${MONTH_NAMES_SHORT[gm-1]} ${gd}, ${gy}`;
      subLabel = 'Day View';
    }
  }

  // Build left/right nav buttons (rendered inside nav-center flanking the title)
  let leftBtn = '', rightBtn = '';
  if (z === 'shemitah-grid') {
    const b = getCycleBounds();
    const cc = STATE.centerCycle || getCurrentCycle();
    leftBtn = `<button class="nav-btn" data-action="nav-left"${cc <= b.min ? ' disabled' : ''}>← Prev Cycle</button>`;
    rightBtn = `<button class="nav-btn" data-action="nav-right"${cc >= b.max ? ' disabled' : ''}>Next Cycle →</button>`;
  } else if (z === 'heb-year') {
    leftBtn = `<button class="nav-btn" data-action="nav-left">← Prev Year</button>`;
    rightBtn = `<button class="nav-btn" data-action="nav-right">Next Year →</button>`;
  } else if (z === 'month') {
    leftBtn = `<button class="nav-btn" data-action="nav-left">← Prev Month</button>`;
    rightBtn = `<button class="nav-btn" data-action="nav-right">Next Month →</button>`;
  } else if (z === 'day') {
    leftBtn = `<button class="nav-btn" data-action="nav-left">← Prev Day</button>`;
    rightBtn = `<button class="nav-btn" data-action="nav-right">Next Day →</button>`;
  } else if (z === 'greg-year') {
    leftBtn = `<button class="nav-btn" data-action="nav-left">← ${STATE.centerGregYear - 1}</button>`;
    rightBtn = `<button class="nav-btn" data-action="nav-right">${STATE.centerGregYear + 1} →</button>`;
  }

  let html = `<div id="nav-bar"><div class="nav-left">`;
  if (STATE.viewStack.length > 0) html += `<button class="nav-btn" data-action="nav-back">← Back</button>`;
  html += `<span id="zoom-breadcrumb">${renderBreadcrumb()}</span>`;
  html += `</div>`;
  html += `<div class="nav-center">`;
  html += leftBtn;
  html += `<div class="nav-center-text"><div class="nav-title">${centerLabel}</div><div class="nav-subtitle">${subLabel}</div></div>`;
  html += rightBtn;
  html += `</div>`;
  html += `<div class="nav-right"></div></div>`;
  return html;
}

// ─── COMPONENT: BREADCRUMB ───
function renderBreadcrumb() {
  const parts = [];
  const z = STATE.zoomLevel;
  if (z === 'greg-year') {
    parts.push({ label: '6000 Years', action: 'bc-millennia' });
    parts.push({ label: 'Shemitah Cycles', action: 'bc-shemitah' });
    parts.push({ label: `${STATE.centerGregYear}`, action: '' });
  }
  parts.push({ label: '6000 Years', action: 'bc-millennia' });
  if (z === 'millennia') {
    parts.push({ label: 'Shemitah Cycles \u2192', action: 'bc-shemitah' });
  }
  if (z === 'century' || z === 'shemitah-grid' || z === 'heb-year' || z === 'month' || z === 'day') {
    const m = MILLENNIA[STATE.millenniumIdx];
    parts.push({ label: m.label, action: 'bc-century' });
  }
  if (z === 'shemitah-grid' || z === 'heb-year' || z === 'month' || z === 'day') {
    parts.push({ label: 'Shemitah Cycles', action: 'bc-shemitah' });
  }
  if (z === 'heb-year' || z === 'month' || z === 'day') {
    parts.push({ label: `Heb ${STATE.hebYear}`, action: 'bc-heb-year' });
  }
  if (z === 'month' || z === 'day') {
    const yd = YEARS[STATE.hebYear];
    if (yd) {
      const md = yd.months.find(m => m.index === STATE.monthIndex);
      if (md) parts.push({ label: md.name, action: 'bc-month' });
    }
  }
  if (z === 'day' && STATE.selectedDay) {
    const { gy, gm, gd } = STATE.selectedDay;
    parts.push({ label: `${MONTH_NAMES_SHORT[gm-1]} ${gd}`, action: 'bc-day' });
  }
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) html += `<span class="sep">›</span>`;
    html += `<span data-action="${parts[i].action}">${parts[i].label}</span>`;
  }
  return html;
}

// ─── COMPONENT: FILTERS ───
function renderFilters() {
  const z = STATE.zoomLevel;
  const filterVisibility = {
    shemitah: ['shemitah-grid', 'heb-year'],
    jubilee: ['shemitah-grid', 'heb-year'],
    eclipses: ['shemitah-grid', 'heb-year', 'month', 'day', 'greg-year'],
    feasts: ['heb-year', 'month', 'day', 'greg-year'],
    events: ['heb-year', 'month'],
    tribes: ['heb-year'],
    propheticSigns: ['shemitah-grid'],
  };
  const filterDefs = [
    { key: 'shemitah', label: 'Shemitah', cls: 'f-shemitah' },
    { key: 'jubilee', label: 'Jubilee', cls: 'f-jubilee' },
    { key: 'eclipses', label: 'Eclipses', cls: 'f-eclipses' },
    { key: 'propheticSigns', label: 'Signs Only', cls: 'f-prophetic-signs' },
    { key: 'feasts', label: 'Feasts', cls: 'f-feasts' },
    { key: 'events', label: 'Events', cls: 'f-events' },
    { key: 'tribes', label: 'Tribes', cls: 'f-tribes' },
  ];
  let html = `<div id="filter-bar"><span class="filter-label">Filters</span>`;
  for (const fd of filterDefs) {
    if (!filterVisibility[fd.key]?.includes(z)) continue;
    const active = STATE.filters[fd.key];
    html += `<button class="filter-btn ${fd.cls}${active ? ' active' : ''}" data-filter="${fd.key}">${fd.label}</button>`;
  }
  html += `</div>`;
  return html;
}

// ─── COMPONENT: EVENTS PANEL ───
// ─── COMPONENT: COUNTDOWN PANEL ───
function getOrderedMonths(yd) {
  const ti = yd.months.findIndex(m => m.name === 'Tishri');
  return ti > 0 ? [...yd.months.slice(ti), ...yd.months.slice(0, ti)] : yd.months;
}

function getNextFeastInfo() {
  const hy = getCurrentHebYear();
  const today = new Date();
  for (let y = hy; y <= HEBREW_END; y++) {
    const yd = YEARS[y];
    if (!yd) continue;
    const ordered = getOrderedMonths(yd);
    for (const m of ordered) {
      const [gy, gm, gd] = m.gregStart.split('-').map(Number);
      const ms = new Date(gy, gm - 1, gd);
      for (const f of m.feasts) {
        const fd = new Date(ms);
        fd.setDate(fd.getDate() + f.day - 1);
        if (fd > today) return { name: f.name, date: fd, monthName: m.name, hebYear: y };
      }
    }
  }
  return null;
}

function getNextEclipseInfo() {
  const today = new Date();
  const future = ECLIPSES.filter(e => new Date(e.date) > today).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (future.length === 0) return null;
  return future[0];
}

function getBoundaryInfo() {
  const hy = getCurrentHebYear();
  let start = hy;
  while (start % 7 !== 1) start--;
  const curCycleIdx = Math.floor((start - 1) / 7) + 1;
  const bHy = 7 * curCycleIdx;
  const bd = YEARS[bHy];
  return { cycle: curCycleIdx, bHy, gregYear: bd ? bd.gregYear : null, tishri1: bd ? bd.tishri1 : null };
}

function renderCountdownPanel() {
  const hy = getCurrentHebYear();
  const curCycleYear = hy % 7 || 7;
  const progress = ((curCycleYear - 1) / 7) * 100;

  const feast = getNextFeastInfo();
  const eclipse = getNextEclipseInfo();
  const boundary = getBoundaryInfo();

  let html = `<div class="cntdwn-panel">`;
  html += `<div class="cntdwn-title">Countdowns</div>`;

  // Next Feast
  html += `<div class="cntdwn-section">`;
  html += `<div class="cntdwn-label">Next Feast</div>`;
  if (feast) {
    const ds = MONTH_NAMES_SHORT[feast.date.getMonth()] + ' ' + feast.date.getDate();
    html += `<div class="cntdwn-name">${feast.name}</div>`;
    html += `<div class="cntdwn-sub">${feast.monthName} ${feast.hebYear} &middot; ${ds}</div>`;
    html += `<div class="cntdwn-timer" id="cntdwn-feast" data-target="${feast.date.toISOString()}">—</div>`;
  } else {
    html += `<div class="cntdwn-name">—</div>`;
  }
  html += `</div>`;

  // Next Eclipse
  html += `<div class="cntdwn-section">`;
  html += `<div class="cntdwn-label">Next Eclipse</div>`;
  if (eclipse) {
    const d = new Date(eclipse.date);
    const ds = MONTH_NAMES_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    const icon = eclipseClass(eclipse.type) === 'hybrid' ? '\u229A' : eclipse.type.includes('solar') ? '\u2299' : '\u25CF';
    html += `<div class="cntdwn-name">${icon} ${eclipse.type}</div>`;
    html += `<div class="cntdwn-sub">${ds}</div>`;
    html += `<div class="cntdwn-timer" id="cntdwn-eclipse" data-target="${eclipse.date}T00:00:00">—</div>`;
  } else {
    html += `<div class="cntdwn-name">—</div>`;
  }
  html += `</div>`;

  // Cycle Progress
  html += `<div class="cntdwn-section">`;
  html += `<div class="cntdwn-label">Cycle ${boundary.cycle} &middot; Yr ${curCycleYear}/7</div>`;
  html += `<div class="cntdwn-bar-track">`;
  html += `<div class="cntdwn-bar-fill" style="width:${progress}%"></div>`;
  html += `<div class="cntdwn-bar-dots">`;
  for (let i = 1; i <= 7; i++) {
    const active = i === curCycleYear;
    const isShe = i === 7;
    html += `<div class="cntdwn-dot${active ? ' active' : ''}${isShe ? ' she' : ''}" style="left:${((i-1)/6)*100}%"></div>`;
  }
  html += `</div></div>`;
  html += `<div class="cntdwn-sub" style="margin-top:0.15rem">${Math.round(progress)}% through cycle</div>`;
  html += `</div>`;

  // Next Boundary
  html += `<div class="cntdwn-section">`;
  html += `<div class="cntdwn-label">Next Boundary</div>`;
  if (boundary.tishri1) {
    html += `<div class="cntdwn-name">Rosh Hashanah ${boundary.gregYear}</div>`;
    html += `<div class="cntdwn-sub">Shemitah &middot; Dan&rsquo;s 70th week candidate</div>`;
    html += `<div class="cntdwn-timer" id="cntdwn-boundary" data-target="${boundary.tishri1}T00:00:00">—</div>`;
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}

// ─── MAIN RENDER ───
function render(animDir) {
  stopCountdown();
  const app = document.getElementById('app');
  if (!app) return;

  let html = '';
  html += `<div id="countdown-panel">${renderCountdownPanel()}</div>`;
  html += `<div id="main-content">`;
  html += renderNavBar();
  html += renderFilters();
  const z = STATE.zoomLevel;
  html += `<div id="view-container">`;

  if (z === 'millennia') html += renderMillennia();
  else if (z === 'century') html += renderCentury();
  else if (z === 'shemitah-grid') html += renderShemitahGrid();
  else if (z === 'heb-year') html += renderHebYearView();
  else if (z === 'month') html += renderMonthView();
  else if (z === 'day') html += renderDayView();
  else if (z === 'greg-year') html += renderGregYearView();

  html += `</div>`;
  html += `<div id="breadcrumb-bottom">${renderBreadcrumb()}</div>`;

  html += `</div>`;

  app.innerHTML = html;
  updateTimelineScroll();

  // Post-render: scroll to current cycle row (skip during filter toggles)
  if (z === 'heb-year') setTimeout(scrollToTishri, 50);
  if (z === 'shemitah-grid' && !STATE._filterToggle) {
    setTimeout(() => {
      const el = document.querySelector('.current-cycle');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, 50);
  }

  // ─── PERSISTENT VIEWPORT (outside app re-render) ───
  const vpAnchor = document.getElementById('viewport-anchor');
  if (vpAnchor) {
    if (z === 'shemitah-grid') {
      vpAnchor.style.display = '';
      if (!vpAnchor.querySelector('.sg-viewport')) {
        vpAnchor.innerHTML = renderShemitahViewport();
      }
      setTimeout(startCountdown, 100);
    } else {
      vpAnchor.style.display = 'none';
      stopCountdown();
    }
  }

  // Match scroll padding to viewport height
  if (z === 'shemitah-grid') setTimeout(adjustScrollPadding, 50);

  // Start sidebar countdowns always
  setTimeout(startSidebarCountdowns, 100);

  // Animate view transition
  if (animDir) transitionRender(animDir);
}

function scrollToTishri() {
  const container = document.getElementById('view-container');
  if (!container) return;
  const tishriMonth = container.querySelector('.gy-month-tishri');
  if (!tishriMonth) {
    const target = container.querySelector('[data-scroll-year]');
    if (target) {
      const firstMonth = target.querySelector('.gy-month');
      if (firstMonth) firstMonth.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return;
  }
  tishriMonth.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ─── NAVIGATION HELPERS ───
function captureState() {
  return {
    zoomLevel: STATE.zoomLevel, centerYear: STATE.centerYear,
    centerGregYear: STATE.centerGregYear,
    hebYear: STATE.hebYear, monthIndex: STATE.monthIndex,
    millenniumIdx: STATE.millenniumIdx, centuryIdx: STATE.centuryIdx,
    selectedDay: STATE.selectedDay,
    centerCycle: STATE.centerCycle,
  };
}

function pushState() {
  STATE.viewStack.push(captureState());
}

function getCycleBounds() {
  const currentHy = getCurrentHebYear();
  let cs = currentHy;
  while (cs % 7 !== 1) cs--;
  const curIdx = Math.floor((cs - 1) / 7) + 1;
  return { min: 1, max: curIdx + 2 };
}

function smoothScrollToCycle(ci) {
  const vc = document.getElementById('view-container');
  if (!vc) return;
  const row = vc.querySelector(`[data-ci="${ci}"]`);
  if (!row) return;
  const header = vc.querySelector('.sg-row-header');
  const headerH = header ? header.offsetHeight : 0;
  const vcRect = vc.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const offset = rowRect.top - vcRect.top;
  const target = offset - headerH;
  if (Math.abs(target) > 1) {
    vc.scrollBy({ top: target, behavior: 'smooth' });
  }
  updateNavBar();
}

function adjustScrollPadding() {
  const vp = document.getElementById('sg-viewport');
  const vc = document.getElementById('view-container');
  if (vp && vc) {
    vc.style.paddingBottom = (vp.offsetHeight + 12) + 'px';
  }
}

function updateNavBar() {
  const titleEl = document.querySelector('.nav-title');
  const subEl = document.querySelector('.nav-subtitle');
  if (!titleEl) return;
  const z = STATE.zoomLevel;
  const cc = STATE.centerCycle;
  if (z === 'shemitah-grid') {
    titleEl.textContent = 'Shemitah Cycles';
    subEl.textContent = cc ? `Cycle ${cc}` : '';
  }
}

function navigateLeft() {
  const z = STATE.zoomLevel;
  if (z === 'shemitah-grid') {
    const b = getCycleBounds();
    const target = Math.max(b.min, (STATE.centerCycle || getCurrentCycle()) - 1);
    STATE.centerCycle = target;
    if (target >= (STATE.sgWindow?.start || 0)) smoothScrollToCycle(target);
    else render();
  } else if (z === 'heb-year') {
    STATE.hebYear--;
    render('right');
  } else if (z === 'month') {
    STATE.monthIndex--;
    if (STATE.monthIndex < 1) { STATE.hebYear--; const py = YEARS[STATE.hebYear]; STATE.monthIndex = py ? py.months.length : 12; }
    STATE.selectedDay = null;
    render('right');
  } else if (z === 'day' && STATE.selectedDay) {
    const d = new Date(STATE.selectedDay.gy, STATE.selectedDay.gm - 1, STATE.selectedDay.gd - 1);
    STATE.selectedDay = { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
    render('right');
  } else if (z === 'greg-year') {
    STATE.centerGregYear--;
    render('right');
  }
}

function navigateRight() {
  const z = STATE.zoomLevel;
  if (z === 'shemitah-grid') {
    const b = getCycleBounds();
    const target = Math.min(b.max, (STATE.centerCycle || getCurrentCycle()) + 1);
    STATE.centerCycle = target;
    if (target <= (STATE.sgWindow?.end || Infinity)) smoothScrollToCycle(target);
    else render();
  } else if (z === 'heb-year') {
    STATE.hebYear++;
    render('left');
  } else if (z === 'month') {
    STATE.monthIndex++;
    const yd = YEARS[STATE.hebYear];
    if (yd && STATE.monthIndex > yd.months.length) { STATE.monthIndex = 1; STATE.hebYear++; }
    STATE.selectedDay = null;
    render('left');
  } else if (z === 'day' && STATE.selectedDay) {
    const d = new Date(STATE.selectedDay.gy, STATE.selectedDay.gm - 1, STATE.selectedDay.gd + 1);
    STATE.selectedDay = { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
    render('left');
  } else if (z === 'greg-year') {
    STATE.centerGregYear++;
    render('left');
  }
}

function navigateBack() {
  const prev = STATE.viewStack.pop();
  if (prev) {
    Object.assign(STATE, prev);
    render('out');
  }
}

function breadcrumbGo(targetZoom) {
  while (STATE.viewStack.length > 0) {
    const prev = STATE.viewStack.pop();
    Object.assign(STATE, prev);
    const zLevels = ['millennia', 'century', 'shemitah-grid', 'greg-year', 'heb-year', 'month', 'day'];
    const curIdx = zLevels.indexOf(STATE.zoomLevel);
    const tgtIdx = zLevels.indexOf(targetZoom);
    if (curIdx <= tgtIdx) break;
  }
  STATE.zoomLevel = targetZoom;
  render('out');
}

// ─── EVENT HANDLING ───
function setupEvents() {
  const app = document.getElementById('app');
  if (!app) return;

  app.addEventListener('click', e => {
    const target = e.target.closest('[data-action]') || e.target.closest('[data-filter]');
    if (!target) return;
    if (target.disabled) return;

    if (target.dataset.filter) {
      const key = target.dataset.filter;
      STATE.filters[key] = !STATE.filters[key];
      // Targeted re-render: update filter buttons + grid content only.
      // Avoid full render() which destroys/recreates the DOM and kills countdowns.
      const vc = document.getElementById('view-container');
      const savedScroll = vc ? vc.scrollTop : 0;
      // Update filter button classes
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter) btn.classList.toggle('active', !!STATE.filters[btn.dataset.filter]);
      });
      // Re-render grid content only
      if (vc) {
        const z = STATE.zoomLevel;
        let gridHtml = '';
        if (z === 'millennia') gridHtml += renderMillennia();
        else if (z === 'century') gridHtml += renderCentury();
        else if (z === 'shemitah-grid') gridHtml += renderShemitahGrid();
        else if (z === 'heb-year') gridHtml += renderHebYearView();
        else if (z === 'month') gridHtml += renderMonthView();
        else if (z === 'day') gridHtml += renderDayView();
        else if (z === 'greg-year') gridHtml += renderGregYearView();
        vc.innerHTML = gridHtml;
      }
      // Restore scroll
      if (STATE.zoomLevel === 'shemitah-grid') {
        setTimeout(() => { const c = document.getElementById('view-container'); if (c) c.scrollTop = savedScroll; }, 10);
      }
      // Update breadcrumb
      if (bc) bc.innerHTML = renderBreadcrumb();
      // Jubilee note
      if (STATE.zoomLevel === 'shemitah-grid' && key === 'jubilee') {
        const note = document.querySelector('.sg-vp-jubilee-note');
        if (note) note.classList.toggle('hidden', !STATE.filters.jubilee);
        setTimeout(adjustScrollPadding, 50);
      }
      return;
    }

    const action = target.dataset.action;

    switch (action) {
      case 'zoom-century': {
        const mi = parseInt(target.closest('[data-milli]')?.dataset.milli);
        if (mi !== undefined && !isNaN(mi)) {
          pushState();
          STATE.millenniumIdx = mi;
          STATE.centuryIdx = 0;
          STATE.zoomLevel = 'century';
          render('in');
        }
        break;
      }
      case 'zoom-grid': {
        const cidx = parseInt(target.dataset.cidx);
        if (cidx !== undefined && !isNaN(cidx)) STATE.centuryIdx = cidx;
        const blocks = centuryBlocks(STATE.millenniumIdx);
        const block = blocks[STATE.centuryIdx];
        const midGreg = block ? Math.floor((block.start + block.end) / 2) : CURRENT_GREG_YEAR;
        pushState();
        STATE.zoomLevel = 'shemitah-grid';
        STATE.centerCycle = gregYearToCycle(midGreg);
        render('in');
        break;
      }
      case 'zoom-heb-year': {
        const hy = parseInt(target.closest('[data-hy]')?.dataset.hy);
        const gy = parseInt(target.closest('[data-gy]')?.dataset.gy);
        if (hy) {
          pushState();
          STATE.zoomLevel = 'heb-year';
          STATE.hebYear = hy;
          STATE.centerGregYear = gy || STATE.centerGregYear;
          STATE.centerYear = gy || STATE.centerYear;
          render('in');
        }
        break;
      }
      case 'zoom-month': {
        const hy2 = parseInt(target.closest('[data-hy]')?.dataset.hy);
        const mi2 = parseInt(target.closest('[data-mi]')?.dataset.mi);
        if (hy2 && mi2) {
          pushState();
          STATE.zoomLevel = 'month';
          STATE.hebYear = hy2;
          STATE.monthIndex = mi2;
          STATE.selectedDay = null;
          render('in');
        }
        break;
      }
      case 'zoom-day': {
        const gy2 = parseInt(target.closest('[data-gy]')?.dataset.gy);
        const gm2 = parseInt(target.closest('[data-gm]')?.dataset.gm);
        const gd2 = parseInt(target.closest('[data-gd]')?.dataset.gd);
        if (gy2 && gm2 && gd2) {
          pushState();
          STATE.selectedDay = { gy: gy2, gm: gm2, gd: gd2 };
          STATE.zoomLevel = 'day';
          render('in');
        }
        break;
      }
      case 'nav-back': {
        navigateBack();
        break;
      }
      case 'nav-left': {
        navigateLeft();
        break;
      }
      case 'nav-right': {
        navigateRight();
        break;
      }
      case 'jump-year': {
        const year = parseInt(target.closest('[data-gy]')?.dataset.gy);
        if (year) {
          pushState();
          STATE.centerGregYear = year;
          STATE.zoomLevel = 'greg-year';
          render('in');
        }
        break;
      }
      case 'zoom-greg-month': { break; }
      // Breadcrumb navigation
      case 'bc-greg-year': break;
      case 'bc-millennia': breadcrumbGo('millennia'); break;
      case 'bc-century': breadcrumbGo('century'); break;
      case 'bc-shemitah': breadcrumbGo('shemitah-grid'); break;
      case 'bc-heb-year': breadcrumbGo('heb-year'); break;
      case 'bc-month': breadcrumbGo('month'); break;
      case 'bc-day': breadcrumbGo('day'); break;
    }
  });
}

function updateTimelineScroll() {
  const panel = document.getElementById('countdown-panel');
  if (!panel) return;
  const active = panel.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ─── KEYBOARD ───
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') document.querySelector('[data-action="nav-left"]')?.click();
  else if (e.key === 'ArrowRight') document.querySelector('[data-action="nav-right"]')?.click();
  else if (e.key === 'Escape') document.querySelector('[data-action="nav-back"]')?.click();
});

// ─── RENDER GREGORIAN YEAR VIEW ───
function renderGregYearView() {
  const year = STATE.centerGregYear;
  const isCurrentYear = year === CURRENT_GREG_YEAR;
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };

  let html = `<div class="gy-view view">`;
  for (let mi = 0; mi < 12; mi++) {
    const gm = mi + 1;
    const daysInMonth = new Date(year, gm, 0).getDate();
    const firstDow = new Date(year, mi, 1).getDay();
    const hebMonths = [];
    for (const [hy, yd] of Object.entries(YEARS)) {
      for (const md of yd.months) {
        const gs = md.gregStart;
        if (!gs) continue;
        const [gsy, gsm, gsd] = gs.split('-').map(Number);
        if (gsy === year && gsm === gm) { hebMonths.push(md); break; }
        if (gsy === year && gsm < gm) {
          const endDate = new Date(gsy, gsm - 1, gsd + (md.days || 30));
          if (endDate.getMonth() + 1 >= gm && endDate.getFullYear() === year) { hebMonths.push(md); break; }
        }
      }
    }
    if (hebMonths.length === 0) {
      for (const [hy, yd] of Object.entries(YEARS)) {
        for (const md of yd.months) {
          const gs = md.gregStart;
          if (!gs) continue;
          const [gsy, gsm, gsd] = gs.split('-').map(Number);
          const endDate = new Date(gsy, gsm - 1, gsd + (md.days || 30));
          const monthStart = new Date(year, mi, 1);
          const monthEnd = new Date(year, gm, 0);
          if (endDate >= monthStart && new Date(gsy, gsm - 1, gsd) <= monthEnd) {
            if (!hebMonths.find(m => m.name === md.name)) hebMonths.push(md);
          }
        }
      }
    }
    const hebLabel = hebMonths.map(m => m.name).join('·');

    html += `<div class="gy-month">`;
    html += `<div class="gy-month-head" data-action="zoom-greg-month" data-gm="${gm}" data-gy="${year}">`;
    html += `<span class="gy-month-name">${MONTH_NAMES[mi]}</span>`;
    if (hebLabel) html += `<span class="gy-month-heb">(${hebLabel})</span>`;
    html += `</div>`;
    html += `<div class="gy-dow">`;
    ['S','M','T','W','T','F','S'].forEach(d => html += `<span>${d}</span>`);
    html += `</div>`;
    html += `<div class="gy-grid">`;
    for (let b = 0; b < firstDow; b++) html += `<div class="gy-day gy-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const info = getDayInfo(year, gm, d);
      let cls = 'gy-day';
      const isToday = isCurrentYear && gm === today.m && d === today.d;
      if (isToday) cls += ' gy-today';
      if (info && STATE.filters.feasts && info.feast) cls += ' gy-has-feast';
      if (info && STATE.filters.eclipses && info.eclipse) cls += ' gy-has-eclipse';
      const isSel = STATE.selectedDay && STATE.selectedDay.gy === year && STATE.selectedDay.gm === gm && STATE.selectedDay.gd === d;
      if (isSel) cls += ' gy-selected';
      html += `<div class="${cls}" data-action="zoom-day" data-gy="${year}" data-gm="${gm}" data-gd="${d}">`;
      html += `<span class="gy-num">${d}</span>`;
      if (info) html += `<span class="gy-heb-num">${info.hebDay}</span>`;
      if (isToday) html += `<span class="gy-here">● We are Here</span>`;
      if (info && STATE.filters.feasts && info.feast) html += `<span class="gy-marker feast" title="${info.feast}"></span>`;
      if (info && STATE.filters.eclipses && info.eclipse) html += `<span class="gy-marker eclipse" title="${info.eclipse}"></span>`;
      html += `</div>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  return html;
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  // Clear stale sessionStorage from earlier buggy versions
  try {
    const saved = sessionStorage.getItem('tlg_calendar_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Version < 2: clear everything (stale state from removed features)
      if (!parsed._v || parsed._v < 2) {
        sessionStorage.removeItem('tlg_calendar_state');
      }
    }
  } catch (e) { sessionStorage.removeItem('tlg_calendar_state'); }

  // Restore saved state from sessionStorage (survives page refresh)
  let restored = false;
  try {
    const saved = sessionStorage.getItem('tlg_calendar_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Invalidate stale states from removed features (toggle-cycle-view is gone)
      if (parsed.zoomLevel === 'greg-year' && !parsed._viaLegitNav) {
        sessionStorage.removeItem('tlg_calendar_state');
      } else {
        // Merge filters with defaults so missing filter keys stay at default
        const defaultFilters = { ...STATE.filters };
        Object.assign(STATE, parsed);
        STATE.filters = { ...defaultFilters, ...(parsed.filters || {}) };
        // Restore viewStack from saved state (needed for back navigation after refresh)
        STATE.viewStack = Array.isArray(parsed.viewStack) ? parsed.viewStack : [];
        restored = true;
      }
    }
  } catch (e) { /* ignore corrupt save */ }

  // Safety: drill-down views need a viewStack to navigate back.
  // If empty, fall back to shemitah-grid so user isn't stuck.
  if (restored && STATE.viewStack.length === 0) {
    const drillDown = ['heb-year', 'month', 'day'];
    if (drillDown.includes(STATE.zoomLevel)) {
      STATE.zoomLevel = 'shemitah-grid';
    }
  }

  // If no saved state, use defaults based on current date
  if (!restored) {
    STATE.centerGregYear = CURRENT_GREG_YEAR;
    STATE.centerYear = CURRENT_GREG_YEAR;
    STATE.hebYear = getCurrentHebYear();
    for (let i = 0; i < MILLENNIA.length; i++) {
      if (CURRENT_GREG_YEAR >= MILLENNIA[i].start && CURRENT_GREG_YEAR <= MILLENNIA[i].end) {
        STATE.millenniumIdx = i;
        const blocks = centuryBlocks(i);
        for (let j = 0; j < blocks.length; j++) {
          if (CURRENT_GREG_YEAR >= blocks[j].start && CURRENT_GREG_YEAR <= blocks[j].end) {
            STATE.centuryIdx = j;
            break;
          }
        }
        break;
      }
    }
  }

  render();
  setupEvents();
});

// Save state to sessionStorage before unload so refresh restores the view
window.addEventListener('beforeunload', () => {
  try {
    const save = {
      _v: 2,
      zoomLevel: STATE.zoomLevel,
      millenniumIdx: STATE.millenniumIdx,
      centuryIdx: STATE.centuryIdx,
      centerCycle: STATE.centerCycle,
      centerGregYear: STATE.centerGregYear,
      centerYear: STATE.centerYear,
      hebYear: STATE.hebYear,
      selectedDay: STATE.selectedDay,
      filters: STATE.filters,
      viewStack: STATE.viewStack,
      _viaLegitNav: true,
    };
    sessionStorage.setItem('tlg_calendar_state', JSON.stringify(save));
  } catch (e) { /* ignore save failure */ }
});
