import rawData from './conflict-data.json';
import israelOutline from './israel-boundary.json';

const { _meta: dataMeta, conflicts: conflictData } = rawData;

/* ── Module State ── */
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [
      { id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 22 },
    ],
  },
  center: [20, 20],
  zoom: 2,
  attributionControl: false,
  fadeDuration: 0,
});

let mapReady = false;
let filteredConflicts = [...conflictData];
let enabledTypes = new Set(['interstate', 'intrastate']);
let enabledRegions = new Set(['all']);
let enabledStatuses = new Set(['all', 'ongoing']);
let conflictMarkers = [];
let updateBeacons = null;

/* ── Bible Verses ── */
function setupBibleVerses() {
  const verses = [
    { ref: 'Matthew 24:6\u20138', text: 'And ye shall hear of wars and rumours of wars: see that ye be not troubled: for all these things must come to pass, but the end is not yet. For nation shall rise against nation, and kingdom against kingdom: and there shall be famines, and pestilences, and earthquakes, in divers places.' },
    { ref: 'Mark 13:7\u20138', text: 'And when ye shall hear of wars and rumours of wars, be ye not troubled: for such things must needs be; but the end shall not be yet. For nation shall rise against nation, and kingdom against kingdom: and there shall be earthquakes in divers places, and there shall be famines and troubles.' },
    { ref: 'Luke 21:9\u201310', text: 'But when ye shall hear of wars and commotions, be not terrified: for these things must first come to pass; but the end is not by and by. Then said he unto them, Nation shall rise against nation, and kingdom against kingdom.' },
    { ref: 'Luke 21:25\u201326', text: 'And there shall be signs in the sun, and in the moon, and in the stars; and upon the earth distress of nations, with perplexity; the sea and the waves roaring; Men\u2019s hearts failing them for fear, and for looking after those things which are coming on the earth.' },
    { ref: 'Joel 3:9\u201310', text: 'Proclaim ye this among the Gentiles; Prepare war, wake up the mighty men, let all the men of war draw near; let them come up: Beat your plowshares into swords, and your pruninghooks into spears: let the weak say, I am strong.' },
    { ref: 'Psalm 46:8\u20139', text: 'Come, behold the works of the LORD, what desolations he hath made in the earth. He maketh wars to cease unto the end of the earth; he breaketh the bow, and cutteth the spear in sunder; he burneth the chariot in the fire.' },
    { ref: 'Revelation 11:18', text: 'And the nations were angry, and thy wrath is come, and the time of the dead, that they should be judged, and that thou shouldest give reward unto thy servants the prophets, and to the saints, and them that fear thy name, small and great; and shouldest destroy them which destroy the earth.' },
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

setupBibleVerses();

/* ── Utility ── */
const REGION_COLORS = {
  europe: '#DC2626',
  'middle-east': '#F97316',
  africa: '#F59E0B',
  asia: '#8B5CF6',
  americas: '#3B82F6',
};

const TYPE_COLORS = {
  interstate: '#DC2626',
  intrastate: '#F97316',
};

const REGION_NAMES = {
  europe: 'Europe',
  'middle-east': 'Middle East',
  africa: 'Africa',
  asia: 'Asia',
  americas: 'Americas',
};

function getConflictRegion(c) {
  const r = c.region?.toLowerCase() || '';
  if (r.includes('europe')) return 'europe';
  if (r.includes('middle east')) return 'middle-east';
  if (r.includes('africa')) return 'africa';
  if (r.includes('asia')) return 'asia';
  if (r.includes('america')) return 'americas';
  return 'europe';
}

/* ── Map ── */
function hideMapLoading() {
  const el = document.getElementById('map-loading');
  if (el) el.style.display = 'none';
}

function showMapLoading(msg) {
  const el = document.getElementById('map-loading');
  if (el) el.style.display = '';
}

function updateMarkers() {
  conflictMarkers.forEach(m => m.remove());
  conflictMarkers = [];

  const zoom = map.getZoom();

  filteredConflicts.forEach(c => {
    if (zoom < 0.5) return;
    if (zoom > 4) {
      const p = map.project([c.lng, c.lat]);
      if (p.x < -100 || p.x > map.getCanvas().width + 100 || p.y < -100 || p.y > map.getCanvas().height + 100) return;
    }

    const region = getConflictRegion(c);
    const color = REGION_COLORS[region] || TYPE_COLORS[c.type] || '#DC2626';
    const isCeasefire = c.status === 'ceasefire';

    const el = document.createElement('div');
    el.className = 'conflict-marker';
    el.style.cssText = `
      width: ${isCeasefire ? 8 : 12}px;
      height: ${isCeasefire ? 8 : 12}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid rgba(255,255,255,0.3);
      box-shadow: 0 0 8px ${color}44, 0 0 16px ${color}22;
      cursor: pointer;
      transition: transform 0.2s;
      pointer-events: auto;
    `;
    el.addEventListener('mouseenter', () => {
      el.dataset.baseTransform = el.style.transform;
      el.style.transform = el.style.transform + ' scale(1.4)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = el.dataset.baseTransform || '';
    });
    el.addEventListener('click', (e) => { e.stopPropagation(); showConflictPopup(c); });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([c.lng, c.lat])
      .addTo(map);
    conflictMarkers.push(marker);
  });

  updateCounts();
}

function showConflictPopup(c) {
  const popup = document.getElementById('event-popup');
  const fatalities = c.fatalities || 'Unknown';
  const displaced = c.displaced ? `${c.displaced} displaced` : '';
  const status = c.status.charAt(0).toUpperCase() + c.status.slice(1);
  popup.innerHTML = `
    <div style="padding:0.6rem 0.75rem;min-width:200px;max-width:280px">
      <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.25rem">
        <span style="width:6px;height:6px;border-radius:50%;background:${REGION_COLORS[getConflictRegion(c)] || '#DC2626'};display:inline-block"></span>
        <span style="font-weight:500;font-size:0.6rem;color:rgba(245,240,230,0.85)">${c.name}</span>
      </div>
      <div style="font-weight:300;font-size:0.52rem;color:rgba(245,240,230,0.5);line-height:1.3;margin-bottom:0.3rem">${c.parties.join(' vs ')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.2rem;font-size:0.42rem">
        <span style="color:rgba(245,240,230,0.35)">Fatalities</span><span style="color:rgba(220,60,60,0.7);text-align:right;font-weight:500">${fatalities}</span>
        ${displaced ? `<span style="color:rgba(245,240,230,0.35)">Displaced</span><span style="color:rgba(245,240,230,0.6);text-align:right">${displaced}</span>` : ''}
        <span style="color:rgba(245,240,230,0.35)">Started</span><span style="color:rgba(245,240,230,0.6);text-align:right">${c.start}</span>
        <span style="color:rgba(245,240,230,0.35)">Status</span><span style="color:rgba(245,240,230,0.6);text-align:right">${status}</span>
      </div>
    </div>
  `;
  popup.style.display = 'block';
  const p = map.project([c.lng, c.lat]);
  popup.style.left = `${p.x + 15}px`;
  popup.style.top = `${p.y - 20}px`;
  popup.classList.add('visible');
}

function closePopup() {
  const popup = document.getElementById('event-popup');
  popup.classList.remove('visible');
  popup.style.display = 'none';
}

/* ── Filter Logic ── */
function applyFilters() {
  filteredConflicts = conflictData.filter(c => {
    if (!enabledTypes.has(c.type)) return false;
    if (!enabledStatuses.has('all') && !enabledStatuses.has(c.status)) return false;
    if (!enabledRegions.has('all') && !enabledRegions.has(getConflictRegion(c))) return false;
    return true;
  });
  updateMarkers();
  updateAlertPanel();
  if (updateBeacons) updateBeacons();
}

function toggleTypeFilter(type, btn) {
  if (enabledTypes.has(type)) {
    if (enabledTypes.size <= 1) return;
    enabledTypes.delete(type);
    btn.classList.remove('active');
  } else {
    enabledTypes.add(type);
    btn.classList.add('active');
  }
  applyFilters();
  syncToggles(type);
}

function toggleRegionFilter(region, btn) {
  if (region === 'all') {
    enabledRegions = new Set(['all']);
    document.querySelectorAll('#fp-region .fp-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.region === 'all');
    });
  } else {
    enabledRegions.delete('all');
    document.querySelector('#fp-region .fp-btn[data-region="all"]').classList.remove('active');
    if (enabledRegions.has(region)) {
      enabledRegions.delete(region);
      btn.classList.remove('active');
    } else {
      enabledRegions.add(region);
      btn.classList.add('active');
    }
  }
  applyFilters();
}

function toggleStatusFilter(status, btn) {
  if (status === 'all') {
    enabledStatuses = new Set(['all']);
    document.querySelectorAll('#fp-status .fp-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.status === 'all');
    });
  } else {
    const allBtn = document.querySelector('#fp-status .fp-btn[data-status="all"]');
    if (enabledStatuses.has('all')) {
      enabledStatuses.delete('all');
      allBtn.classList.remove('active');
    }
    if (enabledStatuses.has(status)) {
      enabledStatuses.delete(status);
      btn.classList.remove('active');
    } else {
      enabledStatuses.add(status);
      btn.classList.add('active');
    }
  }
  applyFilters();
}

