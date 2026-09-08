import { describeFactoryStorageContract } from '@internal/storage-test-utils';
import { Pool } from 'pg';
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

  // A `json` column may hold any JSON value, not just an object. Encrypted
  // secrets are stored as an opaque envelope string, which node-pg reads back
  // as a JS string; a second JSON.parse on that value used to throw and take
  // the whole row down with it.
  it('round-trips every JSON value type through a json column', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const table = 'json_value_roundtrip';

    try {
      await storage.ensureCollections([
        {
          name: table,
          columns: { id: { type: 'uuid-pk' }, label: { type: 'text' }, data: { type: 'json' } },
        },
      ]);
      await storage.ops.deleteMany(table, {});
      const cases: Array<[string, unknown]> = [
        ['string', 'mastra:factory-secret:v1:eyJrZXlJZCI6InYxIn0'],
        ['object', { type: 'api_key', key: 'sk-123' }],
        ['array', [1, 2, 3]],
        ['number', 42],
        ['boolean', true],
      ];

      for (const [label, data] of cases) {
        const inserted = await storage.ops.insertOne(table, { label, data });
        expect(inserted.data, `insertOne returned the wrong value for ${label}`).toEqual(data);

        const found = await storage.ops.findOne<{ data: unknown }>(table, { label });
        expect(found?.data, `findOne returned the wrong value for ${label}`).toEqual(data);
      }
    } finally {
      await storage.ops.deleteMany(table, {}).catch(() => {});
      await storage.close();
    }
  });

  it('widens an integer column to bigint on a table created before the schema changed', async () => {
    const storage = new PgFactoryStorage({ connectionString });
    const pool = new Pool({ connectionString });
    const table = 'bigint_widening';
    const epochMs = 1_780_000_000_000;
    const columnsAs = (type: 'integer' | 'bigint') => ({ id: { type: 'uuid-pk' as const }, stamp: { type } });

    try {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
      await storage.ensureCollections([{ name: table, columns: columnsAs('integer') }]);
      await storage.ensureCollections([{ name: table, columns: columnsAs('bigint') }]);

      const inserted = await storage.ops.insertOne(table, { stamp: epochMs });
      expect(inserted.stamp).toBe(epochMs);
      const found = await storage.ops.findOne<{ stamp: number }>(table, { stamp: epochMs });
      expect(found?.stamp).toBe(epochMs);
    } finally {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`).catch(() => {});
      await pool.end();
      await storage.close();
    }
  });
});
