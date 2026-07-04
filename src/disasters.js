import israelOutline from './israel-boundary.json';

/* ── Natural Disaster Tracker ── */

const TYPE_COLORS = {
  earthquake: '#EF4444',
  flood: '#3B82F6',
  cyclone: '#F59E0B',
  volcano: '#8B5CF6',
  wildfire: '#F97316',
  fireball: '#FF6B35',
};
const TYPE_LABELS = {
  earthquake: 'Earthquake',
  flood: 'Flood',
  cyclone: 'Cyclone',
  volcano: 'Volcano',
  wildfire: 'Wildfire',
  fireball: 'Fireball',
};
const TYPE_ICONS = { earthquake: '●', flood: '▲', cyclone: '◆', volcano: '★', wildfire: '◆', fireball: '☄' };

let events = [];
let filteredEvents = [];
let isPlaying = false;
let playDirection = 'forward';
let magFilter = 2.5;
let enabledTypes = new Set(['earthquake', 'flood', 'cyclone', 'volcano', 'wildfire', 'fireball']);
let currentTime = Date.now();
let mapReady = false;
let graphData = [];
let selectedYear = new Date().getFullYear();
let requestId = 0;
import eonetHistoryData from './eonet-history.json';
let initialLoad = true;
let pulseTimer = null;
let beaconMarkers = {};
let pendingAutoStop = false;
let refreshTimer = null;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const NUM_PLAY_STEPS = 200;
const DEDUP_TIME_MS = 12 * 3600 * 1000;
const DEDUP_DISTANCE_KM = 50;
const EQ_PAGE_LIMIT = 20000;
const FRAMES_PER_STEP = 6;
const TITLE_MAX_LEN = 28;
const TITLE_TRUNC_LEN = 25;
let sortedEvents = [];
let stepEventCounts = [];
let currentStep = 0;

/* ── Dedup ── */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dedupEvents(arr) {
  if (arr.length < 2) return arr;
  const keep = new Array(arr.length).fill(true);
  for (let i = 0; i < arr.length; i++) {
    const isDupCandidate = arr[i].id.startsWith('gdacs-') || arr[i].id.startsWith('eonet-') || arr[i].id.startsWith('kvert-');
    if (!isDupCandidate) continue;
    if (!keep[i]) continue;
    for (let j = 0; j < arr.length; j++) {
      if (i === j || !keep[j]) continue;
      if (arr[i].type !== arr[j].type) continue;
      if (Math.abs(arr[i].timestamp - arr[j].timestamp) > DEDUP_TIME_MS) continue;
      if (haversineKm(arr[i].lat, arr[i].lng, arr[j].lat, arr[j].lng) > DEDUP_DISTANCE_KM) continue;
      keep[i] = false;
      break;
    }
  }
  return arr.filter((_, i) => keep[i]);
}

function computeStepBuckets() {
  if (events.length === 0) { sortedEvents = []; stepEventCounts = []; return; }
  sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const total = sortedEvents.length;
  const perStep = Math.ceil(total / NUM_PLAY_STEPS);
  stepEventCounts = [];
  let cumulative = 0;
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    cumulative += perStep;
    stepEventCounts.push(Math.min(cumulative, total));
  }
  stepEventCounts[NUM_PLAY_STEPS - 1] = total;
  currentStep = 0;
}

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'basemap': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      },
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'basemap' }],
    bgColor: '#0a0a14',
  },
  center: [10, 30],
  zoom: 1,
  attributionControl: false,
  minZoom: 1,
});

map.on('load', () => {
  mapReady = true;
  initLayers();
  if (events.length > 0) {
    computeStepBuckets();
    initBucketLayers();
  }
  renderAll();
  /* Default to Last 30 Days mode */
  isLast30Mode = true;
  fpLast30.classList.add('active');
  if (fpYearSelect) fpYearSelect.disabled = true;
  loadLast30DaysBeacons().then(() => {
    initialLoad = false;
    startRefresh();
  });
});

populateYearDropdown();
loadHistoricalEarthquakeData();

/* ── Feed Status Tracking ── */
const feedStatus = { USGS: 'pending', EONET: 'pending', GDACS: 'pending', Fireball: 'pending', KVERT: 'pending' };

function updateDataSourceLabel(year) {
  const active = Object.entries(feedStatus).filter(([_, s]) => s === 'ok').map(([n]) => n);
  const down = Object.entries(feedStatus).filter(([_, s]) => s === 'fail').map(([n]) => n);
  const label = document.getElementById('data-source');
  let text = `${active.join(' + ') || 'No data'} ${year} — ${events.length.toLocaleString()} events`;
  if (down.length > 0) text += ` · ${down.join(', ')} unavailable`;
  if (label) label.textContent = text;
}

// Initial load — skip year data, default to Last 30 Days
// loadYearData() deferred to map.on('load') if not in 30-day mode

setupBibleVerses();

/* ── Year Dropdown ── */
function populateYearDropdown() {
  const select = document.getElementById('fp-year');
  const cy = new Date().getFullYear();
  for (let y = cy; y >= 2000; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === cy) opt.selected = true;
    select.appendChild(opt);
  }
}

document.getElementById('fp-year').addEventListener('change', function() {
  const year = parseInt(this.value);
  if (year === selectedYear) return;
  selectedYear = year;
  switchYear(year);
});

/* ── Year Switching ── */
async function switchYear(year, isRefresh) {
  stopPlay();
  stopPulse();
  const cy = new Date().getFullYear();
  const id = ++requestId;

  if (!isRefresh) {
    document.getElementById('tl-label-start').textContent = '—';
    document.getElementById('tl-label-end').textContent = '—';
    document.getElementById('tl-label-current').textContent = '—';
    showMapLoading(`Loading ${year}...`);
  }

  const workingEvents = [];
  const isCurrent = year === cy;

  Object.keys(feedStatus).forEach(k => { feedStatus[k] = 'pending'; });

  const feedTasks = [
    ['USGS', loadHistoricalEarthquakeYear(year, workingEvents)],
    ['EONET', loadEONET(workingEvents, year)],
    ['GDACS', loadGDACS(workingEvents, year)],
    ['Fireball', loadFireballs(workingEvents)],
  ];
  if (isCurrent) feedTasks.push(['KVERT', loadKVERT(workingEvents)]);

  for (const [name, task] of feedTasks) {
    try { await task; feedStatus[name] = 'ok'; } catch (_) { feedStatus[name] = 'fail'; }
    if (id !== requestId) return;
    if (!isRefresh && workingEvents.length > 0) {
      const deduped = dedupEvents(workingEvents);
      events = deduped;
      computeStepBuckets();
      initBucketLayers();
      if (initialLoad) initialLoad = false;
      renderAll();
      drawComposition();
    }
  }

  if (id !== requestId) return;

  const deduped = dedupEvents(workingEvents);
  events = deduped;
  computeStepBuckets();

  if (isRefresh) {
    initBucketLayers();
    renderAll();
    const savedStep = currentStep;
    applyFilters(true);
    showBucketsUpTo(savedStep);
    lastVisibleStep = savedStep;
  }

  if (workingEvents.length === 0) { hideMapLoading(); return; }
  hideMapLoading();
  updateDataSourceLabel(year);

  if (isCurrent) startPulse();
  setTimeout(refreshAllGraphs, 100);
}

/* ── Periodic Refresh ── */
function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(() => {
    const cy = new Date().getFullYear();
    if (selectedYear === cy) switchYear(cy, true);
  }, REFRESH_INTERVAL);
}
function stopRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

/* ── Initial Load ── */
async function loadYearData() {
  const cy = new Date().getFullYear();
  selectedYear = cy;
  await switchYear(cy);
  initialLoad = false;
  startRefresh();
}

function renderAll() {
  if (!mapReady) return;
  if (initialLoad && events.length === 0) return;
  updateTimelineRange();
  applyFilters();

  updateAlertPanel();
  updateToggleCounts();
  updateBeacon();
}

/* ── Map Layers ── */
function initLayers() {
  map.addSource('beacon-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'beacon-layer',
    type: 'circle',
    source: 'beacon-source',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['case', ['==', ['get', 'isFirst'], 1], 22, 12],
      'circle-opacity': 0,
      'circle-stroke-width': 0,
    },
  });

  map.addLayer({
    id: 'beacon-glow-layer',
    type: 'circle',
    source: 'beacon-source',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['case', ['==', ['get', 'isFirst'], 1], 45, 24],
      'circle-opacity': 0,
      'circle-blur': 0.65,
      'circle-stroke-width': 0,
    },
  });

  map.addLayer({
    id: 'beacon-dot-layer',
    type: 'circle',
    source: 'beacon-source',
    paint: {
      'circle-color': '#fff',
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'isFirst'],
        0, 3, 1, 5.5,
      ],
      'circle-opacity': 1,
      'circle-stroke-width': 0,
    },
  });

  map.addSource('beacon-leader-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'beacon-leader-layer',
    type: 'line',
    source: 'beacon-leader-source',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1,
      'line-opacity': 0.3,
    },
  });

  /* Click + hover on beacon layers */
  ['beacon-layer', 'beacon-glow-layer', 'beacon-dot-layer'].forEach(id => {
    map.on('click', id, (e) => {
      if (e.features?.length > 0) showEventPopup(e.features[0].properties, e.lngLat);
    });
    map.on('mouseenter', id, (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features?.length > 0) showHoverTooltip(e, e.features[0].properties);
    });
    map.on('mousemove', id, (e) => {
      if (e.features?.length > 0) {
        hoverTooltip.style.left = `${e.originalEvent.clientX + 12}px`;
        hoverTooltip.style.top = `${e.originalEvent.clientY - 8}px`;
      }
    });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; hideHoverTooltip(); });
  });

  /* ── Israel Outline ── */
  map.addSource('israel-outline', { type: 'geojson', data: israelOutline });
  map.addLayer({
    id: 'israel-fill',
    type: 'fill',
    source: 'israel-outline',
    paint: { 'fill-color': '#D4AF37', 'fill-opacity': 0.04 },
  });
  map.addLayer({
    id: 'israel-glow-outer',
    type: 'line',
    source: 'israel-outline',
    paint: { 'line-color': '#D4AF37', 'line-width': 6, 'line-blur': 5, 'line-opacity': 0.25 },
  });
  map.addLayer({
    id: 'israel-glow-inner',
    type: 'line',
    source: 'israel-outline',
    paint: { 'line-color': '#FFD700', 'line-width': 2.5, 'line-blur': 1.5, 'line-opacity': 0.5 },
  });
  map.addLayer({
    id: 'israel-glow-core',
    type: 'line',
    source: 'israel-outline',
    paint: { 'line-color': '#FFDF00', 'line-width': 1, 'line-blur': 0, 'line-opacity': 0.85 },
  });
}

