import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import selection from './select-affected-tests.cjs';

const { routeTests, diffLockfiles } = selection;

const workspacePackages = [
  { id: 's3', name: '@mastra/s3', dependencies: {} },
  { id: 'docker', name: '@mastra/docker', dependencies: {} },
];
const route = (input: { changedFiles: string[]; affectedTests?: string[]; fullSuite?: boolean }) =>
  routeTests({ affectedTests: [], fullSuite: false, workspacePackages, ...input });

describe('Prebuild test routing', () => {
  test('the full suite runs every suite and carries no test selection', () => {
    const result = route({ changedFiles: [], affectedTests: ['packages/core/src/a.test.ts'], fullSuite: true });

    expect(result.runFull).toBe(true);
    expect(result.unitTestFiles).toEqual([]);
    expect(result.e2eTestFiles).toEqual([]);
    expect(Object.values(result.flags).every(Boolean)).toBe(true);
    expect(result.workspaceDockerPackages).toEqual(['s3']);
  });

  test('splits selected tests between the unit job and the package E2E job', () => {
    const result = route({
      changedFiles: ['packages/schema-compat/src/schema.ts'],
      affectedTests: [
        'packages/schema-compat/src/schema.test.ts',
        'packages/schema-compat/src/provider-compats/anthropic.e2e.test.ts',
        'packages/rag/src/document.test.ts',
        'client-sdks/ai-sdk/src/chat-route.test.ts',
        'client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts',
        'e2e-tests/monorepo/monorepo.test.ts',
      ],
    });

    expect(result.unitTestFiles).toEqual([
      'packages/schema-compat/src/schema.test.ts',
      'client-sdks/ai-sdk/src/chat-route.test.ts',
    ]);
    expect(result.e2eTestFiles).toEqual([
      'packages/schema-compat/src/provider-compats/anthropic.e2e.test.ts',
      'packages/rag/src/document.test.ts',
      'client-sdks/ai-sdk/src/__tests__/tool-call-approval.e2e.test.ts',
    ]);
    // An external E2E test reaches the Studio/E2E workflow, not the package E2E job.
    expect(result.flags.e2e_changed).toBe(true);
  });

  test('splits 500 or more unit test files across three affected-unit jobs', () => {
    const unitTests = (count: number) => Array.from({ length: count }, (_, i) => `packages/core/src/t${i}.test.ts`);
    const changedFiles = ['packages/core/src/index.ts'];

    expect(route({ changedFiles, affectedTests: unitTests(499) }).unitShards).toEqual([1]);
    expect(route({ changedFiles, affectedTests: unitTests(500) }).unitShards).toEqual([1, 2, 3]);
    // E2E tests run in their own job, so they don't count toward the split.
    const mixed = [...unitTests(499), 'packages/core/src/a.e2e.test.ts'];
    expect(route({ changedFiles, affectedTests: mixed }).unitShards).toEqual([1]);
    // The full suite shards itself; the affected-unit job doesn't run.
    expect(route({ changedFiles, affectedTests: unitTests(600), fullSuite: true }).unitShards).toEqual([1]);
  });

  test('a lockfile-only change starts the suites that install published packages', () => {
    const { flags } = route({ changedFiles: ['pnpm-lock.yaml'] });

    expect(flags).toMatchObject({
      e2e_changed: true,
      mastracode_e2e_changed: true,
      durable_streams_changed: true,
      stores_changed: false,
      memory_changed: false,
    });
  });

  test('editing the routing itself runs the suites it gates', () => {
    for (const file of ['.github/workflows/prebuild.yml', '.github/scripts/select-affected-tests.cjs']) {
      expect(route({ changedFiles: [file] }).flags).toMatchObject({
        stores_changed: true,
        memory_changed: true,
        durable_streams_changed: true,
      });
    }
  });

  test('docs-only edits inside packages start no suites', () => {
    const { flags } = route({ changedFiles: ['packages/core/README.md', 'stores/pg/CHANGELOG.md'] });

    expect(Object.values(flags).some(Boolean)).toBe(false);
  });
});

