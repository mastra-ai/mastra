import { lstat, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Shared by Studio and privileged local writers. Only local file databases are supported. */
export function localDatabasePath(
  url = process.env.SUPPORT_DATABASE_URL ?? databaseUrlForPath(resolve('.local/support.db')),
) {
  if (!url.startsWith('file:') || /[?#\u0000]/u.test(url)) throw new Error('Expected a local file database URL');
  const path = url.startsWith('file://') ? fileURLToPath(url) : decodeURIComponent(url.slice(5));
  if (!path || path === ':memory:' || /[\u0000\\]/u.test(path))
    throw new Error('Expected a persistent local file database');
  return resolve(path);
}

export function localDatabaseUrl() {
  return databaseUrlForPath(localDatabasePath());
}

export function databaseUrlForPath(path: string) {
  return pathToFileURL(path).href;
}

/** Resolve existing symlinks even when the database or its parent has not been created. */
export async function canonicalDatabasePath(url?: string): Promise<string> {
  let path = localDatabasePath(url);
  const missing: string[] = [];
  for (;;) {
    try {
      const canonical = await realpath(path);
      if (!missing.length) {
        const info = await stat(canonical);
        if (!info.isFile() || info.nlink !== 1)
          throw new Error('Database must be a regular file without hard-link aliases');
      }
      return join(canonical, ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const existing = await lstat(path).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return undefined;
      });
      if (existing?.isSymbolicLink()) throw new Error('Cannot use a dangling database path symlink');
      missing.push(basename(path));
      path = dirname(path);
    }
  }
}
