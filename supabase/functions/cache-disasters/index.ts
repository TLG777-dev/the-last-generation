import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const KVERT_COORDS: Record<string, { lat: number; lng: number }> = {
  sheveluch:       { lat: 56.653, lng: 161.36 },
  bezymianny:      { lat: 55.972, lng: 160.595 },
  krasheninnikov:  { lat: 54.596, lng: 160.27 },
  kizimen:         { lat: 55.131, lng: 160.32 },
  klyuchevskoy:    { lat: 56.056, lng: 160.642 },
  karymsky:        { lat: 54.048, lng: 159.443 },
  zhupanovsky:     { lat: 53.591, lng: 159.148 },
  avachinsky:      { lat: 53.256, lng: 158.836 },
  koryaksky:       { lat: 53.321, lng: 158.688 },
  mutnovsky:       { lat: 52.449, lng: 158.195 },
  gorely:          { lat: 52.559, lng: 158.03 },
  alaid:           { lat: 50.861, lng: 155.565 },
  ebeko:           { lat: 50.686, lng: 156.014 },
  chikurachki:     { lat: 50.324, lng: 155.457 },
  sarichev:        { lat: 48.091, lng: 153.202 },
  raikoke:         { lat: 48.293, lng: 153.25 },
}

interface DisasterEvent {
  source_id: string
  source: string
  event_type: string
  title: string
  description: string
  lat: number
  lng: number
  magnitude: number
  depth: number
  event_timestamp: string
  url: string
  color: string
  metadata: Record<string, unknown>
}

function parseKVRTimestamp(str: string): number {
  const m = str.match(/(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z/)
  if (!m) return Date.now()
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])).getTime()
}

async function fetchKVERT(): Promise<DisasterEvent[]> {
  const results: DisasterEvent[] = []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch("http://kvert.febras.net/van/index?type=6", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheLastGeneration/1.0)" },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) throw new Error(`KVERT returned ${resp.status}`)
    const html = await resp.text()

    const tdMatch = html.match(/<td\s+valign="top">([\s\S]*?)<\/td>/i)
    if (tdMatch) {
      const body = tdMatch[1]
        .replace(/<strong>[\s\S]*?<\/strong>/i, "")
        .replace(/<\/?br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .trim()
      const lines = body.split("\n").map(l => l.trim()).filter(Boolean)
      let volcano = "", lat = 0, lng = 0, colour = "", ashHgt = 0, ts = 0
      for (const line of lines) {
        if (line.startsWith("VOLCANO:")) {
          const parts = line.replace("VOLCANO:", "").trim().split(/\s+/)
          volcano = parts.slice(0, -1).join(" ")
        } else if (line.startsWith("PSN:")) {
          const ps = line.replace("PSN:", "").trim()
          const m = ps.match(/N(\d{2})(\d{2})\s+E(\d{3})(\d{2})/)
          if (m) { lat = +m[1] + +m[2] / 60; lng = +m[3] + +m[4] / 60 }
        } else if (line.startsWith("CURRENT COLOUR CODE:")) {
          colour = line.split(":").slice(1).join(":").trim()
        } else if (line.startsWith("VA CLD HGT:")) {
          const h = line.replace("VA CLD HGT:", "").trim()
          const hm = h.match(/(\d+)/)
          if (hm) ashHgt = +hm[1]
        } else if (line.startsWith("DTG:")) {
          ts = parseKVRTimestamp(line.replace("DTG:", "").trim())
        }
      }
      if (volcano && lat && lng && ts) {
        const ashDesc = ashHgt ? ` — Ash to ${ashHgt >= 1000 ? (ashHgt / 1000).toFixed(1) + " km" : ashHgt + " m"}` : ""
        results.push({
          source_id: `kvert-vona-${ts}`,
          source: "kvert",
          event_type: "volcano",
          title: `${volcano} Volcano, Russia — Code ${colour}${ashDesc}`,
          description: `${volcano} — Aviation Colour Code ${colour}. Eruption ongoing.`,
          lat, lng, magnitude: 0, depth: 0,
          event_timestamp: new Date(ts).toISOString(),
          url: "http://kvert.febras.net",
          color: "#8B5CF6",
          metadata: { colour_code: colour, ash_height_m: ashHgt },
        })
      }
    }

    const liRegex = /<div[^>]*style="cursor:\s*pointer;"[^>]*>([\s\S]*?)<\/div>/gi
    const seen = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = liRegex.exec(html)) !== null) {
      const text = m[1].replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
      if (!text) continue
      const entryMatch = text.match(/(\w+)\s+(\d+),\s+(\d+):(\d+)\s+UTC\s+(.+)/i)
      if (!entryMatch) continue
      const monthStr = entryMatch[1]
      const day = +entryMatch[2]
      const hour = +entryMatch[3]
      const min = +entryMatch[4]
      const vName = entryMatch[5].trim()
      const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
      const mi = months[monthStr.toLowerCase().slice(0, 3)]
      if (mi === undefined) continue
      const vTs = new Date(Date.UTC(new Date().getFullYear(), mi, day, hour, min)).getTime()
      if (isNaN(vTs)) continue
      const key = vName.toLowerCase().replace(/[^a-z]/g, "")
      const coords = KVERT_COORDS[key]
      if (!coords) continue
      const sid = `kvert-${key}-${vTs}`
      if (seen.has(sid)) continue
      seen.add(sid)
      results.push({
        source_id: sid,
        source: "kvert",
        event_type: "volcano",
        title: `${vName} Volcano, Russia — Aviation Notice`,
        description: `KVERT VONA: ${vName} activity.`,
        lat: coords.lat, lng: coords.lng,
        magnitude: 0, depth: 0,
        event_timestamp: new Date(vTs).toISOString(),
        url: "http://kvert.febras.net",
        color: "#8B5CF6",
        metadata: {},
      })
    }
  } catch (e) {
    console.error("KVERT fetch failed:", e)
  }
  return results
}

