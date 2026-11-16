import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  addJobKeys,
  boundedGh,
  applyCatches,
  applyVersioningFailures,
  classifyPrFailure,
  compareFiles,
  failingFilesFromLog,
  isTransientGhError,
  projectRootsFromConfigs,
  gitDiffFiles,
  inspectRuns,
  jobKeysFor,
  listRunsByDay,
  moveOut,
  nextGreenRun,
  prRuns,
  recordPrFailures,
  retryTransient,
  runsToInspect,
  settleDay,
  syncFiles,
  waitingRunReady,
} from './update.mjs';

const tiers = files => ({ version: 1, updated: '2026-11-01', scope: 'core-list', files });
const out = { tier: 'out', since: '2026-11-01', last_failure: null, reason: 'seed-rule-b' };

test('a versioning-PR failure moves the file in from today', () => {
  const t = tiers({ 'packages/core/src/a.test.ts': { ...out } });
  const moved = applyVersioningFailures(
    t,
    ['packages/core/src/a.test.ts', 'packages/core/src/a.test.ts'],
    '2026-12-03',
  );
  assert.deepEqual(moved, ['packages/core/src/a.test.ts']);
  assert.deepEqual(t.files['packages/core/src/a.test.ts'], {
    tier: 'in',
    since: '2026-12-03',
    last_failure: '2026-12-03',
    reason: 'versioning-fail',
  });
});

test('a versioning-PR failure in an E2E file is ignored', () => {
  const t = tiers({});
  assert.deepEqual(applyVersioningFailures(t, ['e2e-tests/monorepo/monorepo.test.ts'], '2026-12-03'), []);
  assert.deepEqual(t.files, {});
});

test('a source fix on the PR is a catch', () => {
  const cls = classifyPrFailure({
    pkgDir: 'packages/memory',
    rerunPassed: false,
    nextGreenHead: 'b',
    diffFiles: ['packages/memory/src/index.ts', 'packages/memory/src/index.test.ts'],
  });
  assert.equal(cls, 'catch');
});

test('a core source fix catches a non-core file; a fix in another package does not', () => {
  const base = { pkgDir: 'packages/memory', rerunPassed: false, nextGreenHead: 'b' };
  assert.equal(classifyPrFailure({ ...base, diffFiles: ['packages/core/src/agent/index.ts'] }), 'catch');
  assert.equal(classifyPrFailure({ ...base, diffFiles: ['stores/pg/src/index.ts'] }), 'other');
  assert.equal(
    classifyPrFailure({ ...base, pkgDir: 'packages/core', diffFiles: ['packages/memory/src/index.ts'] }),
    'other',
  );
});

test('a rerun pass is a flake, a test-only fix is not a catch, no green head is unresolved', () => {
  const base = { pkgDir: 'packages/core', nextGreenHead: 'b', diffFiles: ['packages/core/src/x.ts'] };
  assert.equal(classifyPrFailure({ ...base, rerunPassed: true }), 'flake');
  assert.equal(
    classifyPrFailure({ ...base, rerunPassed: false, diffFiles: ['packages/core/src/x.test.ts'] }),
    'test-fix',
  );
  assert.equal(classifyPrFailure({ ...base, rerunPassed: false, nextGreenHead: undefined }), 'unresolved');
});

test('a catch restarts the clock and brings an out file in', () => {
  const t = tiers({
    'packages/core/src/a.test.ts': { ...out },
    'packages/core/src/b.test.ts': { tier: 'in', since: '2026-09-10', last_failure: '2026-09-10', reason: 'pr-fail' },
  });
  const changed = applyCatches(t, [
    { file: 'packages/core/src/a.test.ts', date: '2026-12-02' },
    { file: 'packages/core/src/b.test.ts', date: '2026-11-05' },
  ]);
  assert.deepEqual(changed, ['packages/core/src/a.test.ts', 'packages/core/src/b.test.ts']);
  assert.deepEqual(t.files['packages/core/src/a.test.ts'], {
    tier: 'in',
    since: '2026-12-02',
    last_failure: '2026-12-02',
    reason: 'pr-catch',
  });
  assert.deepEqual(t.files['packages/core/src/b.test.ts'], {
    tier: 'in',
    since: '2026-09-10',
    last_failure: '2026-11-05',
    reason: 'pr-catch',
  });
  // The caught file is no longer 30 days clean on the day the old clock would have run out.
  assert.deepEqual(moveOut(t, '2026-11-10'), []);
});

test('an older catch never moves last_failure back', () => {
  const t = tiers({
    'packages/core/src/b.test.ts': { tier: 'in', since: '2026-09-10', last_failure: '2026-11-05', reason: 'pr-catch' },
  });
  assert.deepEqual(applyCatches(t, [{ file: 'packages/core/src/b.test.ts', date: '2026-11-01' }]), []);
  assert.equal(t.files['packages/core/src/b.test.ts'].last_failure, '2026-11-05');
});

test('files in and clean for 30 days move out; anything newer stays in', () => {
  const t = tiers({
    'clean.test.ts': { tier: 'in', since: '2026-09-01', last_failure: null, reason: 'new' },
    'edge.test.ts': { tier: 'in', since: '2026-10-01', last_failure: '2026-10-01', reason: 'pr-fail' },
    'recent-failure.test.ts': { tier: 'in', since: '2026-08-01', last_failure: '2026-10-02', reason: 'pr-catch' },
    'new.test.ts': { tier: 'in', since: '2026-10-25', last_failure: null, reason: 'new' },
    'already-out.test.ts': { ...out, since: '2026-08-01' },
  });
  assert.deepEqual(moveOut(t, '2026-10-31'), ['clean.test.ts', 'edge.test.ts']);
  assert.deepEqual(t.files['clean.test.ts'], {
    tier: 'out',
    since: '2026-10-31',
    last_failure: null,
    reason: 'clean-30-days',
  });
  assert.equal(t.files['recent-failure.test.ts'].tier, 'in');
  assert.equal(t.files['new.test.ts'].tier, 'in');
  assert.equal(t.files['already-out.test.ts'].since, '2026-08-01');
});

