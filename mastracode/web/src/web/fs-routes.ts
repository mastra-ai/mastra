import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';

import { detectProject, getResourceIdOverride } from '@mastra/code-sdk/utils/project';

/**
 * Server-side directory browser for the web project picker.
 *
 * The browser cannot read absolute filesystem paths (the File System Access API
 * only exposes a directory *name*), so the picker must ask the server — which
 * does have filesystem access — to enumerate directories. The result is real
 * absolute paths the user can select without typing.
 *
 * All access is confined to a configured `root` (default: the user's home
 * directory). Requests that try to escape the root via `..` or symlinks are
 * clamped back to the root.
 */

export interface DirectoryEntry {
  name: string;
  /** Absolute path to the entry. */
  path: string;
}

export interface DirectoryListing {
  /** The allowed root; clients cannot browse above this. */
  root: string;
  /** The absolute path that was listed. */
  path: string;
  /** Parent directory path, or null when `path` is the root. */
  parent: string | null;
  /** Subdirectories of `path` (directories only, sorted, hidden excluded). */
  entries: DirectoryEntry[];
}

/** Resolve the browsable root, defaulting to the user's home directory. */
export function resolveFsRoot(root?: string): string {
  return resolve(root && root.trim() ? root : homedir());
}

/** True when `candidate` is `root` or nested under it. */
function isWithinRoot(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return candidate.startsWith(rootWithSep);
}

/**
 * Resolve a path's real location (following symlinks) and confirm it stays
 * within `root`. Returns the real path when confined, or `null` when it escapes
 * the root or does not exist. Used so a symlink inside the root that points
 * outside it cannot be browsed or selected.
 */
async function realPathWithinRoot(candidate: string, root: string): Promise<string | null> {
  try {
    const real = await realpath(candidate);
    return isWithinRoot(real, root) ? real : null;
  } catch {
    return null;
  }
}

/**
 * List the directories inside `requestedPath`, confined to `root`. An absent or
 * out-of-root path is clamped to the root, so the worst a malicious client can
 * do is browse within the allowed root.
 */
export async function listDirectory(root: string, requestedPath?: string): Promise<DirectoryListing> {
  // Resolve the root through symlinks so all confinement checks compare real
  // paths; a symlink that escapes the root is then reliably detectable.
  const resolvedRoot = (await realPathWithinRoot(resolveFsRoot(root), resolveFsRoot(root))) ?? resolveFsRoot(root);

  let target = resolvedRoot;
  if (requestedPath && requestedPath.trim()) {
    const candidate = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(resolvedRoot, requestedPath);
    // Follow symlinks and re-confirm the real target stays within the root.
    target = (await realPathWithinRoot(candidate, resolvedRoot)) ?? resolvedRoot;
  }

  // Confirm the target is a real directory; fall back to root otherwise.
  try {
    const info = await stat(target);
    if (!info.isDirectory()) target = resolvedRoot;
  } catch {
    target = resolvedRoot;
  }

  const dirents = await readdir(target, { withFileTypes: true });
  const entries: DirectoryEntry[] = [];
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue; // skip dotfiles/dirs
    const entryPath = join(target, dirent.name);
    let isDir = dirent.isDirectory();
    if (dirent.isSymbolicLink()) {
      // Only surface symlinks whose real target is a directory inside the root,
      // so a link pointing outside the root can't be browsed or selected.
      const real = await realPathWithinRoot(entryPath, resolvedRoot);
      isDir = real ? (await stat(real).catch(() => null))?.isDirectory() === true : false;
    }
    if (isDir) entries.push({ name: dirent.name, path: entryPath });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parent = target === resolvedRoot ? null : resolve(target, '..');

  return { root: resolvedRoot, path: target, parent, entries };
}

export interface ResolvedProject {
  /**
   * The resourceId the TUI would use for this path — derived identically so a
   * project opened in the terminal and in the web app resolve to the SAME
   * session (and therefore the same threads).
   */
  resourceId: string;
  name: string;
  rootPath: string;
  gitUrl?: string;
  gitBranch?: string;
}

/**
 * Resolve a project path to the same resourceId the TUI uses. Mirrors
 * `createMastraCode`: detect the project, then apply any resourceId override
 * (MASTRA_RESOURCE_ID env var or `.mastracode/database.json`). This is the
 * shared continuity point — start in the TUI, continue on the web, same path
 * → same resourceId → same session.
 */
export function resolveProject(projectPath: string): ResolvedProject {
  const info = detectProject(projectPath);
  const override = getResourceIdOverride(info.rootPath);
  return {
    resourceId: override ?? info.resourceId,
    name: info.name,
    rootPath: info.rootPath,
    gitUrl: info.gitUrl,
    gitBranch: info.gitBranch,
  };
}

/**
 * Build the web filesystem routes as Mastra `apiRoutes`:
 *   - `GET /web/fs/list?path=...`        — browse directories (confined to root)
 *   - `GET /web/project/resolve?path=...` — TUI-compatible project resourceId
 */
export function buildFsRoutes(options: { root?: string } = {}): ApiRoute[] {
  const root = resolveFsRoot(options.root);

  return [
    registerApiRoute('/web/fs/list', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const path = c.req.query('path');
        try {
          const listing = await listDirectory(root, path);
          return c.json(listing);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, 500);
        }
      },
    }),
    registerApiRoute('/web/project/resolve', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const path = c.req.query('path');
        if (!path) return c.json({ error: 'Missing required query param: path' }, 400);
        // Confine resolution to the browsable root (following symlinks), so this
        // endpoint can't be used to probe arbitrary filesystem paths. The web UI
        // only ever resolves directories the user picked via the root-confined
        // browser, so legitimate requests are always within the root.
        const confined = await realPathWithinRoot(isAbsolute(path) ? resolve(path) : resolve(root, path), root);
        if (!confined) return c.json({ error: 'Path is outside the browsable root' }, 403);
        try {
          return c.json(resolveProject(confined));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return c.json({ error: message }, 500);
        }
      },
    }),
  ];
}
