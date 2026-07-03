import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import {
  D2R, R2D, SPHERE_R,
  STARS_LEO, LEO_LINES,
  jdToDate,
  getMoonRaDec,
  getPlanetRaDec
} from './soj/engine.js'

// ── Virgo stars ──
// Coordinates verified against StarGlobe and Hipparcos
const VIRGO_STARS = [
  { name: 'ν Vir',       ra: 176.465, dec:  6.529, mag: 4.04 },  // HIP 57380
  { name: 'Zaniah',      ra: 184.976, dec: -0.667, mag: 3.89 },  // HIP 60129
  { name: 'Porrima',     ra: 190.412, dec: -1.449, mag: 2.74 },  // HIP 61941
  { name: 'Minelauva',   ra: 193.899, dec:  3.397, mag: 3.39 },  // HIP 63090
  { name: 'Vindemiatrix',ra: 195.543, dec: 10.959, mag: 2.85 },  // HIP 63608
  { name: 'Spica',       ra: 201.298, dec:-11.161, mag: 0.98 },  // HIP 65474
  { name: 'Heze',        ra: 203.672, dec: -0.596, mag: 3.37 },  // HIP 66249
  { name: 'τ Vir',       ra: 210.412, dec:  1.544, mag: 4.23 },  // HIP 68520
  { name: 'Syrma',       ra: 214.003, dec: -6.002, mag: 4.08 },  // HIP 69701
  { name: 'Rijl al Awwa',ra: 220.766, dec: -5.660, mag: 3.87 },  // HIP 71957
  { name: '109 Vir',     ra: 221.562, dec:  1.893, mag: 3.73 },  // HIP 72220
  { name: 'κ Vir',       ra: 213.224, dec:-10.274, mag: 4.18 },  // HIP 69427 (HR 5315, Kang — knee star, south of Syrma)
]

// Virgo constellation lines — matching the 3D engine pattern.
const VIRGO_LINES = [
  [1, 2, 3, 6],        // Zaniah→Porrima→Minelauva→Heze
  [1, 0],                // Zaniah→ν Vir
  [4, 3],                // Upper branch: Vindemiatrix→Minelauva
  [6, 5],                // Heze→Spica
  [2, 5],                // Porrima→Spica
  [6, 7, 10],            // Heze→τ Vir→109 Vir
  [9, 8],                // Rijl al Awwa→Syrma
  [5, 11, 8],            // Spica→κ Vir→Syrma (left leg with knee bend)
]

const LATITUDE = 31.77
const CAM_HEIGHT = 2
const STAR_R = SPHERE_R
const LABEL_R = SPHERE_R * 0.98

let scene, camera, renderer, labelRenderer
let skyGroup
let cameraAzimuth = 170
let cameraElevation = -12
let cameraFov = 70
let currentJD = 2457448  // Mar 1, 2016

// Playback state
let isPlaying = false
let playDirection = 1       // 1 = forward, -1 = reverse
let speedMultiplier = 1     // 1, 2, 3, 5, 10
let playStartJD = currentJD
let playStartTime = null

let horizonLine = null
let horizonGlow = null
let horizonLabel = null
let cardinalLabels = []
let horizonVisible = true

let constellationStarMeshes = []
let constellationGlowMeshes = []
let labelObjects = []
let constellationLineObjects = []
let starVisibilityData = [] // { core, glow, worldPos, isSpecial, coreMat, glowMat }

function timeStr() {
  const d = jdToDate(currentJD + 3 / 24) // UTC+3 (Jerusalem)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year}`
}

// ── Solar System body positions (approximate, for visualization) ──

function sunRaDec(jd) {
  const T = (jd - 2451545.0) / 36525.0
  const M = (357.5291 + 0.98560028 * (jd - 2451545.0)) * D2R
  const C = 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)
  const lambda = ((M / D2R) + C + 180 + 102.9372) % 360
  const epsilon = (23.4393 - 0.00000036 * (jd - 2451545.0)) * D2R
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda * D2R), Math.cos(lambda * D2R))
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda * D2R))
  return { ra: (ra / D2R + 360) % 360, dec: dec / D2R }
}

