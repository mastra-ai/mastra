import { describeFactoryStorageContract } from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';

import { PgFactoryStorage } from './factory-storage';
import { connectionString } from './test-utils';

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

  it('destroys the client when rollback fails', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const rollbackError = new Error('rollback failed');
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('commit failed'))
      .mockRejectedValueOnce(rollbackError);
    const pool = storage.authDatabase().pool;
    const connect = vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as never);

    try {
      await expect(storage.withDistributedLock('rollback-failure', async () => 'result')).rejects.toThrow(
        'Distributed lock operation and rollback both failed',
      );
      expect(release).toHaveBeenCalledWith(rollbackError);
    } finally {
      connect.mockRestore();
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
