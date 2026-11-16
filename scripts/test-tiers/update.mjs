#!/usr/bin/env node
// Keeps tiers.json on the ci/test-tiers branch current (see .github/workflows/test-tiers.yml).
//
//   node scripts/test-tiers/update.mjs versioning --tiers=<file> --run-id=<id> [--date=YYYY-MM-DD]
//     Every unit test file that failed in a versioning-PR Prebuild run moves `in`.
//   node scripts/test-tiers/update.mjs daily --tiers=<file> [--days=14] [--date=YYYY-MM-DD] [--budget-minutes=45]
//     Failures on PRs in the last 14 days that the PR then fixed in source (a catch)
//     restart the file's 30-day clock, each failure counted once; deleted files leave; files clean for 30 days move `out`.
//     Runs whose failures are all settled are remembered and never fetched again; past the time
//     budget the rest wait for the next day, and nothing moves out that day.
//
// The pure functions below hold the rules; the CLI only gathers GitHub data for them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOW_DAYS, isExternalE2eTest, isJobKey } from './select.mjs';

// PR failures are looked at for this long, so a fix that lands days later still counts.
export const LOOKBACK_DAYS = 14;
// The daily update stops inspecting runs after this long (listing included) and saves what it has,
// inside the workflow's 60-minute job timeout. The next day picks up the runs it didn't reach.
export const DAILY_BUDGET_MINUTES = 45;
// No GitHub call starts, waits or keeps running past the budget plus this, so the day's results
// are still written and committed inside the job timeout.
const GH_GRACE_MINUTES = 8;

// Same file classes E4 used to call the fix a test-only change or a source change.
const TEST_PATH =
  /\.(test|spec)\.(ts|tsx|mts|js)$|\/__tests__\/|\/test-utils\/|\/_test-utils\/|\/fixtures?\/|\/__fixtures__\/|vitest\.config|__mocks__|\/test\/|\.snap$|^e2e-tests\//;
const NON_CODE = /\.md$|^\.changeset\/|\.mdx$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|js|mjs)$/;

const daysBefore = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};
const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

/** Files that failed on a versioning PR run on every PR again, from today. */
export function applyVersioningFailures(tiers, files, date) {
  const moved = [];
  for (const file of new Set(files)) {
    if (isExternalE2eTest(file)) continue;
    tiers.files[file] = {
      ...tiers.files[file],
      tier: 'in',
      since: date,
      last_failure: date,
      reason: 'versioning-fail',
    };
    moved.push(file);
  }
  return moved.sort();
}

/**
 * Classifies one failing file on a PR the way E4 did.
 * - `flake`: the same head passed on a rerun.
 * - `unresolved`: no later head on the branch has passed yet.
 * - `catch`: the diff to the next passing head changed non-test source in the file's package
 *   (or in packages/core, which most packages build on).
 * - `test-fix`: that diff changed only tests. `other`: it didn't touch the package.
 */
export function classifyPrFailure({ pkgDir, rerunPassed, nextGreenHead, diffFiles }) {
  if (rerunPassed) return 'flake';
  if (!nextGreenHead || !diffFiles) return 'unresolved';
  const inScope = f =>
    f.startsWith(`${pkgDir}/`) || (!pkgDir.startsWith('packages/core') && f.startsWith('packages/core/'));
  const touched = diffFiles.filter(inScope);
  if (touched.some(f => !TEST_PATH.test(f) && !NON_CODE.test(f))) return 'catch';
  if (touched.some(f => TEST_PATH.test(f))) return 'test-fix';
  return 'other';
}

/** A catch on a PR restarts the file's clock and keeps (or brings) it `in`. */
export function applyCatches(tiers, catches) {
  const changed = [];
  for (const { file, date } of catches) {
    if (isExternalE2eTest(file)) continue;
    const entry = tiers.files[file];
    if (entry?.tier === 'in' && entry.last_failure && entry.last_failure >= date) continue;
    tiers.files[file] = {
      ...entry,
      tier: 'in',
      since: entry?.tier === 'in' ? entry.since : date,
      last_failure: later(entry?.last_failure, date),
      reason: isJobKey(file) ? 'pr-job-fail' : 'pr-catch',
    };
    changed.push(file);
  }
  return changed.sort();
}

