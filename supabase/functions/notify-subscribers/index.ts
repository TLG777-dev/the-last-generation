import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || ""
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") || "alerts@thelastgeneration.com"

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

interface Rule {
  id: number
  name: string
  event_types: string[]
  min_magnitude: number
  min_events: number
  time_window_hours: number
  channel: string
  active: boolean
}

Deno.serve(async () => {
  const startTime = Date.now()
  const results: { rule: string; matched: number; sent: number; error?: string }[] = []

  try {
    const { data: rules, error: rulesErr } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("active", true)

    if (rulesErr) throw new Error(`Failed to fetch rules: ${rulesErr.message}`)
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active rules", results }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    for (const rule of rules as Rule[]) {
      const since = new Date(Date.now() - rule.time_window_hours * 3600000).toISOString()

      let query = supabase
        .from("disaster_events")
        .select("*")
        .gte("event_timestamp", since)
        .order("event_timestamp", { ascending: false })

      if (rule.event_types && rule.event_types.length > 0) {
        query = query.in("event_type", rule.event_types)
      }

      if (rule.min_magnitude > 0) {
        query = query.gte("magnitude", rule.min_magnitude)
      }

      const { data: events, error: evtErr } = await query
      if (evtErr) {
        results.push({ rule: rule.name, matched: 0, sent: 0, error: evtErr.message })
        continue
      }

      if (!events || events.length < rule.min_events) {
        results.push({ rule: rule.name, matched: events?.length || 0, sent: 0 })
        continue
      }

      // Check log to avoid re-notifying
      const eventIds = events.map((e: any) => e.source_id)
      const { data: alreadySent } = await supabase
        .from("notification_log")
        .select("event_ids")
        .eq("rule_id", rule.id)
        .contains("event_ids", eventIds)

      if (alreadySent && alreadySent.length > 0) {
        results.push({ rule: rule.name, matched: events.length, sent: 0, error: "Already notified" })
        continue
      }

      let sent = 0
      if (rule.channel === "email" && RESEND_KEY) {
        sent = await sendEmailNotification(rule, events) ? 1 : 0
      }

      await supabase.from("notification_log").insert({
        rule_id: rule.id,
        event_ids: eventIds.slice(0, 50),
        channel: rule.channel,
        status: sent ? "sent" : "error",
        error: sent ? null : "Send failed or no email provider configured",
      })

      results.push({ rule: rule.name, matched: events.length, sent })
    }
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({
    success: true,
    duration_ms: Date.now() - startTime,
    results,
  }), {
    headers: { "Content-Type": "application/json" },
  })
})

async function sendEmailNotification(rule: Rule, events: any[]): Promise<boolean> {
  const typeIcons: Record<string, string> = {
    earthquake: "🌍", flood: "🌊", cyclone: "🌀", volcano: "🌋", wildfire: "🔥", fireball: "☄",
  }

  const eventList = events.slice(0, 10).map((e: any) => {
    const icon = typeIcons[e.event_type] || "⚠️"
    const loc = e.lat && e.lng ? `(${e.lat.toFixed(1)}, ${e.lng.toFixed(1)})` : ""
    const mag = e.magnitude ? ` M${e.magnitude.toFixed(1)}` : ""
    return `${icon} ${e.title}${mag} ${loc}`
  }).join("\n")

  const html = `
<h2>🔔 ${rule.name}</h2>
<p>${events.length} event(s) triggered in the last ${rule.time_window_hours}h:</p>
<pre style="font-family:monospace;background:#1a1a2e;color:#e0e0e0;padding:1em;border-radius:8px;">${eventList}</pre>
<p style="color:#888;font-size:0.85em;">— The Last Generation Watch</p>
  `.trim()

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: "subscribers@thelastgeneration.com",
        subject: `🔔 Alert: ${rule.name} — ${events.length} event(s)`,
        html,
      }),
    })
    return resp.ok
  } catch {
    return false
  }
}
