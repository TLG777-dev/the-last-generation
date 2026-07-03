#!/usr/bin/env node
/**
 * import-biggs-transcripts.mjs
 *
 * Downloads transcripts from Brandon Biggs' YouTube channel and saves
 * them to the vault with proper YAML frontmatter.
 *
 * Usage:
 *   node scripts/import-biggs-transcripts.mjs                # download all
 *   node scripts/import-biggs-transcripts.mjs --limit 20     # first 20 only
 *   node scripts/import-biggs-transcripts.mjs --resume       # skip already-downloaded
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CHANNEL_URL = 'https://www.youtube.com/channel/UCBqj7_4xib9pKATW4394PmQ/videos';
const OUTPUT_DIR = '/home/promeus/Documents/Second-Brain/10-Domains/01-Scripture-Prophecy/raw/teacher-content/brandon-biggs/';
const STATE_FILE = new URL('../biggs-import-state.json', import.meta.url);
const VTT_TEMP = '/tmp/bb-vtt/';

function sanitizeTitle(title) {
  return title
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function parseJson3(jsonPath) {
  if (!fs.existsSync(jsonPath)) return null;
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  const events = data.events || [];
  const texts = [];
  for (const e of events) {
    const segs = e.segs || [];
    for (const s of segs) {
      const t = s.utf8 || '';
      if (t.trim()) texts.push(t.trim());
    }
  }
  if (texts.length < 10) return null;
  return texts.join(' ');
}

function cleanWebVtt(vttPath) {
  if (!fs.existsSync(vttPath)) return null;
  const raw = fs.readFileSync(vttPath, 'utf-8');
  const lines = raw.split('\n');
  const textLines = [];
  let inHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (inHeader) {
      if (trimmed === '') continue;
      if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) continue;
      inHeader = false;
    }
    if (trimmed === '') continue;
    if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) continue;
    if (/^align:start/.test(trimmed)) continue;

    const clean = trimmed
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      .replace(/<c>/g, '')
      .replace(/<\/c>/g, '')
      .replace(/<c\.[\w.]+>/g, '')
      .replace(/<v[\s\w]*>/g, '')
      .replace(/<\/v>/g, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (clean && clean.length > 2) {
      textLines.push(clean);
    }
  }

  if (textLines.length < 3) return null;
  return textLines.join(' ');
}

function parseDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso || iso === 'NA') return null;
  return `${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}`;
}

function yamlEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function generateDescription(title) {
  const cleanTitle = title.replace(/"/g, "'");
  const desc = `Full transcript of "${cleanTitle}" — prophetic teaching and prayer from Brandon Biggs`;
  if (desc.length > 200) return desc.substring(0, 197) + '...';
  return desc;
}

function generateTags(title) {
  const tags = ['brandon-biggs', 'prophecy', 'transcript'];
  const lower = title.toLowerCase();
  if (lower.includes('tribulation') || lower.includes('end')) tags.push('end-times');
  if (lower.includes('revival')) tags.push('revival');
  if (lower.includes('prayer') || lower.includes('pray')) tags.push('prayer');
  if (lower.includes('ai') || lower.includes('artificial')) tags.push('artificial-intelligence');
  if (lower.includes('asteroid') || lower.includes('wormwood')) tags.push('asteroid');
  if (lower.includes('heaven')) tags.push('heaven');
  if (lower.includes('dream') || lower.includes('vision')) tags.push('vision');
  if (lower.includes('war') || lower.includes('ww3') || lower.includes('world war')) tags.push('war');
  if (lower.includes('rev') || lower.includes('revelation')) tags.push('revelation');
  if (lower.includes('israel') || lower.includes('jewish') || lower.includes('heifer')) tags.push('israel');
  if (lower.includes('economy') || lower.includes('crash') || lower.includes('financial')) tags.push('economics');
  if (lower.includes('alien') || lower.includes('deception')) tags.push('deception');
  if (lower.includes('glory')) tags.push('glory-of-god');
  if (lower.includes('church')) tags.push('church');
  if (lower.includes('jesus') || lower.includes('coming')) tags.push('second-coming');
  return [...new Set(tags)];
}

function buildFrontmatter(title, videoId, date, views, duration) {
  const formattedDate = formatDate(date);
  const today = new Date().toISOString().slice(0, 10);
  const tags = generateTags(title);
  const desc = generateDescription(title);
  const escapedTitle = yamlEscape(title);
  return `---
title: "${escapedTitle}"
author: "Brandon Biggs"
source_type: "youtube"
url: "https://youtu.be/${videoId}"
description: "${desc}"
date_original: "${formattedDate || today}"
date_fetched: "${today}"
tags: [${tags.join(', ')}]
status: "raw"
---`;
}

async function getVideoList() {
  console.log('Fetching video list...');
  const output = execSync(
    `yt-dlp --flat-playlist --print "%(title)s|%(id)s" "${CHANNEL_URL}" 2>/dev/null`,
    { encoding: 'utf-8', timeout: 120000 }
  );
  return output.trim().split('\n').filter(Boolean).map(line => {
    const [title, id] = line.split('|');
    return { title: title || '', id: id || '' };
  });
}

async function getVideoMeta(videoId) {
  try {
    const output = execSync(
      `yt-dlp --print "%(title)s|%(upload_date)s|%(view_count)s|%(duration)s" "https://youtu.be/${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    const parts = output.trim().split('|');
    return {
      title: parts[0] || '',
      upload_date: parts[1] || null,
      view_count: parts[2] || '0',
      duration: parts[3] || '0',
    };
  } catch {
    return null;
  }
}

async function downloadTranscript(videoId) {
  const outputTemplate = path.join(VTT_TEMP, `${videoId}`);
  const json3Path = `${outputTemplate}.en.json3`;
  const vttPath = `${outputTemplate}.en.vtt`;

  try {
    execSync(
      `yt-dlp --write-auto-subs --sub-lang en --sub-format json3 --skip-download --output "${outputTemplate}" "https://youtu.be/${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    if (fs.existsSync(json3Path)) return json3Path;
  } catch { /* fall through to vtt */ }

  try {
    execSync(
      `yt-dlp --write-auto-subs --sub-lang en --sub-format vtt --skip-download --output "${outputTemplate}" "https://youtu.be/${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    if (fs.existsSync(vttPath)) return vttPath;
  } catch { /* no subs available */ }

  return null;
}

function writeTranscript(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { downloaded: [], errors: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function processVideo(v, state, resume) {
  const downloaded = new Set(state.downloaded || []);
  const errors = new Set(state.errors || []);

  if (downloaded.has(v.id)) return resume ? { status: 'skip' } : null;
  if (errors.has(v.id)) return { status: 'error' };

  const meta = await getVideoMeta(v.id);
  if (!meta) return { status: 'fail', reason: 'no metadata', id: v.id };

  const subPath = await downloadTranscript(v.id);
  if (!subPath) return { status: 'fail', reason: 'no transcript', id: v.id };

  const cleanedText = subPath.endsWith('.json3') ? parseJson3(subPath) : cleanWebVtt(subPath);
  if (!cleanedText) return { status: 'fail', reason: 'empty transcript', id: v.id };

  const titleForFile = meta.title || v.title;
  const frontmatter = buildFrontmatter(titleForFile, v.id, meta.upload_date, meta.view_count, meta.duration);
  const slug = slugify(titleForFile);
  const fileName = `${meta.upload_date || 'unknown'}_${slug}_${v.id}.md`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  writeTranscript(filePath, frontmatter + '\n\n' + cleanedText + '\n');
  return { status: 'success', id: v.id, fileName };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;
  const resume = args.includes('--resume');

  fs.mkdirSync(VTT_TEMP, { recursive: true });

  const allVideos = await getVideoList();
  console.log(`Found ${allVideos.length} videos.`);

  let videos = allVideos;
  if (limit) videos = videos.slice(0, limit);

  let state = resume ? loadState() : { downloaded: [], errors: [] };
  const downloaded = new Set(state.downloaded || []);
  const errors = new Set(state.errors || []);

  let success = 0, skip = 0, fail = 0;
  const CONCURRENCY = 3;

  for (let idx = 0; idx < videos.length; idx += CONCURRENCY) {
    const batch = videos.slice(idx, idx + CONCURRENCY);
    const results = await Promise.all(batch.map(v => processVideo(v, state, resume)));

    for (const r of results) {
      if (!r) continue;
      if (r.status === 'success') { downloaded.add(r.id); success++; }
      else if (r.status === 'skip') { skip++; }
      else if (r.status === 'fail') { errors.add(r.id); fail++; }
    }

    state.downloaded = [...downloaded];
    state.errors = [...errors];
    saveState(state);
  }

  const total = videos.length;
  console.log(`\nDone: ${success} downloaded, ${skip} skipped, ${fail} failed / ${total} processed`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