function heliocentricEcliptic(jd) {
  // Returns { x, y, z } in AU — geocentric ecliptic for planet at jd
  // Uses mean orbital elements (J2000) with proper argument of perihelion
  function planetElem(a, e, iDeg, omegaDeg, wBarDeg, L0, L1) {
    const i = iDeg * D2R
    const omega = omegaDeg * D2R
    const wArg = (wBarDeg - omegaDeg) * D2R   // argument of perihelion
    const L = (L0 + L1 * (jd - 2451545.0)) * D2R
    const M = (L - wBarDeg * D2R + 2 * Math.PI) % (2 * Math.PI)
    let E = M
    for (let k = 0; k < 5; k++) E = M + e * Math.sin(E)
    const rCosF = a * (Math.cos(E) - e)       // r * cos(true_anomaly)
    const rSinF = a * Math.sqrt(1 - e * e) * Math.sin(E)  // r * sin(true_anomaly)
    const cW = Math.cos(wArg), sW = Math.sin(wArg)
    const u1 = rCosF * cW - rSinF * sW        // r * cos(ω+f)
    const u2 = rSinF * cW + rCosF * sW        // r * sin(ω+f)
    const xEcl = u1 * Math.cos(omega) - u2 * Math.sin(omega) * Math.cos(i)
    const yEcl = u1 * Math.sin(omega) + u2 * Math.cos(omega) * Math.cos(i)
    const zEcl = u2 * Math.sin(i)
    return { x: xEcl, y: yEcl, z: zEcl }
  }

  //        a     e     i     Ω      w̄ (=Ω+ω)  L0     L1
  // Jupiter: 5.203 0.048 1.305 100.5  14.33    34.35  0.083091
  const jup = planetElem(5.203, 0.048, 1.305, 100.5, 14.33, 34.35, 0.083091)
  // Earth:   1.000 0.017 0.0     0.0  102.937 100.466 0.985647
  const ear = planetElem(1.000, 0.017, 0.0, 0.0, 102.937, 100.466, 0.985647)
  return { x: jup.x - ear.x, y: jup.y - ear.y, z: jup.z - ear.z }
}

function jupiterRaDec(jd) {
  const geo = heliocentricEcliptic(jd)
  const epsilon = (23.4393 - 0.00000036 * (jd - 2451545.0)) * D2R
  const xEq = geo.x
  const yEq = geo.y * Math.cos(epsilon) - geo.z * Math.sin(epsilon)
  const zEq = geo.y * Math.sin(epsilon) + geo.z * Math.cos(epsilon)
  const ra = Math.atan2(yEq, xEq)
  const dec = Math.atan2(zEq, Math.sqrt(xEq * xEq + yEq * yEq))
  return { ra: (ra / D2R + 360) % 360, dec: dec / D2R }
}

function planetRaDec(name, jd) {
  const p = getPlanetRaDec(name, jd)
  if (!p) return { ra: 0, dec: 0 }
  return { ra: (p.ra / D2R + 360) % 360, dec: p.dec / D2R }
}

function mercuryRaDec(jd)     { return planetRaDec('mercury', jd) }
function venusRaDec(jd)       { return planetRaDec('venus', jd) }
function marsRaDec(jd)        { return planetRaDec('mars', jd) }
function saturnRaDec(jd)      { return planetRaDec('saturn', jd) }

function moonRaDec(jd) {
  const m = getMoonRaDec(jd)
  return { ra: (m.ra / D2R + 360) % 360, dec: m.dec / D2R }
}

let planetMeshes = []
let planetGlows = []
let planetLabelAttach = []  // { label, fn }

function glowTexture(color) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  const hex = '#' + new THREE.Color(color).getHexString()
  g.addColorStop(0, hex)
  g.addColorStop(0.15, hex)
  g.addColorStop(0.5, hex + '66')
  g.addColorStop(1, hex + '00')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function makeGlowSprite(color, size) {
  const tex = glowTexture(color)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(size, size, 1)
  return sprite
}

