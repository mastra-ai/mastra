import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { makePathMapper, seedTiers } from './seed.mjs';
import { jobOwnPaths } from './select.mjs';

test('maps failure paths through renames and a unique src/ tail', () => {
  const map = makePathMapper(
    ['mastracode/factory/src/a.test.ts', 'packages/core/src/b.test.ts', 'x/src/dup.test.ts', 'y/src/dup.test.ts'],
    { 'packages/core/src/old-b.test.ts': 'packages/core/src/b.test.ts' },
  );
  assert.equal(map('packages/core/src/old-b.test.ts'), 'packages/core/src/b.test.ts');
  assert.equal(map('mastra-factory/src/a.test.ts'), 'mastracode/factory/src/a.test.ts');
  assert.equal(map('z/src/dup.test.ts'), null);
  assert.equal(map('deleted/src/gone.test.ts'), null);
});

test('seed: files added before the 30-day window with no failure inside it go out', () => {
  const qualify = [
    { file: 'packages/core/src/old.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/new.test.ts', added: '2026-10-15' },
    { file: 'packages/core/src/ver.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/old-ver.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/pr.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/old-pr.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/renamed.test.ts', added: '2026-05-01' },
    { file: 'packages/core/src/x.e2e.test.ts', added: '2026-05-01' },
    { file: 'e2e-tests/monorepo/monorepo.test.ts', added: '2026-05-01' },
  ];
  const tiers = seedTiers({
    scope: 'core-list',
    qualify,
    fileAges: [],
    failIndex: {
      ver: {
        'packages/core/src/ver.test.ts': ['2026-10-17'],
        'packages/core/src/old-ver.test.ts': ['2026-09-10'],
      },
      pr: {
        'packages/core/src/pr.test.ts': ['123'],
        'packages/core/src/old-pr.test.ts': ['124'],
        'packages/core/src/was-renamed.test.ts': ['456'],
      },
      any: {
        'packages/core/src/pr.test.ts': ['2026-09-04', '2026-10-20'],
        'packages/core/src/old-pr.test.ts': ['2026-09-04', '2026-10-01'],
        'packages/core/src/ver.test.ts': ['2026-10-17'],
        'packages/core/src/old-ver.test.ts': ['2026-09-10'],
        'packages/core/src/was-renamed.test.ts': ['2026-10-05'],
      },
    },
    renames: { 'packages/core/src/was-renamed.test.ts': 'packages/core/src/renamed.test.ts' },
    date: '2026-11-01',
  });
  // Window starts 2026-10-02: 2026-10-01 is outside it, 2026-10-02 inside. Package E2E files
  // are tiered like any other (the E2E Test (packages/*) list is filtered); e2e-tests/ suites
  // are tiered per job, not per file.
  assert.deepEqual(tiers.files, {
    'packages/core/src/x.e2e.test.ts': { tier: 'out', since: '2026-11-01', last_failure: null, reason: 'seed-rule-b' },
    'packages/core/src/new.test.ts': { tier: 'in', since: '2026-10-15', last_failure: null, reason: 'new' },
    'packages/core/src/old-pr.test.ts': {
      tier: 'out',
      since: '2026-11-01',
      last_failure: '2026-10-01',
      reason: 'seed-rule-b',
    },
    'packages/core/src/old-ver.test.ts': {
      tier: 'out',
      since: '2026-11-01',
      last_failure: '2026-09-10',
      reason: 'seed-rule-b',
    },
    'packages/core/src/old.test.ts': { tier: 'out', since: '2026-11-01', last_failure: null, reason: 'seed-rule-b' },
    'packages/core/src/pr.test.ts': { tier: 'in', since: '2026-10-20', last_failure: '2026-10-20', reason: 'pr-fail' },
    'packages/core/src/renamed.test.ts': {
      tier: 'in',
      since: '2026-10-05',
      last_failure: '2026-10-05',
      reason: 'pr-fail',
    },
    'packages/core/src/ver.test.ts': {
      tier: 'in',
      since: '2026-10-17',
      last_failure: '2026-10-17',
      reason: 'versioning-fail',
    },
  });
});

test('seed: a file added on the first day of the window is new', () => {
  const tiers = seedTiers({
    scope: 'core-list',
    qualify: [
      { file: 'a/src/edge.test.ts', added: '2026-10-02' },
      { file: 'a/src/before.test.ts', added: '2026-10-01' },
    ],
    fileAges: [],
    failIndex: { ver: {}, pr: {}, any: {} },
    renames: {},
    date: '2026-11-01',
  });
  assert.equal(tiers.files['a/src/edge.test.ts'].reason, 'new');
  assert.equal(tiers.files['a/src/before.test.ts'].tier, 'out');
});

test('seed: job keys come from the job seed as-is; a bad entry throws', () => {
  const base = {
    scope: 'all',
    qualify: [],
    fileAges: [],
    failIndex: { ver: {}, pr: {}, any: {} },
    renames: {},
    date: '2026-11-01',
  };
  const job = { tier: 'out', since: '2026-11-01', last_failure: '2026-09-30', reason: 'seed-30d-nofail' };
  const tiers = seedTiers({ ...base, jobs: { 'job:e2e/client-js': job, 'job:memory': { ...job, tier: 'in' } } });
  assert.deepEqual(tiers.files['job:e2e/client-js'], job);
  assert.equal(tiers.files['job:memory'].tier, 'in');
  assert.throws(() => seedTiers({ ...base, jobs: { 'packages/x.test.ts': job } }));
  assert.throws(() => seedTiers({ ...base, jobs: { 'job:memory': { ...job, tier: 'maybe' } } }));
});

test('seed data: every seeded job key is one Prebuild or a tiered workflow can skip', async () => {
  const jobs = JSON.parse(fs.readFileSync(new URL('./seed-data/jobs-seed.json', import.meta.url), 'utf8'));
  for (const key of Object.keys(jobs)) assert.ok(jobOwnPaths(key).length > 0, key);
});