describe('Prebuild test tiers', () => {
  const out = { tier: 'out' };
  const tierFiles: Record<string, { tier: string }> = {
    'packages/core/src/quiet.test.ts': out,
    'packages/core/src/quiet.e2e.test.ts': out,
    'job:store/pg': out,
    'job:memory': out,
    'job:workspace-unit/docker': out,
  };
  const tiered = (
    input: { changedFiles: string[]; affectedTests?: string[]; fullSuite?: boolean },
    fullTestsLabel = false,
  ) =>
    route({ ...input, storeNames: ['pg', 'libsql'], tiers: { tiers: { files: tierFiles }, fullTestsLabel } } as never);

  test('drops quiet files the PR does not edit, before deciding the unit shards', () => {
    const many = Array.from({ length: 499 }, (_, i) => `packages/core/src/t${i}.test.ts`);
    const result = tiered({
      changedFiles: ['packages/core/src/index.ts'],
      affectedTests: [...many, 'packages/core/src/quiet.test.ts', 'packages/core/src/quiet.e2e.test.ts'],
    });

    expect(result.unitTestFiles).not.toContain('packages/core/src/quiet.test.ts');
    expect(result.e2eTestFiles).toEqual([]);
    expect(result.unitShards).toEqual([1]);
    expect(result.tiers.droppedFiles).toEqual([
      'packages/core/src/quiet.test.ts',
      'packages/core/src/quiet.e2e.test.ts',
    ]);
  });

  test('keeps a quiet file the PR edits', () => {
    const result = tiered({
      changedFiles: ['packages/core/src/quiet.test.ts'],
      affectedTests: ['packages/core/src/quiet.test.ts'],
    });

    expect(result.unitTestFiles).toEqual(['packages/core/src/quiet.test.ts']);
  });

  test('turns a gate off when every job behind it is quiet and untouched', () => {
    const memory = tiered({
      changedFiles: ['packages/core/src/index.ts'],
      affectedTests: ['packages/memory/integration-tests/a.test.ts'],
    });
    expect(memory.flags.memory_changed).toBe(false);
    expect(memory.tiers.skippedJobs).toContain('job:memory');

    // libsql is not tiered out, so the store workflow still starts and skips only pg.
    const stores = tiered({ changedFiles: ['stores/_test-utils/src/index.ts'] });
    expect(stores.flags.stores_changed).toBe(true);
  });

  test('a quiet job still runs when the PR edits its own paths', () => {
    const result = tiered({ changedFiles: ['packages/memory/src/index.ts'] });

    expect(result.flags.memory_changed).toBe(true);
    expect(result.tiers.skippedJobs).not.toContain('job:memory');
  });

  test('skips quiet workspace packages but keeps the full list for the cloud tests', () => {
    const result = tiered({
      changedFiles: ['packages/core/src/index.ts'],
      affectedTests: ['workspaces/docker/src/a.test.ts', 'workspaces/s3/src/a.test.ts'],
    });

    expect(result.workspaceSelection.packages).toEqual(expect.arrayContaining(['docker', 's3']));
    expect(result.workspaceUnitRun).toEqual(['s3']);
    expect(result.workspaceDockerRun).toEqual(['s3']);
    expect(result.flags.workspaces_changed).toBe(true);
  });

  test('the full-tests label and the full suite run everything', () => {
    const input = { changedFiles: ['packages/core/src/index.ts'], affectedTests: ['packages/core/src/quiet.test.ts'] };

    expect(tiered(input, true).unitTestFiles).toEqual(['packages/core/src/quiet.test.ts']);
    expect(tiered(input, true).tiers.skippedJobs).toEqual([]);
    expect(tiered({ ...input, fullSuite: true }).tiers.skippedJobs).toEqual([]);
  });

  test('the E2E workflow still starts for npm import when every tiered E2E job is quiet', () => {
    const e2eJobs = Object.fromEntries(
      [
        'monorepo',
        'kitchen-sink',
        'deployers',
        'create-mastra',
        'commonjs',
        'no-bundling',
        'mcp-compat',
        'client-js',
        'type-check',
      ].map(name => [`job:e2e/${name}`, out]),
    );
    const result = route({
      changedFiles: ['packages/core/src/mcp/index.ts'],
      tiers: { tiers: { files: { ...tierFiles, ...e2eJobs } }, fullTestsLabel: false },
    } as never);

    expect(result.tiers.skippedJobs).toContain('job:e2e/mcp-compat');
    expect(result.flags.e2e_changed).toBe(true);
  });

  test('the E2E registry publishes whenever the E2E workflow runs', () => {
    // npm import is not tiered and needs the registry, so its publisher can't be tiered either.
    // It runs as steps of the shared e2e-light job, which has no job-level condition.
    const workflow = parse(readFileSync(new URL('../workflows/e2e-tests.yml', import.meta.url), 'utf8'));
    type Job = { needs?: string | string[]; if?: string; steps: { name?: string; if?: string }[] };
    const jobs = workflow.jobs as Record<string, Job>;
    const consumers = Object.entries(jobs)
      .filter(([, job]) => [job.needs ?? []].flat().includes('publish-e2e-registry'))
      .map(([name]) => name);

    expect(consumers).toContain('e2e-light');
    expect(jobs['e2e-light'].if).toBeUndefined();
    const npmImport = jobs['e2e-light'].steps.filter(step => step.name?.startsWith('E2E npm import'));
    expect(npmImport).toHaveLength(2);
    for (const step of npmImport) expect(step.if ?? '').not.toContain('skip_jobs');
    expect(workflow.jobs['publish-e2e-registry'].if).toBeUndefined();
  });

  // Suites that share a runner must not share a time budget: every step has its own timeout and
  // the job allows all of them, so a stalled build or suite can't run out the clock on the suites
  // after it. npm import needs no build, so it runs before Build.
  test.each([
    ['e2e-tests.yml', 'e2e-light'],
    ['mastracode-e2e.yml', 'mastracode-e2e'],
  ])('%s %s gives every step its own budget', (file, jobId) => {
    type Step = { name?: string; uses?: string; 'timeout-minutes'?: number };
    const workflow = parse(readFileSync(new URL(`../workflows/${file}`, import.meta.url), 'utf8'));
    const job = workflow.jobs[jobId] as { 'timeout-minutes': number; steps: Step[] };
    const unbounded = job.steps.filter(step => !step['timeout-minutes']).map(step => step.name ?? step.uses);
    expect(unbounded).toEqual([]);
    const total = job.steps.reduce((sum, step) => sum + (step['timeout-minutes'] ?? 0), 0);
    expect(job['timeout-minutes']).toBeGreaterThanOrEqual(total);
    if (jobId === 'e2e-light') {
      const names = job.steps.map(step => step.name);
      expect(names).toContain('E2E npm import');
      expect(names).toContain('Build');
      expect(names.indexOf('E2E npm import')).toBeLessThan(names.indexOf('Build'));
    }
  });

  // A failed shared Build (or registry download) skips every suite after it, selected or tiered
  // out alike, so each selected suite gets a step that fails in its name: the tier updater then
  // records the prerequisite failure for that suite only, and tiered-out suites stay skipped.
  test('a failed Build or registry download fails each selected light suite by name', () => {
    type Step = { name?: string; if?: string; run?: string };
    const workflow = parse(readFileSync(new URL('../workflows/e2e-tests.yml', import.meta.url), 'utf8'));
    const steps = (workflow.jobs['e2e-light'] as { steps: Step[] }).steps;
    const names = steps.map(step => step.name);
    const gated = steps.filter(
      step => step.name?.endsWith(': install e2e test dependencies') && step.if?.includes('skip_jobs'),
    );
    expect(gated.length).toBeGreaterThanOrEqual(4);
    for (const install of steps.filter(
      step => /^E2E .+: install /.test(step.name ?? '') && step.if?.includes('skip_jobs'),
    )) {
      const label = /^E2E (.+?): /.exec(install.name!)![1];
      const key = /'(job:e2e\/[\w-]+)'/.exec(install.if!)![1];
      const blocked = steps.find(step => step.name === `E2E ${label}: not run, a prerequisite failed`);
      expect(blocked, label).toBeDefined();
      expect(names.indexOf(blocked!.name)).toBeGreaterThan(names.indexOf('Build'));
      expect(blocked!.if).toContain('!cancelled()');
      expect(blocked!.if).toContain(`!contains(fromJSON(inputs.skip_jobs), '${key}')`);
      expect(blocked!.if).toContain("steps.build.outcome != 'success'");
      expect(blocked!.if).toContain("steps.registry.outcome != 'success'");
      expect(blocked!.run).toMatch(/exit 1/);
    }
    // npm import doesn't need the build, so it has no such step.
    expect(names.some(name => name?.startsWith('E2E npm import: not run'))).toBe(false);
  });

  test('without tiers nothing is dropped', () => {
    const result = route({
      changedFiles: ['packages/core/src/index.ts'],
      affectedTests: ['packages/core/src/quiet.test.ts'],
    });

    expect(result.unitTestFiles).toEqual(['packages/core/src/quiet.test.ts']);
    expect(result.tiers.skippedJobs).toEqual([]);
  });
});

