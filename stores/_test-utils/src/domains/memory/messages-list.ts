import { beforeEach, describe, expect, it } from 'vitest';
import { createSampleMessageV2, createSampleThread } from './data';
import type { MastraStorage } from '@mastra/core/storage';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MessageList } from '@mastra/core/agent';

export function createMessagesListTest({ storage }: { storage: MastraStorage }) {
  describe('listMessages', () => {
    let thread: StorageThreadType;
    let thread2: StorageThreadType;
    let messages: MastraDBMessage[];

    beforeEach(async () => {
      // Create test threads
      thread = createSampleThread();
      thread2 = createSampleThread();
      await storage.saveThread({ thread });
      await storage.saveThread({ thread: thread2 });

      // Create test messages
      const now = Date.now();
      messages = [
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: 'Message 1' },
          createdAt: new Date(now + 1000),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: 'Message 2' },
          createdAt: new Date(now + 2000),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: 'Message 3' },
          createdAt: new Date(now + 3000),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: 'Message 4' },
          createdAt: new Date(now + 4000),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: 'Message 5' },
          createdAt: new Date(now + 5000),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          resourceId: thread2.resourceId,
          content: { content: 'Thread2 Message 1' },
          createdAt: new Date(now + 6000),
        }),
      ];

      await storage.saveMessages({ messages });
    });

    it('should list all messages for a thread without pagination', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
      });

      expect(result.messages).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.messages.every(MessageList.isMastraDBMessage)).toBe(true);
    });

    it('should list messages with pagination', async () => {
      const page1 = await storage.listMessages({
        threadId: thread.id,
        perPage: 2,
        page: 0,
      });

      expect(page1.messages).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.listMessages({
        threadId: thread.id,
        perPage: 2,
        page: 1,
      });

      expect(page2.messages).toHaveLength(2);
      expect(page2.total).toBe(5);
      expect(page2.page).toBe(1);
      expect(page2.hasMore).toBe(true);

      const page3 = await storage.listMessages({
        threadId: thread.id,
        perPage: 2,
        page: 2,
      });

      expect(page3.messages).toHaveLength(1);
      expect(page3.total).toBe(5);
      expect(page3.hasMore).toBe(false);
    });

    it('should filter by resourceId', async () => {
      // Add a message with different resourceId to the same thread
      const differentResourceMessage = createSampleMessageV2({
        threadId: thread.id,
        resourceId: 'different-resource',
        content: { content: 'Different Resource' },
        createdAt: new Date(),
      });
      await storage.saveMessages({ messages: [differentResourceMessage] });

      const result = await storage.listMessages({
        threadId: thread.id,
        resourceId: thread.resourceId,
      });

      expect(result.total).toBe(5);
      expect(result.messages.every(m => m.resourceId === thread.resourceId)).toBe(true);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const dateThread = createSampleThread();
      await storage.saveThread({ thread: dateThread });

      const dateMessages = [
        createSampleMessageV2({
          threadId: dateThread.id,
          content: { content: 'Old Message' },
          createdAt: twoDaysAgo,
        }),
        createSampleMessageV2({
          threadId: dateThread.id,
          content: { content: 'Yesterday Message' },
          createdAt: yesterday,
        }),
        createSampleMessageV2({
          threadId: dateThread.id,
          content: { content: 'Recent Message' },
          createdAt: now,
        }),
      ];

      await storage.saveMessages({ messages: dateMessages });

      const result = await storage.listMessages({
        threadId: dateThread.id,
        filter: {
          dateRange: { start: yesterday },
        },
      });

      expect(result.total).toBe(2);
      expect(result.messages.every(m => new Date(m.createdAt) >= yesterday)).toBe(true);
    });

    it('should include specific messages with previous context', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[2]!.id, // Message 3
            withPreviousMessages: 2,
          },
        ],
      });

      // Default pagination applies (perPage: 40), so we get all 5 messages from thread
      // No duplicates since Message 1, 2, 3 are already in the paginated set
      expect(result.messages).toHaveLength(5);
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 1');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 2');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 3');
    });

    it('should include specific messages with next context', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[1]!.id, // Message 2
            withNextMessages: 2,
          },
        ],
      });

      // Default pagination applies (perPage: 40), so we get all 5 messages from thread
      // No duplicates since Message 2, 3, 4 are already in the paginated set
      expect(result.messages).toHaveLength(5);
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 2');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 3');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 4');
    });

    it('should include specific messages with both previous and next context', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[2]!.id, // Message 3
            withPreviousMessages: 1,
            withNextMessages: 1,
          },
        ],
      });

      // Default pagination applies (perPage: 40), so we get all 5 messages from thread
      // No duplicates since Message 2, 3, 4 are already in the paginated set
      expect(result.messages).toHaveLength(5);
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 2');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 3');
      expect(result.messages.map((m: any) => m.content.content)).toContain('Message 4');
    });

    it('should include multiple messages from different threads', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[1]!.id, // Message 2 from thread 1
            threadId: thread.id,
            withPreviousMessages: 1,
          },
          {
            id: messages[5]!.id, // Thread2 Message 1
            threadId: thread2.id,
          },
        ],
      });

      // Default pagination gets all 5 from thread.id + 1 from thread2.id
      expect(result.messages).toHaveLength(6);
      expect(result.messages.filter(m => m.threadId === thread.id)).toHaveLength(5);
      expect(result.messages.some(m => m.threadId === thread2.id)).toBe(true);
    });

    it('should deduplicate messages when include has overlapping context', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[1]!.id, // Message 2
            withNextMessages: 2,
          },
          {
            id: messages[2]!.id, // Message 3 (overlaps with previous)
            withNextMessages: 1,
          },
        ],
      });

      // Default pagination gets all 5 messages, include overlaps are deduplicated
      expect(result.messages).toHaveLength(5);
      const contents = result.messages.map((m: any) => m.content.content);
      expect(contents).toContain('Message 2');
      expect(contents).toContain('Message 3');
      expect(contents).toContain('Message 4');
    });

    it('should sort messages by createdAt ASC by default', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
      });

      const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should sort messages by createdAt ASC when explicitly specified', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should sort messages by createdAt DESC when specified', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });

      const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should handle empty thread', async () => {
      const emptyThread = createSampleThread();
      await storage.saveThread({ thread: emptyThread });

      const result = await storage.listMessages({
        threadId: emptyThread.id,
      });

      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle non-existent message in include', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: 'non-existent-id',
            withPreviousMessages: 1,
            withNextMessages: 1,
          },
        ],
      });

      // Should still return paginated messages even if the included message doesn't exist
      expect(result.messages).toHaveLength(5);
    });

    it('should throw when neither threadId nor resourceId is provided', async () => {
      // Empty threadId without resourceId should throw
      await expect(storage.listMessages({ threadId: '' })).rejects.toThrowError(
        'Either threadId or resourceId must be provided',
      );

      // Whitespace-only threadId without resourceId should throw
      await expect(storage.listMessages({ threadId: '   ' })).rejects.toThrowError(
        'Either threadId or resourceId must be provided',
      );
    });

    it('should respect pagination when using include', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[0]!.id,
            withNextMessages: 10, // Request more than available
          },
        ],
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: 3,
        page: 0,
      });

      // Pagination gets first 3 (1,2,3) + include adds remaining (4,5)
      expect(result.messages).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it('should default to format v2', async () => {
      const result = await storage.listMessages({
        threadId: thread.id,
      });

      expect(result.messages.every(MessageList.isMastraDBMessage)).toBe(true);
    });

    it('should handle include with threadId parameter', async () => {
      // This tests cross-thread message inclusion
      const result = await storage.listMessages({
        threadId: thread.id,
        include: [
          {
            id: messages[5]!.id, // Message from thread2
            threadId: thread2.id,
          },
        ],
      });

      // Should get paginated messages from thread.id (5) + included from thread2 (1)
      expect(result.messages).toHaveLength(6);
      expect(result.messages.some(m => m.threadId === thread2.id)).toBe(true);
      expect(result.messages.filter(m => m.threadId === thread.id)).toHaveLength(5);
    });

    it('should handle pagination with date range', async () => {
      const dateThread = createSampleThread();
      await storage.saveThread({ thread: dateThread });

      const now = new Date();
      const dateMessages = Array.from({ length: 10 }, (_, i) =>
        createSampleMessageV2({
          threadId: dateThread.id,
          content: { content: `Message ${i + 1}` },
          createdAt: new Date(now.getTime() + i * 1000),
        }),
      );

      await storage.saveMessages({ messages: dateMessages });

      // Get messages from the last 5 seconds, paginated
      const cutoffDate = new Date(now.getTime() + 5000);
      const result = await storage.listMessages({
        threadId: dateThread.id,
        perPage: 3,
        page: 0,
        filter: {
          dateRange: { start: cutoffDate },
        },
      });

      expect(result.messages).toHaveLength(3);
      expect(result.total).toBe(5); // Messages 6-10
      expect(result.messages.every(m => new Date(m.createdAt) >= cutoffDate)).toBe(true);
    });

    describe('perPage and page parameters', () => {
      it('should use perPage to restrict number of messages returned', async () => {
        const result = await storage.listMessages({
          threadId: thread.id,
          perPage: 3,
        });

        expect(result.messages).toHaveLength(3);
        expect(result.total).toBe(5);
        expect(result.page).toBe(0);
        expect(result.perPage).toBe(3);
        expect(result.hasMore).toBe(true);
      });

      it('should return ALL messages when perPage is false', async () => {
        // Create more messages to test the "get all" functionality
        const manyMessages = Array.from({ length: 50 }, (_, i) =>
          createSampleMessageV2({
            threadId: thread.id,
            resourceId: thread.resourceId,
            content: { content: `Extra Message ${i + 1}` },
            createdAt: new Date(Date.now() + 10000 + i * 1000),
          }),
        );
        await storage.saveMessages({ messages: manyMessages });

        const result = await storage.listMessages({
          threadId: thread.id,
          perPage: false,
        });

        expect(result.messages).toHaveLength(55); // 5 original + 50 extra
        expect(result.total).toBe(55);
        expect(result.hasMore).toBe(false);
        expect(result.perPage).toBe(false); // Should preserve false when input is false
      });

      it('should use page to skip messages', async () => {
        const result = await storage.listMessages({
          threadId: thread.id,
          perPage: 2,
          page: 1, // Skip first page (first 2 messages)
        });

        expect(result.messages).toHaveLength(2);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(true);
      });

      it('should handle page with perPage for pagination', async () => {
        // Page 0 (messages 0-1)
        const page0 = await storage.listMessages({ threadId: thread.id, perPage: 2, page: 0 });
        expect(page0.messages).toHaveLength(2);
        expect(page0.hasMore).toBe(true);

        // Page 1 (messages 2-3)
        const page1 = await storage.listMessages({ threadId: thread.id, perPage: 2, page: 1 });
        expect(page1.messages).toHaveLength(2);
        expect(page1.hasMore).toBe(true);

        // Page 2 (message 4)
        const page2 = await storage.listMessages({ threadId: thread.id, perPage: 2, page: 2 });
        expect(page2.messages).toHaveLength(1);
        expect(page2.hasMore).toBe(false);
      });

      it('should work with perPage and include parameter', async () => {
        const result = await storage.listMessages({
          threadId: thread.id,
          perPage: 2,
          orderBy: { field: 'createdAt', direction: 'ASC' },
          include: [
            {
              id: messages[2]!.id, // Message 3
              withPreviousMessages: 1,
            },
          ],
        });

        // Should get first 2 from pagination (Message 1, 2) + included Message 3 (Message 2 already in paginated set)
        expect(result.messages).toHaveLength(3);
        expect(result.messages.map((m: any) => m.content.content)).toEqual(['Message 1', 'Message 2', 'Message 3']);
      });

      it('should work with perPage and date range', async () => {
        const dateThread = createSampleThread();
        await storage.saveThread({ thread: dateThread });

        const now = new Date();
        const dateMessages = Array.from({ length: 10 }, (_, i) =>
          createSampleMessageV2({
            threadId: dateThread.id,
            content: { content: `Date Message ${i + 1}` },
            createdAt: new Date(now.getTime() + i * 1000),
          }),
        );
        await storage.saveMessages({ messages: dateMessages });

        const cutoffDate = new Date(now.getTime() + 4000);
        const result = await storage.listMessages({
          threadId: dateThread.id,
          perPage: 3,
          filter: {
            dateRange: { start: cutoffDate },
          },
        });

        // Should filter to messages 5-10 (6 messages), then limit to first 3
        expect(result.messages).toHaveLength(3);
        expect(result.total).toBe(6); // 6 messages pass the date filter
        expect(result.messages.every(m => new Date(m.createdAt) >= cutoffDate)).toBe(true);
      });

      it('should handle perPage with resourceId filter', async () => {
        // Add messages with different resourceId
        const otherMessages = Array.from({ length: 3 }, (_, i) =>
          createSampleMessageV2({
            threadId: thread.id,
            resourceId: 'other-resource',
            content: { content: `Other ${i + 1}` },
            createdAt: new Date(Date.now() + 20000 + i * 1000),
          }),
        );

        await storage.saveMessages({ messages: otherMessages });

        const result = await storage.listMessages({
          threadId: thread.id,
          resourceId: thread.resourceId,
          perPage: 3,
        });

        expect(result.messages).toHaveLength(3);
        expect(result.messages.every(m => m.resourceId === thread.resourceId)).toBe(true);
      });

      it('should handle invalid perPage values gracefully', async () => {
        // Test perPage: 0 - should return zero results
        const result0 = await storage.listMessages({
          threadId: thread.id,
          perPage: 0,
        });
        expect(result0.messages).toHaveLength(0);
        expect(result0.total).toBe(5); // Total should still reflect actual count
        expect(result0.perPage).toBe(0);

        // Test negative perPage - should fall back to default behavior (40)
        const resultNeg = await storage.listMessages({
          threadId: thread.id,
          perPage: -5,
        });
        // Should fall back to default perPage (40) and return all 5 available messages
        expect(resultNeg.messages).toHaveLength(5);
        expect(resultNeg.perPage).toBe(40); // Verify fallback to default value
      });
    });

    describe('listMessages by resourceId only (without threadId)', () => {
      it('should list all messages for a resource across multiple threads', async () => {
        // thread and thread2 are already created in beforeEach with different resourceIds
        // Create a third thread with the same resourceId as thread
        const thread3 = createSampleThread();
        thread3.resourceId = thread.resourceId; // Same resource as thread
        await storage.saveThread({ thread: thread3 });

        // Add messages to thread3
        const thread3Messages = [
          createSampleMessageV2({
            threadId: thread3.id,
            resourceId: thread.resourceId,
            content: { content: 'Thread3 Message 1' },
            createdAt: new Date(Date.now() + 10000),
          }),
          createSampleMessageV2({
            threadId: thread3.id,
            resourceId: thread.resourceId,
            content: { content: 'Thread3 Message 2' },
            createdAt: new Date(Date.now() + 11000),
          }),
        ];
        await storage.saveMessages({ messages: thread3Messages });

        // Query by resourceId only - should get messages from thread AND thread3
        const result = await storage.listMessages({
          resourceId: thread.resourceId,
          perPage: false,
        });

        // thread has 5 messages, thread3 has 2 messages = 7 total
        expect(result.messages).toHaveLength(7);
        expect(result.messages.every(m => m.resourceId === thread.resourceId)).toBe(true);

        // Verify we got messages from both threads
        const threadIds = new Set(result.messages.map(m => m.threadId));
        expect(threadIds.has(thread.id)).toBe(true);
        expect(threadIds.has(thread3.id)).toBe(true);
      });

      it('should filter by dateRange.start when querying by resourceId', async () => {
        // Create a thread with specific timestamps
        const resourceThread = createSampleThread();
        await storage.saveThread({ thread: resourceThread });

        const now = Date.now();
        const cutoffTime = new Date(now + 3000);

        const resourceMessages = [
          createSampleMessageV2({
            threadId: resourceThread.id,
            resourceId: resourceThread.resourceId,
            content: { content: 'Old Message 1' },
            createdAt: new Date(now + 1000),
          }),
          createSampleMessageV2({
            threadId: resourceThread.id,
            resourceId: resourceThread.resourceId,
            content: { content: 'Old Message 2' },
            createdAt: new Date(now + 2000),
          }),
          createSampleMessageV2({
            threadId: resourceThread.id,
            resourceId: resourceThread.resourceId,
            content: { content: 'New Message 1' },
            createdAt: new Date(now + 4000),
          }),
          createSampleMessageV2({
            threadId: resourceThread.id,
            resourceId: resourceThread.resourceId,
            content: { content: 'New Message 2' },
            createdAt: new Date(now + 5000),
          }),
        ];
        await storage.saveMessages({ messages: resourceMessages });

        // Query by resourceId with dateRange.start (cursor-based loading)
        const result = await storage.listMessages({
          resourceId: resourceThread.resourceId,
          filter: {
            dateRange: { start: cutoffTime },
          },
          perPage: false,
        });

        // Should only get messages after the cutoff
        expect(result.messages).toHaveLength(2);
        expect(result.messages.every(m => new Date(m.createdAt) >= cutoffTime)).toBe(true);
        expect(result.messages.map((m: any) => m.content.content)).toEqual(
          expect.arrayContaining(['New Message 1', 'New Message 2']),
        );
      });

      it('should filter by dateRange.start across multiple threads for the same resource', async () => {
        // Create two threads with the same resourceId
        const sharedResourceId = `shared-resource-${Date.now()}`;
        const threadA = createSampleThread();
        threadA.resourceId = sharedResourceId;
        const threadB = createSampleThread();
        threadB.resourceId = sharedResourceId;
        await storage.saveThread({ thread: threadA });
        await storage.saveThread({ thread: threadB });

        const now = Date.now();
        const cutoffTime = new Date(now + 3000);

        // Messages in threadA
        const threadAMessages = [
          createSampleMessageV2({
            threadId: threadA.id,
            resourceId: sharedResourceId,
            content: { content: 'ThreadA Old' },
            createdAt: new Date(now + 1000),
          }),
          createSampleMessageV2({
            threadId: threadA.id,
            resourceId: sharedResourceId,
            content: { content: 'ThreadA New' },
            createdAt: new Date(now + 4000),
          }),
        ];

        // Messages in threadB
        const threadBMessages = [
          createSampleMessageV2({
            threadId: threadB.id,
            resourceId: sharedResourceId,
            content: { content: 'ThreadB Old' },
            createdAt: new Date(now + 2000),
          }),
          createSampleMessageV2({
            threadId: threadB.id,
            resourceId: sharedResourceId,
            content: { content: 'ThreadB New' },
            createdAt: new Date(now + 5000),
          }),
        ];

        await storage.saveMessages({ messages: [...threadAMessages, ...threadBMessages] });

        // Query by resourceId with dateRange.start
        const result = await storage.listMessages({
          resourceId: sharedResourceId,
          filter: {
            dateRange: { start: cutoffTime },
          },
          perPage: false,
        });

        // Should get new messages from both threads
        expect(result.messages).toHaveLength(2);
        expect(result.messages.every(m => new Date(m.createdAt) >= cutoffTime)).toBe(true);

        // Verify we got messages from both threads
        const threadIds = new Set(result.messages.map(m => m.threadId));
        expect(threadIds.has(threadA.id)).toBe(true);
        expect(threadIds.has(threadB.id)).toBe(true);
      });

      it('should return empty array when no messages match resourceId', async () => {
        const result = await storage.listMessages({
          resourceId: 'non-existent-resource',
          perPage: false,
        });

        expect(result.messages).toHaveLength(0);
        expect(result.total).toBe(0);
      });

      it('should isolate messages by resourceId', async () => {
        // thread and thread2 have different resourceIds
        // Query for thread's resourceId should not include thread2's messages
        const result = await storage.listMessages({
          resourceId: thread.resourceId,
          perPage: false,
        });

        // Should only get thread's 5 messages, not thread2's message
        expect(result.messages).toHaveLength(5);
        expect(result.messages.every(m => m.resourceId === thread.resourceId)).toBe(true);
        expect(result.messages.every(m => m.threadId === thread.id)).toBe(true);
      });

      it('should support pagination when querying by resourceId', async () => {
        const result = await storage.listMessages({
          resourceId: thread.resourceId,
          perPage: 2,
          page: 0,
        });

        expect(result.messages).toHaveLength(2);
        expect(result.total).toBe(5);
        expect(result.hasMore).toBe(true);
        expect(result.page).toBe(0);
        expect(result.perPage).toBe(2);
      });
    });

    describe('include parameter with separate batch saves', () => {
      it('should sort messages by createdAt when include adds messages saved in different batches', async () => {
        const testThread = createSampleThread();
        await storage.saveThread({ thread: testThread });

        const now = Date.now();

        // Save first batch: messages 1, 2, 3 (chronologically oldest)
        const batch1 = [
          createSampleMessageV2({
            threadId: testThread.id,
            resourceId: testThread.resourceId,
            role: 'user',
            content: { content: 'User message 1' },
            createdAt: new Date(now + 1000),
          }),
          createSampleMessageV2({
            threadId: testThread.id,
            resourceId: testThread.resourceId,
            role: 'assistant',
            content: { content: 'Assistant message 1' },
            createdAt: new Date(now + 2000),
          }),
          createSampleMessageV2({
            threadId: testThread.id,
            resourceId: testThread.resourceId,
            role: 'user',
            content: { content: 'User message 2' },
            createdAt: new Date(now + 3000),
          }),
        ];
        await storage.saveMessages({ messages: batch1 });

        // Save second batch: messages 4, 5 (chronologically newer)
        const batch2 = [
          createSampleMessageV2({
            threadId: testThread.id,
            resourceId: testThread.resourceId,
            role: 'assistant',
            content: { content: 'Assistant message 2' },
            createdAt: new Date(now + 4000),
          }),
          createSampleMessageV2({
            threadId: testThread.id,
            resourceId: testThread.resourceId,
            role: 'user',
            content: { content: 'User message 3' },
            createdAt: new Date(now + 5000),
          }),
        ];
        await storage.saveMessages({ messages: batch2 });

        // Now retrieve with pagination (only get latest 2) and include an older message
        // This simulates what semantic recall does
        const result = await storage.listMessages({
          threadId: testThread.id,
          perPage: 2,
          page: 0,
          // Default orderBy (not specified) - should default to createdAt ASC
          include: [
            {
              id: batch1[0]!.id, // Include oldest user message
              withNextMessages: 1, // Also get the assistant response after it
            },
          ],
        });

        // Should have: paginated (2) + included (2, but 1 might overlap)
        // The key assertion: messages MUST be sorted by createdAt ASC
        const contents = result.messages.map((m: any) => m.content.content);
        const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);

        // Messages should be in chronological order
        expect(timestamps).toEqual(sortedTimestamps);

        // Verify we got the expected messages
        expect(contents).toContain('User message 1');
        expect(contents).toContain('Assistant message 1');
      });

      it('should maintain chronological order when include brings in messages from a different thread', async () => {
        // Create two threads
        const mainThread = createSampleThread();
        const otherThread = createSampleThread();
        await storage.saveThread({ thread: mainThread });
        await storage.saveThread({ thread: otherThread });

        const now = Date.now();

        // Save messages to main thread
        const mainMessages = [
          createSampleMessageV2({
            threadId: mainThread.id,
            resourceId: mainThread.resourceId,
            role: 'user',
            content: { content: 'Main thread user 1' },
            createdAt: new Date(now + 1000),
          }),
          createSampleMessageV2({
            threadId: mainThread.id,
            resourceId: mainThread.resourceId,
            role: 'assistant',
            content: { content: 'Main thread assistant 1' },
            createdAt: new Date(now + 3000),
          }),
          createSampleMessageV2({
            threadId: mainThread.id,
            resourceId: mainThread.resourceId,
            role: 'user',
            content: { content: 'Main thread user 2' },
            createdAt: new Date(now + 5000),
          }),
        ];
        await storage.saveMessages({ messages: mainMessages });

        // Save messages to other thread (some with timestamps between main thread messages)
        const otherMessages = [
          createSampleMessageV2({
            threadId: otherThread.id,
            resourceId: otherThread.resourceId,
            role: 'user',
            content: { content: 'Other thread user' },
            createdAt: new Date(now + 2000), // Between main thread messages 1 and 2
          }),
          createSampleMessageV2({
            threadId: otherThread.id,
            resourceId: otherThread.resourceId,
            role: 'assistant',
            content: { content: 'Other thread assistant' },
            createdAt: new Date(now + 4000), // Between main thread messages 2 and 3
          }),
        ];
        await storage.saveMessages({ messages: otherMessages });

        // Retrieve from main thread, but include a message from other thread
        const result = await storage.listMessages({
          threadId: mainThread.id,
          include: [
            {
              id: otherMessages[0]!.id,
              threadId: otherThread.id,
            },
          ],
        });

        // All messages should be sorted by createdAt
        const timestamps = result.messages.map(m => new Date(m.createdAt).getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        expect(timestamps).toEqual(sortedTimestamps);

        // The other thread message should be interleaved correctly by timestamp
        const contents = result.messages.map((m: any) => m.content.content);
        expect(contents).toContain('Other thread user');
      });
    });
  });
}