function createPlanetMarkers() {
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 })
  const jupMat = new THREE.MeshBasicMaterial({ color: 0xdd9966 })

  function addPlanet(fn, mat, label, color, size) {
    size = size || 0.8
    const { ra, dec } = fn(currentJD)
    const pos = raDecToPos(ra, dec, STAR_R)
    const core = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 12), mat)
    core.position.copy(pos)
    skyGroup.add(core)
    planetMeshes.push(core)

    const glow = makeGlowSprite(mat.color, size * 5)
    glow.position.copy(pos)
    skyGroup.add(glow)
    planetGlows.push(glow)

    const div = document.createElement('div')
    div.className = 'soj-label soj-label-planet'
    div.textContent = label
    div.style.color = color
    const labelObj = new CSS2DObject(div)
    const dir = pos.clone().normalize()
    labelObj.position.copy(pos.clone().add(dir.multiplyScalar(size * 4 + 4)))
    labelObj.userData = { ra, dec }
    skyGroup.add(labelObj)
    labelObjects.push(labelObj)
    planetLabelAttach.push({ label: labelObj, fn })
  }

  // All bodies scaled up uniformly for visual clarity
  const BODY_SCALE = 2.5
  const cbrt = x => Math.cbrt(x)
  const mercuryD = 4879
  const scaleP = d => 0.2 * BODY_SCALE * cbrt(d / mercuryD)

  addPlanet(sunRaDec, sunMat, '☀ SUN', '#ffcc44', 1.5 * BODY_SCALE)
  addPlanet(mercuryRaDec, new THREE.MeshBasicMaterial({ color: 0xb0b8c0 }), '☿ MERCURY', '#b0b8c0', 0.2 * BODY_SCALE)
  addPlanet(venusRaDec, new THREE.MeshBasicMaterial({ color: 0xe8c870 }), '♀ VENUS', '#e8c870', scaleP(12104))
  addPlanet(marsRaDec, new THREE.MeshBasicMaterial({ color: 0xcc5544 }), '♂ MARS', '#cc5544', scaleP(6779))
  addPlanet(jupiterRaDec, jupMat, '♃ JUPITER', '#dd9966', scaleP(139820))
  addPlanet(saturnRaDec, new THREE.MeshBasicMaterial({ color: 0xc8b878 }), '♄ SATURN', '#c8b878', scaleP(116460))

  // Moon (angular size from Earth ≈ Sun)
  const moonSize = 1.45 * BODY_SCALE
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xcccccc })
  const { ra: mra, dec: mdec } = moonRaDec(currentJD)
  const mpos = raDecToPos(mra, mdec, STAR_R)
  const mMoon = new THREE.Mesh(new THREE.SphereGeometry(moonSize, 10, 10), moonMat)
  mMoon.position.copy(mpos)
  skyGroup.add(mMoon)
  planetMeshes.push(mMoon)
  const mGlow = makeGlowSprite(0xcccccc, moonSize * 5)
  mGlow.position.copy(mpos)
  skyGroup.add(mGlow)
  planetGlows.push(mGlow)
  const mDiv = document.createElement('div')
  mDiv.className = 'soj-label soj-label-planet'
  mDiv.textContent = '☾ MOON'
  mDiv.style.color = '#cccccc'
  const mLabel = new CSS2DObject(mDiv)
  const mDir = mpos.clone().normalize()
  mLabel.position.copy(mpos.clone().add(mDir.multiplyScalar(moonSize + 3)))
  mLabel.userData = { ra: mra, dec: mdec }
  skyGroup.add(mLabel)
  labelObjects.push(mLabel)
  planetLabelAttach.push({ label: mLabel, fn: moonRaDec })
}

function updatePlanets() {
  updateHorizon()
  for (let i = 0; i < planetLabelAttach.length; i++) {
    const { label, fn } = planetLabelAttach[i]
    const { ra, dec } = fn(currentJD)
    const pos = raDecToPos(ra, dec, STAR_R)
    if (planetMeshes[i]) {
      planetMeshes[i].position.copy(pos)
      planetMeshes[i].userData = { ra, dec }
    }
    if (planetGlows[i]) {
      planetGlows[i].position.copy(pos)
      planetGlows[i].userData = { ra, dec }
    }
    const dir = pos.clone().normalize()
    label.position.copy(pos.clone().add(dir.multiplyScalar(5)))
    label.userData = { ra, dec }
  }
}

function raDecToPos(raDeg, decDeg, r) {
  const ra = raDeg * D2R, dec = decDeg * D2R
  return new THREE.Vector3(
    r * Math.cos(dec) * Math.sin(ra),
    r * Math.sin(dec),
    r * Math.cos(dec) * Math.cos(ra)
  )
}

function makeLabel(text, cls) {
  const div = document.createElement('div')
  div.className = `soj-label ${cls}`
  div.textContent = text
  return new CSS2DObject(div)
}

function updateCamera() {
  const azRad = cameraAzimuth * D2R
  const elRad = cameraElevation * D2R
  camera.position.set(0, CAM_HEIGHT, 0)
  const d = 500
  camera.lookAt(
    d * Math.cos(elRad) * Math.sin(azRad),
    d * Math.sin(elRad),
    d * Math.cos(elRad) * Math.cos(azRad)
  )

  // Expose for screenshot debugging
  window.__updateCamera = updateCamera
  window.__soj = { get azimuth() { return cameraAzimuth }, set azimuth(v) { cameraAzimuth = v; window.__updateCamera() }, get elevation() { return cameraElevation }, set elevation(v) { cameraElevation = v; window.__updateCamera() } }
  const panLabel = document.getElementById('panLabel')
  if (panLabel) panLabel.textContent = `${Math.round(cameraAzimuth)}°`
  const dirEl = document.getElementById('dirDisplay')
  if (dirEl) {
    const az = cameraAzimuth
    const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
    const idx = Math.round(az / 22.5) % 16
    dirEl.textContent = `Looking ${Math.round(az)}° ${names[idx]}`
  }

  // Update compass strip
  const compassBand = document.getElementById('compassBand')
  if (compassBand) {
    // Each direction span is 42.5px wide, 8 directions = 340px total for one cycle
    // Offset = negative azimuth * (340 / 360) to scroll the band
    const offset = -(cameraAzimuth * (340 / 360))
    compassBand.style.transform = `translateX(${offset}px)`
  }
}