// Lines kept apart so the branch and main edits merge without a conflict.
const lockfile = (a: number, b: number) => `a: ${a}\n${'pad: 0\n'.repeat(5)}b: ${b}\n`;

describe('PR lockfile diff', () => {
  test('ignores lockfile changes main made after the branch point when the merge commit is checked out', () => {
    const repo = mkdtempSync(join(tmpdir(), 'lockfile-diff-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
        cwd: repo,
        encoding: 'utf-8',
      });
    const commit = (text: string, message: string) => {
      writeFileSync(join(repo, 'pnpm-lock.yaml'), text);
      git('commit', '-qam', message);
      return git('rev-parse', 'HEAD').trim();
    };
    try {
      git('init', '-q', '-b', 'main');
      writeFileSync(join(repo, 'pnpm-lock.yaml'), lockfile(1, 1));
      git('add', '.');
      git('commit', '-qm', 'branch point');
      git('checkout', '-qb', 'pr');
      const headSha = commit(lockfile(2, 1), 'pr bumps a');
      git('checkout', '-q', 'main');
      const baseSha = commit(lockfile(1, 2), 'main bumps b');
      // actions/checkout on pull_request checks out the merge of the PR into main.
      git('merge', '-q', '--no-edit', 'pr');

      expect(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf-8')).toBe(lockfile(2, 2));
      expect(diffLockfiles(git, { baseSha, headSha, changedFiles: ['pnpm-lock.yaml'] })).toEqual({
        baseLockfile: lockfile(1, 1),
        headLockfile: lockfile(2, 1),
      });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('Grouped container store tests', () => {
  // Stores that share a runner must not share a time budget: every step has its own timeout and
  // the job allows all of them, so a store that stalls to its cap can't run out the clock on the
  // stores after it, whose steps would then be cancelled without a result.
  test('test-combined-stores.yml test-grouped gives every step its own budget', () => {
    type Step = { name?: string; uses?: string; 'timeout-minutes'?: number };
    const workflow = parse(readFileSync(new URL('../workflows/test-combined-stores.yml', import.meta.url), 'utf8'));
    const job = workflow.jobs['test-grouped'] as { 'timeout-minutes': number; steps: Step[] };
    const unbounded = job.steps.filter(step => !step['timeout-minutes']).map(step => step.name ?? step.uses);
    expect(unbounded).toEqual([]);
    const total = job.steps.reduce((sum, step) => sum + (step['timeout-minutes'] ?? 0), 0);
    expect(job['timeout-minutes']).toBeGreaterThanOrEqual(total);
  });

  // The DuckDB vector tests run `INSTALL vss`, which downloads the extension when DuckDB's extension
  // directory is empty. A stalled download takes DuckDB about 120 s to give up, past the tests' 60 s
  // hook timeout, so the light-store tests must find the extension already installed.
  test('test-combined-stores.yml test-light restores the DuckDB extension directory before the store tests', () => {
    type Step = { name?: string; uses?: string; if?: string; with?: Record<string, string> };
    const workflow = parse(readFileSync(new URL('../workflows/test-combined-stores.yml', import.meta.url), 'utf8'));
    const steps = (workflow.jobs['test-light'] as { steps: Step[] }).steps;
    const cacheIndex = steps.findIndex(
      step => step.uses?.startsWith('actions/cache@') && step.with?.path === '~/.duckdb/extensions',
    );
    const testsIndex = steps.findIndex(step => step.name === 'Run light store tests');
    expect(cacheIndex).toBeGreaterThan(-1);
    expect(testsIndex).toBeGreaterThan(cacheIndex);
    const cache = steps[cacheIndex]!;
    // Keyed on the installed DuckDB version, so a DuckDB upgrade fetches the matching extension.
    expect(cache.with?.key).toContain('steps.duckdb.outputs.version');
    const versionIndex = steps.findIndex(step => (step as { id?: string }).id === 'duckdb');
    expect(versionIndex).toBeGreaterThan(-1);
    expect(versionIndex).toBeLessThan(cacheIndex);
  });
});
