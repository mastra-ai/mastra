import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from './client';

/**
 * Fake PoolClient that rejects overlapping queries (pg@9 semantics).
 * Mirrors stores/pg/src/storage/client.tx-serialize.test.ts — the dsql
 * TransactionClient is a separate copy of the pg one, so it needs its own
 * guard against drift.
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

describe('TransactionClient COMMIT/ROLLBACK drain (dsql)', () => {
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

  it('preserves the original failure and destroys the pooled client if rollback fails', async () => {
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

  it('destroys the client if BEGIN rejects without running the callback', async () => {
    const { client, query } = createStrictClient();
    const beginError = new Error('BEGIN timed out after reaching PostgreSQL');
    query.mockRejectedValueOnce(beginError);
    const callback = vi.fn(async () => undefined);
    const adapter = new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool);
    await expect(adapter.tx(callback)).rejects.toBe(beginError);
    expect(callback).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('preserves the original error when the diagnostic callback throws', async () => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    query.mockResolvedValueOnce({ rows: [] } as QueryResult);
    query.mockRejectedValueOnce(new Error('rollback failed'));
    const reporter = vi.fn(() => {
      throw new Error('logger failed');
    });
    const adapter = new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool, reporter);
    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    expect(reporter).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('awaits a rejecting asynchronous rollback reporter without masking the original error', async () => {
    const { client, query } = createStrictClient();
    const primary = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    query.mockResolvedValueOnce({ rows: [] } as QueryResult);
    query.mockRejectedValueOnce(rollbackError);
    const events: string[] = [];
    let reportedError: unknown;
    const reporter = async (error: unknown) => {
      reportedError = error;
      await new Promise(resolve => setTimeout(resolve, 10));
      events.push('reported');
      throw new Error('async logger failed');
    };
    vi.mocked(client.release).mockImplementation(() => {
      events.push('released');
    });
    const adapter = new PoolAdapter({ connect: vi.fn(async () => client) } as unknown as Pool, reporter);
    await expect(
      adapter.tx(async () => {
        throw primary;
      }),
    ).rejects.toBe(primary);
    events.push('tx-settled');
    expect(reportedError).toBe(rollbackError);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(events).toEqual(['reported', 'released', 'tx-settled']);
  });

  it('logs rollback failure without a diagnostic callback', async () => {
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
