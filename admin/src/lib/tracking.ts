/**
 * Tracking script for public pages.
 *
 * Usage: Add this script to your HTML pages:
 *   <script src="/src/tracker.js" data-supabase-url="https://..." data-supabase-key="..." defer></script>
 *
 * This creates a `window.__track` function and a `data-tlg-track` attribute
 * handler for automatic click tracking.
 */

const SUPABASE_URL = document.currentScript?.getAttribute('data-supabase-url') || ''
const SUPABASE_KEY = document.currentScript?.getAttribute('data-supabase-key') || ''

interface TrackEvent {
  event_name: string
  page_url: string
  metadata?: Record<string, unknown>
}

async function sendEvent(event: TrackEvent) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return

  const sessionId = getSessionId()
  const payload = {
    ...event,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/events`
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // silent fail
  }
}

function getSessionId(): string {
  let id = sessionStorage.getItem('tlg_session')
  if (!id) {
    id = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    sessionStorage.setItem('tlg_session', id)
  }
  return id
}

// Track page view
sendEvent({
  event_name: 'pageview',
  page_url: window.location.pathname,
})

// Auto-track clicks on elements with data-tlg-track attribute
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement)?.closest('[data-tlg-track]') as HTMLElement | null
  if (!el) return
  const name = el.getAttribute('data-tlg-track') || 'click'
  sendEvent({
    event_name: name,
    page_url: window.location.pathname,
    metadata: { text: el.textContent?.trim().slice(0, 80) },
  })
})

// Expose track function globally
;(window as any).__track = sendEvent
