export interface AnalyticsEvent {
  id: string
  created_at: string
  event_name: string
  page_url: string
  session_id: string
  metadata: Record<string, unknown>
}

export interface Subscriber {
  id: string
  email: string
  name: string | null
  status: 'active' | 'unsubscribed' | 'bounced'
  created_at: string
  tags: string[]
}

export interface MediaItem {
  id: string
  name: string
  url: string
  size: number
  type: string
  created_at: string
  product_id: string | null
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  created_at: string
  published: boolean
}
