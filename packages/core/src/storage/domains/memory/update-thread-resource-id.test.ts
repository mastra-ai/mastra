import { describe, expect, it, beforeEach } from 'vitest';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

const makeMessage = ({
  id,
  threadId,
  resourceId,
  minute,
}: {
  id: string;
  threadId: string;
  resourceId: string;
  minute: number;
}): MastraDBMessage =>
  ({
    id,
    threadId,
    resourceId,
    role: 'user',
    type: 'text',
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, minute)),
    content: { format: 2, parts: [{ type: 'text', text: id }] },
  }) as MastraDBMessage;

const makeThread = (id: string, resourceId: string): StorageThreadType => ({
  id,
  resourceId,
  title: 'thread',
  createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0)),
  updatedAt: new Date(Date.UTC(2024, 0, 1, 0, 0)),
  metadata: {},
});

describe('MemoryStorage.updateThreadResourceId', () => {
  let store: InMemoryMemory;

  beforeEach(async () => {
    store = new InMemoryMemory({ db: new InMemoryDB() });
    await store.saveThread({ thread: makeThread('thread-a', 'resource-a') });
    await store.saveMessages({
      messages: [
        makeMessage({ id: 'm1', threadId: 'thread-a', resourceId: 'resource-a', minute: 0 }),
        makeMessage({ id: 'm2', threadId: 'thread-a', resourceId: 'resource-a', minute: 1 }),
        makeMessage({ id: 'm3', threadId: 'thread-a', resourceId: 'resource-a', minute: 2 }),
      ],
    });
  });

  it('moves the thread and all its messages to the new resource and preserves createdAt', async () => {
    const before = await store.getThreadById({ threadId: 'thread-a' });
    const originalCreatedAt = before!.createdAt;

    const updated = await store.updateThreadResourceId({ threadId: 'thread-a', resourceId: 'resource-b' });

    expect(updated.resourceId).toBe('resource-b');
    expect(new Date(updated.createdAt).getTime()).toBe(new Date(originalCreatedAt).getTime());

    const reread = await store.getThreadById({ threadId: 'thread-a' });
    expect(reread!.resourceId).toBe('resource-b');

    const { messages } = await store.listMessages({ threadId: 'thread-a', perPage: false });
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.resourceId).toBe('resource-b');
    }
  });

  it('is a no-op when the thread already belongs to the target resource', async () => {
    const updated = await store.updateThreadResourceId({ threadId: 'thread-a', resourceId: 'resource-a' });
    expect(updated.resourceId).toBe('resource-a');

    const { messages } = await store.listMessages({ threadId: 'thread-a', perPage: false });
    for (const message of messages) {
      expect(message.resourceId).toBe('resource-a');
    }
  });

  it('throws when the thread does not exist', async () => {
    await expect(store.updateThreadResourceId({ threadId: 'missing', resourceId: 'resource-b' })).rejects.toThrow(
      /not found/,
    );
  });
});
