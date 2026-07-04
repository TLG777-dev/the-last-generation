import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

const J2000 = 2451545.0
const API_URL = '/api/jpl-sbdb?sstr=99942&phys-par=1&ca-data=1'
const AU_SCALE = 7
import jplFallback from './jpl-data.json'
import cometFallback from './data/comet-jpl-fallback.json'
import earthFallback from './data/jpl-earth-fallback.json'

// ── Noise Utilities ──
function hash2D(x, y) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return (h ^ (h >> 16)) / 2147483647
}
function smoothstep(t) { return t * t * (3 - 2 * t) }
function lerp(a, b, t) { return a + (b - a) * t }
function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = smoothstep(x - ix), fy = smoothstep(y - iy)
  const a = hash2D(ix, iy), b = hash2D(ix + 1, iy)
  const c = hash2D(ix, iy + 1), d = hash2D(ix + 1, iy + 1)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}
function fbm(x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, maxAmp = 0
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise(x * freq, y * freq)
    maxAmp += amp; amp *= 0.5; freq *= 2
  }
  return val / maxAmp
}
function domainWarp(x, y, strength = 0.3) {
  const dx = fbm(x + 5.2, y + 1.3, 3) * strength
  const dy = fbm(x + 9.7, y + 3.8, 3) * strength
  return fbm(x + dx, y + dy, 4)
}

const PLANETS = [
  { name:'Mercury', orbitR:3.0, r:0.12, period:87.97,  phase:3.1231, tex:'mercury', glow:null, in:7.014, om:48.124, w:25.816 },
  { name:'Venus',   orbitR:5.0, r:0.20, period:224.7,   phase:0.5347, tex:'venus',   glow:null, in:3.382, om:76.633, w:74.541 },
  { name:'Earth',   orbitR:7.0, r:0.22, period:365.25,  phase:1.7514, tex:'earth',   glow:null, in:0, om:0, w:0 },
  { name:'Mars',    orbitR:9.5, r:0.15, period:687.0,   phase:0.3555, tex:'mars',    glow:null, in:1.847, om:49.474, w:285.700 },
  { name:'Jupiter', orbitR:14.0,r:0.85, period:4332.6,  phase:0.3461, tex:'jupiter', glow:null, in:1.304, om:100.485, w:274.040 },
  { name:'Saturn',  orbitR:19.0,r:0.65, period:10759.2, phase:5.5393, tex:'saturn',  glow:null, ring:true, in:2.485, om:113.709, w:338.917 },
  { name:'Uranus',  orbitR:25.0,r:0.30, period:30688.5, phase:2.4815, tex:'uranus',  glow:null, in:0.772, om:74.015, w:97.042 },
  { name:'Neptune', orbitR:30.0,r:0.28, period:60182.3, phase:4.4991, tex:'neptune', glow:null, in:1.772, om:131.773, w:275.353 },
]

const APOPHIS_ELS = {
  a: 0.9223803173917017, e: 0.1911663355386932, i: 3.340958441017069,
  om: 203.8996515621043, w: 126.6728325163065, M: 312.8054663584516,
  epoch: 2461000.5, period: 323.5664375491271
}

const EARTH_API_URL = '/api/jpl-sbdb?sstr=399'
let EARTH_ELS = {
  a: 1.000001, e: 0.0167086, i: 0.00005,
  om: 0, w: 102.93735, M: 357.527,
  epoch: 2451545.0, period: 365.25636
}
const INNER_PLANET_ELS = {
  Mercury: { a: 0.387098, e: 0.205630, i: 7.004, om: 48.330, w: 29.125, M: 174.796, epoch: 2451545.0, period: 87.969 },
  Venus:   { a: 0.723332, e: 0.006772, i: 3.395, om: 76.680, w: 54.884, M: 50.416,  epoch: 2451545.0, period: 224.701 },
  Mars:    { a: 1.523679, e: 0.093400, i: 1.850, om: 49.558, w: 286.502, M: 19.393,  epoch: 2451545.0, period: 686.979 }
}

let COMET_3I = {
  q: 1.356481057231181, e: 6.141351449317625, i: 175.1164570850441,
  om: 322.1696089290778, w: 128.0228697185194,
  tp: 2460977.995262847653,
  A1: 5.320206310958365e-8, A2: 1.148166024648843e-8, A3: -6.854491622221589e-9,
  epoch: 2461090.5, soln_date: '2026-02-19', n_obs_used: 782
}

const MOON = { orbitR: 0.65, r: 0.055, period: 27.3216, phase: 2.560, in: 5.240, om: 123.958, w: 308.923 }

let scene, camera, renderer, labelRenderer, composer, controls
let starfield, sunMesh, sunLight
let planetMeshes = [], orbitRings = [], clickTargets = []
let planetLabels = [], leaderLines = []
let apophisMesh, apophisOrbitRing, apophisBeacon, apophisLight
let moonMesh, moonLabel
let cometMesh, cometTail, cometBeacon, cometLight
let raycaster, mouse, selectedObject
let simJD, timeSpeed = 1, isPlaying = false, isReverse = false
let planetsContainer, apophisContainer, moonContainer, cometContainer
let zoomTarget = null, zoomDist = 0, isTracking = false
// Toolbar uses scene overlay for timer
let starTexture, nextApproachJD = 0, nextApproachDist = Infinity
let jplApproaches = []
let spherical, panH = 0, panV = 0

const $ = id => document.getElementById(id)

function getCurrentJD() {
  const d = new Date()
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return 2440587.5 + utc / 86400000
}

// ─── Init ───
function init() {
  simJD = 2461042.5
  const simDateEl = $('sim-date')
  if (simDateEl) simDateEl.textContent = formatJD(simJD)
  // Set comet data from constant
  const setComet = (id, val, suffix = '') => {
    const el = $(id)
    if (el) el.textContent = `${val}${suffix}`
  }
  setComet('td-comet-e', COMET_3I.e.toFixed(4))
  setComet('td-comet-i', COMET_3I.i.toFixed(2), '°')
  setComet('td-comet-q', COMET_3I.q.toFixed(3), ' au')

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050510)
  scene.fog = new THREE.Fog(0x050510, 80, 120)

  const w = window.innerWidth, h = window.innerHeight
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
  camera.position.set(35, 22, 45)

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.8
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.15, 0.05))

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 2
  controls.maxDistance = 100
  controls.addEventListener('start', () => { isTracking = false })
  controls.target.set(0, 0, 0)
  spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(w, h)
  labelRenderer.domElement.style.position = 'fixed'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  labelRenderer.domElement.style.zIndex = '10'
  document.body.appendChild(labelRenderer.domElement)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  starTexture = createStarTexture()

  createStarfield()
  createSun()
  createPlanets()
  createMoon()
  createApophis()
  createCloseApproachMarker()
  createComet3I()
  createLabels()
  scanNextApproach()
  setupEventListeners()
  setupUI()
  fetchJPLData()
  setupBibleVerses()
  fetchCometJPLData()
  fetchEarthJPLData()

  isPlaying = true
  $('btn-play').innerHTML = '&#9646;&#9646;'

  requestAnimationFrame(() => {
    $('apophis-loading').classList.add('hidden')
  })
  animate()
}

// ─── Star Texture ───
function createStarTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.2)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.needsUpdate = true
  return t
}

// ─── Starfield (15k, varied colors) ───
function createStarfield() {
  const count = 15000
  const geom = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 120
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    pos[i*3] = r * Math.sin(phi) * Math.cos(theta)
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i*3+2] = r * Math.cos(phi)
    const starType = Math.random()
    let cr, cg, cb
    if (starType < 0.1) { cr=0.8+0.2*Math.random(); cg=0.7+0.2*Math.random(); cb=0.9+0.1*Math.random() } // blue
    else if (starType < 0.25) { cr=0.9+0.1*Math.random(); cg=0.85+0.1*Math.random(); cb=0.7+0.2*Math.random() } // yellow
    else if (starType < 0.35) { cr=1.0; cg=0.5+0.2*Math.random(); cb=0.2+0.1*Math.random() } // orange
    else if (starType < 0.4) { cr=0.9+0.1*Math.random(); cg=0.3+0.1*Math.random(); cb=0.1*Math.random() } // red
    else { const v=0.6+0.4*Math.random(); cr=v; cg=v; cb=v } // white
    col[i*3]=cr; col[i*3+1]=cg; col[i*3+2]=cb
    sizes[i] = 0.3 + Math.random() * 1.2
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3))

  const mat = new THREE.PointsMaterial({
    size: 0.3, vertexColors: true, transparent: true, opacity: 0.9,
    sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
    map: starTexture, alphaTest: 0.001
  })
  starfield = new THREE.Points(geom, mat)
  scene.add(starfield)
}

// ─── Procedural Planet Textures (cinematic, high-contrast) ───
function makeTexture(w, h, drawFn) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  drawFn(ctx, w, h)
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

function addBloomCanvas(canvas, factor) {
  const ctx = canvas.getContext('2d')
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i] = Math.min(255, Math.round(d.data[i] * factor))
    d.data[i+1] = Math.min(255, Math.round(d.data[i+1] * factor))
    d.data[i+2] = Math.min(255, Math.round(d.data[i+2] * factor))
  }
  ctx.putImageData(d, 0, 0)
}

function sunTexture() {
  return makeTexture(512, 256, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const gran = fbm(u * 10, v * 10, 4)
        const cell = domainWarp(u * 6, v * 6, 0.5)
        const floc = Math.sin(u * 15 + v * 12) * 0.15 + cell * 0.2
        const bright = 0.9 + gran * 0.15 + floc
        const r = Math.min(255, Math.round(255 * bright))
        const g = Math.min(255, Math.round(230 * bright * (0.9 + gran * 0.1)))
        const b = Math.min(200, Math.round(140 * bright * (0.8 + gran * 0.12)))
        const idx = (y * w + x) * 4
        d.data[idx]=r; d.data[idx+1]=g; d.data[idx+2]=b; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
  })
}

