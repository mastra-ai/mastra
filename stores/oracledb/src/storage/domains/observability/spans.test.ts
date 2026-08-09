import type { BatchUpdateSpansArgs } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { OracleDB, OracleTxClient } from '../../db';
import { batchUpdateSpans } from './spans';

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
