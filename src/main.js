import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import Lenis from 'lenis'
import gsap from 'gsap'

// ─── Flow Texture ──────────────────────────────────────────
function flowTex() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.08, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.15, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.22, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.5, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 16, 512)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1)
  return t
}
const fTex = flowTex()

// ─── Scene ─────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0A0612)
scene.fog = new THREE.FogExp2(0x0A0612, 0.004)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000)
camera.position.set(0, 5, 12)
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, alpha: false, powerPreference: 'high-performance' })
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.3, 0.08)
composer.addPass(bloom); composer.addPass(new OutputPass())
const ambLight = new THREE.AmbientLight(0x111122, 0.06)
scene.add(ambLight)
const sceneGroup = new THREE.Group(); scene.add(sceneGroup)

// ─── Theme Adaptation ─────────────────────────────────────
function applyTheme() {
  const isLight = document.documentElement.classList.contains('light-mode')
  if (isLight) {
    scene.background = new THREE.Color(0xD4C4A8)
    scene.fog = new THREE.FogExp2(0xD4C4A8, 0.003)
    stars.material.color.setHex(0x887766)
    stars.material.opacity = 0.15
  } else {
    scene.background = new THREE.Color(0x0A0612)
    scene.fog = new THREE.FogExp2(0x0A0612, 0.004)
    stars.material.color.setHex(0xaaccff)
    stars.material.opacity = 0.3
  }
  ribbonMeshes.forEach(m => {
    m.material.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending
    m.material.color.setHex(getRibbonColors()[ribbonMeshes.indexOf(m)])
  })
}
// Deferred — called after stars are initialized

// ─── Mouse ─────────────────────────────────────────────────
const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
document.addEventListener('mousemove', e => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = -(e.clientY / innerHeight) * 2 + 1 })

// ─── Ribbon Colors ─────────────────────────────────────────
const ribbonColorsDark = [0xD4AF37, 0xBB9955, 0xF5EEDD, 0xBB9955, 0xD4AF37]
const ribbonColorsLight = [0x4E2A88, 0x6B3FA0, 0x8A6E0A, 0x5A3D1A, 0x3D1F6E]
function getRibbonColors() {
  return document.documentElement.classList.contains('light-mode') ? ribbonColorsLight : ribbonColorsDark
}
const RIBBON_COUNT = 5
const RIBBON_WIDTH = 0.08
const RIBBON_SEGMENTS = 96

