#!/usr/bin/env node
/**
 * fireball-tracker.mjs — Daily bolide impact tracker
 *
 * Polls NASA CNEOS Fireball API and reports new atmospheric impacts.
 * Keeps state in fireball-state.json so it only shows you new ones.
 *
 * Usage:
 *   node scripts/fireball-tracker.mjs          # check for new impacts
 *   node scripts/fireball-tracker.mjs --days 7 # show last 7 days (ignore state)
 *   node scripts/fireball-tracker.mjs --reset  # reset state, re-process all
 *   node scripts/fireball-tracker.mjs --json   # output JSON only
 */

const STATE_FILE = new URL('../fireball-state.json', import.meta.url);
const FIREBALL_API = 'https://ssd-api.jpl.nasa.gov/fireball.api?limit=100';

import fs from 'fs';
import path from 'path';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function fmtEnergy(kt) {
  if (!kt) return '—';
  const v = parseFloat(kt);
  if (v >= 1) return v.toFixed(2) + ' kt';
  if (v >= 0.001) return (v * 1000).toFixed(1) + ' t TNT';
  return (v * 1000000).toFixed(0) + ' kg TNT';
}

function fmtLocation(ev) {
  const lat = ev.lat ? `${ev.lat}°${ev['lat-dir'] || ''}` : '?';
  const lon = ev.lon ? `${ev.lon}°${ev['lon-dir'] || ''}` : '?';
  return `${lat}, ${lon}`;
}

async function fetchFireballs() {
  const resp = await fetch(FIREBALL_API);
  if (!resp.ok) throw new Error(`API returned ${resp.status}`);
  const data = await resp.json();
  return data.data.map(ev => ({
    date: ev[0],
    energy: ev[1],
    impact_e: ev[2],
    lat: ev[3],
    lat_dir: ev[4],
    lon: ev[5],
    lon_dir: ev[6],
    alt: ev[7],
    vel: ev[8],
  }));
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { lastDate: null, seenDates: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE.pathname), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function filterNew(events, state) {
  const seen = new Set(state.seenDates || []);
  return events.filter(ev => !seen.has(ev.date));
}

async function main() {
  const args = process.argv.slice(2);
  const showDays = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) || 7 : null;
  const reset = args.includes('--reset');
  const jsonMode = args.includes('--json');

  const all = await fetchFireballs();

  let events;
  if (showDays) {
    const cutoff = Date.now() - showDays * 86400000;
    events = all.filter(ev => new Date(ev.date).getTime() >= cutoff);
  } else {
    const state = loadState();
    if (reset) {
      state.lastDate = null;
      state.seenDates = [];
    }
    events = filterNew(all, state);
    const latest = all.length > 0 ? all[0].date : null;
    state.lastDate = latest;
    state.seenDates = [...new Set([...(state.seenDates || []), ...all.map(ev => ev.date)])];
    if (!reset) saveState(state);
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (jsonMode) {
    process.stdout.write(JSON.stringify({ count: events.length, events }, null, 2) + '\n');
    return;
  }

  if (events.length === 0) {
    console.log('No new impacts since last check.');
    console.log('Last known: ' + (all.length > 0 ? all[0].date : 'none'));
    return;
  }

  const line = '─'.repeat(58);
  if (showDays) {
    console.log(`\n  ${line}`);
    console.log(`  🔥 FIREBALL IMPACTS — Last ${showDays} Days`);
    console.log(`  ${line}`);
  } else {
    console.log(`\n  ${line}`);
    console.log(`  🔥 NEW FIREBALL IMPACTS — ${events.length} detected`);
    console.log(`  ${line}`);
  }

  for (const ev of events) {
    const date = fmtDate(ev.date);
    const energy = fmtEnergy(ev.impact_e);
    const loc = fmtLocation(ev);
    const vel = ev.vel ? `${ev.vel} km/s` : '—';
    const alt = ev.alt ? `${ev.alt} km` : '—';
    console.log(`  ${date}`);
    console.log(`  Impact Energy : ${energy}`);
    console.log(`  Location      : ${loc}`);
    console.log(`  Velocity      : ${vel}`);
    console.log(`  Altitude      : ${alt}`);
    console.log(`  ${line}`);
  }

  console.log(`  Source: NASA CNEOS Fireball API`);
  console.log();
}

main().catch(err => {
  console.error('Fireball tracker error:', err.message);
  process.exit(1);
});