/* ── Data Loading: Historical ── */
async function loadHistoricalEarthquakeYear(year, target) {
  const arr = target || [];
  let offset = 1;
  const limit = EQ_PAGE_LIMIT;
  let totalResults = null;

  while (totalResults === null || offset <= totalResults) {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${year}-01-01&endtime=${year}-12-31&minmagnitude=2.5&orderby=time&limit=${limit}&offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`FDSN fetch failed for ${year}`);
    const data = await resp.json();
    if (!data || !data.features || data.features.length === 0) break;

    const cy = new Date().getFullYear();
    const maxYear = year;
    data.features.forEach(f => {
      const props = f.properties;
      const coords = f.geometry.coordinates;
      const mag = props.mag || 0;
      const time = props.time || Date.now();
      const y = new Date(time).getFullYear();
      if (y > maxYear) return;
      arr.push({
        id: `eq-${props.net}-${props.code}-${time}`,
        type: 'earthquake',
        lat: coords[1],
        lng: coords[0],
        magnitude: mag,
        depth: coords[2] || 0,
        timestamp: time,
        title: props.place || 'Unknown location',
        description: `M ${mag.toFixed(1)} — ${props.place || 'Unknown'}`,
        url: props.url || '',
        color: TYPE_COLORS.earthquake,
      });
    });

    if (totalResults === null) {
      totalResults = data.metadata.count;
    }

    if (data.features.length < limit) break;
    offset += limit;
  }

  if (!target) return arr;
}

/* ── Data Loading: EONET & GDACS ── */
async function loadEONET(target, year) {
  try {
    const data = await fetchEONET(year);
    if (data && data.features) {
      parseEONET(data, target);
    }
  } catch (e) {
    console.warn('EONET load failed:', e);
  }
}

async function loadFireballs(target) {
  try {
    const data = await fetchFireballs();
    if (data) parseFireballs(data, target);
  } catch (e) {
    console.warn('Fireball load failed:', e);
  }
}

async function fetchFireballs() {
  const resp = await fetch('/api/fireball?limit=200');
  if (!resp.ok) throw new Error('Fireball API fetch failed');
  return resp.json();
}

function parseFireballs(data, target) {
  if (!data || !data.data) return;
  const arr = target || events;
  data.data.forEach(row => {
    const date = row[0];
    if (!date) return;
    const t = new Date(date).getTime();
    if (new Date(t).getFullYear() !== selectedYear) return;
    const impactE = row[2] ? parseFloat(row[2]) : 0;
    arr.push({
      id: `fb-${date}`,
      type: 'fireball',
      lat: row[3] ? parseFloat(row[3]) * (row[4] === 'S' ? -1 : 1) : 0,
      lng: row[5] ? parseFloat(row[5]) * (row[6] === 'W' ? -1 : 1) : 0,
      magnitude: impactE,
      depth: row[7] ? parseFloat(row[7]) : 0,
      timestamp: t,
      title: `${impactE >= 1 ? impactE.toFixed(2) + ' kt' : (impactE * 1000).toFixed(0) + ' t TNT'} impact`,
      description: row[7] ? `Altitude: ${row[7]} km · Velocity: ${row[8] || '?'} km/s` : 'Fireball event',
      url: '',
      color: TYPE_COLORS.fireball,
    });
  });
}

async function loadGDACS(target, year) {
  try {
    const data = await fetchGDACS(year);
    if (data && data.features) {
      parseGDACS(data, target);
    }
  } catch (e) {
    console.warn('GDACS load failed:', e);
  }
}

async function fetchGDACS(year) {
  const cy = new Date().getFullYear();
  let url = '/api/gdacs/events4app';
  if (year !== cy) {
    url += `?startdate=${year}-01-01&enddate=${year}-12-31`;
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('GDACS fetch failed');
  return resp.json();
}

async function fetchEONET(year) {
  const categories = 'volcanoes,wildfires,floods,severeStorms';
  const cy = new Date().getFullYear();
  if (year === cy) {
    const [openData, closedData] = await Promise.all([
      fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=open`).then(r => r.json()),
      fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=closed&start=${year}-01-01&end=${year}-12-31`).then(r => r.json()),
    ]);
    if (!openData || !closedData) throw new Error('EONET fetch failed');
    return { ...openData, features: [...(openData.features || []), ...(closedData.features || [])] };
  } else {
    const resp = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=closed&start=${year}-01-01&end=${year}-12-31`);
    if (!resp.ok) throw new Error('EONET fetch failed');
    return resp.json();
  }
}

/* ── KVERT VONA Feed (real-time Kamchatka/Kuriles) ── */
const KVERT_COORDS = {
  sheveluch:  { lat: 56.653, lng: 161.36 },
  bezymianny: { lat: 55.972, lng: 160.595 },
  krasheninnikov: { lat: 54.596, lng: 160.27 },
  kizimen:    { lat: 55.131, lng: 160.32 },
  klyuchevskoy:  { lat: 56.056, lng: 160.642 },
  karymsky:   { lat: 54.048, lng: 159.443 },
  zhupanovsky: { lat: 53.591, lng: 159.148 },
  avachinsky: { lat: 53.256, lng: 158.836 },
  koryaksky:  { lat: 53.321, lng: 158.688 },
  mutnovsky:  { lat: 52.449, lng: 158.195 },
  gorely:     { lat: 52.559, lng: 158.03 },
  alaid:      { lat: 50.861, lng: 155.565 },
  ebeko:      { lat: 50.686, lng: 156.014 },
  chikurachki: { lat: 50.324, lng: 155.457 },
  sarichev:   { lat: 48.091, lng: 153.202 },
  raikoke:    { lat: 48.293, lng: 153.25 },
};

function resolveKVERTCoords(name) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  return KVERT_COORDS[key] || null;
}

async function loadKVERT(target) {
  try {
    const html = await fetchKVERT();
    if (html) parseKVERT(html, target);
  } catch (e) {
    console.warn('KVERT load failed:', e);
  }
}

async function fetchKVERT() {
  const resp = await fetch('/api/kvert/index?type=6');
  if (!resp.ok) throw new Error('KVERT fetch failed');
  return resp.text();
}

function parseKVERT(html, target) {
  const arr = target || events;
  const cy = new Date().getFullYear();

  /* Parse inline VONA from <td valign="top"> block (VONA text split by <br>) */
  const tdMatch = html.match(/<td\s+valign="top">([\s\S]*?)<\/td>/i);
  let latestVona = null;
  if (tdMatch) {
    const brSplit = tdMatch[1].replace(/<strong>[\s\S]*?<\/strong>/i, '').replace(/<\/?br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();
    if (brSplit) {
      latestVona = parseVONABody(brSplit, cy);
    }
  }

  /* Parse sidebar VONA list: extract text from <div style="cursor: pointer;">text</div> inside <li> */
  const liRegex = /<div[^>]*style="cursor:\s*pointer;"[^>]*>([\s\S]*?)<\/div>/gi;
  const seen = new Set();
  let m;
  while ((m = liRegex.exec(html)) !== null) {
    const text = m[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const entry = parseKVREntry(text, cy);
    if (!entry) continue;
    const event = {
      id: `kvert-${entry.volcano}-${entry.timestamp}`,
      type: 'volcano',
      lat: entry.lat,
      lng: entry.lng,
      magnitude: 0,
      depth: 0,
      timestamp: entry.timestamp,
      title: entry.title,
      description: entry.description,
      url: 'http://kvert.febras.net',
      color: TYPE_COLORS.volcano,
    };
    const dedupKey = `${event.type}-${event.lat.toFixed(1)}-${event.lng.toFixed(1)}-${event.timestamp}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    arr.push(event);
  }

  /* Add latest VONA separately if not already covered */
  if (latestVona) {
    const dupKey = `${latestVona.type}-${latestVona.lat.toFixed(1)}-${latestVona.lng.toFixed(1)}-${latestVona.timestamp}`;
    if (!seen.has(dupKey)) {
      arr.push(latestVona);
    }
  }
}

function parseVONABody(body, year) {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  let volcano = '', lat = 0, lng = 0, dtg = '', colour = '', ashHgt = 0, onset = '';
  for (const line of lines) {
    if (line.startsWith('VOLCANO:')) {
      const parts = line.replace('VOLCANO:', '').trim().split(/\s+/);
      volcano = parts.slice(0, -1).join(' ');
    } else if (line.startsWith('DTG:')) {
      dtg = line.replace('DTG:', '').trim();
    } else if (line.startsWith('PSN:')) {
      const ps = line.replace('PSN:', '').trim();
      const psMatch = ps.match(/N(\d{2})(\d{2})\s+E(\d{3})(\d{2})/);
      if (psMatch) {
        lat = parseInt(psMatch[1]) + parseInt(psMatch[2]) / 60;
        lng = parseInt(psMatch[3]) + parseInt(psMatch[4]) / 60;
      }
    } else if (line.startsWith('CURRENT COLOUR CODE:')) {
      colour = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('VA CLD HGT:')) {
      const h = line.replace('VA CLD HGT:', '').trim();
      const hm = h.match(/(\d+)/);
      if (hm) ashHgt = parseInt(hm[1]);
    } else if (line.startsWith('ONSET:')) {
      onset = line.replace('ONSET:', '').trim();
    }
  }

  if (!volcano || !lat || !lng) return null;

  const timestamp = onset ? parseKVRTimestamp(onset) : parseKVRTimestamp(dtg);
  if (!timestamp || new Date(timestamp).getFullYear() !== year) return null;

  const ashDesc = ashHgt ? ` — Ash to ${ashHgt >= 1000 ? (ashHgt / 1000).toFixed(1) + ' km' : ashHgt + ' m'}` : '';
  return {
    id: `kvert-vona-${timestamp}`,
    type: 'volcano',
    lat, lng,
    magnitude: 0,
    depth: 0,
    timestamp,
    title: `${volcano} Volcano, Russia — Code ${colour}${ashDesc}`,
    description: `${volcano} — Aviation Colour Code ${colour}. Eruption ongoing.`,
    url: 'http://kvert.febras.net',
    color: TYPE_COLORS.volcano,
  };
}

function parseKVREntry(text, year) {
  const entryMatch = text.match(/(\w+)\s+(\d+),\s+(\d+):(\d+)\s+UTC\s+(.+)/i);
  if (!entryMatch) return null;
  const month = entryMatch[1];
  const day = parseInt(entryMatch[2]);
  const hour = parseInt(entryMatch[3]);
  const min = parseInt(entryMatch[4]);
  const volcanoName = entryMatch[5].trim().replace(/<[^>]*>/g, '');
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const mi = months[month.toLowerCase().slice(0, 3)];
  if (mi === undefined) return null;
  const ts = new Date(Date.UTC(year, mi, day, hour, min)).getTime();
  if (isNaN(ts)) return null;
  const coords = resolveKVERTCoords(volcanoName);
  if (!coords) return null;
  return {
    volcano: volcanoName,
    timestamp: ts,
    lat: coords.lat,
    lng: coords.lng,
    title: `${volcanoName} Volcano, Russia — Aviation Notice`,
    description: `KVERT VONA: ${volcanoName} activity.`,
  };
}

function parseKVRTimestamp(str) {
  const m = str.match(/(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z/);
  if (!m) return Date.now();
  const ts = new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]))).getTime();
  return isNaN(ts) ? Date.now() : ts;
}