function syncToggles(type) {
  document.querySelectorAll(`.tl-tog[data-type="${type}"]`).forEach(b => {
    b.classList.toggle('active', enabledTypes.has(type));
  });
}

function updateCounts() {
  const counts = {};
  conflictData.forEach(c => {
    counts[c.type] = (counts[c.type] || 0) + 1;
  });
  Object.keys(counts).forEach(type => {
    const el = document.getElementById('tc-' + type);
    if (el) el.textContent = counts[type];
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalEl = document.getElementById('tc-total');
  if (totalEl) totalEl.textContent = total;
}

function updateAlertPanel() {
  const body = document.getElementById('ap-body');
  if (!body) return;
  if (filteredConflicts.length === 0) {
    body.innerHTML = '<div class="ap-empty">No conflicts match current filters</div>';
    return;
  }
  body.innerHTML = filteredConflicts.map(c => {
    const color = REGION_COLORS[getConflictRegion(c)] || TYPE_COLORS[c.type] || '#DC2626';
    return `
      <div class="ap-item" data-id="${c.id}" style="cursor:pointer">
        <span class="ap-item-dot" style="background:${color}"></span>
        <div class="ap-item-content">
          <span class="ap-item-title">${c.name}</span>
          <span class="ap-item-meta">${c.parties.join(' · ')} &mdash; ${c.fatalities} fatalities</span>
        </div>
      </div>
    `;
  }).join('');
  body.querySelectorAll('.ap-item').forEach(item => {
    item.addEventListener('click', () => {
      const c = conflictData.find(d => d.id === item.dataset.id);
      if (c) {
        map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 4) });
        showConflictPopup(c);
      }
    });
  });
}