// ─── Ribbon Generation ─────────────────────────────────────
function getPerp(tangent) {
  const up = Math.abs(tangent.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3().crossVectors(tangent, up).normalize()
  return n.length() < 0.001 ? new THREE.Vector3(0, 0, 1) : n
}

function getControlPoints(p, r) {
  const numCP = 6
  const pts = []

  const wH = Math.max(0, 1 - p * 3.5)
  const wV = Math.max(0, 1 - Math.abs(p - 0.45) * 2.8)
  const wD = Math.max(0, Math.min(1, (p - 0.35) * 2.5))

  const total = wH + wV + wD
  const nH = total > 0 ? wH / total : 1
  const nV = total > 0 ? wV / total : 0
  const nD = total > 0 ? wD / total : 0

  for (let i = 0; i < numCP; i++) {
    const u = i / (numCP - 1)

    const hx = (u - 0.5) * 22
    const hy = (r - 2) * 1.5 + Math.sin(u * Math.PI) * 0.6
    const hz = Math.sin(u * Math.PI * 2 + r * 0.8) * 0.8

    const vx = (r - 2) * 1.5 + Math.sin(u * Math.PI * 2 + r * 0.7) * 3
    const vy = (u - 0.5) * 22
    const vz = Math.cos(u * Math.PI + r * 0.6) * 2

    const dx = (r - 2) * 1.2 + Math.sin(u * Math.PI * 3 + r * 1.2) * 3.5
    const dy = (u - 0.5) * 16 + Math.sin(u * Math.PI * 2 + r * 0.5) * 2.5
    const dz = Math.sin(u * Math.PI * 2 + r * 1.5) * 8

    pts.push(new THREE.Vector3(
      hx * nH + vx * nV + dx * nD,
      hy * nH + vy * nV + dy * nD,
      hz * nH + vz * nV + dz * nD
    ))
  }
  return pts
}

function buildRibbon(cpts, color) {
  const curve = new THREE.CatmullRomCurve3(cpts)
  const pts = curve.getPoints(RIBBON_SEGMENTS)

  const verts = new Float32Array((pts.length * 2) * 3)
  const uvs = new Float32Array((pts.length * 2) * 2)
  const idx = []

  for (let i = 0; i < pts.length; i++) {
    const tangent = i === 0
      ? new THREE.Vector3().subVectors(pts[1], pts[0]).normalize()
      : i === pts.length - 1
        ? new THREE.Vector3().subVectors(pts[i], pts[i - 1]).normalize()
        : new THREE.Vector3().subVectors(pts[i + 1], pts[i - 1]).normalize()

    const perp = getPerp(tangent)
    const l = new THREE.Vector3().copy(pts[i]).addScaledVector(perp, -RIBBON_WIDTH)
    const r = new THREE.Vector3().copy(pts[i]).addScaledVector(perp, RIBBON_WIDTH)

    const vi = i * 2
    verts[vi * 3] = l.x; verts[vi * 3 + 1] = l.y; verts[vi * 3 + 2] = l.z
    verts[(vi + 1) * 3] = r.x; verts[(vi + 1) * 3 + 1] = r.y; verts[(vi + 1) * 3 + 2] = r.z

    const v = i / (pts.length - 1)
    uvs[vi * 2] = 0; uvs[vi * 2 + 1] = v
    uvs[(vi + 1) * 2] = 1; uvs[(vi + 1) * 2 + 1] = v

    if (i < pts.length - 1) {
      const a = vi, b = vi + 1, c = vi + 2, d = vi + 3
      idx.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()

  const mat = new THREE.MeshBasicMaterial({
    map: fTex.clone(),
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  return new THREE.Mesh(geo, mat)
}

let ribbonMeshes = []
function createAllRibbons(p) {
  ribbonMeshes.forEach(m => { sceneGroup.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose() })
  ribbonMeshes = []
  for (let r = 0; r < RIBBON_COUNT; r++) {
    const cpts = getControlPoints(p, r)
    const mesh = buildRibbon(cpts, getRibbonColors()[r])
    sceneGroup.add(mesh)
    ribbonMeshes.push(mesh)
  }
}

// ─── Stars ─────────────────────────────────────────────────
function starField() {
  const c = 2000, p = new Float32Array(c * 3), s = new Float32Array(c)
  for (let i = 0; i < c; i++) {
    const t = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1), r = 60 + Math.random() * 100
    p[i * 3] = r * Math.sin(ph) * Math.cos(t); p[i * 3 + 1] = r * Math.cos(ph) * 0.2; p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(t) - 100
    s[i] = 0.02 + Math.random() * 0.04
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1))
  const m = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.04, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending })
  return new THREE.Points(g, m)
}
const stars = starField()
sceneGroup.add(stars)
applyTheme()
document.addEventListener('themechange', applyTheme)

// ─── Camera Keyframes ─────────────────────────────────────
const cams = [
  { p: 0, x: 0, y: 5, z: 12, lx: 0, ly: 0, lz: 0 },
  { p: .125, x: 3, y: 3, z: 7, lx: 0, ly: 0, lz: 0 },
  { p: .25, x: -2, y: 1, z: 4, lx: 0, ly: 0.5, lz: 0 },
  { p: .375, x: 1, y: -0.5, z: 3, lx: 0, ly: 0, lz: 0 },
  { p: .5, x: 0, y: -2, z: 2, lx: 0, ly: 0, lz: 0 },
  { p: .625, x: -2, y: 0, z: 2, lx: 0, ly: 0.5, lz: 0 },
  { p: .75, x: 1.5, y: 1, z: 1.5, lx: 0, ly: 0, lz: 0 },
  { p: .875, x: 0, y: 0, z: 3.5, lx: 0, ly: 0, lz: 0 },
  { p: 1, x: 0, y: 0.5, z: 5, lx: 0, ly: 0, lz: 0 },
]

function cmr(a, b, c, d, t) { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3) }
function evalCam(t) {
  const n = cams.length, seg = t * (n - 1), idx = Math.min(Math.floor(seg), n - 2), lt = seg - idx
  const p0 = cams[Math.max(0, idx - 1)], p1 = cams[idx], p2 = cams[Math.min(n - 1, idx + 1)], p3 = cams[Math.min(n - 1, idx + 2)]
  return {
    x: cmr(p0.x, p1.x, p2.x, p3.x, lt), y: cmr(p0.y, p1.y, p2.y, p3.y, lt), z: cmr(p0.z, p1.z, p2.z, p3.z, lt),
    lx: cmr(p0.lx, p1.lx, p2.lx, p3.lx, lt), ly: cmr(p0.ly, p1.ly, p2.ly, p3.ly, lt), lz: cmr(p0.lz, p1.lz, p2.lz, p3.lz, lt)
  }
}

// ─── Scroll ───────────────────────────────────────────────
const lenis = new Lenis({ duration: 1.0, easing: t => Math.min(1, 1 - Math.pow(1 - t, 3)), orientation: 'vertical', smoothWheel: true })
let sp = 0, scrollVel = 0, lastRebuildP = -1

