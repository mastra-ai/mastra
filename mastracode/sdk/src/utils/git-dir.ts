import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type GitDirs =
  | {
      kind: 'found';
      /** This worktree's git directory; `HEAD` lives here. */
      gitDir: string;
      /** The directory every worktree shares; refs live here. */
      commonDir: string;
      /** Contents of `HEAD`. */
      head: string;
    }
  /** `cwd` is in no repository. */
  | { kind: 'none' }
  /** The environment redirects git, so only git can say. */
  | { kind: 'ask-git' };

const REDIRECTING_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
];

const read = (file: string) => readFile(file, 'utf-8').catch(() => undefined);

/**
 * Find the git directory git would use for `cwd` by reading the filesystem,
 * so callers that only need to know whether repository state changed do not
 * have to start a git process to find out.
 */
export async function findGitDirs(cwd: string): Promise<GitDirs> {
  if (REDIRECTING_ENV.some(name => process.env[name])) return { kind: 'ask-git' };
  let dir = resolve(cwd);
  const isDirectory = await stat(dir).then(
    stats => stats.isDirectory(),
    () => false,
  );
  if (!isDirectory) return { kind: 'none' };

  while (true) {
    const dotGit = join(dir, '.git');
    let head = await read(join(dotGit, 'HEAD'));
    if (head !== undefined) return { kind: 'found', gitDir: dotGit, commonDir: dotGit, head };

    // Linked worktrees and submodules have a `.git` file that names the directory.
    const pointer = /^gitdir: (.+)$/m.exec((await read(dotGit)) ?? '')?.[1];
    if (pointer) {
      const gitDir = resolve(dir, pointer.trim());
      head = await read(join(gitDir, 'HEAD'));
      if (head !== undefined) {
        const common = await read(join(gitDir, 'commondir'));
        return { kind: 'found', gitDir, commonDir: common ? resolve(gitDir, common.trim()) : gitDir, head };
      }
    }

    const parent = dirname(dir);
    if (parent === dir) return { kind: 'none' };
    dir = parent;
  }
}
