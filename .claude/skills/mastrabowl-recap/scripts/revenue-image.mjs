#!/usr/bin/env node
// Pull the latest in-window revenue chart from the #revenue Slack channel.
//
// The PostHog "Subscription Revenue by Type" subscription posts a daily message
// with the chart embedded as an `image` block (a signed PostHog exporter PNG —
// no PostHog API key needed). This grabs the most recent in-window image and
// saves it next to the recap for attaching to Notion.
//
// Window: Sunday -> day before today (same as the rest of the recap), unless
// --from / --to (YYYY-MM-DD) are passed. Picks the newest image in the window.
//
// Reads SLACK_TOKEN and REVENUE_SLACK_ID from recap.env.
// Usage:
//   node scripts/revenue-image.mjs
//   node scripts/revenue-image.mjs --from 2026-05-31 --to 2026-06-04

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', 'recap.env');
const OUT_DIR = join(__dirname, '..');

function loadEnv() {
  const env = {};
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
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

function defaultWindow() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - today.getUTCDay());
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

async function main() {
  const env = loadEnv();
  const token = env.SLACK_TOKEN;
  const channel = env.REVENUE_SLACK_ID;
  if (!token) throw new Error('SLACK_TOKEN missing in recap.env');
  if (!channel) throw new Error('REVENUE_SLACK_ID missing in recap.env');

  const cli = parseArgs(process.argv.slice(2));
  const win = defaultWindow();
  const from = cli.from || win.from;
  const to = cli.to || win.to;

  const oldest = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const latest = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);

  console.error(`# Revenue image — week ${from} -> ${to} (channel ${channel})\n`);

  const url = new URL('https://slack.com/api/conversations.history');
  url.searchParams.set('channel', channel);
  url.searchParams.set('oldest', String(oldest));
  url.searchParams.set('latest', String(latest));
  url.searchParams.set('inclusive', 'true');
  url.searchParams.set('limit', '100');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.ok) throw new Error(`conversations.history failed: ${data.error}`);

  // messages are newest-first; take the first with a PostHog image block.
  let imageUrl, viewUrl, ts;
  for (const m of data.messages) {
    const img = (m.blocks || []).find(
      (b) => b.type === 'image' && /posthog/.test(b.image_url || ''),
    );
    if (img) {
      imageUrl = img.image_url;
      ts = m.ts;
      const actions = (m.blocks || []).find((b) => b.type === 'actions');
      viewUrl = actions?.elements?.find((e) => /View in PostHog/.test(e.text?.text || ''))?.url;
      break;
    }
  }
  if (!imageUrl) {
    console.error('No PostHog revenue image found in the window.');
    process.exit(1);
  }

  const date = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`image download failed: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = join(OUT_DIR, `revenue-${date}.png`);
  writeFileSync(outPath, buf);

  console.log(`Revenue chart date: ${date}`);
  console.log(`Saved: ${outPath} (${buf.length} bytes)`);
  if (viewUrl) console.log(`View in PostHog: ${viewUrl}`);
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
