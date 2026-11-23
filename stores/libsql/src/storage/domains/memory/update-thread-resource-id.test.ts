import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { MastraDBMessage } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

let nextMessageId = 1;

function createMessage(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: overrides.id ?? `message-${nextMessageId++}`,
    threadId: overrides.threadId ?? 'thread-1',
    resourceId: overrides.resourceId ?? 'resource-1',
    role: overrides.role ?? 'user',
    type: overrides.type ?? 'v2',
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    content: overrides.content ?? { format: 2, parts: [{ type: 'text', text: 'hello' }] },
  } as MastraDBMessage;
}

describe('MemoryLibSQL.updateThreadResourceId', () => {
  let client: Client;
  let store: MemoryLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: {},
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await store.saveMessages({
      messages: [createMessage({ id: 'm1' }), createMessage({ id: 'm2' }), createMessage({ id: 'm3' })],
    });
  });

  afterEach(async () => {
    await client.execute(`DELETE FROM mastra_messages`);
    await client.execute(`DELETE FROM mastra_threads`);
    client.close();
  });

  async function messageOwners(): Promise<string[]> {
    const { messages } = await store.listMessages({ threadId: 'thread-1', perPage: false });
    return messages.map(m => m.resourceId as string);
  }

  it('atomically moves the thread and all of its messages, preserving createdAt', async () => {
    const result = await store.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-2' });

    expect(result.resourceId).toBe('resource-2');
    expect(result.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));

    const thread = await store.getThreadById({ threadId: 'thread-1' });
    expect(thread?.resourceId).toBe('resource-2');
    expect(await messageOwners()).toEqual(['resource-2', 'resource-2', 'resource-2']);
  });

  it('is a no-op when the thread already belongs to the target resource', async () => {
    const result = await store.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(result.resourceId).toBe('resource-1');
    expect(await messageOwners()).toEqual(['resource-1', 'resource-1', 'resource-1']);
  });

  it('throws when the thread does not exist', async () => {
    await expect(store.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-2' })).rejects.toThrow(
      /not found/,
    );
  });

  it('never leaves split ownership under concurrent transfers to different resources', async () => {
    // Two overlapping transfers race to move the same thread to different resources.
    // Because each runs in a serialized write transaction, the loser is fully applied
    // before or after the winner — the end state must be internally consistent
    // (thread and every message share ONE resource), never a split.
    const results = await Promise.allSettled([
      store.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-A' }),
      store.updateThreadResourceId({ threadId: 'thread-1', resourceId: 'resource-B' }),
    ]);

    // At least one transfer must succeed.
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);

    const thread = await store.getThreadById({ threadId: 'thread-1' });
    const owners = await messageOwners();

    // Whatever the winning resource is, the thread and all messages agree on it.
    const finalResource = thread?.resourceId;
    expect(['resource-A', 'resource-B']).toContain(finalResource);
    expect(new Set(owners)).toEqual(new Set([finalResource]));
  });
});
