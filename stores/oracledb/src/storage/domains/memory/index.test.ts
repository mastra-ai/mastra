import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { describe, expect, it, vi } from 'vitest';

import type { OracleTxClient } from '../../db';
import { MemoryOracle } from '.';

type SqlCall = {
  sql: string;
  binds?: Record<string, unknown>;
};

function createMemoryOracle(config: Partial<ConstructorParameters<typeof MemoryOracle>[0]> = {}): MemoryOracle {
  return new MemoryOracle({ poolManager: {} as any, ...config });
}

function createMessage(id: string, threadId: string): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId: 'resource-1',
    content: `content-${id}`,
    role: 'user',
    type: 'v2',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as MastraDBMessage;
}

function createThread(id: string): StorageThreadType {
  return {
    id,
    resourceId: 'resource-1',
    title: `Thread ${id}`,
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('MemoryOracle message consistency', () => {
  it('validates every distinct thread before saving a mixed-thread batch', async () => {
    const memory = createMemoryOracle();
    const db = {
      tx: vi.fn(),
    };
    (memory as any).db = db;
    (memory as any).getThreadById = vi.fn(async ({ threadId }: { threadId: string }) =>
      threadId === 'thread-missing' ? null : createThread(threadId),
    );

    await expect(
      memory.saveMessages({
        messages: [createMessage('msg-1', 'thread-ok'), createMessage('msg-2', 'thread-missing')],
      }),
    ).rejects.toThrow(/thread-missing/i);

    expect(db.tx).not.toHaveBeenCalled();
  });

  it('deletes semantic-recall vectors for deleted message ids', async () => {
    const memory = createMemoryOracle();
    const noneCalls: SqlCall[] = [];
    const executeMany = vi.fn();
    const client = {
      manyOrNone: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT DISTINCT thread_id')) return [{ threadId: 'thread-1' }];
        if (sql.includes('MASTRA_VECTOR_INDEXES')) return [{ tableName: 'MASTRA_MEMORY_TEST' }];
        return [];
      }),
      none: vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
        noneCalls.push({ sql, binds });
      }),
      executeMany,
    } as unknown as OracleTxClient;
    const db = {
      tx: vi.fn(async (callback: (client: OracleTxClient) => Promise<void>) => callback(client)),
    };
    (memory as any).db = db;

    await memory.deleteMessages(['msg-1', 'msg-2']);

    expect(noneCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("JSON_VALUE(metadata, '$.message_id'"),
          binds: {
            semanticMessageId0: 'msg-1',
            semanticMessageId1: 'msg-2',
          },
        }),
      ]),
    );
    expect(executeMany).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "MASTRA_THREADS"'),
      [{ updatedAt: expect.any(Date), threadId: 'thread-1' }],
    );
  });

  it('uses the configured vector registry table for semantic-recall cleanup', async () => {
    const memory = createMemoryOracle({ vectorRegistryTableName: 'CUSTOM_VECTOR_REGISTRY' });
    const manyOrNoneSql: string[] = [];
    const noneCalls: SqlCall[] = [];
    const client = {
      manyOrNone: vi.fn(async (sql: string) => {
        manyOrNoneSql.push(sql);
        if (sql.includes('CUSTOM_VECTOR_REGISTRY')) return [{ tableName: 'CUSTOM_MEMORY_VECTOR_TABLE' }];
        return [];
      }),
      none: vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
        noneCalls.push({ sql, binds });
      }),
    } as unknown as OracleTxClient;
    const db = {
      tx: vi.fn(async (callback: (client: OracleTxClient) => Promise<void>) => callback(client)),
    };
    (memory as any).db = db;

    await memory.deleteThread({ threadId: 'thread-1' });

    expect(manyOrNoneSql).toEqual([expect.stringContaining('"CUSTOM_VECTOR_REGISTRY"')]);
    expect(manyOrNoneSql[0]).not.toContain('MASTRA_VECTOR_INDEXES');
    expect(noneCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining('"CUSTOM_MEMORY_VECTOR_TABLE"'),
          binds: { threadId: 'thread-1' },
        }),
      ]),
    );
  });
});
