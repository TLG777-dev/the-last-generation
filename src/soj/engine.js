// Revelation 12 Sign — Astronomical Engine (Reusable)
// Keplerian orbital mechanics with JPL DE441 elements + ELP2000 Moon
// Star catalog, Julian Date math

import * as THREE from 'three'

export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI
export const SPHERE_R = 200
export const ECL_OBLIQUITY = 23.439291111 * D2R

// J2000.0 epoch Julian Date
const D = 2451545.0

// ── Keplerian Orbital Elements (JPL DE441) ──
// With per-century rates for accuracy across millennia
// L = mean longitude, ϖ = longitude of perihelion, Ω = longitude of ascending node

const PLANETS = {
  mercury: { a: 0.38709927, a_dot: 0.00000037,
             e: 0.20563593, e_dot: 0.00001906,
             I: 7.00497902, I_dot: -0.00594749,
             L: 252.25032350, L_dot: 149472.67411175,
             ϖ: 77.45779628, ϖ_dot: 0.16047689,
             Ω: 48.33076593, Ω_dot: -0.12534081, color: 0xB0B8C0 },
  venus:   { a: 0.72333566, a_dot: 0.00000390,
             e: 0.00677672, e_dot: -0.00004107,
             I: 3.39467605, I_dot: -0.00078890,
             L: 181.97909950, L_dot: 58517.81538729,
             ϖ: 131.60246718, ϖ_dot: 0.00268329,
             Ω: 76.67984255, Ω_dot: -0.27769418, color: 0xE8C870 },
  earth:   { a: 1.00000261, a_dot: 0.00000562,
             e: 0.01671123, e_dot: -0.00004392,
             I: -0.00001531, I_dot: -0.01294668,
             L: 100.46457166, L_dot: 35999.37244981,
             ϖ: 102.93768193, ϖ_dot: 0.32327364,
             Ω: 0.0, Ω_dot: 0.0 },
  mars:    { a: 1.52371034, a_dot: 0.00001847,
             e: 0.09339410, e_dot: 0.00007882,
             I: 1.84969142, I_dot: -0.00813131,
             L: 355.45332750, L_dot: 19140.30268499,
             ϖ: 336.04084774, ϖ_dot: 0.44441088,
             Ω: 49.55953891, Ω_dot: -0.29257343, color: 0xCC5544 },
  jupiter: { a: 5.20288700, a_dot: -0.00011607,
             e: 0.04838624, e_dot: -0.00013253,
             I: 1.30439695, I_dot: -0.00183714,
             L: 34.39644051, L_dot: 3034.7460277,
             ϖ: 14.72847983, ϖ_dot: 0.21252668,
             Ω: 100.47390909, Ω_dot: 0.20469106, color: 0xE8A040 },
  saturn:  { a: 9.53667594, a_dot: -0.00125060,
             e: 0.05386179, e_dot: -0.00050991,
             I: 2.48599187, I_dot: 0.00193609,
             L: 49.95424423, L_dot: 1222.49362201,
             ϖ: 92.59887831, ϖ_dot: -0.41897216,
             Ω: 113.66242448, Ω_dot: -0.28867794, color: 0xC8B878 },
}

// Planets to display
export const SHOW_PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn']

// ── Star Catalog ──
// Stars ordered to match IAU constellation stick-figure patterns
// Source: Stellarium constellationship.fab + Hipparcos catalog