/* ── Parsing ── */
function parseGDACS(data, target) {
  if (!data || !data.features) return;
  const arr = target || events;
  const typeMap = {
    EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VF: 'volcano', WF: 'wildfire',
  };
  data.features.forEach(f => {
    const props = f.properties || {};
    const coords = f.geometry?.coordinates || [];
    if (coords.length < 2) return;
    const rawType = (props.eventtype || '').toUpperCase();
    const type = typeMap[rawType] || null;
    if (!type) return;
    const timeStr = props.todate || props.fromdate || '';
    const time = timeStr ? new Date(timeStr).getTime() : Date.now();
    if (new Date(time).getFullYear() !== selectedYear) return;
    const mag = props.magnitude || props.severity || 0;
    arr.push({
      id: `gdacs-${props.eventid || Math.random()}`,
      type,
      lat: coords[1],
      lng: coords[0],
      magnitude: typeof mag === 'number' ? mag : parseFloat(mag) || 0,
      depth: 0,
      timestamp: time,
      title: props.name || props.eventtype || 'Unknown event',
      description: props.name || `${TYPE_LABELS[type]} alert`,
      url: props.url || '',
      color: TYPE_COLORS[type],
    });
  });
}

function parseEONET(data, target) {
  if (!data || !data.features) return;
  const arr = target || events;
  const catMap = {
    wildfires: 'wildfire',
    volcanoes: 'volcano',
    floods: 'flood',
    severeStorms: 'cyclone',
  };
  data.features.forEach(f => {
    const props = f.properties || {};
    const cats = props.categories || [];
    const eonetType = cats[0]?.id || '';
    const type = catMap[eonetType];
    if (!type) return;

    let coords = [];
    if (f.geometry?.coordinates?.length >= 2) {
      coords = f.geometry.coordinates;
    } else if (f.geometry?.geometries?.length > 0) {
      const g = f.geometry.geometries[0];
      if (g.coordinates?.length >= 2) coords = g.coordinates;
    }
    if (coords.length < 2) return;

    const isOpen = props.closed === null || props.closed === undefined;
    const time = props.date ? new Date(props.date).getTime() : (isOpen ? Date.now() : new Date(props.closed).getTime());
    if (new Date(time).getFullYear() !== selectedYear) return;
    const mag = type === 'cyclone' ? (props.magnitude || 2) : 0;
    const cleanTitle = props.title ? props.title.replace(/<[^>]*>/g, '') : 'Unknown event';

    arr.push({
      id: `eonet-${f.id || Math.random()}`,
      type,
      lat: coords[1],
      lng: coords[0],
      magnitude: mag,
      depth: 0,
      timestamp: time,
      title: cleanTitle,
      description: cleanTitle,
      url: props.link || props.sources?.[0]?.url || '',
      color: TYPE_COLORS[type],
    });
  });
}

/* ── Filtering ── */
function getFilteredEvents() {
  return events.filter(e => {
    if (e.timestamp > currentTime) return false;
    if (e.type === 'earthquake' && e.magnitude < magFilter) return false;
    if (!enabledTypes.has(e.type)) return false;
    return true;
  });
}

function applyFilters(skipVisibility) {
  filteredEvents = getFilteredEvents();
  updateBucketFilter();
  if (!skipVisibility) {
    const step = timeToStep(currentTime);
    currentStep = step;
    showBucketsUpTo(step);
  }
}

/* ── Rendering (Bucket Layers) ── */
let lastVisibleStep = -1;
const BUCKET_LAYER = 'bl-';

function timeToStep(ts) {
  if (!sortedEvents || sortedEvents.length === 0) return 0;
  if (stepEventCounts.length === 0) return 0;
  let lo = 0, hi = sortedEvents.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedEvents[mid].timestamp <= ts) lo = mid + 1;
    else hi = mid;
  }
  if (lo <= 0) return 0;
  if (lo >= sortedEvents.length) return NUM_PLAY_STEPS - 1;
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    if (stepEventCounts[i] >= lo) return i;
  }
  return NUM_PLAY_STEPS - 1;
}

function initBucketLayers() {
  if (!mapReady) return;
  if (sortedEvents.length === 0) return;

  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const id = BUCKET_LAYER + i;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  const maxMag = Math.max(...events.filter(x => x.type === 'earthquake').map(x => x.magnitude), 1);
  const maxDepth = 700;
  let prevCount = 0;

  const circleRadius = [
    'interpolate', ['linear'], ['get', 'normalizedMag'],
    0, 1.2, 0.3, 1.8, 0.5, 2.5, 0.7, 3.5, 0.85, 5, 1, 7,
  ];

  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const count = stepEventCounts[i];
    const bucketFeatures = sortedEvents.slice(prevCount, count).map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id, type: e.type, magnitude: e.magnitude,
        normalizedMag: e.type === 'earthquake'
          ? Math.min(e.magnitude / Math.max(maxMag, 1), 1)
          : Math.max(Math.min(e.magnitude / Math.max(maxMag, 1), 1), 0.8),
        depth: e.depth, depthNorm: Math.min(e.depth / maxDepth, 1),
        timestamp: e.timestamp, title: e.title, description: e.description,
        url: e.url, color: e.color,
      },
    }));
    prevCount = count;

    const sid = BUCKET_LAYER + i;
    map.addSource(sid, { type: 'geojson', data: { type: 'FeatureCollection', features: bucketFeatures }, cluster: false });
    map.addLayer({
      id: sid,
      type: 'circle',
      source: sid,
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': circleRadius,
        'circle-opacity': 0.55,
      },
      layout: { visibility: 'visible' },
    });
  }

  attachBucketEvents();
  lastVisibleStep = NUM_PLAY_STEPS - 1;
}

function attachBucketEvents() {
  const onClick = e => { if (e.features?.length > 0) showEventPopup(e.features[0].properties, e.lngLat); };
  const onEnter = e => { map.getCanvas().style.cursor = 'pointer'; if (e.features?.length > 0) showHoverTooltip(e, e.features[0].properties); };
  const onMove = e => { if (e.features?.length > 0) { hoverTooltip.style.left = `${e.originalEvent.clientX + 12}px`; hoverTooltip.style.top = `${e.originalEvent.clientY - 8}px`; } };
  const onLeave = () => { map.getCanvas().style.cursor = ''; hideHoverTooltip(); };
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const id = BUCKET_LAYER + i;
    map.on('click', id, onClick);
    map.on('mouseenter', id, onEnter);
    map.on('mousemove', id, onMove);
    map.on('mouseleave', id, onLeave);
  }
}

function showBucketsUpTo(stepIdx) {
  if (stepIdx === lastVisibleStep) return;
  const idx = Math.max(0, Math.min(NUM_PLAY_STEPS - 1, stepIdx));
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const id = BUCKET_LAYER + i;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', i <= idx ? 'visible' : 'none');
  }
  lastVisibleStep = idx;
}

function updateBucketFilter() {
  if (!mapReady) return;
  const types = [...enabledTypes];
  const filterExpr = ['all',
    ['any',
      ['!=', ['get', 'type'], 'earthquake'],
      ['>=', ['get', 'magnitude'], magFilter],
    ],
    ['in', ['get', 'type'], ['literal', types]],
  ];
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const id = BUCKET_LAYER + i;
    if (map.getLayer(id)) map.setFilter(id, filterExpr);
  }
  if (map.getLayer('last30-all')) {
    map.setFilter('last30-all', ['in', ['get', 'type'], ['literal', types]]);
  }
  if (map.getLayer('beacon-layer')) {
    map.setFilter('beacon-layer', ['in', ['get', 'type'], ['literal', types]]);
  }
  if (map.getLayer('beacon-glow-layer')) {
    map.setFilter('beacon-glow-layer', ['in', ['get', 'type'], ['literal', types]]);
  }
  if (map.getLayer('beacon-dot-layer')) {
    map.setFilter('beacon-dot-layer', ['in', ['get', 'type'], ['literal', types]]);
  }
}

function updateBeacon() {
  if (!mapReady) return;
  if (isLast30Mode) return;
  if (selectedYear !== new Date().getFullYear()) return;

  const types = [...enabledTypes];
  const beaconFeatures = [];
  const leaderFeatures = [];
  const usedTypes = new Set();

  types.forEach(type => {
    const latest = [...events]
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latest) return;
    usedTypes.add(type);

    const color = TYPE_COLORS[type];

    beaconFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [latest.lng, latest.lat] },
      properties: { type, color, magnitude: latest.magnitude, depth: latest.depth, title: latest.title, timestamp: latest.timestamp, id: latest.id },
    });

    const screen = map.project([latest.lng, latest.lat]);
    const flip = screen.x > window.innerWidth * 0.7;
    screen.x += flip ? -130 : 130;
    const leaderEnd = map.unproject(screen).toArray();
    leaderFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[latest.lng, latest.lat], leaderEnd],
      },
      properties: { color },
    });

    if (!beaconMarkers[type]) {
      const el = document.createElement('div');
      el.className = 'beacon-label';
      const marker = new maplibregl.Marker({ element: el });
      beaconMarkers[type] = marker;
    }
    const marker = beaconMarkers[type];
    const el = marker.getElement();
    const title = latest.type === 'earthquake'
      ? `M ${latest.magnitude.toFixed(1)} — ${latest.title}`
      : latest.title;
    const lbl = title.length > TITLE_MAX_LEN ? title.substring(0, TITLE_TRUNC_LEN) + '…' : title;
    const depthStr = latest.type === 'earthquake' ? ` · ${latest.depth.toFixed(0)} km` : '';
    const dateStr = formatDate(latest.timestamp);
    el.innerHTML = `<div>${lbl}</div><div style="font-weight:300;font-size:0.5rem;opacity:0.7;margin-top:1px">${dateStr}${depthStr}</div>`;
    el.style.color = color;
    el.style.display = '';
    marker.setLngLat(leaderEnd);
    marker.addTo(map);
  });

  map.getSource('beacon-source')?.setData({
    type: 'FeatureCollection',
    features: beaconFeatures,
  });
  map.getSource('beacon-leader-source')?.setData({
    type: 'FeatureCollection',
    features: leaderFeatures,
  });

  Object.keys(beaconMarkers).forEach(type => {
    if (!usedTypes.has(type)) {
      try { beaconMarkers[type].remove(); } catch(e) {}
      beaconMarkers[type].getElement().style.display = 'none';
      delete beaconMarkers[type];
    }
  });
}

/* ── Pulse Animation (current year, beacons) ── */
function startPulse() {
  stopPulse();
  if (!mapReady) return;
  updateBeacon();
  beaconZoomUpdate();
  map.setPaintProperty('beacon-layer', 'circle-opacity', 0.7);
  map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0.25);
  map.setPaintProperty('beacon-dot-layer', 'circle-opacity', 1);
  map.setPaintProperty('beacon-leader-layer', 'line-opacity', 0.3);

  Object.values(beaconMarkers).forEach(m => {
    if (m) { m.addTo(map); m.getElement().style.display = ''; }
  });

  pulseTimer = setInterval(() => {
    const t = performance.now() / 1000;
    const glow = 0.05 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.8));
    const opacity = 0.4 + 0.3 * Math.sin(t * 3.5);
    map.setPaintProperty('beacon-layer', 'circle-opacity', opacity);
    map.setPaintProperty('beacon-glow-layer', 'circle-opacity', glow);
  }, 50);
}

