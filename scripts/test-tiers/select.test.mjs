import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { jobOwnPaths, loadTiers, selectJobs, selectUnitTests } from './select.mjs';

const tiers = {
  version: 1,
  updated: '2026-11-01',
  files: {
    'packages/core/src/a.test.ts': { tier: 'out', since: '2026-11-01', last_failure: null, reason: 'seed-rule-b' },
    'packages/core/src/b.test.ts': { tier: 'in', since: '2026-10-20', last_failure: '2026-10-20', reason: 'pr-fail' },
  },
};
const files = ['packages/core/src/a.test.ts', 'packages/core/src/b.test.ts', 'packages/core/src/new.test.ts'];
const base = { files, tiers, changedFiles: ['packages/core/src/a.ts'], fullSuite: false, fullTestsLabel: false };

function writeTemp(t, content) {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'tiers-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'tiers.json');
  if (content !== undefined) fs.writeFileSync(file, content);
  return file;
}

test('drops an out file the PR does not change, keeps in and unlisted files', () => {
  const result = selectUnitTests(base);
  assert.deepEqual(result.dropped, ['packages/core/src/a.test.ts']);
  assert.deepEqual(result.kept, ['packages/core/src/b.test.ts', 'packages/core/src/new.test.ts']);
});

test('keeps an out file the PR changes', () => {
  const result = selectUnitTests({ ...base, changedFiles: ['packages/core/src/a.test.ts'] });
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.kept, files);
});

test('full suite keeps every file', () => {
  const result = selectUnitTests({ ...base, fullSuite: true });
  assert.deepEqual(result.kept, files);
  assert.deepEqual(result.dropped, []);
});

test('full-tests label keeps every file', () => {
  const result = selectUnitTests({ ...base, fullTestsLabel: true });
  assert.deepEqual(result.kept, files);
  assert.deepEqual(result.dropped, []);
});

test('missing tiers.json keeps every file and says why', t => {
  const loaded = loadTiers(writeTemp(t));
  assert.equal(loaded.tiers, null);
  assert.match(loaded.problem, /missing/);
  const result = selectUnitTests({ ...base, ...loaded });
  assert.deepEqual(result.kept, files);
  assert.match(result.reason, /missing/);
});

test('unparsable or wrong-version tiers.json keeps every file', t => {
  for (const [content, why] of [
    ['missing', /not valid JSON/],
    [JSON.stringify({ ...tiers, version: 2 }), /version 2/],
    [JSON.stringify({ version: 1 }), /no files map/],
  ]) {
    const loaded = loadTiers(writeTemp(t, content));
    assert.equal(loaded.tiers, null);
    assert.match(loaded.problem, why);
    assert.deepEqual(selectUnitTests({ ...base, ...loaded }).kept, files);
  }
});

test('loads a valid tiers.json', t => {
  const loaded = loadTiers(writeTemp(t, JSON.stringify(tiers)));
  assert.equal(loaded.problem, null);
  assert.deepEqual(selectUnitTests({ ...base, ...loaded }).dropped, ['packages/core/src/a.test.ts']);
});

const jobTiers = {
  version: 1,
  files: {
    'job:store/pg': { tier: 'out' },
    'job:store/libsql': { tier: 'out' },
    'job:e2e/kitchen-sink': { tier: 'out' },
    'job:memory': { tier: 'in' },
  },
};

test('an out job is skipped unless the PR touches its own paths; unlisted keys run', () => {
  const keys = ['job:store/pg', 'job:store/libsql', 'job:e2e/kitchen-sink', 'job:memory', 'job:store/new'];
  const run = changedFiles =>
    selectJobs({ keys, tiers: jobTiers, changedFiles, fullSuite: false, fullTestsLabel: false }).skipped;
  assert.deepEqual(run(['packages/core/src/index.ts']), ['job:store/pg', 'job:store/libsql', 'job:e2e/kitchen-sink']);
  assert.deepEqual(run(['stores/pg/src/index.ts']), ['job:store/libsql', 'job:e2e/kitchen-sink']);
  assert.deepEqual(run(['.github/workflows/test-combined-stores.yml']), ['job:e2e/kitchen-sink']);
  assert.deepEqual(run(['packages/playground/e2e/tests/agent.spec.ts']), ['job:store/pg', 'job:store/libsql']);
});

test('jobs: full suite, full-tests label and a missing tiers.json skip nothing', () => {
  const keys = ['job:store/pg'];
  const base = { keys, tiers: jobTiers, changedFiles: [], fullSuite: false, fullTestsLabel: false };
  assert.deepEqual(selectJobs({ ...base, fullSuite: true }).skipped, []);
  assert.deepEqual(selectJobs({ ...base, fullTestsLabel: true }).skipped, []);
  assert.deepEqual(selectJobs({ ...base, tiers: null, problem: 'missing' }).skipped, []);
});

