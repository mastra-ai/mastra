import type { MastraDBMessage } from '@mastra/core/agent';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoDBStore } from '../../index';

const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB = 'mastra-memory-include-ties-test';

/**
 * `include` pins specific messages, which is how semantic recall turns vector hits back into
 * messages. Messages written in the same millisecond order only by id, so resolving a pinned
 * message by timestamp alone returns whichever id sorts highest instead of the one asked for.
 */
describe('MemoryStorageMongoDB — include with tied createdAt', () => {
  const threadId = 'thread-ties';
  const resourceId = 'resource-ties';
  // One timestamp shared by every message, which is what a batched save produces.
  const sharedTimestamp = new Date('2026-01-01T00:00:00.000Z');
  let store: MongoDBStore;
  let memoryStore: any;

  const message = (id: string, text: string): MastraDBMessage =>
    ({
      id,
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text }], content: text },
      createdAt: sharedTimestamp,
      threadId,
      resourceId,
    }) as MastraDBMessage;

  // Ids chosen so alphabetical order differs from insertion order: 'c' sorts highest.
  const messages = [message('msg-a', 'first'), message('msg-c', 'second'), message('msg-b', 'third')];

  const dropTestDb = async () => {
    const client = new MongoClient(URI);
    try {
      await client.connect();
      await client.db(DB).dropDatabase();
    } finally {
      await client.close();
    }
  };

  beforeAll(async () => {
    await dropTestDb();
    store = new MongoDBStore({ id: 'include-ties', uri: URI, dbName: DB });
    await store.init();
    memoryStore = await store.getStore('memory');
    await memoryStore.saveThread({
      thread: { id: threadId, resourceId, title: 'ties', createdAt: sharedTimestamp, updatedAt: sharedTimestamp },
    });
    await memoryStore.saveMessages({ messages });
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
  });

  it.each(['msg-a', 'msg-b', 'msg-c'])('returns %s when it is the pinned message', async id => {
    const result = await memoryStore.listMessages({
      threadId,
      resourceId,
      perPage: 0,
      includeTotal: false,
      include: [{ id, threadId, withPreviousMessages: 0, withNextMessages: 0 }],
    });

    expect(result.messages.map((m: MastraDBMessage) => m.id)).toEqual([id]);
  });

  it('anchors a context window on the pinned message', async () => {
    const result = await memoryStore.listMessages({
      threadId,
      resourceId,
      perPage: 0,
      includeTotal: false,
      include: [{ id: 'msg-a', threadId, withPreviousMessages: 0, withNextMessages: 1 }],
    });

    // msg-a is first in the thread's (createdAt, id) order, so the next message is msg-b.
    expect(result.messages.map((m: MastraDBMessage) => m.id)).toEqual(['msg-a', 'msg-b']);
  });
});