function stopPulse() {
  if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  try { map.setPaintProperty('beacon-layer', 'circle-opacity', 0); } catch(e) {}
  try { map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0); } catch(e) {}
  try { map.setPaintProperty('beacon-dot-layer', 'circle-opacity', 0); } catch(e) {}
  try { map.setPaintProperty('beacon-leader-layer', 'line-opacity', 0); } catch(e) {}
  Object.values(beaconMarkers).forEach(m => {
    try { m.remove(); } catch(e) {}
    if (m.getElement()) m.getElement().style.display = 'none';
  });
  try { map.getSource('beacon-source')?.setData({ type: 'FeatureCollection', features: [] }); } catch(e) {}
  try { map.getSource('beacon-leader-source')?.setData({ type: 'FeatureCollection', features: [] }); } catch(e) {}
}

function pausePulse() {
  if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
  try { map.setPaintProperty('beacon-layer', 'circle-opacity', 0.55); } catch(e) {}
  try { map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0.2); } catch(e) {}
}

function resumePulse() {
  if (!mapReady) return;
  const cy = new Date().getFullYear();
  if (selectedYear !== cy) return;
  if (pulseTimer) return;
  pulseTimer = setInterval(() => {
    const t = performance.now() / 1000;
    const glow = 0.05 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.8));
    const opacity = 0.4 + 0.3 * Math.sin(t * 3.5);
    map.setPaintProperty('beacon-layer', 'circle-opacity', opacity);
    map.setPaintProperty('beacon-glow-layer', 'circle-opacity', glow);
  }, 50);
}

function beaconZoomUpdate() {
  const z = map.getZoom();
  const r = Math.max(5, Math.min(16, 28 - z * 1.5));
  try { map.setPaintProperty('beacon-layer', 'circle-radius', r); } catch(e) {}
}
map.on('zoom', () => { if (mapReady) beaconZoomUpdate(); });
map.on('moveend', () => { if (mapReady) updateBeacon(); });

/* ── Historical Graph Data ── */
async function loadHistoricalEarthquakeData() {
  const CACHE_KEY = 'tl_hist_counts';
  const TTL = 3600000;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < TTL && parsed.data && parsed.data.length > 0) {
        graphData = parsed.data;
        setTrend();
        if (graphData.length > 0) drawGraph();
        return;
      }
    }
  } catch (_) {}

  try {
    const cy = new Date().getFullYear();
    const years = [];
    for (let y = 1948; y <= cy; y++) years.push(y);
    const yearCounts = {};
    const BATCH = 30;
    for (let i = 0; i < years.length; i += BATCH) {
      const batch = years.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(y =>
        fetch(`https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&starttime=${y}-01-01&endtime=${y}-12-31&minmagnitude=4.5`)
          .then(r => r.ok ? r.json() : null)
      ));
      results.forEach((res, j) => {
        if (res.status === 'fulfilled' && res.value && res.value.count !== undefined) {
          yearCounts[batch[j]] = res.value.count;
        }
      });
    }
    graphData = Object.entries(yearCounts)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);
    if (graphData.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: graphData, ts: Date.now() })); } catch (_) {}
    }
    setTrend();
    if (graphData.length > 0) drawGraph();
  } catch (e) {
    console.warn('Historical data fetch failed:', e);
  }
}

function setTrend() {
  if (graphData.length < 6) return;
  const first3 = (graphData[0].count + graphData[1].count + graphData[2].count) / 3;
  const last3 = (graphData[graphData.length - 1].count + graphData[graphData.length - 2].count + graphData[graphData.length - 3].count) / 3;
  const pct = ((last3 - first3) / first3 * 100);
  document.getElementById('eq-trend').textContent =
    `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% ${pct > 0 ? '\u2191' : '\u2193'} since 1948`;
}

/* ── Graph ── */
const graphToggle = document.getElementById('fp-graph-toggle');
const graphArea = document.getElementById('fp-graph-area');
let graphOpen = true;

graphToggle.addEventListener('click', () => {
  graphOpen = !graphOpen;
  graphToggle.classList.toggle('open', graphOpen);
  graphArea.classList.toggle('open', graphOpen);
  graphToggle.innerHTML = graphOpen ? '&#9660; Earthquake Frequency' : '&#9654; Earthquake Frequency';
  if (graphOpen) {
    drawComposition();
    if (graphData.length > 0) setTimeout(drawGraph, 50);
  }
});

function drawGraph() {
  const canvas = document.getElementById('eq-graph');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(rect.width - 4, 100);
  const h = 100;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (graphData.length < 2) {
    ctx.fillStyle = 'rgba(245,240,230,0.15)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading historical data...', w / 2, h / 2 + 3);
    return;
  }

  const pad = { top: 8, bottom: 22, left: 14, right: 14 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;
  const years = graphData.map(d => d.year);
  const counts = graphData.map(d => d.count);
  const minY = 0;
  const maxY = Math.max(...counts) * 1.1;

  ctx.strokeStyle = 'rgba(212,175,55,0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + gh - (gh * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.2;
  years.forEach((year, i) => {
    const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
    const y = pad.top + gh - (counts[i] - minY) / (maxY - minY) * gh;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.beginPath();
  const lastX = pad.left + gw;
  ctx.moveTo(pad.left, pad.top + gh);
  years.forEach((year, i) => {
    const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
    const y = pad.top + gh - (counts[i] - minY) / (maxY - minY) * gh;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(lastX, pad.top + gh);
  ctx.closePath();
  ctx.fillStyle = 'rgba(239,68,68,0.08)';
  ctx.fill();

  const lastIdx = years.length - 1;
  const bx = pad.left + (years[lastIdx] - years[0]) / (years[lastIdx] - years[0]) * gw;
  const by = pad.top + gh - (counts[lastIdx] - minY) / (maxY - minY) * gh;
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#EF4444';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245,240,230,0.9)';
  ctx.fill();

  ctx.fillStyle = 'rgba(245,240,230,0.3)';
  ctx.font = '8px Inter, sans-serif';
  ctx.textAlign = 'center';
  [years[0], years[lastIdx]].forEach(year => {
    const x = pad.left + (year - years[0]) / (years[lastIdx] - years[0]) * gw;
    ctx.fillText(year, x, h - 3);
  });
}

function drawComposition() {
  const el = document.getElementById('eq-composition');
  if (!el) return;
  const counts = {};
  let total = 0;
  events.forEach(e => {
    counts[e.type] = (counts[e.type] || 0) + 1;
    total++;
  });
  if (total === 0) return;
  const types = ['earthquake', 'flood', 'cyclone', 'volcano', 'wildfire'];
  let html = '';
  types.forEach(t => {
    const c = counts[t] || 0;
    if (c === 0) return;
    html += `<span class="comp-item"><span class="comp-dot" style="background:${TYPE_COLORS[t]}"></span><span class="comp-num">${c.toLocaleString()}</span></span>`;
  });
  html += `<span class="comp-label">${total.toLocaleString()} total</span>`;
  el.innerHTML = html;
}

/* ── Timeline ── */
const slider = document.getElementById('tl-slider');
const labelStart = document.getElementById('tl-label-start');
const labelEnd = document.getElementById('tl-label-end');
const labelCurrent = document.getElementById('tl-label-current');

function updateTimelineRange() {
  if (sortedEvents.length === 0) return;
  const yearStart = Date.UTC(selectedYear, 0, 1);
  const yearEnd = Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999);
  slider.min = yearStart;
  slider.max = yearEnd;
  slider.value = yearEnd;
  currentTime = yearEnd;
  currentStep = timeToStep(yearEnd);
  showBucketsUpTo(currentStep);
  lastVisibleStep = currentStep;
  labelStart.textContent = formatDate(yearStart);
  labelEnd.textContent = formatDate(yearEnd);
  labelCurrent.textContent = selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31';
}

slider.addEventListener('input', () => {
  currentTime = parseFloat(slider.value);
  const diff = parseFloat(slider.max) - parseFloat(slider.min);
  const pct = diff > 0 ? ((currentTime - parseFloat(slider.min)) / diff * 100) : 100;
  labelCurrent.textContent = pct >= 99.5
    ? (selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31')
    : formatDate(currentTime);
  filteredEvents = getFilteredEvents();
  updateBucketFilter();
  currentStep = timeToStep(currentTime);
  showBucketsUpTo(currentStep);

  updateAlertPanel();
});

function formatDate(ts) {
  const d = new Date(ts);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Auto-Play (event-index stepping, forward & reverse) ── */
document.getElementById('tl-play').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  startPlay('forward');
});

document.getElementById('tl-step-fwd').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  const yearStart = Date.UTC(selectedYear, 0, 1);
  const yearEnd = Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999);
  if (currentStep >= NUM_PLAY_STEPS - 1) { currentStep = 0; }
  else { currentStep++; }
  currentTime = yearStart + (currentStep / NUM_PLAY_STEPS) * (yearEnd - yearStart);
  showBucketsUpTo(currentStep);
  slider.value = currentTime;
  labelCurrent.textContent = formatDate(currentTime);
  applyFilters(true);
  updateAlertPanel();
});

document.getElementById('tl-step-back').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  const yearStart = Date.UTC(selectedYear, 0, 1);
  const yearEnd = Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999);
  if (currentStep <= 0) { currentStep = NUM_PLAY_STEPS - 1; }
  else { currentStep--; }
  currentTime = yearStart + (currentStep / NUM_PLAY_STEPS) * (yearEnd - yearStart);
  showBucketsUpTo(currentStep);
  slider.value = currentTime;
  labelCurrent.textContent = formatDate(currentTime);
  applyFilters(true);
  updateAlertPanel();
});