function mercuryTexture() {
  return makeTexture(512, 256, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const base = fbm(u * 5, v * 5, 5)
        const crater = fbm(u * 22, v * 22, 4)
        const rim = Math.max(0, 1 - Math.abs(crater - 0.5) * 5)
        const craterDark = crater < 0.32 ? 0.5 : 1
        const brightSpot = fbm(u * 8 + 3, v * 8 + 7, 3) > 0.6 ? 1.15 : 1
        let vv = Math.round(190 * (0.75 + base * 0.25) * craterDark * brightSpot - rim * 35)
        vv = Math.min(255, Math.max(40, vv))
        const idx = (y * w + x) * 4
        d.data[idx]=vv + 5; d.data[idx+1]=vv; d.data[idx+2]=vv - 5; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
  })
}

function venusTexture() {
  return makeTexture(512, 256, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const flow = domainWarp(u * 3.5 + v * 0.5, v * 3.5 - u * 0.3, 0.6)
        const swirl = Math.sin(u * 10 + v * 7 + flow * 5) * 0.5 + 0.5
        const detail = fbm(u * 12, v * 12, 3) * 0.18
        const band = Math.sin(v * 14 + flow * 3) * 0.1
        const cloud = Math.min(1, swirl * 0.7 + detail + band)
        const r = Math.round(215 + cloud * 40)
        const g = Math.round(190 + cloud * 35)
        const b = Math.round(140 + cloud * 25)
        const idx = (y * w + x) * 4
        d.data[idx]=Math.min(255,r); d.data[idx+1]=Math.min(255,g); d.data[idx+2]=Math.min(255,b); d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
  })
}

function earthTexture() {
  return makeTexture(1024, 512, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const warp = domainWarp(u * 3, v * 3, 0.4)
        const detail = fbm(u * 6, v * 6, 4)
        const polar = v < 0.08 ? (0.08 - v) / 0.08 : v > 0.92 ? (v - 0.92) / 0.08 : 0
        const idx = (y * w + x) * 4
        if (polar > 0.25) {
          const ice = Math.round(210 + 45 * polar)
          d.data[idx]=ice; d.data[idx+1]=ice+2; d.data[idx+2]=ice+5
        } else if (warp > 0.5) {
          const elev = Math.min(1, (warp - 0.5) / 0.5)
          if (elev > 0.25) {
            d.data[idx]=Math.round(100+elev*130); d.data[idx+1]=Math.round(80+elev*80); d.data[idx+2]=Math.round(40+elev*40)
          } else {
            d.data[idx]=Math.round(15+elev*100); d.data[idx+1]=Math.round(100+elev*90); d.data[idx+2]=Math.round(10+elev*40)
          }
        } else {
          const depth = 1 - warp / 0.5
          d.data[idx]=Math.round(5+depth*25); d.data[idx+1]=Math.round(25+depth*80); d.data[idx+2]=Math.round(120+depth*80)
        }
        d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
    addBloomCanvas(ctx.canvas, 1.15)
  })
}

function moonTexture() {
  return makeTexture(256, 128, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const base = fbm(u * 5, v * 5, 4)
        const crater = fbm(u * 20, v * 20, 3)
        const dark = crater < 0.28 ? 0.55 : 1
        const maria = (u > 0.3 && u < 0.6 && v > 0.35 && v < 0.65) ? 0.6 : 1
        let vv = Math.round(190 * (0.72 + base * 0.28) * dark * maria)
        vv = Math.min(255, Math.max(30, vv))
        const idx = (y * w + x) * 4
        d.data[idx]=vv; d.data[idx+1]=vv-2; d.data[idx+2]=vv-5; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
  })
}

function marsTexture() {
  return makeTexture(512, 256, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h
        const base = domainWarp(u * 3.5, v * 3.5, 0.5)
        const detail = fbm(u * 14, v * 14, 4) * 0.25
        const polar = v < 0.05 ? (0.05 - v) / 0.05 : v > 0.95 ? (v - 0.95) / 0.05 : 0
        const albedo = 0.75 + base * 0.3 + detail
        const darkRegion = Math.sin(u * 7 + v * 5) > 0.2 ? 0.8 : 1
        const redNoise = detail * 0.3
        let r = Math.round(190 * albedo * darkRegion + polar * 180 + redNoise * 40)
        let g = Math.round(65 * albedo * darkRegion + polar * 120 + redNoise * 10)
        let b = Math.round(20 * albedo * darkRegion + polar * 90 + redNoise * 5)
        const idx = (y * w + x) * 4
        d.data[idx]=Math.min(255,r); d.data[idx+1]=Math.min(255,g); d.data[idx+2]=Math.min(255,b); d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
  })
}

function jupiterTexture() {
  return makeTexture(1024, 512, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      const t = y / h
      const turb = fbm(t * 4, 0.5, 3) * 0.2
      const band = Math.sin(t * 35 + turb * 2.5) * 0.5 + 0.5
      const band2 = Math.sin(t * 60 + 2.1 + turb * 1.5) * 0.3
      const band3 = Math.sin(t * 18 + 4.3) * 0.15
      const band4 = Math.sin(t * 90 + 4.3 + turb) * 0.08
      const longNoise = fbm(y * 0.1, 0, 3) * 0.1
      for (let x = 0; x < w; x++) {
        const u = x / w
        const longVar = fbm(u * 2.5 + t * 0.5, t, 2) * 0.08
        const mix = Math.min(1, Math.max(0, band * 0.45 + band2 * 0.25 + band3 * 0.12 + band4 * 0.08 + longNoise + longVar))
        let r = Math.round(170 + mix * 85)
        let g = Math.round(110 + mix * 75)
        let b = Math.round(45 + mix * 65)
        const spotY = 0.23
        if (Math.abs(t - spotY) < 0.07) {
          const fade = 1 - Math.abs(t - spotY) / 0.07
          const xFade = u < 0.65 ? u / 0.65 : 1
          const spot = fade * xFade * 0.75
          r = Math.round(r + 90 * spot); g = Math.round(g - 25 * spot); b = Math.round(b - 35 * spot)
        }
        const idx = (y * w + x) * 4
        d.data[idx]=Math.min(255,r); d.data[idx+1]=Math.min(255,g); d.data[idx+2]=Math.min(255,b); d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
    addBloomCanvas(ctx.canvas, 1.1)
  })
}

function saturnTexture() {
  return makeTexture(512, 256, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      const t = y / h
      const turb = fbm(t * 2.5, 0.5, 3) * 0.15
      const band = Math.sin(t * 26 + turb * 2) * 0.5 + 0.5
      const band2 = Math.sin(t * 50 + 1.3 + turb) * 0.2
      const band3 = Math.sin(t * 80 + 3.7) * 0.1
      const mix = band * 0.7 + band2 * 0.2 + band3 * 0.1
      for (let x = 0; x < w; x++) {
        const u = x / w
        const longVar = fbm(u * 2.5 + t, t * 2, 2) * 0.05
        const m = Math.min(1, mix + longVar)
        const r = Math.round(180 + m * 65)
        const g = Math.round(145 + m * 55)
        const b = Math.round(70 + m * 45)
        const idx = (y * w + x) * 4
        d.data[idx]=r; d.data[idx+1]=g; d.data[idx+2]=b; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
    addBloomCanvas(ctx.canvas, 1.08)
  })
}

