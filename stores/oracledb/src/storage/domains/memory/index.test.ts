import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { Connection } from 'oracledb';
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

// Backs cloneThread's `ctx.db.tx` transaction with a REAL OracleDB (not a
// mocked `db.tx`), so a rejection from `connection.executeMany` exercises the
// actual commit/rollback wiring in OracleDB.tx instead of a hand-rolled stand-in.
function createFakeConnection(options: { failMessageInsert?: boolean; failThreadInsertUnique?: boolean } = {}) {
  const executeCalls: string[] = [];
  const executeManyCalls: string[] = [];
  const execute = vi.fn(async (sql: string) => {
    executeCalls.push(sql);
    if (options.failThreadInsertUnique && sql.includes('INSERT INTO "MASTRA_THREADS"')) {
      // Mirrors node-oracledb's error shape for ORA-00001.
      throw Object.assign(new Error('ORA-00001: unique constraint (MASTRA.SYS_C001) violated'), { errorNum: 1 });
    }
    return { rowsAffected: 1, rows: [] };
  });
  const executeMany = vi.fn(async (sql: string) => {
    executeManyCalls.push(sql);
    if (options.failMessageInsert && sql.includes('MASTRA_MESSAGES')) {
      throw new Error('simulated message insert failure');
    }
    return { rowsAffected: 1 };
  });
  const commit = vi.fn(async () => {});
  const rollback = vi.fn(async () => {});
  const connection = { execute, executeMany, commit, rollback } as unknown as Connection;
  return { connection, executeCalls, executeManyCalls, commit, rollback };
}

function createMemoryOracleWithConnection(connection: Connection): MemoryOracle {
  const poolManager = {
    withConnection: (callback: (connection: Connection) => Promise<unknown>) => callback(connection),
  };
  return new MemoryOracle({ poolManager: poolManager as any });
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

describe('MemoryOracle cloneThread atomicity (CR-12)', () => {
  const sourceThread = createThread('thread-source');
  const sourceMessage = createMessage('msg-1', sourceThread.id);

  function mockCloneLookups(memory: MemoryOracle): void {
    // Destination thread never exists yet; only the source thread id resolves.
    (memory as any).getThreadById = vi.fn(async ({ threadId }: { threadId: string }) =>
      threadId === sourceThread.id ? sourceThread : null,
    );
    (memory as any).listMessagesById = vi.fn(async () => ({ messages: [sourceMessage] }));
  }

  it('rolls back the destination thread insert when the message insert fails, leaving no orphaned clone', async () => {
    const { connection, commit, rollback } = createFakeConnection({ failMessageInsert: true });
    const memory = createMemoryOracleWithConnection(connection);
    mockCloneLookups(memory);

    await expect(
      memory.cloneThread({
        sourceThreadId: sourceThread.id,
        newThreadId: 'thread-dest',
        options: { messageFilter: { messageIds: [sourceMessage.id] } },
      }),
    ).rejects.toThrow(/simulated message insert failure|CLONE_THREAD/i);

    // The thread INSERT and the cloned-messages insert ran on the SAME
    // connection inside one transaction: since the message insert failed,
    // the whole transaction must roll back instead of leaving the thread
    // INSERT committed as an orphaned, message-less clone.
    expect(commit).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('inserts the destination thread and cloned messages in a single transaction on success', async () => {
    const { connection, executeCalls, executeManyCalls, commit, rollback } = createFakeConnection();
    const memory = createMemoryOracleWithConnection(connection);
    mockCloneLookups(memory);

    const result = await memory.cloneThread({
      sourceThreadId: sourceThread.id,
      newThreadId: 'thread-dest',
      options: { messageFilter: { messageIds: [sourceMessage.id] } },
    });

    expect(result.thread.id).toBe('thread-dest');
    expect(result.clonedMessages).toHaveLength(1);
    expect(executeCalls.some(sql => sql.includes('INSERT INTO "MASTRA_THREADS"'))).toBe(true);
    // Insert-only: the destination row must never be created via MERGE, or a
    // concurrent clone could silently update an existing thread.
    expect(executeCalls.some(sql => sql.includes('MERGE INTO "MASTRA_THREADS"'))).toBe(false);
    expect(executeManyCalls.some(sql => sql.includes('"MASTRA_MESSAGES"'))).toBe(true);
    // One transaction, one commit -- both writes shared the same connection.
    expect(commit).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
  });

  it('translates a unique-key violation on the destination insert into DESTINATION_EXISTS', async () => {
    // Simulates losing a clone race: the pre-transaction existence check saw
    // no destination thread, but another clone committed it first, so the
    // insert-only write hits ORA-00001 instead of updating the winner's row.
    const { connection, executeManyCalls, commit, rollback } = createFakeConnection({ failThreadInsertUnique: true });
    const memory = createMemoryOracleWithConnection(connection);
    mockCloneLookups(memory);

    await expect(
      memory.cloneThread({
        sourceThreadId: sourceThread.id,
        newThreadId: 'thread-dest',
        options: { messageFilter: { messageIds: [sourceMessage.id] } },
      }),
    ).rejects.toMatchObject({
      id: expect.stringContaining('DESTINATION_EXISTS'),
      category: 'USER',
    });

    // The transaction rolled back before any message write reached the
    // existing destination thread.
    expect(executeManyCalls).toHaveLength(0);
    expect(commit).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('skips the message insert entirely (and still commits) when the source thread has no messages', async () => {
    const { connection, executeCalls, executeManyCalls, commit } = createFakeConnection();
    const memory = createMemoryOracleWithConnection(connection);
    (memory as any).getThreadById = vi.fn(async ({ threadId }: { threadId: string }) =>
      threadId === sourceThread.id ? sourceThread : null,
    );
    // messageIds is non-empty so messagesForClone takes the listMessagesById
    // path; the mock returning no rows simulates "already deleted"/no match.
    (memory as any).listMessagesById = vi.fn(async () => ({ messages: [] }));

    const result = await memory.cloneThread({
      sourceThreadId: sourceThread.id,
      newThreadId: 'thread-dest',
      options: { messageFilter: { messageIds: ['msg-does-not-exist'] } },
    });

    expect(result.clonedMessages).toHaveLength(0);
    expect(executeCalls.some(sql => sql.includes('INSERT INTO "MASTRA_THREADS"'))).toBe(true);
    expect(executeManyCalls).toHaveLength(0);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