// Virgo stars (ordered by IAU pattern)
export const STARS_VIRGO = [
  { name:'109 Vir', ra:221.562, dec:1.893, mag:3.73 },   // 0  HIP 72220
  { name:'τ Vir', ra:210.693, dec:1.546, mag:4.23 },     // 1  HIP 68520
  { name:'Heze', ra:203.750, dec:-0.596, mag:3.37 },     // 2  HIP 66249
  { name:'Syrma', ra:214.003, dec:-5.995, mag:4.08 },    // 3  HIP 69701
  { name:'Rijl al Awwa', ra:220.765, dec:-5.656, mag:3.87 }, // 4  HIP 71957
  { name:'Porrima', ra:190.413, dec:-1.449, mag:2.74 },  // 5  HIP 61941
  { name:'Zaniah', ra:184.975, dec:-0.667, mag:3.89 },   // 6  HIP 60129
  { name:'Zavijava', ra:177.676, dec:1.764, mag:3.59 },  // 7  HIP 57757
  { name:'ν Vir', ra:176.465, dec:6.529, mag:4.04 },     // 8  HIP 57380
  { name:'16 Vir', ra:185.087, dec:3.313, mag:4.96 },    // 9  HIP 60172
  { name:'Vindemiatrix', ra:195.543, dec:10.959, mag:2.85 }, // 10 HIP 63608
  { name:'Minelauva', ra:193.902, dec:3.398, mag:3.39 }, // 11 HIP 63090
  { name:'65 Vir', ra:199.233, dec:3.102, mag:4.28 },    // 12 HIP 64238 (fainter)
  { name:'Spica', ra:201.298, dec:-11.161, mag:0.98 },   // 13 HIP 65474
]

// Leo stars (ordered by IAU pattern)
export const STARS_LEO = [
  { name:'θ Leo', ra:168.560, dec:15.429, mag:3.34 },     // 0  HIP 54879 (Chertan)
  { name:'ζ Leo', ra:154.173, dec:23.417, mag:3.43 },     // 1  HIP 50335 (Adhafera)
  { name:'Denebola', ra:177.263, dec:14.572, mag:2.14 },  // 2  HIP 57632
  { name:'Regulus', ra:152.093, dec:11.967, mag:1.36 },   // 3  HIP 49669
  { name:'η Leo', ra:151.833, dec:16.763, mag:3.52 },     // 4  HIP 49583 (Al Jabhah)
  { name:'Algieba', ra:154.993, dec:19.841, mag:2.61 },   // 5  HIP 50583
  { name:'ε Leo', ra:146.457, dec:23.774, mag:2.98 },     // 6  HIP 47908 (Ras Elased)
  { name:'Rasalas', ra:148.191, dec:26.007, mag:3.88 },   // 7  HIP 48455
  { name:'Zosma', ra:168.447, dec:20.524, mag:2.56 },     // 8  HIP 54872
]

// Constellation lines
export const VIRGO_LINES = [
  [7, 6], [6, 5], [5, 11], [11, 2],
  [10, 11],
  [2, 0], [0, 4], [4, 13],
  [2, 13],
]

export const LEO_LINES = [
  [5, 1], [1, 7], [7, 6],
  [5, 4], [4, 3],
  [3, 0], [0, 8], [8, 2], [2, 0],
  [8, 5],
]

// ── Kepler Solver (Newton-Raphson) ──

function solveKepler(M, e) {
  let E = M
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-8) break
  }
  return E
}

// ── Heliocentric Position (with century rates) ──

export function heliocentricPos(el, jd) {
  const T = (jd - D) / 36525.0

  const a = el.a + el.a_dot * T
  const e = el.e + el.e_dot * T
  const I = (el.I + el.I_dot * T) * D2R
  const L = (el.L + el.L_dot * T) * D2R
  const ϖ = (el.ϖ + el.ϖ_dot * T) * D2R
  const Ω = (el.Ω + el.Ω_dot * T) * D2R

  const M = L - ϖ
  const E = solveKepler(M, e)

  const ν = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
  const r = a * (1 - e * Math.cos(E))

  const x_orb = r * Math.cos(ν)
  const y_orb = r * Math.sin(ν)

  const cosΩ = Math.cos(Ω), sinΩ = Math.sin(Ω)
  const cosI = Math.cos(I), sinI = Math.sin(I)
  const cosϖ_Ω = Math.cos(ϖ - Ω), sinϖ_Ω = Math.sin(ϖ - Ω)

  const xh = x_orb * (cosϖ_Ω * cosΩ - sinϖ_Ω * sinΩ * cosI) -
             y_orb * (sinϖ_Ω * cosΩ + cosϖ_Ω * sinΩ * cosI)
  const yh = x_orb * (cosϖ_Ω * sinΩ + sinϖ_Ω * cosΩ * cosI) -
             y_orb * (sinϖ_Ω * sinΩ - cosϖ_Ω * cosΩ * cosI)
  const zh = x_orb * sinϖ_Ω * sinI + y_orb * cosϖ_Ω * sinI

  return { x: xh, y: yh, z: zh }
}

