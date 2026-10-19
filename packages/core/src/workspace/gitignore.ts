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

/**
 * Ignore rules from `.gitignore` files found below or above the workspace
 * root, each applied relative to the directory that holds it, the way git
 * does. Paths are given in whatever form the caller walks with (`./src/a`,
 * `src/a`, or `/workspace/repo/src/a`), as long as directories added with
 * {@link add} use the same form.
 */
export class NestedGitignore {
  readonly #rules = new Map<string, ReturnType<typeof ignore>>();

  /** Add the rules of the `.gitignore` in `directory`. */
  add(directory: string, content: string): void {
    if (!content.trim()) return;
    this.#rules.set(normalizeDirectory(directory), ignore().add(content));
  }

  has(directory: string): boolean {
    return this.#rules.has(normalizeDirectory(directory));
  }

  ignores(path: string, isDirectory: boolean): boolean {
    const normalized = path.replace(/^\.\//, '').replace(/\/+$/, '');
    for (const [directory, ig] of this.#rules) {
      let relative: string;
      if (directory === '') {
        if (normalized.startsWith('/')) continue;
        relative = normalized;
      } else if (normalized.startsWith(`${directory}/`)) {
        relative = normalized.slice(directory.length + 1);
      } else {
        continue;
      }
      if (relative && ig.ignores(isDirectory ? `${relative}/` : relative)) return true;
    }
    return false;
  }
}

function normalizeDirectory(directory: string): string {
  const normalized = directory.replace(/^\.\//, '').replace(/\/+$/, '');
  return normalized === '.' ? '' : normalized;
}
