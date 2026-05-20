import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalFilesystem, PermissionError } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';

import { NESTED_GIT_DISALLOWED_PATH_HINT, getNestedGitDisallowedPaths } from '../workspace.js';

/**
 * Mastra Code wires `LocalFilesystem.disallowedPaths` from the nested-git
 * trees it detects under `projectPath`. These tests cover the wiring at the
 * functional boundary that matters: the helper produces the right list, and
 * a `LocalFilesystem` constructed with that list (plus the mastracode hint)
 * blocks reads inside a nested worktree / submodule with a `request_access`
 * recovery hint.
 *
 * We deliberately avoid going through `getDynamicWorkspace` here because
 * that path adds `/tmp` to `allowedPaths` (so the agent can use it as a
 * scratchpad). When the test temp dir lives under `/tmp`, that allow-list
 * short-circuits the disallow check and would mask wiring bugs.
 */
describe('mastracode workspace nested git disallowed paths', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  async function makeProject(prefix: string): Promise<string> {
    // realpath so symlinked tmp dirs (macOS) don't trip containment checks.
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
    tempDirs.push(dir);
    return dir;
  }

  it('detects a vendored .git directory and produces a disallowed path', async () => {
    const tempDir = await makeProject('mc-nested-git-vendor-');
    const nested = path.join(tempDir, 'vendor', 'sub');
    await fs.mkdir(path.join(nested, '.git'), { recursive: true });
    await fs.writeFile(path.join(nested, 'file.ts'), 'inside sub');

    expect(getNestedGitDisallowedPaths(tempDir)).toContain(nested);
  });

  it('detects a git worktree (.git is a file, not a dir)', async () => {
    const tempDir = await makeProject('mc-nested-git-worktree-');
    execSync('git init -q', { cwd: tempDir });
    execSync('git config user.email t@t.t', { cwd: tempDir });
    execSync('git config user.name t', { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, 'init.txt'), 'init');
    execSync('git add init.txt && git commit -q -m init', { cwd: tempDir });
    execSync('git worktree add -q wt-feat -b wt-feat', { cwd: tempDir });

    const wtPath = path.join(tempDir, 'wt-feat');
    expect(getNestedGitDisallowedPaths(tempDir)).toContain(wtPath);
  });

  it('returns an empty list when no nested git trees exist', async () => {
    const tempDir = await makeProject('mc-nested-git-empty-');
    await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'file.ts'), 'top');
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    expect(getNestedGitDisallowedPaths(tempDir)).toEqual([]);
  });

  it('does not include the project root itself even when basePath has a .git dir', async () => {
    const tempDir = await makeProject('mc-nested-git-root-');
    await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });

    expect(getNestedGitDisallowedPaths(tempDir)).not.toContain(tempDir);
  });

  it('blocks file ops inside a nested git tree with the request_access hint', async () => {
    const tempDir = await makeProject('mc-nested-git-block-');
    const nested = path.join(tempDir, 'sub');
    await fs.mkdir(path.join(nested, '.git'), { recursive: true });
    await fs.writeFile(path.join(nested, 'file.ts'), 'inside sub');

    const localFs = new LocalFilesystem({
      basePath: tempDir,
      disallowedPaths: getNestedGitDisallowedPaths(tempDir),
      disallowedPathHint: NESTED_GIT_DISALLOWED_PATH_HINT,
    });

    await expect(localFs.readFile('sub/file.ts')).rejects.toThrow(PermissionError);
    await expect(localFs.readFile('sub/file.ts')).rejects.toThrow(/request_access/);
  });

  it('lets allowedPaths (request_access) override the nested-git block', async () => {
    const tempDir = await makeProject('mc-nested-git-grant-');
    const nested = path.join(tempDir, 'sub');
    await fs.mkdir(path.join(nested, '.git'), { recursive: true });
    await fs.writeFile(path.join(nested, 'file.ts'), 'inside sub');

    const localFs = new LocalFilesystem({
      basePath: tempDir,
      disallowedPaths: getNestedGitDisallowedPaths(tempDir),
      allowedPaths: [nested],
      disallowedPathHint: NESTED_GIT_DISALLOWED_PATH_HINT,
    });

    const content = await localFs.readFile(path.join(nested, 'file.ts'), { encoding: 'utf-8' });
    expect(content).toBe('inside sub');
  });
});