test('a new file stays in until it has had its 30 days', () => {
  const t = { ...tiers({}), scope: 'all' };
  const { added } = syncFiles(t, ['packages/core/src/new.test.ts', 'e2e-tests/x/a.test.ts'], '2026-11-02');
  assert.deepEqual(added, ['packages/core/src/new.test.ts']);
  assert.deepEqual(moveOut(t, '2026-12-01'), []);
  assert.deepEqual(moveOut(t, '2026-12-02'), ['packages/core/src/new.test.ts']);
});

test('sync drops deleted files and, on the core list, does not add files', () => {
  const t = tiers({ 'gone.test.ts': { ...out }, 'kept.test.ts': { ...out } });
  const result = syncFiles(t, ['kept.test.ts', 'other.test.ts'], '2026-11-02');
  assert.deepEqual(result, { removed: ['gone.test.ts'], added: [] });
  assert.deepEqual(Object.keys(t.files), ['kept.test.ts']);
});

test('reads failing files from a unit job log', () => {
  const log = [
    '2026-10-31T10:00:00.0000000Z  FAIL  unit:packages/core  src/agent/a.test.ts > agent > does a thing',
    '2026-10-31T10:00:01.0000000Z  FAIL  unit:packages/core  src/agent/a.test.ts > agent > does another',
    '2026-10-31T10:00:02.0000000Z \x1b[31m FAIL \x1b[39m stores/pg/src/b.test.ts > pg',
    '2026-10-31T10:00:03.0000000Z  ✓ unit:packages/core  src/agent/c.test.ts',
    '2026-10-31T10:00:04.0000000Z  FAIL  [ packages/memory/src/d.test.ts ]',
  ].join('\n');
  assert.deepEqual(
    failingFilesFromLog(log, [
      'packages/core/src/agent/a.test.ts',
      'packages/memory/src/d.test.ts',
      'stores/pg/src/b.test.ts',
    ]),
    ['packages/core/src/agent/a.test.ts', 'packages/memory/src/d.test.ts', 'stores/pg/src/b.test.ts'],
  );
});

test('maps a vitest project name that is not a directory to the real test file', () => {
  const log = [
    '2026-11-14T10:00:00.0000000Z  FAIL  unit:packages/core-isolated  src/agent/__tests__/lease.test.ts > lease',
    '2026-11-14T10:00:01.0000000Z  FAIL  unit:packages/core:durable-other-storage-version  src/agent/d.test.ts > d',
    '2026-11-14T10:00:02.0000000Z  FAIL  unit:mastracode-core  src/only-here.test.ts > x',
    '2026-11-14T10:00:03.0000000Z  FAIL  unit:packages/core  src/agent/gone.test.ts > deleted since',
    '2026-11-14T10:00:04.0000000Z  FAIL  [ packages/memory/src/gone.test.ts ]',
  ].join('\n');
  const tracked = [
    'packages/core/src/agent/__tests__/lease.test.ts',
    'packages/core/src/agent/d.test.ts',
    'packages/memory/src/agent/d.test.ts',
    'mastracode/sdk/src/only-here.test.ts',
  ];
  assert.deepEqual(failingFilesFromLog(log, tracked, new Map()), [
    'mastracode/sdk/src/only-here.test.ts',
    'packages/core/src/agent/__tests__/lease.test.ts',
    'packages/core/src/agent/d.test.ts',
  ]);
});

test('resolves a project alias through the config that names it, even when the relative path is not unique', () => {
  const roots = projectRootsFromConfigs([
    ['mastracode/sdk/vitest.config.ts', "projects: [{ test: { name: 'unit:mastracode-core' } }]"],
    ['mastracode/factory/vitest.config.ts', "projects: [{ test: { name: 'unit:mastra-factory' } }]"],
    ['packages/core/vitest.config.ts', "{ name: 'unit:packages/core' }, { name: `unit:${dynamic}` }"],
  ]);
  assert.deepEqual([...roots.keys()], ['unit:mastracode-core', 'unit:mastra-factory', 'unit:packages/core']);
  const log = [
    '2026-11-14T10:00:00.0000000Z  FAIL  unit:mastracode-core  src/index.test.ts > x',
    '2026-11-14T10:00:01.0000000Z  FAIL  unit:mastra-factory  src/index.test.ts > y',
  ].join('\n');
  const tracked = [
    'mastracode/sdk/src/index.test.ts',
    'mastracode/factory/src/index.test.ts',
    'packages/core/src/index.test.ts',
    'packages/memory/src/index.test.ts',
  ];
  assert.deepEqual(failingFilesFromLog(log, tracked, roots), [
    'mastracode/factory/src/index.test.ts',
    'mastracode/sdk/src/index.test.ts',
  ]);
});

test('a deleted file is dropped, not moved to another package that has the same relative path', () => {
  const roots = projectRootsFromConfigs([['packages/core/vitest.config.ts', "{ name: 'unit:packages/core' }"]]);
  const log = [
    '2026-11-14T10:00:00.0000000Z  FAIL  unit:packages/core  src/agent/gone.test.ts > x',
    '2026-11-14T10:00:01.0000000Z  FAIL  unit:packages/core-isolated  src/agent/gone.test.ts > x',
    '2026-11-14T10:00:02.0000000Z  FAIL  unit:packages/nope  src/agent/gone.test.ts > x',
  ].join('\n');
  const tracked = ['packages/core/src/a.test.ts', 'packages/memory/src/agent/gone.test.ts'];
  assert.deepEqual(failingFilesFromLog(log, tracked, roots), []);
  assert.deepEqual(failingFilesFromLog(log, tracked, new Map()), []);
});

