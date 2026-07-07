import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import eonetHistoryData from './eonet-history.json'
import rawConflictData from './conflict-data.json'

/* ─── THREE.js Background ─── */
const cvs = document.getElementById('bg-canvas')
if (cvs) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0A0612)
  scene.fog = new THREE.FogExp2(0x0A0612, 0.003)
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000)
  camera.position.set(0, 4, 14)
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.2, 0.05))
  composer.addPass(new OutputPass())
  const starCount = 1200
  const pos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), r = 20 + Math.random() * 80
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.cos(phi)
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xF5F0E6, size: 0.08, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
  scene.add(stars)
  const gp = new Float32Array(300 * 3)
  for (let i = 0; i < 300; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), r = 30 + Math.random() * 40
    gp[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    gp[i * 3 + 1] = r * Math.cos(phi) * 0.4
    gp[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3))
  const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ color: 0x6B3FA0, size: 0.5, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
  scene.add(glow)
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  document.addEventListener('mousemove', e => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = -(e.clientY / innerHeight) * 2 + 1 })
  function animate() {
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05
    stars.rotation.y += 0.00015; stars.rotation.x += mouse.y * 0.00005; stars.rotation.z += mouse.x * 0.00003
    glow.rotation.y = stars.rotation.y * 0.7
    composer.render(); requestAnimationFrame(animate)
  }
  animate()
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight)
  })
}

/* ─── Data ─── */

const M6_DATA = [
  { year: 2000, count: 160 }, { year: 2001, count: 137 },
  { year: 2002, count: 139 }, { year: 2003, count: 154 },
  { year: 2004, count: 157 }, { year: 2005, count: 150 },
  { year: 2006, count: 153 }, { year: 2007, count: 196 },
  { year: 2008, count: 179 }, { year: 2009, count: 160 },
  { year: 2010, count: 174 }, { year: 2011, count: 207 },
  { year: 2012, count: 133 }, { year: 2013, count: 142 },
  { year: 2014, count: 155 }, { year: 2015, count: 146 },
  { year: 2016, count: 147 }, { year: 2017, count: 110 },
  { year: 2018, count: 134 }, { year: 2019, count: 145 },
  { year: 2020, count: 121 }, { year: 2021, count: 157 },
  { year: 2022, count: 127 }, { year: 2023, count: 147 },
  { year: 2024, count: 99 },  { year: 2025, count: 144 },
].sort((a, b) => a.year - b.year)

const EQ_CACHE_KEY = 'dh_eq_data'
const CACHE_TTL = 3600000

const CONFLICT_DATA = rawConflictData.conflicts || []
const EONET_HISTORY = eonetHistoryData || {}

const TYPE_COLORS = {
  earthquake: '#EF4444',
  flood: '#3B82F6',
  cyclone: '#F59E0B',
  volcano: '#8B5CF6',
  wildfire: '#F97316',
}

const TYPE_LABELS = {
  earthquake: 'Earthquake',
  flood: 'Flood',
  cyclone: 'Cyclone',
  volcano: 'Volcano',
  wildfire: 'Wildfire',
}

/* ─── Helpers ─── */

function daysUntil(year, month, day) {
  const target = new Date(year, month - 1, day)
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.floor(diff / 86400000)
}

function countdownStr(days) {
  if (days <= 0) return 'Today!'
  if (days === 1) return '1 day'
  return `${days.toLocaleString()} days`
}

function timeUntil(year, month, day) {
  const target = new Date(year, month - 1, day)
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 }
  const totalSecs = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSecs / 86400),
    hours: Math.floor((totalSecs % 86400) / 3600),
    mins: Math.floor((totalSecs % 3600) / 60),
    secs: totalSecs % 60,
  }
}

function trimLeadingZeros(arr) {
  const idx = arr.findIndex(d => d.count > 0)
  return idx > 0 ? arr.slice(idx) : arr
}

