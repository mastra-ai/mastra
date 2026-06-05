#!/usr/bin/env node
// Pull the week's article links from the #kindergarten Slack channel and rank
// them by engagement (reactions + replies) so we can pick the most interesting.
//
// Window: Sunday -> day before today (same as the rest of the recap), unless
// --from / --to (YYYY-MM-DD) are passed.
//
// Reads SLACK_TOKEN and KINDERGARTEN_SLACK_ID from recap.env.
// Usage:
//   node scripts/kindergarten.mjs
//   node scripts/kindergarten.mjs --from 2026-05-31 --to 2026-06-04

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', 'recap.env');

function loadEnv() {
  const env = {};
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = argv[++i];
    else if (argv[i] === '--to') args.to = argv[++i];
  }
  return args;
}

// Default window: most recent Sunday (inclusive) -> yesterday (inclusive).
function defaultWindow() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() - 1); // day before today
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - today.getUTCDay()); // back to Sunday
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function dayStartTs(dateStr) {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 1000);
}
function dayEndTs(dateStr) {
  return Math.floor(Date.parse(`${dateStr}T23:59:59Z`) / 1000);
}

async function slack(method, token, params) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.error}`);
  return data;
}

// Extract URLs from Slack message text. Slack wraps links as <url> or <url|label>.
function extractLinks(text) {
  if (!text) return [];
  const links = [];
  const re = /<(https?:\/\/[^>|]+)(?:\|([^>]+))?>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    links.push({ url: m[1], label: m[2] || null });
  }
  return links;
}

function isArticleLink(url) {
  // Skip links to Slack itself, images, and known non-article hosts.
  const skip = [/slack\.com/, /\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/i];
  return !skip.some((re) => re.test(url));
}

async function main() {
  const env = loadEnv();
  const token = env.SLACK_TOKEN;
  const channel = env.KINDERGARTEN_SLACK_ID;
  if (!token) throw new Error('SLACK_TOKEN missing in recap.env');
  if (!channel) throw new Error('KINDERGARTEN_SLACK_ID missing in recap.env');

  const cli = parseArgs(process.argv.slice(2));
  const win = defaultWindow();
  const from = cli.from || win.from;
  const to = cli.to || win.to;

  console.error(`# Kindergarten — week ${from} -> ${to} (channel ${channel})\n`);

  const oldest = dayStartTs(from);
  const latest = dayEndTs(to);

  // Page through channel history within the window.
  let messages = [];
  let cursor;
  do {
    const data = await slack('conversations.history', token, {
      channel,
      oldest,
      latest,
      inclusive: true,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    messages = messages.concat(data.messages || []);
    cursor = data.response_metadata && data.response_metadata.next_cursor;
  } while (cursor);

  // Collect article links with engagement signal.
  const items = [];
  for (const msg of messages) {
    const links = extractLinks(msg.text).filter((l) => isArticleLink(l.url));
    if (links.length === 0) continue;
    const reactions = (msg.reactions || []).reduce((sum, r) => sum + (r.count || 0), 0);
    const replies = msg.reply_count || 0;
    for (const link of links) {
      items.push({
        url: link.url,
        label: link.label,
        text: (msg.text || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        reactions,
        replies,
        score: reactions + replies,
        ts: msg.ts,
        date: new Date(Number(msg.ts) * 1000).toISOString().slice(0, 10),
      });
    }
  }

  // Dedupe by URL, keeping highest score.
  const byUrl = new Map();
  for (const it of items) {
    const prev = byUrl.get(it.url);
    if (!prev || it.score > prev.score) byUrl.set(it.url, it);
  }
  const ranked = [...byUrl.values()].sort((a, b) => b.score - a.score || b.replies - a.replies);

  if (ranked.length === 0) {
    console.error('No article links found in the window.');
    return;
  }

  console.log(`Found ${ranked.length} article link(s) shared this week, ranked by engagement:\n`);
  for (const it of ranked) {
    const eng = `${it.reactions} reactions, ${it.replies} replies`;
    console.log(`- [${eng}] (${it.date})`);
    console.log(`  ${it.label ? it.label + ' — ' : ''}${it.url}`);
    if (it.text) console.log(`  ctx: ${it.text}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