test('a log flooded with FAIL lines resolves without rescanning every tracked file per line', () => {
  const tracked = Array.from({ length: 6000 }, (_, i) => `packages/p${i % 60}/src/f${i}.test.ts`);
  const lines = Array.from(
    { length: 50_000 },
    (_, i) => `2026-11-14T10:00:00.0000000Z  FAIL  unit:fake-${i}  src/f${i % 6000}.test.ts > x`,
  );
  lines.push('2026-11-14T10:00:01.0000000Z  FAIL  unit:packages/p7-isolated  src/f7.test.ts > x');
  const started = performance.now();
  const files = failingFilesFromLog(lines.join('\n'), tracked, new Map());
  const elapsed = performance.now() - started;
  assert.equal(files.length, 6000);
  assert.ok(files.includes('packages/p7/src/f7.test.ts'));
  assert.ok(elapsed < 2000, `took ${Math.round(elapsed)} ms`);
});

const prFailure = (overrides = {}) => ({
  file: 'packages/core/src/a.test.ts',
  jobId: '101',
  date: '2026-11-20',
  pkgDir: 'packages/core',
  rerunPassed: false,
  nextGreenHead: 'def',
  diffFiles: ['packages/core/src/a.ts'],
  ...overrides,
});

test('a catch fixed 10 days after the failure still counts, and only once', () => {
  const t = tiers({ 'packages/core/src/a.test.ts': { ...out } });
  const first = recordPrFailures(t, [prFailure()], '2026-11-30');
  assert.deepEqual(first.caught, ['packages/core/src/a.test.ts']);
  assert.deepEqual(first.tally, { catch: 1 });
  assert.equal(t.files['packages/core/src/a.test.ts'].tier, 'in');
  assert.equal(t.files['packages/core/src/a.test.ts'].last_failure, '2026-11-20');
  assert.deepEqual(t.files['packages/core/src/a.test.ts'].pr_failures, {
    101: { date: '2026-11-20', verdict: 'catch' },
  });

  const again = recordPrFailures(t, [prFailure()], '2026-12-01');
  assert.deepEqual(again.caught, []);
  assert.deepEqual(again.tally, { settled: 1 });
});

test('an unresolved failure is retried until its fix lands, inside the 14-day window', () => {
  const t = tiers({ 'packages/core/src/a.test.ts': { ...out } });
  const pending = recordPrFailures(t, [prFailure({ nextGreenHead: undefined, diffFiles: null })], '2026-11-21');
  assert.deepEqual(pending.tally, { unresolved: 1 });
  assert.equal(t.files['packages/core/src/a.test.ts'].tier, 'out');
  assert.equal(t.files['packages/core/src/a.test.ts'].pr_failures, undefined);

  const fixed = recordPrFailures(t, [prFailure()], '2026-12-03');
  assert.deepEqual(fixed.caught, ['packages/core/src/a.test.ts']);
});

test('failures older than 14 days are ignored and their verdicts pruned', () => {
  const t = tiers({
    'packages/core/src/a.test.ts': { ...out, pr_failures: { 7: { date: '2026-11-01', verdict: 'flake' } } },
  });
  const res = recordPrFailures(t, [prFailure({ date: '2026-11-10' })], '2026-11-30');
  assert.deepEqual(res.tally, {});
  assert.equal(t.files['packages/core/src/a.test.ts'].tier, 'out');
  assert.equal(t.files['packages/core/src/a.test.ts'].pr_failures, undefined);
});

test('a flake is recorded so it is not reclassified, and keeps the file out', () => {
  const t = tiers({ 'packages/core/src/a.test.ts': { ...out } });
  recordPrFailures(t, [prFailure({ rerunPassed: true })], '2026-11-21');
  assert.equal(t.files['packages/core/src/a.test.ts'].tier, 'out');
  assert.deepEqual(t.files['packages/core/src/a.test.ts'].pr_failures, {
    101: { date: '2026-11-20', verdict: 'flake' },
  });
  // A later green head on the branch must not turn the settled flake into a catch.
  const res = recordPrFailures(t, [prFailure()], '2026-11-22');
  assert.deepEqual(res.caught, []);
});

test('moving out keeps recorded verdicts', () => {
  const t = tiers({
    'packages/core/src/a.test.ts': {
      tier: 'in',
      since: '2026-09-01',
      last_failure: null,
      reason: 'new',
      pr_failures: { 5: { date: '2026-11-25', verdict: 'flake' } },
    },
  });
  assert.deepEqual(moveOut(t, '2026-11-30'), ['packages/core/src/a.test.ts']);
  assert.deepEqual(t.files['packages/core/src/a.test.ts'].pr_failures, {
    5: { date: '2026-11-25', verdict: 'flake' },
  });
});

