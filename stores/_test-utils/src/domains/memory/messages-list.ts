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

    it('should throw when threadId is empty or whitespace', async () => {
      await expect(storage.listMessages({ threadId: '' })).rejects.toThrowError('threadId must be a non-empty string');

      await expect(storage.listMessages({ threadId: '   ' })).rejects.toThrowError(
        'threadId must be a non-empty string',
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
  });
}
