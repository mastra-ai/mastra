import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { API_FILE_LIMIT, decide, hasCodeChanges, prFilesFromApi, writeOutputs } from './detect-code-changes.mjs';

const page = (...files: string[]) => files.map(filename => ({ filename }));
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const prAt = (sha = HEAD, ref = 'main', baseSha = BASE) => ({ head: { sha }, base: { ref, sha: baseSha } });
// Answers the PR lookup with each of `prs` in turn (the last one repeats), and the files
// list with `pages`.
const ghReturning = (pages: unknown, prs: unknown[] = [prAt()]) => {
  const calls: string[][] = [];
  let lookups = 0;
  const run = (args: string[]) => {
    calls.push(args);
    if (args[1] === 'repos/o/r/pulls/7') return JSON.stringify(prs[Math.min(lookups++, prs.length - 1)]);
    return typeof pages === 'string' ? pages : JSON.stringify(pages);
  };
  return { run, calls };
};
const prLookup = ['api', 'repos/o/r/pulls/7'];
const filesLookup = ['api', '--paginate', '--slurp', 'repos/o/r/pulls/7/files?per_page=100'];

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
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run })).toEqual([
      'docs/a.md',
      'packages/core/src/a.ts',
    ]);
    expect(calls).toEqual([prLookup, filesLookup, prLookup]);
  });

  test('0.x is diffed like main', () => {
    expect(
      prFilesFromApi({
        repo: 'o/r',
        number: '7',
        baseRef: '0.x',
        baseSha: BASE,
        headSha: HEAD,
        run: ghReturning([page('docs/a.md')], [prAt(HEAD, '0.x')]).run,
      }),
    ).toEqual(['docs/a.md']);
  });

  test('a stacked PR needs git for the merge-base with main', () => {
    const { run, calls } = ghReturning([page('docs/a.md')]);
    expect(
      prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'feat/x', baseSha: BASE, headSha: HEAD, run }),
    ).toBeNull();
    expect(calls).toEqual([]);
  });

  test('a list at the API limit may be truncated, so git decides', () => {
    const files = Array.from({ length: API_FILE_LIMIT }, (_, i) => `docs/${i}.md`);
    const { run } = ghReturning([page(...files)]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run })).toBeNull();
  });

  test('an API error or unreadable reply falls back to git', () => {
    const failing = () => {
      throw new Error('HTTP 502');
    };
    expect(
      prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run: failing }),
    ).toBeNull();
    for (const reply of ['not json', '{"message":"x"}']) {
      expect(
        prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run: () => reply }),
      ).toBeNull();
      expect(
        prFilesFromApi({
          repo: 'o/r',
          number: '7',
          baseRef: 'main',
          baseSha: BASE,
          headSha: HEAD,
          run: ghReturning(reply).run,
        }),
      ).toBeNull();
    }
  });

  // A rerun of an older run, or a push that lands while this run starts, would otherwise
  // classify the PR's newer files and skip Build and tests for this run's commit.
  test("a PR whose head is no longer this run's commit falls back to git without listing files", () => {
    const { run, calls } = ghReturning([page('docs/a.md')], [prAt('c'.repeat(40))]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run })).toBeNull();
    expect(calls).toEqual([prLookup]);
  });

  test('a PR retargeted to another base branch falls back to git', () => {
    const { run } = ghReturning([page('docs/a.md')], [prAt(HEAD, 'feat/x')]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run })).toBeNull();
  });

  test('a PR that moves while its files are listed falls back to git', () => {
    const { run, calls } = ghReturning([page('docs/a.md'), page('docs/b.md')], [prAt(), prAt('c'.repeat(40))]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run })).toBeNull();
    expect(calls).toEqual([prLookup, filesLookup, prLookup]);
    const retargeted = ghReturning([page('docs/a.md')], [prAt(), prAt(HEAD, '0.x')]);
    expect(
      prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run: retargeted.run }),
    ).toBeNull();
  });

  // Main can take in commits the head also has (another PR landed them): the PR's current
  // files list then drops them, while this run's base...head diff still has them.
  test("a PR whose base commit is no longer this run's falls back to git", () => {
    const advanced = prAt(HEAD, 'main', 'd'.repeat(40));
    const before = ghReturning([page('docs/a.md')], [advanced]);
    expect(
      prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run: before.run }),
    ).toBeNull();
    expect(before.calls).toEqual([prLookup]);
    const during = ghReturning([page('docs/a.md')], [prAt(), advanced]);
    expect(
      prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: HEAD, run: during.run }),
    ).toBeNull();
    expect(during.calls).toEqual([prLookup, filesLookup, prLookup]);
  });

  test("without the run's head or base commit the API is not used", () => {
    const { run, calls } = ghReturning([page('docs/a.md')]);
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: BASE, headSha: '', run })).toBeNull();
    expect(prFilesFromApi({ repo: 'o/r', number: '7', baseRef: 'main', baseSha: '', headSha: HEAD, run })).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('decide', () => {
  const pr = {
    eventName: 'pull_request',
    fullSuite: 'false',
    repo: 'o/r',
    number: '7',
    baseRef: 'main',
    baseSha: BASE,
    headSha: HEAD,
  };

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

  test('a docs-only list for a newer head than the run tests leaves the decision to git', () => {
    const { run } = ghReturning([page('docs/a.md')], [prAt('c'.repeat(40))]);
    expect(decide({ ...pr, run })).toEqual({ need_git: 'true' });
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