/* ── Map Init ── */
map.on('load', () => {
  mapReady = true;
  hideMapLoading();

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

  /* ── Beacon Sources & Layers ── */
  map.addSource('beacon-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addSource('beacon-leader-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({ id: 'beacon-layer', type: 'circle', source: 'beacon-source',
    paint: { 'circle-radius': 18, 'circle-color': ['get', 'color'], 'circle-opacity': 0.4, 'circle-blur': 0.3 } });
  map.addLayer({ id: 'beacon-glow-layer', type: 'circle', source: 'beacon-source',
    paint: { 'circle-radius': 35, 'circle-color': ['get', 'color'], 'circle-opacity': 0.15, 'circle-blur': 0.7 } });
  map.addLayer({ id: 'beacon-dot-layer', type: 'circle', source: 'beacon-source',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 22, 5], 'circle-color': ['get', 'color'], 'circle-opacity': 0.9 } });
  map.addLayer({ id: 'beacon-leader-layer', type: 'line', source: 'beacon-leader-source',
    paint: { 'line-width': 1, 'line-color': ['get', 'color'], 'line-opacity': 0.25 } });

  const BEACON_TYPES = ['interstate', 'intrastate'];
  let beaconMarkers = {};
  let pulseTimer = null;

  function startBeaconPulse() {
    if (pulseTimer) return;
    pulseTimer = setInterval(() => {
      const t = performance.now() / 1000;
      try {
        map.setPaintProperty('beacon-layer', 'circle-opacity', 0.4 + 0.3 * Math.sin(t * 3.5));
        map.setPaintProperty('beacon-glow-layer', 'circle-opacity', 0.05 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.8)));
      } catch {}
    }, 50);
  }
  startBeaconPulse();

  updateBeacons = function() {
    if (!mapReady) return;
    Object.values(beaconMarkers).forEach(m => m.remove());
    beaconMarkers = {};
    const beaconFeatures = [];
    const leaderFeatures = [];

    BEACON_TYPES.forEach(type => {
      if (!enabledTypes.has(type)) return;
      const latest = [...filteredConflicts]
        .filter(c => c.type === type)
        .sort((a, b) => new Date(b.start) - new Date(a.start))[0];
      if (!latest) return;

      const color = REGION_COLORS[getConflictRegion(latest)] || TYPE_COLORS[type] || '#DC2626';
      const coords = [latest.lng, latest.lat];
      beaconFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { color },
      });

      const screen = map.project(coords);
      const flip = screen.x > window.innerWidth * 0.7;
      screen.x += flip ? -130 : 130;
      const leaderEnd = map.unproject(screen).toArray();
      leaderFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [coords, leaderEnd] },
        properties: { color },
      });

      const el = document.createElement('div');
      el.className = 'beacon-label';
      el.innerHTML = `
        <div style="font-weight:500">${latest.name}</div>
        <div style="font-weight:300;font-size:0.5rem;opacity:0.7;margin-top:1px">Started ${latest.start}</div>
      `;
      el.style.color = color;
      const marker = new maplibregl.Marker({ element: el }).setLngLat(leaderEnd).addTo(map);
      beaconMarkers[type] = marker;
    });

    try {
      map.getSource('beacon-source').setData({ type: 'FeatureCollection', features: beaconFeatures });
      map.getSource('beacon-leader-source').setData({ type: 'FeatureCollection', features: leaderFeatures });
    } catch {}
  };

  const bounds = new maplibregl.LngLatBounds();
  conflictData.forEach(c => bounds.extend([c.lng, c.lat]));
  map.fitBounds(bounds, { padding: 60, duration: 0 });

  applyFilters();
  updateBeacons();

  const meta = dataMeta || {};
  const updated = meta.lastUpdated
    ? new Date(meta.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  document.getElementById('data-source').textContent = updated
    ? `Wikipedia · Updated ${updated}`
    : 'Wikipedia (List of ongoing armed conflicts)';
  document.getElementById('loading-overlay')?.classList.add('hidden');
});

