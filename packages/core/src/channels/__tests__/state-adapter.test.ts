import { describe, it, expect, beforeEach, vi } from 'vitest';

import { supportsThreadMappings } from '../../storage/domains/channels/base';
import { InMemoryChannelsStorage } from '../../storage/domains/channels/inmemory';
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

  describe('per-agent subscription scoping', () => {
    // Telegram private chats use the user's own id as the chat id, so two
    // bots DMing the same user share the exact same external thread id.
    const externalThreadId = 'telegram:12345678';

    function legacyMetadata() {
      return {
        channel_platform: 'telegram',
        channel_externalThreadId: externalThreadId,
        channel_externalChannelId: 'telegram:12345678',
      };
    }

    async function seedThread(id: string, metadata: Record<string, unknown>) {
      await memoryStore.saveThread({
        thread: {
          id,
          title: 'Test thread',
          resourceId: `telegram:user-${id}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata,
        },
      });
    }

    it('does not leak a subscription from one bot to another sharing the same storage (#17037)', async () => {
      await seedThread('shared-legacy', legacyMetadata());

      const botAAdapter = new MastraStateAdapter(memoryStore, () => 'bot-a');
      const botBAdapter = new MastraStateAdapter(memoryStore, () => 'bot-b');
      await botAAdapter.connect();
      await botBAdapter.connect();

      await botAAdapter.subscribe(externalThreadId);

      expect(await botAAdapter.isSubscribed(externalThreadId)).toBe(true);
      expect(await botBAdapter.isSubscribed(externalThreadId)).toBe(false);
    });

    it('subscribe claims an unclaimed legacy thread by stamping the owner id', async () => {
      await seedThread('unclaimed-legacy', legacyMetadata());

      const botAAdapter = new MastraStateAdapter(memoryStore, () => 'bot-a');
      await botAAdapter.connect();
      await botAAdapter.subscribe(externalThreadId);

      const thread = await memoryStore.getThreadById({ threadId: 'unclaimed-legacy' });
      expect(thread?.metadata).toMatchObject({
        ...legacyMetadata(),
        channel_subscribed: 'true',
        channel_ownerId: 'bot-a',
      });
    });

    it('resolves only the thread scoped to its own agent id', async () => {
      await seedThread('thread-a', { ...legacyMetadata(), channel_ownerId: 'bot-a', channel_subscribed: 'true' });
      await seedThread('thread-b', { ...legacyMetadata(), channel_ownerId: 'bot-b' });

      const botAAdapter = new MastraStateAdapter(memoryStore, () => 'bot-a');
      const botBAdapter = new MastraStateAdapter(memoryStore, () => 'bot-b');
      await botAAdapter.connect();
      await botBAdapter.connect();

      expect(await botAAdapter.isSubscribed(externalThreadId)).toBe(true);
      expect(await botBAdapter.isSubscribed(externalThreadId)).toBe(false);

      // Bot B subscribing touches only its own thread.
      await botBAdapter.subscribe(externalThreadId);
      const threadA = await memoryStore.getThreadById({ threadId: 'thread-a' });
      const threadB = await memoryStore.getThreadById({ threadId: 'thread-b' });
      expect((threadB?.metadata as Record<string, unknown>)?.channel_subscribed).toBe('true');
      expect(threadA?.metadata).toMatchObject({ channel_ownerId: 'bot-a', channel_subscribed: 'true' });
    });

    it('keeps unscoped behavior for adapters constructed without an owner getter', async () => {
      await seedThread('claimed-by-someone', {
        ...legacyMetadata(),
        channel_ownerId: 'bot-a',
        channel_subscribed: 'true',
      });

      const legacyAdapter = new MastraStateAdapter(memoryStore);
      await legacyAdapter.connect();

      // Old behavior: any thread with the external id matches, claimed or not.
      expect(await legacyAdapter.isSubscribed(externalThreadId)).toBe(true);
    });

    it('keeps unscoped behavior when the owner getter returns null', async () => {
      await seedThread('claimed-by-someone', {
        ...legacyMetadata(),
        channel_ownerId: 'bot-a',
        channel_subscribed: 'true',
      });

      const unboundAdapter = new MastraStateAdapter(memoryStore, () => null);
      await unboundAdapter.connect();

      expect(await unboundAdapter.isSubscribed(externalThreadId)).toBe(true);
    });
  });

  describe('thread mappings (capable store)', () => {
    const externalThreadId = 'slack:C1:1700000000.000100';
    const key = { platform: 'slack', ownerId: 'bot-a', externalThreadId };
    let channelsStore: InMemoryChannelsStorage;
    let botA: MastraStateAdapter;
    let listThreads: ReturnType<typeof vi.spyOn>;
    let upsert: ReturnType<typeof vi.spyOn>;

    function legacyMetadata() {
      return {
        channel_platform: 'slack',
        channel_externalThreadId: externalThreadId,
        channel_externalChannelId: 'C1',
      };
    }

    async function seedThread(id: string, metadata: Record<string, unknown>) {
      await memoryStore.saveThread({
        thread: {
          id,
          title: 'Test thread',
          resourceId: `slack:user-${id}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata,
        },
      });
    }

    beforeEach(async () => {
      channelsStore = new InMemoryChannelsStorage();
      expect(supportsThreadMappings(channelsStore)).toBe(true);
      botA = new MastraStateAdapter(memoryStore, () => 'bot-a', channelsStore);
      await botA.connect();
      listThreads = vi.spyOn(memoryStore, 'listThreads');
      upsert = vi.spyOn(channelsStore, 'upsertThreadMapping');
    });

    it('isSubscribed reads the mapping row and never scans thread metadata', async () => {
      await seedThread('t1', { ...legacyMetadata(), channel_ownerId: 'bot-a' });
      await channelsStore.upsertThreadMapping({ ...key, externalChannelId: 'C1', threadId: 't1', subscribed: true });

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(listThreads).not.toHaveBeenCalled();
    });

    it('subscribe flips the row to true and still writes channel_subscribed metadata', async () => {
      await seedThread('t1', { ...legacyMetadata(), channel_ownerId: 'bot-a' });
      await channelsStore.upsertThreadMapping({ ...key, externalChannelId: 'C1', threadId: 't1' });

      await botA.subscribe(externalThreadId);

      expect((await channelsStore.getThreadMapping(key))!.subscribed).toBe(true);
      const thread = await memoryStore.getThreadById({ threadId: 't1' });
      expect(thread?.metadata).toMatchObject({ channel_subscribed: 'true', channel_ownerId: 'bot-a' });
      expect(listThreads).not.toHaveBeenCalled();
    });

    it('unsubscribe flips the row to false', async () => {
      await seedThread('t1', { ...legacyMetadata(), channel_ownerId: 'bot-a' });
      await channelsStore.upsertThreadMapping({ ...key, externalChannelId: 'C1', threadId: 't1', subscribed: true });

      await botA.unsubscribe(externalThreadId);

      expect((await channelsStore.getThreadMapping(key))!.subscribed).toBe(false);
      expect(await botA.isSubscribed(externalThreadId)).toBe(false);
      const thread = await memoryStore.getThreadById({ threadId: 't1' });
      expect((thread?.metadata as Record<string, unknown>).channel_subscribed).toBe('false');
    });

    it('adopts a legacy thread already stamped with our owner id on the first scan, then never scans again', async () => {
      await seedThread('stamped', { ...legacyMetadata(), channel_ownerId: 'bot-a', channel_subscribed: 'true' });

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(listThreads).toHaveBeenCalledTimes(1);
      expect(await channelsStore.getThreadMapping(key)).toMatchObject({ threadId: 'stamped', subscribed: true });

      listThreads.mockClear();
      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(listThreads).not.toHaveBeenCalled();
    });

    it('does not adopt a stamped thread that lacks channel_externalChannelId metadata', async () => {
      await seedThread('no-channel', {
        channel_platform: 'slack',
        channel_externalThreadId: externalThreadId,
        channel_ownerId: 'bot-a',
        channel_subscribed: 'true',
      });

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(upsert).not.toHaveBeenCalled();
      expect(await channelsStore.getThreadMapping(key)).toBeNull();
    });

    it('never writes a mapping row for an unclaimed legacy thread from a read (reads never claim)', async () => {
      await seedThread('unclaimed', { ...legacyMetadata(), channel_subscribed: 'true' });

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(upsert).not.toHaveBeenCalled();
      expect(await channelsStore.getThreadMapping(key)).toBeNull();
    });

    it('subscribe on an unclaimed legacy thread stamps the owner but still creates no row', async () => {
      await seedThread('unclaimed', legacyMetadata());

      await botA.subscribe(externalThreadId);

      const thread = await memoryStore.getThreadById({ threadId: 'unclaimed' });
      expect(thread?.metadata).toMatchObject({ channel_subscribed: 'true', channel_ownerId: 'bot-a' });
      expect(upsert).not.toHaveBeenCalled();
      expect(await channelsStore.getThreadMapping(key)).toBeNull();
    });

    it('a read by bot A does not stop bot B from claiming the unclaimed thread (#17037)', async () => {
      await seedThread('unclaimed', { ...legacyMetadata(), channel_subscribed: 'true' });
      const botB = new MastraStateAdapter(memoryStore, () => 'bot-b', channelsStore);
      await botB.connect();

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      await botB.subscribe(externalThreadId);

      expect(await botB.isSubscribed(externalThreadId)).toBe(true);
      expect(await botA.isSubscribed(externalThreadId)).toBe(false);
      expect(await channelsStore.getThreadMapping(key)).toBeNull();
    });

    it('a never-engaged thread scans on every call (unchanged, by design)', async () => {
      expect(await botA.isSubscribed('slack:C9:never')).toBe(false);
      expect(await botA.isSubscribed('slack:C9:never')).toBe(false);
      expect(listThreads).toHaveBeenCalledTimes(4);
      expect(upsert).not.toHaveBeenCalled();
    });

    it('a mapping row whose thread was deleted still answers with the row flag (documented)', async () => {
      await channelsStore.upsertThreadMapping({ ...key, externalChannelId: 'C1', threadId: 'gone', subscribed: true });

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(listThreads).not.toHaveBeenCalled();
    });

    it('subscribe drops a stale mapping whose thread is gone and falls back to the scan', async () => {
      await channelsStore.upsertThreadMapping({ ...key, externalChannelId: 'C1', threadId: 'gone' });

      await botA.subscribe(externalThreadId);

      expect(await channelsStore.getThreadMapping(key)).toBeNull();
      expect(listThreads).toHaveBeenCalled();
    });

    it('falls back to the scan when the thread-id prefix differs from the mapping platform', async () => {
      const fooThreadId = 'foo:C1:1';
      await seedThread('bar-thread', {
        channel_platform: 'bar',
        channel_externalThreadId: fooThreadId,
        channel_externalChannelId: 'C1',
        channel_ownerId: 'bot-a',
        channel_subscribed: 'true',
      });
      await channelsStore.upsertThreadMapping({
        platform: 'bar',
        ownerId: 'bot-a',
        externalThreadId: fooThreadId,
        externalChannelId: 'C1',
        threadId: 'bar-thread',
      });

      expect(await botA.isSubscribed(fooThreadId)).toBe(true);
      expect(listThreads).toHaveBeenCalled();

      await botA.unsubscribe(fooThreadId);
      const barRow = await channelsStore.getThreadMapping({
        platform: 'bar',
        ownerId: 'bot-a',
        externalThreadId: fooThreadId,
      });
      expect(barRow!.subscribed).toBe(false);
      expect(
        await channelsStore.getThreadMapping({ platform: 'foo', ownerId: 'bot-a', externalThreadId: fooThreadId }),
      ).toBeNull();
    });

    it('never touches the mapping store when the owner id is null', async () => {
      await seedThread('t1', { ...legacyMetadata(), channel_subscribed: 'true' });
      const getMapping = vi.spyOn(channelsStore, 'getThreadMapping');
      const unbound = new MastraStateAdapter(memoryStore, () => null, channelsStore);
      await unbound.connect();

      expect(await unbound.isSubscribed(externalThreadId)).toBe(true);
      await unbound.subscribe(externalThreadId);

      expect(getMapping).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });

    it('does not leak a subscription between bots sharing the capable store (#17037)', async () => {
      await seedThread('shared-legacy', legacyMetadata());
      const botB = new MastraStateAdapter(memoryStore, () => 'bot-b', channelsStore);
      await botB.connect();

      await botA.subscribe(externalThreadId);

      expect(await botA.isSubscribed(externalThreadId)).toBe(true);
      expect(await botB.isSubscribed(externalThreadId)).toBe(false);
    });
  });
});
