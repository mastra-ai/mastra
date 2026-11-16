import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  addJobKeys,
  applyCatches,
  applyVersioningFailures,
  classifyPrFailure,
  compareFiles,
  failingFilesFromLog,
  isTransientGhError,
  projectRootsFromConfigs,
  gitDiffFiles,
  jobKeysFor,
  moveOut,
  nextGreenRun,
  prRuns,
  recordPrFailures,
  retryTransient,
  runsToInspect,
  syncFiles,
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
    // An HTTP/2 stream GitHub reset mid-response, seen paging run lists on Nov 16.
    'stream error: stream ID 3; CANCEL; received from peer',
    'stream error: stream ID 7; INTERNAL_ERROR; received from peer',
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
