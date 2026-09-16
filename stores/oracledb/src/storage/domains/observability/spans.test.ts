import type { BatchUpdateSpansArgs } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { OracleDB, OracleTxClient } from '../../db';
import { batchDeleteTraces, batchUpdateSpans } from './spans';

function createFakeDb() {
  const executeManyCalls: Array<{ sql: string; binds: Record<string, unknown>[] }> = [];
  const client = {
    executeMany: vi.fn(async (sql: string, binds: Record<string, unknown>[]) => {
      executeManyCalls.push({ sql, binds });
    }),
  } as unknown as OracleTxClient;
  const db = {
    tx: vi.fn(async (callback: (client: OracleTxClient) => Promise<void>) => callback(client)),
  };

  return { db: db as unknown as OracleDB, executeManyCalls };
}

describe('batchDeleteTraces', () => {
  it('deletes spans, logs, and scores for each trace in one transaction', async () => {
    const { db, executeManyCalls } = createFakeDb();

    await batchDeleteTraces(db, 'TEST_SCHEMA', { traceIds: ['trace-1', 'trace-2'] });

    expect(db.tx).toHaveBeenCalledTimes(1);
    expect(executeManyCalls).toHaveLength(3);
    expect(executeManyCalls.map(call => call.sql)).toEqual([
      'DELETE FROM "TEST_SCHEMA"."MASTRA_AI_SPANS" WHERE "traceId" = :traceId',
      'DELETE FROM "TEST_SCHEMA"."MASTRA_LOG_EVENTS" WHERE "traceId" = :traceId',
      'DELETE FROM "TEST_SCHEMA"."MASTRA_SCORERS" WHERE "traceId" = :traceId',
    ]);
    for (const call of executeManyCalls) {
      expect(call.binds).toEqual([{ traceId: 'trace-1' }, { traceId: 'trace-2' }]);
    }
  });

  it('still deletes spans and logs when the scorers table is not provisioned', async () => {
    const { db, executeManyCalls } = createFakeDb();
    const missingTable = new Error('ORA-00942: table or view does not exist') as Error & { errorNum: number };
    missingTable.errorNum = 942;
    let call = 0;
    const client = {
      executeMany: vi.fn(async (sql: string, binds: Record<string, unknown>[]) => {
        call++;
        if (sql.includes('MASTRA_SCORERS')) throw missingTable;
        executeManyCalls.push({ sql, binds });
      }),
    } as unknown as OracleTxClient;
    (db.tx as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (c: OracleTxClient) => Promise<void>) =>
      cb(client),
    );

    await expect(batchDeleteTraces(db, undefined, { traceIds: ['trace-1'] })).resolves.toBeUndefined();

    expect(call).toBe(3);
    expect(executeManyCalls.map(c => c.sql)).toEqual([
      'DELETE FROM "MASTRA_AI_SPANS" WHERE "traceId" = :traceId',
      'DELETE FROM "MASTRA_LOG_EVENTS" WHERE "traceId" = :traceId',
    ]);
  });

  it('rethrows non-ORA-00942 errors from the scorer delete', async () => {
    const { db } = createFakeDb();
    const otherError = new Error('ORA-01031: insufficient privileges') as Error & { errorNum: number };
    otherError.errorNum = 1031;
    const client = {
      executeMany: vi.fn(async (sql: string) => {
        if (sql.includes('MASTRA_SCORERS')) throw otherError;
      }),
    } as unknown as OracleTxClient;
    (db.tx as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (c: OracleTxClient) => Promise<void>) =>
      cb(client),
    );

    await expect(batchDeleteTraces(db, undefined, { traceIds: ['trace-1'] })).rejects.toThrow();
  });

  it('does not open a transaction for an empty trace batch', async () => {
    const { db } = createFakeDb();

    await batchDeleteTraces(db, undefined, { traceIds: [] });

    expect(db.tx).not.toHaveBeenCalled();
  });
});

describe('batchUpdateSpans update ordering (CR-10)', () => {
  it('applies the last update for a span even when the column shape alternates mid-batch', async () => {
    const { db, executeManyCalls } = createFakeDb();
    const args: BatchUpdateSpansArgs = {
      records: [
        { traceId: 'trace-1', spanId: 'span-1', updates: { name: 'first' } },
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          updates: { name: 'second', endedAt: new Date('2026-01-01T00:00:01.000Z') },
        },
        { traceId: 'trace-1', spanId: 'span-1', updates: { name: 'third' } },
      ],
    };

    await batchUpdateSpans(db, undefined, args);

    // Without coalescing by (traceId, spanId) first, grouping by changed-column
    // shape would replay the two name-only updates ('first', then 'third') in
    // one executeMany call and the name+endedAt update in another, and execute
    // the name+endedAt group LAST -- leaving name = 'second', the stale value.
    expect(executeManyCalls).toHaveLength(1);
    expect(executeManyCalls[0]!.binds).toHaveLength(1);
    expect(executeManyCalls[0]!.binds[0]).toMatchObject({
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'third',
      endedAt: new Date('2026-01-01T00:00:01.000Z'),
    });
  });

  it('still batches same-shape updates for distinct spans in one executeMany call', async () => {
    const { db, executeManyCalls } = createFakeDb();
    const args: BatchUpdateSpansArgs = {
      records: [
        { traceId: 'trace-1', spanId: 'span-1', updates: { name: 'a' } },
        { traceId: 'trace-1', spanId: 'span-2', updates: { name: 'b' } },
      ],
    };

    await batchUpdateSpans(db, undefined, args);

    expect(executeManyCalls).toHaveLength(1);
    expect(executeManyCalls[0]!.binds).toHaveLength(2);
    expect(executeManyCalls[0]!.binds.map(bind => bind.spanId)).toEqual(['span-1', 'span-2']);
  });
});
