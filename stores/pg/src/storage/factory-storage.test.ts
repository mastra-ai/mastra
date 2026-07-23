import { describeFactoryStorageContract } from '@internal/storage-test-utils';
import { describe, expect, it } from 'vitest';

import { hashAdvisoryLockKey, PgFactoryStorage } from './factory-storage';
import { connectionString } from './test-utils';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describeFactoryStorageContract('pg', async () => {
  const storage = new PgFactoryStorage({ connectionString });
  return { storage, close: () => storage.close() };
});

describe('PgFactoryStorage capabilities', () => {
  it('withDistributedLock serializes concurrent critical sections', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    try {
      let active = 0;
      let maxActive = 0;
      await Promise.all(
        Array.from({ length: 5 }, () =>
          storage.withDistributedLock('contract-lock-key', async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
          }),
        ),
      );
      expect(maxActive).toBe(1);
    } finally {
      await storage.close();
    }
  });

  it('does not hold an open transaction while the critical section runs', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const enteredCriticalSection = deferred();
    const releaseCriticalSection = deferred();
    const key = 'non-transactional-lock-key';
    const [classId, objectId] = hashAdvisoryLockKey(key);

    try {
      const lockPromise = storage.withDistributedLock(key, async () => {
        enteredCriticalSection.resolve();
        await releaseCriticalSection.promise;
      });
      await enteredCriticalSection.promise;
      const pool = storage.authDatabase().pool;
      const result = await pool.query<{ state: string }>(
        `SELECT activity.state
         FROM pg_locks locks
         JOIN pg_stat_activity activity ON activity.pid = locks.pid
         WHERE locks.locktype = 'advisory'
           AND locks.classid = $1
           AND locks.objid = $2
           AND locks.objsubid = 2
           AND locks.granted`,
        [classId >>> 0, objectId >>> 0],
      );

      expect(result.rows).toEqual([{ state: 'idle' }]);
      releaseCriticalSection.resolve();
      await lockPromise;
    } finally {
      releaseCriticalSection.resolve();
      await storage.close();
    }
  });

  it('authDatabase exposes the shared pool tagged as postgres', () => {
    const storage = new PgFactoryStorage({ connectionString });
    const db = storage.authDatabase();
    expect(db.dialect).toBe('postgres');
    expect(db).toHaveProperty('pool');
    void storage.close();
  });
});