function computeTrend(data) {
  if (data.length < 6) return { pct: 0, direction: 0 }
  const first3 = (data[0].count + data[1].count + data[2].count) / 3
  const last3 = (data[data.length - 1].count + data[data.length - 2].count + data[data.length - 3].count) / 3
  if (first3 === 0) return { pct: 0, direction: 0 }
  if (first3 < 20) return { pct: null, direction: 0, first3: Math.round(first3), last3: Math.round(last3) }
  const pct = ((last3 - first3) / first3) * 100
  return { pct, direction: pct > 0 ? 1 : pct < 0 ? -1 : 0 }
}

function updateTimestamp() {
  const el = document.getElementById('dh-timestamp')
  if (!el) return
  const now = new Date()
  el.textContent = `Last updated: ${now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}

/* ─── Card Renderers ─── */

async function loadEonetCurrentYear(cats) {
  const eonetKeys = ['flood', 'cyclone', 'volcano', 'wildfire']
  const eonetCatIds = { wildfires: 'wildfire', floods: 'flood', severeStorms: 'cyclone', volcanoes: 'volcano' }
  const cy = new Date().getFullYear()
  try {
    const [openData, closedData] = await Promise.all([
      fetch('https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=wildfires,floods,severeStorms,volcanoes&status=open&limit=5000').then(r => r.ok ? r.json() : null),
      fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=wildfires,floods,severeStorms,volcanoes&status=closed&start=${cy}-01-01&end=${cy}-12-31&limit=5000`).then(r => r.ok ? r.json() : null),
    ])
    const counts = { wildfires: 0, floods: 0, severeStorms: 0, volcanoes: 0 }
    const allFeatures = [...(openData?.features || []), ...(closedData?.features || [])]
    allFeatures.forEach(f => {
      const p = f.properties || {}
      if ((p.date || '').slice(0, 4) !== String(cy)) return
      const catId = (p.categories || [])[0]?.id || ''
      if (counts[catId] !== undefined) counts[catId]++
    })
    eonetKeys.forEach(k => {
      const cat = cats.find(c => c.id === k)
      if (!cat || !cat.data) return
      const liveCount = counts[Object.entries(eonetCatIds).find(([, v]) => v === k)?.[0]] || 0
      const existing = cat.data.find(d => d.year === cy)
      const prevCount = existing ? existing.count : 0
      // Use the higher count — live API may miss closed events, local snapshot may be stale
      const mergedCount = Math.max(prevCount, liveCount)
      if (existing) existing.count = mergedCount
      else cat.data.push({ year: cy, count: mergedCount })
      cat.data.sort((a, b) => a.year - b.year)
      cat.trendData = trimLeadingZeros(cat.data)
      if (cat.data.length >= 2) {
        drawMiniGraph(`dg-canvas-${k}`, cat.data, cat.color)
        const trend = computeTrend(cat.trendData)
        updateTrendEl(`dg-trend-${k}`, trend)
      }
    })
  } catch (e) {
    console.warn('Live EONET fetch failed, using cached data:', e)
  }
}

function renderConvergenceCard() {
  const now = new Date()
  const events = [
    { label: 'Next Eclipse', date: 'Aug 12, 2026', y: 2026, m: 8, d: 12, note: '' },
    { label: 'Apophis Close Approach', date: 'Apr 13, 2029', y: 2029, m: 4, d: 13, note: '' },
    { label: 'Shemitah 828', date: 'Sep 21, 2029', y: 2029, m: 9, d: 21, note: '' },
    { label: '1967 Boundary', date: 'Jun 7, 2037', y: 2037, m: 6, d: 7, note: '' },
  ]
  const items = events.map(e => {
    const t = timeUntil(e.y, e.m, e.d)
    const years = (t.days / 365.25).toFixed(1)
    return `
      <div class="cd-item">
        <span class="cd-number">${t.days}</span>
        <span class="cd-unit">days (${years} yrs)</span>
        <span class="cd-event">${e.label}</span>
        <span class="cd-date">${e.date}</span>
        ${e.note ? `<span class="cd-note">${e.note}</span>` : ''}
      </div>
    `
  }).join('')
  return `
    <div class="cd-row">${items}</div>
    <div class="cd-converge">All markers converge on 2029–2037 window</div>
  `
}