function startPlay(direction) {
  if (sortedEvents.length === 0) return;
  const yearStart = Date.UTC(selectedYear, 0, 1);
  const yearEnd = Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999);

  if (direction === 'forward') {
    if (currentStep >= NUM_PLAY_STEPS - 1) {
      currentStep = 0;
      currentTime = yearStart;
      slider.value = currentTime;
      labelCurrent.textContent = formatDate(yearStart);
      showBucketsUpTo(0);
    }
    if (currentStep >= NUM_PLAY_STEPS - 1) { return; }

    isPlaying = true;
    playDirection = 'forward';
    document.getElementById('tl-play').innerHTML = '&#10074;&#10074;';
    document.getElementById('tl-play').classList.add('active');
    pausePulse();

    let frameCount = 0;

    function forwardFrame() {
      if (!isPlaying) return;
      frameCount++;
      if (frameCount % FRAMES_PER_STEP !== 0) {
        requestAnimationFrame(forwardFrame);
        return;
      }
      const nextStep = currentStep + 1;
      if (nextStep >= NUM_PLAY_STEPS) {
        currentStep = NUM_PLAY_STEPS - 1;
        currentTime = yearEnd;
        showBucketsUpTo(currentStep);
        slider.value = currentTime;
        labelCurrent.textContent = selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31';
        pendingAutoStop = true;
        map.once('idle', () => { if (pendingAutoStop) { pendingAutoStop = false; stopPlay(); } });
        return;
      }
      currentStep = nextStep;
      currentTime = yearStart + (nextStep / NUM_PLAY_STEPS) * (yearEnd - yearStart);
      showBucketsUpTo(currentStep);
      slider.value = currentTime;
      labelCurrent.textContent = formatDate(currentTime);

      if (currentStep >= NUM_PLAY_STEPS - 1 || currentTime >= yearEnd) {
        currentTime = yearEnd;
        showBucketsUpTo(NUM_PLAY_STEPS - 1);
        slider.value = currentTime;
        labelCurrent.textContent = selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31';
        pendingAutoStop = true;
        map.once('idle', () => { if (pendingAutoStop) { pendingAutoStop = false; stopPlay(); } });
        return;
      }
      requestAnimationFrame(forwardFrame);
    }
    requestAnimationFrame(forwardFrame);

  } else {
    if (currentStep <= 0) {
      currentStep = NUM_PLAY_STEPS - 1;
      currentTime = yearEnd;
      slider.value = currentTime;
      labelCurrent.textContent = selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31';
      showBucketsUpTo(NUM_PLAY_STEPS - 1);
    }
    if (currentStep <= 0) { return; }

    isPlaying = true;
    playDirection = 'reverse';
    document.getElementById('tl-play').innerHTML = '&#10074;&#10074;';
    document.getElementById('tl-play').classList.add('active');
    pausePulse();

    let reverseFrameCount = 0;

    function reverseFrame() {
      if (!isPlaying) return;
      reverseFrameCount++;
      if (reverseFrameCount % FRAMES_PER_STEP !== 0) {
        requestAnimationFrame(reverseFrame);
        return;
      }
      const prevStep = currentStep - 1;
      if (prevStep < 0) {
        currentStep = 0;
        currentTime = yearStart;
        showBucketsUpTo(0);
        slider.value = currentTime;
        labelCurrent.textContent = formatDate(yearStart);
        pendingAutoStop = true;
        map.once('idle', () => { if (pendingAutoStop) { pendingAutoStop = false; stopPlay(); } });
        return;
      }
      currentStep = prevStep;
      currentTime = yearStart + (prevStep / NUM_PLAY_STEPS) * (yearEnd - yearStart);
      showBucketsUpTo(currentStep);
      slider.value = currentTime;
      labelCurrent.textContent = formatDate(currentTime);
      requestAnimationFrame(reverseFrame);
    }
    requestAnimationFrame(reverseFrame);
  }
}

function stopPlay() {
  pendingAutoStop = false;
  isPlaying = false;
  document.getElementById('tl-play').innerHTML = '&#9654;';
  document.getElementById('tl-play').classList.remove('active');
  applyFilters(true);

  updateAlertPanel();
  resumePulse();
}

document.getElementById('tl-live').addEventListener('click', () => {
  stopPlay();
  currentStep = NUM_PLAY_STEPS - 1;
  currentTime = sortedEvents[sortedEvents.length - 1]?.timestamp ?? parseFloat(slider.max);
  showBucketsUpTo(NUM_PLAY_STEPS - 1);
  slider.value = currentTime;
  labelCurrent.textContent = selectedYear === new Date().getFullYear() ? 'Now' : 'Dec 31';

  updateAlertPanel();
});

document.getElementById('tl-reset').addEventListener('click', () => {
  stopPlay();
  currentStep = 0;
  currentTime = sortedEvents[0]?.timestamp ?? parseFloat(slider.min);
  showBucketsUpTo(0);
  slider.value = currentTime;
  labelCurrent.textContent = formatDate(currentTime);

  updateAlertPanel();
});

/* ── Magnitude Filter ── */
document.querySelectorAll('#fp-mag .fp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#fp-mag .fp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    magFilter = parseFloat(btn.dataset.mag);
    filteredEvents = getFilteredEvents();
    updateBucketFilter();
  
    updateAlertPanel();
  });
});

/* ── Type Toggles ── */
function rebuildLast30Beacons() {
  if (!isLast30Mode || !mapReady) return;
  const BEACONS_PER_TYPE = 7;
  const grouped = {};
  const beaconFeatures = [];

  [...enabledTypes].forEach(type => {
    const ofType = events
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
    grouped[type] = ofType.slice(0, BEACONS_PER_TYPE);

    grouped[type].forEach((e, idx) => {
      const isFirst = idx === 0;
      beaconFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: { type, color: TYPE_COLORS[type], isFirst: isFirst ? 1 : 0, magnitude: e.magnitude, depth: e.depth, title: e.title, timestamp: e.timestamp, id: e.id },
      });
    });
  });

  map.getSource('beacon-source')?.setData({
    type: 'FeatureCollection', features: beaconFeatures,
  });

  if (!pulseTimer) {
    map.setPaintProperty('beacon-layer', 'circle-opacity', 0.8);
    map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0.35);
    map.setPaintProperty('beacon-dot-layer', 'circle-opacity', 1);
    pulseTimer = setInterval(() => {
      const t = performance.now() / 1000;
      const glow = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.8));
      const opacity = 0.5 + 0.3 * Math.sin(t * 3.5);
      map.setPaintProperty('beacon-layer', 'circle-opacity', opacity);
      map.setPaintProperty('beacon-glow-layer', 'circle-opacity', glow);
    }, 50);
  }
}

function toggleType(btn, type) {
  const nowActive = !enabledTypes.has(type);
  if (nowActive) {
    enabledTypes.add(type);
  } else {
    enabledTypes.delete(type);
  }
  document.querySelectorAll(`.fp-tog[data-type="${type}"], .tl-tog[data-type="${type}"]`).forEach(b => {
    b.classList.toggle('active', nowActive);
  });
  filteredEvents = getFilteredEvents();
  updateAlertPanel();
  if (isLast30Mode) {
    rebuildLast30Beacons();
  } else if (selectedYear === new Date().getFullYear()) {
    if (enabledTypes.size > 0) startPulse();
    else stopPulse();
  }
  updateBucketFilter();
}

document.querySelectorAll('.fp-tog').forEach(btn => {
  btn.addEventListener('click', () => toggleType(btn, btn.dataset.type));
});
document.querySelectorAll('.tl-tog').forEach(btn => {
  btn.addEventListener('click', () => toggleType(btn, btn.dataset.type));
});

/* ── Category Graphs ── */
const catGraphStates = { flood: false, cyclone: false, volcano: false, wildfire: false };

function refreshAllGraphs() {
  if (graphData.length > 0) {
    drawGraph();
    drawComposition();
  }
  for (const [cat, open] of Object.entries(catGraphStates)) {
    if (open) {
      const d = computeCategoryData(cat);
      drawCategoryGraph('graph-' + cat, d, TYPE_COLORS[cat], 'trend-' + cat, TYPE_LABELS[cat]);
    }
  }
}

function computeCategoryData(type) {
  const hist = (eonetHistoryData[type] || []).map(d => ({ ...d }));
  const cy = new Date().getFullYear();
  const currentCount = events.filter(e => e.type === type).length;
  if (currentCount > 0) {
    const existing = hist.find(d => d.year === cy);
    if (existing) existing.count = currentCount;
    else hist.push({ year: cy, count: currentCount });
  }
  return hist.sort((a, b) => a.year - b.year);
}

function drawCategoryGraph(canvasId, data, color, trendElId, labelPrefix) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(rect.width - 4, 100);
  const h = 100;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = 'rgba(245,240,230,0.15)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', w / 2, h / 2 + 3);
    return;
  }

  const pad = { top: 8, bottom: 22, left: 14, right: 14 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;
  const years = data.map(d => d.year);
  const counts = data.map(d => d.count);
  const minY = 0;
  const maxY = Math.max(...counts, 1) * 1.1;

  ctx.strokeStyle = 'rgba(212,175,55,0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + gh - (gh * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  if (data.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    years.forEach((year, i) => {
      const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
      const y = pad.top + gh - (counts[i] - minY) / (maxY - minY) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  const lastIdx = years.length - 1;
  const bx = pad.left + (years[lastIdx] - years[0]) / (years[lastIdx] - years[0]) * gw;
  const by = pad.top + gh - (counts[lastIdx] - minY) / (maxY - minY) * gh;
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245,240,230,0.9)';
  ctx.fill();

  ctx.fillStyle = 'rgba(245,240,230,0.3)';
  ctx.font = '8px Inter, sans-serif';
  ctx.textAlign = 'center';
  [years[0], years[lastIdx]].forEach(year => {
    const x = pad.left + (year - years[0]) / (years[lastIdx] - years[0]) * gw;
    ctx.fillText(year, x, h - 3);
  });

  if (trendElId && data.length > 0) {
    const el = document.getElementById(trendElId);
    if (el) {
      const last = counts[lastIdx];
      const firstNonZero = data.findIndex(d => d.count > 0);
      if (data.length >= 6 && firstNonZero >= 0 && (data.length - firstNonZero) >= 6) {
        const first3 = (data[firstNonZero].count + data[firstNonZero+1].count + data[firstNonZero+2].count) / 3;
        const last3 = (data[data.length-1].count + data[data.length-2].count + data[data.length-3].count) / 3;
        if (first3 > 0) {
          const pct = ((last3 - first3) / first3 * 100);
          el.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% ${pct > 0 ? '\u2191' : '\u2193'} since ${data[firstNonZero].year}`;
        } else {
          el.textContent = `${last.toLocaleString()} events (${labelPrefix})`;
        }
      } else {
        el.textContent = `${last.toLocaleString()} events (${labelPrefix})`;
      }
    }
  }
}

document.querySelectorAll('[data-graph]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.graph;
    const isEq = cat === 'earthquake';
    if (isEq) {
      const gOpen = btn.classList.contains('open');
      btn.classList.toggle('open', !gOpen);
      document.getElementById('fp-graph-area').classList.toggle('open', !gOpen);
      btn.innerHTML = !gOpen ? '&#9660; Earthquake Frequency' : '&#9654; Earthquake Frequency';
      if (!gOpen) {
        drawComposition();
        if (graphData.length > 0) setTimeout(drawGraph, 50);
        setTimeout(() => {
          const el = document.getElementById('fp-graph-area');
          el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 100);
      }
      return;
    }
    const open = catGraphStates[cat];
    catGraphStates[cat] = !open;
    btn.classList.toggle('open', !open);
    document.getElementById('graph-area-' + cat).classList.toggle('open', !open);
    btn.innerHTML = !open ? '&#9660; ' + TYPE_LABELS[cat] + ' Frequency' : '&#9654; ' + TYPE_LABELS[cat] + ' Frequency';
    if (!open) {
      const d = computeCategoryData(cat);
      setTimeout(() => drawCategoryGraph('graph-' + cat, d, TYPE_COLORS[cat], 'trend-' + cat, TYPE_LABELS[cat]), 200);
      setTimeout(() => {
        const el = document.getElementById('graph-area-' + cat);
        el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 250);
    }
  });
});

;(function() {
  let resizeTimer;
  const areaToCanvas = {
    'fp-graph-area': { id: 'eq-graph', type: 'earthquake' },
    'graph-area-flood': { id: 'graph-flood', type: 'flood' },
    'graph-area-cyclone': { id: 'graph-cyclone', type: 'cyclone' },
    'graph-area-volcano': { id: 'graph-volcano', type: 'volcano' },
    'graph-area-wildfire': { id: 'graph-wildfire', type: 'wildfire' },
  };
  const panel = document.getElementById('filter-panel');
  if (panel) {
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const [areaId, info] of Object.entries(areaToCanvas)) {
          const area = document.getElementById(areaId);
          if (area && area.classList.contains('open')) {
            if (info.type === 'earthquake') {
              drawComposition();
              if (graphData.length > 0) drawGraph();
            } else {
              const d = computeCategoryData(info.type);
              drawCategoryGraph(info.id, d, TYPE_COLORS[info.type], 'trend-' + info.type, TYPE_LABELS[info.type]);
            }
          }
        }
      }, 100);
    });
    ro.observe(panel);
  }
})();

/* ── Filter Panel Toggle ── */
document.getElementById('fp-toggle').addEventListener('click', () => {
  document.getElementById('filter-panel').classList.toggle('open');
});
/* Auto-open filter panel on desktop only */
if (window.innerWidth > 640) {
  document.getElementById('filter-panel').classList.add('open');
}

/* ── Alert Panel (removed — replaced by Recent Events side panel) ── */
document.getElementById('ap-toggle')?.addEventListener('click', () => {
  document.getElementById('alert-panel')?.classList.toggle('collapsed');
});

function updateAlertPanel() {
  const list = document.getElementById('ap-list');
  const countEl = document.getElementById('ap-count');
  if (!list || !countEl) return;
  const sorted = [...filteredEvents].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, 50);
  countEl.textContent = filteredEvents.length;

  if (sorted.length === 0) {
    list.innerHTML = '<div class="ap-item" style="pointer-events:none"><div class="ap-item-body"><div class="ap-item-title" style="color:rgba(245,240,230,0.15)">No events match filter</div></div></div>';
    return;
  }

  list.innerHTML = recent.map(e => `
    <div class="ap-item" data-lat="${e.lat}" data-lng="${e.lng}" data-mag="${e.magnitude}" data-depth="${e.depth}" data-title="${e.title.replace(/"/g, '&quot;')}" data-type="${e.type}" data-time="${e.timestamp}" data-url="${e.url}">
      <span class="ap-item-dot" style="background:${e.color}"></span>
      <div class="ap-item-body">
        <div class="ap-item-title">${e.type === 'earthquake' ? `M ${e.magnitude.toFixed(1)}` : TYPE_ICONS[e.type]} ${e.title}</div>
        <div class="ap-item-meta">${timeAgo(e.timestamp)} &middot; ${e.type === 'earthquake' ? `${e.depth.toFixed(0)} km` : TYPE_LABELS[e.type]}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.ap-item').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      map.flyTo({ center: [lng, lat], zoom: 5, duration: 1200 });
    });
  });
}