test('every wired job key has its own paths', () => {
  for (const key of [
    'job:store/pg',
    'job:memory',
    'job:workspace-unit/e2b',
    'job:workspace-docker/s3',
    'job:workspace-cloud/e2b',
    'job:e2e/monorepo',
    'job:e2e/kitchen-sink',
    'job:e2e/deployers',
    'job:e2e/create-mastra',
    'job:e2e/commonjs',
    'job:e2e/no-bundling',
    'job:e2e/mcp-compat',
    'job:e2e/client-js',
    'job:e2e/type-check',
    'job:e2e/experiments',
    'job:mastracode-e2e',
    'job:mastracode-om',
    'job:qa/changeset-check',
  ]) {
    const paths = jobOwnPaths(key);
    assert.ok(paths.length >= 2 || key.startsWith('job:mastracode'), key);
    assert.ok(paths.every(Boolean), key);
  }
});

test('the package E2E list is filtered per file like the unit list', () => {
  const t = {
    version: 1,
    files: { 'packages/rag/src/a.test.ts': { tier: 'out' }, 'packages/core/src/x.e2e.test.ts': { tier: 'out' } },
  };
  const files = ['packages/rag/src/a.test.ts', 'packages/core/src/x.e2e.test.ts', 'packages/rag/src/b.test.ts'];
  const { kept, dropped } = selectUnitTests({
    files,
    tiers: t,
    changedFiles: ['packages/core/src/x.e2e.test.ts'],
    fullSuite: false,
    fullTestsLabel: false,
  });
  assert.deepEqual(kept, ['packages/core/src/x.e2e.test.ts', 'packages/rag/src/b.test.ts']);
  assert.deepEqual(dropped, ['packages/rag/src/a.test.ts']);
});

// Own paths are the job's own test code, its package, the workflow/routing files that define it
// and (E2E) the lockfile; never the source it exercises. A source-only change skips an `out`
// job, and the break shows on the versioning PR. Pins both sides of that line.
test('own paths keep a job for its own code and CI files, never for the source it exercises', () => {
  const skips = (key, file) =>
    selectJobs({
      keys: [key],
      tiers: { version: 1, files: { [key]: { tier: 'out' } } },
      changedFiles: [file],
      fullSuite: false,
      fullTestsLabel: false,
    }).skipped.length === 1;
  const kept = {
    'job:store/pg': ['stores/pg/src/x.ts', 'stores/_test-utils/src/x.ts', '.github/workflows/test-combined-stores.yml'],
    'job:memory': ['packages/memory/src/x.ts'],
    'job:workspace-unit/e2b': ['workspaces/e2b/src/x.ts', '.github/workflows/test-workspaces.yml'],
    'job:workspace-cloud/e2b': ['workspaces/e2b/src/x.ts', '.github/workflows/secrets.test-workspaces.yml'],
    'job:e2e/monorepo': [
      'e2e-tests/monorepo/x.ts',
      'e2e-tests/_local-registry-setup/x.ts',
      'e2e-tests/pkg-outputs/x.ts',
      'pnpm-lock.yaml',
      '.github/workflows/e2e-tests.yml',
      '.github/scripts/studio-e2e-routing.cjs',
    ],
    'job:e2e/kitchen-sink': ['packages/playground/e2e/x.spec.ts'],
    'job:e2e/mcp-compat': ['packages/mcp/integration-tests/x.ts'],
    'job:e2e/experiments': [
      'e2e-tests/experiment-worker/x.ts',
      '.github/scripts/experiment-worker-routing.cjs',
      'pnpm-lock.yaml',
    ],
    'job:mastracode-e2e': ['mastracode/tui/src/x.ts', 'pnpm-lock.yaml', '.github/workflows/mastracode-e2e.yml'],
    'job:mastracode-om': ['mastracode/web/e2e/x.ts'],
    'job:qa/changeset-check': ['.github/workflows/lint.yml', '.github/scripts/check-changeset-packages.test.mjs'],
  };
  for (const [key, files] of Object.entries(kept)) {
    for (const file of [...files, '.github/workflows/prebuild.yml', 'scripts/test-tiers/select.mjs']) {
      assert.ok(!skips(key, file), `${key} should run for ${file}`);
    }
  }
  const skipped = {
    'job:store/pg': ['packages/core/src/storage/x.ts', 'stores/libsql/src/x.ts'],
    'job:memory': ['packages/core/src/memory/x.ts'],
    'job:e2e/monorepo': [
      'packages/core/src/x.ts',
      'packages/server/src/x.ts',
      'server-adapters/hono/src/x.ts',
      'e2e-tests/deployers/x.ts',
    ],
    'job:e2e/kitchen-sink': ['packages/playground-ui/src/x.tsx', 'packages/playground/src/x.tsx'],
    'job:e2e/mcp-compat': ['packages/core/src/mcp/x.ts', 'packages/core/src/tools/x.ts'],
    'job:e2e/experiments': ['packages/deployer/src/build/x.ts', 'packages/cli/src/index.ts'],
    'job:mastracode-e2e': ['packages/core/src/x.ts'],
    'job:mastracode-om': ['packages/core/src/x.ts'],
  };
  for (const [key, files] of Object.entries(skipped)) {
    for (const file of files) assert.ok(skips(key, file), `${key} should be skipped for ${file}`);
  }
});
