import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export function localDatabasePath(url: string) {
  if (!url.startsWith('file:')) throw new Error('LOCAL_DATABASE_REQUIRED');
  return resolve(url.slice(5));
}

// This filesystem lease guards CLI/Studio processes. The database admission queue only
// coordinates connections inside this process. A crash requires explicit operator recovery.
export function writerLease(url: string) {
  const database = localDatabasePath(url),
    path = `${database}.writer`,
    token = randomUUID();
  let held = false;
  return {
    acquire() {
      if (held) return;
      mkdirSync(dirname(database), { recursive: true });
      try {
        mkdirSync(path, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('DATABASE_WRITER_OWNED');
        throw error;
      }
      try {
        writeFileSync(resolve(path, 'owner.json'), JSON.stringify({ pid: process.pid, token }), {
          flag: 'wx',
          mode: 0o600,
        });
        held = true;
      } catch (error) {
        rmSync(path, { recursive: true, force: true });
        throw error;
      }
    },
    release() {
      if (!held) return;
      const owner = JSON.parse(readFileSync(resolve(path, 'owner.json'), 'utf8'));
      if (owner.token !== token) throw new Error('DATABASE_WRITER_OWNERSHIP_CHANGED');
      rmSync(path, { recursive: true });
      held = false;
    },
  };
}

export function recoverWriterLease(url: string, expectedToken: string) {
  const path = `${localDatabasePath(url)}.writer`;
  const owner = JSON.parse(readFileSync(resolve(path, 'owner.json'), 'utf8'));
  if (owner.token !== expectedToken || !Number.isSafeInteger(owner.pid))
    throw new Error('DATABASE_WRITER_OWNERSHIP_CHANGED');
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    rmSync(path, { recursive: true });
    return;
  }
  throw new Error('DATABASE_WRITER_STILL_ACTIVE');
}