test('maps CI job names to tier keys', () => {
  const key = (workflow, name) => jobKeysFor(workflow, name).failed;
  assert.deepEqual(key('Prebuild', 'Combined Store Tests / test (pg)'), ['job:store/pg']);
  assert.deepEqual(key('Prebuild', 'Memory Tests'), ['job:memory']);
  assert.deepEqual(key('Prebuild', 'Workspace Tests / test-docker (s3)'), ['job:workspace-docker/s3']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / E2E monorepo'), ['job:e2e/monorepo']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / E2E kitchen-sink (3/4)'), ['job:e2e/kitchen-sink']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / E2E client-js (optional)'), ['job:e2e/client-js']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / E2E MCP compatibility'), ['job:e2e/mcp-compat']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / E2E Type check'), ['job:e2e/type-check']);
  assert.deepEqual(key('Prebuild', 'E2E Tests / Publish E2E registry'), []);
  assert.deepEqual(key('Prebuild', 'Mastra Code E2E / Mastra Code web host OM scenarios'), ['job:mastracode-om']);
  assert.deepEqual(key('Workspace Cloud Tests', 'test-cloud (e2b)'), ['job:workspace-cloud/e2b']);
  assert.deepEqual(key('Quality assurance', 'Validate changeset packages'), ['job:qa/changeset-check']);
  assert.deepEqual(key('Prebuild', 'Unit and E2E Tests / Affected UNIT Test'), []);
});

test('a folded job fails only the packages that started and never finished', () => {
  // Lines as pnpm -r prints them in the light-stores job (run 41359171549).
  const log = [
    '2026-11-01T22:52:55.8508899Z stores/azure-ai-search test$ vitest run',
    '2026-11-01T22:52:55.8513300Z stores/convex test$ vitest run',
    '2026-11-01T22:53:03.5465991Z stores/azure-ai-search test: Done',
    '2026-11-01T22:53:03.5693597Z stores/oracledb test$ pnpm test:unit',
    '2026-11-01T22:53:28.8964272Z stores/oracledb test: Done',
    '2026-11-01T22:53:30.0000000Z \x1b[31mstores/convex test: Failed\x1b[39m',
  ].join('\n');
  const result = jobKeysFor('Prebuild', 'Combined Store Tests / test (light stores)', () => log);
  assert.deepEqual(result.ran, ['job:store/azure-ai-search', 'job:store/convex', 'job:store/oracledb']);
  assert.deepEqual(result.failed, ['job:store/convex']);
  const ws = jobKeysFor(
    'Prebuild',
    'Workspace Tests / test-unit',
    () =>
      'workspaces/e2b test:unit$ vitest run\nworkspaces/e2b test:unit: Done\nworkspaces/daytona test:unit$ vitest run',
  );
  assert.deepEqual(ws.failed, ['job:workspace-unit/daytona']);
});

test('job keys survive sync and join the list in from the versioning run (all scope only)', () => {
  const t = {
    scope: 'all',
    files: { 'job:memory': { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'x' } },
  };
  syncFiles(t, ['packages/core/src/a.test.ts'], '2026-11-02');
  assert.ok(t.files['job:memory']);
  assert.deepEqual(addJobKeys(t, ['job:memory', 'job:store/pg', 'job:store/pg'], '2026-11-02'), ['job:store/pg']);
  assert.deepEqual(t.files['job:store/pg'], { tier: 'in', since: '2026-11-02', last_failure: null, reason: 'new' });
  assert.deepEqual(addJobKeys({ scope: 'core-list', files: {} }, ['job:store/pg'], '2026-11-02'), []);
});

test('a failed job brings its key in; a flake or an unsettled failure does not', () => {
  const t = {
    files: {
      'job:store/pg': { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'x' },
      'job:memory': { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'x' },
      'job:e2e/monorepo': { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'x' },
    },
  };
  const { tally, caught } = recordPrFailures(
    t,
    [
      { file: 'job:store/pg', jobId: '1', date: '2026-11-01', verdict: 'fail' },
      { file: 'job:memory', jobId: '2', date: '2026-11-01', verdict: 'flake' },
      { file: 'job:e2e/monorepo', jobId: '3', date: '2026-11-02', verdict: 'unresolved' },
    ],
    '2026-11-02',
  );
  assert.deepEqual(tally, { fail: 1, flake: 1, unresolved: 1 });
  assert.deepEqual(caught, ['job:store/pg']);
  assert.equal(t.files['job:store/pg'].tier, 'in');
  assert.equal(t.files['job:store/pg'].last_failure, '2026-11-01');
  assert.equal(t.files['job:store/pg'].reason, 'pr-job-fail');
  assert.equal(t.files['job:memory'].tier, 'out');
  assert.deepEqual(t.files['job:memory'].pr_failures, { 2: { date: '2026-11-01', verdict: 'flake' } });
  assert.equal(t.files['job:e2e/monorepo'].pr_failures, undefined);
  // The same failure seen again the next day is already settled.
  assert.deepEqual(
    recordPrFailures(t, [{ file: 'job:store/pg', jobId: '1', date: '2026-11-01', verdict: 'fail' }], '2026-11-03')
      .caught,
    [],
  );
});

test('a versioning-run job failure brings the job in', () => {
  const t = {
    files: { 'job:e2e/kitchen-sink': { tier: 'out', since: '2026-10-01', last_failure: null, reason: 'x' } },
  };
  assert.deepEqual(applyVersioningFailures(t, ['job:e2e/kitchen-sink'], '2026-11-02'), ['job:e2e/kitchen-sink']);
  assert.equal(t.files['job:e2e/kitchen-sink'].tier, 'in');
});

test("keeps PR runs from a fork's main branch, drops runs on this repo's main", () => {
  const runs = [
    { id: 1, head_branch: 'main', head_repo: 'mastra-ai/mastra', created_at: '2026-11-02' },
    { id: 2, head_branch: 'main', head_repo: 'someone/mastra', created_at: '2026-11-01' },
    { id: 3, head_branch: 'fix', head_repo: 'mastra-ai/mastra', created_at: '2026-11-03' },
  ];
  assert.deepEqual(
    prRuns(runs, 'mastra-ai/mastra').map(r => r.id),
    [2, 3],
  );
});