/* ── Toggle Counts ── */
function updateToggleCounts() {
  const counts = { earthquake: 0, flood: 0, cyclone: 0, volcano: 0, wildfire: 0, fireball: 0 };
  events.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });

  const cy = new Date().getFullYear();
  if (eonetHistoryData) {
    for (const type of ['flood', 'cyclone', 'volcano', 'wildfire']) {
      if (counts[type] === 0) {
        const yearData = (eonetHistoryData[type] || []).find(d => d.year === selectedYear);
        if (yearData && yearData.count > 0) counts[type] = yearData.count;
      }
    }
  }

  const ids = ['earthquake', 'flood', 'cyclone', 'volcano', 'wildfire', 'fireball', 'eq', 'fl', 'tc', 'vf', 'wf', 'fb'];
  const vals = { earthquake: counts.earthquake, flood: counts.flood, cyclone: counts.cyclone, volcano: counts.volcano, wildfire: counts.wildfire, fireball: counts.fireball, eq: counts.earthquake, fl: counts.flood, tc: counts.cyclone, vf: counts.volcano, wf: counts.wildfire, fb: counts.fireball };
  ids.forEach(id => {
    const el = document.getElementById('tc-' + id);
    if (el) el.textContent = vals[id] > 0 ? vals[id].toLocaleString() : '—';
  });
}

/* ── Bible Verse Rotator ── */
function setupBibleVerses() {
  const verses = [
    { ref: 'Matthew 24:6\u20138', text: 'And ye shall hear of wars and rumours of wars: see that ye be not troubled: for all these things must come to pass, but the end is not yet. For nation shall rise against nation, and kingdom against kingdom: and there shall be famines, and pestilences, and earthquakes, in divers places. All these are the beginning of sorrows.' },
    { ref: 'Mark 13:7\u20138', text: 'And when ye shall hear of wars and rumours of wars, be ye not troubled: for such things must needs be; but the end shall not be yet. For nation shall rise against nation, and kingdom against kingdom: and there shall be earthquakes in divers places, and there shall be famines and troubles: these are the beginnings of sorrows.' },
    { ref: 'Luke 21:10\u201311', text: 'Then said he unto them, Nation shall rise against nation, and kingdom against kingdom: And great earthquakes shall be in divers places, and famines, and pestilences; and fearful sights and great signs shall there be from heaven.' },
    { ref: 'Luke 21:25\u201326', text: 'And there shall be signs in the sun, and in the moon, and in the stars; and upon the earth distress of nations, with perplexity; the sea and the waves roaring; Men\u2019s hearts failing them for fear, and for looking after those things which are coming on the earth: for the powers of heaven shall be shaken.' },
    { ref: 'Joel 2:30\u201331', text: 'And I will shew wonders in the heavens and in the earth, blood, and fire, and pillars of smoke. The sun shall be turned into darkness, and the moon into blood, before the great and the terrible day of the LORD come.' },
    { ref: 'Revelation 6:12\u201314', text: 'And I beheld when he had opened the sixth seal, and, lo, there was a great earthquake; and the sun became black as sackcloth of hair, and the moon became as blood; And the stars of heaven fell unto the earth, even as a fig tree casteth her untimely figs, when she is shaken of a mighty wind. And the heaven departed as a scroll when it is rolled together; and every mountain and island were moved out of their places.' },
    { ref: 'Revelation 16:18\u201321', text: 'And there were voices, and thunders, and lightnings; and there was a great earthquake, such as was not since men were upon the earth, so mighty an earthquake, and so great. And the great city was divided into three parts, and the cities of the nations fell: and great Babylon came in remembrance before God, to give unto her the cup of the wine of the fierceness of his wrath. And every island fled away, and the mountains were not found.' },
  ];
  const container = document.getElementById('bible-verse');
  const content = document.getElementById('bv-content');
  const ref = document.getElementById('bv-ref');
  if (!container || !content || !ref) return;
  let order = [];
  let orderIdx = 0;
  function pickNext() {
    if (orderIdx >= order.length) {
      order = Array.from({ length: verses.length }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      orderIdx = 0;
    }
    return order[orderIdx++];
  }
  function show(i) {
    content.textContent = verses[i].text;
    ref.textContent = verses[i].ref;
    container.classList.add('visible');
  }
  function next() {
    container.classList.remove('visible');
    setTimeout(() => show(pickNext()), 1500);
  }
  show(pickNext());
  setInterval(next, 15000);
}

/* ── Loading States ── */

/* (showEventPopup replaced by enhanced version in section 6) */

/* Close popup/drawer on empty-map clicks (registered last so layer handlers fire first) */
setTimeout(() => {
  map.on('click', (e) => {
    const allLayers = ['beacon-layer', 'beacon-glow-layer', 'beacon-dot-layer', 'last30-all'];
    const features = map.queryRenderedFeatures(e.point, { layers: allLayers });
    if (!features || features.length === 0) {
      hideEventPopup();
      const drawer = document.getElementById('event-drawer');
      drawer?.classList.remove('open');
      const bd = document.getElementById('event-backdrop');
      if (bd) bd.style.display = 'none';
    }
  });
}, 0);

/* ── Map Loading Bar ── */
function showMapLoading(text) {
  document.getElementById('data-source').textContent = text || 'Loading...';
  document.getElementById('map-loading').classList.add('active');
}

function hideMapLoading() {
  document.getElementById('map-loading').classList.remove('active');
}

/* ══════════════════════════════════════════════════════
   ENHANCED FEATURES — World Watch v2
   ══════════════════════════════════════════════════════ */

/* ── 1. Real-Time Status Badge ── */
let lastRefreshTime = Date.now();
function updateLiveStatus() {
  const el = document.getElementById('live-time');
  if (!el) return;
  const diff = Date.now() - lastRefreshTime;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) el.textContent = 'Updated just now';
  else if (secs < 3600) el.textContent = `Updated ${Math.floor(secs / 60)}m ago`;
  else el.textContent = `Updated ${Math.floor(secs / 3600)}h ago`;
}
setInterval(updateLiveStatus, 15000);
updateLiveStatus();

/* ── 2. Location Search (Nominatim geocoding) ── */
const REGION_CENTERS = {
  'global':      { center: [10, 30], zoom: 1.5 },
  'americas':    { center: [-80, 15], zoom: 2.8 },
  'europe':      { center: [15, 50], zoom: 3.2 },
  'asia-pacific': { center: [115, 15], zoom: 2.8 },
  'middle-east': { center: [42, 30], zoom: 3.8 },
  'africa':      { center: [20, 5], zoom: 3 },
};

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchResults = document.getElementById('search-results');
let searchDebounce = null;

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClear.style.display = q ? 'block' : 'none';
    if (q.length < 2) { searchResults.style.display = 'none'; return; }
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => fetchSearchResults(q), 350);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchResults.style.display = 'none'; searchInput.blur(); }
  });
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchResults.style.display = 'none';
  });
}

async function fetchSearchResults(query) {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await resp.json();
    if (!data || data.length === 0) { searchResults.style.display = 'none'; return; }
    searchResults.innerHTML = data.map(r =>
      `<div class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}">${r.display_name.substring(0, 60)}</div>`
    ).join('');
    searchResults.style.display = 'block';
    searchResults.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        map.flyTo({ center: [lon, lat], zoom: 5, duration: 1500 });
        searchResults.style.display = 'none';
        searchInput.value = el.textContent;
      });
    });
  } catch (_) { searchResults.style.display = 'none'; }
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#search-container')) searchResults.style.display = 'none';
});

/* ── 3. Region Quick-Filters ── */
document.querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const region = btn.dataset.region;
    const r = REGION_CENTERS[region];
    if (r) map.flyTo({ center: r.center, zoom: r.zoom, duration: 1200 });
  });
});

/* ── 4. "Last 30 Days" Toggle ── */
let isLast30Mode = false;
const fpLast30 = document.getElementById('fp-last30');
const fpYearSelect = document.getElementById('fp-year');

if (fpLast30) {
  fpLast30.addEventListener('click', () => {
    isLast30Mode = !isLast30Mode;
    fpLast30.classList.toggle('active', isLast30Mode);
    if (fpYearSelect) fpYearSelect.disabled = isLast30Mode;
    if (isLast30Mode) {
      loadLast30DaysBeacons();
    } else {
      /* Clean up Last 30 dots layer */
      if (map.getLayer('last30-all')) map.removeLayer('last30-all');
      if (map.getSource('last30-all')) map.removeSource('last30-all');
      selectedYear = fpYearSelect ? parseInt(fpYearSelect.value) : new Date().getFullYear();
      switchYear(selectedYear);
    }
  });
}

