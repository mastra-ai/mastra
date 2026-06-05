#!/usr/bin/env node
// MastraBowl Recap — npm downloads chart generator.
//
// Pulls daily download counts for @mastra/core from the public npm API and
// renders a "Downloads per day" line chart as a standalone SVG.
//
// The recap chart covers the week starting Sunday through the day BEFORE today
// (npm download data lags, so today's/yesterday's numbers are incomplete).
//
// Usage:
//   node scripts/download-chart.mjs [--package @mastra/core] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out FILE]
//
// Defaults:
//   --package @mastra/core
//   --from    the most recent Sunday on/before (today - 1)
//   --to      yesterday (today - 1)
//   --out     downloads-chart-<to>.svg  (in the skill dir)
//
// No external deps (Node 18+ fetch). Also prints total downloads for the window.

import { writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, '..');

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const a = { pkg: '@mastra/core', from: null, to: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--package') a.pkg = argv[++i];
    else if (k === '--from') a.from = argv[++i];
    else if (k === '--to') a.to = argv[++i];
    else if (k === '--out') a.out = argv[++i];
  }
  return a;
}

function defaultWindow() {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  to.setUTCDate(to.getUTCDate() - 1); // yesterday (last complete-ish day)
  const from = new Date(to);
  // back up to the most recent Sunday (getUTCDay: 0 = Sunday)
  from.setUTCDate(from.getUTCDate() - from.getUTCDay());
  return { from: ymd(from), to: ymd(to) };
}

function buildSvg(pkg, points) {
  const W = 980,
    H = 400,
    padL = 70,
    padR = 20,
    padT = 60,
    padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...points.map((p) => p.downloads), 1);
  // round max up to a "nice" number
  const niceMax = Math.ceil(max / 50000) * 50000 || 50000;

  const x = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / niceMax) * plotH;

  const gridLines = [];
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const val = (niceMax / ticks) * t;
    const yy = y(val);
    gridLines.push(
      `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#e0e0e0" stroke-width="1"/>`,
    );
    gridLines.push(
      `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#666">${Math.round(val / 1000)}k</text>`,
    );
  }

  const xLabels = points.map((p, i) => {
    const d = new Date(p.day + 'T00:00:00Z');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `<text x="${x(i).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" font-size="11" fill="#666">${label}</text>`;
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.downloads).toFixed(1)}`).join(' ');
  const dots = points
    .map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.downloads).toFixed(1)}" r="3" fill="#CC333F"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="28" text-anchor="middle" font-size="16" fill="#000">Downloads per day — ${pkg}</text>
  ${gridLines.join('\n  ')}
  <path d="${line}" fill="none" stroke="#CC333F" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  ${xLabels.join('\n  ')}
  <text x="20" y="${H / 2}" text-anchor="middle" font-size="12" fill="#000" transform="rotate(270 20 ${H / 2})">Downloads</text>
</svg>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const win = defaultWindow();
  const from = args.from || win.from;
  const to = args.to || win.to;
  const pkg = args.pkg;

  const url = `https://api.npmjs.org/downloads/range/${from}:${to}/${pkg}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm API ${res.status} for ${url}`);
  const data = await res.json();
  const points = data.downloads || [];
  if (!points.length) throw new Error('No download data returned.');

  const total = points.reduce((s, p) => s + p.downloads, 0);
  const svg = buildSvg(pkg, points);
  const out = args.out || join(skillRoot, `downloads-chart-${to}.svg`);
  writeFileSync(out, svg);

  console.log(`Package: ${pkg}`);
  console.log(`Window:  ${from} -> ${to} (Sunday -> day before today)`);
  console.log(`Total downloads: ${total.toLocaleString('en-US')}`);
  console.log('Daily:');
  for (const p of points) console.log(`  ${p.day}: ${p.downloads.toLocaleString('en-US')}`);
  console.log(`Chart SVG: ${out}`);
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
