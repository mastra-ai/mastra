import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectNestedGitTrees } from '../project.js';

describe('detectNestedGitTrees', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mastra-project-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('returns an empty array when there are no nested git trees', async () => {
    await fs.promises.mkdir(path.join(tempDir, 'src'));
    await fs.promises.writeFile(path.join(tempDir, 'src', 'main.ts'), 'x');

    expect(detectNestedGitTrees(tempDir)).toEqual([]);
  });

  it('does not treat the project root itself as a nested tree', async () => {
    await fs.promises.mkdir(path.join(tempDir, '.git'));

    expect(detectNestedGitTrees(tempDir)).toEqual([]);
  });

  it('finds a nested directory containing a .git dir (vendored repo / submodule)', async () => {
    const nested = path.join(tempDir, 'vendor', 'thing');
    await fs.promises.mkdir(path.join(nested, '.git'), { recursive: true });

    const trees = detectNestedGitTrees(tempDir);
    expect(trees).toHaveLength(1);
    expect(trees[0]?.relativePath).toBe('vendor/thing');
    expect(trees[0]?.absolutePath).toBe(nested);
  });

  it('finds a nested git worktree (where .git is a file, not a dir)', async () => {
    const worktree = path.join(tempDir, 'wt-feat');
    await fs.promises.mkdir(worktree, { recursive: true });
    await fs.promises.writeFile(path.join(worktree, '.git'), 'gitdir: /tmp/main/.git/worktrees/wt-feat\n');

    const trees = detectNestedGitTrees(tempDir);
    expect(trees).toHaveLength(1);
    expect(trees[0]?.relativePath).toBe('wt-feat');
  });

  it('skips common build / dependency directories', async () => {
    // Common pruned dirs that often contain `.git` from vendored deps.
    const ignored = ['node_modules/foo', 'dist/embedded', '.next/cache', 'target/dep'];
    for (const dir of ignored) {
      await fs.promises.mkdir(path.join(tempDir, dir, '.git'), { recursive: true });
    }

    expect(detectNestedGitTrees(tempDir)).toEqual([]);
  });

  it('does not recurse into a nested git tree to find further nested ones', async () => {
    // The agent should treat a nested git tree as opaque — its internals are
    // its own sandbox. So we should report only the outermost boundary.
    const outer = path.join(tempDir, 'outer');
    const inner = path.join(outer, 'inner-pkg');
    await fs.promises.mkdir(path.join(outer, '.git'), { recursive: true });
    await fs.promises.mkdir(path.join(inner, '.git'), { recursive: true });

    const trees = detectNestedGitTrees(tempDir);
    expect(trees).toHaveLength(1);
    expect(trees[0]?.relativePath).toBe('outer');
  });

  it('reports a current branch in the description when one is available', () => {
    // Create a real git repo so describeNestedGitTree can run `rev-parse`.
    const nested = path.join(tempDir, 'wt');
    fs.mkdirSync(nested, { recursive: true });
    try {
      execSync('git init -q -b feature-branch', { cwd: nested, stdio: 'ignore' });
    } catch {
      // If git is unavailable in CI, skip the assertion. The detection itself
      // is exercised by the other tests.
      return;
    }

    const trees = detectNestedGitTrees(tempDir);
    expect(trees).toHaveLength(1);
    expect(trees[0]?.description).toBe('branch feature-branch');
  });
});
