import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const databaseWriteChains = new Map<string, Promise<void>>();

export async function getLocalFileDatabaseKey({
  url,
  syncUrl,
  cwd,
}: {
  url: string;
  syncUrl?: string;
  cwd: string;
}): Promise<string | undefined> {
  if (!url.startsWith('file:') || url.includes(':memory:') || syncUrl) {
    return undefined;
  }

  const uriPath = url.slice('file:'.length).split(/[?#]/, 1)[0]!;
  const decodedPath = decodeURIComponent(uriPath);
  const absolutePath = isAbsolute(decodedPath) ? decodedPath : resolve(cwd, decodedPath);

  try {
    return await realpath(absolutePath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  return join(await realpath(dirname(absolutePath)), basename(absolutePath));
}

export function withLocalFileDatabaseWriteLock<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
  if (!key) {
    return fn();
  }

  const previous = databaseWriteChains.get(key) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  databaseWriteChains.set(key, tail);

  void tail.then(() => {
    if (databaseWriteChains.get(key) === tail) {
      databaseWriteChains.delete(key);
    }
  });

  return result;
}
