import { lstat, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, basename, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function hostedMode() {
  const mode = process.env.SUPPORT_MODE ?? 'local';
  if (mode !== 'local' && mode !== 'hosted') throw new Error('SUPPORT_MODE must be local or hosted');
  return mode === 'hosted';
}

export function storageConfiguration(url = process.env.SUPPORT_DATABASE_URL) {
  if (!hostedMode()) return { url: localDatabaseUrlFor(url) };
  if (!url) throw new Error('Hosted mode requires SUPPORT_DATABASE_URL');
  if (!process.env.SUPPORT_WRITER_LOCK_FILE || !isAbsolute(process.env.SUPPORT_WRITER_LOCK_FILE))
    throw new Error('Hosted mode requires an absolute SUPPORT_WRITER_LOCK_FILE');
  const parsed = new URL(url);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (!['https:', 'libsql:'].includes(parsed.protocol) && !(parsed.protocol === 'http:' && loopback))
    throw new Error('Hosted database requires HTTPS or libsql (HTTP is allowed only on loopback)');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname)
    throw new Error('Invalid hosted database URL');
  const authToken = process.env.SUPPORT_DATABASE_AUTH_TOKEN;
  if (!authToken?.trim() || /[\r\n]/u.test(authToken))
    throw new Error('Hosted mode requires SUPPORT_DATABASE_AUTH_TOKEN');
  return { url, authToken };
}

function localDatabaseUrlFor(url?: string) {
  return databaseUrlForPath(localDatabasePath(url));
}

export function serverHost() {
  if (!hostedMode()) return '127.0.0.1';
  const host = process.env.SUPPORT_HOST;
  if (!host || !/^[a-zA-Z0-9.:-]+$/u.test(host)) throw new Error('Hosted mode requires SUPPORT_HOST');
  return host;
}

/** Shared by Studio and privileged local writers. */
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
