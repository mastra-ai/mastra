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
});
