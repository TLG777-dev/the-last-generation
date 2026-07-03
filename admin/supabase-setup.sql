-- Supabase setup for The Last Generation admin dashboard
-- Run these SQL statements in your Supabase SQL editor

-- 1. Events table (click/pageview tracking)
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_name TEXT NOT NULL DEFAULT 'pageview',
  page_url TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);

-- Enable RLS on events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for tracking script)
CREATE POLICY "Allow anonymous inserts" ON events
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow authenticated reads (admin dashboard)
CREATE POLICY "Allow authenticated reads" ON events
  FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated deletes (admin dashboard)
CREATE POLICY "Allow authenticated deletes" ON events
  FOR DELETE TO authenticated
  USING (true);

-- 2. Subscribers table (email management)
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated all" ON subscribers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Products table (optional, for future product management)
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  image_url TEXT,
  published BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated all products" ON products
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Media bucket (run in Storage section)
-- Create bucket: Go to Storage > Create bucket > name: "media" > public
