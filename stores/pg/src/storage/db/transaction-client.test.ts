import { TABLE_SPANS, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { DbClient, QueryValues, TxClient } from '../client';
import { PgDB } from './index';

function createMockTxClient(onNone: (query: string, values?: QueryValues) => Promise<null>): TxClient {
  return {
    none: vi.fn(onNone),
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
  tableColumns: string[] = [],
): DbClient & {
  querySpy: ReturnType<typeof vi.fn>;
  txSpy: ReturnType<typeof vi.fn>;
  manyOrNoneSpy: ReturnType<typeof vi.fn>;
} {
  const querySpy = vi.fn(async () => ({ rows: [] }) as any);
  const txSpy = vi.fn(async <T>(callback: (t: TxClient) => Promise<T>) => callback(txClient));
  const manyOrNoneSpy = vi.fn(async () => tableColumns.map(column_name => ({ column_name })));

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
    manyOrNone: manyOrNoneSpy,
    many: vi.fn(async () => []),
    query: querySpy,
    tx: txSpy,
    querySpy,
    txSpy,
    manyOrNoneSpy,
  } as DbClient & {
    querySpy: ReturnType<typeof vi.fn>;
    txSpy: ReturnType<typeof vi.fn>;
    manyOrNoneSpy: ReturnType<typeof vi.fn>;
  };
}

function setupBatchInsertHarness(tableColumns?: string[]) {
  const txCalls: Array<{ query: string; values?: QueryValues }> = [];
  const txClient = createMockTxClient(async (query, values) => {
    txCalls.push({ query, values });
    return null;
  });
  const client = createMockDbClient(txClient, tableColumns);
  const db = new PgDB({ client });
  return { txCalls, client, db };
}

describe('PgDB transaction handling', () => {
  it('uses tx() for batchInsert instead of manual BEGIN/COMMIT/ROLLBACK queries', async () => {
    const { txCalls, client, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        { id: 'thread-1', resourceId: 'resource-1', title: 'One', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { id: 'thread-2', resourceId: 'resource-1', title: 'Two', createdAt: new Date('2024-01-01T00:00:01.000Z') },
      ],
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.query).toContain('INSERT INTO');
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)');
    expect(txCalls[0]!.values).toHaveLength(10);
  });

  it('uses the table column cache while preparing batchInsert records', async () => {
    const { txCalls, client, db } = setupBatchInsertHarness([
      'id',
      'resourceId',
      'title',
      'createdAt',
      'updatedAt',
      'createdAtZ',
      'updatedAtZ',
    ]);

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'One',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:01.000Z'),
          ignoredColumn: true,
        },
        {
          id: 'thread-2',
          resourceId: 'resource-1',
          title: 'Two',
          createdAt: new Date('2024-01-01T00:00:02.000Z'),
          updatedAt: new Date('2024-01-01T00:00:03.000Z'),
          ignoredColumn: true,
        },
      ],
    });

    expect(client.manyOrNoneSpy).toHaveBeenCalledOnce();
    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.query).not.toContain('ignoredColumn');
    expect(txCalls[0]!.values).toHaveLength(14);
  });

  it('keeps separate batchInsert statements for incompatible column shapes', async () => {
    const { txCalls, client, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        { id: 'thread-1', resourceId: 'resource-1', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { id: 'thread-2', resourceId: 'resource-1', title: 'Two', createdAt: new Date('2024-01-01T00:00:01.000Z') },
      ],
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(2);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3, $4)');
    expect(txCalls[0]!.values).toHaveLength(4);
    expect(txCalls[1]!.query).toContain('VALUES ($1, $2, $3, $4, $5)');
    expect(txCalls[1]!.values).toHaveLength(5);
  });

  it('batches compatible records even when incompatible shapes are interleaved', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        { id: 'thread-1', resourceId: 'resource-1', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { id: 'thread-2', resourceId: 'resource-1', title: 'Two', createdAt: new Date('2024-01-01T00:00:01.000Z') },
        { id: 'thread-3', resourceId: 'resource-1', createdAt: new Date('2024-01-01T00:00:02.000Z') },
      ],
    });

    expect(txCalls).toHaveLength(2);
    expect(txCalls[0]!.values).toContain('thread-1');
    expect(txCalls[0]!.values).toContain('thread-3');
    expect(txCalls[0]!.values).not.toContain('thread-2');
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)');
    expect(txCalls[1]!.values).toContain('thread-2');
    expect(txCalls[1]!.values).not.toContain('thread-1');
    expect(txCalls[1]!.values).not.toContain('thread-3');
    expect(txCalls[1]!.query).toContain('VALUES ($1, $2, $3, $4, $5)');
  });

  it('batches records with the same columns regardless of input key order', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: [
        { id: 'thread-1', resourceId: 'resource-1', title: 'One', createdAt: new Date('2024-01-01T00:00:00.000Z') },
        { title: 'Two', resourceId: 'resource-1', createdAt: new Date('2024-01-01T00:00:01.000Z'), id: 'thread-2' },
      ],
    });

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.values).toHaveLength(10);
  });

  it('splits batchInsert statements at the Postgres parameter boundary', async () => {
    const { txCalls, client, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_THREADS,
      records: Array.from({ length: 12_001 }, (_, index) => ({
        id: `thread-${index}`,
        resourceId: 'resource-1',
        title: `Thread ${index}`,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      })),
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(2);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3, $4, $5)');
    expect(txCalls[0]!.values).toHaveLength(60_000);
    expect(txCalls[1]!.query).toContain('VALUES ($1, $2, $3, $4, $5)');
    expect(txCalls[1]!.values).toHaveLength(5);
  });

  it('batches distinct span inserts with the ON CONFLICT update clause', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: 'span-1', name: 'first' },
        { traceId: 'trace-1', spanId: 'span-2', name: 'second' },
      ],
    });

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3), ($4, $5, $6)');
    expect(txCalls[0]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE SET');
    expect(txCalls[0]!.values).toHaveLength(6);
  });

  it('orders span batch rows by conflict key before upsert', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: 'span-2', name: 'second' },
        { traceId: 'trace-1', spanId: 'span-1', name: 'first' },
      ],
    });

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.values!.indexOf('span-1')).toBeLessThan(txCalls[0]!.values!.indexOf('span-2'));
  });

  it('orders mixed-shape span inserts by conflict key before grouping compatible rows', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: 'span-1', name: 'first', startedAt: '2024-01-01T00:00:00.000Z' },
        {
          traceId: 'trace-1',
          spanId: 'span-2',
          name: 'second',
          parentSpanId: 'span-1',
          startedAt: '2024-01-01T00:00:01.000Z',
        },
        { traceId: 'trace-1', spanId: 'span-3', name: 'third', startedAt: '2024-01-01T00:00:02.000Z' },
      ],
    });

    expect(txCalls).toHaveLength(3);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3, $4)');
    expect(txCalls[0]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE SET');
    expect(txCalls[0]!.values).toContain('span-1');
    expect(txCalls[0]!.values).not.toContain('span-2');
    expect(txCalls[0]!.values).not.toContain('span-3');
    expect(txCalls[1]!.query).toContain('VALUES ($1, $2, $3, $4, $5)');
    expect(txCalls[1]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE SET');
    expect(txCalls[1]!.values).toContain('span-2');
    expect(txCalls[2]!.query).toContain('VALUES ($1, $2, $3, $4)');
    expect(txCalls[2]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE SET');
    expect(txCalls[2]!.values).toContain('span-3');
  });

  it('uses DO NOTHING for span batches with only conflict key columns', async () => {
    const { txCalls, db } = setupBatchInsertHarness(['traceId', 'spanId']);

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: 'span-1', name: 'first' },
        { traceId: 'trace-1', spanId: 'span-2', name: 'second' },
      ],
    });

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2), ($3, $4)');
    expect(txCalls[0]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO NOTHING');
    expect(txCalls[0]!.values).toEqual(['span-1', 'trace-1', 'span-2', 'trace-1']);
  });

  it('falls back to serial span inserts for duplicate span ids in the same batch', async () => {
    const { txCalls, client, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: 'span-2', name: 'third' },
        { traceId: 'trace-1', spanId: 'span-1', name: 'first' },
        { traceId: 'trace-1', spanId: 'span-1', name: 'second' },
      ],
    });

    expect(client.txSpy).toHaveBeenCalledOnce();
    expect(client.querySpy).not.toHaveBeenCalled();
    expect(txCalls).toHaveLength(3);
    expect(txCalls.every(call => call.query.includes('ON CONFLICT ("traceId", "spanId") DO UPDATE'))).toBe(true);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3)');
    expect(txCalls[1]!.query).toContain('VALUES ($1, $2, $3)');
    expect(txCalls[2]!.query).toContain('VALUES ($1, $2, $3)');
    expect(txCalls[0]!.values).toEqual(['first', 'span-1', 'trace-1']);
    expect(txCalls[1]!.values).toEqual(['second', 'span-1', 'trace-1']);
    expect(txCalls[2]!.values).toEqual(['third', 'span-2', 'trace-1']);
  });

  it('does not use the duplicate span fallback for null span keys', async () => {
    const { txCalls, db } = setupBatchInsertHarness();

    await db.batchInsert({
      tableName: TABLE_SPANS,
      records: [
        { traceId: 'trace-1', spanId: null, name: 'first' },
        { traceId: 'trace-1', spanId: null, name: 'second' },
      ],
    });

    expect(txCalls).toHaveLength(1);
    expect(txCalls[0]!.query).toContain('VALUES ($1, $2, $3), ($4, $5, $6)');
    expect(txCalls[0]!.query).toContain('ON CONFLICT ("traceId", "spanId") DO UPDATE');
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
