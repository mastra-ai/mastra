import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { MastraDBMessage } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

function createMessage(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    threadId: overrides.threadId ?? 'source-thread',
    resourceId: overrides.resourceId ?? 'resource-1',
    role: overrides.role ?? 'user',
    type: overrides.type ?? 'v2',
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    content: overrides.content ?? { format: 2, parts: [{ type: 'text', text: 'hello' }] },
  } as MastraDBMessage;
}

describe('MemoryLibSQL.copyThread / cloneThread', () => {
  let client: Client;
  let store: MemoryLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.saveThread({
      thread: {
        id: 'source-thread',
        resourceId: 'resource-1',
        title: 'Source',
        metadata: {},
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await store.saveMessages({
      messages: [
        createMessage({
          id: 'msg-1',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'first' }] },
        }),
        createMessage({
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date('2025-01-01T00:00:01.000Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'second' }] },
        }),
      ],
    });
  });

  afterEach(() => {
    client.close();
  });

  it('copyThread copies rows in-DB without returning payloads', async () => {
    const result = await store.copyThread({
      sourceThreadId: 'source-thread',
      resourceId: 'resource-1',
    });

    // No payloads returned to the JS heap.
    expect(result).not.toHaveProperty('clonedMessages');

    // messageIdMap maps every source message id to a new id.
    expect(Object.keys(result.messageIdMap ?? {}).sort()).toEqual(['msg-1', 'msg-2']);
    for (const [sourceId, newId] of Object.entries(result.messageIdMap ?? {})) {
      expect(newId).not.toBe(sourceId);
    }

    // Destination thread carries the same message content, copied inside the DB.
    const dest = await store.listMessages({
      threadId: result.thread.id,
      resourceId: 'resource-1',
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(dest.messages).toHaveLength(2);
    expect(dest.messages.map(m => m.content)).toEqual([
      { format: 2, parts: [{ type: 'text', text: 'first' }] },
      { format: 2, parts: [{ type: 'text', text: 'second' }] },
    ]);
    expect(dest.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(dest.messages.every(m => m.threadId === result.thread.id)).toBe(true);
    expect(dest.messages.every(m => m.resourceId === 'resource-1')).toBe(true);
  });

  it('cloneThread returns the copied messages read back from the destination thread', async () => {
    const result = await store.cloneThread({
      sourceThreadId: 'source-thread',
      resourceId: 'resource-1',
    });

    expect(result.clonedMessages).toHaveLength(2);
    expect(result.clonedMessages.map(m => m.content)).toEqual([
      { format: 2, parts: [{ type: 'text', text: 'first' }] },
      { format: 2, parts: [{ type: 'text', text: 'second' }] },
    ]);
    expect(Object.keys(result.messageIdMap ?? {}).sort()).toEqual(['msg-1', 'msg-2']);
    expect(result.clonedMessages.map(m => m.id).sort()).toEqual(Object.values(result.messageIdMap ?? {}).sort());
    expect(result.clonedMessages.every(m => m.threadId === result.thread.id)).toBe(true);
  });
});