map.on('moveend', () => {
  if (mapReady) { updateMarkers(); if (updateBeacons) updateBeacons(); }
});

map.on('click', () => closePopup());

/* ── Filter Panel Toggle ── */
document.getElementById('fp-toggle').addEventListener('click', () => {
  const panel = document.getElementById('filter-panel');
  const body = document.getElementById('fp-body');
  const arrow = document.querySelector('.fp-arrow');
  const isOpen = panel.classList.toggle('open');
  body.classList.toggle('open', isOpen);
  arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
});

/* ── Filter Event Handlers ── */
document.querySelectorAll('#fp-type .fp-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleTypeFilter(btn.dataset.type, btn));
});

document.querySelectorAll('#fp-region .fp-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleRegionFilter(btn.dataset.region, btn));
});

document.querySelectorAll('#fp-status .fp-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleStatusFilter(btn.dataset.status, btn));
});

/* ── Bottom Toggle Legend ── */
document.querySelectorAll('.tl-tog').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    const fpBtn = document.querySelector(`#fp-type .fp-btn[data-type="${type}"]`);
    if (fpBtn) toggleTypeFilter(type, fpBtn);
  });
});

/* ── Timeline Controls ── */
const NUM_BUCKETS = 100;
let currentStep = NUM_BUCKETS;
let isPlaying = false;
let playTimer = null;