/**
 * Settles PR failures from the lookback window, once each.
 *
 * A failure is (failing job, file). Its verdict is recorded on the file's entry under
 * `pr_failures[<job id>]` the first time it is final (anything but `unresolved`), so a later
 * run over the same window never counts it again; an unresolved failure is retried each day
 * until its branch goes green or it leaves the window. Verdicts older than the window are
 * pruned. Only catches change a tier; other verdicts are recorded only on files the list
 * already has (an unlisted file runs on every PR anyway).
 *
 * A failed job tiered as a whole (`job:<key>`) arrives with its verdict already set: `flake`
 * when the same job passed on a later attempt or run of that head, `unresolved` while that
 * can still happen, otherwise `fail`, which brings the job `in` like a catch.
 */
export function recordPrFailures(tiers, failures, today, lookbackDays = LOOKBACK_DAYS) {
  const windowStart = daysBefore(today, lookbackDays);
  const tally = {};
  const catches = [];
  const record = (file, jobId, date, verdict) => {
    const entry = tiers.files[file];
    if (!entry) return;
    entry.pr_failures = { ...entry.pr_failures, [jobId]: { date, verdict } };
  };
  for (const failure of failures) {
    if (failure.date < windowStart) continue;
    if (tiers.files[failure.file]?.pr_failures?.[failure.jobId]) {
      tally.settled = (tally.settled ?? 0) + 1;
      continue;
    }
    const verdict = failure.verdict ?? classifyPrFailure(failure);
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    if (verdict === 'unresolved' || isExternalE2eTest(failure.file)) continue;
    if (verdict === 'catch' || verdict === 'fail') catches.push({ ...failure, verdict });
    else record(failure.file, failure.jobId, failure.date, verdict);
  }
  // applyCatches may create the entry, so catches are recorded after it.
  const caught = applyCatches(tiers, catches);
  for (const c of catches) record(c.file, c.jobId, c.date, c.verdict);
  for (const entry of Object.values(tiers.files)) {
    if (!entry.pr_failures) continue;
    for (const [jobId, v] of Object.entries(entry.pr_failures))
      if (v.date < windowStart) delete entry.pr_failures[jobId];
    if (!Object.keys(entry.pr_failures).length) delete entry.pr_failures;
  }
  return { tally, caught };
}

/**
 * Drops entries for deleted files. On the `all` scope, test files the list doesn't know
 * yet join as `in` from today; on `core-list` the list stays the seeded files (an unlisted
 * file always runs).
 */
export function syncFiles(tiers, testFiles, date) {
  const present = new Set(testFiles);
  const removed = Object.keys(tiers.files).filter(file => !isJobKey(file) && !present.has(file));
  for (const file of removed) delete tiers.files[file];
  const added = [];
  if (tiers.scope === 'all') {
    for (const file of testFiles) {
      if (tiers.files[file] || isExternalE2eTest(file)) continue;
      tiers.files[file] = { tier: 'in', since: date, last_failure: null, reason: 'new' };
      added.push(file);
    }
  }
  return { removed: removed.sort(), added: added.sort() };
}

/** `in` files that have been in, and clean, for WINDOW_DAYS move `out`. */
export function moveOut(tiers, today, days = WINDOW_DAYS) {
  const cutoff = daysBefore(today, days);
  const moved = [];
  for (const [file, entry] of Object.entries(tiers.files)) {
    if (entry.tier !== 'in') continue;
    if (entry.since > cutoff) continue;
    if (entry.last_failure && entry.last_failure > cutoff) continue;
    tiers.files[file] = {
      ...entry,
      tier: 'out',
      since: today,
      last_failure: entry.last_failure,
      reason: `clean-${days}-days`,
    };
    moved.push(file);
  }
  return moved.sort();
}

const E2E_JOB_LABELS = {
  monorepo: 'monorepo',
  'kitchen-sink': 'kitchen-sink',
  deployers: 'deployers',
  'create-mastra': 'create-mastra',
  CommonJS: 'commonjs',
  'no-bundling': 'no-bundling',
  'MCP compatibility': 'mcp-compat',
  'client-js': 'client-js',
  'Type check': 'type-check',
  experiments: 'experiments',
};
const NAMED_JOBS = {
  'Prebuild\tMemory Tests': 'job:memory',
  'Prebuild\tMastra Code E2E / Mastra Code E2E': 'job:mastracode-e2e',
  'Prebuild\tMastra Code E2E / Mastra Code web host OM scenarios': 'job:mastracode-om',
  'Quality assurance\tValidate changeset packages': 'job:qa/changeset-check',
};