async function fetchUSGS(): Promise<DisasterEvent[]> {
  const results: DisasterEvent[] = []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=" +
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) +
      "&minmagnitude=4.0&orderby=time",
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!resp.ok) throw new Error(`USGS returned ${resp.status}`)
    const data = await resp.json()
    for (const f of data.features || []) {
      const p = f.properties || {}
      const coords = f.geometry?.coordinates || []
      if (coords.length < 2) continue
      const id = `usgs-${f.id}`
      results.push({
        source_id: id,
        source: "usgs",
        event_type: "earthquake",
        title: p.title || `M${p.mag} earthquake`,
        description: p.place || "",
        lat: coords[1],
        lng: coords[0],
        magnitude: p.mag || 0,
        depth: coords[2] || 0,
        event_timestamp: new Date(p.time).toISOString(),
        url: p.url || "",
        color: "#EF4444",
        metadata: { place: p.place, detail: p.detail },
      })
    }
  } catch (e) {
    console.error("USGS fetch failed:", e)
  }
  return results
}

async function fetchEONET(): Promise<DisasterEvent[]> {
  const results: DisasterEvent[] = []
  try {
    const categories = "volcanoes,wildfires,floods,severeStorms"
    const categoryIdMap: Record<string, string> = {
      volcanoes: "volcano", wildfires: "wildfire",
      floods: "flood", severeStorms: "cyclone",
    }
    const colorMap: Record<string, string> = {
      volcano: "#8B5CF6", wildfire: "#F97316",
      flood: "#3B82F6", cyclone: "#F59E0B",
    }
    const controller1 = new AbortController()
    const t1 = setTimeout(() => controller1.abort(), 15000)
    let openData: any = { features: [] }
    try {
      const r = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=open`, { signal: controller1.signal })
      if (r.ok) openData = await r.json()
    } catch { console.error("EONET open fetch failed") }
    clearTimeout(t1)

    const controller2 = new AbortController()
    const t2 = setTimeout(() => controller2.abort(), 15000)
    let closedData: any = { features: [] }
    try {
      const r = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events/geojson?category=${categories}&status=closed&start=2026-05-01&end=2026-12-31`, { signal: controller2.signal })
      if (r.ok) closedData = await r.json()
    } catch { console.error("EONET closed fetch failed") }
    clearTimeout(t2)

    console.log(`EONET: open=${openData.features?.length || 0} closed=${closedData.features?.length || 0}`)
    const allFeatures = [...(openData.features || []), ...(closedData.features || [])]
    for (const f of allFeatures) {
      const props = f.properties || {}
      const eonetType = (props.categories || [])[0]?.id || ""
      const type = categoryIdMap[eonetType]
      if (!type) continue
      const geo = f.geometry?.geometries?.[0] || f.geometry
      if (!geo) continue
      const raw = geo.coordinates
      if (!Array.isArray(raw) || raw.length < 2) continue
      let lng: number, lat: number
      if (typeof raw[0] === "number") {
        lng = raw[0]; lat = raw[1]
      } else if (Array.isArray(raw[0]) && typeof raw[0][0] === "number") {
        lng = raw[0][0]; lat = raw[0][1]
      } else if (Array.isArray(raw[0]) && Array.isArray(raw[0][0]) && typeof raw[0][0][0] === "number") {
        lng = raw[0][0][0]; lat = raw[0][0][1]
      } else continue
      if (isNaN(lat) || isNaN(lng)) continue
      const time = props.date ? new Date(props.date).getTime() : Date.now()
      const cleanTitle = props.title ? props.title.replace(/<[^>]*>/g, "") : "Unknown event"
      results.push({
        source_id: `eonet-${f.id}`,
        source: "eonet",
        event_type: type,
        title: cleanTitle,
        description: cleanTitle,
        lat,
        lng,
        magnitude: type === "cyclone" ? (props.magnitude || 2) : 0,
        depth: 0,
        event_timestamp: new Date(time).toISOString(),
        url: props.link || props.sources?.[0]?.url || "",
        color: colorMap[type],
        metadata: { closed: props.closed },
      })
    }
  } catch (e) {
    console.error("EONET fetch failed:", e)
  }
  return results
}

