/**
 * Gitignore support for workspace tools.
 *
 * Reads `.gitignore` from the workspace filesystem root and provides
 * a filter function that tools can use during directory walking.
 */

import ignore from 'ignore';

import type { WorkspaceFilesystem } from './filesystem';
import { isEnoentError } from './filesystem/fs-utils';

export type IgnoreFilter = (relativePath: string) => boolean;

/**
 * Load `.gitignore` from the workspace root and return a filter function.
 *
 * The returned function takes a path relative to the workspace root and
 * returns `true` if the path is ignored (should be skipped).
 *
 * Returns `undefined` if no `.gitignore` exists.
 *
 * Only a genuinely-absent `.gitignore` (ENOENT) is swallowed. Any other failure
 * (permission denied, IO error) is rethrown: silently treating an unreadable
 * `.gitignore` as "no gitignore" would change the search scope without telling
 * the caller.
 */
export async function loadGitignore(filesystem: WorkspaceFilesystem): Promise<IgnoreFilter | undefined> {
  let content: string;
  try {
    const raw = await filesystem.readFile('.gitignore', { encoding: 'utf-8' });
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    content = raw;
  } catch (err) {
    if (isEnoentError(err)) return undefined;
    throw err;
  }

  const ig = ignore().add(content);

  return (relativePath: string): boolean => {
    // The `ignore` package expects paths without leading './' or '/'
    const normalized = relativePath.replace(/^\.\//, '').replace(/^\//, '');
    if (!normalized) return false;
    return ig.ignores(normalized);
  };
}