function ringTexture() {
  return makeTexture(512, 32, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const t = x / w
      const alpha = t < 0.05 ? t / 0.05 : t > 0.92 ? (1 - t) / 0.08 : 1
      const noise = Math.sin(x * 0.3) * 0.25 + Math.sin(x * 0.8 + 1) * 0.12 + fbm(x * 0.1, 0, 3) * 0.18
      const band = Math.min(1, Math.max(0, 0.5 + noise))
      const r = Math.round(160 + band * 95)
      const g = Math.round(120 + band * 70)
      const b = Math.round(45 + band * 55)
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.75})`
      ctx.fillRect(x, 0, 1, h)
    }
  })
}

function uranusTexture() {
  return makeTexture(256, 128, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, t = y / h
        const band = Math.sin(t * 16) * 0.08
        const noise = fbm(u * 5, t * 5, 3) * 0.06
        const m = band + noise
        const r = Math.round(130 + m * 40)
        const g = Math.round(200 + m * 30)
        const b = Math.round(230 + m * 20)
        const idx = (y * w + x) * 4
        d.data[idx]=r; d.data[idx+1]=g; d.data[idx+2]=b; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
    addBloomCanvas(ctx.canvas, 1.05)
  })
}

function neptuneTexture() {
  return makeTexture(256, 128, (ctx, w, h) => {
    const d = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, t = y / h
        const band = Math.sin(t * 14) * 0.06
        const noise = fbm(u * 6, t * 6, 3) * 0.05
        const m = band + noise
        const r = Math.round(35 + m * 30)
        const g = Math.round(55 + m * 30)
        const b = Math.round(170 + m * 40)
        const idx = (y * w + x) * 4
        d.data[idx]=r; d.data[idx+1]=g; d.data[idx+2]=b; d.data[idx+3]=255
      }
    }
    ctx.putImageData(d, 0, 0)
    addBloomCanvas(ctx.canvas, 1.1)
  })
}

function getTexture(name) {
  const texMap = {
    sun: sunTexture, mercury: mercuryTexture, venus: venusTexture,
    earth: earthTexture, moon: moonTexture, mars: marsTexture,
    jupiter: jupiterTexture, saturn: saturnTexture,
    uranus: uranusTexture, neptune: neptuneTexture, ring: ringTexture
  }
  return texMap[name] ? texMap[name]() : null
}

// ─── Sun ───
function createSun() {
  const tex = getTexture('sun')
  const geom = new THREE.SphereGeometry(0.6, 48, 48)
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, emissive: 0xF5A623, emissiveIntensity: 0.8, emissiveMap: tex,
    roughness: 0.2, metalness: 0.0
  })
  sunMesh = new THREE.Mesh(geom, mat)
  sunMesh.userData = { type: 'sun', name: 'Sun' }
  scene.add(sunMesh)
  clickTargets.push(sunMesh)

  sunLight = new THREE.PointLight(0xFFEECC, 35, 300)
  sunLight.position.set(0, 0, 0)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x223355, 0.15))
  scene.add(new THREE.HemisphereLight(0x4488BB, 0x080620, 0.35))

  const fillLight = new THREE.DirectionalLight(0x4488CC, 0.25)
  fillLight.position.set(-5, 8, -10)
  scene.add(fillLight)
}

// ─── Planet 3D Position (JPL inclinations) ───
function planetPos(p, angle) {
  const xOrb = p.orbitR * Math.cos(angle)
  const yOrb = p.orbitR * Math.sin(angle)
  if (!p.in) return new THREE.Vector3(xOrb, 0, yOrb)
  const iR = p.in * Math.PI / 180, omR = p.om * Math.PI / 180, wR = p.w * Math.PI / 180
  const cO = Math.cos(omR), sO = Math.sin(omR)
  const cI = Math.cos(iR), sI = Math.sin(iR)
  const cW = Math.cos(wR), sW = Math.sin(wR)
  const xE = (cO * cW - sO * sW * cI) * xOrb + (-cO * sW - sO * cW * cI) * yOrb
  const yE = (sO * cW + cO * sW * cI) * xOrb + (-sO * sW + cO * cW * cI) * yOrb
  const zE = sW * sI * xOrb + cW * sI * yOrb
  return new THREE.Vector3(xE, zE, yE)
}

// ─── Planets ───
function createPlanets() {
  planetsContainer = new THREE.Group()
  scene.add(planetsContainer)

  PLANETS.forEach((p, i) => {
    const tex = getTexture(p.tex)
    const geom = new THREE.SphereGeometry(p.r, 48, 36)
    const pName = p.tex
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: pName === 'earth' ? 0.5 : pName === 'venus' ? 0.35 : pName === 'mars' ? 0.6 : pName === 'jupiter' || pName === 'saturn' ? 0.55 : 0.6,
      metalness: pName === 'mercury' ? 0.15 : pName === 'earth' ? 0.05 : 0.02,
      clearcoat: pName === 'earth' ? 0.4 : pName === 'venus' ? 0.35 : pName === 'jupiter' ? 0.5 : pName === 'saturn' ? 0.45 : pName === 'mars' ? 0.15 : 0.05,
      clearcoatRoughness: 0.2,
      emissive: pName === 'earth' ? new THREE.Color(0x2255AA) : pName === 'venus' ? new THREE.Color(0xFFDD99) : pName === 'mars' ? new THREE.Color(0xCC4422) : pName === 'jupiter' || pName === 'saturn' ? new THREE.Color(0x334466) : new THREE.Color(0x000000),
      emissiveIntensity: pName === 'jupiter' || pName === 'saturn' ? 0.15 : pName === 'venus' ? 0.08 : pName === 'earth' ? 0.06 : pName === 'mars' ? 0.05 : 0.0
    })
    const mesh = new THREE.Mesh(geom, mat)
    const angle = p.phase
    const pos = planetPos(p, angle)
    mesh.position.copy(pos)
    mesh.userData = { type: 'planet', index: i, name: p.name }
    planetsContainer.add(mesh)
    planetMeshes.push(mesh)
    clickTargets.push(mesh)

    if (p.ring) {
      const rTex = getTexture('ring')
      const rGeom = new THREE.TorusGeometry(p.r * 1.8, p.r * 0.22, 16, 48)
      const rMat = new THREE.MeshPhysicalMaterial({
        map: rTex, side: THREE.DoubleSide, transparent: true,
        roughness: 0.45, metalness: 0.2, clearcoat: 0.15, opacity: 0.85
      })
      const ring = new THREE.Mesh(rGeom, rMat)
      ring.rotation.x = Math.PI * 0.5
      ring.rotation.z = Math.PI * 0.08
      mesh.add(ring)
    }

    // 3D orbit ring
    const segs = 64
    const pts = []
    const ipName = p.name === 'Mercury' || p.name === 'Venus' || p.name === 'Earth' || p.name === 'Mars' ? p.name : null
    if (ipName && INNER_PLANET_ELS[ipName]) {
      const ep = innerPlanetOrbitPts(ipName, segs)
      ep.forEach(v => pts.push(v))
    } else if (p.name === 'Earth') {
      const ep = earthOrbitPts(segs)
      ep.forEach(v => pts.push(v))
    } else {
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2
        pts.push(planetPos(p, a))
      }
    }
    const oGeom = new THREE.BufferGeometry().setFromPoints(pts)
    const orbitColor = p.name === 'Earth' ? 0x4488FF : p.name === 'Mars' ? 0xFF6644 : p.name === 'Venus' ? 0xFFDD99 : 0x555577
    const oLine = new THREE.Line(oGeom, new THREE.LineBasicMaterial({
      color: orbitColor, transparent: true, opacity: 0.06
    }))
    planetsContainer.add(oLine)
    orbitRings.push(oLine)
  })
}

// ─── Moon ───
function moonPos(p, angle) {
  const xOrb = p.orbitR * Math.cos(angle)
  const yOrb = p.orbitR * Math.sin(angle)
  if (!p.in) return new THREE.Vector3(xOrb, 0, yOrb)
  const iR = p.in * Math.PI / 180, omR = p.om * Math.PI / 180, wR = p.w * Math.PI / 180
  const cO = Math.cos(omR), sO = Math.sin(omR)
  const cI = Math.cos(iR), sI = Math.sin(iR)
  const cW = Math.cos(wR), sW = Math.sin(wR)
  const xE = (cO * cW - sO * sW * cI) * xOrb + (-cO * sW - sO * cW * cI) * yOrb
  const yE = (sO * cW + cO * sW * cI) * xOrb + (-sO * sW + cO * cW * cI) * yOrb
  const zE = sW * sI * xOrb + cW * sI * yOrb
  return new THREE.Vector3(xE, zE, yE)
}

function createMoon() {
  moonContainer = new THREE.Group()
  scene.add(moonContainer)

  const tex = getTexture('moon')
  const geom = new THREE.SphereGeometry(MOON.r, 16, 12)
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, roughness: 0.9, metalness: 0.0
  })
  moonMesh = new THREE.Mesh(geom, mat)
  moonMesh.userData = { type: 'moon', name: 'Moon' }
  const earthIdx = PLANETS.findIndex(p => p.name === 'Earth')
  const earthMesh = planetMeshes[earthIdx]
  const angle = MOON.phase
  const mPos = moonPos(MOON, angle)
  moonMesh.position.set(
    earthMesh.position.x + mPos.x,
    earthMesh.position.y + mPos.y,
    earthMesh.position.z + mPos.z
  )
  moonContainer.add(moonMesh)
  clickTargets.push(moonMesh)

}

// ─── Elliptical Kepler Solver (shared) ───
function solveElliptical(a, e, i, om, w, M, epoch, period, jd) {
  const d = jd - epoch
  const n = 360 / period
  let M_rad = (M + n * d) * Math.PI / 180
  M_rad = M_rad % (2 * Math.PI)
  if (M_rad < 0) M_rad += 2 * Math.PI
  let E = M_rad
  for (let iter = 0; iter < 30; iter++) {
    const dE = (M_rad - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-8) break
  }
  const xOrb = a * (Math.cos(E) - e)
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const iR = i * Math.PI / 180, omR = om * Math.PI / 180, wR = w * Math.PI / 180
  const cO = Math.cos(omR), sO = Math.sin(omR)
  const cI = Math.cos(iR), sI = Math.sin(iR)
  const cW = Math.cos(wR), sW = Math.sin(wR)
  const xE = (cO * cW - sO * sW * cI) * xOrb + (-cO * sW - sO * cW * cI) * yOrb
  const yE = (sO * cW + cO * sW * cI) * xOrb + (-sO * sW + cO * cW * cI) * yOrb
  const zE = sW * sI * xOrb + cW * sI * yOrb
  return new THREE.Vector3(xE * AU_SCALE, zE * AU_SCALE, yE * AU_SCALE)
}

// ─── Kepler (Apophis) ───
function computeApophisPosition(jd) {
  const { a, e, i, om, w, M, epoch, period } = APOPHIS_ELS
  return solveElliptical(a, e, i, om, w, M, epoch, period, jd)
}

function computeEarthPosition(jd) {
  const { a, e, i, om, w, M, epoch, period } = EARTH_ELS
  return solveElliptical(a, e, i, om, w, M, epoch, period, jd)
}

function computeInnerPlanetPosition(name, jd) {
  const els = INNER_PLANET_ELS[name]
  if (!els) return null
  return solveElliptical(els.a, els.e, els.i, els.om, els.w, els.M, els.epoch, els.period, jd)
}

function innerPlanetOrbitPts(name, steps = 128) {
  const els = INNER_PLANET_ELS[name]
  if (!els) return []
  const pts = []
  for (let j = 0; j <= steps; j++) {
    const frac = j / steps
    const jd = els.epoch + frac * els.period
    pts.push(solveElliptical(els.a, els.e, els.i, els.om, els.w, els.M, els.epoch, els.period, jd))
  }
  return pts
}

function earthOrbitPts(steps = 128) {
  const { a, e, i, om, w, M, epoch, period } = EARTH_ELS
  const pts = []
  for (let j = 0; j <= steps; j++) {
    const frac = j / steps
    const jd = epoch + frac * period
    pts.push(solveElliptical(a, e, i, om, w, M, epoch, period, jd))
  }
  return pts
}

function apophisOrbitPts(jdStart, jdEnd, steps) {
  const pts = []
  for (let i = 0; i <= steps; i++)
    pts.push(computeApophisPosition(jdStart + (jdEnd - jdStart) * (i / steps)))
  return pts
}

// ─── 3I/ATLAS Comet (Hyperbolic Orbit) ───
function computeCometPosition(jd) {
  const { q, e, i, om, w, tp } = COMET_3I
  const a = q / (e - 1)
  const dt = jd - tp
  const k = 0.01720209895
  const n = k * Math.sqrt(1 / (a * a * a))
  let Mh = n * dt * (180 / Math.PI) * Math.PI / 180
  if (dt < 0) Mh = -(-dt) * n * (180 / Math.PI) * Math.PI / 180

  let H = Math.log(2 * Math.abs(Mh) / e + 1.8)
  if (Mh < 0) H = -H
  for (let iter = 0; iter < 40; iter++) {
    const dH = (e * Math.sinh(H) - H - Mh) / (e * Math.cosh(H) - 1)
    H -= dH
    if (Math.abs(dH) < 1e-10) break
  }

  const r = a * (e * Math.cosh(H) - 1)
  const cosNu = (e - Math.cosh(H)) / (e * Math.cosh(H) - 1)
  const sinNu = Math.sqrt(e * e - 1) * Math.sinh(H) / (e * Math.cosh(H) - 1)
  const xOrb = r * cosNu
  const yOrb = r * sinNu

  const iR = i * Math.PI / 180, omR = om * Math.PI / 180, wR = w * Math.PI / 180
  const cO = Math.cos(omR), sO = Math.sin(omR)
  const cI = Math.cos(iR), sI = Math.sin(iR)
  const cW = Math.cos(wR), sW = Math.sin(wR)
  const xE = (cO * cW - sO * sW * cI) * xOrb + (-cO * sW - sO * cW * cI) * yOrb
  const yE = (sO * cW + cO * sW * cI) * xOrb + (-sO * sW + cO * cW * cI) * yOrb
  const zE = sW * sI * xOrb + cW * sI * yOrb

  return new THREE.Vector3(xE * AU_SCALE, zE * AU_SCALE, yE * AU_SCALE)
}

// ─── Apophis ───
function createApophis() {
  apophisContainer = new THREE.Group()
  scene.add(apophisContainer)

  const ico = new THREE.IcosahedronGeometry(0.08, 2)
  const p = ico.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const noise = 0.78 + Math.random() * 0.36
    p.setXYZ(i, x * noise, y * noise, z * noise)
  }
  ico.computeVertexNormals()

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xCC6633, roughness: 0.75, metalness: 0.1,
    emissive: 0xE84040, emissiveIntensity: 0.3,
    clearcoat: 0.1
  })
  apophisMesh = new THREE.Mesh(ico, mat)
  apophisMesh.userData = { type: 'apophis', name: '99942 Apophis' }
  const pos = computeApophisPosition(simJD)
  apophisMesh.position.copy(pos)
  apophisContainer.add(apophisMesh)
  clickTargets.push(apophisMesh)

  const bc = document.createElement('canvas')
  bc.width = 128; bc.height = 128
  const bctx = bc.getContext('2d')
  const bg = bctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  bg.addColorStop(0, 'rgba(232,64,64,1)')
  bg.addColorStop(0.15, 'rgba(232,64,64,0.7)')
  bg.addColorStop(0.5, 'rgba(232,64,64,0.2)')
  bg.addColorStop(1, 'rgba(232,64,64,0)')
  bctx.fillStyle = bg
  bctx.fillRect(0, 0, 128, 128)
  const beaconTex = new THREE.CanvasTexture(bc)
  const sMat = new THREE.SpriteMaterial({
    map: beaconTex, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 1, depthWrite: false
  })
  apophisBeacon = new THREE.Sprite(sMat)
  apophisBeacon.scale.set(1.25, 1.25, 1)
  apophisBeacon.position.copy(pos)
  apophisContainer.add(apophisBeacon)

  apophisLight = new THREE.PointLight(0xE84040, 0.4, 5)
  apophisLight.position.copy(pos)
  apophisContainer.add(apophisLight)

  const pts = apophisOrbitPts(simJD - 200, simJD + 800, 128)
  const oGeom = new THREE.BufferGeometry().setFromPoints(pts)
  const oMat = new THREE.LineBasicMaterial({ color: 0xE84040, transparent: true, opacity: 0.5 })
  apophisOrbitRing = new THREE.Line(oGeom, oMat)
  apophisContainer.add(apophisOrbitRing)

  const gPts = apophisOrbitPts(simJD - 50, simJD + 550, 64)
  const gGeom2 = new THREE.BufferGeometry().setFromPoints(gPts)
  const gMat2 = new THREE.LineBasicMaterial({ color: 0xE84040, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending })
  const gRing = new THREE.Line(gGeom2, gMat2)
  gRing.scale.set(1.02, 1.02, 1.02)
  apophisContainer.add(gRing)
}

// ─── Close Approach Marker ───
function createCloseApproachMarker() {
  const caJD = getJD(2029, 4, 13, 21, 46)
  const apos = computeApophisPosition(caJD)
  const ePos = computeEarthPosition(caJD)
  const target = apos.clone().add(ePos).multiplyScalar(0.5)

  const up = new THREE.Vector3(0, 1, 0)
  const radial = target.clone().normalize()
  const side = new THREE.Vector3().crossVectors(up, radial).normalize()
  const tailPos = target.clone()
    .add(up.clone().multiplyScalar(0.5))
    .add(side.clone().multiplyScalar(0.3))

  const dir = target.clone().sub(tailPos).normalize()
  const arrowLen = target.distanceTo(tailPos)

  const arrow = new THREE.ArrowHelper(dir, tailPos, arrowLen, 0xE84040, 0.18, 0.1)
  arrow.line.material.transparent = true
  arrow.line.material.opacity = 0.5
  arrow.line.material.depthWrite = false
  arrow.cone.material.transparent = true
  arrow.cone.material.opacity = 0.7
  apophisContainer.add(arrow)

  const tipPos = tailPos.clone().add(dir.clone().multiplyScalar(arrowLen))
  const div = document.createElement('div')
  div.className = 'planet-label label-apophis'
  div.textContent = '2029 Close Approach'
  div.style.fontSize = '0.55rem'
  div.style.opacity = '0.7'
  const label = new CSS2DObject(div)
  label.position.copy(tailPos).add(side.clone().multiplyScalar(0.4)).add(dir.clone().multiplyScalar(-0.2))
  scene.add(label)
}

function getJD(year, month, day, hour = 0, minute = 0) {
  const utc = Date.UTC(year, month - 1, day, hour, minute)
  return 2440587.5 + utc / 86400000
}

function parseApproachDate(cd) {
  const months = {Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11}
  const p = cd.split(' '), dp = p[0].split('-'), tp = p[1].split(':')
  const utc = Date.UTC(parseInt(dp[0]), months[dp[1]], parseInt(dp[2]), parseInt(tp[0]), parseInt(tp[1]))
  return 2440587.5 + utc / 86400000
}

// ─── Comet 3I/ATLAS ───
function createComet3I() {
  cometContainer = new THREE.Group()
  scene.add(cometContainer)

  const ico = new THREE.IcosahedronGeometry(0.1, 1)
  const p = ico.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const noise = 0.8 + Math.random() * 0.4
    p.setXYZ(i, x * noise, y * noise, z * noise)
  }
  ico.computeVertexNormals()
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x88CCFF, roughness: 0.6, metalness: 0.05,
    emissive: 0x4488FF, emissiveIntensity: 0.4
  })
  cometMesh = new THREE.Mesh(ico, mat)
  cometMesh.userData = { type: 'comet', name: '3I/ATLAS' }
  const pos = computeCometPosition(simJD)
  cometMesh.position.copy(pos)
  cometContainer.add(cometMesh)
  clickTargets.push(cometMesh)

  const tPos = new Float32Array(40 * 3)
  for (let i = 0; i < 40; i++) {
    const p = computeCometPosition(simJD - i * 0.5)
    tPos[i * 3] = p.x; tPos[i * 3 + 1] = p.y; tPos[i * 3 + 2] = p.z
  }
  const tGeom = new THREE.BufferGeometry()
  tGeom.setAttribute('position', new THREE.BufferAttribute(tPos, 3))
  cometTail = new THREE.Line(tGeom, new THREE.LineBasicMaterial({
    color: 0x88CCFF, transparent: true, opacity: 0.4
  }))
  cometContainer.add(cometTail)

  const bc = document.createElement('canvas')
  bc.width = 96; bc.height = 96
  const bctx = bc.getContext('2d')
  const bg = bctx.createRadialGradient(48, 48, 0, 48, 48, 48)
  bg.addColorStop(0, 'rgba(100,200,255,1)')
  bg.addColorStop(0.15, 'rgba(80,180,255,0.75)')
  bg.addColorStop(0.5, 'rgba(50,150,255,0.18)')
  bg.addColorStop(1, 'rgba(50,150,255,0)')
  bctx.fillStyle = bg
  bctx.fillRect(0, 0, 96, 96)
  const beaconTex = new THREE.CanvasTexture(bc)
  const sMat = new THREE.SpriteMaterial({
    map: beaconTex, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 1, depthWrite: false
  })
  cometBeacon = new THREE.Sprite(sMat)
  cometBeacon.scale.set(2, 2, 1)
  cometBeacon.position.copy(pos)
  cometContainer.add(cometBeacon)

  cometLight = new THREE.PointLight(0x4488FF, 1.0, 20)
  cometLight.position.copy(pos)
  cometContainer.add(cometLight)
}

// ─── Labels ───
function createLabels() {
  const defs = [
    ...PLANETS.map((p, i) => ({
      name: p.name, getPos: () => planetMeshes[i].position,
      offset: new THREE.Vector3(p.orbitR * 0.2, p.r + 0.5, 0)
    })),
    { name: 'Moon', getPos: () => moonMesh.position, offset: new THREE.Vector3(0.4, 0.3, 0) },
    { name: '99942 Apophis', getPos: () => apophisMesh.position, offset: new THREE.Vector3(0.5, 0.4, 0), cls: 'label-apophis' },
    { name: '3I/ATLAS', getPos: () => cometMesh.position, offset: new THREE.Vector3(1.2, 0.9, 0), cls: 'label-comet' },
    { name: 'Sun', getPos: () => new THREE.Vector3(0,0,0), offset: new THREE.Vector3(1.5, 1.5, 0), cls: 'label-sun' },
  ]

  defs.forEach((def) => {
    const div = document.createElement('div')
    div.className = `planet-label ${def.cls || ''}`
    div.textContent = def.name
    const label = new CSS2DObject(div)
    label.position.copy(def.getPos()).add(def.offset)
    label.userData = { def }
    scene.add(label)
    planetLabels.push(label)

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(def.cls === 'label-apophis' ? 0.08 : def.cls === 'label-comet' ? 0.15 : def.cls === 'label-sun' ? 0.06 : 0.04, 6, 6),
      new THREE.MeshBasicMaterial({
        color: def.cls === 'label-apophis' ? 0xE84040 : def.cls === 'label-comet' ? 0x4488FF : def.cls === 'label-sun' ? 0xF5D76E : 0x778899,
        transparent: true, opacity: 0.85
      })
    )
    dot.position.copy(def.getPos())
    scene.add(dot)
    leaderLines.push(dot)

    const p1 = def.getPos().clone(), p2 = label.position.clone()
    const lGeom = new THREE.BufferGeometry().setFromPoints([p1, p2])
    const lMat = new THREE.LineBasicMaterial({
      color: def.cls === 'label-apophis' ? 0xE84040 : def.cls === 'label-comet' ? 0x4488FF : def.cls === 'label-sun' ? 0xF5D76E : 0x445566,
      transparent: true, opacity: def.cls === 'label-apophis' ? 0.6 : def.cls === 'label-comet' ? 0.5 : def.cls === 'label-sun' ? 0.4 : 0.3,
    })
    const line = new THREE.Line(lGeom, lMat)
    scene.add(line)
    leaderLines.push(line)
  })
}

// ─── Close Approach Scan (JPL data with Kepler fallback) ───
function scanNextApproach() {
  if (jplApproaches.length > 0) {
    // Find next approach after simJD
    let next = null
    for (const a of jplApproaches) {
      if (a.jd > simJD) { next = a; break }
    }
    if (next) {
      nextApproachJD = next.jd
      nextApproachDist = next.dist
      return
    }
    // If no future approach, use last known
    const last = jplApproaches[jplApproaches.length - 1]
    nextApproachJD = last.jd
    nextApproachDist = last.dist
    return
  }
  // Fallback: Kepler model scan
  let minDist = Infinity, minJD = simJD
  const step = 0.5
  for (let jd = simJD; jd < simJD + 365.25 * 50; jd += step) {
    const aPos = computeApophisPosition(jd)
    const ePos = computeEarthPosition(jd)
    const d = aPos.distanceTo(ePos)
    if (d < minDist) { minDist = d; minJD = jd }
  }
  nextApproachJD = minJD
  nextApproachDist = minDist
}

// ─── Scene Update ───
function updateScene() {
  const dayOffset = (simJD - J2000)

  PLANETS.forEach((p, i) => {
    const mesh = planetMeshes[i]
    const angle = p.phase + (dayOffset / p.period) * 2 * Math.PI
    const pos = planetPos(p, angle)
    mesh.position.copy(pos)
    mesh.rotation.x += 0.005
    mesh.rotation.y += 0.008
  })

  // Override inner planets with Keplerian elliptical orbits
  ;['Mercury', 'Venus', 'Earth', 'Mars'].forEach((name, i) => {
    const mesh = planetMeshes[i]
    if (!mesh) return
    const pos = name === 'Earth' ? computeEarthPosition(simJD) : computeInnerPlanetPosition(name, simJD)
    if (pos) mesh.position.copy(pos)
  })

  const earthIdx = PLANETS.findIndex(p => p.name === 'Earth')
  const earthMesh = planetMeshes[earthIdx]
  if (earthMesh && moonMesh) {
    const mAngle = MOON.phase + (dayOffset / MOON.period) * 2 * Math.PI
    const mPos = moonPos(MOON, mAngle)
    moonMesh.position.x = earthMesh.position.x + mPos.x
    moonMesh.position.z = earthMesh.position.z + mPos.z
    moonMesh.position.y = earthMesh.position.y + mPos.y
  }

  if (apophisMesh) {
    const pos = computeApophisPosition(simJD)
    apophisMesh.position.copy(pos)
    apophisBeacon.position.copy(pos)
    apophisLight.position.copy(pos)
    apophisMesh.rotation.x += 0.02
    apophisMesh.rotation.y += 0.03
    const t = Date.now() * 0.002
    const scale = 1.25 + 0.4 * Math.sin(t * 0.5)
    apophisBeacon.material.opacity = 0.5 + 0.5 * Math.sin(t * 0.5)
    apophisBeacon.scale.set(scale, scale, 1)
    apophisLight.intensity = 0.3 + 0.3 * Math.sin(t * 0.5)
  }

  if (cometMesh) {
    const pos = computeCometPosition(simJD)
    cometMesh.position.copy(pos)
    cometMesh.rotation.x += 0.01
    cometMesh.rotation.y += 0.015

    const distAU = pos.length() / AU_SCALE
    const distEl = $('td-comet-dist')
    if (distEl) distEl.textContent = `${distAU.toFixed(2)} au`

    if (cometBeacon) {
      cometBeacon.position.copy(pos)
      cometLight.position.copy(pos)
      const t = Date.now() * 0.002
      const cs = 2.5 + 0.75 * Math.sin(t * 0.6)
      cometBeacon.material.opacity = 0.3 + 0.7 * Math.sin(t * 0.4)
      cometBeacon.scale.set(cs, cs, 1)
      cometLight.intensity = 0.5 + 0.5 * Math.sin(t * 0.4)
    }
  }

  // Adaptive scaling: keep all bodies visible at any zoom level (NASA Eyes style)
  const camDist = camera.position.length()
  const adaptScale = THREE.MathUtils.clamp(camDist / 50, 0.4, 2.5)
  PLANETS.forEach((_, i) => {
    planetMeshes[i].scale.setScalar(adaptScale)
  })
  if (sunMesh) sunMesh.scale.setScalar(1 + (adaptScale - 1) * 0.1)
  if (moonMesh) moonMesh.scale.setScalar(adaptScale)
  if (apophisMesh) apophisMesh.scale.setScalar(adaptScale)
  if (cometMesh) cometMesh.scale.setScalar(adaptScale)

  if (cometTail) {
    const posArr = cometTail.geometry.attributes.position.array
    for (let i = 0; i < 40; i++) {
      const p = computeCometPosition(simJD - i * 0.5)
      posArr[i * 3] = p.x; posArr[i * 3 + 1] = p.y; posArr[i * 3 + 2] = p.z
    }
    cometTail.geometry.attributes.position.needsUpdate = true
  }

  updateLabelLines()
}

function updateLabelLines() {
  const defs = [
    ...PLANETS.map((p, i) => ({
      getPos: () => planetMeshes[i].position, idx: i,
      ox: p.orbitR * 0.2, oy: p.r + 0.5
    })),
    { getPos: () => moonMesh.position, idx: PLANETS.length, ox: 0.4, oy: 0.3 },
    { getPos: () => apophisMesh.position, idx: PLANETS.length + 1, ox: 0.5, oy: 0.4 },
    { getPos: () => cometMesh.position, idx: PLANETS.length + 2, ox: 3, oy: 2.5 },
    { getPos: () => new THREE.Vector3(0,0,0), idx: PLANETS.length + 3, ox: 1.5, oy: 1.5 },
  ]

  const camDist = camera.position.length()
  const dotScale = THREE.MathUtils.clamp(camDist / 50, 0.4, 2.5)

  defs.forEach((def, li) => {
    const pos = def.getPos()
    const label = planetLabels[li]
    if (!label) return
    label.position.set(pos.x + def.ox, pos.y + def.oy, pos.z)
    const dot = leaderLines[li * 2]
    if (dot) {
      dot.position.copy(pos)
      dot.scale.setScalar(dotScale)
    }
    const line = leaderLines[li * 2 + 1]
    if (line) {
      const a = line.geometry.attributes.position
      a.setXYZ(0, pos.x, pos.y, pos.z)
      a.setXYZ(1, label.position.x, label.position.y, label.position.z)
      a.needsUpdate = true
    }
  })
}

// ─── Date Format ───
function formatJD(jd) {
  const jd0 = Math.floor(jd + 0.5) - 0.5
  const df = jd - jd0
  const a = Math.floor((jd0 - 1867216.25) / 36524.25)
  const b = jd0 + 1 + a - Math.floor(a / 4)
  const c = b + 1524
  const d = Math.floor((c - 122.1) / 365.25)
  const e = Math.floor(365.25 * d)
  const f = Math.floor((c - e) / 30.6001)
  const day = Math.floor(c - e + df - f < 14 ? c - e - f + 0.5 : c - e - f)
  const month = f - (f < 14 ? 1 : 13)
  const year = d - (month > 2 ? 4716 : 4715)
  const hr = Math.floor(df * 24)
  const min = Math.floor((df * 24 - hr) * 60)
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}`
}

