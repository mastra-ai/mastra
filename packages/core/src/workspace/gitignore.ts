/**
 * Gitignore support for workspace tools.
 *
 * Applies every `.gitignore` relative to the directory that holds it, the way
 * git does, so a multi-repo workspace root without its own `.gitignore` still
 * honors each repository's rules. `node_modules` is skipped by default.
 */

import ignore from 'ignore';

import type { FileEntry, WorkspaceFilesystem } from './filesystem';
import { isEnoentError } from './filesystem/fs-utils';

export type IgnoreFilter = (relativePath: string) => boolean;

/** Maximum concurrent `.gitignore` reads while walking. */
const GITIGNORE_READ_CONCURRENCY = 8;

const NODE_MODULES = /(^|\/)node_modules(\/|$)/;

export interface WorkspaceIgnore {
  /** Whether `path` (in the same form the caller walks with) should be skipped. */
  ignores(path: string, isDirectory: boolean): boolean;
  /**
   * Read the `.gitignore` of each listed directory that has one, so its rules
   * apply to everything below it. Call with a directory's listing before
   * filtering its children.
   */
  addListings(
    listings: Array<[directory: string, entries: readonly Pick<FileEntry, 'name' | 'type'>[] | undefined]>,
  ): Promise<void>;
}

export interface LoadWorkspaceIgnoreOptions {
  /** Apply `.gitignore` files (default: true). `node_modules` is skipped either way. */
  gitignore?: boolean;
  /**
   * The path the caller asked for, when it differs from `target` (e.g. a glob
   * whose static base is `target`). `node_modules` is not skipped when it
   * points inside one.
   */
  requestedPath?: string;
}

/**
 * Load ignore rules for a walk rooted at `target`: the workspace root's
 * `.gitignore` plus those of `target`'s ancestors. The walk adds nested ones
 * with {@link WorkspaceIgnore.addListings}.
 *
 * When `target` is itself ignored (e.g. `dist` or `node_modules/x`), nothing
 * below it is filtered, so callers can still look inside on purpose.
 * Missing nested `.gitignore` files are skipped, and so are unreadable ones;
 * an unreadable root `.gitignore` throws.
 */
export async function loadWorkspaceIgnore(
  filesystem: WorkspaceFilesystem,
  target: string,
  options: LoadWorkspaceIgnoreOptions = {},
): Promise<WorkspaceIgnore> {
  const skipNodeModules = !NODE_MODULES.test(options.requestedPath ?? target);
  const useGitignore = options.gitignore ?? true;
  const rules = new Map<string, ReturnType<typeof ignore>>();

  const addFrom = async (directories: string[]) => {
    const pMap = (await import('p-map')).default;
    await pMap(
      directories.filter(directory => !rules.has(pathKey(directory))),
      async directory => {
        const content = await readGitignore(filesystem, directory);
        if (content?.trim()) rules.set(pathKey(directory), ignore().add(content));
      },
      { concurrency: GITIGNORE_READ_CONCURRENCY },
    );
  };
  const matchesRules = (path: string, isDirectory: boolean): boolean => {
    const key = pathKey(path);
    for (const [directory, ig] of rules) {
      let relative: string;
      if (directory === '') relative = key;
      else if (key.startsWith(`${directory}/`)) relative = key.slice(directory.length + 1);
      else continue;
      if (relative && ig.ignores(isDirectory ? `${relative}/` : relative)) return true;
    }
    return false;
  };

  let targetIsIgnored = false;
  if (useGitignore) {
    // The root .gitignore must be readable: silently dropping it would widen
    // the scope without telling the caller. Nested ones are best-effort.
    const root = await readRootGitignore(filesystem);
    if (root?.trim()) rules.set('', ignore().add(root));
    await addFrom(ancestorDirectories(target));
    targetIsIgnored = pathKey(target) !== '' && matchesRules(target, true);
  }
  const applyGitignore = useGitignore && !targetIsIgnored;

  return {
    ignores(path, isDirectory) {
      if (skipNodeModules && NODE_MODULES.test(pathKey(path))) return true;
      return applyGitignore && matchesRules(path, isDirectory);
    },
    async addListings(listings) {
      if (!applyGitignore) return;
      await addFrom(
        listings
          .filter(([, entries]) => entries?.some(entry => entry.type === 'file' && entry.name === '.gitignore'))
          .map(([directory]) => directory),
      );
    },
  };
}

/** Rule-matching form of a path: no `./`, leading `/`, or trailing `/`; the root is `''`. */
function pathKey(path: string): string {
  const key = path.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return key === '.' ? '' : key;
}

/** `path` and each directory above it, deepest first, excluding the root. */
function ancestorDirectories(path: string): string[] {
  const directories: string[] = [];
  let current = path.replace(/\/+$/, '');
  while (current && current !== '.' && current !== '/') {
    directories.push(current);
    const slash = current.lastIndexOf('/');
    current = slash > 0 ? current.slice(0, slash) : slash === 0 ? '/' : '';
  }
  return directories;
}

/** Read the root `.gitignore`; only a missing file (ENOENT) is treated as absent. */
async function readRootGitignore(filesystem: WorkspaceFilesystem): Promise<string | undefined> {
  try {
    const content = await filesystem.readFile('.gitignore', { encoding: 'utf-8' });
    return typeof content === 'string' ? content : undefined;
  } catch (err) {
    if (isEnoentError(err)) return undefined;
    throw err;
  }
}

/** Read `<directory>/.gitignore`, or undefined when it is missing or unreadable. */
async function readGitignore(filesystem: WorkspaceFilesystem, directory: string): Promise<string | undefined> {
  try {
    const content = await filesystem.readFile(`${directory.replace(/\/+$/, '')}/.gitignore`, { encoding: 'utf-8' });
    return typeof content === 'string' ? content : undefined;
  } catch {
    return undefined;
  }
}
