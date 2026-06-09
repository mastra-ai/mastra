import { TABLE_SPANS, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DbClient, QueryValues, TxClient } from '../client';
import { PgDB } from './index';

type RecordedQuery = {
  query: string;
  values?: QueryValues;
};

function createMockTxClient(onNone: (query: string, values?: QueryValues) => Promise<null>): TxClient {
  return {
    none: vi.fn(async (query, values) => onNone(query, values)),
    one: vi.fn(async () => {
      throw new Error('Unexpected tx.one call');
    }),
    oneOrNone: vi.fn(async () => {
      throw new Error('Unexpected tx.oneOrNone call');
    }),
    any: vi.fn(async () => {
      throw new Error('Unexpected tx.any call');
    }),
    manyOrNone: vi.fn(async () => {
      throw new Error('Unexpected tx.manyOrNone call');
    }),
    many: vi.fn(async () => {
      throw new Error('Unexpected tx.many call');
    }),
    query: vi.fn(async () => {
      throw new Error('Unexpected tx.query call');
    }),
    batch: vi.fn(async <T>(promises: Promise<T>[]) => Promise.all(promises)),
  } as TxClient;
}

function createMockDbClient(
  txClient: TxClient,
): DbClient & { querySpy: ReturnType<typeof vi.fn>; txSpy: ReturnType<typeof vi.fn> } {
  const querySpy = vi.fn(async () => ({ rows: [] }) as any);
  const txSpy = vi.fn(async <T>(callback: (t: TxClient) => Promise<T>) => callback(txClient));

  return {
    $pool: {} as any,
    connect: vi.fn(async () => {
      throw new Error('Unexpected connect call');
    }),
    none: vi.fn(async () => {
      throw new Error('Unexpected none call');
    }),
    one: vi.fn(async () => {
      throw new Error('Unexpected one call');
    }),
    oneOrNone: vi.fn(async () => null),
    any: vi.fn(async () => []),
    manyOrNone: vi.fn(async () => []),
    many: vi.fn(async () => []),
    query: querySpy,
    tx: txSpy,
    querySpy,
    txSpy,
  } as DbClient & { querySpy: ReturnType<typeof vi.fn>; txSpy: ReturnType<typeof vi.fn> };
}

describe('PgDB transaction handling', () => {
  it('uses tx() for batchInsert instead of manual BEGIN/COMMIT/ROLLBACK queries', async () => {
    const txStatements: RecordedQuery[] = [];
    const txClient = createMockTxClient(async query => {
      txStatements.push({ query });
      return null;
    });
    const client = createMockDbClient(txClient);
    const db = new PgDB({ client });

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        { id: 'thread-1', resourceId: 'resource-1', title: 'One', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { id: 'thread-2', resourceId: 'resource-1', title: 'Two', createdAt: new Date('2024-01-01T00:00:01.000Z') },
      ],
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txStatements).toHaveLength(1);
    expect(txStatements.every(statement => statement.query.startsWith('INSERT INTO'))).toBe(true);
    expect(txStatements[0]!.query).toContain(
      'VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
    );
  });

  it('uses multi-row inserts for ordinary tables and chunks at bind parameter boundaries', async () => {
    const txStatements: RecordedQuery[] = [];
    const txClient = createMockTxClient(async (query, values) => {
      txStatements.push({ query, values });
      return null;
    });
    const client = createMockDbClient(txClient);
    client.manyOrNone = vi.fn(async () => [
      { column_name: 'id' },
      { column_name: 'resourceId' },
      { column_name: 'title' },
      { column_name: 'metadata' },
      { column_name: 'createdAt' },
      { column_name: 'createdAtZ' },
      { column_name: 'updatedAt' },
      { column_name: 'updatedAtZ' },
    ]);
    const db = new PgDB({ client });

    const records = Array.from({ length: 8192 }, (_, index) => ({
      id: `thread-${index}`,
      resourceId: `resource-${index}`,
      title: `thread-title-${index}`,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    }));

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records,
    });

    expect(txStatements).toHaveLength(2);
    expect(txStatements[0]!.query).toContain('INSERT INTO "public"."mastra_threads"');
    expect(txStatements[0]!.query).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $8)');
    expect(txStatements[0]!.query).toContain('), ($');
    expect(txStatements[0]!.values).toHaveLength(65_528);
    expect(txStatements[1]!.query).toContain('INSERT INTO "public"."mastra_threads"');
    expect(txStatements[1]!.values).toHaveLength(8);
    expect(client.manyOrNone).toHaveBeenCalledOnce();
  });

  it('splits span batch inserts when duplicate (traceId, spanId) targets appear in the same input batch', async () => {
    const txStatements: RecordedQuery[] = [];
    const txClient = createMockTxClient(async (query, values) => {
      txStatements.push({ query, values });
      return null;
    });
    const client = createMockDbClient(txClient);
    const db = new PgDB({ client });

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'first',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'second',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:01.000Z'),
        },
        {
          traceId: 'trace-1',
          spanId: 'span-2',
          name: 'third',
          spanType: 'tool_call',
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:02.000Z'),
        },
      ],
    });

    expect(txStatements).toHaveLength(2);
    expect(txStatements.every(statement => statement.query.startsWith('INSERT INTO "public"."mastra_ai_spans"'))).toBe(true);
    expect(txStatements[0]!.values).toHaveLength(6);
    expect(txStatements[1]!.values).toHaveLength(12);
    expect(txStatements[1]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE SET');
  });

  it('uses tx() for batchUpdate instead of manual BEGIN/COMMIT/ROLLBACK queries', async () => {
    const txStatements: string[] = [];
    const txClient = createMockTxClient(async query => {
      txStatements.push(query);
      return null;
    });
    const client = createMockDbClient(txClient);
    const db = new PgDB({ client });

    await db.batchUpdate({
      tableName: TABLE_THREADS,
      updates: [
        { keys: { id: 'thread-1' }, data: { title: 'Updated one' } },
        { keys: { id: 'thread-2' }, data: { title: 'Updated two' } },
      ],
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txStatements).toHaveLength(2);
    expect(txStatements.every(query => query.startsWith('UPDATE'))).toBe(true);
  });
});