test('only finished runs that may hold a failed job get their jobs fetched', () => {
  const runs = [
    { id: 1, conclusion: 'success' },
    { id: 2, conclusion: 'failure' },
    { id: 3, conclusion: 'skipped' },
    { id: 4, conclusion: 'cancelled' },
    { id: 5, conclusion: null },
    { id: 6, conclusion: 'timed_out' },
  ];
  assert.deepEqual(
    runsToInspect(runs).map(r => r.id),
    [2, 4, 6],
  );
});

// Like GitHub's run listing: every run created in the range counts in total_count,
// but only the first 1,000 of them can be read.
const fakeRunListing = runs => {
  const calls = [];
  const list = range => {
    calls.push(range);
    const [from, to] = range.split('..');
    const matching = runs.filter(r => r.created_at >= from && r.created_at <= to);
    return { total: matching.length, runs: matching.slice(0, 1000) };
  };
  return { list, calls };
};
const runsEvery = (from, to, minutes) => {
  const runs = [];
  for (let t = Date.parse(from); t < Date.parse(to); t += minutes * 60_000) {
    runs.push({ id: runs.length + 1, created_at: new Date(t).toISOString().replace('.000', '') });
  }
  return runs;
};

test('lists every run in a 14-day window, though each listing stops at 1,000', () => {
  // About 290 runs a day, 4,032 in all: one listing for the window would see a quarter of them.
  const runs = runsEvery('2026-11-02T00:00:00Z', '2026-11-17T00:00:00Z', 5);
  const { list, calls } = fakeRunListing(runs);
  const listed = listRunsByDay(list, '2026-11-02', '2026-11-16');
  assert.equal(listed.length, runs.length);
  assert.deepEqual(new Set(listed.map(r => r.id)).size, runs.length);
  assert.equal(calls.length, 15);
  assert.deepEqual(calls[0], '2026-11-02T00:00:00Z..2026-11-02T23:59:59Z');
});

test('a day with more than 1,000 runs is split until every part fits', () => {
  // 2,880 runs on Nov 3 alone.
  const busy = runsEvery('2026-11-03T00:00:00Z', '2026-11-04T00:00:00Z', 0.5);
  const { list } = fakeRunListing(busy);
  const listed = listRunsByDay(list, '2026-11-02', '2026-11-04');
  assert.equal(listed.length, busy.length);
  assert.equal(new Set(listed.map(r => r.id)).size, busy.length);
});

const run = (id, day, attempt = 1) => ({
  id,
  created_at: `2026-11-${day}T10:00:00Z`,
  conclusion: 'failure',
  run_attempt: attempt,
});
const settledFailure = { file: 'packages/core/src/a.test.ts', jobId: '1', date: '2026-11-10', rerunPassed: true };
const openFailure = { file: 'packages/core/src/b.test.ts', jobId: '2', date: '2026-11-10', pkgDir: 'packages/core' };

test('a run whose failures are all settled is remembered; one with an open failure is not', () => {
  const t = tiers({});
  const failuresOf = { 1: [settledFailure], 2: [openFailure], 3: [] };
  const result = inspectRuns(t, [run(1, 10), run(2, 10), run(3, 11)], r => failuresOf[r.id], {
    deadline: Infinity,
  });
  assert.deepEqual(
    result.settled.map(r => r.id),
    [3, 1],
  );
  assert.equal(result.left, 0);
  assert.equal(result.failures.length, 2);
  assert.deepEqual(
    result.waiting.map(w => w.run.id),
    [2],
  );
  settleDay(t, result, '2026-11-16', 14, []);
  assert.deepEqual(t.inspected_runs, {
    1: { day: '2026-11-10', attempt: 1 },
    2: { day: '2026-11-10', attempt: 1, waiting: true },
    3: { day: '2026-11-11', attempt: 1 },
  });
});

test('a run still waiting for a green head is not fetched again until one could settle it', () => {
  const t = tiers({});
  t.inspected_runs = {
    1: { day: '2026-11-10', attempt: 1, waiting: true },
    2: { day: '2026-11-10', attempt: 1, waiting: true },
  };
  const fetched = [];
  const result = inspectRuns(t, [run(1, 10), run(2, 10), run(3, '09')], r => (fetched.push(r.id), []), {
    deadline: Infinity,
    ready: r => r.id === 2,
  });
  assert.deepEqual(fetched, [2, 3]);
  settleDay(t, result, '2026-11-16', 14, []);
  assert.deepEqual(t.inspected_runs, {
    1: { day: '2026-11-10', attempt: 1, waiting: true },
    2: { day: '2026-11-10', attempt: 1 },
    3: { day: '2026-11-09', attempt: 1 },
  });
});

test('newer runs that stay unresolved cannot starve an older catch out of the window', () => {
  const file = 'packages/core/src/a.test.ts';
  const t = tiers({ [file]: { tier: 'in', since: '2026-09-01', last_failure: '2026-10-01', reason: 'pr-catch' } });
  const runs = [run(1, '03'), run(2, 14), run(3, 15)];
  const caught = {
    file,
    jobId: '1',
    date: '2026-11-03',
    pkgDir: 'packages/core',
    nextGreenHead: 'b',
    diffFiles: ['packages/core/src/a.ts'],
  };
  const open = id => ({
    file: 'packages/core/src/b.test.ts',
    jobId: String(id),
    date: '2026-11-15',
    pkgDir: 'packages/core',
  });
  // Each day the budget covers two runs; runs 2 and 3 never see a green head.
  const day = date => {
    let clock = 0;
    const result = inspectRuns(t, runs, r => ((clock += 10), r.id === 1 ? [caught] : [open(r.id)]), {
      deadline: 20,
      now: () => clock,
      ready: () => false,
    });
    return settleDay(t, result, date, 14, [file]);
  };
  day('2026-11-15');
  day('2026-11-16');
  assert.equal(t.files[file].last_failure, '2026-11-03');
  assert.equal(t.inspected_runs[1].attempt, 1);
});