// ── Ground (static horizon at initial LST) ──

function buildHorizonGeometry(lst) {
  const n = 128
  const pts = []
  const latRad = LATITUDE * D2R
  for (let i = 0; i < n; i++) {
    const ha = (i / n) * 2 * Math.PI
    const dec = Math.atan2(-Math.cos(latRad) * Math.cos(ha), Math.sin(latRad))
    const raDeg = (lst - ha * (180 / Math.PI) + 360) % 360
    const decDeg = dec / D2R
    pts.push(raDecToPos(raDeg, decDeg, SPHERE_R))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

function buildHorizonGlowGeometry(lst) {
  const gpts = []
  const latRad = LATITUDE * D2R
  for (let i = 0; i < 64; i++) {
    const ha = Math.PI * 0.35 + (i / 64) * Math.PI * 0.3
    for (const altOff of [0, 2, 4]) {
      const d = Math.atan2(-Math.cos(latRad) * Math.cos(ha), Math.sin(latRad)) + altOff * D2R
      const raDeg = (lst - ha * (180 / Math.PI) + 360) % 360
      gpts.push(raDecToPos(raDeg, d / D2R, SPHERE_R))
    }
  }
  return new THREE.BufferGeometry().setFromPoints(gpts)
}

function lstDeg(jd) {
  const jdUT = jd + 14.5 / 24
  const T = (jdUT - 2451545.0) / 36525.0
  let g = 280.46061837 + 360.98564736629 * (jdUT - 2451545.0)
        + 0.000387933 * T * T - T * T * T / 38710000.0
  return ((g + 35.21) % 360 + 360) % 360
}

function createGround() {
  updateHorizon()
}

// ── Background stars ──

function createBackgroundStars() {
  const count = 3000
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const ra = Math.random() * 360
    const dec = Math.acos(2 * Math.random() - 1) * (180 / Math.PI) - 90
    const pos = raDecToPos(ra, dec, SPHERE_R * (0.97 + Math.random() * 0.03))
    positions[i * 3] = pos.x
    positions[i * 3 + 1] = pos.y
    positions[i * 3 + 2] = pos.z
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xd0cabc, size: 0.3, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
  })
  const stars = new THREE.Points(geo, mat)
  skyGroup.add(stars)
}

// ── Constellation stars (horizon-filtered) ──

function createConstellationStars() {

  function addStars(stars, offset) {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]
      const pos = raDecToPos(s.ra, s.dec, SPHERE_R)
      const scale = Math.max(0.5, 1.8 - s.mag * 0.18)

      const isChertan = s.name === 'θ Leo (Chertan)'
      const isHighlight = s.highlight === true

      const coreMat = new THREE.MeshBasicMaterial({ color: isHighlight ? 0x44ff44 : 0xffffff, transparent: true, opacity: 1.0 })
      const glowMat = new THREE.MeshBasicMaterial({ color: isHighlight ? 0x22cc22 : 0x8899cc, transparent: true, opacity: 0.2, side: THREE.DoubleSide })

      const core = new THREE.Mesh(new THREE.SphereGeometry(isChertan ? 0.8 : 0.4 * scale, 10, 10), coreMat)
      core.position.copy(pos)
      skyGroup.add(core)
      constellationStarMeshes[offset + i] = core

      const glow = new THREE.Mesh(new THREE.SphereGeometry(isChertan ? 1.6 : 0.8 * scale, 10, 10), glowMat)
      glow.position.copy(pos)
      skyGroup.add(glow)
      constellationGlowMeshes[offset + i] = glow

      starVisibilityData.push({
        core, glow,
        localPos: pos.clone(),
        worldPos: new THREE.Vector3(),
        coreMat, glowMat,
        isSpecial: isChertan,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.004,
        twinkleDepth: 0.3 + Math.random() * 0.7
      })
    }
  }

  addStars(VIRGO_STARS, 0)
  addStars(STARS_LEO, VIRGO_STARS.length)
}

// ── Constellation lines (horizon-clipped) ──