function update(progress) {
  sp = progress
  const p = Math.max(0, Math.min(1, progress))
  const cam = evalCam(p)
  camera.position.set(cam.x, cam.y, cam.z)
  camera.lookAt(cam.lx, cam.ly, cam.lz)

  const op = Math.min(1, p * 2.5 + 0.15)
  ribbonMeshes.forEach(m => m.material.opacity = op * 0.85)
  stars.material.opacity = Math.min(1, p * 2) * (document.documentElement.classList.contains('light-mode') ? 0.08 : 0.3)

  if (Math.abs(p - lastRebuildP) > 0.008) {
    for (let r = 0; r < RIBBON_COUNT; r++) {
      const cpts = getControlPoints(p, r)
      const curve = new THREE.CatmullRomCurve3(cpts)
      const pts = curve.getPoints(RIBBON_SEGMENTS)
      const pos = ribbonMeshes[r].geometry.attributes.position.array
      for (let i = 0; i < pts.length; i++) {
        const tangent = i === 0 ? new THREE.Vector3().subVectors(pts[1], pts[0]).normalize()
          : i === pts.length - 1 ? new THREE.Vector3().subVectors(pts[i], pts[i - 1]).normalize()
            : new THREE.Vector3().subVectors(pts[i + 1], pts[i - 1]).normalize()
        const perp = getPerp(tangent)
        const vi = i * 2
        pos[vi * 3] = pts[i].x + perp.x * -RIBBON_WIDTH
        pos[vi * 3 + 1] = pts[i].y + perp.y * -RIBBON_WIDTH
        pos[vi * 3 + 2] = pts[i].z + perp.z * -RIBBON_WIDTH
        pos[(vi + 1) * 3] = pts[i].x + perp.x * RIBBON_WIDTH
        pos[(vi + 1) * 3 + 1] = pts[i].y + perp.y * RIBBON_WIDTH
        pos[(vi + 1) * 3 + 2] = pts[i].z + perp.z * RIBBON_WIDTH
      }
      ribbonMeshes[r].geometry.attributes.position.needsUpdate = true
      ribbonMeshes[r].geometry.computeVertexNormals()
    }
    lastRebuildP = p
  }
}
lenis.on('scroll', e => { scrollVel = Math.abs(e.velocity); update(e.limit > 0 ? e.scroll / e.limit : 0) })

// ─── Loading ──────────────────────────────────────────────
const load = document.getElementById('loading-screen')
function start() {
  createAllRibbons(0)
  applyTheme()
  update(0)
  const heroContent = document.querySelector('.hero-content')
  if (heroContent) {
    Array.from(heroContent.children).forEach(child => {
      child.style.opacity = ''
      child.style.transform = ''
    })
  }
  gsap.to(load, { opacity: 0, duration: .8, delay: .5, onComplete: () => {
    load.style.display = 'none'
    const tl = gsap.timeline()
    tl.to('.hero-content > *', { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out', stagger: .05 })
    tl.call(() => document.querySelector('.heading-main').classList.add('shimmer'), [], '-=0')
    tl.call(() => { setTimeout(() => document.querySelector('.heading-main').classList.remove('shimmer'), 2200) }, [], '+=2.4')
  } })
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight) })
// ─── Animate ──────────────────────────────────────────────
function animate(ts) {
  requestAnimationFrame(animate)
  const now = ts * 0.001

  mouse.x += (mouse.tx - mouse.x) * 0.03
  mouse.y += (mouse.ty - mouse.y) * 0.03
  sceneGroup.rotation.y += (mouse.x * 0.002 - sceneGroup.rotation.y) * 0.001
  sceneGroup.rotation.x += (mouse.y * 0.001 - sceneGroup.rotation.x) * 0.001
  sceneGroup.rotation.y += 0.0004 + sp * 0.0005

  const flowSpeed = Math.min(0.02, scrollVel * 0.001 + 0.005)
  ribbonMeshes.forEach((m, i) => {
    const off = m.material.map.offset.y + flowSpeed + Math.sin(now * 0.15 + i * 0.6) * 0.0003
    m.material.map.offset.y = off % 1
  })

  document.querySelectorAll('.section-content').forEach(el => {
    Array.from(el.children).forEach(child => {
      const cr = child.getBoundingClientRect(), vh = innerHeight
      const fade = 100
      let vis = 1
      if (cr.bottom <= 0 || cr.top >= vh) {
        vis = 0
      } else if (cr.top < 0) {
        vis = Math.min(1, cr.bottom / fade)
      } else if (cr.bottom > vh) {
        vis = Math.min(1, (vh - cr.top) / fade)
      }
      const prev = child._prevVis
      if (prev === undefined || Math.abs(vis - prev) > 0.01) {
        child.style.opacity = vis
        child.style.transform = `translateY(${vis < 1 ? (1 - vis) * 8 : 0}px)`
        child._prevVis = vis
      }
    })
  })

  composer.render()
  lenis.raf(ts)
}
start()
animate(0)