// ── Geocentric Ra/Dec ──

export function geocentricRaDec(planetHelio, earthHelio) {
  const dx = planetHelio.x - earthHelio.x
  const dy = planetHelio.y - earthHelio.y
  const dz = planetHelio.z - earthHelio.z

  const ce = Math.cos(ECL_OBLIQUITY), se = Math.sin(ECL_OBLIQUITY)
  const xeq = dx
  const yeq = dy * ce - dz * se
  const zeq = dy * se + dz * ce

  const ra = Math.atan2(yeq, xeq)
  const dec = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq))
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return { ra, dec, dist }
}

// ── Planet Position ──

export function getPlanetRaDec(name, jd) {
  const el = PLANETS[name]
  if (!el) return null
  const earthPos = heliocentricPos(PLANETS.earth, jd)
  const planetPos = heliocentricPos(el, jd)
  return geocentricRaDec(planetPos, earthPos)
}

// ── Sun Position ──

export function getSunRaDec(jd) {
  const earthPos = heliocentricPos(PLANETS.earth, jd)
  const ce = Math.cos(ECL_OBLIQUITY), se = Math.sin(ECL_OBLIQUITY)
  const xeq = -earthPos.x
  const yeq = -earthPos.y * ce - (-earthPos.z) * se
  const zeq = -earthPos.y * se + (-earthPos.z) * ce
  const ra = Math.atan2(yeq, xeq)
  const dec = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq))
  return { ra, dec }
}

// ── Moon Position (ELP2000 — 21 longitude terms, 5 latitude terms) ──

export function getMoonRaDec(jd) {
  const T = (jd - D) / 36525.0

  const L_moon = 218.3164477 + 481267.88123421 * T
  const M_moon = 134.9633964 + 477198.8675055 * T
  const M_sun  = 357.5291092 + 35999.0502909 * T
  const D_moon = 297.8501921 + 445267.1114034 * T
  const F      = 93.2720950 + 483202.0175233 * T

  const Mrad = M_moon * D2R, Srad = M_sun * D2R
  const Drad = D_moon * D2R, Frad = F * D2R

  // Ecliptic longitude (21 periodic terms)
  let λ = L_moon
    + 6.2888 * Math.sin(Mrad)
    + 1.2740 * Math.sin(2*Drad - Mrad)
    + 0.6583 * Math.sin(2*Drad)
    + 0.2136 * Math.sin(2*Mrad)
    - 0.1856 * Math.sin(Drad)
    + 0.1143 * Math.sin(2*Frad)
    - 0.0588 * Math.sin(2*Drad - 2*Mrad)
    + 0.0572 * Math.sin(2*Drad - Mrad - Srad)
    + 0.0533 * Math.sin(2*Drad + Mrad)
    + 0.0459 * Math.sin(2*Drad - Srad)
    - 0.0410 * Math.sin(Mrad - Srad)
    - 0.0348 * Math.sin(Drad - Mrad)
    - 0.0308 * Math.sin(2*Drad - 2*Frad)
    - 0.0153 * Math.sin(2*Drad - Mrad - 2*Frad)
    + 0.0106 * Math.sin(2*Drad + Mrad - Srad)
    + 0.0103 * Math.sin(2*Drad - Mrad + Srad)
    - 0.0091 * Math.sin(Mrad + Srad)
    - 0.0089 * Math.sin(Drad + Mrad)
    - 0.0069 * Math.sin(2*Frad - Mrad)
    + 0.0056 * Math.sin(2*Drad - 2*Mrad + Srad)

  // Ecliptic latitude (5 periodic terms)
  let β = 5.128 * Math.sin(Frad)
    + 0.2806 * Math.sin(Mrad + Frad)
    + 0.2777 * Math.sin(Mrad - Frad)
    + 0.1721 * Math.sin(2*Drad - Frad)
    + 0.0554 * Math.sin(2*Drad - Mrad - Frad)

  // Distance (Earth radii)
  let Δ = 60.2666
    - 3.4121 * Math.cos(Mrad)
    - 1.0874 * Math.cos(2*Drad - Mrad)
    - 0.1169 * Math.cos(2*Drad)
    - 0.0649 * Math.cos(2*Mrad)
    - 0.0244 * Math.cos(2*Drad - 2*Mrad)
    + 0.0200 * Math.cos(Mrad - Srad)

  // Convert ecliptic to equatorial
  const λrad = λ * D2R
  const βrad = β * D2R

  const x = Δ * Math.cos(βrad) * Math.cos(λrad)
  const y = Δ * (Math.cos(βrad) * Math.sin(λrad) * Math.cos(ECL_OBLIQUITY) - Math.sin(βrad) * Math.sin(ECL_OBLIQUITY))
  const z = Δ * (Math.cos(βrad) * Math.sin(λrad) * Math.sin(ECL_OBLIQUITY) + Math.sin(βrad) * Math.cos(ECL_OBLIQUITY))

  const ra = Math.atan2(y, x)
  const dec = Math.atan2(z, Math.sqrt(x*x + y*y))
  return { ra, dec, dist: Δ }
}