async function fetchGDACS(): Promise<DisasterEvent[]> {
  const results: DisasterEvent[] = []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch("https://www.gdacs.org/gdacsapi/api/Events/geteventlist/events4app", { signal: controller.signal })
    clearTimeout(timeout)
    if (!resp.ok) throw new Error(`GDACS returned ${resp.status}`)
    const data = await resp.json()
    const typeMap: Record<string, string> = {
      EQ: "earthquake", TC: "cyclone", FL: "flood", VF: "volcano", WF: "wildfire",
    }
    const colorMap: Record<string, string> = {
      earthquake: "#EF4444", cyclone: "#F59E0B", flood: "#3B82F6", volcano: "#8B5CF6", wildfire: "#F97316",
    }
    for (const f of data.features || []) {
      const p = f.properties || {}
      const coords = f.geometry?.coordinates || []
      if (coords.length < 2) continue
      const rawType = (p.eventtype || "").toUpperCase()
      const type = typeMap[rawType]
      if (!type) continue
      const timeStr = p.todate || p.fromdate || ""
      const time = timeStr ? new Date(timeStr).getTime() : Date.now()
      const mag = p.magnitude || p.severity || 0
      results.push({
        source_id: `gdacs-${p.eventid || Math.random().toString(36).slice(2)}`,
        source: "gdacs",
        event_type: type,
        title: p.name || p.eventtype || "Unknown event",
        description: p.name || "",
        lat: coords[1],
        lng: coords[0],
        magnitude: typeof mag === "number" ? mag : parseFloat(mag) || 0,
        depth: 0,
        event_timestamp: new Date(time).toISOString(),
        url: p.url || "",
        color: colorMap[type],
        metadata: {},
      })
    }
  } catch (e) {
    console.error("GDACS fetch failed:", e)
  }
  return results
}