async function loadLast30DaysBeacons() {
  try {
  stopPlay();
  stopPulse();
  const id = ++requestId;
  showMapLoading('Loading last 30 days...');
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
  const workingEvents = [];

  try {
    const startStr = new Date(thirtyDaysAgo).toISOString().slice(0,10);
    const endStr = new Date(now).toISOString().slice(0,10);
    const [eqResp, gdacsResp, fbResp, eonetResp, kvertResp] = await Promise.allSettled([
      fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startStr}&endtime=${endStr}&minmagnitude=4.5&orderby=magnitude&limit=500`),
      fetch('/api/gdacs/events4app'),
      fetch('/api/fireball?limit=200'),
      fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=volcanoes&status=open`),
      fetch('/api/kvert/index?type=6')
    ]);

    if (eqResp.status === 'fulfilled' && eqResp.value.ok) {
      const eqData = await eqResp.value.json();
      (eqData.features || []).forEach(f => {
        const p = f.properties, c = f.geometry.coordinates;
        workingEvents.push({ id: `eq-${p.net}-${p.code}-${p.time}`, type: 'earthquake', lat: c[1], lng: c[0], magnitude: p.mag || 0, depth: c[2] || 0, timestamp: p.time, title: p.place || 'Unknown', description: `M ${(p.mag||0).toFixed(1)} — ${p.place||'Unknown'}`, url: p.url || '', color: TYPE_COLORS.earthquake });
      });
    }

    if (gdacsResp.status === 'fulfilled' && gdacsResp.value.ok) {
      const gdData = await gdacsResp.value.json();
      const typeMap = { EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VF: 'volcano', WF: 'wildfire' };
      (gdData.features || []).forEach(f => {
        const p = f.properties || {}, c = f.geometry?.coordinates || [];
        if (c.length < 2) return;
        const t = typeMap[(p.eventtype||'').toUpperCase()];
        if (!t) return;
        const ts = p.todate ? new Date(p.todate).getTime() : Date.now();
        if (ts < thirtyDaysAgo) return;
        workingEvents.push({ id: `gdacs-${p.eventid||Math.random()}`, type: t, lat: c[1], lng: c[0], magnitude: parseFloat(p.magnitude || p.severity || 0), depth: 0, timestamp: ts, title: p.name || p.eventtype || 'Unknown', description: p.name || `${TYPE_LABELS[t]} alert`, url: p.url || '', color: TYPE_COLORS[t] });
      });
    }

    if (fbResp.status === 'fulfilled' && fbResp.value.ok) {
      const fbData = await fbResp.value.json();
      (fbData.data || []).forEach(row => {
        const ts = new Date(row[0]).getTime();
        if (ts < thirtyDaysAgo || ts > now) return;
        const ie = row[2] ? parseFloat(row[2]) : 0;
        workingEvents.push({ id: `fb-${row[0]}`, type: 'fireball', lat: row[3] ? parseFloat(row[3]) * (row[4]==='S'?-1:1) : 0, lng: row[5] ? parseFloat(row[5]) * (row[6]==='W'?-1:1) : 0, magnitude: ie, depth: row[7] ? parseFloat(row[7]) : 0, timestamp: ts, title: `${ie >= 1 ? ie.toFixed(2)+' kt' : (ie*1000).toFixed(0)+' t TNT'} impact`, description: row[7] ? `Altitude: ${row[7]} km` : 'Fireball', url: '', color: TYPE_COLORS.fireball });
      });
    }

    if (eonetResp.status === 'fulfilled' && eonetResp.value.ok) {
      const eonetData = await eonetResp.value.json();
      const catMap = { 'volcanoes': 'volcano', 'wildfires': 'wildfire', 'floods': 'flood', 'severeStorms': 'cyclone' };
      (eonetData.features || []).forEach(f => {
        const c = f.geometry?.coordinates || [];
        if (c.length < 2) return;
        const ts = f.properties?.date ? new Date(f.properties.date).getTime() : Date.now();
        const cats = f.categories || [];
        const eonetType = cats[0]?.id || '';
        const type = catMap[eonetType] || 'volcano';
        workingEvents.push({ id: `eonet-${f.id}`, type, lat: c[1], lng: c[0], magnitude: 0, depth: 0, timestamp: ts, title: f.properties?.title || 'Volcanic activity', description: f.properties?.title || 'Volcanic event', url: '', color: TYPE_COLORS[type] });
      });
    }

    if (kvertResp.status === 'fulfilled' && kvertResp.value.ok) {
      const kvertText = await kvertResp.value.text();
      const doc = new DOMParser().parseFromString(kvertText, 'text/html');
      doc.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;
        const dateStr = cells[0]?.textContent?.trim();
        const volcanoName = cells[1]?.textContent?.trim()?.toLowerCase();
        const level = cells[2]?.textContent?.trim();
        if (!dateStr || !volcanoName) return;
        const ts = new Date(dateStr).getTime();
        if (isNaN(ts) || ts < thirtyDaysAgo) return;
        const coords = KVERT_COORDS[volcanoName];
        if (!coords) return;
        workingEvents.push({ id: `kvert-${volcanoName}-${ts}`, type: 'volcano', lat: coords.lat, lng: coords.lng, magnitude: 0, depth: 0, timestamp: ts, title: `KVERT: ${volcanoName} — Level ${level}`, description: `KVERT volcanic alert level ${level}`, url: '', color: TYPE_COLORS.volcano });
      });
    }
  } catch (_) {}

  if (id !== requestId) return;
  events = dedupEvents(workingEvents);
  computeStepBuckets();

  /* Remove all bucket layers */
  for (let i = 0; i < NUM_PLAY_STEPS; i++) {
    const layerId = 'bl-' + i;
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
  }

  hideMapLoading();
  updateDataSourceLabel('Last 30d');
  updateToggleCounts();

  /* Build a GeoJSON source with ALL events as small dots */
  const allFeatures = events.map(e => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
    properties: { type: e.type, magnitude: e.magnitude, color: e.color, title: e.title, timestamp: e.timestamp, depth: e.depth, id: e.id },
  }));

  const allSourceId = 'last30-all';
  if (map.getSource(allSourceId)) map.removeSource(allSourceId);
  if (map.getLayer(allSourceId)) map.removeLayer(allSourceId);
  map.addSource(allSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: allFeatures } });
  map.addLayer({
    id: allSourceId,
    type: 'circle',
    source: allSourceId,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'magnitude'],
        2, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7,
      ],
      'circle-opacity': 0.4,
      'circle-stroke-width': 0,
    },
  });

  /* Click + hover handlers for dots */
  map.on('click', allSourceId, (e) => {
    if (e.features?.length > 0) {
      const p = e.features[0].properties;
      showEventPopup(p, e.lngLat);
    }
  });
  map.on('mouseenter', allSourceId, (e) => {
    map.getCanvas().style.cursor = 'pointer';
    if (e.features?.length > 0) showHoverTooltip(e, e.features[0].properties);
  });
  map.on('mousemove', allSourceId, (e) => {
    if (e.features?.length > 0) {
      hoverTooltip.style.left = `${e.originalEvent.clientX + 12}px`;
      hoverTooltip.style.top = `${e.originalEvent.clientY - 8}px`;
    }
  });
  map.on('mouseleave', allSourceId, () => { map.getCanvas().style.cursor = ''; hideHoverTooltip(); });

  /* Populate side panel AND place beacon glow dots (no text labels) */
  Object.values(beaconMarkers).forEach(m => { try { m.remove(); } catch(_) {} });
  Object.keys(beaconMarkers).forEach(k => delete beaconMarkers[k]);

  const BEACONS_PER_TYPE = 7;
  const grouped = {};
  const beaconFeatures = [];

  [...enabledTypes].forEach(type => {
    const ofType = events
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
    grouped[type] = ofType.slice(0, BEACONS_PER_TYPE);

    grouped[type].forEach((e, idx) => {
      const isFirst = idx === 0;
      beaconFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: { type, color: TYPE_COLORS[type], isFirst: isFirst ? 1 : 0, magnitude: e.magnitude, depth: e.depth, title: e.title, timestamp: e.timestamp, id: e.id },
      });
    });
  });

  /* Update beacon-source with all dots */
  map.getSource('beacon-source')?.setData({
    type: 'FeatureCollection', features: beaconFeatures,
  });

  /* Make beacon layers visible — startPulse would clear the data, so do it manually */
  if (!pulseTimer) {
    map.setPaintProperty('beacon-layer', 'circle-opacity', 0.8);
    map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0.35);
    map.setPaintProperty('beacon-dot-layer', 'circle-opacity', 1);
    pulseTimer = setInterval(() => {
      const t = performance.now() / 1000;
      const glow = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.8));
      const opacity = 0.5 + 0.3 * Math.sin(t * 3.5);
      map.setPaintProperty('beacon-layer', 'circle-opacity', opacity);
      map.setPaintProperty('beacon-glow-layer', 'circle-opacity', glow);
    }, 50);
  }

  setTimeout(refreshAllGraphs, 100);
  } catch (err) { console.warn('loadLast30DaysBeacons error:', err); }
}

/* ── 5. Event Detail Drawer ── */
const drawer = document.getElementById('event-drawer');
const drawerBody = document.getElementById('ed-body');
const drawerTitle = document.getElementById('ed-title');
const drawerClose = document.getElementById('ed-close');

if (drawerClose) {
  drawerClose.addEventListener('click', () => {
    drawer.classList.remove('open');
    const bd = document.getElementById('event-backdrop');
    if (bd) bd.style.display = 'none';
  });
}

const eventBackdrop = document.getElementById('event-backdrop');
if (eventBackdrop) {
  eventBackdrop.addEventListener('click', () => {
    drawer.classList.remove('open');
    eventBackdrop.style.display = 'none';
  });
}

function openEventDrawer(props) {
  if (!drawer || !drawerBody) return;
  drawerTitle.textContent = `${TYPE_LABELS[props.type] || 'Event'} Details`;
  const mag = props.magnitude ? parseFloat(props.magnitude).toFixed(1) : 'N/A';
  const depth = props.depth ? `${parseFloat(props.depth).toFixed(0)} km` : 'N/A';
  const date = formatDateTime(props.timestamp);
  const lat = parseFloat(props.lat || 0).toFixed(4);
  const lng = parseFloat(props.lng || 0).toFixed(4);

  let html = `
    <div class="ed-row"><span class="ed-label">Type</span><span class="ed-value" style="color:${props.color}">${TYPE_LABELS[props.type] || props.type}</span></div>
    <div class="ed-row"><span class="ed-label">Magnitude</span><span class="ed-value">${mag}</span></div>
    <div class="ed-row"><span class="ed-label">Depth</span><span class="ed-value">${depth}</span></div>
    <div class="ed-row"><span class="ed-label">Location</span><span class="ed-value">${props.title || 'Unknown'}</span></div>
    <div class="ed-row"><span class="ed-label">Coordinates</span><span class="ed-value">${lat}, ${lng}</span></div>
    <div class="ed-row"><span class="ed-label">Time (UTC)</span><span class="ed-value">${date}</span></div>
  `;
  if (props.url) {
    html += `<div class="ed-row"><span class="ed-label">Source</span><span class="ed-value"><a href="${props.url}" target="_blank" rel="noopener" style="color:rgba(80,180,230,0.7);text-decoration:underline">View &rarr;</a></span></div>`;
  }

  /* Nearby events */
  const nearby = events.filter(e => {
    if (e.id === props.id) return false;
    const dLat = Math.abs(e.lat - parseFloat(props.lat));
    const dLng = Math.abs(e.lng - parseFloat(props.lng));
    return dLat < 5 && dLng < 5;
  }).slice(0, 5);

  if (nearby.length > 0) {
    html += `<div class="ed-section-title">Nearby Events (5&deg;)</div>`;
    nearby.forEach(n => {
      const nMag = n.magnitude ? `M${n.magnitude.toFixed(1)}` : '';
      const nDist = Math.sqrt(Math.pow(n.lat - parseFloat(props.lat), 2) + Math.pow(n.lng - parseFloat(props.lng), 2)).toFixed(0);
      html += `<div class="ed-nearby-item" style="font-size:var(--fs-4xs);color:rgba(245,240,230,0.4)">
        <span style="color:${n.color}">&bull;</span> ${n.title.substring(0, 40)} ${nMag} <span style="opacity:0.5">${nDist}&deg;</span>
      </div>`;
    });
  }

  drawerBody.innerHTML = html;
  drawer.classList.add('open');
  const bd = document.getElementById('event-backdrop');
  if (bd) bd.style.display = 'block';
}

