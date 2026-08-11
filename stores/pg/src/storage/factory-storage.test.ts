import { describeFactoryStorageContract } from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';

import { PgFactoryStorage } from './factory-storage';
import { connectionString } from './test-utils';

describeFactoryStorageContract('pg', async () => {
  const storage = new PgFactoryStorage({ connectionString });
  return { storage, close: () => storage.close() };
});

describe('PgFactoryStorage capabilities', () => {
  it('starts serializable transactions without advisory locks', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue(undefined);
    const pool = storage.authDatabase().pool;
    const connect = vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as never);

    try {
      await storage.withTransaction(async () => 'result', { isolationLevel: 'serializable' });
      expect(query).toHaveBeenNthCalledWith(1, 'BEGIN ISOLATION LEVEL SERIALIZABLE');
      expect(query).toHaveBeenNthCalledWith(2, 'COMMIT');
      expect(query.mock.calls.flat().join(' ')).not.toContain('pg_advisory');
    } finally {
      connect.mockRestore();
      await storage.close();
    }
  });

  it('retries serializable transactions after serialization failures', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const serializationFailure = Object.assign(new Error('serialization failure'), { code: '40001' });
    const firstRelease = vi.fn();
    const secondRelease = vi.fn();
    const firstQuery = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(serializationFailure)
      .mockResolvedValueOnce(undefined);
    const secondQuery = vi.fn().mockResolvedValue(undefined);
    const pool = storage.authDatabase().pool;
    const connect = vi
      .spyOn(pool, 'connect')
      .mockResolvedValueOnce({ query: firstQuery, release: firstRelease } as never)
      .mockResolvedValueOnce({ query: secondQuery, release: secondRelease } as never);
    const fn = vi.fn().mockResolvedValue('result');

    try {
      await expect(storage.withTransaction(fn, { isolationLevel: 'serializable' })).resolves.toBe('result');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(firstQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
      expect(secondQuery).toHaveBeenNthCalledWith(1, 'BEGIN ISOLATION LEVEL SERIALIZABLE');
      expect(secondQuery).toHaveBeenNthCalledWith(2, 'COMMIT');
    } finally {
      connect.mockRestore();
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
      .mockRejectedValueOnce(new Error('commit failed'))
      .mockRejectedValueOnce(rollbackError);
    const pool = storage.authDatabase().pool;
    const connect = vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as never);

    try {
      await expect(storage.withTransaction(async () => 'result')).rejects.toThrow(
        'Factory transaction and rollback both failed',
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
