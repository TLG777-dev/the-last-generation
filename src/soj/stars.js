// Sign of Jonah — Star Rendering Module
// Inward-facing celestial sphere, magnitude-scaled stars, constellation lines

import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { SPHERE_R, STARS_VIRGO, STARS_LEO, VIRGO_LINES, LEO_LINES, raDecToCartesian } from './engine.js'

const CYAN = 0x66CCFF
const BLUE = 0x4A8FE4
const ICE_BLUE = 0x99BBFF

// ── Background Stars (Random Scatter) ──

export function createBackgroundStars(scene, count = 3000) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = SPHERE_R * (0.97 + Math.random() * 0.03)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    sizes[i] = 0.2 + Math.random() * 0.6
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.PointsMaterial({
    color: 0xE8E0D0,
    size: 0.5,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite: false,
  })

  const stars = new THREE.Points(geo, mat)
  scene.add(stars)
  return stars
}

// ── Constellation Renderer ──

export function createConstellation(scene, stars, lines, color, label, starScale = 1) {
  const group = new THREE.Group()

  // Star materials — bright white cores, visible glow
  const starMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1.0 })
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xAACCFF, transparent: true, opacity: 0.35, side: THREE.DoubleSide })

  // Render stars — larger and brighter to match Clarke's video
  stars.forEach((s) => {
    const pos = raDecToCartesian(s.ra, s.dec, SPHERE_R)
    // Brighter stars (lower mag) get bigger dots — range ~0.6 to 2.0
    const magScale = Math.max(0.6, 2.0 - s.mag * 0.2) * starScale

    // Star core — white dot
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5 * magScale, 12, 12), starMat.clone())
    core.position.copy(pos)
    group.add(core)

    // Star glow — soft halo
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.0 * magScale, 12, 12), glowMat.clone())
    glow.position.copy(pos)
    group.add(glow)

    // Star label — offset to right/below
    const labelDiv = document.createElement('div')
    labelDiv.textContent = s.name
    labelDiv.className = 'star-label'
    const labelObj = new CSS2DObject(labelDiv)
    labelObj.position.copy(pos.clone().multiplyScalar(1.015))
    labelObj.position.y += 2.0
    group.add(labelObj)
  })

  // Constellation lines — soft ice blue, dual-layer glow (artistic style)
  lines.forEach(([i, j]) => {
    if (i < stars.length && j < stars.length) {
      const p1 = raDecToCartesian(stars[i].ra, stars[i].dec, SPHERE_R)
      const p2 = raDecToCartesian(stars[j].ra, stars[j].dec, SPHERE_R)
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2])

      // Outer glow — soft, wide, behind
      const glowMat = new THREE.LineBasicMaterial({
        color: ICE_BLUE,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
      const glow = new THREE.Line(geo.clone(), glowMat)
      group.add(glow)

      // Main line — thin, ice blue
      const lineMat = new THREE.LineBasicMaterial({
        color: ICE_BLUE,
        transparent: true,
        opacity: 0.40,
      })
      const line = new THREE.Line(geo.clone(), lineMat)
      group.add(line)
    }
  })

  // Constellation label
  const labelDiv = document.createElement('div')
  labelDiv.textContent = label
  labelDiv.className = 'constellation-label'
  const center = new THREE.Vector3()
  let cx = 0, cy = 0, cz = 0, count = 0
  stars.forEach(s => {
    const p = raDecToCartesian(s.ra, s.dec, SPHERE_R)
    cx += p.x; cy += p.y; cz += p.z; count++
  })
  center.set(cx / count, cy / count, cz / count).normalize().multiplyScalar(SPHERE_R * 1.08)
  const labelObj = new CSS2DObject(labelDiv)
  labelObj.position.copy(center)
  group.add(labelObj)

  scene.add(group)
  return group
}

// ── Horizon Ring ──

export function createHorizonRing(scene) {
  const segments = 80
  const points = []
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(
      SPHERE_R * 0.92 * Math.cos(angle),
      -5,
      SPHERE_R * 0.92 * Math.sin(angle)
    ))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: BLUE,
    transparent: true,
    opacity: 0.06,
  })
  const ring = new THREE.Line(geo, mat)
  scene.add(ring)
  return ring
}

// ── Constellation Line Color Update (for mode switching) ──

export function updateConstellationColors(groups, isScientific) {
  groups.forEach(group => {
    group.traverse(child => {
      if (child.isLine && child.material) {
        if (isScientific) {
          child.material.color.setHex(CYAN)
          child.material.opacity = child.material.opacity > 0.1 ? 0.55 : 0.18
        } else {
          child.material.color.setHex(ICE_BLUE)
          child.material.opacity = child.material.opacity > 0.1 ? 0.40 : 0.12
        }
      }
    })
  })
}