/* ── Hover Date Tooltip ── */
const hoverTooltip = document.createElement('div');
hoverTooltip.id = 'hover-tooltip';
hoverTooltip.style.cssText = 'display:none;position:fixed;z-index:200;pointer-events:none;font-family:var(--font-ui);font-size:var(--fs-4xs);font-weight:400;color:rgba(245,240,230,0.7);background:rgba(8,6,12,0.9);border:1px solid rgba(212,175,55,0.15);border-radius:4px;padding:0.15rem 0.35rem;white-space:nowrap;backdrop-filter:blur(6px);';
document.body.appendChild(hoverTooltip);

function showHoverTooltip(e, props) {
  const date = props.timestamp ? formatDateTime(props.timestamp) : '';
  const type = props.type || 'earthquake';
  const mag = props.magnitude ? parseFloat(props.magnitude).toFixed(1) : '';
  hoverTooltip.innerHTML = `<span style="color:${props.color || '#aaa'};margin-right:0.2rem">&#9679;</span>${TYPE_LABELS[type]} ${mag ? 'M' + mag : ''} <span style="opacity:0.5;margin-left:0.2rem">${date}</span>`;
  hoverTooltip.style.display = 'block';
  hoverTooltip.style.left = `${e.originalEvent.clientX + 12}px`;
  hoverTooltip.style.top = `${e.originalEvent.clientY - 8}px`;
}
function hideHoverTooltip() { hoverTooltip.style.display = 'none'; }

/* ── Leader Line SVG ── */
let leaderLine = null;
function ensureLeaderLine() {
  if (leaderLine) return;
  leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaderLine.id = 'leader-line';
  leaderLine.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;overflow:visible;';
  leaderLine.innerHTML = '<line x1="0" y1="0" x2="0" y2="0" stroke="rgba(212,175,55,0.3)" stroke-width="1" stroke-dasharray="3,3"/>';
  document.body.appendChild(leaderLine);
}
function showLeaderLine(x1, y1, x2, y2) {
  ensureLeaderLine();
  const line = leaderLine.querySelector('line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  leaderLine.style.display = 'block';
}
function hideLeaderLine() { if (leaderLine) leaderLine.style.display = 'none'; }

/* ── 6. Enhanced Popup — compact card + leader line ── */
function showEventPopup(props, lngLat) {
  const popup = document.getElementById('event-popup');
  const type = props.type || 'earthquake';
  const magText = type === 'earthquake' ? `M ${parseFloat(props.magnitude).toFixed(1)}` : '';
  const depthText = type === 'earthquake' ? `${parseFloat(props.depth).toFixed(0)} km depth` : '';
  const date = formatDateTime(props.timestamp);

  /* Project lngLat to screen coordinates */
  const screenPt = map.project([lngLat.lng, lngLat.lat]);
  const px = screenPt.x, py = screenPt.y;
  const flip = lngLat.lng < 0;

  popup.innerHTML = `
    <div style="padding:0.5rem 0.65rem;min-width:150px;max-width:240px">
      <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.15rem">
        <span style="width:5px;height:5px;border-radius:50%;background:${props.color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:600;font-size:0.55rem;color:rgba(245,240,230,0.85)">${TYPE_LABELS[type]} ${magText}</span>
        <span id="popup-close-btn" style="margin-left:auto;cursor:pointer;font-size:0.65rem;color:rgba(245,240,230,0.3);line-height:1">&times;</span>
      </div>
      <div style="font-weight:300;font-size:var(--fs-4xs);color:rgba(245,240,230,0.5);line-height:1.3;margin-bottom:0.2rem">${props.title}</div>
      <div style="font-weight:500;font-size:var(--fs-4xs);color:rgba(212,175,55,0.6);margin-bottom:0.15rem">${date}</div>
      <div style="font-size:var(--fs-4xs);color:rgba(245,240,230,0.2)">${depthText || TYPE_LABELS[type]}</div>
      <div id="popup-details-btn" style="margin-top:0.25rem;font-size:var(--fs-4xs);color:rgba(80,180,230,0.5);cursor:pointer">Full details &rarr;</div>
    </div>
  `;
  popup.style.display = 'block';
  popup.style.left = `${flip ? Math.min(px + 12, window.innerWidth - 260) : Math.max(px - 12, 10)}px`;
  popup.style.top = `${py - 10}px`;
  popup.style.transform = flip ? 'translateX(0)' : 'translateX(-100%)';
  popup.classList.add('visible');

  /* Leader line from point to popup card edge */
  const cardRect = popup.getBoundingClientRect();
  const cx = flip ? cardRect.left : cardRect.right;
  const cy = cardRect.top + cardRect.height / 2;
  showLeaderLine(px, py, cx, cy);

  /* Close button */
  const closeBtn = document.getElementById('popup-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); hideEventPopup(); });

  /* Full details button — opens drawer */
  const detailsBtn = document.getElementById('popup-details-btn');
  if (detailsBtn) detailsBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideEventPopup();
    openEventDrawer({ ...props, lat: lngLat.lat, lng: lngLat.lng });
  });
}

function hideEventPopup() {
  const popup = document.getElementById('event-popup');
  if (popup) { popup.classList.remove('visible'); popup.style.display = 'none'; }
  hideLeaderLine();
}

/* Update leader line on map move */
map.on('move', () => { if (leaderLine && leaderLine.style.display !== 'none') hideLeaderLine(); });

/* ── 7. Mini-Map ── */
let miniMap = null;
const miniMapContainer = document.getElementById('mini-map-container');
const miniMapViewport = document.getElementById('mini-map-viewport');

function initMiniMap() {
  if (miniMap || !miniMapContainer || !window.maplibregl) return;
  try {
    miniMapContainer.style.display = 'block';
    miniMap = new maplibregl.Map({
      container: 'mini-map',
      style: { version: 8, sources: { basemap: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], tileSize: 256 } }, layers: [{ id: 'mini-layer', type: 'raster', source: 'basemap' }], bgColor: '#0a0a14' },
      center: [10, 30], zoom: 0.8, attributionControl: false, interactive: false,
    });
    map.on('moveend', updateMiniMapViewport);
  } catch (_) { miniMapContainer.style.display = 'none'; }
}

function updateMiniMapViewport() {
  if (!miniMapViewport || !miniMap) return;
  try {
    const b = map.getBounds();
    const mb = miniMap.getBounds();
    if (!mb || !b) return;
    const mw = 120, mh = 80;
    const left = ((b.getWest() - mb.getWest()) / (mb.getEast() - mb.getWest())) * mw;
    const right = ((b.getEast() - mb.getWest()) / (mb.getEast() - mb.getWest())) * mw;
    const top = ((mb.getNorth() - b.getNorth()) / (mb.getNorth() - mb.getSouth())) * mh;
    const bottom = ((mb.getNorth() - b.getSouth()) / (mb.getNorth() - mb.getSouth())) * mh;
    miniMapViewport.style.left = `${Math.max(0, left)}px`;
    miniMapViewport.style.width = `${Math.min(mw, right - left)}px`;
    miniMapViewport.style.top = `${Math.max(0, top)}px`;
    miniMapViewport.style.height = `${Math.min(mh, bottom - top)}px`;
  } catch (_) {}
}

setTimeout(initMiniMap, 2000);

/* ── 8. Share / Export ── */
const shareToggle = document.getElementById('share-toggle');
const sharePanel = document.getElementById('share-panel');
if (shareToggle) {
  shareToggle.addEventListener('click', () => {
    sharePanel.style.display = sharePanel.style.display === 'none' ? 'flex' : 'none';
  });
}

document.getElementById('btn-share-url')?.addEventListener('click', () => {
  const c = map.getCenter();
  const z = map.getZoom();
  const url = `${location.origin}/disasters#lat=${c.lat.toFixed(4)}&lng=${c.lng.toFixed(4)}&zoom=${z.toFixed(1)}&year=${selectedYear}`;
  navigator.clipboard?.writeText(url).then(() => {
    const btn = document.getElementById('btn-share-url');
    btn.querySelector('span').textContent = 'Copied!';
    setTimeout(() => btn.querySelector('span').textContent = 'Share', 2000);
  }).catch(() => {});
});

document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  const filtered = getFilteredEvents();
  const header = 'Type,Magnitude,Depth (km),Title,Latitude,Longitude,Timestamp (UTC)\n';
  const rows = filtered.map(e =>
    `${e.type},${e.magnitude || ''},${e.depth || ''},"${(e.title||'').replace(/"/g,'""')}",${e.lat},${e.lng},${new Date(e.timestamp).toISOString()}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `world-watch-${selectedYear}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ── 9. URL Hash Restore ── */
function restoreFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = {};
  hash.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = parseFloat(v); });
  if (params.lat && params.lng && params.zoom) {
    setTimeout(() => map.flyTo({ center: [params.lng, params.lat], zoom: params.zoom, duration: 0 }), 500);
  }
}
restoreFromHash();

/* ── 10. Collapsible filter panel (mobile: auto-collapse) ── */
function checkMobileFilter() {
  if (window.innerWidth <= 640) {
    document.getElementById('filter-panel')?.classList.remove('open');
  }
}
window.addEventListener('resize', checkMobileFilter);

/* ── 11. Depth color helper (for future use) ── */
function depthColor(depth) {
  if (depth < 70) return '#EF4444';
  if (depth < 300) return '#DC2626';
  if (depth < 500) return '#B91C1C';
  return '#7F1D1D';
}

/* ── 12. Cluster helper (simplified — count nearby at low zoom) ── */
function clusterCount(features, radiusDeg) {
  const clusters = [];
  const used = new Set();
  features.forEach((f, i) => {
    if (used.has(i)) return;
    const cluster = [f];
    used.add(i);
    features.forEach((g, j) => {
      if (used.has(j)) return;
      if (Math.abs(f.lat - g.lat) < radiusDeg && Math.abs(f.lng - g.lng) < radiusDeg) {
        cluster.push(g);
        used.add(j);
      }
    });
    clusters.push(cluster);
  });
  return clusters;
}