async function fetchFireballs(): Promise<DisasterEvent[]> {
  const results: DisasterEvent[] = []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch("https://ssd-api.jpl.nasa.gov/fireball.api?limit=200&sort=desc", { signal: controller.signal })
    clearTimeout(timeout)
    if (!resp.ok) throw new Error(`Fireball API returned ${resp.status}`)
    const data = await resp.json()
    for (const row of data.data || []) {
      const date = row[0]
      if (!date) continue
      const ts = new Date(date).getTime()
      const impactE = row[2] ? parseFloat(row[2]) : 0
      const lat = row[3] ? parseFloat(row[3]) * (row[4] === "S" ? -1 : 1) : 0
      const lng = row[5] ? parseFloat(row[5]) * (row[6] === "W" ? -1 : 1) : 0
      results.push({
        source_id: `fb-${date}`,
        source: "fireball",
        event_type: "fireball",
        title: `${impactE >= 1 ? impactE.toFixed(2) + " kt" : (impactE * 1000).toFixed(0) + " t TNT"} impact`,
        description: row[7] ? `Altitude: ${row[7]} km · Velocity: ${row[8] || "?"} km/s` : "Fireball event",
        lat, lng,
        magnitude: impactE,
        depth: row[7] ? parseFloat(row[7]) : 0,
        event_timestamp: new Date(ts).toISOString(),
        url: "https://cneos.jpl.nasa.gov/fireballs/",
        color: "#FF6B35",
        metadata: { velocity: row[8], altitude: row[7] },
      })
    }
  } catch (e) {
    console.error("Fireball fetch failed:", e)
  }
  return results
}

async function upsertBatch(events: DisasterEvent[]): Promise<{ count: number; errors: number }> {
  if (events.length === 0) return { count: 0, errors: 0 }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("disaster_events")
    .upsert(
      events.map(e => ({
        source_id: e.source_id,
        source: e.source,
        event_type: e.event_type,
        title: e.title,
        description: e.description,
        lat: e.lat,
        lng: e.lng,
        magnitude: e.magnitude,
        depth: e.depth,
        event_timestamp: e.event_timestamp,
        url: e.url,
        color: e.color,
        metadata: e.metadata,
        updated_at: now,
      })),
      { onConflict: "source_id", ignoreDuplicates: false }
    )
  if (error) {
    console.error("Batch upsert error:", JSON.stringify(error))
    return { count: 0, errors: events.length }
  }
  return { count: events.length, errors: 0 }
}

Deno.serve(async () => {
  const startTime = Date.now()
  const summaries: { source: string; count: number; error?: string }[] = []

  const allFetches: { name: string; fn: () => Promise<DisasterEvent[]> }[] = [
    { name: "usgs", fn: fetchUSGS },
    { name: "kvert", fn: fetchKVERT },
    { name: "fireball", fn: fetchFireballs },
    { name: "eonet", fn: fetchEONET },
    { name: "gdacs", fn: fetchGDACS },
  ]
  for (const src of allFetches) {
    try {
      const events = await src.fn()
      const upserted = await upsertBatch(events)
      summaries.push({ source: src.name, count: upserted.count, new: 0, error: upserted.errors > 0 ? `${upserted.errors} upsert errors` : undefined })
    } catch (e) {
      summaries.push({ source: src.name, count: 0, new: 0, error: String(e) })
    }
  }

  const duration = Date.now() - startTime
  console.log("Cache run complete:", JSON.stringify(summaries), `duration: ${duration}ms`)

  return new Response(JSON.stringify({
    success: true,
    duration_ms: duration,
    sources: summaries,
  }), {
    headers: { "Content-Type": "application/json" },
  })
})