// ─── JPL Fetch ───
function applyJPLData(data) {
  $('data-source').textContent = `NASA/JPL — ${data.signature?.version || 'SBDB'}`
  $('data-source').style.color = 'rgba(245,240,230,0.5)'

  const pp = data.phys_par; const by = {}
  if (pp) { pp.forEach(p => { by[p.name] = p }) }
  if (by.diameter) $('td-diameter').textContent = `${by.diameter.value} km`
  if (by.H) $('td-h').textContent = by.H.value
  if (by.albedo || by.A) {
    const a = by.albedo || by.A
    $('td-albedo').textContent = a.value
  }
  if (by.rot_per) $('td-rotation').textContent = `${by.rot_per.value} h`

  if (data.object?.orbit_class) {
    $('td-class').textContent = data.object.orbit_class.name || data.object.orbit_class.code
  }
  const phaEl = $('td-pha')
  if (phaEl && data.object?.pha === 'Y') {
    phaEl.textContent = 'Potentially Hazardous'
    phaEl.style.color = 'rgba(232, 64, 64, 0.55)'
  }

  const orb = data.orbit?.elements
  if (orb) {
    const f = name => orb.find(e => e.name === name)
    const setVal = (id, el, suffix = '') => {
      const elm = f(el)
      if (elm && $(id)) $(id).textContent = `${elm.value}${suffix}`
    }
    setVal('td-e', 'e')
    setVal('td-a', 'a', ' au')
    setVal('td-i', 'i', '°')
    setVal('td-period', 'per', ' d')
    setVal('td-q', 'q', ' au')
    const ad = f('ad')
    if (ad && $('td-q2')) $('td-q2').textContent = `${ad.value} au`
    setVal('td-om', 'om', '°')
    setVal('td-w', 'w', '°')
  }

  const ca = data.ca_data
  jplApproaches = []
  if (ca) {
    ca.forEach(c => {
      if (c.body !== 'Earth') return
      const y = parseInt(c.cd.substring(0,4))
      if (y < 2025) return
      jplApproaches.push({
        jd: parseApproachDate(c.cd),
        cd: c.cd,
        dist: parseFloat(c.dist_min)
      })
    })
    jplApproaches.sort((a, b) => a.jd - b.jd)
    let closest = null
    ca.forEach(c => {
      if (c.body !== 'Earth') return
      const y = parseInt(c.cd.substring(0,4))
      if (y < 2025) return
      const d = parseFloat(c.dist_min)
      if (!closest || d < parseFloat(closest.dist_min)) closest = c
    })
    if (closest) {
      $('td-approach').textContent = closest.cd.substring(0, 10)
      const distAU = parseFloat(closest.dist_min)
      if (distAU < 0.01) {
        const distKm = Math.round(distAU * 149597870)
        $('td-distance').textContent = `~${distKm.toLocaleString()} km`
      } else {
        $('td-distance').textContent = `${distAU.toFixed(4)} au`
      }
    }
    scanNextApproach()
  }
  refreshApophisPanel()
}

