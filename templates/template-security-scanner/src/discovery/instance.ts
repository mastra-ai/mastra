import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { ControlPlaneError } from '../core/contracts.js';
import type { Settings } from '../config/settings.js';
import { INSTANCE_DATABASE_NAME } from '../config/storage-names.js';

// The SQLite write transaction serializes stale-instance recovery. A live or
// ambiguous PID fails closed even when its event loop/heartbeat is delayed.
/** Acquire the project instance fence and return its guarded asynchronous release operation. */
export async function acquireInstance(settings: Settings) {
  const path = join(settings.dataDirectory, INSTANCE_DATABASE_NAME);
  const file = await open(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.()) throw new ControlPlaneError('INSTANCE_FILE_UNSAFE', 503);
    await file.chmod(0o600);
  } finally {
    await file.close();
  }
  const client = createClient({ url: `file:${path}` });
  const token = randomUUID();
  try {
    await client.execute('PRAGMA busy_timeout=5000');
    await client.execute(
      'CREATE TABLE IF NOT EXISTS scanner_local_instance (singleton INTEGER PRIMARY KEY CHECK(singleton=1),pid INTEGER NOT NULL,token TEXT NOT NULL)',
    );
    const transaction = await client.transaction('write');
    try {
      const observed = await transaction.execute('SELECT pid FROM scanner_local_instance WHERE singleton=1');
      if (observed.rows[0]) {
        let alive = true;
        try {
          process.kill(Number(observed.rows[0].pid), 0);
        } catch (error) {
          alive = (error as NodeJS.ErrnoException).code !== 'ESRCH';
        }
        if (alive) throw new ControlPlaneError('INSTANCE_ACTIVE', 409);
      }
      await transaction.execute({
        sql: 'INSERT INTO scanner_local_instance(singleton,pid,token) VALUES (1,?,?) ON CONFLICT(singleton) DO UPDATE SET pid=excluded.pid,token=excluded.token',
        args: [process.pid, token],
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  } catch (error) {
    client.close();
    throw error;
  }
  return async () => {
    try {
      const result = await client.execute({
        sql: 'DELETE FROM scanner_local_instance WHERE singleton=1 AND pid=? AND token=?',
        args: [process.pid, token],
      });
      if (result.rowsAffected !== 1) throw new ControlPlaneError('INSTANCE_LOCK_CHANGED', 503);
    } finally {
      client.close();
    }
  };
}
