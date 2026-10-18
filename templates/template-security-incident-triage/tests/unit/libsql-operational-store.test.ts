import type { Client, Transaction } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';

import { LibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import { createTempDatabase } from '../helpers/temp-libsql.js';

describe('LibSqlOperationalStore local contention', () => {
  it('queues direct writes behind a live transaction without starving its commit', async () => {
    const database = await createTempDatabase();
    const first = database.createStore();
    const second = database.createStore();
    let release = () => {};
    let entered = () => {};
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    const ready = new Promise<void>(resolve => {
      entered = resolve;
    });
    try {
      await first.execute({
        sql: 'CREATE TABLE probe (id INTEGER PRIMARY KEY)',
      });
      // Initialize the second connection's pragma before holding a write lock.
      await second.execute({ sql: 'SELECT 1' });
      const transaction = first.transaction(async tx => {
        await tx.execute({ sql: 'INSERT INTO probe VALUES (1)' });
        entered();
        await hold;
      });
      await ready;
      let completed = false;
      const direct = second.execute({ sql: 'INSERT INTO probe VALUES (2)' }).then(() => {
        completed = true;
      });
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(completed).toBe(false);
      release();
      await Promise.all([transaction, direct]);
      expect((await first.execute({ sql: 'SELECT count(*) AS count FROM probe' })).rows[0]!.count).toBe(2);
    } finally {
      release();
      first.close();
      second.close();
      await database.cleanup();
    }
  });
  it('restarts a local write transaction after a retryable SQLite lock', async () => {
    const transaction = {
      closed: false,
      execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
      batch: vi.fn(async () => []),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      close: vi.fn(),
    } as unknown as Transaction;
    const client = {
      execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
      transaction: vi.fn().mockRejectedValueOnce({ code: 'SQLITE_BUSY' }).mockResolvedValue(transaction),
      close: vi.fn(),
    } as unknown as Client;
    const store = new LibSqlOperationalStore(client, 'file:test.db');

    await expect(
      store.transaction(async tx => {
        await tx.execute({ sql: 'SELECT 1' });
        return 'committed';
      }),
    ).resolves.toBe('committed');

    expect(client.transaction).toHaveBeenCalledTimes(2);
    expect(client.execute).toHaveBeenCalledWith('PRAGMA busy_timeout=0');
    expect(transaction.commit).toHaveBeenCalledOnce();
    store.close();
  });
});