function refreshApophisPanel() {
  const leftEl = $('sel-panel-left')
  const desktopOpen = leftEl?.classList.contains('visible') && leftEl.querySelector('h3')?.textContent === '99942 Apophis'
  const drawer = $('sel-drawer')
  const mobileOpen = drawer?.classList.contains('visible') && document.querySelector('.sel-dr-name')?.textContent === '99942 Apophis'
  if (desktopOpen || mobileOpen) {
    showObjectPanel({ userData: { name: '99942 Apophis' } })
  }
}

async function fetchJPLData() {
  try {
    const resp = await fetch(API_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    applyJPLData(data)
  } catch {
    try {
      applyJPLData(jplFallback)
      $('data-source').textContent = 'NASA/JPL data (cached)'
      $('data-source').style.color = 'rgba(245,240,230,0.5)'
    } catch {
      $('data-source').textContent = 'Live data unavailable — using default elements'
      $('data-source').style.color = 'rgba(232,64,64,0.5)'
    }
  }
}

// ─── 3I/ATLAS JPL Data Fetch ───
const COMET_API_URL = '/api/jpl-sbdb?sstr=C/2025%20N1&full-prec=1'

function applyCometJPLData(data) {
  const els = data.orbit?.elements
  if (!els) return

  const f = name => els.find(e => e.name === name)
  const getVal = name => { const e = f(name); return e ? parseFloat(e.value) : null }
  const q = getVal('q'), e = getVal('e'), i = getVal('i')
  const om = getVal('om'), w = getVal('w'), tp = getVal('tp')
  if (!q || !e || !i || !tp) return

  COMET_3I.q = q; COMET_3I.e = e; COMET_3I.i = i
  COMET_3I.om = om; COMET_3I.w = w; COMET_3I.tp = tp

  const model = data.orbit?.model_pars
  if (model) {
    const mf = name => { const p = model.find(m => m.name === name); return p ? parseFloat(p.value) : null }
    const a1 = mf('A1'), a2 = mf('A2'), a3 = mf('A3')
    if (a1 !== null) COMET_3I.A1 = a1
    if (a2 !== null) COMET_3I.A2 = a2
    if (a3 !== null) COMET_3I.A3 = a3
  }

  COMET_3I.epoch = data.orbit?.epoch ? parseFloat(data.orbit.epoch) : COMET_3I.epoch
  COMET_3I.soln_date = data.orbit?.soln_date || COMET_3I.soln_date
  COMET_3I.n_obs_used = data.orbit?.n_obs_used ? parseInt(data.orbit.n_obs_used) : COMET_3I.n_obs_used

  const setEl = (id, val, suffix = '') => {
    const el = document.getElementById(id)
    if (el) el.textContent = `${val}${suffix}`
  }
  setEl('td-comet-e', COMET_3I.e.toFixed(4))
  setEl('td-comet-i', COMET_3I.i.toFixed(2), '°')
  setEl('td-comet-q', COMET_3I.q.toFixed(3), ' au')

  const srcEl = document.getElementById('data-source')
  if (srcEl) {
    const label = data.signature?.version || 'SBDB'
    const soln = COMET_3I.soln_date ? ` (solution ${data.orbit?.orbit_id || ''}, ${COMET_3I.soln_date})` : ''
    srcEl.textContent = `NASA/JPL — ${label}${soln}`
    srcEl.style.color = 'rgba(245,240,230,0.5)'
  }
}

async function fetchCometJPLData() {
  try {
    const resp = await fetch(COMET_API_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    applyCometJPLData(data)
  } catch {
    try {
      applyCometJPLData(cometFallback)
      const srcEl = document.getElementById('data-source')
      if (srcEl) {
        srcEl.textContent = `NASA/JPL — cached (solution ${cometFallback.orbit?.orbit_id || '54'}, ${cometFallback.orbit?.soln_date || '2026-02-19'})`
        srcEl.style.color = 'rgba(245,240,230,0.5)'
      }
    } catch {
      // fallback values already set as defaults, nothing to do
    }
  }
}

// ─── Earth JPL Data ───
function applyEarthJPLData(data) {
  const orb = data.orbit?.elements
  if (!orb) return
  const f = name => orb.find(e => e.name === name)
  const getVal = name => { const el = f(name); return el ? parseFloat(el.value) : null }

  const a = getVal('a')
  const e = getVal('e')
  const i = getVal('i')
  const om = getVal('om')
  const w = getVal('w')
  const M = getVal('M')
  const per = getVal('per')
  const epoch = getVal('epoch')

  if (a && e && M && per) {
    EARTH_ELS.a = a
    EARTH_ELS.e = e
    if (i !== null) EARTH_ELS.i = i
    if (om !== null) EARTH_ELS.om = om
    if (w !== null) EARTH_ELS.w = w
    EARTH_ELS.M = M
    EARTH_ELS.period = per
    if (epoch) EARTH_ELS.epoch = epoch

    const srcEl = document.getElementById('data-source')
    if (srcEl) {
      const ver = data.signature?.version || 'JPL'
      srcEl.textContent = `NASA/JPL — ${ver} (Earth)`
      srcEl.style.color = 'rgba(245,240,230,0.5)'
    }
  }
}

async function fetchEarthJPLData() {
  try {
    const resp = await fetch(EARTH_API_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    applyEarthJPLData(data)
  } catch {
    try {
      applyEarthJPLData(earthFallback)
      const srcEl = document.getElementById('data-source')
      if (srcEl) {
        srcEl.textContent = `NASA/JPL — mean orbital elements (Earth)`
        srcEl.style.color = 'rgba(245,240,230,0.5)'
      }
    } catch {
      // defaults already set, nothing to do
    }
  }
}

// ─── Object Data Catalog ───
const OBJECT_DATA = {
  Sun: {
    left: [
      ['Type', 'G2V Yellow Dwarf'],
      ['Mass', '1.989 × 10³⁰ kg (333,000 Earths)'],
      ['Diameter', '1.391 million km'],
      ['Surface Temp', '5,500 °C (9,940 °F)'],
      ['Age', '4.6 billion years'],
    ],
    right: [
      ['Solar Influence', '99.86% of all mass in the solar system. Its magnetic field creates the heliosphere — a protective bubble shielding Earth from galactic cosmic rays.'],
      ['Prophetic Echo', 'The Sun\'s unerring constancy mirrors the faithfulness of the Creator. "The sun of righteousness shall rise with healing in its wings" (Malachi 4:2 KJV).'],
    ]
  },
  Mercury: {
    left: [
      ['Type', 'Terrestrial Planet'],
      ['Diameter', '4,879 km'],
      ['Orbit Period', '88 days'],
      ['Distance from Sun', '57.9 million km (0.39 AU)'],
      ['Surface Temp', '-180 to 430 °C'],
    ],
    right: [
      ['Extreme World', 'Daytime hits 430°C — hot enough to melt lead — then plunges to -180°C after dark. The largest thermal swing of any planet.'],
      ['Hidden Core', '85% of Mercury\'s radius is a liquid iron core — proportionally the largest in the solar system, generating a surprising magnetic field.'],
    ]
  },
  Venus: {
    left: [
      ['Type', 'Terrestrial Planet'],
      ['Diameter', '12,104 km'],
      ['Orbit Period', '225 days'],
      ['Distance from Sun', '108.2 million km (0.72 AU)'],
      ['Surface Temp', '462 °C (avg)'],
    ],
    right: [
      ['Earth\'s Twin Gone Wrong', 'Same size as Earth, but a runaway greenhouse effect boiled away its oceans. Surface pressure is 92× Earth\'s — enough to crush a spacecraft.'],
      ['Sign in the Heavens', 'The Morning and Evening Star since antiquity. In Revelation 8:10 KJV, a "great star burning as a lamp" falls from heaven — a cosmic sign inviting contemplation.'],
    ]
  },
  Earth: {
    left: [
      ['Type', 'Terrestrial Planet'],
      ['Diameter', '12,742 km'],
      ['Orbit Period', '365.25 days'],
      ['Distance from Sun', '149.6 million km (1.00 AU)'],
      ['Atmosphere', '78% N₂, 21% O₂'],
    ],
    right: [
      ['The Chosen World', 'Water covers 71% of its surface. The Moon stabilizes its axis; the magnetic field deflects solar radiation. All conditions for complex life converge here.'],
      ['The Garden and the End', 'In the biblical narrative, Earth is both the stage of creation and the theater of redemption. Every celestial sign overhead marks the progression of appointed times.'],
    ]
  },
  Mars: {
    left: [
      ['Type', 'Terrestrial Planet'],
      ['Diameter', '6,779 km'],
      ['Orbit Period', '687 days'],
      ['Distance from Sun', '227.9 million km (1.52 AU)'],
      ['Surface Temp', '-87 to -5 °C'],
    ],
    right: [
      ['The Red Frontier', 'Olympus Mons (21.9 km) is the largest volcano in the solar system. Valles Marineris would stretch from New York to Los Angeles.'],
      ['Warrior Planet', 'Associated with war throughout history — linked to the "red horse" of Revelation 6:4 KJV. Its moons are Phobos (Fear) and Deimos (Terror).'],
    ]
  },
  Jupiter: {
    left: [
      ['Type', 'Gas Giant'],
      ['Diameter', '139,820 km'],
      ['Orbit Period', '11.86 years'],
      ['Distance from Sun', '778.5 million km (5.20 AU)'],
      ['Mass', '318 × Earth'],
    ],
    right: [
      ['The Great Protector', 'Jupiter\'s immense gravity deflects comets and asteroids that might strike Earth. The Great Red Spot — a storm larger than Earth — has raged for 400+ years.'],
      ['The King Planet', 'Jupiter contains more mass than all other planets combined. Its presence shapes the entire architecture of the outer solar system.'],
    ]
  },
  Saturn: {
    left: [
      ['Type', 'Gas Giant'],
      ['Diameter', '116,460 km'],
      ['Orbit Period', '29.46 years'],
      ['Distance from Sun', '1.43 billion km (9.54 AU)'],
      ['Density', '0.687 g/cm³ (less than water)'],
    ],
    right: [
      ['Lord of the Rings', 'The ring system spans 282,000 km but is only 10 meters thick — a breathtaking structure of ice and rock. Saturn would float in a cosmic ocean.'],
      ['The Waning Age', 'Taking 30 years to circle the zodiac, Saturn represents the long arc of time. A reminder that all things pass, and what remains tells a story.'],
    ]
  },
  Uranus: {
    left: [
      ['Type', 'Ice Giant'],
      ['Diameter', '50,724 km'],
      ['Orbit Period', '84 years'],
      ['Distance from Sun', '2.87 billion km (19.2 AU)'],
      ['Axial Tilt', '97.77° (rotates sideways)'],
    ],
    right: [
      ['The Tilted Planet', 'Rotates on its side after a massive ancient collision. A single season lasts 21 years — 42 years of sunlight followed by 42 of darkness.'],
      ['The Hidden Depths', 'Beneath its calm blue exterior lie dynamic storms. A reminder that not all is as it appears — in the heavens or in the spirit.'],
    ]
  },
  Neptune: {
    left: [
      ['Type', 'Ice Giant'],
      ['Diameter', '49,244 km'],
      ['Orbit Period', '164.8 years'],
      ['Distance from Sun', '4.50 billion km (30.1 AU)'],
      ['Wind Speed', '2,100 km/h (fastest in system)'],
    ],
    right: [
      ['The Wind Planet', 'The strongest winds in the solar system — 2,100 km/h. First planet discovered through mathematical prediction (1846), not direct observation.'],
      ['The Far Horizon', 'Completing one orbit every 165 years, Neptune has made barely one circuit since its discovery. A sentinel at the boundary of the classical solar system.'],
    ]
  },
  Moon: {
    left: [
      ['Type', 'Natural Satellite'],
      ['Diameter', '3,474 km'],
      ['Orbit Period', '27.32 days'],
      ['Distance from Earth', '384,400 km'],
      ['Surface Temp', '-173 to 127 °C'],
    ],
    right: [
      ['Earth\'s Silent Partner', 'Drifts away at 3.8 cm/year. It stabilizes Earth\'s axial tilt, making complex life possible. Without it, Earth would wobble chaotically.'],
      ['A Faithful Witness', 'Given "for signs and seasons" (Genesis 1:14 KJV). In prophecy, the Moon turning to blood heralds the Day of the Lord (Joel 2:31 KJV, Revelation 6:12 KJV).'],
    ]
  },
  '99942 Apophis': {
    left: [
      ['Type', 'Aten Asteroid (PHA)'],
      ['Diameter', '~340 m'],
      ['Orbit Period', '323.6 days'],
      ['Closest Approach', 'Apr 13, 2029 — ~0.00025 AU'],
      ['Classification', 'Potentially Hazardous'],
    ],
    right: [
      ['The Name of Destruction', 'Named for the Egyptian serpent god of chaos — the eternal enemy of the sun. Fitting for an object that crosses Earth\'s path with such precision.'],
      ['The 2029 Encounter', 'On April 13, 2029, Apophis will pass within ~0.00025 AU — closer than geostationary satellites. Visible to the naked eye. No precedent in recorded history.'],
      ['Prophetic Connection', 'Some link Apophis to the "Wormwood" star of Revelation 8:11 KJV. Whether symbolic or literal, its passage invites reflection on what such signs mean.'],
    ],
    left2: [
      ['Next Approach Score', '0.00025 AU (loading live data…)'],
      ['Velocity Rel. Earth', '~12.6 km/s'],
      ['MOID', '0.00016 AU'],
      ['Torino Scale', '0 (was briefly 4 in 2004)'],
      ['Observation Arc', '20+ years'],
    ]
  },
  '3I/ATLAS': {
    left: [
      ['Type', 'Interstellar Comet'],
      ['Eccentricity', '6.14 (hyperbolic)'],
      ['Inclination', '175.12° (retrograde)'],
      ['Perihelion', '1.36 AU'],
      ['Origin', 'Outside Solar System'],
    ],
    right: [
      ['A Visitor from Beyond', 'With eccentricity 6.14, it is unbound to the Sun — an interstellar traveler passing through our system once, never to return.'],
      ['Non-Gravitational Acceleration', 'JPL models CO₂-driven outgassing with A₁=5.3e-8, A₂=1.1e-8, A₃=-6.9e-9 au/d². Trajectory is actively monitored.'],
      ['The Interstellar Sign', 'Comets have been portents throughout history. A body from outside the solar system carries unique weight: a traveler from the deep.'],
    ],
    left2: [
      ['Current Distance', 'Varies'],
      ['Exit Trajectory', 'Hyperbolic escape'],
      ['Discovery', 'WISE/NEOWISE survey'],
      ['Spectral Type', 'Icy body (C/2025 N1)'],
    ]
  },
}

function isMobile() { return window.innerWidth <= 640 }

function closeAccordionItems() {
  document.querySelectorAll('.dp-item.open').forEach(el => el.classList.remove('open'))
}

function showObjectPanel(obj) {
  const name = obj.userData.name
  let data = OBJECT_DATA[name]
  if (!data) return

  // Inject live JPL data for Apophis when available
  if (name === '99942 Apophis') {
    const liveDate = $('td-approach')?.textContent
    const liveDist = $('td-distance')?.textContent
    if (liveDate && liveDist && liveDate !== '—') {
      data = JSON.parse(JSON.stringify(data))
      const appRow = data.left.find(r => r[0] === 'Closest Approach')
      if (appRow) appRow[1] = `${liveDate} — ${liveDist}`
      const encRow = data.right?.find(r => r[0] === 'The 2029 Encounter')
      if (encRow) encRow[1] = `On ${liveDate}, Apophis will pass within ${liveDist} — closer than geostationary satellites. Visible to the naked eye. No precedent in recorded history.`
      const scrRow = data.left2?.find(r => r[0] === 'Next Approach Score')
      if (scrRow) scrRow[1] = `${liveDist} · closest approach in recorded history`
    }
  }

  if (isMobile()) {
    const drawer = $('sel-drawer')
    const inner = $('sel-drawer-inner')
    if (!drawer || !inner) return

    const nameClass = name === '99942 Apophis' ? 'apophis' : name === '3I/ATLAS' ? 'comet' : ''
    const techRows = [...(data.left || []), ...(data.left2 || [])]
      .map(r => `<div class="sel-dr-row"><span class="sel-dr-label">${r[0]}</span><span class="sel-dr-value">${r[1]}</span></div>`).join('')
    const narrativeSections = (data.right || [])
      .map(r =>
        `<div class="sel-dr-section">
          <div class="sel-dr-section-title">${r[0]}</div>
          <div class="sel-dr-note">${r[1]}</div>
        </div>`
      ).join('')

    inner.innerHTML = `
      <div class="sel-dr-header">
        <span class="sel-dr-name ${nameClass}">${name}</span>
        <button class="sel-dr-close" id="sel-dr-close-btn" aria-label="Close">&times;</button>
      </div>
      ${techRows ? `<div class="sel-dr-section">${techRows}</div>` : ''}
      ${narrativeSections}
    `

    drawer.classList.add('visible')
    closeAccordionItems()

    const info = $('selection-info')
    if (info) info.classList.remove('visible')
    return
  }

  const leftEl = $('sel-panel-left')
  const rightEl = $('sel-panel-right')
  if (!leftEl || !rightEl) return

  leftEl.innerHTML = `<h3>${name}</h3>` +
    [...(data.left || []), ...(data.left2 || [])].map(r =>
      `<div class="sel-row"><span class="sel-label">${r[0]}</span><span class="sel-value">${r[1]}</span></div>`
    ).join('')

  rightEl.innerHTML = (data.right || []).map((r, i) =>
    `<div class="sel-row">${i > 0 ? '<div class="sel-divider"></div>' : ''}<span class="sel-label">${r[0]}</span><span class="sel-note">${r[1]}</span></div>`
  ).join('')

  leftEl.classList.add('visible')
  rightEl.classList.add('visible')
}

function hideObjectPanel() {
  isTracking = false
  zoomTarget = null
  selectedObject = null

  const drawer = $('sel-drawer')
  if (drawer) drawer.classList.remove('visible')

  const leftEl = $('sel-panel-left')
  const rightEl = $('sel-panel-right')
  if (leftEl) leftEl.classList.remove('visible')
  if (rightEl) rightEl.classList.remove('visible')
}
function setupEventListeners() {
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    labelRenderer.setSize(w, h)
  })

  renderer.domElement.addEventListener('click', onCanvasClick)
  renderer.domElement.addEventListener('mousemove', onCanvasMove)

}

function onCanvasClick(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(clickTargets)
  const info = $('selection-info')
  if (hits.length > 0) {
    const obj = hits[0].object
    const name = obj.userData.name || 'Unknown'
    info.textContent = `◆ ${name}`
    info.classList.add('visible')
    selectedObject = obj
    isTracking = true

    zoomTarget = obj.position.clone()
    const objRadius = obj.geometry?.parameters?.radius || 0.3
    zoomDist = Math.max(objRadius * 8, 2.5)
    showObjectPanel(obj)
  } else {
    info.classList.remove('visible')
    selectedObject = null
    zoomTarget = null
    hideObjectPanel()
  }
}

function onCanvasMove(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

// ─── UI ───
function setupUI() {
  $('btn-play').addEventListener('click', () => {
    isPlaying = !isPlaying
    $('btn-play').innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;'
  })
  $('btn-play').innerHTML = '&#9654;'
  $('btn-fwd').addEventListener('click', () => {
    isReverse = false
    isPlaying = true
    $('btn-play').innerHTML = '&#9646;&#9646;'
    $('btn-fwd').classList.add('active')
    $('btn-rev').classList.remove('active')
  })
  $('btn-fwd').classList.add('active')
  $('btn-rev').addEventListener('click', () => {
    isReverse = true
    isPlaying = true
    $('btn-play').innerHTML = '&#9646;&#9646;'
    $('btn-rev').classList.add('active')
    $('btn-fwd').classList.remove('active')
  })
  $('btn-reset').addEventListener('click', () => { simJD = getCurrentJD() })

  $('btn-zoom-in').addEventListener('click', () => {
    spherical.radius = Math.max(2, spherical.radius - 2)
    camera.position.setFromSpherical(spherical)
    controls.update()
  })
  $('btn-zoom-out').addEventListener('click', () => {
    spherical.radius = Math.min(100, spherical.radius + 2)
    camera.position.setFromSpherical(spherical)
    controls.update()
  })

  const hSlider = $('slider-azimuth')
  const vSlider = $('slider-elevation')
  if (hSlider && vSlider) {
    const panVec = new THREE.Vector3()
    const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3()
    const applyPan = (slider, axis, prev) => {
      const val = parseFloat(slider.value)
      const delta = val - prev
      if (Math.abs(delta) < 0.01) return val
      const dist = camera.position.distanceTo(controls.target)
      const factor = dist * 0.008
      camera.getWorldDirection(_f)
      _r.crossVectors(_f, camera.up).normalize()
      _u.crossVectors(_r, _f).normalize()
      if (axis === 'h') {
        panVec.copy(_r).multiplyScalar(delta * factor)
      } else {
        panVec.copy(_u).multiplyScalar(-delta * factor)
      }
      camera.position.add(panVec)
      controls.target.add(panVec)
      controls.update()
      return val
    }
    hSlider.addEventListener('input', () => { panH = applyPan(hSlider, 'h', panH) })
    vSlider.addEventListener('input', () => { panV = applyPan(vSlider, 'v', panV) })
  }

  document.querySelectorAll('.sp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timeSpeed = parseFloat(btn.dataset.speed)
      document.querySelectorAll('.sp-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })
  document.querySelectorAll('.pr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pr-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      if (btn.dataset.jd === 'now') {
        simJD = getCurrentJD()
        isPlaying = true; $('btn-play').innerHTML = '&#9654;'
        return
      }
      const jd = parseFloat(btn.dataset.jd)
      if (!isNaN(jd)) { simJD = jd; isPlaying = true; $('btn-play').innerHTML = '&#9654;' }
    })
  })
  // Accordion: click header toggles body
  document.querySelectorAll('.dp-head').forEach(head => {
    head.addEventListener('click', () => {
      const targetId = head.dataset.target
      const body = document.getElementById(targetId)
      const item = head.closest('.dp-item')
      if (!body || !item) return
      item.classList.toggle('open')
    })
  })

  // Mobile drawer close (event delegation)
  const drawer = $('sel-drawer')
  if (drawer) {
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('.sel-dr-close')) {
        hideObjectPanel()
      }
    })
  }
}

