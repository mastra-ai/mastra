import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PinnedClientAdapter, PoolAdapter } from './client';

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
});
