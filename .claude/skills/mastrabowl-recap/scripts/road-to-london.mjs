#!/usr/bin/env node
// Road to London — bucket this week's merged PRs by AREA OF THE CODEBASE
// (file paths), not labels (labels are incomplete/inconsistent).
//
// Window: Sunday -> day before today (same as the rest of the recap), unless
// --from / --to (YYYY-MM-DD) are passed.
//
// Workstreams and the code areas that define them:
//   LRA (Long Running Agents): signals / channels / events / notifications /
//       background-tasks / memory  (PubSub, Signals, Memory)
//   Observability: observability / telemetry / logger(s)  (OSS + platform)
//   Agent Builder: agent-builder / editor / workspace
//   Agent Learning (research phase): datasets / evals / relevance
//   Framework: core agent/workflows/tools/loop/processors/etc (the rest of core)
//   Platform: everything in mastra-ai/platform
//
// A PR is bucketed by the areas its changed files touch; it can appear in more
// than one workstream if it spans areas. Anything in mastra-ai/mastra that
// matches no specific area falls into Framework.
//
// Requires: gh CLI (authenticated).
// Usage:
//   node scripts/road-to-london.mjs
//   node scripts/road-to-london.mjs --from 2026-05-31 --to 2026-06-04

import { execFileSync } from 'node:child_process';

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

function gh(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out;
}
function ghJson(args) {
  return JSON.parse(gh(args));
}

// Area matchers against changed-file paths (within mastra-ai/mastra).
const AREAS = {
  LRA: [
    /^packages\/core\/src\/signals\//,
    /^packages\/core\/src\/channels\//,
    /^packages\/core\/src\/events\//,
    /^packages\/core\/src\/notifications\//,
    /^packages\/core\/src\/background-tasks\//,
    /^packages\/core\/src\/memory\//,
    /^packages\/memory\//,
  ],
  Observability: [
    /^packages\/core\/src\/observability\//,
    /^packages\/core\/src\/telemetry\//,
    /^packages\/core\/src\/logger\//,
    /^packages\/loggers\//,
  ],
  'Agent Builder': [
    /^packages\/agent-builder\//,
    /^packages\/core\/src\/agent-builder\//,
    /^packages\/editor\//,
    /^packages\/core\/src\/editor\//,
    /^packages\/core\/src\/workspace\//,
  ],
  'Agent Learning': [
    /^packages\/core\/src\/datasets\//,
    /^packages\/evals\//,
    /^packages\/core\/src\/evals\//,
    /^packages\/core\/src\/relevance\//,
  ],
};

// Skip release/chore/dependency noise — these aren't recap-worthy and they
// touch many areas (so they pollute every bucket).
function isNoise(title) {
  return (
    /^chore: version packages/i.test(title) ||
    /^chore\(deps\)/i.test(title) ||
    /^Turbo changes/i.test(title) ||
    /update dependency/i.test(title) ||
    /^ci\b|^chore\(ci\)/i.test(title)
  );
}

function bucketsForFiles(files) {
  const hit = new Set();
  for (const [area, patterns] of Object.entries(AREAS)) {
    if (files.some((f) => patterns.some((re) => re.test(f)))) hit.add(area);
  }
  // Framework = touched mastra-ai/mastra but matched no specific area above.
  if (hit.size === 0) hit.add('Framework');
  return hit;
}

async function mergedPRs(repo, from, to) {
  // gh search predates this gh; use search/issues API for merged PRs in window.
  // The search API caps at 100 results/page, so we MUST paginate or we silently
  // truncate weeks with >100 merged PRs. Page until we've collected total_count.
  const q = `repo:${repo} is:pr is:merged merged:${from}..${to}`;
  const all = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total) {
    const res = ghJson([
      'api', '-X', 'GET', 'search/issues',
      '-f', `q=${q}`,
      '-f', 'per_page=100',
      '-f', `page=${page}`,
      '--jq', '{total_count, items: [.items[] | {number, title, url: .html_url}]}',
    ]);
    total = res.total_count;
    all.push(...res.items);
    if (res.items.length === 0) break; // safety: no more results
    if (all.length >= 1000) break; // GitHub search hard cap
    page++;
  }
  if (all.length < total) {
    console.error(`  WARNING: ${repo} has ${total} merged PRs but only ${all.length} fetched (GitHub search 1000-result cap).`);
  }
  return all;
}

function changedFiles(repo, number) {
  const files = ghJson([
    'api', `repos/${repo}/pulls/${number}/files`, '--paginate',
    '--jq', '[.[].filename]',
  ]);
  return files;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const win = defaultWindow();
  const from = cli.from || win.from;
  const to = cli.to || win.to;

  console.error(`# Road to London — merged PRs ${from} -> ${to} (bucketed by code area)\n`);

  const buckets = {
    LRA: [],
    Framework: [],
    Observability: [],
    'Agent Learning': [],
    Platform: [],
    'Agent Builder': [],
  };

  // mastra-ai/mastra: bucket by file paths.
  const mastraPRs = (await mergedPRs('mastra-ai/mastra', from, to)).filter((pr) => !isNoise(pr.title));
  console.error(`mastra-ai/mastra: ${mastraPRs.length} merged PRs (noise filtered), fetching files...`);
  for (const pr of mastraPRs) {
    let files = [];
    try {
      files = changedFiles('mastra-ai/mastra', pr.number);
    } catch {
      files = [];
    }
    for (const area of bucketsForFiles(files)) {
      buckets[area].push({ ...pr, repo: 'mastra-ai/mastra' });
    }
  }

  // mastra-ai/platform: entire repo is the Platform workstream.
  const platformPRs = (await mergedPRs('mastra-ai/platform', from, to)).filter((pr) => !isNoise(pr.title));
  console.error(`mastra-ai/platform: ${platformPRs.length} merged PRs`);
  for (const pr of platformPRs) {
    buckets.Platform.push({ ...pr, repo: 'mastra-ai/platform' });
    // Observability changes also surface in platform — flag by title heuristic.
    if (/observ|telemetry|tracing|logg|mobs/i.test(pr.title)) {
      buckets.Observability.push({ ...pr, repo: 'mastra-ai/platform' });
    }
  }

  const order = ['LRA', 'Framework', 'Observability', 'Agent Learning', 'Platform', 'Agent Builder'];
  for (const area of order) {
    const prs = buckets[area];
    console.log(`\n### ${area}  (${prs.length} PR${prs.length === 1 ? '' : 's'})`);
    if (area === 'Agent Learning' && prs.length === 0) {
      console.log('- (research phase — no merged PRs this week)');
      continue;
    }
    if (prs.length === 0) {
      console.log('- (no merged PRs this week)');
      continue;
    }
    // Framework is the catch-all bucket and can be huge. Surface feats first
    // and cap the listing so the recap stays readable (full count shown above).
    let list = prs;
    if (area === 'Framework') {
      const isFeat = (t) => /^feat/i.test(t);
      list = [...prs].sort((a, b) => Number(isFeat(b.title)) - Number(isFeat(a.title)));
      const FEAT_CAP = 15;
      if (list.length > FEAT_CAP) {
        const shown = list.slice(0, FEAT_CAP);
        for (const pr of shown) console.log(`- ${pr.title} (#${pr.number}) — ${pr.url}`);
        console.log(`- …and ${list.length - FEAT_CAP} more framework PRs`);
        continue;
      }
    }
    for (const pr of list) {
      console.log(`- ${pr.title} (#${pr.number}) — ${pr.url}`);
    }
  }
}

main().catch((err) => {
  console.error(String(err.stack || err.message || err));
  process.exit(1);
});
