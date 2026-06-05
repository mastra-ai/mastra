#!/usr/bin/env node
// Dump a Slack channel's messages for the recap week as raw material for a
// narrative section. Used for SALES (recap the deals) and CUSTOMER_ENG (recap
// the customers) — channels that are freeform text, not article links.
//
// Window: Sunday -> day before today (same as the rest of the recap), unless
// --from / --to (YYYY-MM-DD) are passed.
//
// Reads SLACK_TOKEN + <CHANNEL_KEY> from recap.env, where CHANNEL_KEY is the
// env var name holding the channel id (e.g. SALES_SLACK_ID).
//
// Usage:
//   node scripts/slack-channel.mjs SALES_SLACK_ID
//   node scripts/slack-channel.mjs CUSTOMER_ENG_SLACK_ID --threads
//   node scripts/slack-channel.mjs SALES_SLACK_ID --from 2026-05-31 --to 2026-06-04

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
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') args.from = argv[++i];
    else if (argv[i] === '--to') args.to = argv[++i];
    else if (argv[i] === '--threads') args.threads = true;
    else if (argv[i] === '--files') args.files = true;
    else args._.push(argv[i]);
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

async function slack(method, token, params) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.error}`);
  return data;
}

async function main() {
  const env = loadEnv();
  const token = env.SLACK_TOKEN;
  if (!token) throw new Error('SLACK_TOKEN missing in recap.env');

  const cli = parseArgs(process.argv.slice(2));
  const channelKey = cli._[0];
  if (!channelKey) throw new Error('Provide a channel env key, e.g. SALES_SLACK_ID');
  const channel = env[channelKey];
  if (!channel) throw new Error(`${channelKey} missing in recap.env`);

  const win = defaultWindow();
  const from = cli.from || win.from;
  const to = cli.to || win.to;
  const oldest = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const latest = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);

  console.error(`# ${channelKey} (${channel}) — week ${from} -> ${to}\n`);

  let messages = [];
  let cursor;
  do {
    const data = await slack('conversations.history', token, {
      channel, oldest, latest, inclusive: true, limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    messages = messages.concat(data.messages || []);
    cursor = data.response_metadata && data.response_metadata.next_cursor;
  } while (cursor);

  // Oldest-first reads better as a weekly log.
  messages.reverse();

  const printFiles = (files, indent) => {
    for (const f of files || []) {
      console.log(`${indent}FILE: ${f.mimetype} | ${f.name} | ${f.url_private}`);
      // Reading file bytes requires the files:read scope on the token.
      console.log(`${indent}  download: curl -sL "${f.url_private}" -H "Authorization: Bearer $SLACK_TOKEN" -o "${f.name}"`);
    }
  };

  for (const m of messages) {
    const date = new Date(Number(m.ts) * 1000).toISOString().slice(0, 10);
    const reacts = (m.reactions || []).reduce((s, r) => s + (r.count || 0), 0);
    const replies = m.reply_count || 0;
    console.log(`--- ${date} [reacts:${reacts} replies:${replies}]`);
    console.log((m.text || '').trim());
    if (m.files) printFiles(m.files, '    ');

    if ((cli.threads || cli.files) && replies > 0) {
      const thread = await slack('conversations.replies', token, { channel, ts: m.ts });
      for (const r of (thread.messages || []).slice(1)) {
        if (cli.threads) console.log(`    ↳ ${(r.text || '').replace(/\n/g, ' ').trim()}`);
        if (r.files) printFiles(r.files, '       ');
      }
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
