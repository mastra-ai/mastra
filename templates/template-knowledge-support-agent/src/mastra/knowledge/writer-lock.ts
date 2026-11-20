import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonicalDatabasePath } from '../database.ts';

export class WriterBusyError extends Error {
  readonly lockPath: string;
  constructor(lockPath: string) {
    super(`Knowledge writer lock is held: ${lockPath}. Retry after the writer exits.`);
    this.name = 'WriterBusyError';
    this.lockPath = lockPath;
  }
}

interface Owner {
  pid: number;
  host: string;
  token: string;
}

function owner(text: string): Owner {
  const value = JSON.parse(text) as Owner;
  if (
    !Number.isSafeInteger(value.pid) ||
    value.pid < 1 ||
    typeof value.host !== 'string' ||
    typeof value.token !== 'string'
  ) {
    throw new Error('Uncertain writer ownership; leave the lock intact');
  }
  return value;
}

async function createLock(path: string, contents: Owner) {
  let created = false;
  try {
    const file = await open(path, 'wx', 0o600);
    created = true;
    try {
      await file.writeFile(JSON.stringify(contents));
    } finally {
      await file.close();
    }
  } catch (error) {
    if (created) await unlink(path);
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new WriterBusyError(path);
    throw error;
  }
}

/** All privileged writers, including review publication, must hold this lock around reads and writes. */
export async function acquireWriterLock(databaseUrl?: string, recoverStoppedOwner = false) {
  const databasePath = await canonicalDatabasePath(databaseUrl);
  const lockPath = `${databasePath}.writer.lock`;
  const contents: Owner = { pid: process.pid, host: hostname(), token: randomUUID() };
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  if (recoverStoppedOwner) {
    // Serialize recovery itself. Ordinary acquisition still uses atomic exclusive creation.
    const recoveryPath = `${lockPath}.recovery`;
    await createLock(recoveryPath, contents);
    try {
      let previous: Owner | undefined;
      try {
        previous = owner(await readFile(lockPath, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (previous) {
        if (previous.host !== hostname()) throw new Error('Cannot prove the writer on another host has stopped');
        try {
          process.kill(previous.pid, 0);
          throw new WriterBusyError(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
        await unlink(lockPath);
      }
    } finally {
      await unlink(recoveryPath);
    }
  }
  await createLock(lockPath, contents);
  return {
    databasePath,
    lockPath,
    async release() {
      const current = owner(await readFile(lockPath, 'utf8'));
      if (current.token !== contents.token) throw new Error('Writer ownership changed; leave the lock intact');
      await unlink(lockPath);
    },
  };
}