function createConstellationLines() {
  const mainMat = new THREE.LineBasicMaterial({ color: 0x7799ee, transparent: true, opacity: 0.7 })
  const glowMat = new THREE.LineBasicMaterial({ color: 0x7799ee, transparent: true, opacity: 0.15 })

  function addPolyline(indices, stars) {
    const positions = []
    const endpoints = []
    for (const i of indices) {
      const s = stars[i]
      if (!s) continue
      positions.push(raDecToPos(s.ra, s.dec, SPHERE_R))
      endpoints.push([s.ra, s.dec])
    }
    if (positions.length < 2) return

    const pts = []
    for (let i = 0; i < positions.length - 1; i++) {
      pts.push(positions[i], positions[i + 1])
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const glow = new THREE.Line(geo.clone(), glowMat)
    glow.userData.endpoints = endpoints
    skyGroup.add(glow)
    constellationLineObjects.push(glow)
    const main = new THREE.Line(geo.clone(), mainMat)
    main.userData.endpoints = endpoints
    skyGroup.add(main)
    constellationLineObjects.push(main)
  }

  function addCoordPath(path, color) {
    if (path.length < 2) return
    const c = color || 0x7799ee
    const lineMat = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })
    const glowMatLoc = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.12 })
    const positions = path.map(([ra, dec]) => raDecToPos(ra, dec, SPHERE_R))
    const pts = []
    for (let i = 0; i < positions.length - 1; i++) {
      pts.push(positions[i], positions[i + 1])
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const glow = new THREE.Line(geo.clone(), glowMatLoc)
    glow.userData.endpoints = path
    skyGroup.add(glow)
    constellationLineObjects.push(glow)
    const main = new THREE.Line(geo.clone(), lineMat)
    main.userData.endpoints = path
    skyGroup.add(main)
    constellationLineObjects.push(main)
  }

  function addPolylines(lineGroups, stars) {
    for (const indices of lineGroups) {
      addPolyline(indices, stars)
    }
  }

  addPolylines(VIRGO_LINES, VIRGO_STARS)
  addPolylines(LEO_LINES, STARS_LEO)
}

// ── Labels (horizon-filtered) ──

function createLabels() {
  const addConstLabel = (name, ra, dec, yOff) => {
    const pos = raDecToPos(ra, dec, LABEL_R)
    const labelPos = pos.clone().add(new THREE.Vector3(0, yOff, 0))
    const label = makeLabel(name, 'soj-label-constellation')
    label.position.copy(labelPos)
    label.userData = { ra, dec }
    skyGroup.add(label)
    labelObjects.push(label)
  }
  addConstLabel('VIRGO', 195, 0, -14)
  addConstLabel('LEO', 165, 15, -12)

  const addStarLabel = (star) => {
    const pos = raDecToPos(star.ra, star.dec, STAR_R)
    const dir = pos.clone().normalize()
    const labelPos = pos.clone().add(dir.multiplyScalar(4))
    const cls = star.highlight ? 'soj-label-star soj-label-highlight' : 'soj-label-star'
    const label = makeLabel(star.name, cls)
    label.position.copy(labelPos)
    label.userData = { ra: star.ra, dec: star.dec }
    skyGroup.add(label)
    labelObjects.push(label)
  }

  VIRGO_STARS.forEach(addStarLabel)
  STARS_LEO.forEach(addStarLabel)
}

// ── Look at RA/Dec ──

function lookAtRaDec(raDeg, decDeg) {
  const localPos = raDecToPos(raDeg, decDeg, SPHERE_R)
  skyGroup.updateMatrixWorld(true)
  const worldPos = localPos.clone().applyMatrix4(skyGroup.matrixWorld)
  const dir = new THREE.Vector3().copy(worldPos).sub(camera.position)
  cameraAzimuth = (Math.atan2(dir.x, dir.z) * R2D + 360) % 360
  cameraElevation = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * R2D
  updateCamera()
}

// ── Controls ──

