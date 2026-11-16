#!/usr/bin/env node
// Seeds tiers.json for the ci/test-tiers branch from the Sep 1 - Nov 1 2026 crawl.
//
// A file goes `out` when it was added before the cutoff (WINDOW_DAYS before --date) and
// did not fail on a versioning PR or on a PR since the cutoff. Everything else is `in`.
// Whole-job keys come as-is from seed-data/jobs-seed.json (CI job history, same 30-day rule).
//
//   node scripts/test-tiers/seed.mjs [--scope=all|core-list] [--data=<dir>] [--out=<file>]
//                                    [--date=YYYY-MM-DD]
//
// --scope=all (default) tiers every test file in file-ages.tsv and qualify.tsv; new files
// join the list as they appear. --scope=core-list tiers only the 1,995 files timed in the
// core Affected UNIT run (qualify.tsv) and never admits new files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS_VERSION, WINDOW_DAYS, isExternalE2eTest, isJobKey } from './select.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function readTsv(file) {
  const [header, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = header.split('\t');
  return rows.map(line => Object.fromEntries(line.split('\t').map((value, i) => [cols[i], value])));
}

// Failure paths come from logs at the time; map them to today's path through recorded
// renames, then through a unique `src/...` tail for whole-directory moves done in merges.
export function makePathMapper(knownFiles, renames) {
  const known = new Set(knownFiles);
  const byTail = new Map();
  for (const file of knownFiles) {
    const i = file.indexOf('src/');
    if (i < 0) continue;
    const tail = file.slice(i);
    byTail.set(tail, byTail.has(tail) ? null : file);
  }
  return failurePath => {
    let p = failurePath;
    for (let hops = 0; !known.has(p) && renames[p] && hops < 20; hops++) p = renames[p];
    if (known.has(p)) return p;
    const i = p.indexOf('src/');
    return i < 0 ? null : (byTail.get(p.slice(i)) ?? null);
  };
}

export const cutoffFor = date => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
};

export function seedTiers({ scope, qualify, fileAges, failIndex, renames, jobs = {}, date }) {
  const cutoff = cutoffFor(date);
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const inWindow = d => isDate(d) && d >= cutoff && d <= date;
  const added = new Map(fileAges.map(r => [r.file, r.added]));
  for (const r of qualify) if (!added.has(r.file)) added.set(r.file, r.added);
  const mapPath = makePathMapper([...added.keys()], renames);

  const mapped = key => {
    const out = new Map();
    for (const [failurePath, values] of Object.entries(failIndex[key])) {
      const file = mapPath(failurePath);
      if (file) out.set(file, [...(out.get(file) ?? []), ...values]);
    }
    return out;
  };
  const versioning = mapped('ver');
  const pr = mapped('pr');
  const any = mapped('any');

  const universe = scope === 'all' ? [...added.keys()] : qualify.map(r => r.file);
  const files = {};
  for (const file of universe.sort()) {
    if (isExternalE2eTest(file)) continue;
    const addedOn = added.get(file) || null;
    const verDates = (versioning.get(file) ?? []).filter(isDate);
    const failureDates = [...(any.get(file) ?? []), ...verDates].filter(isDate);
    const lastFailure = failureDates.length ? failureDates.sort().at(-1) : null;
    // fail-index records PR failures by PR number; their dates are the `any` dates that
    // are not versioning dates.
    const prDates = pr.has(file) ? (any.get(file) ?? []).filter(d => isDate(d) && !verDates.includes(d)) : [];
    let reason = null;
    if (verDates.some(inWindow)) reason = 'versioning-fail';
    else if (prDates.some(inWindow)) reason = 'pr-fail';
    else if (!addedOn || addedOn >= cutoff) reason = 'new';

    if (reason) {
      const since = [addedOn, lastFailure].filter(Boolean).sort().at(-1) ?? date;
      files[file] = { tier: 'in', since, last_failure: lastFailure, reason };
    } else {
      files[file] = { tier: 'out', since: date, last_failure: lastFailure, reason: 'seed-rule-b' };
    }
  }
  // Whole jobs (`job:<key>`), seeded from CI job history; a job left out of the seed runs.
  for (const [key, entry] of Object.entries(jobs)) {
    if (!isJobKey(key) || !['in', 'out'].includes(entry.tier)) throw new Error(`bad job seed entry ${key}`);
    files[key] = { tier: entry.tier, since: entry.since, last_failure: entry.last_failure, reason: entry.reason };
  }
  return { version: TIERS_VERSION, updated: date, scope, files };
}

function parseArgs(argv) {
  const args = {
    scope: 'all',
    data: path.join(here, 'seed-data'),
    out: null,
    date: new Date().toISOString().slice(0, 10),
  };
  for (const arg of argv) {
    const m = /^--([a-z]+)=(.*)$/.exec(arg);
    if (!m || !(m[1] in args)) throw new Error(`unknown argument ${arg}`);
    args[m[1]] = m[2];
  }
  if (!['core-list', 'all'].includes(args.scope))
    throw new Error(`--scope must be core-list or all, got ${args.scope}`);
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const tiers = seedTiers({
    scope: args.scope,
    qualify: readTsv(path.join(args.data, 'qualify.tsv')),
    fileAges: readTsv(path.join(args.data, 'file-ages.tsv')),
    failIndex: JSON.parse(fs.readFileSync(path.join(args.data, 'fail-index.json'), 'utf8')),
    renames: JSON.parse(fs.readFileSync(path.join(args.data, 'renames.json'), 'utf8')),
    jobs: JSON.parse(fs.readFileSync(path.join(args.data, 'jobs-seed.json'), 'utf8')),
    date: args.date,
  });
  const json = `${JSON.stringify(tiers, null, 2)}\n`;
  if (args.out) fs.writeFileSync(args.out, json);
  else process.stdout.write(json);
  const count = keep => {
    const entries = Object.entries(tiers.files).filter(([key]) => keep(key));
    const out = entries.filter(([, e]) => e.tier === 'out').length;
    return `${entries.length} (${out} out, ${entries.length - out} in)`;
  };
  console.error(`scope ${args.scope}: files ${count(key => !isJobKey(key))}, jobs ${count(isJobKey)}`);
}
