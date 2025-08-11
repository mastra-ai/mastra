import { TABLE_THREADS, type MastraStorage } from '@mastra/core/storage';
import { createSampleMessageV1, createSampleMessageV2, createSampleThread, createSampleThreadWithParams } from './data';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import { randomUUID } from 'crypto';

export function createThreadsTest({ storage }: { storage: MastraStorage }) {
  describe('Threads', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await storage.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await storage.getThreadById({ threadId: thread.id });

      expect(retrievedThread?.title).toEqual(thread.title);
    });

    it('should create and retrieve a thread with the same given threadId and resourceId', async () => {
      const exampleThreadId = '1346362547862769664';
      const exampleResourceId = '532374164040974346';
      const createdAt = new Date();
      const updatedAt = new Date();
      const thread = createSampleThreadWithParams(exampleThreadId, exampleResourceId, createdAt, updatedAt);

      // Save thread
      const savedThread = await storage.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.id).toEqual(exampleThreadId);
      expect(retrievedThread?.resourceId).toEqual(exampleResourceId);
      expect(retrievedThread?.title).toEqual(thread.title);

      if (retrievedThread?.createdAt instanceof Date) {
        expect(retrievedThread?.createdAt.toISOString()).toEqual(createdAt.toISOString());
      } else {
        expect(retrievedThread?.createdAt).toEqual(createdAt.toISOString());
      }

      if (retrievedThread?.updatedAt instanceof Date) {
        expect(retrievedThread?.updatedAt.toISOString()).toEqual(updatedAt.toISOString());
      } else {
        expect(retrievedThread?.updatedAt).toEqual(updatedAt.toISOString());
      }
    });

    it('should return null for non-existent thread', async () => {
      const result = await storage.getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const thread1 = createSampleThread();
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };

      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      const threads = await storage.getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const newMetadata = { newKey: 'newValue' };
      const updatedThread = await storage.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: newMetadata,
      });

      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({
        ...thread.metadata,
        ...newMetadata,
      });

      // Verify persistence
      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      console.log('retrievedThread', retrievedThread);
      expect(retrievedThread).toEqual(updatedThread);
    });

    it('should delete thread', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      await storage.deleteThread({ threadId: thread.id });

      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessageV2({ threadId: thread.id }), createSampleMessageV2({ threadId: thread.id })];
      await storage.saveMessages({ messages, format: 'v2' });

      await storage.deleteThread({ threadId: thread.id });

      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await storage.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    });

    it('should update thread updatedAt when a message is saved to it', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Get the initial thread to capture the original updatedAt
      const initialThread = await storage.getThreadById({ threadId: thread.id });
      expect(initialThread).toBeDefined();
      const originalUpdatedAt = initialThread!.updatedAt;

      // Wait a small amount to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create and save a message to the thread
      const message = createSampleMessageV1({ threadId: thread.id });
      await storage.saveMessages({ messages: [message] });

      // Retrieve the thread again and check that updatedAt was updated
      const updatedThread = await storage.getThreadById({ threadId: thread.id });
      expect(updatedThread).toBeDefined();

      let originalUpdatedAtTime: number;

      if (updatedThread!.updatedAt instanceof Date) {
        originalUpdatedAtTime = originalUpdatedAt.getTime();
      } else {
        originalUpdatedAtTime = new Date(originalUpdatedAt).getTime();
      }

      if (updatedThread!.updatedAt instanceof Date) {
        expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAtTime);
      } else {
        expect(new Date(updatedThread!.updatedAt).getTime()).toBeGreaterThan(originalUpdatedAtTime);
      }
    });

    it('should handle stringified JSON content without double-nesting', async () => {
      const threadData = createSampleThread();
      const thread = await storage.saveThread({ thread: threadData as StorageThreadType });

      // Simulate user passing stringified JSON as message content (like the original bug report)
      const stringifiedContent = JSON.stringify({ userInput: 'test data', metadata: { key: 'value' } });
      const message: MastraMessageV2 = {
        id: `msg-${randomUUID()}`,
        role: 'user',
        threadId: thread.id,
        resourceId: thread.resourceId,
        content: {
          format: 2,
          parts: [{ type: 'text', text: stringifiedContent }],
          content: stringifiedContent, // This is the stringified JSON that user passed
        },
        createdAt: new Date(),
      };

      // Save the message - this should stringify the whole content object for storage
      await storage.saveMessages({ messages: [message], format: 'v2' });

      // Retrieve the message - this is where double-nesting could occur
      const retrievedMessages = await storage.getMessages({ threadId: thread.id, format: 'v2' });
      expect(retrievedMessages).toHaveLength(1);

      const retrievedMessage = retrievedMessages[0] as MastraMessageV2;

      // Check that content is properly structured as a V2 message
      expect(typeof retrievedMessage.content).toBe('object');
      expect(retrievedMessage.content.format).toBe(2);

      // CRITICAL: The content.content should still be the original stringified JSON
      // NOT double-nested like: { content: '{"format":2,"parts":[...],"content":"{\\"userInput\\":\\"test data\\"}"}' }
      expect(retrievedMessage.content.content).toBe(stringifiedContent);

      // Verify the content can be parsed as the original JSON
      const parsedContent = JSON.parse(retrievedMessage.content.content as string);
      expect(parsedContent).toEqual({ userInput: 'test data', metadata: { key: 'value' } });

      // Additional check: ensure the message doesn't have the "Found unhandled message" structure
      expect(retrievedMessage.content.parts).toBeDefined();
      expect(Array.isArray(retrievedMessage.content.parts)).toBe(true);
    });

    it('should return paginated threads with total count', async () => {
      const resourceId = `pg-paginated-resource-${randomUUID()}`;
      const threadPromises = Array.from({ length: 17 }, () =>
        storage.saveThread({ thread: { ...createSampleThread(), resourceId } }),
      );
      await Promise.all(threadPromises);

      const page1 = await storage.getThreadsByResourceIdPaginated({ resourceId, page: 0, perPage: 7 });
      expect(page1.threads).toHaveLength(7);
      expect(page1.total).toBe(17);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(7);
      expect(page1.hasMore).toBe(true);

      const page3 = await storage.getThreadsByResourceIdPaginated({ resourceId, page: 2, perPage: 7 });
      expect(page3.threads).toHaveLength(3); // 17 total, 7 per page, 3rd page has 17 - 2*7 = 3
      expect(page3.total).toBe(17);
      expect(page3.hasMore).toBe(false);
    });

    it('should return paginated results when no pagination params for getThreadsByResourceId', async () => {
      const resourceId = `pg-non-paginated-resource-${randomUUID()}`;
      await storage.saveThread({ thread: { ...createSampleThread(), resourceId } });

      const results = await storage.getThreadsByResourceIdPaginated({ resourceId, page: 0, perPage: 100 });
      expect(Array.isArray(results.threads)).toBe(true);
      expect(results.threads.length).toBe(1);
      expect(results.total).toBe(1);
      expect(results.page).toBe(0);
      expect(results.perPage).toBe(100);
      expect(results.hasMore).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle large metadata objects', async () => {
      const thread = createSampleThread();
      const largeMetadata = {
        ...thread.metadata,
        largeArray: Array.from({ length: 10 }, (_, i) => ({ index: i, data: 'test'.repeat(10) })),
      };

      const threadWithLargeMetadata = {
        ...thread,
        metadata: largeMetadata,
      };

      await storage.saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await storage.getThreadById({ threadId: thread.id });

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle special characters in thread titles', async () => {
      const thread = {
        ...createSampleThread(),
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      };

      await storage.saveThread({ thread });
      const retrieved = await storage.getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    });

    it('should handle concurrent thread updates', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Perform multiple updates concurrently
      const updates = Array.from({ length: 5 }, (_, i) =>
        storage.updateThread({
          id: thread.id,
          title: `Update ${i}`,
          metadata: { update: i },
        }),
      );

      await expect(Promise.all(updates)).resolves.toBeDefined();

      // Verify final state
      const finalThread = await storage.getThreadById({ threadId: thread.id });
      expect(finalThread).toBeDefined();
    });
  });

  // describe('Date Handling', () => {
  //   beforeEach(async () => {
  //     await storage.clearTable({ tableName: TABLE_THREADS });
  //   });

  //   it('should handle Date objects in thread operations', async () => {
  //     const now = new Date();
  //     const thread = createSampleThread({ date: now });

  //     await storage.saveThread({ thread });
  //     const retrievedThread = await storage.getThreadById({ threadId: thread.id });

  //     expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
  //     expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
  //   });

  //   it('should handle ISO string dates in thread operations', async () => {
  //     const now = new Date();
  //     const thread = createSampleThread({ date: now });

  //     await storage.saveThread({ thread });
  //     const retrievedThread = await storage.getThreadById({ threadId: thread.id });
  //     expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
  //     expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
  //   });

  //   it('should handle mixed date formats in thread operations', async () => {
  //     const now = new Date();
  //     const thread = createSampleThread({ date: now });

  //     await storage.saveThread({ thread });
  //     const retrievedThread = await storage.getThreadById({ threadId: thread.id });
  //     expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
  //     expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
  //     expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
  //   });

  //   it('should handle date serialization in getThreadsByResourceId', async () => {
  //     const now = new Date();
  //     const thread1 = createSampleThread({ date: now });
  //     const thread2 = { ...createSampleThread({ date: now }), resourceId: thread1.resourceId };
  //     const threads = [thread1, thread2];

  //     await Promise.all(threads.map(thread => storage.saveThread({ thread })));

  //     const retrievedThreads = await storage.getThreadsByResourceId({ resourceId: threads[0]?.resourceId! });
  //     expect(retrievedThreads).toHaveLength(2);
  //     retrievedThreads.forEach(thread => {
  //       expect(thread.createdAt).toBeInstanceOf(Date);
  //       expect(thread.updatedAt).toBeInstanceOf(Date);
  //       expect(thread.createdAt.toISOString()).toBe(now.toISOString());
  //       expect(thread.updatedAt.toISOString()).toBe(now.toISOString());
  //     });
  //   });
  // });

  const describeSorting = isStorageSupportsSort(storage) ? describe : describe.skip;

  describeSorting('Thread Sorting', () => {
    let resourceId: string;
    let threads: StorageThreadType[];

    // Helper function to get date value handling both Date and string types
    function getDateValue(dateField: Date | string): number {
      return dateField instanceof Date ? dateField.getTime() : new Date(dateField).getTime();
    }

    // Helper function to verify sort order
    function expectThreadsSortedBy(
      threads: StorageThreadType[],
      field: 'createdAt' | 'updatedAt',
      direction: 'ASC' | 'DESC',
    ): void {
      for (let i = 0; i < threads.length - 1; i++) {
        const currentDate = getDateValue(threads[i]![field]);
        const nextDate = getDateValue(threads[i + 1]![field]);

        if (direction === 'ASC') {
          expect(currentDate).toBeLessThanOrEqual(nextDate);
        } else {
          expect(currentDate).toBeGreaterThanOrEqual(nextDate);
        }
      }
    }

    beforeEach(async () => {
      // Create unique resourceId for each test
      resourceId = `sort-test-resource-${randomUUID()}`;

      // Create test threads with specific dates for predictable sorting
      const baseTime = new Date('2024-01-01T00:00:00Z');
      const threadData = [
        {
          id: `thread-${randomUUID()}`,
          resourceId,
          title: 'Thread 1',
          createdAt: new Date(baseTime.getTime()), // oldest createdAt
          updatedAt: new Date(baseTime.getTime() + 5000), // newest updatedAt
          metadata: { index: 1 },
        },
        {
          id: `thread-${randomUUID()}`,
          resourceId,
          title: 'Thread 2',
          createdAt: new Date(baseTime.getTime() + 1000),
          updatedAt: new Date(baseTime.getTime() + 1000), // oldest updatedAt
          metadata: { index: 2 },
        },
        {
          id: `thread-${randomUUID()}`,
          resourceId,
          title: 'Thread 3',
          createdAt: new Date(baseTime.getTime() + 2000),
          updatedAt: new Date(baseTime.getTime() + 4000),
          metadata: { index: 3 },
        },
        {
          id: `thread-${randomUUID()}`,
          resourceId,
          title: 'Thread 4',
          createdAt: new Date(baseTime.getTime() + 3000),
          updatedAt: new Date(baseTime.getTime() + 2000),
          metadata: { index: 4 },
        },
        {
          id: `thread-${randomUUID()}`,
          resourceId,
          title: 'Thread 5',
          createdAt: new Date(baseTime.getTime() + 4000), // newest createdAt
          updatedAt: new Date(baseTime.getTime() + 3000),
          metadata: { index: 5 },
        },
      ];

      // Save all threads
      threads = [];
      for (const threadInfo of threadData) {
        const savedThread = await storage.saveThread({ thread: threadInfo });
        threads.push(savedThread);
      }
    });

    describe('getThreadsByResourceId sorting', () => {
      it('should sort threads by createdAt DESC by default (no parameters)', async () => {
        const result = await storage.getThreadsByResourceId({ resourceId });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'DESC');
      });

      it('should sort threads by createdAt ASC', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'createdAt',
          sortDirection: 'ASC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'ASC');
      });

      it('should sort threads by createdAt DESC', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'createdAt',
          sortDirection: 'DESC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'DESC');
      });

      it('should sort threads by updatedAt ASC', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'updatedAt',
          sortDirection: 'ASC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'updatedAt', 'ASC');
      });

      it('should sort threads by updatedAt DESC', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'updatedAt', 'DESC');
      });

      it('should sort by createdAt DESC when only orderBy is specified (sortDirection defaults to DESC)', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'createdAt',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'DESC');
      });

      it('should sort by updatedAt DESC when only orderBy is specified (sortDirection defaults to DESC)', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'updatedAt',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'updatedAt', 'DESC');
      });

      it('should sort by createdAt ASC when only sortDirection ASC is specified (orderBy defaults to createdAt)', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          sortDirection: 'ASC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'ASC');
      });

      it('should sort by createdAt DESC when only sortDirection DESC is specified (orderBy defaults to createdAt)', async () => {
        const result = await storage.getThreadsByResourceId({
          resourceId,
          sortDirection: 'DESC',
        });

        expect(result).toHaveLength(5);
        expectThreadsSortedBy(result, 'createdAt', 'DESC');
      });
    });

    describe('getThreadsByResourceIdPaginated sorting', () => {
      it('should sort paginated threads by createdAt DESC by default', async () => {
        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 0,
          perPage: 3,
        });

        expect(result.threads).toHaveLength(3);
        expect(result.total).toBe(5);
        expectThreadsSortedBy(result.threads, 'createdAt', 'DESC');
      });

      it('should sort paginated threads by createdAt ASC', async () => {
        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 0,
          perPage: 3,
          orderBy: 'createdAt',
          sortDirection: 'ASC',
        });

        expect(result.threads).toHaveLength(3);
        expect(result.total).toBe(5);
        expectThreadsSortedBy(result.threads, 'createdAt', 'ASC');
      });

      it('should sort paginated threads by updatedAt DESC', async () => {
        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 0,
          perPage: 3,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        expect(result.threads).toHaveLength(3);
        expect(result.total).toBe(5);
        expectThreadsSortedBy(result.threads, 'updatedAt', 'DESC');
      });

      it('should sort paginated threads by updatedAt ASC', async () => {
        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 0,
          perPage: 3,
          orderBy: 'updatedAt',
          sortDirection: 'ASC',
        });

        expect(result.threads).toHaveLength(3);
        expect(result.total).toBe(5);
        expectThreadsSortedBy(result.threads, 'updatedAt', 'ASC');
      });

      it('should maintain sort order consistency across pages', async () => {
        // Get all threads sorted by updatedAt DESC for comparison
        const allThreads = await storage.getThreadsByResourceId({
          resourceId,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        // Get paginated results
        const page1 = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 0,
          perPage: 2,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        const page2 = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 1,
          perPage: 2,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        const page3 = await storage.getThreadsByResourceIdPaginated({
          resourceId,
          page: 2,
          perPage: 2,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        // Combine paginated results
        const combinedThreads = [...page1.threads, ...page2.threads, ...page3.threads];

        // Should have same order as non-paginated version
        expect(combinedThreads).toHaveLength(5);
        expect(combinedThreads.map(t => t.id)).toEqual(allThreads.map(t => t.id));
      });

      it('should handle empty results with sorting parameters', async () => {
        const emptyResourceId = `empty-resource-${randomUUID()}`;

        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId: emptyResourceId,
          page: 0,
          perPage: 10,
          orderBy: 'createdAt',
          sortDirection: 'ASC',
        });

        expect(result.threads).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.page).toBe(0);
        expect(result.perPage).toBe(10);
        expect(result.hasMore).toBe(false);
      });

      it('should handle single thread with sorting parameters', async () => {
        const singleResourceId = `single-resource-${randomUUID()}`;
        const singleThread = await storage.saveThread({
          thread: { ...createSampleThread(), resourceId: singleResourceId },
        });

        const result = await storage.getThreadsByResourceIdPaginated({
          resourceId: singleResourceId,
          page: 0,
          perPage: 10,
          orderBy: 'updatedAt',
          sortDirection: 'ASC',
        });

        expect(result.threads).toHaveLength(1);
        expect(result.threads[0]!.id).toBe(singleThread.id);
        expect(result.total).toBe(1);
        expect(result.hasMore).toBe(false);
      });
    });

    describe('Thread sorting edge cases', () => {
      it('should handle threads with identical timestamps', async () => {
        const identicalResourceId = `identical-resource-${randomUUID()}`;
        const sameDate = new Date('2024-01-01T12:00:00Z');

        const identicalThreads = await Promise.all([
          storage.saveThread({
            thread: {
              id: `identical-1-${randomUUID()}`,
              resourceId: identicalResourceId,
              title: 'Identical Thread 1',
              createdAt: sameDate,
              updatedAt: sameDate,
              metadata: { index: 1 },
            },
          }),
          storage.saveThread({
            thread: {
              id: `identical-2-${randomUUID()}`,
              resourceId: identicalResourceId,
              title: 'Identical Thread 2',
              createdAt: sameDate,
              updatedAt: sameDate,
              metadata: { index: 2 },
            },
          }),
          storage.saveThread({
            thread: {
              id: `identical-3-${randomUUID()}`,
              resourceId: identicalResourceId,
              title: 'Identical Thread 3',
              createdAt: sameDate,
              updatedAt: sameDate,
              metadata: { index: 3 },
            },
          }),
        ]);

        const result = await storage.getThreadsByResourceId({
          resourceId: identicalResourceId,
          orderBy: 'createdAt',
          sortDirection: 'ASC',
        });

        expect(result).toHaveLength(3);

        // All should have the same timestamp
        result.forEach(thread => {
          const threadDate =
            thread.createdAt instanceof Date ? thread.createdAt.getTime() : new Date(thread.createdAt).getTime();
          expect(threadDate).toBe(sameDate.getTime());
        });

        // Should contain all threads
        const resultIds = result.map(t => t.id);
        const expectedIds = identicalThreads.map(t => t.id);
        expect(resultIds).toEqual(expect.arrayContaining(expectedIds));
      });
    });
  });
}

function isStorageSupportsSort(storage: MastraStorage): boolean {
  const storageType = storage.constructor.name;
  return ['LibSQLStore', 'PostgresStore', 'MSSQLStore', 'DynamoDBStore'].includes(storageType);
}