function setupControls() {
  const btnLeft = document.getElementById('btnPanLeft')
  const btnRight = document.getElementById('btnPanRight')
  const btnUp = document.getElementById('btnPanUp')
  const btnDown = document.getElementById('btnPanDown')

  if (btnLeft) {
    btnLeft.addEventListener('mousedown', () => startPan('az', -1))
    btnLeft.addEventListener('mouseup', stopPan)
    btnLeft.addEventListener('mouseleave', stopPan)
    btnLeft.addEventListener('touchstart', e => { e.preventDefault(); startPan('az', -1) })
    btnLeft.addEventListener('touchend', stopPan)
  }
  if (btnRight) {
    btnRight.addEventListener('mousedown', () => startPan('az', 1))
    btnRight.addEventListener('mouseup', stopPan)
    btnRight.addEventListener('mouseleave', stopPan)
    btnRight.addEventListener('touchstart', e => { e.preventDefault(); startPan('az', 1) })
    btnRight.addEventListener('touchend', stopPan)
  }
  if (btnUp) {
    btnUp.addEventListener('mousedown', () => startPan('el', 1))
    btnUp.addEventListener('mouseup', stopPan)
    btnUp.addEventListener('mouseleave', stopPan)
    btnUp.addEventListener('touchstart', e => { e.preventDefault(); startPan('el', 1) })
    btnUp.addEventListener('touchend', stopPan)
  }
  if (btnDown) {
    btnDown.addEventListener('mousedown', () => startPan('el', -1))
    btnDown.addEventListener('mouseup', stopPan)
    btnDown.addEventListener('mouseleave', stopPan)
    btnDown.addEventListener('touchstart', e => { e.preventDefault(); startPan('el', -1) })
    btnDown.addEventListener('touchend', stopPan)
  }

  const btnRecenter = document.getElementById('btnRecenter')
  if (btnRecenter) {
    btnRecenter.addEventListener('click', () => {
      lookAtRaDec(182, 5)
    })
  }

  const SEP23_JD = 2458020.0282
  const btnSept23 = document.getElementById('btnSept23')
  if (btnSept23) {
    btnSept23.addEventListener('click', () => {
      currentJD = SEP23_JD
      playStartJD = currentJD
      playStartTime = null
      isPlaying = false
      updatePlanets()
      updateTimeDisplay()
      lookAtRaDec(182, 5)
    })
  }

  // Horizon toggle
  const btnToggleHorizon = document.getElementById('btnToggleHorizon')
  if (btnToggleHorizon) {
    btnToggleHorizon.addEventListener('click', () => {
      horizonVisible = !horizonVisible
      btnToggleHorizon.classList.toggle('active', horizonVisible)
      if (horizonLine) horizonLine.visible = horizonVisible
      if (horizonGlow) horizonGlow.visible = horizonVisible
      if (horizonLabel) horizonLabel.visible = horizonVisible
      cardinalLabels.forEach(l => { l.visible = horizonVisible })
    })
  }

  document.addEventListener('keydown', e => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        cameraAzimuth = (cameraAzimuth - 2 + 360) % 360
        updateCamera()
        break
      case 'ArrowRight':
        e.preventDefault()
        cameraAzimuth = (cameraAzimuth + 2) % 360
        updateCamera()
        break
      case 'ArrowUp':
        e.preventDefault()
        cameraElevation = Math.min(85, cameraElevation + 2)
        updateCamera()
        break
      case 'ArrowDown':
        e.preventDefault()
        cameraElevation = Math.max(-85, Math.min(85, cameraElevation - 2))
        updateCamera()
        break
    }
  })

  const canvas = renderer.domElement
  let isDragging = false
  let dragLastX = 0, dragLastY = 0

  canvas.addEventListener('mousedown', e => {
    isDragging = true
    dragLastX = e.clientX
    dragLastY = e.clientY
    canvas.style.cursor = 'grabbing'
  })

  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return
    const dx = e.clientX - dragLastX
    const dy = e.clientY - dragLastY
    dragLastX = e.clientX
    dragLastY = e.clientY
    cameraAzimuth = (cameraAzimuth - dx * 1.0 + 360) % 360
    cameraElevation = Math.max(-85, Math.min(85, cameraElevation + dy * 1.0))
    updateCamera()
  })

  canvas.addEventListener('mouseup', () => {
    isDragging = false
    canvas.style.cursor = 'default'
  })

  canvas.addEventListener('mouseleave', () => { isDragging = false })

  // ── Zoom (mouse wheel + pinch) ──
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    cameraFov = Math.max(20, Math.min(140, cameraFov + (e.deltaY > 0 ? 5 : -5)))
    camera.fov = cameraFov
    camera.updateProjectionMatrix()
  }, { passive: false })

  // ── Consolidated touch handlers (drag + pinch) ──
  let lastPinchDist = null
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isDragging = true
      dragLastX = e.touches[0].clientX
      dragLastY = e.touches[0].clientY
    } else if (e.touches.length === 2) {
      isDragging = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDist = Math.sqrt(dx * dx + dy * dy)
    }
  })
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && lastPinchDist) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      cameraFov = Math.max(20, Math.min(140, cameraFov + (lastPinchDist - dist) * 0.3))
      camera.fov = cameraFov
      camera.updateProjectionMatrix()
      lastPinchDist = dist
    } else if (isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragLastX
      const dy = e.touches[0].clientY - dragLastY
      dragLastX = e.touches[0].clientX
      dragLastY = e.touches[0].clientY
      cameraAzimuth = (cameraAzimuth - dx * 1.0 + 360) % 360
      cameraElevation = Math.max(-85, Math.min(85, cameraElevation + dy * 1.0))
      updateCamera()
    }
  }, { passive: false })
  canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastPinchDist = null
    if (e.touches.length === 0) isDragging = false
  })
}

let panInterval = null