const slider = document.getElementById('tl-slider');
const labelStart = document.getElementById('tl-label-start');
const labelCurrent = document.getElementById('tl-label-current');
const labelEnd = document.getElementById('tl-label-end');

labelStart.textContent = '2020';
labelEnd.textContent = 'Present';
slider.max = NUM_BUCKETS - 1;

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function updateTimelineRange() {
  if (!conflictData.length) return;
  const yearStart = 2020;
  const yearEnd = new Date().getFullYear();
  const range = yearEnd - yearStart;
  const step = currentStep;
  const frac = step / NUM_BUCKETS;
  labelStart.textContent = String(yearStart);
  labelCurrent.textContent = formatDate(Date.UTC(yearStart + frac * range, 0, 1));
  labelEnd.textContent = 'Present';
}

slider.addEventListener('input', () => {
  currentStep = parseInt(slider.value);
  updateTimelineRange();
  updateMarkersByStep(currentStep);
});

function updateMarkersByStep(step) {
  const frac = step / NUM_BUCKETS;
  const yearStart = 2020;
  const yearEnd = new Date().getFullYear();
  const cutoffYear = yearStart + frac * (yearEnd - yearStart);
  const cutoffStr = String(Math.floor(cutoffYear));

  const visible = filteredConflicts.filter(c => {
    const startYear = parseInt(c.start);
    if (isNaN(startYear)) return true;
    return startYear <= parseInt(cutoffStr);
  });

  conflictMarkers.forEach((m, i) => {
    const conflict = visible[i];
    if (conflict) {
      m.getElement().style.display = '';
    } else {
      if (m.getElement) m.getElement().style.display = 'none';
    }
  });
}

function stopPlay() {
  isPlaying = false;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  document.getElementById('tl-play').innerHTML = '&#9654;';
}

function startPlay(dir) {
  if (isPlaying) { stopPlay(); return; }
  isPlaying = true;
  document.getElementById('tl-play').innerHTML = '&#10074;&#10074;';
  playTimer = setInterval(() => {
    if (dir === 'forward') {
      if (currentStep >= NUM_BUCKETS - 1) currentStep = 0;
      else currentStep++;
    } else {
      if (currentStep <= 0) currentStep = NUM_BUCKETS - 1;
      else currentStep--;
    }
    slider.value = currentStep;
    updateTimelineRange();
    updateMarkersByStep(currentStep);
  }, 400);
}

document.getElementById('tl-play').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  startPlay('forward');
});

document.getElementById('tl-step-fwd').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  if (currentStep >= NUM_BUCKETS - 1) currentStep = 0;
  else currentStep++;
  slider.value = currentStep;
  updateTimelineRange();
  updateMarkersByStep(currentStep);
});

document.getElementById('tl-step-back').addEventListener('click', () => {
  if (isPlaying) { stopPlay(); return; }
  if (currentStep <= 0) currentStep = NUM_BUCKETS - 1;
  else currentStep--;
  slider.value = currentStep;
  updateTimelineRange();
  updateMarkersByStep(currentStep);
});

document.getElementById('tl-reset').addEventListener('click', () => {
  if (isPlaying) stopPlay();
  currentStep = 0;
  slider.value = 0;
  updateTimelineRange();
  updateMarkersByStep(currentStep);
});

