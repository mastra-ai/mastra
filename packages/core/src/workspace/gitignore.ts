/**
 * Gitignore support for workspace tools.
 *
 * Reads `.gitignore` from the workspace filesystem root and provides
 * a filter function that tools can use during directory walking.
 */

import ignore from 'ignore';

import type { WorkspaceFilesystem } from './filesystem';

export type IgnoreFilter = (relativePath: string) => boolean;

/**
 * Load `.gitignore` from the workspace root and return a filter function.
 *
 * The returned function takes a path relative to the workspace root and
 * returns `true` if the path is ignored (should be skipped).
 *
 * Returns `undefined` if no `.gitignore` exists or it can't be read.
 */
export async function loadGitignore(filesystem: WorkspaceFilesystem): Promise<IgnoreFilter | undefined> {
  let content: string;
  try {
    const raw = await filesystem.readFile('.gitignore', { encoding: 'utf-8' });
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    content = raw;
  } catch {
    return undefined;
  }

  const ig = ignore().add(content);

  return (relativePath: string): boolean => {
    // The `ignore` package expects paths without leading './' or '/'
    const normalized = relativePath.replace(/^\.\//, '').replace(/^\//, '');
    if (!normalized) return false;
    return ig.ignores(normalized);
  };
}