function startPan(axis, dir) {
  stopPan()
  panInterval = setInterval(() => {
    if (axis === 'az') {
      cameraAzimuth = (cameraAzimuth + dir * 1.5 + 360) % 360
    } else {
      cameraElevation = Math.max(-85, Math.min(85, cameraElevation + dir * 1.5))
    }
    updateCamera()
  }, 16)
}

function stopPan() {
  if (panInterval) { clearInterval(panInterval); panInterval = null }
}

// ── Time-lapse Controls ──

const START_JD = 2457448  // Mar 1, 2016 — Jupiter in Leo, approaching Virgo
const END_JD = 2458120    // Jan 1, 2018 — Jupiter well into Libra, left Virgo
const BASE_JD_PER_S = 1.0 // base: 1 day per second

function getPlayRate() {
  if (!isPlaying) return 0
  return playDirection * BASE_JD_PER_S * speedMultiplier
}

function startPlay() {
  isPlaying = true
  playStartJD = currentJD
  playStartTime = performance.now()
}

function stopPlay() {
  isPlaying = false
  playStartTime = null
  const el = document.getElementById('playDir')
  if (el) el.classList.remove('visible')
}

function updateTimeDisplay() {
  const dateEl = document.getElementById('dateDisplay')
  if (dateEl) dateEl.textContent = timeStr()
  const jdEl = document.getElementById('jdDisplay')
  if (jdEl) jdEl.textContent = 'JD ' + currentJD.toFixed(4)
  const pauseBtn = document.getElementById('btnPause')
  if (pauseBtn) pauseBtn.textContent = isPlaying ? '⏸' : '▶'
  pauseBtn.classList.toggle('paused', !isPlaying)

  for (const mult of [0.5, 1, 2, 3, 5, 10, 25, 50]) {
    const id = mult === 0.5 ? 'btnMult0_5' : `btnMult${mult}`
    const btn = document.getElementById(id)
    if (btn) btn.classList.toggle('active', speedMultiplier === mult)
  }
}

function updateHorizon() {
  const lst = lstDeg(currentJD)
  if (horizonLine) skyGroup.remove(horizonLine)
  if (horizonGlow) skyGroup.remove(horizonGlow)
  if (horizonLabel) { skyGroup.remove(horizonLabel); labelObjects = labelObjects.filter(o => o !== horizonLabel) }
  cardinalLabels.forEach(l => { skyGroup.remove(l); labelObjects = labelObjects.filter(o => o !== l) })
  cardinalLabels = []

  const lineMat = new THREE.LineBasicMaterial({ color: 0x7a5a2a, transparent: true, opacity: 0.7 })
  horizonLine = new THREE.Line(buildHorizonGeometry(lst), lineMat)
  skyGroup.add(horizonLine)

  const gmat = new THREE.LineBasicMaterial({ color: 0xcc8844, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending })
  horizonGlow = new THREE.Line(buildHorizonGlowGeometry(lst), gmat)
  skyGroup.add(horizonGlow)

  // Horizon label
  const ha = 1.5
  const latRad = LATITUDE * D2R
  const dec = Math.atan2(-Math.cos(latRad) * Math.cos(ha), Math.sin(latRad))
  const raDeg = (lst - ha * (180 / Math.PI) + 360) % 360
  const pos = raDecToPos(raDeg, dec / D2R, SPHERE_R)
  const off = pos.clone().normalize()
  const labelPos = pos.clone().add(off.multiplyScalar(5))
  horizonLabel = makeLabel('JERUSALEM HORIZON', 'soj-label-horizon')
  horizonLabel.position.copy(labelPos)
  horizonLabel.userData = { ra: raDeg, dec: dec / D2R }
  skyGroup.add(horizonLabel)
  labelObjects.push(horizonLabel)

  // Cardinal direction markers
  function addCardinal(label, haRad) {
    const d = Math.atan2(-Math.cos(latRad) * Math.cos(haRad), Math.sin(latRad))
    const r = (lst - haRad * R2D + 360) % 360
    const p = raDecToPos(r, d / D2R, SPHERE_R)
    const n = p.clone().normalize()
    const lp = p.clone().add(n.multiplyScalar(4))
    const l = makeLabel(label, 'soj-label-horizon')
    l.position.copy(lp)
    l.userData = { ra: r, dec: d / D2R }
    skyGroup.add(l)
    labelObjects.push(l)
    cardinalLabels.push(l)
  }
  addCardinal('S', 0)
  addCardinal('W', Math.PI / 2)
  addCardinal('N', Math.PI)
  addCardinal('E', 3 * Math.PI / 2)

  // Respect toggle state after rebuild
  if (!horizonVisible) {
    if (horizonLine) horizonLine.visible = false
    if (horizonGlow) horizonGlow.visible = false
    if (horizonLabel) horizonLabel.visible = false
    cardinalLabels.forEach(l => { l.visible = false })
  }
}