test('a waiting run is ready once its branch has a later green run, or its failed job is old enough to call', () => {
  const failed = {
    id: 1,
    workflow_id: 7,
    head_repo: 'o/r',
    head_branch: 'x',
    head_sha: 'a',
    created_at: '2026-11-10T10:00:00Z',
  };
  const green = (over = {}) => ({
    ...failed,
    id: 2,
    head_sha: 'b',
    created_at: '2026-11-11T10:00:00Z',
    conclusion: 'success',
    ...over,
  });
  const seen = { day: '2026-11-10', attempt: 1, waiting: true };
  const now = '2026-11-20T06:17:00Z';
  assert.equal(waitingRunReady([failed, green()], failed, seen, now), true);
  assert.equal(waitingRunReady([failed, green({ head_sha: 'a' })], failed, seen, now), true);
  assert.equal(waitingRunReady([failed, green({ head_branch: 'y' })], failed, seen, now), false);
  assert.equal(waitingRunReady([failed, green({ conclusion: 'failure' })], failed, seen, now), false);
  // A failed job waits 24 hours from when it finished, however old the run is.
  const job = { ...seen, recheck_after: '2026-11-20T08:00:00Z' };
  assert.equal(waitingRunReady([failed], failed, job, now), false);
  assert.equal(waitingRunReady([failed], failed, job, '2026-11-21T06:17:00Z'), true);
});

test('a rerun whose failed job is too young to call is checked again once it is 24 hours old', () => {
  const t = tiers({});
  // Attempt 2 of a Nov 5 run failed a job on Nov 16 at 08:00.
  const young = {
    file: 'job:e2e/x',
    jobId: '9',
    date: '2026-11-16',
    verdict: 'unresolved',
    settlesAt: '2026-11-17T08:00:00Z',
  };
  settleDay(
    t,
    inspectRuns(t, [run(1, '05', 2)], () => [young], { deadline: Infinity }),
    '2026-11-16',
    14,
    [],
  );
  assert.deepEqual(t.inspected_runs, {
    1: { day: '2026-11-05', attempt: 2, waiting: true, recheck_after: '2026-11-17T08:00:00Z' },
  });
  const fetched = [];
  const on = nowIso =>
    inspectRuns(t, [run(1, '05', 2)], r => (fetched.push(r.id), [{ ...young, verdict: 'fail' }]), {
      deadline: Infinity,
      ready: (r, seen) => waitingRunReady([], r, seen, nowIso),
    });
  on('2026-11-17T06:17:00Z');
  assert.deepEqual(fetched, []);
  settleDay(t, on('2026-11-18T06:17:00Z'), '2026-11-18', 14, []);
  assert.deepEqual(fetched, [1]);
  assert.equal(t.files['job:e2e/x'].tier, 'in');
  assert.deepEqual(t.inspected_runs, { 1: { day: '2026-11-05', attempt: 2 } });
});

test('a remembered run is never fetched again; remembered runs leave with the window', () => {
  const t = tiers({});
  t.inspected_runs = { 1: { day: '2026-11-10', attempt: 1 }, 9: { day: '2026-11-01', attempt: 1 } };
  const fetched = [];
  const result = inspectRuns(t, [run(1, 10), run(2, 12)], r => (fetched.push(r.id), []), { deadline: Infinity });
  assert.deepEqual(fetched, [2]);
  settleDay(t, result, '2026-11-16', 14, []);
  assert.deepEqual(t.inspected_runs, {
    1: { day: '2026-11-10', attempt: 1 },
    2: { day: '2026-11-12', attempt: 1 },
  });
});

test('past the deadline the rest waits for tomorrow, and nothing moves out on a partial day', () => {
  const old = { tier: 'in', since: '2026-09-01', last_failure: '2026-10-01', reason: 'pr-catch' };
  const t = tiers({ 'packages/core/src/a.test.ts': { ...old } });
  let clock = 0;
  const result = inspectRuns(t, [run(1, 10), run(2, 11), run(3, 12)], () => ((clock += 10), []), {
    deadline: 15,
    now: () => clock,
  });
  assert.deepEqual(
    result.settled.map(r => r.id),
    [3, 2],
  );
  assert.equal(result.left, 1);
  const partial = settleDay(t, result, '2026-11-16', 14, ['packages/core/src/a.test.ts']);
  assert.deepEqual(partial.out, []);
  assert.equal(t.files['packages/core/src/a.test.ts'].tier, 'in');
  assert.deepEqual(Object.keys(t.inspected_runs), ['2', '3']);

  const rest = inspectRuns(t, [run(1, 10), run(2, 11), run(3, 12)], () => [], { deadline: Infinity });
  assert.deepEqual(
    rest.settled.map(r => r.id),
    [1],
  );
  const complete = settleDay(t, rest, '2026-11-16', 14, ['packages/core/src/a.test.ts']);
  assert.deepEqual(complete.out, ['packages/core/src/a.test.ts']);
});

test('a GitHub outage that outlasts the retries ends the day early but keeps what was settled', () => {
  const t = tiers({});
  const down = Object.assign(new Error('Command failed'), { stderr: 'gh: Server Error (HTTP 502)' });
  const result = inspectRuns(
    t,
    [run(1, 10), run(2, 11), run(3, 12)],
    r => {
      if (r.id === 2) throw down;
      return [];
    },
    { deadline: Infinity },
  );
  assert.deepEqual(
    result.settled.map(r => r.id),
    [3],
  );
  assert.equal(result.left, 2);
  const gone = Object.assign(new Error('Command failed'), { stderr: 'gh: Not Found (HTTP 404)' });
  assert.throws(
    () =>
      inspectRuns(
        t,
        [run(1, 10)],
        () => {
          throw gone;
        },
        { deadline: Infinity },
      ),
    gone,
  );
});

