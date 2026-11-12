import { Pool } from 'pg';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PinnedClientAdapter, PoolAdapter } from './client';
import { connectionString } from './test-utils';

/**
 * Fake PoolClient that rejects overlapping queries (pg@9 semantics).
 * Used to prove COMMIT/ROLLBACK never races in-flight transaction work.
 */
function createStrictClient() {
  let inFlight = 0;
  const statements: string[] = [];

  const query = vi.fn(async (sql: string): Promise<QueryResult> => {
    if (inFlight > 0) {
      throw new Error(`Overlapping query while in-flight: ${sql}`);
    }
    inFlight += 1;
    statements.push(sql);
    try {
      if (sql === 'FAIL1') {
        throw new Error('FAIL1');
      }
      if (sql.startsWith('SLOW')) {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      return { rows: [], rowCount: 0, command: 'QUERY', oid: 0, fields: [] } as QueryResult;
    } finally {
      inFlight -= 1;
    }
  });

  const client = {
    query,
    release: vi.fn(),
  } as unknown as PoolClient;

  return { client, statements, query };
}

describe('TransactionClient COMMIT/ROLLBACK drain', () => {
  it('serializes concurrent t.none() calls onto one client', async () => {
    const { client, statements } = createStrictClient();
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    await adapter.tx(async t => {
      const q1 = t.none('SLOW1');
      const q2 = t.none('SLOW2');
      const q3 = t.none('SLOW3');
      await t.batch([q1, q2, q3]);
    });

    // The strict client throws on any overlap, so reaching this assertion
    // proves the three concurrent t.none() calls ran one at a time, in order.
    expect(statements).toEqual(['BEGIN', 'SLOW1', 'SLOW2', 'SLOW3', 'COMMIT']);
  });

  it('drains queued queries before ROLLBACK when batch fails', async () => {
    const { client, statements } = createStrictClient();
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    await expect(
      adapter.tx(async t => {
        const q1 = t.none('FAIL1');
        const q2 = t.none('SLOW2');
        const q3 = t.none('SLOW3');
        await t.batch([q1, q2, q3]);
      }),
    ).rejects.toThrow('FAIL1');

    expect(statements).toEqual(['BEGIN', 'FAIL1', 'SLOW2', 'SLOW3', 'ROLLBACK']);
    // No overlapping-query errors — ROLLBACK waited for the drain.
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('drains fire-and-forget queries before COMMIT', async () => {
    const { client, statements } = createStrictClient();
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    await adapter.tx(async t => {
      void t.none('SLOW2');
      return 'ok';
    });

    expect(statements).toEqual(['BEGIN', 'SLOW2', 'COMMIT']);
  });

  it('rolls back when a fire-and-forget query fails', async () => {
    const { client, statements } = createStrictClient();
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    await expect(
      adapter.tx(async t => {
        void t.none('FAIL1');
        return 'ok';
      }),
    ).rejects.toThrow('FAIL1');

    expect(statements).toEqual(['BEGIN', 'FAIL1', 'ROLLBACK']);
  });

  it('PinnedClientAdapter also drains before ROLLBACK', async () => {
    const { client, statements } = createStrictClient();
    const pool = {} as Pool;
    const adapter = new PinnedClientAdapter(pool, client);

    await expect(
      adapter.tx(async t => {
        const q1 = t.none('FAIL1');
        const q2 = t.none('SLOW2');
        await t.batch([q1, q2]);
      }),
    ).rejects.toThrow('FAIL1');

    expect(statements).toEqual(['BEGIN', 'FAIL1', 'SLOW2', 'ROLLBACK']);
  });

  it('PinnedClientAdapter rolls back when a fire-and-forget query fails', async () => {
    const { client, statements } = createStrictClient();
    const pool = {} as Pool;
    const adapter = new PinnedClientAdapter(pool, client);

    await expect(
      adapter.tx(async t => {
        void t.none('FAIL1');
        return 'ok';
      }),
    ).rejects.toThrow('FAIL1');

    expect(statements).toEqual(['BEGIN', 'FAIL1', 'ROLLBACK']);
  });

  it('destroys a pooled client on rollback failure and reports it without masking the original error', async () => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    query.mockImplementationOnce(async () => ({ rows: [] }) as QueryResult);
    query.mockImplementationOnce(async () => {
      throw rollbackError;
    });
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const onRollbackError = vi.fn();
    const adapter = new PoolAdapter(pool, onRollbackError);

    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    expect(onRollbackError).toHaveBeenCalledWith(rollbackError);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('keeps a pinned client poisoned until its owner destroys it', async () => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    query.mockImplementationOnce(async () => ({ rows: [] }) as QueryResult);
    query.mockImplementationOnce(async () => {
      throw rollbackError;
    });
    const onRollbackError = vi.fn();
    const adapter = new PinnedClientAdapter({} as Pool, client, onRollbackError);

    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    await expect(adapter.query('SELECT 1')).rejects.toBe(rollbackError);
    expect(query).toHaveBeenCalledTimes(2);
    expect(adapter.shouldDestroyClient).toBe(true);
    expect(onRollbackError).toHaveBeenCalledWith(rollbackError);
  });

  it.each(['pool', 'pinned'] as const)('poisons the %s client when BEGIN rejects', async kind => {
    const { client, query } = createStrictClient();
    const beginError = new Error('BEGIN timed out after reaching PostgreSQL');
    query.mockRejectedValueOnce(beginError);
    const callback = vi.fn(async () => undefined);
    const adapter =
      kind === 'pool'
        ? new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool)
        : new PinnedClientAdapter({} as Pool, client);

    await expect(adapter.tx(callback)).rejects.toBe(beginError);
    expect(callback).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    if (kind === 'pool') {
      expect(client.release).toHaveBeenCalledWith(true);
    } else {
      expect(adapter.shouldDestroyClient).toBe(true);
      await expect(adapter.query('SELECT 1')).rejects.toBe(beginError);
      expect(query).toHaveBeenCalledTimes(1);
    }
  });

  it.each(['pool', 'pinned'] as const)('preserves the primary %s error when rollback reporting throws', async kind => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    query.mockResolvedValueOnce({ rows: [] } as QueryResult);
    query.mockRejectedValueOnce(new Error('rollback failed'));
    const reporter = vi.fn(() => {
      throw new Error('logger failed');
    });
    const adapter =
      kind === 'pool'
        ? new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool, reporter)
        : new PinnedClientAdapter({} as Pool, client, reporter);
    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    expect(reporter).toHaveBeenCalledOnce();
    if (kind === 'pool') expect(client.release).toHaveBeenCalledWith(true);
    else expect(adapter.shouldDestroyClient).toBe(true);
  });

  it.each(['pool', 'pinned'] as const)('awaits a rejecting asynchronous %s rollback reporter', async kind => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    query.mockResolvedValueOnce({ rows: [] } as QueryResult);
    query.mockRejectedValueOnce(rollbackError);
    const reporter = vi.fn(async () => {
      await Promise.resolve();
      throw new Error('async logger failed');
    });
    const adapter =
      kind === 'pool'
        ? new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool, reporter)
        : new PinnedClientAdapter({} as Pool, client, reporter);

    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    expect(reporter).toHaveBeenCalledWith(rollbackError);
    if (kind === 'pool') expect(client.release).toHaveBeenCalledWith(true);
    else expect(adapter.shouldDestroyClient).toBe(true);
  });

  it('logs rollback failure when no reporter is configured', async () => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    query.mockResolvedValueOnce({ rows: [] } as QueryResult);
    query.mockRejectedValueOnce(rollbackError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const adapter = new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool);
      await expect(
        adapter.tx(async () => {
          throw primary;
        }),
      ).rejects.toBe(primary);
      expect(consoleError).toHaveBeenCalledWith('Failed to rollback transaction:', rollbackError);
      expect(client.release).toHaveBeenCalledWith(true);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('PoolAdapter rollback failure with a real PostgreSQL pool', () => {
  it('discards a client when BEGIN times out after reaching PostgreSQL', async () => {
    const pool = new Pool({ connectionString, max: 1, query_timeout: 100 });
    try {
      const original = await pool.query('SELECT pg_backend_pid() AS pid');
      const connect = pool.connect.bind(pool);
      const connectSpy = vi.spyOn(pool, 'connect').mockImplementation(async () => {
        const client = await connect();
        const query = client.query.bind(client);
        vi.spyOn(client, 'query').mockImplementation(((sql: string) =>
          sql === 'BEGIN' ? query('BEGIN; SELECT pg_sleep(0.5)') : query(sql)) as typeof client.query);
        return client;
      });
      try {
        await expect(
          new PoolAdapter(pool).tx(async () => {
            throw new Error('callback must not run');
          }),
        ).rejects.toThrow(/timeout/i);
      } finally {
        connectSpy.mockRestore();
      }
      const next = await pool.query('SELECT pg_backend_pid() AS pid');
      expect(next.rows[0].pid).not.toBe(original.rows[0].pid);
      expect(pool.totalCount).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it('discards a pinned client after a timed-out BEGIN before its next checkout', async () => {
    const pool = new Pool({ connectionString, max: 1, query_timeout: 100 });
    try {
      const client = await pool.connect();
      let originalPid: number;
      let destroyClient = false;
      try {
        const original = await client.query('SELECT pg_backend_pid() AS pid');
        originalPid = original.rows[0].pid;
        const query = client.query.bind(client);
        vi.spyOn(client, 'query').mockImplementation(((sql: string) =>
          sql === 'BEGIN' ? query('BEGIN; SELECT pg_sleep(0.5)') : query(sql)) as typeof client.query);
        const pinned = new PinnedClientAdapter(pool, client);
        try {
          await expect(
            pinned.tx(async () => {
              throw new Error('callback must not run');
            }),
          ).rejects.toThrow(/timeout/i);
          await expect(pinned.query('SELECT 1')).rejects.toThrow(/timeout/i);
          await pinned.drain();
        } finally {
          destroyClient = pinned.shouldDestroyClient;
        }
      } finally {
        client.release(destroyClient || undefined);
      }
      const next = await pool.query('SELECT pg_backend_pid() AS pid');
      expect(next.rows[0].pid).not.toBe(originalPid);
    } finally {
      await pool.end();
    }
  });

  it('never exposes an uncommitted write to the next pool caller', async () => {
    const pool = new Pool({ connectionString, max: 1 });
    const table = `tx_rollback_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');

    try {
      await pool.query(`CREATE TABLE "${table}" (id integer)`);
      const connect = pool.connect.bind(pool);
      const connectSpy = vi.spyOn(pool, 'connect').mockImplementation(async () => {
        const client = await connect();
        const query = client.query.bind(client);
        vi.spyOn(client, 'query').mockImplementation(((sql: string) =>
          sql === 'ROLLBACK' ? Promise.reject(rollbackError) : query(sql)) as typeof client.query);
        return client;
      });

      try {
        await expect(
          new PoolAdapter(pool).tx(async t => {
            await t.none(`INSERT INTO "${table}" (id) VALUES (1)`);
            throw primary;
          }),
        ).rejects.toBe(primary);
      } finally {
        connectSpy.mockRestore();
      }

      const result = await pool.query(`SELECT COUNT(*)::integer AS count FROM "${table}"`);
      expect(result.rows[0].count).toBe(0);
    } finally {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
      await pool.end();
    }
  });
});