function renderDisasterPlaceholder() {
  return '<div id="dg-container"></div>'
}

function renderDisasterGraphsCard(container) {
  const eonetKeys = ['flood', 'cyclone', 'volcano', 'wildfire']
  const cats = [
    { id: 'earthquake', color: TYPE_COLORS.earthquake, data: null, label: 'Earthquake (M4.5+)' },
  ]
  eonetKeys.forEach(k => {
    const raw = (EONET_HISTORY[k] || []).map(d => ({ ...d }))
    const cy = new Date().getFullYear()
    if (raw.length > 0) {
      const existing = raw.find(d => d.year === cy)
      if (!existing) raw.push({ year: cy, count: 0 })
    }
    raw.sort((a, b) => a.year - b.year)
    const trimmed = trimLeadingZeros(raw)
    cats.push({ id: k, color: TYPE_COLORS[k], data: raw, trendData: trimmed, label: TYPE_LABELS[k] })
  })

  let html = '<div class="dg-row">'
  cats.forEach((cat, idx) => {
    const canvasId = `dg-canvas-${cat.id}`
    const trendId = `dg-trend-${cat.id}`
    html += `
      <div class="dg-item">
        <div class="dg-header">
          <span class="dg-label">${cat.label}</span>
          <span class="dg-trend" id="${trendId}"></span>
        </div>
        <canvas class="dg-canvas" id="${canvasId}"></canvas>
      </div>
    `
  })
  html += '</div>'

  const target = container.querySelector('#dg-container') || container
  target.innerHTML = html

  eonetKeys.forEach(k => {
    const cat = cats.find(c => c.id === k)
    if (cat && cat.data && cat.data.length >= 2) {
      drawMiniGraph(`dg-canvas-${k}`, cat.data, cat.color)
      const trend = computeTrend(cat.trendData)
      updateTrendEl(`dg-trend-${k}`, trend)
    }
  })

  loadEarthquakeData()
  loadEonetCurrentYear(cats)
}

function updateTrendEl(id, trend) {
  const el = document.getElementById(id)
  if (!el) return
  if (trend.pct === null) {
    el.textContent = `${trend.first3} → ${trend.last3}`
    el.className = `dg-trend ${trend.last3 > trend.first3 ? 'pos' : 'neg'}`
  } else if (trend.pct !== 0) {
    const cls = trend.pct > 0 ? 'pos' : 'neg'
    const sign = trend.pct > 0 ? '+' : ''
    el.textContent = `${sign}${trend.pct.toFixed(0)}%`
    el.className = `dg-trend ${cls}`
  } else {
    el.textContent = ''
    el.className = 'dg-trend'
  }
}

async function loadEarthquakeData() {
  try {
    const cached = localStorage.getItem(EQ_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.ts < CACHE_TTL && parsed.data && parsed.data.length > 0) {
        drawMiniGraph('dg-canvas-earthquake', parsed.data, TYPE_COLORS.earthquake)
        setEquakeTrend(parsed.data)
        return
      }
    }
  } catch (_) {}

  try {
    const cy = new Date().getFullYear()
    const years = []
    for (let y = 1948; y <= cy; y++) years.push(y)
    const yearCounts = {}
    const BATCH = 30
    for (let i = 0; i < years.length; i += BATCH) {
      const batch = years.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(y =>
        fetch(`https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&starttime=${y}-01-01&endtime=${y}-12-31&minmagnitude=4.5`)
          .then(r => r.ok ? r.json() : null)
      ))
      results.forEach((res, j) => {
        if (res.status === 'fulfilled' && res.value && res.value.count !== undefined) {
          yearCounts[batch[j]] = res.value.count
        }
      })
    }
    const data = Object.entries(yearCounts)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year)
    if (data.length > 0) {
      try { localStorage.setItem(EQ_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch (_) {}
    }
    drawMiniGraph('dg-canvas-earthquake', data, TYPE_COLORS.earthquake)
    setEquakeTrend(data)
  } catch (e) {
    console.warn('Earthquake data fetch failed:', e)
  }
}