// ── Coordinate Conversion ──

export function raDecToCartesian(raDeg, decDeg, r = SPHERE_R) {
  const ra = raDeg * D2R, dec = decDeg * D2R
  return new THREE.Vector3(
    r * Math.cos(dec) * Math.cos(ra),
    r * Math.sin(dec),
    r * Math.cos(dec) * Math.sin(ra)
  )
}

// ── Julian Date → Calendar ──

export function jdToDate(jd) {
  const j = jd + 0.5
  const z = Math.floor(j)
  const f = j - z
  let a
  if (z < 2299161) a = z
  else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25)
    a = z + 1 + alpha - Math.floor(alpha / 4)
  }
  const b = a + 1524
  const c = Math.floor((b - 122.1) / 365.25)
  const dd = Math.floor(365.25 * c)
  const e = Math.floor((b - dd) / 30.6001)
  const day = b - dd - Math.floor(30.6001 * e) + f
  let month = e < 14 ? e - 1 : e - 13
  let year = month > 2 ? c - 4716 : c - 4715
  const dayInt = Math.floor(day)
  const frac = day - dayInt
  const hours = Math.floor(frac * 24)
  const mins = Math.floor((frac * 24 - hours) * 60)
  return { year, month, day: dayInt, hours, mins }
}

export function formatDate(jd) {
  const d = jdToDate(jd)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year}`
}

export function formatDateTime(jd) {
  const d = jdToDate(jd)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year} ${String(d.hours).padStart(2,'0')}:${String(d.mins).padStart(2,'0')}`
}

// ── Timeline Constants ──

export const SIGN_JD = 2458020.0         // Sep 23, 2017
export const CONCEPTION_JD = 2457697.0   // ~Nov 20, 2016 (Jupiter enters Virgo)
export const START_JD = 2457665.0        // ~Oct 20, 2016 (12 months before sign)
export const END_JD = 2458118.0          // Dec 2017
export const TRAIL_START = 2457570.5     // Jupiter trail start
export const TRAIL_END = 2458230.5       // Jupiter trail end

// ── Alignment Scoring ──

export function computeAlignmentScore(jd) {
  let score = 0

  const sunRd = getSunRaDec(jd)
  const sunRa = ((sunRd.ra * R2D) % 360 + 360) % 360
  if (sunRa >= 150 && sunRa <= 186) score += 3

  const moonRd = getMoonRaDec(jd)
  const moonDec = moonRd.dec * R2D
  if (moonDec < -8) score += 2

  const jupRd = getPlanetRaDec('jupiter', jd)
  const jupRa = jupRd ? ((jupRd.ra * R2D) % 360) % 360 : 0
  if (jupRa >= 150 && jupRa <= 186) score += 3

  let planetsInLeo = 0
  for (const name of ['mercury', 'venus', 'mars', 'saturn']) {
    const prd = getPlanetRaDec(name, jd)
    if (!prd) continue
    const ra = ((prd.ra * R2D) % 360 + 360) % 360
    if (ra >= 120 && ra <= 150) planetsInLeo++
  }
  score += Math.min(planetsInLeo, 3) * 1.5

  return score
}
