import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn(
  (
    _file: string,
    _args: string[],
    _options: unknown,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    callback(null, '', '');
  },
);

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

describe('web git clone helpers', () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all([...cleanupDirs].map(dir => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it('normalizes and validates supported git URL forms', async () => {
    const { normalizeWebGitUrl } = await import('../git-clone-context.js');

    expect(normalizeWebGitUrl(' https://github.com/mastra-ai/mastra.git ')).toBe(
      'https://github.com/mastra-ai/mastra.git',
    );
    expect(normalizeWebGitUrl('ssh://git@github.com/mastra-ai/mastra.git')).toBe(
      'ssh://git@github.com/mastra-ai/mastra.git',
    );
    expect(normalizeWebGitUrl('git@github.com:mastra-ai/mastra.git')).toBe('git@github.com:mastra-ai/mastra.git');
    expect(() => normalizeWebGitUrl('/Users/ward/project')).toThrow(/https:\/\//);
    expect(() => normalizeWebGitUrl('file:///tmp/project')).toThrow(/Git URL/);
  });

  it('computes a deterministic clone path and reuses an existing checkout', async () => {
    const { ensureWebGitClone, getWebGitClonePath } = await import('../git-clone.js');
    const gitUrl = 'https://github.com/mastra-ai/mastra.git';
    const cloneParentPath = path.join(process.cwd(), '.tmp-git-clone-test');
    cleanupDirs.add(cloneParentPath);
    const clonePath = getWebGitClonePath(gitUrl, cloneParentPath);

    expect(getWebGitClonePath(gitUrl, cloneParentPath)).toBe(clonePath);
    expect(clonePath.startsWith(cloneParentPath)).toBe(true);
    await fs.mkdir(clonePath, { recursive: true });

    await expect(ensureWebGitClone(gitUrl, cloneParentPath)).resolves.toBe(clonePath);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('clones with git into a deterministic temp directory', async () => {
    const { ensureWebGitClone, getWebGitClonePath } = await import('../git-clone.js');
    const gitUrl = 'https://github.com/mastra-ai/mastra.git';
    const cloneParentPath = path.join(process.cwd(), '.tmp-git-clone-test');
    cleanupDirs.add(cloneParentPath);
    const clonePath = getWebGitClonePath(gitUrl, cloneParentPath);
    await fs.rm(clonePath, { recursive: true, force: true });

    await expect(ensureWebGitClone(gitUrl, cloneParentPath)).resolves.toBe(clonePath);

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [file, args, options] = execFileMock.mock.calls[0];
    expect(file).toBe('git');
    expect(args.slice(0, 4)).toEqual(['clone', '--depth', '1', gitUrl]);
    expect(args[4]).toMatch(new RegExp(`${path.basename(clonePath)}-`));
    expect(options).toMatchObject({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) });
    await expect(fs.stat(clonePath)).resolves.toMatchObject({});
  });
});
