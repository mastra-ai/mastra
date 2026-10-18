/**
 * Monorepo workspace discovery.
 *
 * Replaces the `find-workspaces` package with the same API, so that the
 * production dependency tree no longer carries `fast-glob` → `micromatch` →
 * `braces` (GHSA-vfj7-8cjw-p6xm, no patched release). Globbing goes through
 * `tinyglobby`, which the deployer already uses for bundling.
 *
 * Root detection order matches `find-workspaces`: `lerna.json`, then
 * `pnpm-workspace.yaml`, then `package.json` (`workspaces` array,
 * `workspaces.packages`, or `bolt.workspaces`).
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname as parentDirectory, join, posix, resolve, sep } from 'node:path';
import { glob } from 'tinyglobby';
import { parse as parseYaml } from 'yaml';

export type WorkspacePackageJson = {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  exports?: unknown;
  [key: string]: unknown;
};

export type WorkspacesRoot = {
  /** Slash-normalized absolute path of the workspace root. */
  location: string;
  /** Package globs as declared by the workspace manifest. */
  globs: string[];
};

export type Workspace = {
  /** Slash-normalized absolute path of the package directory. */
  location: string;
  package: WorkspacePackageJson;
};

export type WorkspacesCache = {
  root: Map<string, WorkspacesRoot | null>;
  workspaces: Map<string, Workspace[]>;
  clear: () => void;
};

export type FindWorkspacesOptions = {
  /** Directory at which the upward search stops. Defaults to the user's home directory. */
  stopDir?: string;
  cache?: WorkspacesCache;
};

export function createWorkspacesCache(): WorkspacesCache {
  return {
    root: new Map(),
    workspaces: new Map(),
    clear() {
      this.root.clear();
      this.workspaces.clear();
    },
  };
}

/**
 * Walk up from `dirname` until a directory declaring workspace globs is found.
 * Returns `null` when none is found before `stopDir`.
 */
export function findWorkspacesRoot(dirname?: string, options: FindWorkspacesOptions = {}): WorkspacesRoot | null {
  const dir = dirname ? resolve(dirname) : process.cwd();
  const stopDir = options.stopDir ? resolve(options.stopDir) : homedir();
  const cache = options.cache;

  if (cache) {
    for (const [key, value] of cache.root.entries()) {
      if ((dir + sep).startsWith(key + sep)) return value;
    }
  }

  return findRoot(dir, stopDir, cache);
}

/**
 * List every workspace package under the root that contains `dirname`.
 * Returns `null` when `dirname` is not inside a workspace.
 */
export async function findWorkspaces(
  dirname?: string,
  options: FindWorkspacesOptions = {},
): Promise<Workspace[] | null> {
  const root = findWorkspacesRoot(dirname, options);
  if (!root) return null;

  const cached = options.cache?.workspaces.get(root.location);
  if (cached) return cached;

  const manifests = await glob(toManifestGlobs(root.globs), {
    cwd: root.location,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  const workspaces: Workspace[] = [];
  for (const manifest of manifests) {
    const location = toPosix(parentDirectory(manifest));
    // A `**` glob also matches the root manifest; the root itself is not a workspace package.
    if (location === root.location) continue;
    const pkg = readJsonFile(location, 'package.json');
    if (isObject(pkg) && typeof pkg.name === 'string') {
      workspaces.push({ location, package: pkg as WorkspacePackageJson });
    }
  }

  options.cache?.workspaces.set(root.location, workspaces);
  return workspaces;
}

/**
 * Glob for each pattern's `package.json` instead of for the directory itself. A
 * directory-only glob does not match a symlink to a directory, so a linked workspace
 * package would be dropped and never packed into the build output. Matching the
 * manifest inside it does, and is also how pnpm resolves its workspaces. Negated
 * patterns are mapped the same way so they keep excluding whole packages.
 */
function toManifestGlobs(globs: string[]): string[] {
  return globs.map(pattern => {
    const negated = pattern.startsWith('!');
    const base = (negated ? pattern.slice(1) : pattern).replace(/[\\/]+$/, '');
    return `${negated ? '!' : ''}${base}/package.json`;
  });
}

function findRoot(dir: string, stopDir: string, cache?: WorkspacesCache): WorkspacesRoot | null {
  const memo = (value: WorkspacesRoot | null) => {
    cache?.root.set(dir, value);
    return value;
  };

  const globs = findGlobs(dir);
  if (globs) return memo({ location: toPosix(dir), globs });

  const next = resolve(dir, '..');
  if (next === stopDir || next === dir) return memo(null);
  return findRoot(next, stopDir, cache);
}

function findGlobs(dir: string): string[] | null {
  return resolveLernaGlobs(dir) ?? resolvePnpmGlobs(dir) ?? resolvePackageJsonGlobs(dir);
}

function resolveLernaGlobs(dir: string): string[] | null {
  const lernaJson = readJsonFile(dir, 'lerna.json');
  if (lernaJson === undefined) return null;
  return isObject(lernaJson) && isStringArray(lernaJson.packages) ? lernaJson.packages : null;
}

function resolvePnpmGlobs(dir: string): string[] | null {
  const pnpmWorkspace = readYamlFile(dir, 'pnpm-workspace.yaml');
  if (pnpmWorkspace === undefined) return null;
  // A pnpm-workspace.yaml without `packages` means every package.json under the root.
  return isObject(pnpmWorkspace) && isStringArray(pnpmWorkspace.packages) ? pnpmWorkspace.packages : ['**'];
}

function resolvePackageJsonGlobs(dir: string): string[] | null {
  const packageJson = readJsonFile(dir, 'package.json');
  if (!isObject(packageJson)) return null;
  if (isStringArray(packageJson.workspaces)) return packageJson.workspaces;
  if (isObject(packageJson.workspaces) && isStringArray(packageJson.workspaces.packages)) {
    return packageJson.workspaces.packages;
  }
  if (isObject(packageJson.bolt) && isStringArray(packageJson.bolt.workspaces)) {
    return packageJson.bolt.workspaces;
  }
  return null;
}

function readJsonFile(dir: string, file: string): unknown {
  try {
    return JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch {
    return undefined;
  }
}

function readYamlFile(dir: string, file: string): unknown {
  try {
    return parseYaml(readFileSync(join(dir, file), 'utf8'));
  } catch {
    return undefined;
  }
}

function toPosix(path: string): string {
  return path.split(sep).join(posix.sep);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
