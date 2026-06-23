import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

import type { Hono } from 'hono';

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
 * List the directories inside `requestedPath`, confined to `root`. An absent or
 * out-of-root path is clamped to the root, so the worst a malicious client can
 * do is browse within the allowed root.
 */
export async function listDirectory(root: string, requestedPath?: string): Promise<DirectoryListing> {
  const resolvedRoot = resolveFsRoot(root);

  let target = resolvedRoot;
  if (requestedPath && requestedPath.trim()) {
    const candidate = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(resolvedRoot, requestedPath);
    target = isWithinRoot(candidate, resolvedRoot) ? candidate : resolvedRoot;
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
    let isDir = dirent.isDirectory();
    // Resolve symlinks to directories so they're browsable too.
    if (!isDir && dirent.isSymbolicLink()) {
      try {
        isDir = (await stat(join(target, dirent.name))).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) entries.push({ name: dirent.name, path: join(target, dirent.name) });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parent = target === resolvedRoot ? null : resolve(target, '..');

  return { root: resolvedRoot, path: target, parent, entries };
}

/**
 * Mount `GET /api/web/fs/list?path=...` on the given Hono app. Lists the
 * directories under `path` (defaulting to `root`), confined to `root`.
 */
export function mountFsRoutes(app: Hono, options: { root?: string } = {}): void {
  const root = resolveFsRoot(options.root);
  app.get('/api/web/fs/list', async c => {
    const path = c.req.query('path');
    try {
      const listing = await listDirectory(root, path);
      return c.json(listing);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });
}
