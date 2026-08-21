import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TursoConnection } from '../db/connection';
import { TursoMemory } from './memory';

/** Builds a thread with sensible defaults so tests state only what they exercise. */
function thread(overrides: Partial<StorageThreadType> = {}): StorageThreadType {
  return {
    id: `thread-${Math.random().toString(16).slice(2)}`,
    resourceId: 'resource-1',
    title: 'Untitled',
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function message(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: `message-${Math.random().toString(16).slice(2)}`,
    threadId: 't1',
    resourceId: 'resource-1',
    role: 'user',
    type: 'v2',
    content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as MastraDBMessage;
}

describe('TursoMemory', () => {
  let connection: TursoConnection;
  let memory: TursoMemory;

  beforeEach(async () => {
    connection = new TursoConnection({ path: ':memory:' });
    memory = new TursoMemory({ connection });
    await memory.init();
  });

  afterEach(async () => {
    await connection.close();
  });

  describe('threads', () => {
    it('round-trips a thread including metadata and timestamps', async () => {
      const created = new Date('2026-03-01T10:00:00.000Z');
      const saved = await memory.saveThread({
        thread: thread({ id: 't1', title: 'Support', metadata: { topic: 'billing' }, createdAt: created }),
      });

      expect(saved.title).toBe('Support');

      const loaded = await memory.getThreadById({ threadId: 't1' });
      expect(loaded?.metadata).toEqual({ topic: 'billing' });
      // Timestamps must survive as Date objects, not ISO strings.
      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.createdAt.toISOString()).toBe(created.toISOString());
    });

    it('returns null for a thread that does not exist', async () => {
      expect(await memory.getThreadById({ threadId: 'missing' })).toBeNull();
    });

    it('scopes lookups by resourceId so tenants cannot read each other', async () => {
      await memory.saveThread({ thread: thread({ id: 't1', resourceId: 'tenant-a' }) });

      expect(await memory.getThreadById({ threadId: 't1', resourceId: 'tenant-a' })).not.toBeNull();
      expect(await memory.getThreadById({ threadId: 't1', resourceId: 'tenant-b' })).toBeNull();
    });

    it('saving an existing thread updates it instead of failing', async () => {
      await memory.saveThread({ thread: thread({ id: 't1', title: 'First' }) });
      await memory.saveThread({ thread: thread({ id: 't1', title: 'Second' }) });

      expect((await memory.getThreadById({ threadId: 't1' }))?.title).toBe('Second');

      const { total } = await memory.listThreads({});
      expect(total).toBe(1);
    });

    it('updates only the fields provided, leaving the rest intact', async () => {
      await memory.saveThread({
        thread: thread({ id: 't1', title: 'Original', metadata: { topic: 'billing', tier: 'pro' } }),
      });

      await memory.updateThread({ id: 't1', metadata: { topic: 'refunds' } });

      const loaded = await memory.getThreadById({ threadId: 't1' });
      // Title was not part of the update, so it must be untouched.
      expect(loaded?.title).toBe('Original');
      expect(loaded?.metadata).toEqual({ topic: 'refunds' });
    });

    it('rejects updates to a thread that does not exist', async () => {
      await expect(memory.updateThread({ id: 'missing', title: 'x' })).rejects.toThrow(/not found/i);
    });

    it('deletes a thread together with its messages', async () => {
      await memory.saveThread({ thread: thread({ id: 't1' }) });
      await memory.saveMessages({ messages: [message({ id: 'm1', threadId: 't1' })] });

      await memory.deleteThread({ threadId: 't1' });

      expect(await memory.getThreadById({ threadId: 't1' })).toBeNull();
      // Messages must not outlive their thread.
      const { messages } = await memory.listMessagesById({ messageIds: ['m1'] });
      expect(messages).toEqual([]);
    });

    it('leaves other threads untouched when one is deleted', async () => {
      await memory.saveThread({ thread: thread({ id: 't1' }) });
      await memory.saveThread({ thread: thread({ id: 't2' }) });
      await memory.saveMessages({ messages: [message({ id: 'm2', threadId: 't2' })] });

      await memory.deleteThread({ threadId: 't1' });

      expect(await memory.getThreadById({ threadId: 't2' })).not.toBeNull();
      expect((await memory.listMessagesById({ messageIds: ['m2'] })).messages).toHaveLength(1);
    });
  });

  describe('listThreads', () => {
    beforeEach(async () => {
      for (let index = 0; index < 5; index++) {
        await memory.saveThread({
          thread: thread({
            id: `t${index}`,
            resourceId: index < 3 ? 'resource-a' : 'resource-b',
            metadata: { index, archived: index % 2 === 0, owner: index === 0 ? null : 'sam' },
            createdAt: new Date(Date.UTC(2026, 0, index + 1)),
          }),
        });
      }
    });

    it('returns newest first by default', async () => {
      const { threads } = await memory.listThreads({});
      expect(threads.map(t => t.id)).toEqual(['t4', 't3', 't2', 't1', 't0']);
    });

    it('honours ascending order', async () => {
      const { threads } = await memory.listThreads({ orderBy: { field: 'createdAt', direction: 'ASC' } });
      expect(threads.map(t => t.id)).toEqual(['t0', 't1', 't2', 't3', 't4']);
    });

    it('filters by resourceId', async () => {
      const { threads, total } = await memory.listThreads({ filter: { resourceId: 'resource-a' } });
      expect(total).toBe(3);
      expect(threads.map(t => t.id).sort()).toEqual(['t0', 't1', 't2']);
    });

    it('paginates without dropping or repeating rows', async () => {
      const first = await memory.listThreads({ perPage: 2, page: 0 });
      const second = await memory.listThreads({ perPage: 2, page: 1 });
      const third = await memory.listThreads({ perPage: 2, page: 2 });

      expect(first.threads.map(t => t.id)).toEqual(['t4', 't3']);
      expect(second.threads.map(t => t.id)).toEqual(['t2', 't1']);
      expect(third.threads.map(t => t.id)).toEqual(['t0']);

      expect(first.hasMore).toBe(true);
      expect(third.hasMore).toBe(false);
      // total counts all matching rows, not just the page.
      expect(first.total).toBe(5);
    });

    it('returns every row when perPage is false', async () => {
      const { threads, perPage, hasMore } = await memory.listThreads({ perPage: false });
      expect(threads).toHaveLength(5);
      expect(perPage).toBe(false);
      expect(hasMore).toBe(false);
    });

    it('returns no rows but a real total when perPage is 0', async () => {
      const { threads, total } = await memory.listThreads({ perPage: 0 });
      expect(threads).toEqual([]);
      expect(total).toBe(5);
    });

    it('filters on a numeric metadata value', async () => {
      const { threads } = await memory.listThreads({ filter: { metadata: { index: 3 } } });
      expect(threads.map(t => t.id)).toEqual(['t3']);
    });

    it('filters on a boolean metadata value', async () => {
      // json_extract yields 1/0 for booleans; the filter must account for that.
      const { threads } = await memory.listThreads({ filter: { metadata: { archived: true } } });
      expect(threads.map(t => t.id).sort()).toEqual(['t0', 't2', 't4']);
    });

    it('filters on a null metadata value', async () => {
      // `= NULL` is never true in SQL, so this must use IS NULL.
      const { threads } = await memory.listThreads({ filter: { metadata: { owner: null } } });
      expect(threads.map(t => t.id)).toEqual(['t0']);
    });

    it('combines metadata filters with AND', async () => {
      const { threads } = await memory.listThreads({ filter: { metadata: { archived: true, index: 2 } } });
      expect(threads.map(t => t.id)).toEqual(['t2']);
    });

    it('rejects a metadata key that could be used for injection', async () => {
      await expect(memory.listThreads({ filter: { metadata: { "a' OR '1'='1": 'x' } } as never })).rejects.toThrow();
    });
  });

  describe('messages', () => {
    beforeEach(async () => {
      await memory.saveThread({ thread: thread({ id: 't1' }) });
    });

    it('round-trips message content and ordering', async () => {
      await memory.saveMessages({
        messages: [
          message({ id: 'm1', createdAt: new Date('2026-01-01T00:00:00Z') }),
          message({ id: 'm2', createdAt: new Date('2026-01-02T00:00:00Z') }),
        ],
      });

      const { messages } = await memory.listMessages({ threadId: 't1', orderBy: { direction: 'ASC' } });
      expect(messages.map(m => m.id)).toEqual(['m1', 'm2']);
      expect(messages[0]!.content.parts).toEqual([{ type: 'text', text: 'hello' }]);
      expect(messages[0]!.createdAt).toBeInstanceOf(Date);
    });

    it('bumps the thread updatedAt when messages are saved', async () => {
      const before = await memory.getThreadById({ threadId: 't1' });
      await memory.saveMessages({ messages: [message({ id: 'm1' })] });
      const after = await memory.getThreadById({ threadId: 't1' });

      expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
    });

    it('does not touch threads that received no messages', async () => {
      await memory.saveThread({ thread: thread({ id: 't2' }) });
      const before = await memory.getThreadById({ threadId: 't2' });

      await memory.saveMessages({ messages: [message({ id: 'm1', threadId: 't1' })] });

      const after = await memory.getThreadById({ threadId: 't2' });
      expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
    });

    it('scopes messages to their thread', async () => {
      await memory.saveThread({ thread: thread({ id: 't2' }) });
      await memory.saveMessages({
        messages: [message({ id: 'm1', threadId: 't1' }), message({ id: 'm2', threadId: 't2' })],
      });

      const { messages } = await memory.listMessages({ threadId: 't1' });
      expect(messages.map(m => m.id)).toEqual(['m1']);
    });

    it('reads across several threads at once', async () => {
      await memory.saveThread({ thread: thread({ id: 't2' }) });
      await memory.saveMessages({
        messages: [message({ id: 'm1', threadId: 't1' }), message({ id: 'm2', threadId: 't2' })],
      });

      const { messages } = await memory.listMessages({ threadId: ['t1', 't2'] });
      expect(messages.map(m => m.id).sort()).toEqual(['m1', 'm2']);
    });

    it('filters messages by date range', async () => {
      await memory.saveMessages({
        messages: [
          message({ id: 'm1', createdAt: new Date('2026-01-01T00:00:00Z') }),
          message({ id: 'm2', createdAt: new Date('2026-01-05T00:00:00Z') }),
          message({ id: 'm3', createdAt: new Date('2026-01-10T00:00:00Z') }),
        ],
      });

      const { messages } = await memory.listMessages({
        threadId: 't1',
        filter: { dateRange: { start: new Date('2026-01-04T00:00:00Z'), end: new Date('2026-01-06T00:00:00Z') } },
      });

      expect(messages.map(m => m.id)).toEqual(['m2']);
    });

    it('paginates messages consistently', async () => {
      await memory.saveMessages({
        messages: Array.from({ length: 5 }, (_, index) =>
          message({ id: `m${index}`, createdAt: new Date(Date.UTC(2026, 0, index + 1)) }),
        ),
      });

      const first = await memory.listMessages({ threadId: 't1', perPage: 2, page: 0 });
      const second = await memory.listMessages({ threadId: 't1', perPage: 2, page: 1 });

      expect(first.total).toBe(5);
      expect(first.hasMore).toBe(true);
      expect(first.messages.map(m => m.id)).toEqual(['m4', 'm3']);
      expect(second.messages.map(m => m.id)).toEqual(['m2', 'm1']);
    });

    it('returns messages by id in chronological order', async () => {
      await memory.saveMessages({
        messages: [
          message({ id: 'm1', createdAt: new Date('2026-01-02T00:00:00Z') }),
          message({ id: 'm2', createdAt: new Date('2026-01-01T00:00:00Z') }),
        ],
      });

      const { messages } = await memory.listMessagesById({ messageIds: ['m1', 'm2'] });
      expect(messages.map(m => m.id)).toEqual(['m2', 'm1']);
    });

    it('ignores ids that do not exist', async () => {
      await memory.saveMessages({ messages: [message({ id: 'm1' })] });
      const { messages } = await memory.listMessagesById({ messageIds: ['m1', 'nope'] });
      expect(messages.map(m => m.id)).toEqual(['m1']);
    });

    it('merges metadata on update instead of replacing content', async () => {
      await memory.saveMessages({
        messages: [
          message({
            id: 'm1',
            content: { format: 2, parts: [{ type: 'text', text: 'original' }], metadata: { seen: false, tag: 'a' } },
          }),
        ],
      });

      await memory.updateMessages({ messages: [{ id: 'm1', content: { metadata: { seen: true } } }] });

      const { messages } = await memory.listMessagesById({ messageIds: ['m1'] });
      // Parts and untouched metadata keys must survive a metadata-only update.
      expect(messages[0]!.content.parts).toEqual([{ type: 'text', text: 'original' }]);
      expect(messages[0]!.content.metadata).toEqual({ seen: true, tag: 'a' });
    });

    it('skips updates for messages that do not exist', async () => {
      const updated = await memory.updateMessages({ messages: [{ id: 'missing', content: { metadata: {} } }] });
      expect(updated).toEqual([]);
    });

    it('deletes only the requested messages', async () => {
      await memory.saveMessages({ messages: [message({ id: 'm1' }), message({ id: 'm2' })] });

      await memory.deleteMessages(['m1']);

      const { messages } = await memory.listMessages({ threadId: 't1' });
      expect(messages.map(m => m.id)).toEqual(['m2']);
    });

    it('treats empty inputs as no-ops', async () => {
      await expect(memory.saveMessages({ messages: [] })).resolves.toEqual({ messages: [] });
      await expect(memory.deleteMessages([])).resolves.toBeUndefined();
      await expect(memory.listMessagesById({ messageIds: [] })).resolves.toEqual({ messages: [] });
    });
  });

  describe('resources', () => {
    it('round-trips a resource', async () => {
      await memory.saveResource({
        resource: {
          id: 'r1',
          workingMemory: 'notes',
          metadata: { locale: 'en' },
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        } as never,
      });

      const loaded = await memory.getResourceById({ resourceId: 'r1' });
      expect(loaded?.workingMemory).toBe('notes');
      expect(loaded?.metadata).toEqual({ locale: 'en' });
    });

    it('creates the resource when updating one that does not exist', async () => {
      const updated = await memory.updateResource({ resourceId: 'r1', workingMemory: 'fresh' });
      expect(updated.workingMemory).toBe('fresh');
      expect((await memory.getResourceById({ resourceId: 'r1' }))?.workingMemory).toBe('fresh');
    });

    it('merges metadata and preserves working memory when updating', async () => {
      await memory.saveResource({
        resource: {
          id: 'r1',
          workingMemory: 'keep me',
          metadata: { locale: 'en', tier: 'pro' },
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never,
      });

      await memory.updateResource({ resourceId: 'r1', metadata: { locale: 'fr' } });

      const loaded = await memory.getResourceById({ resourceId: 'r1' });
      expect(loaded?.workingMemory).toBe('keep me');
      expect(loaded?.metadata).toEqual({ locale: 'fr', tier: 'pro' });
    });

    it('returns null for an unknown resource', async () => {
      expect(await memory.getResourceById({ resourceId: 'nope' })).toBeNull();
    });
  });

  it('clears every table it owns', async () => {
    await memory.saveThread({ thread: thread({ id: 't1' }) });
    await memory.saveMessages({ messages: [message({ id: 'm1', threadId: 't1' })] });
    await memory.saveResource({
      resource: { id: 'r1', metadata: {}, createdAt: new Date(), updatedAt: new Date() } as never,
    });

    await memory.dangerouslyClearAll();

    expect((await memory.listThreads({})).total).toBe(0);
    expect((await memory.listMessagesById({ messageIds: ['m1'] })).messages).toEqual([]);
    expect(await memory.getResourceById({ resourceId: 'r1' })).toBeNull();
  });
});
