/* ── Weekly Digest — Live Data Feed ── */
(function () {
  const $ = s => document.querySelector(s)
  const $$ = s => document.querySelectorAll(s)

  const now = new Date()
  let period = 'week'

  function getDateRange () {
    const end = new Date(now)
    const start = new Date(now)
    if (period === 'week') {
      start.setDate(now.getDate() - 7)
    } else if (period === 'lastweek') {
      end.setDate(now.getDate() - 7)
      start.setDate(now.getDate() - 14)
    } else {
      start.setDate(now.getDate() - 30)
    }
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      startLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      endLabel: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  function fmtDate (ts) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function clamp (v, min, max) { return Math.max(min, Math.min(max, v)) }

  /* ── Earthquakes (USGS) ── */
  async function fetchEarthquakes (start, end) {
    try {
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&minmagnitude=5&orderby=time&limit=50`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('USGS fetch failed')
      const data = await resp.json()
      return (data.features || []).map(f => {
        const p = f.properties
        return {
          mag: p.mag,
          place: p.place || 'Unknown location',
          time: p.time,
          depth: f.geometry.coordinates[2],
          url: p.url
        }
      })
    } catch (e) {
      console.warn('Earthquake fetch failed:', e)
      return []
    }
  }

  function renderEarthquakes (quakes) {
    const card = $('#dgEarthquakes')
    const items = $('#dgEqItems')
    const count = $('#dgEqCount')
    if (!quakes.length) { card.style.display = 'none'; return }

    card.style.display = 'block'
    count.textContent = `M5+ · ${quakes.length} events`
    items.innerHTML = quakes.slice(0, 8).map(q => {
      const color = q.mag >= 6 ? 'var(--dg-red)' : q.mag >= 5.5 ? 'var(--dg-amber)' : 'var(--dg-amber)'
      return `<div class="dg-feed-item">
        <div class="dg-feed-item-dot" style="background:${color};"></div>
        <div class="dg-feed-item-text">M${q.mag.toFixed(1)} — ${q.place}. Depth ${Math.round(q.depth)}km.</div>
        <span class="dg-feed-item-meta">${fmtDate(q.time)}</span>
      </div>`
    }).join('')
  }

  /* ── EONET Disasters ── */
  async function fetchDisasters (start, end) {
    try {
      const categories = 'wildfires,severeStorms,volcanoes,floods,drought,earthquakes,seaAndLakeIce'
      const openResp = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=open&limit=30`)
      const openData = openResp.ok ? await openResp.json() : { features: [] }

      let closedData = { features: [] }
      if (period !== 'week') {
        const closedResp = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=closed&start=${start}&end=${end}&limit=30`)
        if (closedResp.ok) closedData = await closedResp.json()
      }

      const all = [...(openData.features || []), ...(closedData.features || [])]
      const seen = new Set()
      return all.filter(f => {
        if (seen.has(f.id)) return false
        seen.add(f.id)
        return true
      }).map(f => {
        const p = f.properties
        return {
          title: p.title,
          category: p.categories?.[0]?.title || 'Event',
          date: p.date,
          status: p.geometry ? 'active' : 'closed'
        }
      })
    } catch (e) {
      console.warn('EONET fetch failed:', e)
      return []
    }
  }

  function renderDisasters (events) {
    const card = $('#dgDisasters')
    const items = $('#dgDisItems')
    const count = $('#dgDisCount')
    if (!events.length) { card.style.display = 'none'; return }

    card.style.display = 'block'
    count.textContent = `EONET · ${events.length} events`
    items.innerHTML = events.slice(0, 6).map(e => {
      const color = e.category === 'Wildfires' ? 'var(--dg-amber)'
        : e.category === 'Volcanoes' ? 'var(--dg-red)'
        : 'var(--dg-amber)'
      const dateStr = e.date ? fmtDate(new Date(e.date).getTime()) : ''
      return `<div class="dg-feed-item">
        <div class="dg-feed-item-dot" style="background:${color};"></div>
        <div class="dg-feed-item-text">${e.title}</div>
        <span class="dg-feed-item-meta">${dateStr || e.category}</span>
      </div>`
    }).join('')
  }

  /* ── Fireballs (JPL) ── */
  async function fetchFireballs (start, end) {
    try {
      const apiUrl = `/api/fireball?limit=200&date-min=${start}&date-max=${end}`
      const resp = await fetch(apiUrl)
      if (!resp.ok) throw new Error('Fireball fetch failed')
      const data = await resp.json()
      return (data.data || []).map(e => ({
        date: e.date || e.calDate,
        energy: e.energy ? (e.energy / 1e10).toFixed(1) : '?',
        vel: e.vel ? e.vel.toFixed(10) : '?',
        lat: e.lat,
        lon: e.lon
      }))
    } catch (e) {
      console.warn('Fireball fetch failed:', e)
      return []
    }
  }

  function renderFireballs (fireballs) {
    const card = $('#dgFireballs')
    const items = $('#dgFbItems')
    const count = $('#dgFbCount')
    if (!fireballs.length) { card.style.display = 'none'; return }

    card.style.display = 'block'
    count.textContent = `JPL · ${fireballs.length} events`
    items.innerHTML = fireballs.slice(0, 5).map(f => {
      const dateStr = f.date ? f.date.replace(/\//g, '-') : 'Unknown'
      return `<div class="dg-feed-item">
        <div class="dg-feed-item-dot" style="background:var(--dg-blue);"></div>
        <div class="dg-feed-item-text">Fireball — Energy ${f.energy}×10¹⁰ J, velocity ${f.vel} km/s. Location: ${f.lat?.toFixed(1)}°N, ${f.lon?.toFixed(1)}°E.</div>
        <span class="dg-feed-item-meta">${dateStr}</span>
      </div>`
    }).join('')
  }

  /* ── Apophis (JPL SBDB) ── */
  async function fetchApophis () {
    try {
      const resp = await fetch('/api/jpl-sbdb?sstr=99942&phys-par=1&ca-data=1')
      if (!resp.ok) throw new Error('JPL SBDB fetch failed')
      const data = await resp.json()
      const orbits = data.orbits?.[0]?.elements
      const phys = data.phys_par
      return { orbits, phys, count: data.count }
    } catch (e) {
      console.warn('Apophis fetch failed:', e)
      return null
    }
  }

  function renderApophis (apo) {
    const card = $('#dgApophis')
    const items = $('#dgApoItems')
    if (!apo) { card.style.display = 'none'; return }

    card.style.display = 'block'
    let html = ''

    if (apo.phys) {
      const h = apo.phys
      html += `<div class="dg-feed-item">
        <div class="dg-feed-item-dot" style="background:var(--dg-gold);"></div>
        <div class="dg-feed-item-text">Absolute magnitude: ${h.H || 'N/A'}. Estimated diameter: ${h.diameter ? (h.diameter).toFixed(0) + 'm' : 'N/A'}.</div>
        <span class="dg-feed-item-meta">JPL</span>
      </div>`
    }

    html += `<div class="dg-feed-item">
      <div class="dg-feed-item-dot" style="background:var(--dg-gold);"></div>
      <div class="dg-feed-item-text">Nominal trajectory confirms April 13, 2029 flyby at ~31,000 km altitude. Potentially Hazardous Asteroid.</div>
      <span class="dg-feed-item-meta">JPL</span>
    </div>`

    items.innerHTML = html
  }

  /* ── Period Toggle ── */
  function initPeriodNav () {
    $$('.dg-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.dg-period-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        period = btn.dataset.period
        loadAll()
      })
    })
  }

  /* ── Main Load ── */
  async function loadAll () {
    const range = getDateRange()
    $('#dgDateBanner').textContent = `${range.startLabel} – ${range.endLabel}`
    $('#dgLoading').style.display = 'flex'

    const [quakes, disasters, fireballs, apophis] = await Promise.all([
      fetchEarthquakes(range.start, range.end),
      fetchDisasters(range.start, range.end),
      fetchFireballs(range.start, range.end),
      fetchApophis()
    ])

    $('#dgLoading').style.display = 'none'

    renderEarthquakes(quakes)
    renderDisasters(disasters)
    renderFireballs(fireballs)
    renderApophis(apophis)
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    initPeriodNav()
    loadAll()
  })
})()
