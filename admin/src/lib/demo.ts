import type { AnalyticsEvent, Subscriber, MediaItem } from './types'

// ── Sample page URLs matching the real site ──
const PAGES = [
  '/sign-of-jonah.html', '/apophis.html', '/calendar.html',
  '/conflicts.html', '/disasters.html', '/timeline.html',
  '/aleph-tav.html', '/revelation-walkthrough.html', '/rapture.html',
  '/hebrew-feasts.html', '/library.html', '/glossary.html', '/',
]

// ── Event names matching real tracking attributes ──
const EVENT_NAMES = [
  'pageview', 'cta-explore', 'btn-3d-toggle', 'btn-date-jump',
  'btn-recenter', 'cta-signs-watch', 'nav-rapture', 'nav-timeline',
  'nav-calendar', 'btn-playback', 'btn-speed-change', 'btn-share',
  'footer-link', 'sidebar-nav',
]

// ── Sample subscriber emails/names ──
const SUBSCRIBERS: { email: string; name: string; status: Subscriber['status'] }[] = [
  { email: 'david.moore@gmail.com', name: 'David Moore', status: 'active' },
  { email: 'sarah.jenkins@proton.me', name: 'Sarah Jenkins', status: 'active' },
  { email: 'mike.r@outlook.com', name: 'Mike Reynolds', status: 'active' },
  { email: 'anna.brown@yahoo.com', name: 'Anna Brown', status: 'active' },
  { email: 'tom.wood@icloud.com', name: 'Tom Wood', status: 'active' },
  { email: 'rachel.k@pm.me', name: 'Rachel Kim', status: 'active' },
  { email: 'bounce.user@badmail.com', name: null, status: 'bounced' },
  { email: 'james.c@aol.com', name: 'James Carter', status: 'active' },
  { email: 'lisa.m@web.de', name: 'Lisa Müller', status: 'active' },
  { email: 'unsub.me@spam.com', name: 'Unsub Me', status: 'unsubscribed' },
  { email: 'pastor.dan@gmail.com', name: 'Dan Williams', status: 'active' },
  { email: 'elena.study@proton.me', name: 'Elena Torres', status: 'active' },
  { email: 'ben.h@pm.me', name: 'Ben Harris', status: 'active' },
  { email: 'claire.reads@outlook.com', name: 'Claire Adams', status: 'active' },
  { email: 'recent.fan@gmail.com', name: 'Nathan Park', status: 'active' },
]

// ── Placeholder media items ──
const MEDIA_ITEMS: MediaItem[] = [
  { id: '1', name: 'TLG-Logo-Gold.png', url: '', size: 12400, type: 'image/png', created_at: '2026-05-28T10:00:00Z', product_id: null },
  { id: '2', name: 'apophis-trajectory-2029.webp', url: '', size: 58300, type: 'image/webp', created_at: '2026-05-25T14:30:00Z', product_id: null },
  { id: '3', name: 'rev12-sign-illustration.png', url: '', size: 92100, type: 'image/png', created_at: '2026-05-22T09:15:00Z', product_id: null },
  { id: '4', name: 'prophetic-timeline-chart.svg', url: '', size: 1800, type: 'image/svg+xml', created_at: '2026-05-20T16:45:00Z', product_id: null },
  { id: '5', name: 'shemitah-calendar-2026.png', url: '', size: 45600, type: 'image/png', created_at: '2026-05-18T11:00:00Z', product_id: null },
  { id: '6', name: 'moon-signature-dates.jpg', url: '', size: 33200, type: 'image/jpeg', created_at: '2026-05-15T08:20:00Z', product_id: null },
]

let nextId = MEDIA_ITEMS.length + 1

// ── Generate mock events ──
function generateEvents(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = []
  const now = Date.now()
  const day = 86400000

  for (let i = 0; i < 25; i++) {
    const offset = Math.floor(Math.random() * 7) * day + Math.floor(Math.random() * day)
    events.push({
      id: String(100 + i),
      created_at: new Date(now - offset).toISOString(),
      event_name: EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)],
      page_url: PAGES[Math.floor(Math.random() * PAGES.length)],
      session_id: `sess_${Math.random().toString(36).slice(2, 10)}`,
      metadata: Math.random() > 0.5
        ? { text: 'Explore the signs', position: 'hero' }
        : { button_id: 'cta-main', variant: Math.random() > 0.5 ? 'primary' : 'secondary' },
    })
  }

  return events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

// ── In-memory mutable copies for demo CRUD ──
let demoEvents = generateEvents()
let demoSubscribers = SUBSCRIBERS.map((s, i) => ({
  id: String(200 + i),
  email: s.email,
  name: s.name,
  status: s.status as Subscriber['status'],
  created_at: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString(),
  tags: [] as string[],
}))
let demoMedia = MEDIA_ITEMS.map(m => ({
  ...m,
  url: `https://placehold.co/400x300/1a1a28/c9a84c?text=${encodeURIComponent(m.name.replace(/\.[^.]+$/, ''))}`,
}))

// ── Demo API (mirrors Supabase usage) ──
export const demo = {
  getDashboardStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    const eventsToday = demoEvents.filter(e => e.created_at >= todayStr).length
    const uniquePages = new Set(demoEvents.map(e => e.page_url)).size
    const pageCounts = new Map<string, number>()
    for (const e of demoEvents) {
      const url = e.page_url || '/'
      pageCounts.set(url, (pageCounts.get(url) || 0) + 1)
    }
    return {
      eventsToday,
      uniqueVisitors: uniquePages,
      totalEvents: demoEvents.length,
      subscriberCount: demoSubscribers.filter(s => s.status === 'active').length,
      topPages: [...pageCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([url, count]) => ({ url, count })),
      recentEvents: eventsToday,
    }
  },

  getEvents(filter = ''): AnalyticsEvent[] {
    if (!filter) return demoEvents
    return demoEvents.filter(e =>
      e.event_name.toLowerCase().includes(filter.toLowerCase())
    )
  },

  clearEvents() {
    demoEvents = []
  },

  getMedia(): MediaItem[] {
    return demoMedia
  },

  addMedia(file: { name: string; type: string; size: number }) {
    const item: MediaItem = {
      id: String(nextId++),
      name: file.name,
      url: `https://placehold.co/400x300/1a1a28/c9a84c?text=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ''))}`,
      size: file.size,
      type: file.type,
      created_at: new Date().toISOString(),
      product_id: null,
    }
    demoMedia = [item, ...demoMedia]
    return item
  },

  removeMedia(name: string) {
    demoMedia = demoMedia.filter(m => m.name !== name)
  },

  getSubscribers(): Subscriber[] {
    return demoSubscribers
  },

  addSubscriber(email: string, name: string) {
    const sub: Subscriber = {
      id: String(nextId++),
      email,
      name: name || null,
      status: 'active',
      created_at: new Date().toISOString(),
      tags: [],
    }
    demoSubscribers = [sub, ...demoSubscribers]
    return sub
  },

  removeSubscriber(id: string) {
    demoSubscribers = demoSubscribers.filter(s => s.id !== id)
  },
}