// ─── Bible Verse Rotator ───
function setupBibleVerses() {
  const verses = [
    { ref: 'Luke 21:25', text: 'And there shall be signs in the sun, and in the moon, and in the stars; and upon the earth distress of nations, with perplexity; the sea and the waves roaring;' },
    { ref: 'Luke 21:11', text: 'And great earthquakes shall be in divers places, and famines, and pestilences; and fearful sights and great signs shall there be from heaven.' },
    { ref: 'Joel 2:30\u201331', text: 'And I will shew wonders in the heavens and in the earth, blood, and fire, and pillars of smoke. The sun shall be turned into darkness, and the moon into blood, before the great and the terrible day of the LORD come.' },
    { ref: 'Matthew 24:29', text: 'Immediately after the tribulation of those days shall the sun be darkened, and the moon shall not give her light, and the stars shall fall from heaven, and the powers of the heavens shall be shaken:' },
    { ref: 'Revelation 6:12\u201313', text: 'And I beheld when he had opened the sixth seal, and, lo, there was a great earthquake; and the sun became black as sackcloth of hair, and the moon became as blood; And the stars of heaven fell unto the earth, even as a fig tree casteth her untimely figs, when she is shaken of a mighty wind.' },
    { ref: 'Revelation 8:10\u201311', text: 'And the third angel sounded, and there fell a great star from heaven, burning as it were a lamp, and it fell upon the third part of the rivers, and upon the fountains of waters; And the name of the star is called Wormwood: and the third part of the waters became wormwood; and many men died of the waters, because they were made bitter.' },
  ]
  const container = $('bible-verse')
  const content = $('bv-content')
  const ref = $('bv-ref')
  if (!container || !content || !ref) return
  let order = []
  let orderIdx = 0
  function pickNext() {
    if (orderIdx >= order.length) {
      order = Array.from({ length: verses.length }, (_, i) => i)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      orderIdx = 0
    }
    return order[orderIdx++]
  }
  function show(i) {
    content.textContent = verses[i].text
    ref.textContent = verses[i].ref
    container.classList.add('visible')
  }
  function next() {
    container.classList.remove('visible')
    setTimeout(() => show(pickNext()), 1500)
  }
  show(pickNext())
  setInterval(next, 15000)
}

// ─── Animate ───
let lastTime = 0
function animate(time) {
  requestAnimationFrame(animate)
  const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016
  lastTime = time
  if (isPlaying) simJD += delta * timeSpeed * (isReverse ? -1 : 1)
  updateScene()
  const simDateStr = formatJD(simJD)
  if (simDateStr !== $('sim-date').textContent) $('sim-date').textContent = simDateStr
  if (zoomTarget) {
    if (isTracking && selectedObject) zoomTarget.copy(selectedObject.position)
    controls.target.lerp(zoomTarget, 0.05)
    spherical.radius += (zoomDist - spherical.radius) * 0.04
    if (Math.abs(spherical.radius - zoomDist) > 0.01) camera.position.setFromSpherical(spherical)
  }
  controls.update()
  composer.render()
  labelRenderer.render(scene, camera)
}

init()
