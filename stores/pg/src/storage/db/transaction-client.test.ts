import { TABLE_THREADS } from '@mastra/core/storage';
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
    const txStatements: string[] = [];
    const txClient = createMockTxClient(async query => {
      txStatements.push(query);
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
    expect(txStatements).toHaveLength(2);
    expect(txStatements.every(query => query.startsWith('INSERT INTO'))).toBe(true);
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