test('a rerun of a remembered run is inspected again, and its catch keeps the file in', () => {
  const file = 'packages/core/src/a.test.ts';
  const t = tiers({ [file]: { tier: 'in', since: '2026-09-01', last_failure: '2026-10-01', reason: 'pr-catch' } });
  // Day 1: attempt 1 was cancelled before any job failed.
  settleDay(
    t,
    inspectRuns(t, [run(1, 10, 1)], () => [], { deadline: Infinity }),
    '2026-11-15',
    14,
    [file],
  );
  assert.deepEqual(t.inspected_runs, { 1: { day: '2026-11-10', attempt: 1 } });
  // Day 2: attempt 2 of the same run failed, and the next green head fixed source.
  const caught = {
    file,
    jobId: '7',
    date: '2026-11-15',
    pkgDir: 'packages/core',
    nextGreenHead: 'b',
    diffFiles: ['packages/core/src/a.ts'],
  };
  const fetched = [];
  const day2 = inspectRuns(t, [run(1, 10, 2)], r => (fetched.push(r.id), [caught]), { deadline: Infinity });
  assert.deepEqual(fetched, [1]);
  const { out } = settleDay(t, day2, '2026-11-16', 14, [file]);
  assert.deepEqual(out, []);
  assert.equal(t.files[file].tier, 'in');
  assert.equal(t.files[file].last_failure, '2026-11-15');
  assert.deepEqual(t.inspected_runs, { 1: { day: '2026-11-10', attempt: 2 } });
});

test('a run remembered without its attempt is inspected again', () => {
  const t = tiers({});
  t.inspected_runs = { 1: '2026-11-10' };
  const fetched = [];
  inspectRuns(t, [run(1, 10)], r => (fetched.push(r.id), []), { deadline: Infinity });
  assert.deepEqual(fetched, [1]);
});

test('the newest runs are inspected first, so a short day still covers the latest failures', () => {
  const fetched = [];
  const result = inspectRuns(tiers({}), [run(1, 10), run(2, 11), run(3, 12)], r => (fetched.push(r.id), []), {
    deadline: 1,
    now: () => fetched.length,
  });
  assert.deepEqual(fetched, [3]);
  assert.equal(result.left, 2);
});

test('the next green run must come from the same repository as the failing run', () => {
  const failing = {
    id: 1,
    workflow_id: 7,
    head_branch: 'patch-1',
    head_repo: 'alice/mastra',
    head_sha: 'a1',
    created_at: '2026-11-01T00:00:00Z',
    conclusion: 'failure',
  };
  const otherFork = {
    id: 2,
    workflow_id: 7,
    head_branch: 'patch-1',
    head_repo: 'bob/mastra',
    head_sha: 'b1',
    created_at: '2026-11-02T00:00:00Z',
    conclusion: 'success',
  };
  const sameFork = {
    id: 3,
    workflow_id: 7,
    head_branch: 'patch-1',
    head_repo: 'alice/mastra',
    head_sha: 'a2',
    created_at: '2026-11-03T00:00:00Z',
    conclusion: 'success',
  };
  assert.equal(nextGreenRun([failing, otherFork], failing), undefined);
  assert.equal(nextGreenRun([failing, otherFork, sameFork], failing), sameFork);
});

// GitHub's compare API pages its commits; only the first page carries `files`, later pages
// have `files: null`, and the list stops at 300 files (run 43566479365 died on page 2).
const page = (files, commits = 100) => ({ files: files && files.map(filename => ({ filename })), commits });

test('compare files: later pages without files are skipped', () => {
  assert.deepEqual(compareFiles([page(['packages/core/src/a.ts', 'docs/x.md']), page(null, 21)]), [
    'packages/core/src/a.ts',
    'docs/x.md',
  ]);
  assert.deepEqual(compareFiles([page([])]), []);
});

test('compare files: a response with no file list is unknown, not empty', () => {
  assert.equal(compareFiles([page(null), page(null, 21)]), null);
  assert.equal(compareFiles([]), null);
});

test('compare files: a list cut at the 300-file cap is not trusted', () => {
  const capped = Array.from({ length: 300 }, (_, i) => `packages/core/src/f${i}.ts`);
  assert.equal(compareFiles([page(capped), page(null, 21)]), null);
  assert.equal(compareFiles([page(capped.slice(1))]).length, 299);
});