function setupTimeControls() {
  const pauseBtn = document.getElementById('btnPause')
  const playDirEl = document.getElementById('playDir')

  function updatePlayDir() {
    if (!playDirEl) return
    if (isPlaying) {
      playDirEl.classList.add('visible')
      playDirEl.classList.toggle('reverse', playDirection === -1)
      playDirEl.classList.toggle('forward', playDirection === 1)
      playDirEl.textContent = playDirection === -1 ? '◀ REW' : 'FWD ▶'
    } else {
      playDirEl.classList.remove('visible')
    }
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (isPlaying) stopPlay()
      else startPlay()
      updateTimeDisplay()
      updatePlayDir()
    })
  }

  document.getElementById('btnForward')?.addEventListener('click', () => {
    playDirection = 1
    if (!isPlaying) startPlay()
    else { playStartJD = currentJD; playStartTime = performance.now() }
    updateTimeDisplay()
    updatePlayDir()
  })

  document.getElementById('btnReverse')?.addEventListener('click', () => {
    playDirection = -1
    if (!isPlaying) startPlay()
    else { playStartJD = currentJD; playStartTime = performance.now() }
    updateTimeDisplay()
    updatePlayDir()
  })

  const multSpecs = [
    [0.5, 'btnMult0_5'],
    [1, 'btnMult1'],
    [2, 'btnMult2'],
    [3, 'btnMult3'],
    [5, 'btnMult5'],
    [10, 'btnMult10'],
    [25, 'btnMult25'],
    [50, 'btnMult50'],
  ]
  for (const [mult, id] of multSpecs) {
    document.getElementById(id)?.addEventListener('click', () => {
      speedMultiplier = mult
      if (isPlaying) {
        playStartJD = currentJD
        playStartTime = performance.now()
      }
      updateTimeDisplay()
    })
  }

  updateTimeDisplay()
}

function onResize() {
  const wrap = document.getElementById('canvasWrap')
  if (!wrap) return
  const w = wrap.clientWidth, h = wrap.clientHeight
  camera.aspect = w / h
  camera.fov = cameraFov
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  if (labelRenderer) labelRenderer.setSize(w, h)
}

function init() {
  const wrap = document.getElementById('canvasWrap')
  const w = wrap.clientWidth, h = wrap.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x070a12)

  camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 5000)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  wrap.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(w, h)
  labelRenderer.domElement.style.position = 'fixed'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  labelRenderer.domElement.style.zIndex = '2'
  document.body.appendChild(labelRenderer.domElement)

  skyGroup = new THREE.Group()
  skyGroup.rotation.x = -(90 - LATITUDE) * D2R
  scene.add(skyGroup)

  createGround()
  createBackgroundStars()
  createConstellationStars()
  createConstellationLines()
  createLabels()
  createPlanetMarkers()
  updatePlanets()

  setupControls()
  setupTimeControls()
  lookAtRaDec(182, 5)

  window.addEventListener('resize', onResize)

  function animate(time) {
    requestAnimationFrame(animate)
    if (isPlaying) {
      if (playStartTime === null) playStartTime = time
      const dt = (time - playStartTime) / 1000
      const rate = getPlayRate()
      currentJD = playStartJD + rate * dt
      if (rate > 0 && currentJD >= END_JD) {
        currentJD = END_JD
        stopPlay()
      } else if (rate < 0 && currentJD <= START_JD) {
        currentJD = START_JD
        stopPlay()
      }
      updatePlanets()
      updateTimeDisplay()
    }

    // Update star visibility (show far-side stars in dim color)
    skyGroup.updateMatrixWorld(true)
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    for (const sv of starVisibilityData) {
      sv.worldPos.copy(sv.localPos).applyMatrix4(skyGroup.matrixWorld)
      const toStar = sv.worldPos.clone().sub(camera.position).normalize()
      const facing = camDir.dot(toStar)
      const twinkle = 1.0 - sv.twinkleDepth * Math.abs(Math.sin(time * sv.twinkleSpeed + sv.twinklePhase))
      if (facing < 0) {
        // Star is behind the sphere relative to camera — show dim
        sv.coreMat.color.setHex(0x445566)
        sv.coreMat.opacity = 0.5 * twinkle
        sv.glowMat.color.setHex(0x334455)
        sv.glowMat.opacity = 0.08 * twinkle
      } else {
        // Star is visible — show bright with twinkle
        sv.coreMat.color.setHex(0xffffff)
        sv.coreMat.opacity = twinkle
        sv.glowMat.color.setHex(0x8899cc)
        sv.glowMat.opacity = 0.25 * twinkle
      }
    }

    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  animate(performance.now())
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
