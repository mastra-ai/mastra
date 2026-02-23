import { describe, it, expect, beforeAll } from 'vitest';
import type { MastraStorage, MemoryStorage } from '@mastra/core/storage';
import { createSampleThread, createSampleMessageV2 } from './data';
import { randomUUID } from 'node:crypto';

export function createLastMessageAtTests({ storage }: { storage: MastraStorage }) {
  describe('lastMessageAt', () => {
    let memoryStorage: MemoryStorage;

    beforeAll(async () => {
      const store = await storage.getStore('memory');
      if (!store) {
        throw new Error('Memory storage not found');
      }
      memoryStorage = store;
    });

    function getTimestamp(date: Date | string | null | undefined): number | null {
      if (date == null) return null;
      return date instanceof Date ? date.getTime() : new Date(date).getTime();
    }

    it('should be null on a newly created thread', async () => {
      const thread = createSampleThread();
      await memoryStorage.saveThread({ thread });

      const retrieved = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(retrieved).toBeDefined();
      expect(retrieved!.lastMessageAt ?? null).toBeNull();
    });

    it('should be set to max message createdAt after saveMessages', async () => {
      const thread = createSampleThread();
      await memoryStorage.saveThread({ thread });

      const baseTime = new Date('2025-01-15T10:00:00Z');
      const messages = [
        createSampleMessageV2({
          threadId: thread.id,
          createdAt: new Date(baseTime.getTime()),
          role: 'user',
        }),
        createSampleMessageV2({
          threadId: thread.id,
          createdAt: new Date(baseTime.getTime() + 2000),
          role: 'assistant',
        }),
        createSampleMessageV2({
          threadId: thread.id,
          createdAt: new Date(baseTime.getTime() + 1000),
          role: 'user',
        }),
      ];

      await memoryStorage.saveMessages({ messages });

      const retrieved = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(retrieved).toBeDefined();
      expect(retrieved!.lastMessageAt).toBeDefined();
      expect(retrieved!.lastMessageAt).not.toBeNull();
      // Should be the max createdAt (baseTime + 2000)
      expect(getTimestamp(retrieved!.lastMessageAt!)).toBe(baseTime.getTime() + 2000);
    });

    it('should not regress when older messages are saved', async () => {
      const thread = createSampleThread();
      await memoryStorage.saveThread({ thread });

      const newerTime = new Date('2025-06-01T12:00:00Z');
      const olderTime = new Date('2025-01-01T12:00:00Z');

      // Save newer message first
      await memoryStorage.saveMessages({
        messages: [
          createSampleMessageV2({
            threadId: thread.id,
            createdAt: newerTime,
            role: 'user',
          }),
        ],
      });

      const afterNewer = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(getTimestamp(afterNewer!.lastMessageAt!)).toBe(newerTime.getTime());

      // Save older message - lastMessageAt should NOT regress
      await memoryStorage.saveMessages({
        messages: [
          createSampleMessageV2({
            threadId: thread.id,
            createdAt: olderTime,
            role: 'assistant',
          }),
        ],
      });

      const afterOlder = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(getTimestamp(afterOlder!.lastMessageAt!)).toBe(newerTime.getTime());
    });

    it('should recompute after deleteMessages to max of remaining', async () => {
      const thread = createSampleThread();
      await memoryStorage.saveThread({ thread });

      const t1 = new Date('2025-03-01T10:00:00Z');
      const t2 = new Date('2025-03-01T11:00:00Z');
      const t3 = new Date('2025-03-01T12:00:00Z');

      const msg1 = createSampleMessageV2({ threadId: thread.id, createdAt: t1, role: 'user' });
      const msg2 = createSampleMessageV2({ threadId: thread.id, createdAt: t2, role: 'assistant' });
      const msg3 = createSampleMessageV2({ threadId: thread.id, createdAt: t3, role: 'user' });

      await memoryStorage.saveMessages({ messages: [msg1, msg2, msg3] });

      // Verify initial lastMessageAt
      const beforeDelete = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(getTimestamp(beforeDelete!.lastMessageAt!)).toBe(t3.getTime());

      // Delete the newest message
      await memoryStorage.deleteMessages([msg3.id]);

      // lastMessageAt should now be t2
      const afterDelete = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(getTimestamp(afterDelete!.lastMessageAt!)).toBe(t2.getTime());
    });

    it('should be null after all messages are deleted', async () => {
      const thread = createSampleThread();
      await memoryStorage.saveThread({ thread });

      const msg1 = createSampleMessageV2({ threadId: thread.id, role: 'user' });
      const msg2 = createSampleMessageV2({ threadId: thread.id, role: 'assistant' });

      await memoryStorage.saveMessages({ messages: [msg1, msg2] });

      // Verify it was set
      const beforeDelete = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(beforeDelete!.lastMessageAt).not.toBeNull();

      // Delete all messages
      await memoryStorage.deleteMessages([msg1.id, msg2.id]);

      // lastMessageAt should be null
      const afterDelete = await memoryStorage.getThreadById({ threadId: thread.id });
      expect(afterDelete!.lastMessageAt ?? null).toBeNull();
    });

    it('should be visible in listThreads results', async () => {
      const resourceId = `lma-list-resource-${randomUUID()}`;
      const thread = { ...createSampleThread(), resourceId };
      await memoryStorage.saveThread({ thread });

      const msgTime = new Date('2025-04-01T08:00:00Z');
      await memoryStorage.saveMessages({
        messages: [createSampleMessageV2({ threadId: thread.id, createdAt: msgTime, role: 'user' })],
      });

      const { threads } = await memoryStorage.listThreads({
        filter: { resourceId },
        page: 0,
        perPage: 10,
      });

      const found = threads.find(t => t.id === thread.id);
      expect(found).toBeDefined();
      expect(found!.lastMessageAt).not.toBeNull();
      expect(getTimestamp(found!.lastMessageAt!)).toBe(msgTime.getTime());
    });

    const describeSorting = isStorageSupportsSort(storage) ? describe : describe.skip;

    describeSorting('sorting by lastMessageAt', () => {
      it('should sort threads by lastMessageAt with nulls last for DESC', async () => {
        const resourceId = `lma-sort-resource-${randomUUID()}`;

        // Thread A: no messages (lastMessageAt = null)
        const threadA = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadA });

        // Thread B: message at t1
        const threadB = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadB });
        await memoryStorage.saveMessages({
          messages: [
            createSampleMessageV2({
              threadId: threadB.id,
              createdAt: new Date('2025-01-01T10:00:00Z'),
              role: 'user',
            }),
          ],
        });

        // Thread C: message at t2 (later)
        const threadC = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadC });
        await memoryStorage.saveMessages({
          messages: [
            createSampleMessageV2({
              threadId: threadC.id,
              createdAt: new Date('2025-06-01T10:00:00Z'),
              role: 'user',
            }),
          ],
        });

        // Sort DESC: C, B, A (nulls last)
        const descResult = await memoryStorage.listThreads({
          filter: { resourceId },
          page: 0,
          perPage: 10,
          orderBy: { field: 'lastMessageAt', direction: 'DESC' },
        });

        expect(descResult.threads).toHaveLength(3);
        expect(descResult.threads[0]!.id).toBe(threadC.id);
        expect(descResult.threads[1]!.id).toBe(threadB.id);
        expect(descResult.threads[2]!.id).toBe(threadA.id);
      });

      it('should sort threads by lastMessageAt with nulls first for ASC', async () => {
        const resourceId = `lma-sort-asc-resource-${randomUUID()}`;

        // Thread A: no messages (lastMessageAt = null)
        const threadA = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadA });

        // Thread B: message at t1
        const threadB = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadB });
        await memoryStorage.saveMessages({
          messages: [
            createSampleMessageV2({
              threadId: threadB.id,
              createdAt: new Date('2025-01-01T10:00:00Z'),
              role: 'user',
            }),
          ],
        });

        // Thread C: message at t2 (later)
        const threadC = { ...createSampleThread(), resourceId };
        await memoryStorage.saveThread({ thread: threadC });
        await memoryStorage.saveMessages({
          messages: [
            createSampleMessageV2({
              threadId: threadC.id,
              createdAt: new Date('2025-06-01T10:00:00Z'),
              role: 'user',
            }),
          ],
        });

        // Sort ASC: A (null first), B, C
        const ascResult = await memoryStorage.listThreads({
          filter: { resourceId },
          page: 0,
          perPage: 10,
          orderBy: { field: 'lastMessageAt', direction: 'ASC' },
        });

        expect(ascResult.threads).toHaveLength(3);
        expect(ascResult.threads[0]!.id).toBe(threadA.id);
        expect(ascResult.threads[1]!.id).toBe(threadB.id);
        expect(ascResult.threads[2]!.id).toBe(threadC.id);
      });
    });
  });
}

function isStorageSupportsSort(storage: MastraStorage): boolean {
  const storageType = storage.constructor.name;
  return [
    'LibSQLStore',
    'PostgresStore',
    'MSSQLStore',
    'DynamoDBStore',
    'MongoDBStore',
    'ClickhouseStore',
    'D1Store',
    'CloudflareStore',
    'UpstashStore',
    'ConvexStore',
  ].includes(storageType);
}