function setEquakeTrend(data) {
  if (data.length < 6) return
  const first3 = (data[0].count + data[1].count + data[2].count) / 3
  const last3 = (data[data.length - 1].count + data[data.length - 2].count + data[data.length - 3].count) / 3
  const pct = ((last3 - first3) / first3 * 100)
  updateTrendEl('dg-trend-earthquake', { pct, direction: pct > 0 ? 1 : pct < 0 ? -1 : 0 })
}



const GRAPH_CACHE = {}

function drawMiniGraph(canvasId, data, color) {
  GRAPH_CACHE[canvasId] = { data, color }
  const canvas = document.getElementById(canvasId)
  if (!canvas || data.length < 2) return
  const rect = canvas.parentElement.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(rect.width - 4, 60)
  const h = 60
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const pad = { top: 5, bottom: 15, left: 10, right: 10 }
  const gw = w - pad.left - pad.right
  const gh = h - pad.top - pad.bottom
  const years = data.map(d => d.year)
  const counts = data.map(d => d.count)
  const minY = 0
  const maxY = Math.max(...counts, 1) * 1.1

  ctx.strokeStyle = 'rgba(212,175,55,0.06)'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + gh - (gh * i / 3)
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(w - pad.right, y)
    ctx.stroke()
  }

  if (data.length >= 2) {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    years.forEach((year, i) => {
      const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw
      const y = pad.top + gh - (counts[i] - minY) / (maxY - minY) * gh
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top + gh)
    years.forEach((year, i) => {
      const x = pad.left + (year - years[0]) / (years[years.length - 1] - years[0]) * gw
      const y = pad.top + gh - (counts[i] - minY) / (maxY - minY) * gh
      ctx.lineTo(x, y)
    })
    ctx.lineTo(pad.left + gw, pad.top + gh)
    ctx.closePath()
    ctx.fillStyle = color + '14'
    ctx.fill()
  }

  const li = years.length - 1
  const bx = pad.left + gw
  const by = pad.top + gh - (counts[li] - minY) / (maxY - minY) * gh
  ctx.beginPath()
  ctx.arc(bx, by, 4, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bx, by, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(245,240,230,0.85)'
  ctx.fill()

  ctx.fillStyle = 'rgba(245,240,230,0.25)'
  ctx.font = '7px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(years[0], pad.left, h - 2)
  ctx.fillText(years[li], pad.left + gw, h - 2)
}

function renderConflictCard() {
  const ongoing = CONFLICT_DATA.filter(c => c.status === 'ongoing')
  if (ongoing.length === 0) {
    return '<div class="cf-empty">No active conflicts in dataset</div>'
  }
  const latest = ongoing.sort((a, b) => {
    const da = a.start ? new Date(a.start) : new Date(0)
    const db = b.start ? new Date(b.start) : new Date(0)
    return db - da
  })[0]
  const REGION_COLORS = { europe: '#DC2626', 'middle-east': '#F97316', africa: '#F59E0B', asia: '#8B5CF6', americas: '#3B82F6' }
  function getRegion(c) {
    const r = (c.region || '').toLowerCase()
    if (r.includes('middle east')) return '#F97316'
    if (r.includes('africa')) return '#F59E0B'
    if (r.includes('asia')) return '#8B5CF6'
    if (r.includes('america')) return '#3B82F6'
    return '#DC2626'
  }
  return `
    <div class="cf-wrap">
      <div class="cf-dot" style="background:${getRegion(latest)}"></div>
      <div class="cf-body">
        <div class="cf-name">${latest.name}</div>
        <div class="cf-parties">${(latest.parties || []).join(' vs ')}</div>
        <div class="cf-meta">
          <span>${latest.fatalities || 'Unknown'} fatalities</span>
          <span>Since ${latest.start || '?'}</span>
          <span>${latest.type || ''}</span>
        </div>
      </div>
    </div>
  `
}

function renderSignOfJonahCard() {
  return `
    <div class="sj-ref">Revelation 12:1–2 &middot; Matthew 12:39–40 (KJV)</div>
    <div class="sj-text">The woman clothed with the sun, the moon under her feet, and a crown of twelve stars — this precise astronomical configuration occurred September 23, 2017. Virgo was "clothed" with the sun (the sun in Virgo), the moon at her feet (near Spica), and nine stars of Leo formed the crown overhead.</div>
    <div class="sj-fulfill">&#10003; Fulfilled September 23, 2017 &mdash; a celestial sign marking the "birth" of a prophetic generation (Revelation 12:1-5). The Revelation 12 Sign points to the timing pattern of death, burial, and resurrection — and by extension, the near fulfillment of remaining end-times events.</div>
  `
}

function renderTimelineCard() {
  const nodes = [
    { year: 2017.73, label: 'Rev 12 Sign', date: 'Sep 23, 2017', side: 'below', align: 'left', cls: 'past' },
    { year: 2024.25, label: 'Great American Eclipse', date: 'Apr 8, 2024', side: 'above', align: 'center', cls: 'past' },
    { year: 2026.67, label: 'Total Solar Eclipse', date: 'Aug 12, 2026', side: 'below', align: 'center', cls: 'future' },
    { year: 2029.25, label: 'Apophis', date: 'Apr 13, 2029', side: 'above', align: 'right', cls: 'future' },
    { year: 2029.75, label: 'Shemitah 828', date: 'Sep 21, 2029', side: 'below', align: 'right', cls: 'future' },
  ]
  const rangeStart = 2017, rangeEnd = 2030, range = rangeEnd - rangeStart

  const now = new Date()
  const dayOfYear = (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  const nowYear = now.getFullYear() + dayOfYear / 365
  const nowPct = Math.min(Math.max(((nowYear - rangeStart) / range) * 100, 0), 100)

  const dots = nodes.map(n => {
    const pct = Math.min(Math.max(((n.year - rangeStart) / range) * 100, 0), 100)
    return `<div class="tl-dot ${n.cls}" style="left:${pct}%"></div>`
  }).join('')

  const labels = nodes.map(n => {
    const pct = Math.min(Math.max(((n.year - rangeStart) / range) * 100, 0), 100)
    const xform = n.align === 'left' ? 'translateX(0)' : n.align === 'right' ? 'translateX(-100%)' : 'translateX(-50%)'
    return `
      <div class="tl-label ${n.side}" style="left:${pct}%;transform:${xform}">
        <span class="tl-name">${n.label}</span>
        <span class="tl-year">${n.date}</span>
      </div>
    `
  }).join('')

  return `
    <div class="tl-track">
      <div class="tl-dot present" style="left:${nowPct}%"></div>
      ${dots}
      ${labels}
    </div>
    <div class="tl-status">Past ← Historical Markers — Now — Prophetic Markers → Future</div>
  `
}

function renderCalendarCard() {
  const events = [
    { date: 'Aug 12, 2026', name: 'Total Solar Eclipse', y: 2026, m: 8, d: 12, note: 'Path crosses Aleph-Tav pattern' },
    { date: 'Sep 21, 2029', name: 'Shemitah Cycle 828 Begins', y: 2029, m: 9, d: 21, note: 'Rosh Hashanah — 7th year' },
    { date: 'Apr 13, 2029', name: 'Apophis Closest Approach', y: 2029, m: 4, d: 13, note: 'Visible to naked eye' },
  ]
  return events.map(e => {
    const d = daysUntil(e.y, e.m, e.d)
    return `
      <div class="cal-event">
        <div class="cal-left">
          <div class="cal-name">${e.name}</div>
          <div class="cal-note">${e.note}</div>
        </div>
        <div class="cal-right">
          <div class="cal-countdown">${d > 0 ? `${d.toLocaleString()} days` : 'Past'}</div>
          <span class="cal-date">${e.date}</span>
        </div>
      </div>
    `
  }).join('')
}

function renderRaptureCard() {
  const sections = [
    {
      header: 'Fulfilled (past)',
      cls: 'done',
      items: [
        'Israel becomes a nation (1948)',
        'Jerusalem reunified (1967)',
        'Rev 12 celestial sign (2017)',
      ]
    },
    {
      header: 'Before the Rapture',
      cls: 'waiting',
      items: [
        'Global lawlessness increasing',
        'Birth pains intensifying (Matthew 24:8)',
      ]
    },
    {
      header: 'After the Rapture (Tribulation)',
      cls: 'waiting',
      items: [
        'Temple rebuilt, sacrifices resume (Dan 9:27)',
        'Covenant with many confirming 70th week',
        'Abomination of desolation (mid-week)',
        'Mark of the beast enforced',
      ]
    },
    {
      header: 'Before Christ\'s Return',
      cls: 'waiting',
      items: [
        'Armageddon gathered',
        'Signs in sun, moon, stars',
        'The 7th trumpet &ndash; kingdoms become His',
      ]
    },
  ]
  return sections.map(s => `
    <div class="rc-section">
      <div class="rc-section-header">${s.header}</div>
      ${s.items.map(item => `
        <div class="rc-item ${s.cls}">
          <span class="rc-check">${s.cls === 'done' ? '&#10003;' : '&#9679;'}</span>
          ${item}
        </div>
      `).join('')}
    </div>
  `).join('')
}

function renderAlephTavCard() {
  return `
    <div class="at-text">The Aleph-Tav (<span style="font-family:serif">&#1488;&#1514;</span>) pattern — the first and last letters of the Hebrew alphabet — appears throughout the Old Testament as a linguistic marker of divine significance. When mapped onto solar eclipse paths over the United States (2017, 2024, 2045), they form a cross pattern (&#10010;) across the continent. The path intersections align with towns named Salem (Peace) and Nineveh (Judgment), echoing biblical prophecy patterns at a statistically improbable rate.</div>
    <div class="at-text" style="margin-top:0.15rem">These eclipse crosses converge on the same window (2017–2045) as the other prophetic markers, reinforcing the timing convergence.</div>
    <div class="at-ref">Isaiah 44:6 &middot; Revelation 1:8 (KJV)</div>
  `
}

function renderFeastCard() {
  const feastCandidates = [
    { name: 'Feast of Trumpets (Yom Teruah)', y: 2026, m: 9, d: 12, case: 'The "last trump" (1 Cor 15:52) and "no man knows the day" (Matt 24:36) fit this feast. But no verse explicitly names it — the connection is inferential from the feast pattern (spring feasts fulfilled at first coming, fall feasts await fulfillment).' },
    { name: 'Day of Atonement (Yom Kippur)', y: 2026, m: 9, d: 21, case: 'Typically linked to Christ\'s return, not the rapture — the Day of the Lord, national repentance, and judgment. Most pre-trib teachers see this as the Second Coming.' },
    { name: 'Feast of Tabernacles (Sukkot)', y: 2026, m: 10, d: 5, case: 'The Lord tabernacles with man. Usually tied to the Millennial reign, not the rapture or tribulation.' },
  ]
  const now = new Date()
  const future = feastCandidates.filter(f => new Date(f.y, f.m - 1, f.d) > now)
  const best = future.length > 0 ? future[0] : feastCandidates[0]
  const d = daysUntil(best.y, best.m, best.d)
  return `
    <span class="fs-countdown">${d.toLocaleString()} days</span>
    <span class="fs-event">Until ${best.name}</span>
    <div class="fs-note">${best.case}</div>
  `
}

/* ─── Zone Definitions ─── */

const ZONES = [
  {
    header: 'COUNTDOWN',
    cards: [
      { id: 'card-convergence', title: 'Convergence Countdown', render: renderConvergenceCard, wide: true },
      { id: 'card-timeline', title: 'Prophetic Timeline', render: renderTimelineCard, wide: true },
    ]
  },
  {
    header: 'BIRTH PAINS',
    cards: [
      { id: 'card-disasters', title: 'Disaster Frequency Trends', render: renderDisasterPlaceholder, wide: true, custom: renderDisasterGraphsCard },
    ]
  },
  {
    header: 'CURRENT STATE',
    cards: [
      { id: 'card-conflict', title: 'Latest Major Conflict', render: renderConflictCard },
      { id: 'card-revelation-12', title: 'Revelation 12 Sign', render: renderSignOfJonahCard },
    ]
  },
  {
    header: 'PROPHETIC MARKERS',
    cards: [
      { id: 'card-calendar', title: 'Upcoming Calendar Events', render: renderCalendarCard },
      { id: 'card-rapture', title: 'Rapture & Tribulation', render: renderRaptureCard },
      { id: 'card-aleph-tav', title: 'Aleph-Tav Eclipse Pattern', render: renderAlephTavCard },
      { id: 'card-feasts', title: 'Next Prophetic Feast (speculative)', render: renderFeastCard },
    ]
  },
]

/* ─── Render ─── */

function renderAll() {
  const root = document.getElementById('zones-root')
  if (!root) return

  let html = ''
  ZONES.forEach(zone => {
    html += `<div class="zone"><div class="zone-header">${zone.header}</div><div class="zone-grid">`
    zone.cards.forEach(card => {
      let titleHtml = `<span>${card.title}</span>`
      html += `<div class="data-card${card.wide ? ' wide' : ''}" id="${card.id}">`
      html += `<div class="dc-title">${titleHtml}</div>`
      if (card.render) {
        html += card.render()
      }
      html += `</div>`
    })
    html += `</div></div>`
  })
  root.innerHTML = html

  /* Custom renderers that need post-render DOM access */
  ZONES.forEach(zone => {
    zone.cards.forEach(card => {
      if (card.custom) {
        const el = document.getElementById(card.id)
        if (el) card.custom(el)
      }
    })
  })
}

/* ─── Countdown refresh ─── */

function refreshCountdowns() {
  const card = document.getElementById('card-convergence')
  if (!card) return
  const titleEl = card.querySelector('.dc-title')
  const body = card.querySelector('.cd-row, .cd-converge') ? card : null
  if (body) {
    body.innerHTML = renderConvergenceCard()
  } else {
    card.innerHTML = `
      <div class="dc-title"><span>Convergence Countdown</span></div>
      ${renderConvergenceCard()}
    `
  }
  /* Re-add title to converage cd card */
  const t = card.querySelector('.dc-title')
  if (t) t.innerHTML = '<span>Convergence Countdown</span>'
}

setInterval(refreshCountdowns, 60000)

/* ─── Init ─── */

function redrawGraphs() {
  Object.entries(GRAPH_CACHE).forEach(([id, { data, color }]) => {
    if (data && data.length >= 2) {
      drawMiniGraph(id, data, color)
    }
  })
}

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(redrawGraphs, 150)
})

document.addEventListener('DOMContentLoaded', () => {
  updateTimestamp()
  renderAll()
  setInterval(updateTimestamp, 60000)
})
