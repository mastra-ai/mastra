import type { MastraDBMessage } from '@mastra/core/memory';
import { describe, expect, it, vi } from 'vitest';

import type { OracleTxClient } from '../../db';
import { updateMessages } from './messages';
import type { MemoryContext } from './utils';

// CR-14: updating a message's content/threadId/resourceId leaves its
// semantic-recall vectors (embeddings/metadata) pointing at stale state.
// updateMessages must delete the affected messages' vectors (via the shared
// deleteSemanticRecallVectorsByMessageIds helper) in the SAME transaction as
// the field update -- and must NOT do so for updates that don't touch any of
// those three fields.

function createMessage(overrides: Partial<MastraDBMessage> & { id: string; threadId: string }): MastraDBMessage {
  return {
    resourceId: 'resource-1',
    role: 'user',
    type: 'v2',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'original' }] },
    ...overrides,
  } as MastraDBMessage;
}

type NoneCall = { sql: string; binds?: Record<string, unknown> };

function createFakeTxClient(vectorTables: Array<{ tableName: string }>) {
  const noneCalls: NoneCall[] = [];
  const manyOrNone = vi.fn(async (sql: string) => {
    if (sql.includes('MASTRA_VECTOR_INDEXES')) return vectorTables;
    return [];
  });
  const none = vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
    noneCalls.push({ sql, binds });
  });
  const executeMany = vi.fn();
  const client = { none, manyOrNone, executeMany } as unknown as OracleTxClient;
  return { client, noneCalls, manyOrNone, none, executeMany };
}

function createCtx(existingMessages: MastraDBMessage[], client: OracleTxClient): MemoryContext {
  const db = { tx: vi.fn(async (callback: (client: OracleTxClient) => Promise<unknown>) => callback(client)) };
  return {
    db,
    schemaName: undefined,
    messageBatchSize: 200,
    vectorRegistryTableName: 'MASTRA_VECTOR_INDEXES',
    indexes: [],
    listMessagesById: vi.fn(async () => ({ messages: existingMessages })),
  } as unknown as MemoryContext;
}

describe('updateMessages semantic-recall invalidation (CR-14)', () => {
  it('deletes semantic-recall vectors only for messages whose content/threadId/resourceId changed', async () => {
    const existingMessages: MastraDBMessage[] = [
      createMessage({ id: 'msg-content', threadId: 'thread-1' }),
      createMessage({ id: 'msg-role-only', threadId: 'thread-1' }),
      createMessage({ id: 'msg-resource', threadId: 'thread-1' }),
    ];
    const { client, noneCalls, manyOrNone } = createFakeTxClient([{ tableName: 'MASTRA_MEMORY_MESSAGES_VEC' }]);
    const ctx = createCtx(existingMessages, client);

    await updateMessages(ctx, {
      messages: [
        { id: 'msg-content', content: { content: 'updated content' } },
        { id: 'msg-role-only', role: 'assistant' },
        { id: 'msg-resource', resourceId: 'resource-2' },
      ],
    });

    expect(manyOrNone).toHaveBeenCalled();
    const vectorDeleteCall = noneCalls.find(call => call.sql.includes("JSON_VALUE(metadata, '$.message_id'"));
    expect(vectorDeleteCall).toBeDefined();
    expect(vectorDeleteCall?.sql).toContain('MASTRA_MEMORY_MESSAGES_VEC');
    expect(vectorDeleteCall?.binds).toEqual({
      semanticMessageId0: 'msg-content',
      semanticMessageId1: 'msg-resource',
    });
  });

  it('does not look up or touch semantic-recall vectors when only non-invalidating fields change', async () => {
    const existingMessages: MastraDBMessage[] = [createMessage({ id: 'msg-role-only', threadId: 'thread-1' })];
    const { client, noneCalls, manyOrNone } = createFakeTxClient([{ tableName: 'MASTRA_MEMORY_MESSAGES_VEC' }]);
    const ctx = createCtx(existingMessages, client);

    await updateMessages(ctx, { messages: [{ id: 'msg-role-only', role: 'assistant' }] });

    expect(manyOrNone).not.toHaveBeenCalled();
    expect(noneCalls.some(call => call.sql.includes("JSON_VALUE(metadata, '$.message_id'"))).toBe(false);
  });

  it('is a safe no-op when no vector store is configured (ORA-00942 handled)', async () => {
    const existingMessages: MastraDBMessage[] = [createMessage({ id: 'msg-content', threadId: 'thread-1' })];
    const noneCalls: NoneCall[] = [];
    const manyOrNone = vi.fn(async () => {
      const error = new Error('ORA-00942: table or view does not exist') as Error & { errorNum: number };
      error.errorNum = 942;
      throw error;
    });
    const none = vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
      noneCalls.push({ sql, binds });
    });
    const executeMany = vi.fn();
    const client = { none, manyOrNone, executeMany } as unknown as OracleTxClient;
    const ctx = createCtx(existingMessages, client);

    await expect(updateMessages(ctx, { messages: [{ id: 'msg-content', content: { content: 'updated' } }] })).resolves.toBeDefined();

    expect(manyOrNone).toHaveBeenCalled();
    // No vector tables were resolved (registry lookup failed with ORA-00942),
    // so no DELETE was attempted -- the update itself still succeeds.
    expect(noneCalls.some(call => call.sql.includes("JSON_VALUE(metadata, '$.message_id'"))).toBe(false);
  });
});
