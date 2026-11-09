import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
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
        'e2e-tests/monorepo/monorepo.test.ts',
      ],
    });

    expect(result.unitTestFiles).toEqual(['packages/schema-compat/src/schema.test.ts']);
    expect(result.e2eTestFiles).toEqual([
      'packages/schema-compat/src/provider-compats/anthropic.e2e.test.ts',
      'packages/rag/src/document.test.ts',
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