document.getElementById('tl-live').addEventListener('click', () => {
  if (isPlaying) stopPlay();
  currentStep = NUM_BUCKETS - 1;
  slider.value = currentStep;
  updateTimelineRange();
  updateMarkersByStep(currentStep);
});

/* ── Graph ── */
function drawConflictGraph() {
  const canvas = document.getElementById('cf-graph');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(rect.width - 4, 100);
  const h = 80;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const yearStart = 2020;
  const yearEnd = new Date().getFullYear();
  const years = [];
  const counts = [];
  for (let y = yearStart; y <= yearEnd; y++) {
    years.push(y);
    const activeInYear = conflictData.filter(c => {
      const s = parseInt(c.start);
      if (isNaN(s)) return false;
      if (c.end) {
        const e = parseInt(c.end);
        if (!isNaN(e) && y > e) return false;
      }
      return y >= s;
    }).length;
    counts.push(activeInYear);
  }

  if (counts.length < 2) return;

  const pad = { top: 6, bottom: 18, left: 8, right: 8 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;
  const maxY = Math.max(...counts) * 1.2;

  ctx.strokeStyle = 'rgba(200,50,50,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + gh - (gh * i / 3);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 1.2;
  years.forEach((year, i) => {
    const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
    const y = pad.top + gh - (counts[i] / maxY) * gh;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(220,50,50,0.08)';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + gh);
  years.forEach((year, i) => {
    const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
    const y = pad.top + gh - (counts[i] / maxY) * gh;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(w - pad.right, pad.top + gh);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#DC2626';
  years.forEach((year, i) => {
    const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw;
    const y = pad.top + gh - (counts[i] / maxY) * gh;
    ctx.beginPath();
    ctx.arc(x, y, 2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(245,240,230,0.25)';
  ctx.font = `${7 * dpr}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(years[0], pad.left, h - 2);
  ctx.fillText(years[years.length - 1], w - pad.right, h - 2);

  const trendEl = document.getElementById('cf-trend');
  if (trendEl) {
    const first = counts[0] || 1;
    const last = counts[counts.length - 1];
    const pct = ((last - first) / first * 100).toFixed(0);
    const isUp = last > first;
    trendEl.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(pct)}% active conflicts since ${years[0]}`;
    trendEl.style.color = isUp ? 'rgba(220,60,60,0.75)' : 'rgba(80,220,100,0.75)';
  }

  const compEl = document.getElementById('cf-composition');
  if (compEl) {
    const interstate = conflictData.filter(c => c.type === 'interstate').length;
    const intrastate = conflictData.filter(c => c.type === 'intrastate').length;
    const ongoing = conflictData.filter(c => c.status === 'ongoing').length;
    compEl.innerHTML = `
      <span class="comp-item"><span class="comp-dot" style="background:#DC2626"></span>${interstate} International</span>
      <span class="comp-item"><span class="comp-dot" style="background:#F97316"></span>${intrastate} Civil</span>
      <span class="comp-item"><span class="comp-dot" style="background:rgba(220,60,60,0.5)"></span>${ongoing} Ongoing</span>
    `;
  }
}

drawConflictGraph();

/* ── ResizeObserver ── */
(function() {
  let resizeTimer;
  const panel = document.getElementById('filter-panel');
  if (panel) {
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawConflictGraph, 100);
    });
    ro.observe(panel);
  }
})();

/* ── Background Canvas ── */
(function initBg() {
  const bg = document.getElementById('bg-canvas');
  if (!bg) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  bg.width = w * dpr; bg.height = h * dpr;
  bg.style.width = w + 'px'; bg.style.height = h + 'px';
  const ctx = bg.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = Math.random() * 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,60,60,${0.02 + Math.random() * 0.03})`;
    ctx.fill();
  }
})();

/* ── Loading Overlay ── */
setTimeout(() => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}, 5000);
