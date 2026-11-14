#!/usr/bin/env node
// Keeps tiers.json on the ci/test-tiers branch current (see .github/workflows/test-tiers.yml).
//
//   node scripts/test-tiers/update.mjs versioning --tiers=<file> --run-id=<id> [--date=YYYY-MM-DD]
//     Every unit test file that failed in a versioning-PR Prebuild run moves `in`.
//   node scripts/test-tiers/update.mjs daily --tiers=<file> [--days=14] [--date=YYYY-MM-DD]
//     Failures on PRs in the last 14 days that the PR then fixed in source (a catch)
//     restart the file's 30-day clock, each failure counted once; deleted files leave; files clean for 30 days move `out`.
//
// The pure functions below hold the rules; the CLI only gathers GitHub data for them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOW_DAYS, isExternalE2eTest, isJobKey } from './select.mjs';

// PR failures are looked at for this long, so a fix that lands days later still counts.
export const LOOKBACK_DAYS = 14;

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

// ---------------------------------------------------------------------------------------------
// GitHub glue (not unit tested; exercised only in the workflow).

const repo = process.env.GITHUB_REPOSITORY ?? 'mastra-ai/mastra';
const gh = (...args) => execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const ghJson = (...args) =>
  gh('--paginate', ...args)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

/** Failing test files in a unit job's log, as repo paths (same parsing as the E4 crawl). */
export function failingFilesFromLog(log) {
  const files = new Set();
  for (const raw of log.split('\n')) {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '');
    if (!/^[0-9TZ:.-]+ +FAIL /.test(line)) continue;
    let m = /\[ ([^\]]+\.(?:test|spec)\.[a-z]+) \]/.exec(line);
    if (m) {
      files.add(m[1]);
      continue;
    }
    m = /FAIL +(\S+) +(\S+\.(?:test|spec)\.[a-z]+)/.exec(line);
    if (m) {
      files.add(`${m[1].split(':').slice(1).join(':') || m[1]}/${m[2]}`);
      continue;
    }
    m = /FAIL +(\S+\.(?:test|spec)\.[a-z]+)/.exec(line);
    if (m) files.add(m[1]);
  }
  return [...files].filter(f => TEST_FILE.test(f)).sort();
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

function repoTestFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(f => TEST_FILE.test(f) && !f.includes('node_modules/'));
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

function dailyCommand(tiers, { days, date }) {
  const since = daysBefore(date, Number(days));
  const runs = prRuns(
    JOB_WORKFLOWS.flatMap(workflow =>
      ghJson(
        `repos/${repo}/actions/workflows/${workflow}/runs?created=>=${since}&per_page=100`,
        '-q',
        '.workflow_runs[]|select(.event=="pull_request" or .event=="workflow_run")|{id,head_branch,head_repo:.head_repository.full_name,head_sha,created_at,conclusion,run_attempt,workflow_id}|@json',
      ),
    ),
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

  const failures = [];
  const compareCache = new Map();
  for (const run of runs.filter(r => r.conclusion && r.conclusion !== 'success')) {
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
        for (const key of failed) failures.push({ file: key, jobId: String(job.id), date: failedOn, verdict });
        continue;
      }
      const rerunPassed = passedLater(job);
      const next = nextGreenRun(runs, run);
      let diffFiles = null;
      if (next && !rerunPassed) {
        const key = `${run.head_sha}...${next.head_sha}`;
        if (!compareCache.has(key)) {
          compareCache.set(key, ghJson(`repos/${repo}/compare/${key}?per_page=100`, '-q', '.files[].filename|@json'));
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
  }
  const { tally, caught } = recordPrFailures(tiers, failures, date, Number(days));
  const { removed, added } = syncFiles(tiers, repoTestFiles(), date);
  const out = moveOut(tiers, date);
  console.error(`PR failures since ${since}: ${JSON.stringify(tally)}`);
  console.error(
    `catches and job failures: ${caught.length} in; deleted: ${removed.length}; new: ${added.length}; moved out: ${out.length}`,
  );
  for (const f of caught) console.error(`  in ${f}`);
  for (const f of out) console.error(`  out ${f}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const args = { tiers: null, runId: null, days: String(LOOKBACK_DAYS), date: new Date().toISOString().slice(0, 10) };
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