// The daily workflow checks main out at depth 1. A PR head rebased onto that main descends from
// the shallow boundary, while an older PR head forks below it, so their merge base is not local.
test('git diff fallback: finds the merge base below the shallow checkout, with literal paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-git-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const commit = (cwd, file) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), file);
    git(cwd, 'add', '-A');
    git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', file);
    return git(cwd, 'rev-parse', 'HEAD');
  };
  try {
    const origin = path.join(dir, 'origin');
    fs.mkdirSync(origin);
    git(origin, 'init', '-q', '-b', 'main');
    git(origin, 'config', 'uploadpack.allowFilter', 'true');
    commit(origin, 'README.md');
    git(origin, 'checkout', '-q', '-b', 'old-pr');
    const base = commit(origin, 'packages/core/src/old.ts');
    git(origin, 'checkout', '-q', 'main');
    commit(origin, 'packages/core/src/a.ts');
    commit(origin, 'packages/core/src/b.ts');
    git(origin, 'checkout', '-q', '-b', 'new-pr');
    const head = commit(origin, 'packages/core/src/é.ts');
    git(origin, 'checkout', '-q', 'main');

    const clone = path.join(dir, 'clone');
    execFileSync('git', ['clone', '-q', '--depth=1', '--filter=blob:none', `file://${origin}`, clone]);
    assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true');

    assert.deepEqual(gitDiffFiles(base, head, clone).sort(), [
      'packages/core/src/a.ts',
      'packages/core/src/b.ts',
      'packages/core/src/é.ts',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A gh stand-in that exits like gh does on a GitHub error, so the retry sees the real error shape.
function failingGh(dir, stderrLines) {
  const counter = path.join(dir, 'calls');
  const bin = path.join(dir, 'gh');
  fs.writeFileSync(
    bin,
    `#!/bin/sh
n=$(cat "${counter}" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${counter}"
case $n in
${stderrLines.map((line, i) => `  ${i + 1}) echo '${line}' >&2; exit 1;;`).join('\n')}
esac
echo '{"ok":true}'
`,
    { mode: 0o755 },
  );
  return {
    call: () => execFileSync(bin, ['api', 'x'], { encoding: 'utf8', stdio: 'pipe' }),
    calls: () => Number(fs.readFileSync(counter, 'utf8')),
  };
}

test('gh retry: a 502 then success returns the response after one wait', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-retry-'));
  try {
    const gh = failingGh(dir, ['gh: Server Error (HTTP 502)']);
    const waits = [];
    assert.equal(retryTransient(gh.call, [5, 20, 60], ms => waits.push(ms)).trim(), '{"ok":true}');
    assert.deepEqual(waits, [5]);
    assert.equal(gh.calls(), 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gh retry: gives up after the last delay and throws the GitHub error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-retry-'));
  try {
    const gh = failingGh(dir, Array(4).fill('gh: Server Error (HTTP 503)'));
    const waits = [];
    assert.throws(
      () => retryTransient(gh.call, [5, 20, 60], ms => waits.push(ms)),
      e => /HTTP 503/.test(e.stderr),
    );
    assert.deepEqual(waits, [5, 20, 60]);
    assert.equal(gh.calls(), 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('gh retry: a 404 or an unknown flag fails at once', () => {
  for (const line of ['gh: Not Found (HTTP 404)', 'unknown flag: --allow-escape-sequences']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-retry-'));
    try {
      const gh = failingGh(dir, [line]);
      const waits = [];
      assert.throws(() => retryTransient(gh.call, [5], ms => waits.push(ms)));
      assert.deepEqual(waits, []);
      assert.equal(gh.calls(), 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('gh retry: which GitHub errors are transient', () => {
  const transient = [
    'gh: Server Error (HTTP 500)',
    'gh: Bad Gateway (HTTP 502)',
    'gh: Gateway Timeout (HTTP 504)',
    'gh: API rate limit exceeded (HTTP 403)',
    'gh: You have exceeded a secondary rate limit (HTTP 403)',
    'gh: Too Many Requests (HTTP 429)',
    'Get "https://api.github.com/x": read tcp: connection reset by peer',
    'Get "https://api.github.com/x": net/http: TLS handshake timeout',
    'Get "https://api.github.com/x": unexpected EOF',
    'Get "https://api.github.com/x": EOF',
  ];
  const permanent = [
    'gh: Not Found (HTTP 404)',
    'gh: Resource not accessible by integration (HTTP 403)',
    'gh: Validation Failed (HTTP 422)',
    'unknown flag: --allow-escape-sequences',
  ];
  for (const stderr of transient) assert.equal(isTransientGhError({ stderr }), true, stderr);
  for (const stderr of permanent) assert.equal(isTransientGhError({ stderr }), false, stderr);
});

test('gh calls stop at the hard limit: none starts after it, and each is cut off when it arrives', () => {
  const calls = [];
  const exec = (cmd, args, opts) => (calls.push(opts.timeout), '{}');
  assert.equal(boundedGh(['x'], { stopAt: 1_000, now: () => 400, exec, delays: [] }), '{}');
  assert.deepEqual(calls, [600]);
  assert.throws(
    () => boundedGh(['x'], { stopAt: 1_000, now: () => 1_000, exec, delays: [] }),
    e => isTransientGhError(e),
  );
  assert.equal(calls.length, 1);
});

test('gh retry: never waits past the hard limit', () => {
  let clock = 0;
  const waits = [];
  const down = Object.assign(new Error('Command failed'), { stderr: 'gh: Server Error (HTTP 502)' });
  const exec = () => {
    throw down;
  };
  assert.throws(
    () =>
      boundedGh(['x'], {
        stopAt: 30,
        now: () => clock,
        exec,
        delays: [5, 20, 60],
        sleep: ms => (waits.push(ms), (clock += ms)),
      }),
    down,
  );
  assert.deepEqual(waits, [5, 20]);
});

test('the git fallback diff stops at the hard limit too', () => {
  const calls = [];
  const exec = (cmd, args, opts) => (
    calls.push([args[0], opts.timeout]),
    args[0] === 'rev-parse' ? 'false\n' : 'a.ts\0'
  );
  assert.deepEqual(gitDiffFiles('a', 'b', '/x', { stopAt: 1_000, now: () => 400, exec }), ['a.ts']);
  assert.deepEqual(calls, [
    ['rev-parse', 600],
    ['fetch', 600],
    ['diff', 600],
  ]);
  assert.throws(
    () => gitDiffFiles('a', 'b', '/x', { stopAt: 1_000, now: () => 1_000, exec }),
    e => isTransientGhError(e),
  );
  assert.equal(calls.length, 3);
});
