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

  it('reverts the thread to its original owner when the message update fails', async () => {
    const failure = new Error('updateMessages failed');
    store.updateMessages = async () => {
      throw failure;
    };

    await expect(store.updateThreadResourceId({ threadId: 'thread-a', resourceId: 'resource-b' })).rejects.toThrow(
      failure,
    );

    const reread = await store.getThreadById({ threadId: 'thread-a' });
    expect(reread!.resourceId).toBe('resource-a');
  });

  it('restores already-moved messages when the message update fails mid-batch', async () => {
    const original = store.updateMessages.bind(store);
    let call = 0;
    store.updateMessages = async (args: Parameters<typeof original>[0]) => {
      call += 1;
      if (call === 1) {
        // Simulate a non-atomic adapter: move the first message, then fail before the rest.
        await original({ messages: [args.messages[0]!] });
        throw new Error('updateMessages failed mid-batch');
      }
      return original(args);
    };

    await expect(store.updateThreadResourceId({ threadId: 'thread-a', resourceId: 'resource-b' })).rejects.toThrow(
      /mid-batch/,
    );

    const reread = await store.getThreadById({ threadId: 'thread-a' });
    expect(reread!.resourceId).toBe('resource-a');

    const { messages } = await store.listMessages({ threadId: 'thread-a', perPage: false });
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.resourceId).toBe('resource-a');
    }
  });

  it('reports incomplete compensation when a moved message had no original owner to restore', async () => {
    // A message whose original resourceId is unscoped (undefined) cannot be written back to an
    // unscoped value via updateMessages, so if it moves and the batch then fails the rollback must
    // surface an explicit incomplete-compensation error rather than silently dropping it.
    await store.saveMessages({
      messages: [
        makeMessage({ id: 'm0', threadId: 'thread-a', resourceId: undefined as unknown as string, minute: 5 }),
      ],
    });

    const original = store.updateMessages.bind(store);
    let call = 0;
    store.updateMessages = async (args: Parameters<typeof original>[0]) => {
      call += 1;
      if (call === 1) {
        const unscoped = args.messages.find(m => m.id === 'm0') ?? args.messages[0]!;
        await original({ messages: [unscoped] });
        throw new Error('updateMessages failed mid-batch');
      }
      return original(args);
    };

    await expect(store.updateThreadResourceId({ threadId: 'thread-a', resourceId: 'resource-b' })).rejects.toThrow(
      /could not be fully rolled back/,
    );

    // Thread ownership (the access gate) is still reverted.
    const reread = await store.getThreadById({ threadId: 'thread-a' });
    expect(reread!.resourceId).toBe('resource-a');
  });
});
