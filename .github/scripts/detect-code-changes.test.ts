import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { API_FILE_LIMIT, decide, hasCodeChanges, prFilesFromApi, writeOutputs } from './detect-code-changes.mjs';

const page = (...files: string[]) => files.map(filename => ({ filename }));
const ghReturning = (pages: unknown[]) => {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    return JSON.stringify(pages);
  };
  return { run, calls };
};

describe('hasCodeChanges', () => {
  test('docs, examples, changesets and explorations are not code', () => {
    expect(hasCodeChanges(['docs/a.md', 'examples/b/index.ts', '.changeset/c.md', 'explorations/d/e.ts'])).toBe(false);
  });

  test('anything else is code', () => {
    expect(hasCodeChanges(['docs/a.md', 'packages/core/src/index.ts'])).toBe(true);
    expect(hasCodeChanges(['.github/workflows/prebuild.yml'])).toBe(true);
    // Only the directory prefixes count, as in the git diff filter this replaces.
    expect(hasCodeChanges(['packages/core/docs/x.md'])).toBe(true);
  });

  test('an empty diff has no code', () => {
    expect(hasCodeChanges([])).toBe(false);
  });
});

describe('prFilesFromApi', () => {
  test('flattens every page of the PR files list', () => {
    const { run, calls } = ghReturning([page('docs/a.md'), page('packages/core/src/a.ts')]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', run })).toEqual([
      'docs/a.md',
      'packages/core/src/a.ts',
    ]);
    expect(calls).toEqual([['api', '--paginate', '--slurp', 'repos/o/r/pulls/7/files?per_page=100']]);
  });

  test('0.x is diffed like main', () => {
    const { run } = ghReturning([page('docs/a.md')]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: '0.x', run })).toEqual(['docs/a.md']);
  });

  test('a stacked PR needs git for the merge-base with main', () => {
    const { run, calls } = ghReturning([page('docs/a.md')]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'feat/x', run })).toBeNull();
    expect(calls).toEqual([]);
  });

  test('a list at the API limit may be truncated, so git decides', () => {
    const files = Array.from({ length: API_FILE_LIMIT }, (_, i) => `docs/${i}.md`);
    const { run } = ghReturning([page(...files)]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', run })).toBeNull();
  });

  test('an API error or unreadable reply falls back to git', () => {
    const failing = () => {
      throw new Error('HTTP 502');
    };
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', run: failing })).toBeNull();
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', run: () => 'not json' })).toBeNull();
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', run: () => '{"message":"x"}' })).toBeNull();
  });
});

describe('decide', () => {
  const pr = { eventName: 'pull_request', fullSuite: 'false', repo: 'o/r', number: '7', baseRef: 'main' };

  test('the full suite always has code and never calls the API', () => {
    const { run, calls } = ghReturning([page('docs/a.md')]);
    expect(decide({ ...pr, fullSuite: 'true', run })).toEqual({ has_code: 'true' });
    expect(calls).toEqual([]);
  });

  test('docs-only PR', () => {
    const { run } = ghReturning([page('docs/a.md', '.changeset/x.md')]);
    expect(decide({ ...pr, run })).toEqual({ has_code: 'false' });
  });

  test('code PR', () => {
    const { run } = ghReturning([page('docs/a.md'), page('stores/pg/src/index.ts')]);
    expect(decide({ ...pr, run })).toEqual({ has_code: 'true' });
  });

  test('no API answer leaves the decision to git', () => {
    const { run } = ghReturning([page('docs/a.md')]);
    expect(decide({ ...pr, baseRef: 'feat/x', run })).toEqual({ need_git: 'true' });
  });
});

describe('writeOutputs', () => {
  test('appends key=value lines to GITHUB_OUTPUT', () => {
    const dir = mkdtempSync(join(tmpdir(), 'detect-'));
    try {
      const file = join(dir, 'out');
      writeOutputs({ has_code: 'false' }, file);
      writeOutputs({ need_git: 'true' }, file);
      expect(readFileSync(file, 'utf8')).toBe('has_code=false\nneed_git=true\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