/**
 * The tier keys one CI job ran, and which of them failed. `log` is only read for the jobs that
 * run several packages with `pnpm -r` (light stores, workspace unit tests): a package whose
 * script started (`stores/lance test$ …`) but never printed `Done` failed. Jobs that aren't
 * tiered as a whole (unit and package-E2E file lists, builds, gates) return nothing.
 * @returns {{ ran: string[], failed: string[] }}
 */
export function jobKeysFor(workflow, name, log = () => '') {
  const one = key => ({ ran: [key], failed: [key] });
  const named = NAMED_JOBS[`${workflow}\t${name}`];
  if (named) return one(named);
  let m;
  if (workflow === 'Workspace Cloud Tests' && (m = /^test-cloud \(([\w-]+)\)$/.exec(name)))
    return one(`job:workspace-cloud/${m[1]}`);
  if (workflow !== 'Prebuild') return { ran: [], failed: [] };
  if ((m = /^Combined Store Tests \/ test \(([\w-]+)\)$/.exec(name))) return one(`job:store/${m[1]}`);
  if ((m = /^Workspace Tests \/ test-unit \(([\w-]+)\)$/.exec(name))) return one(`job:workspace-unit/${m[1]}`);
  if ((m = /^Workspace Tests \/ test-docker \(([\w-]+)\)$/.exec(name))) return one(`job:workspace-docker/${m[1]}`);
  if ((m = /^E2E Tests \/ E2E (.+?)(?: \(\d+\/\d+\)| \(optional\))?$/.exec(name)) && E2E_JOB_LABELS[m[1]])
    return one(`job:e2e/${E2E_JOB_LABELS[m[1]]}`);
  const folded =
    name === 'Combined Store Tests / test (light stores)'
      ? ['stores', 'test', 'store']
      : name === 'Workspace Tests / test-unit'
        ? ['workspaces', 'test:unit', 'workspace-unit']
        : null;
  if (!folded) return { ran: [], failed: [] };
  const [dir, script, group] = folded;
  const started = new Set();
  const done = new Set();
  const text = log().replace(/\x1b\[[0-9;]*m/g, '');
  const re = new RegExp(`\\b${dir}/([\\w-]+) ${script}(\\$|: Done)`, 'g');
  for (const [, pkg, mark] of text.matchAll(re)) (mark === '$' ? started : done).add(pkg);
  const ran = [...started].sort().map(pkg => `job:${group}/${pkg}`);
  const failed = [...started]
    .filter(pkg => !done.has(pkg))
    .sort()
    .map(pkg => `job:${group}/${pkg}`);
  return { ran, failed };
}

/** Job keys seen running that the list doesn't have yet join `in` from today (`all` scope only). */
export function addJobKeys(tiers, keys, date) {
  if (tiers.scope !== 'all') return [];
  const added = [];
  for (const key of new Set(keys)) {
    if (tiers.files[key]) continue;
    tiers.files[key] = { tier: 'in', since: date, last_failure: null, reason: 'new' };
    added.push(key);
  }
  return added.sort();
}

/** PR runs, oldest first. Runs on this repository's own main are not PR runs; a fork's main is. */
export function prRuns(runs, repo) {
  return runs
    .filter(r => !(r.head_branch === 'main' && r.head_repo === repo))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// GitHub's run listing reads at most this many runs per query, whatever total_count says.
export const RUN_LIST_CAP = 1000;
const isoSecond = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Every run created from `since` through `until` (UTC days, inclusive), listed a day at a
 * time so each query stays under the cap. A day over the cap is halved until each part fits.
 * listRange takes a `created` range (from..to, inclusive) and returns { total, runs }.
 */
export function listRunsByDay(listRange, since, until, cap = RUN_LIST_CAP) {
  const runs = new Map();
  const list = (from, to) => {
    const { total, runs: listed } = listRange(`${isoSecond(from)}..${isoSecond(to)}`);
    if (total > cap && to - from >= 2000) {
      const mid = from + Math.floor((to - from) / 2000) * 1000;
      list(from, mid);
      list(mid + 1000, to);
      return;
    }
    if (total > cap) console.error(`warning: ${total} runs created in one second, only ${cap} listed`);
    for (const run of listed) runs.set(run.id, run);
  };
  const end = Date.parse(`${until}T00:00:00Z`);
  for (let day = Date.parse(`${since}T00:00:00Z`); day <= end; day += 86_400_000) {
    list(day, day + 86_399_000);
  }
  return [...runs.values()];
}

/**
 * Finished runs that did not pass. A skipped run never started a job, so fetching its jobs
 * (one serial API call each, hundreds a day) cannot find a failure.
 */
export function runsToInspect(runs) {
  return runs.filter(r => r.conclusion && r.conclusion !== 'success' && r.conclusion !== 'skipped');
}

/**
 * Fetches each run's failures, newest first, until the deadline (a backlog then drains from its
 * newest end while each new day is covered at once). A run whose current attempt is in
 * `tiers.inspected_runs` is skipped: either every failure it held was settled, or it is `waiting`
 * on something that hasn't happened yet (a later green head, or a failed job reaching
 * `recheck_after`, when it is old enough to call) and `ready` says nothing could settle it now. So runs that stay unresolved are not fetched
 * again every day, and cannot use up the budget ahead of runs never looked at. A rerun keeps the
 * run id but bumps the attempt, so it is inspected again. A transient GitHub error that outlasts
 * the retries ends the day early the same way as the deadline.
 * Returns the failures, the runs that settled, the runs still waiting, and how many were left.
 */
export function inspectRuns(tiers, runs, inspectRun, { deadline, now = Date.now, ready = () => true }) {
  const pending = runs
    .filter(r => {
      const seen = tiers.inspected_runs?.[r.id];
      return seen?.attempt !== r.run_attempt || (seen.waiting && ready(r, seen));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const failures = [];
  const settled = [];
  const waiting = [];
  for (const [i, run] of pending.entries()) {
    if (now() >= deadline) return { failures, settled, waiting, left: pending.length - i };
    if (i % 50 === 0) console.error(`  run ${i + 1}/${pending.length}`);
    let found;
    try {
      found = inspectRun(run);
    } catch (error) {
      // Retries already ran out; keep what is settled rather than lose the whole day.
      if (!isTransientGhError(error)) throw error;
      console.error(`GitHub kept failing (${String(error.stderr ?? error.message).trim()}); stopping early`);
      return { failures, settled, waiting, left: pending.length - i };
    }
    failures.push(...found);
    const open = found.filter(f => (f.verdict ?? classifyPrFailure(f)) === 'unresolved');
    if (!open.length) settled.push(run);
    else
      waiting.push({
        run,
        recheckAfter: open
          .map(f => f.settlesAt)
          .filter(Boolean)
          .sort()
          .at(-1),
      });
  }
  return { failures, settled, waiting, left: 0 };
}

/**
 * Records the day's failures and settled runs, then syncs the file list. Files move out only
 * when every run was inspected: a run left for tomorrow may hold the catch that keeps a file in.
 */
export function settleDay(tiers, { failures, settled, waiting = [], left }, date, days, testFiles) {
  const windowStart = daysBefore(date, days);
  const { tally, caught } = recordPrFailures(tiers, failures, date, days);
  const remembered = { ...tiers.inspected_runs };
  for (const run of settled) remembered[run.id] = { day: run.created_at.slice(0, 10), attempt: run.run_attempt };
  for (const { run, recheckAfter } of waiting)
    remembered[run.id] = {
      day: run.created_at.slice(0, 10),
      attempt: run.run_attempt,
      waiting: true,
      ...(recheckAfter && { recheck_after: recheckAfter }),
    };
  for (const [id, seen] of Object.entries(remembered)) if (!seen.day || seen.day < windowStart) delete remembered[id];
  tiers.inspected_runs = remembered;
  const { removed, added } = syncFiles(tiers, testFiles, date);
  const out = left ? [] : moveOut(tiers, date);
  return { tally, caught, removed, added, out };
}

/** The first later green run of the same workflow on the same branch of the same repository, at a new head. */
export function nextGreenRun(runs, run) {
  return runs.find(
    r =>
      r.workflow_id === run.workflow_id &&
      r.head_repo === run.head_repo &&
      r.head_branch === run.head_branch &&
      r.created_at > run.created_at &&
      r.head_sha !== run.head_sha &&
      r.conclusion === 'success',
  );
}

/**
 * Whether a run left `waiting` could settle now: its branch has a later green run (a fix to
 * diff against, or a pass that makes it a flake), or a failed job it held has reached
 * `recheck_after` (24 hours after the job finished), when it is old enough to call.
 */
export function waitingRunReady(runs, run, seen, nowIso = new Date().toISOString()) {
  return (
    (seen.recheck_after !== undefined && seen.recheck_after <= nowIso) ||
    runs.some(
      r =>
        r.workflow_id === run.workflow_id &&
        r.head_repo === run.head_repo &&
        r.head_branch === run.head_branch &&
        r.created_at > run.created_at &&
        r.conclusion === 'success',
    )
  );
}

/** GitHub's compare API lists at most this many changed files. */
const COMPARE_FILE_CAP = 300;

/**
 * Changed files from the pages of `gh api --paginate compare/<a>...<b>`. Only the first page
 * carries `files` (later pages page the commits and have `files: null`), and GitHub stops the
 * list at 300 files, so a capped or missing list returns null and the caller diffs with git instead.
 */
export function compareFiles(pages) {
  if (!pages.some(p => Array.isArray(p.files))) return null;
  const files = pages.flatMap(p => p.files ?? []).map(f => f.filename);
  return files.length >= COMPARE_FILE_CAP ? null : files;
}

/**
 * Whether a failed `gh api` call is worth repeating: a GitHub 5xx, a rate limit, or a dropped or
 * timed-out connection. A 404, a bad flag or bad JSON fails the same way every time.
 */
export function isTransientGhError(error) {
  const text = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
  return /HTTP 5\d\d|HTTP 429|rate limit|timed? ?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|connection reset|\bEOF\b/i.test(
    text,
  );
}

export const GH_RETRY_DELAYS_MS = [5_000, 20_000, 60_000];
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Calls fn, repeating it after each delay while it throws a transient GitHub error, but never
 * waiting past `stopAt`.
 */
export function retryTransient(
  fn,
  delays = GH_RETRY_DELAYS_MS,
  sleep = sleepSync,
  { stopAt = Infinity, now = Date.now } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (attempt >= delays.length || !isTransientGhError(error)) throw error;
      if (now() + delays[attempt] >= stopAt) throw error;
      console.warn(
        `gh api failed (${String(error.stderr ?? error.message).trim()}); retrying in ${delays[attempt]} ms`,
      );
      sleep(delays[attempt]);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// GitHub glue (not unit tested; exercised only in the workflow).

/**
 * One `gh api` call, retried on transient errors, that neither starts, waits nor runs past
 * `stopAt`: a call still running then is killed. Either way it throws a transient error, which
 * ends the day's inspection early with what was settled kept. A --paginate call is repeated
 * whole, so a retry never mixes pages from two attempts.
 */
export function boundedGh(args, { stopAt = Infinity, now = Date.now, exec = execFileSync, delays, sleep } = {}) {
  return retryTransient(() => boundedExec('gh', ['api', ...args], { stopAt, now, exec }), delays, sleep, {
    stopAt,
    now,
  });
}

/**
 * Runs a command that must not start or keep running past `stopAt`; past it, or killed at it,
 * it throws an error `isTransientGhError` accepts, so the day ends early instead of timing out.
 */
function boundedExec(cmd, args, { cwd, stopAt = Infinity, now = Date.now, exec = execFileSync } = {}) {
  const remaining = stopAt - now();
  if (remaining <= 0) throw new Error(`${cmd} not started: the daily time limit has passed (ETIMEDOUT)`);
  return exec(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    ...(Number.isFinite(remaining) && { timeout: remaining }),
  });
}

const repo = process.env.GITHUB_REPOSITORY ?? 'mastra-ai/mastra';
let ghStopAt = Infinity;
const gh = (...args) => boundedGh(args, { stopAt: ghStopAt });
const ghJson = (...args) =>
  gh('--paginate', ...args)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

/**
 * Files changed between two commits (three-dot, like compare), fetched without blobs. The workflow
 * checks out at depth 1, and a head rebased onto that checkout stops fetching at its boundary while
 * the merge base lies below it, so a shallow clone is unshallowed first. -z keeps paths literal.
 */
export const gitDiffFiles = (base, head, cwd, { stopAt = Infinity, now = Date.now, exec = execFileSync } = {}) => {
  const git = args => boundedExec('git', args, { cwd, stopAt, now, exec });
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  git([
    'fetch',
    '--quiet',
    '--no-tags',
    '--filter=blob:none',
    ...(shallow ? ['--unshallow'] : []),
    'origin',
    base,
    head,
  ]);
  return git(['diff', '--name-only', '-z', '--no-renames', `${base}...${head}`])
    .split('\0')
    .filter(Boolean);
};

/**
 * Failing test files in a unit job's log, as repo paths (same parsing as the E4 crawl).
 * Vitest prints a project name, which is not always the package directory
 * (unit:packages/core-isolated runs files from packages/core), so each file is
 * resolved against the tracked test files and dropped when it matches none.
 */
export function failingFilesFromLog(log, tracked = repoTestFiles(), roots = repoProjectRoots()) {
  const { known, bySuffix } = trackedIndex(tracked);
  const files = new Set();
  const resolved = new Map();
  const keep = file => {
    if (known.has(file)) files.add(file);
  };
  for (const raw of log.split('\n')) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '');
    if (!/^[0-9TZ:.-]+ +FAIL /.test(line)) continue;
    let m = /\[ ([^\]]+\.(?:test|spec)\.[a-z]+) \]/.exec(line);
    if (m) {
      keep(m[1]);
      continue;
    }
    m = /FAIL +(\S+) +(\S+\.(?:test|spec)\.[a-z]+)/.exec(line);
    if (m) {
      const pair = `${m[1]}\0${m[2]}`;
      if (!resolved.has(pair)) resolved.set(pair, projectFile(m[1], m[2], known, bySuffix, roots));
      const file = resolved.get(pair);
      if (file) files.add(file);
      continue;
    }
    m = /FAIL +(\S+\.(?:test|spec)\.[a-z]+)/.exec(line);
    if (m) keep(m[1]);
  }
  return [...files].filter(f => TEST_FILE.test(f)).sort();
}

// The tracked file a project-relative path belongs to: under the directory of the
// vitest config that names the project (unit:mastracode-core → mastracode/sdk), else
// under the project name read as a directory, else the longest package directory the
// name starts with (packages/core-isolated → packages/core). Only a project with no
// known location (no config names it, and its name is not a path) falls back to the
// only tracked file with that relative path, so a deleted file is never pinned on
// another package that happens to share its relative path.
function projectFile(name, rel, known, bySuffix, roots) {
  for (const root of roots.get(name) ?? []) {
    if (known.has(`${root}/${rel}`)) return `${root}/${rel}`;
  }
  const project = name.split(':').slice(1).join(':') || name;
  if (known.has(`${project}/${rel}`)) return `${project}/${rel}`;
  const matches = bySuffix.get(rel) ?? [];
  const prefixed = matches
    .filter(f => project.startsWith(f.slice(0, -rel.length - 1)))
    .sort((a, b) => b.length - a.length);
  if (prefixed.length) return prefixed[0];
  if (roots.has(name) || project.includes('/')) return undefined;
  return matches.length === 1 ? matches[0] : undefined;
}

// The tracked files as a set, and by every path tail after a "/" (src/a.test.ts →
// [packages/core/src/a.test.ts, …]), built once per file list so a log with many
// FAIL lines costs a lookup per line rather than a scan of every tracked file.
const trackedIndexes = new WeakMap();
function trackedIndex(tracked) {
  let index = trackedIndexes.get(tracked);
  if (index) return index;
  const known = new Set(tracked);
  const bySuffix = new Map();
  for (const file of known) {
    for (let i = file.indexOf('/'); i !== -1; i = file.indexOf('/', i + 1)) {
      const tail = file.slice(i + 1);
      if (!bySuffix.has(tail)) bySuffix.set(tail, []);
      bySuffix.get(tail).push(file);
    }
  }
  index = { known, bySuffix };
  trackedIndexes.set(tracked, index);
  return index;
}

/** Vitest project name → directories of the tracked configs that declare it. */
export function projectRootsFromConfigs(configs) {
  const roots = new Map();
  for (const [file, source] of configs) {
    const dir = path.posix.dirname(file);
    for (const [, name] of source.matchAll(/\bname:\s*['"`]([^'"`$]+)['"`]/g)) {
      if (!roots.has(name)) roots.set(name, []);
      if (!roots.get(name).includes(dir)) roots.get(name).push(dir);
    }
  }
  return roots;
}

let projectRoots;
function repoProjectRoots() {
  projectRoots ??= projectRootsFromConfigs(
    execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 })
      .split('\n')
      .filter(f => /(^|\/)vitest[^/]*\.config\.[cm]?[jt]s$/.test(f) && !f.includes('node_modules/'))
      .map(f => [f, fs.readFileSync(f, 'utf8')]),
  );
  return projectRoots;
}

const runJobs = runId =>
  ghJson(`repos/${repo}/actions/runs/${runId}/jobs?filter=all&per_page=100`, '-q', '.jobs[]|@json');
// Jobs whose log names the failing test files: the unit lists and the package E2E list.
const isFileListJob = name => /UNIT Test|\/ E2E Test \(/.test(name);
// Workflows with jobs tiered as a whole, beside Prebuild's.
const JOB_WORKFLOWS = ['prebuild.yml', 'secrets.test-workspaces.yml', 'lint.yml'];
// A failed job counts once it is this old, so a rerun has had time to mark it a flake.
const JOB_SETTLE_MS = 24 * 60 * 60 * 1000;
// Job logs contain terminal colour codes; newer gh refuses to print them without
// --allow-escape-sequences, older gh doesn't know the flag.
const jobLog = jobId => {
  const url = `repos/${repo}/actions/jobs/${jobId}/logs`;
  try {
    return gh('--allow-escape-sequences', url);
  } catch (error) {
    if (!/unknown flag/.test(String(error.stderr))) throw error;
    return gh(url);
  }
};

function packageDir(file) {
  const parts = file.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const dir = parts.slice(0, i).join('/');
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return parts.slice(0, 2).join('/');
}

let trackedTestFiles;
function repoTestFiles() {
  trackedTestFiles ??= execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(f => TEST_FILE.test(f) && !f.includes('node_modules/'));
  return trackedTestFiles;
}

function versioningCommand(tiers, { runId, date }) {
  const jobs = runJobs(runId).filter(j => j.conclusion && j.conclusion !== 'skipped');
  const files = jobs
    .filter(j => j.conclusion === 'failure' && isFileListJob(j.name))
    .flatMap(j => failingFilesFromLog(jobLog(j.id)));
  const ran = [];
  const failedJobs = [];
  for (const job of jobs) {
    const keys = jobKeysFor(job.workflow_name, job.name, () => jobLog(job.id));
    ran.push(...keys.ran);
    if (job.conclusion === 'failure') failedJobs.push(...keys.failed);
  }
  // The versioning PR runs every job, so this is where new jobs join the list.
  const added = addJobKeys(tiers, ran, date);
  const moved = applyVersioningFailures(tiers, [...files, ...failedJobs], date);
  console.error(`versioning run ${runId}: ${moved.length} files and jobs in; new jobs: ${added.length}`);
  for (const f of moved) console.error(`  in ${f}`);
  for (const k of added) console.error(`  new ${k}`);
}

function dailyCommand(tiers, { days, date, budgetMinutes }) {
  const startedAt = Date.now();
  ghStopAt = startedAt + (Number(budgetMinutes) + GH_GRACE_MINUTES) * 60_000;
  const since = daysBefore(date, Number(days));
  // One page line per page carries total_count, so a range over the cap can be split.
  const listRange = workflow => range => {
    const lines = ghJson(
      `repos/${repo}/actions/workflows/${workflow}/runs?created=${range}&per_page=100`,
      '-q',
      '{total:.total_count}, (.workflow_runs[]|select(.event=="pull_request" or .event=="workflow_run")|{id,head_branch,head_repo:.head_repository.full_name,head_sha,created_at,conclusion,run_attempt,workflow_id})|@json',
    );
    return {
      total: Math.max(0, ...lines.filter(l => 'total' in l).map(l => l.total)),
      runs: lines.filter(l => !('total' in l)),
    };
  };
  const runs = prRuns(
    JOB_WORKFLOWS.flatMap(workflow => listRunsByDay(listRange(workflow), since, date)),
    repo,
  );
  const laterGreenRun = run =>
    runs.some(
      r =>
        r.id !== run.id &&
        r.workflow_id === run.workflow_id &&
        r.head_sha === run.head_sha &&
        r.created_at > run.created_at &&
        r.conclusion === 'success',
    );

  const compareCache = new Map();
  const toInspect = runsToInspect(runs);
  const ready = (run, seen) => waitingRunReady(runs, run, seen);
  const remembered = toInspect.filter(r => tiers.inspected_runs?.[r.id]?.attempt === r.run_attempt);
  const skipped = remembered.filter(r => !tiers.inspected_runs[r.id].waiting || !ready(r, tiers.inspected_runs[r.id]));
  console.error(
    `inspecting ${toInspect.length - skipped.length} of ${runs.length} PR runs since ${since} (${skipped.length} settled or still waiting)`,
  );
  const inspectRun = run => {
    const failures = [];
    const jobs = runJobs(run.id);
    const passedLater = job =>
      jobs.some(j => j.name === job.name && j.run_attempt > job.run_attempt && j.conclusion === 'success') ||
      laterGreenRun(run);
    for (const job of jobs.filter(j => j.conclusion === 'failure')) {
      const failedOn = job.completed_at?.slice(0, 10) ?? run.created_at.slice(0, 10);
      if (!isFileListJob(job.name)) {
        const { failed } = jobKeysFor(job.workflow_name, job.name, () => jobLog(job.id));
        const settled = Date.now() - Date.parse(job.completed_at ?? run.created_at) >= JOB_SETTLE_MS;
        const verdict = passedLater(job) ? 'flake' : settled ? 'fail' : 'unresolved';
        const settlesAt = new Date(Date.parse(job.completed_at ?? run.created_at) + JOB_SETTLE_MS).toISOString();
        for (const key of failed)
          failures.push({ file: key, jobId: String(job.id), date: failedOn, verdict, settlesAt });
        continue;
      }
      const rerunPassed = passedLater(job);
      const next = nextGreenRun(runs, run);
      let diffFiles = null;
      if (next && !rerunPassed) {
        const key = `${run.head_sha}...${next.head_sha}`;
        if (!compareCache.has(key)) {
          const pages = ghJson(`repos/${repo}/compare/${key}?per_page=100`, '-q', '{files}|@json');
          compareCache.set(
            key,
            compareFiles(pages) ?? gitDiffFiles(run.head_sha, next.head_sha, undefined, { stopAt: ghStopAt }),
          );
        }
        diffFiles = compareCache.get(key);
      }
      for (const file of failingFilesFromLog(jobLog(job.id))) {
        failures.push({
          file,
          jobId: String(job.id),
          date: failedOn,
          pkgDir: packageDir(file),
          rerunPassed,
          nextGreenHead: next?.head_sha,
          diffFiles,
        });
      }
    }
    return failures;
  };
  const inspected = inspectRuns(tiers, toInspect, inspectRun, {
    deadline: startedAt + Number(budgetMinutes) * 60_000,
    ready,
  });
  if (inspected.left) {
    console.error(
      `stopped early (time budget ${budgetMinutes} min or GitHub errors): ${inspected.left} runs left for the next run; no files move out today`,
    );
  }
  const { tally, caught, removed, added, out } = settleDay(tiers, inspected, date, Number(days), repoTestFiles());
  console.error(`PR failures since ${since}: ${JSON.stringify(tally)}`);
  console.error(
    `catches and job failures: ${caught.length} in; deleted: ${removed.length}; new: ${added.length}; moved out: ${out.length}`,
  );
  for (const f of caught) console.error(`  in ${f}`);
  for (const f of out) console.error(`  out ${f}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const args = {
    tiers: null,
    runId: null,
    days: String(LOOKBACK_DAYS),
    date: new Date().toISOString().slice(0, 10),
    budgetMinutes: String(DAILY_BUDGET_MINUTES),
  };
  for (const arg of rest) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    const key = m?.[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!m || !(key in args)) throw new Error(`unknown argument ${arg}`);
    args[key] = m[2];
  }
  if (!args.tiers) throw new Error('--tiers=<file> is required');
  const tiers = JSON.parse(fs.readFileSync(args.tiers, 'utf8'));
  if (command === 'versioning') {
    if (!args.runId) throw new Error('--run-id=<id> is required');
    versioningCommand(tiers, args);
  } else if (command === 'daily') {
    dailyCommand(tiers, args);
  } else {
    throw new Error(`unknown command ${command}; use versioning or daily`);
  }
  tiers.updated = args.date;
  fs.writeFileSync(args.tiers, `${JSON.stringify(tiers, null, 2)}\n`);
}
