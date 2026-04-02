import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { MastraStateAdapter } from '../state-adapter';

describe('MastraStateAdapter', () => {
  let adapter: MastraStateAdapter;
  let memoryStore: InMemoryMemory;
  let db: InMemoryDB;

  beforeEach(async () => {
    db = new InMemoryDB();
    memoryStore = new InMemoryMemory({ db });
    adapter = new MastraStateAdapter(memoryStore);
    await adapter.connect();
  });

  describe('connection', () => {
    it('connects and disconnects', async () => {
      // Already connected in beforeEach
      await adapter.disconnect();
      // After disconnect, reconnect should work
      await adapter.connect();
    });
  });

  describe('subscriptions (persisted via thread metadata)', () => {
    const externalThreadId = 'discord:guild1:channel1:thread1';

    beforeEach(async () => {
      // Create a Mastra thread mapped to the external thread
      await memoryStore.saveThread({
        thread: {
          id: 'mastra-thread-1',
          title: 'Test thread',
          resourceId: 'discord:user1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            channel_platform: 'discord',
            channel_externalThreadId: externalThreadId,
            channel_externalChannelId: 'discord:guild1:channel1',
          },
        },
      });
    });

    it('subscribes to a thread and persists in metadata', async () => {
      expect(await adapter.isSubscribed(externalThreadId)).toBe(false);
      await adapter.subscribe(externalThreadId);
      expect(await adapter.isSubscribed(externalThreadId)).toBe(true);

      // Verify it's actually persisted in thread metadata
      const thread = await memoryStore.getThreadById({ threadId: 'mastra-thread-1' });
      expect((thread?.metadata as Record<string, unknown>)?.channel_subscribed).toBe('true');
    });

    it('unsubscribes from a thread', async () => {
      await adapter.subscribe(externalThreadId);
      expect(await adapter.isSubscribed(externalThreadId)).toBe(true);

      await adapter.unsubscribe(externalThreadId);
      expect(await adapter.isSubscribed(externalThreadId)).toBe(false);
    });

    it('returns false for unknown thread IDs', async () => {
      expect(await adapter.isSubscribed('unknown:thread')).toBe(false);
    });

    it('survives adapter recreation (simulating restart)', async () => {
      await adapter.subscribe(externalThreadId);
      expect(await adapter.isSubscribed(externalThreadId)).toBe(true);

      // Create a new adapter instance (simulating server restart)
      const newAdapter = new MastraStateAdapter(memoryStore);
      await newAdapter.connect();

      // Subscription should still be there since it's in storage
      expect(await newAdapter.isSubscribed(externalThreadId)).toBe(true);
    });
  });

  describe('cache (in-memory)', () => {
    it('stores and retrieves values', async () => {
      await adapter.set('key1', { hello: 'world' });
      expect(await adapter.get('key1')).toEqual({ hello: 'world' });
    });

    it('returns null for missing keys', async () => {
      expect(await adapter.get('missing')).toBeNull();
    });

    it('respects TTL', async () => {
      await adapter.set('ttl-key', 'value', 1); // 1ms TTL
      await new Promise(r => setTimeout(r, 5));
      expect(await adapter.get('ttl-key')).toBeNull();
    });

    it('setIfNotExists only sets if key is absent', async () => {
      expect(await adapter.setIfNotExists('new-key', 'first')).toBe(true);
      expect(await adapter.setIfNotExists('new-key', 'second')).toBe(false);
      expect(await adapter.get('new-key')).toBe('first');
    });

    it('setIfNotExists replaces expired keys', async () => {
      await adapter.set('exp-key', 'old', 1);
      await new Promise(r => setTimeout(r, 5));
      expect(await adapter.setIfNotExists('exp-key', 'new')).toBe(true);
      expect(await adapter.get('exp-key')).toBe('new');
    });

    it('deletes keys', async () => {
      await adapter.set('del-key', 'value');
      await adapter.delete('del-key');
      expect(await adapter.get('del-key')).toBeNull();
    });
  });

  describe('lists (in-memory)', () => {
    it('appends and retrieves list values', async () => {
      await adapter.appendToList('list1', 'a');
      await adapter.appendToList('list1', 'b');
      await adapter.appendToList('list1', 'c');
      expect(await adapter.getList('list1')).toEqual(['a', 'b', 'c']);
    });

    it('trims to maxLength keeping newest', async () => {
      await adapter.appendToList('list2', 'a', { maxLength: 2 });
      await adapter.appendToList('list2', 'b', { maxLength: 2 });
      await adapter.appendToList('list2', 'c', { maxLength: 2 });
      expect(await adapter.getList('list2')).toEqual(['b', 'c']);
    });

    it('returns empty array for missing list', async () => {
      expect(await adapter.getList('missing')).toEqual([]);
    });

    it('respects TTL on lists', async () => {
      await adapter.appendToList('ttl-list', 'a', { ttlMs: 1 });
      await new Promise(r => setTimeout(r, 5));
      expect(await adapter.getList('ttl-list')).toEqual([]);
    });
  });

  describe('locks (in-memory)', () => {
    it('acquires and releases locks', async () => {
      const lock = await adapter.acquireLock('thread-1', 10000);
      expect(lock).not.toBeNull();
      expect(lock!.threadId).toBe('thread-1');

      await adapter.releaseLock(lock!);

      // Can acquire again after release
      const lock2 = await adapter.acquireLock('thread-1', 10000);
      expect(lock2).not.toBeNull();
    });

    it('prevents double-locking', async () => {
      await adapter.acquireLock('thread-1', 10000);
      const lock2 = await adapter.acquireLock('thread-1', 10000);
      expect(lock2).toBeNull();
    });

    it('allows locking after expiry', async () => {
      await adapter.acquireLock('thread-1', 1); // 1ms TTL
      await new Promise(r => setTimeout(r, 5));
      const lock2 = await adapter.acquireLock('thread-1', 10000);
      expect(lock2).not.toBeNull();
    });

    it('extends lock TTL', async () => {
      const lock = await adapter.acquireLock('thread-1', 10000);
      const extended = await adapter.extendLock(lock!, 20000);
      expect(extended).toBe(true);
    });

    it('fails to extend with wrong token', async () => {
      await adapter.acquireLock('thread-1', 10000);
      const fakeLock = { threadId: 'thread-1', token: 'wrong-token', expiresAt: 0 };
      const extended = await adapter.extendLock(fakeLock, 20000);
      expect(extended).toBe(false);
    });

    it('force-releases locks regardless of token', async () => {
      await adapter.acquireLock('thread-1', 10000);
      await adapter.forceReleaseLock('thread-1');
      const lock2 = await adapter.acquireLock('thread-1', 10000);
      expect(lock2).not.toBeNull();
    });

    it('releaseLock is a no-op if token does not match', async () => {
      const lock = await adapter.acquireLock('thread-1', 10000);
      const fakeLock = { threadId: 'thread-1', token: 'wrong', expiresAt: 0 };
      await adapter.releaseLock(fakeLock);
      // Original lock should still be active
      const lock2 = await adapter.acquireLock('thread-1', 10000);
      expect(lock2).toBeNull();
      // Clean up
      await adapter.releaseLock(lock!);
    });
  });

  describe('queue operations', () => {
    const makeEntry = (text: string) =>
      ({
        enqueuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        message: { id: text, text, author: { userId: 'u1' } },
      }) as any;

    it('enqueue returns the queue length', async () => {
      const len1 = await adapter.enqueue('thread-1', makeEntry('a'), 10);
      expect(len1).toBe(1);
      const len2 = await adapter.enqueue('thread-1', makeEntry('b'), 10);
      expect(len2).toBe(2);
    });

    it('dequeue returns entries in FIFO order', async () => {
      await adapter.enqueue('thread-1', makeEntry('first'), 10);
      await adapter.enqueue('thread-1', makeEntry('second'), 10);

      const entry1 = await adapter.dequeue('thread-1');
      expect(entry1?.message.text).toBe('first');
      const entry2 = await adapter.dequeue('thread-1');
      expect(entry2?.message.text).toBe('second');
    });

    it('dequeue returns null for empty queue', async () => {
      const entry = await adapter.dequeue('thread-1');
      expect(entry).toBeNull();
    });

    it('queueDepth returns the number of queued entries', async () => {
      expect(await adapter.queueDepth('thread-1')).toBe(0);
      await adapter.enqueue('thread-1', makeEntry('a'), 10);
      expect(await adapter.queueDepth('thread-1')).toBe(1);
      await adapter.dequeue('thread-1');
      expect(await adapter.queueDepth('thread-1')).toBe(0);
    });

    it('enqueue trims oldest entries when exceeding maxSize', async () => {
      await adapter.enqueue('thread-1', makeEntry('a'), 2);
      await adapter.enqueue('thread-1', makeEntry('b'), 2);
      await adapter.enqueue('thread-1', makeEntry('c'), 2);

      expect(await adapter.queueDepth('thread-1')).toBe(2);
      const entry = await adapter.dequeue('thread-1');
      expect(entry?.message.text).toBe('b');
    });

    it('queues are isolated per thread', async () => {
      await adapter.enqueue('thread-1', makeEntry('a'), 10);
      await adapter.enqueue('thread-2', makeEntry('b'), 10);

      expect(await adapter.queueDepth('thread-1')).toBe(1);
      expect(await adapter.queueDepth('thread-2')).toBe(1);

      const entry1 = await adapter.dequeue('thread-1');
      expect(entry1?.message.text).toBe('a');
      const entry2 = await adapter.dequeue('thread-2');
      expect(entry2?.message.text).toBe('b');
    });
  });
});
