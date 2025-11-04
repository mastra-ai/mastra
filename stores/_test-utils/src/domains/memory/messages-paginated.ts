import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleMessageV2 } from './data';
import { resetRole, createSampleThread } from './data';
import { MastraStorage } from '@mastra/core/storage';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MessageList } from '@mastra/core/agent';

export function createListMessagesTest({ storage }: { storage: MastraStorage }) {
  describe('listMessages', () => {
    it('should return paginated messages with total count', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });
      // Reset role to 'assistant' before creating messages
      resetRole();
      // Create messages sequentially to ensure unique timestamps
      for (let i = 0; i < 15; i++) {
        const message = createSampleMessageV2({ threadId: thread.id, content: { content: `Message ${i + 1}` } });
        await storage.saveMessages({
          messages: [message],
        });
        await new Promise(r => setTimeout(r, 5));
      }

      const page1 = await storage.listMessages({
        threadId: thread.id,
        perPage: 5,
        page: 0,
      });
      expect(page1.messages).toHaveLength(5);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(5);
      expect(page1.hasMore).toBe(true);

      const page2 = await storage.listMessages({
        threadId: thread.id,
        perPage: 5,
        page: 1,
      });
      expect(page2.messages).toHaveLength(5);
      expect(page2.total).toBe(15);
      expect(page2.hasMore).toBe(true);
    });

    it('should filter by date with pagination', async () => {
      resetRole();
      const threadData = createSampleThread();
      const thread = await storage.saveThread({ thread: threadData as StorageThreadType });
      const now = new Date();
      const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      );
      const dayBeforeYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 2,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      );

      // Ensure timestamps are distinct for reliable sorting by creating them with a slight delay for testing clarity
      const messagesToSave: MastraDBMessage[] = [];
      messagesToSave.push(
        createSampleMessageV2({
          threadId: thread.id,
          createdAt: dayBeforeYesterday,
          content: { content: 'Message 1' },
        }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV2({
          threadId: thread.id,
          createdAt: dayBeforeYesterday,
          content: { content: 'Message 2' },
        }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV2({ threadId: thread.id, createdAt: yesterday, content: { content: 'Message 3' } }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV2({ threadId: thread.id, createdAt: yesterday, content: { content: 'Message 4' } }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV2({ threadId: thread.id, createdAt: now, content: { content: 'Message 5' } }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV2({ threadId: thread.id, createdAt: now, content: { content: 'Message 6' } }),
      );

      await storage.saveMessages({ messages: messagesToSave });
      // Total 6 messages: 2 now, 2 yesterday, 2 dayBeforeYesterday (oldest to newest)

      const fromYesterday = await storage.listMessages({
        threadId: thread.id,
        perPage: 3,
        page: 0,
        filter: {
          dateRange: { start: yesterday },
        },
      });
      expect(fromYesterday.total).toBe(4);
      expect(fromYesterday.messages).toHaveLength(3);
      const firstMessage = fromYesterday.messages[0];
      expect(firstMessage).toBeDefined();
      const firstMessageTime = new Date(firstMessage!.createdAt).getTime();
      expect(firstMessageTime).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime());
      // All messages should be >= yesterday (could be from today or yesterday)
      fromYesterday.messages.forEach(msg => {
        expect(new Date(msg.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime());
      });
    });

    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [
        createSampleMessageV2({ threadId: thread.id, content: { content: 'Message 1' } }),
        createSampleMessageV2({ threadId: thread.id, content: { content: 'Message 2' } }),
      ];

      // Save messages
      const { messages: savedMessages } = await storage.saveMessages({ messages });

      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await storage.listMessages({ threadId: thread.id });

      expect(retrievedMessages.messages).toHaveLength(2);

      expect(retrievedMessages.messages).toEqual(
        expect.arrayContaining(messages.map(msg => expect.objectContaining(msg))),
      );
    });

    it('should handle empty message array', async () => {
      const { messages: result } = await storage.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'First' },
          createdAt: new Date(Date.now() + 1),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Second' },
          createdAt: new Date(Date.now() + 2),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Third' },
          createdAt: new Date(Date.now() + 3),
        }),
      ];

      await storage.saveMessages({ messages });

      const { messages: retrievedMessages } = await storage.listMessages({ threadId: thread.id });

      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content.content).toBe(messages[idx]?.content.content);
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [
        createSampleMessageV2({ threadId: thread.id, content: { content: 'Message 1' } }),
        { ...createSampleMessageV2({ threadId: thread.id, content: { content: 'Message 2' } }), resourceId: null }, // This will cause an error
      ] as MastraDBMessage[];

      await expect(storage.saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await storage.listMessages({ threadId: thread.id });
      expect(savedMessages.messages).toHaveLength(0);
    });

    it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const thread2 = createSampleThread();
      await storage.saveThread({ thread: thread2 });

      const thread3 = createSampleThread();
      await storage.saveThread({ thread: thread3 });

      const messages: MastraDBMessage[] = [
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'First', parts: [{ type: 'text', text: 'First' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 1),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Second', parts: [{ type: 'text', text: 'Second' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 2),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Third', parts: [{ type: 'text', text: 'Third' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 3),
        }),

        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'Fourth', parts: [{ type: 'text', text: 'Fourth' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 4),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'Fifth', parts: [{ type: 'text', text: 'Fifth' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 5),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'Sixth', parts: [{ type: 'text', text: 'Sixth' }] },
          resourceId: 'cross-thread-resource',
          createdAt: new Date(Date.now() + 6),
        }),

        createSampleMessageV2({
          threadId: thread3.id,
          content: { content: 'Seventh', parts: [{ type: 'text', text: 'Seventh' }] },
          resourceId: 'other-resource',
          createdAt: new Date(Date.now() + 7),
        }),
        createSampleMessageV2({
          threadId: thread3.id,
          content: { content: 'Eighth', parts: [{ type: 'text', text: 'Eighth' }] },
          resourceId: 'other-resource',
          createdAt: new Date(Date.now() + 8),
        }),
      ];

      await storage.saveMessages({ messages: messages });

      const { messages: retrievedMessages } = await storage.listMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);
      const contentParts = retrievedMessages.map((m: MastraDBMessage) => m.content.content);
      expect(contentParts).toEqual(['First', 'Second', 'Third']);

      const { messages: retrievedMessages2 } = await storage.listMessages({ threadId: thread2.id });
      expect(retrievedMessages2).toHaveLength(3);
      const contentParts2 = retrievedMessages2.map((m: MastraDBMessage) => m.content.content);
      expect(contentParts2).toEqual(['Fourth', 'Fifth', 'Sixth']);

      const { messages: retrievedMessages3 } = await storage.listMessages({ threadId: thread3.id });
      expect(retrievedMessages3).toHaveLength(2);
      const contentParts3 = retrievedMessages3.map((m: MastraDBMessage) => m.content.content);
      expect(contentParts3).toEqual(['Seventh', 'Eighth']);

      const { messages: crossThreadMessages } = await storage.listMessages({
        threadId: thread.id,
        perPage: 0,
        include: [
          {
            id: messages[1]!.id,
            threadId: thread.id,
            withNextMessages: 2,
            withPreviousMessages: 2,
          },
          {
            id: messages[4]!.id,
            threadId: thread2.id,
            withPreviousMessages: 2,
            withNextMessages: 2,
          },
        ],
      });

      expect(crossThreadMessages).toHaveLength(6);
      expect(crossThreadMessages.filter(m => m.threadId === thread.id)).toHaveLength(3);
      expect(crossThreadMessages.filter(m => m.threadId === thread2.id)).toHaveLength(3);

      const { messages: crossThreadMessages2 } = await storage.listMessages({
        threadId: thread.id,
        perPage: 0,
        include: [
          {
            id: messages[4]!.id,
            threadId: thread2.id,
            withPreviousMessages: 1,
            withNextMessages: 30,
          },
        ],
      });

      expect(crossThreadMessages2).toHaveLength(3);
      expect(crossThreadMessages2.filter(m => m.threadId === thread.id)).toHaveLength(0);
      expect(crossThreadMessages2.filter(m => m.threadId === thread2.id)).toHaveLength(3);

      const { messages: crossThreadMessages3 } = await storage.listMessages({
        threadId: thread2.id,
        perPage: 0,
        include: [
          {
            id: messages[1]!.id,
            threadId: thread.id,
            withNextMessages: 1,
            withPreviousMessages: 1,
          },
        ],
      });

      expect(crossThreadMessages3).toHaveLength(3);
      expect(crossThreadMessages3.filter(m => m.threadId === thread.id)).toHaveLength(3);
      expect(crossThreadMessages3.filter(m => m.threadId === thread2.id)).toHaveLength(0);
    });

    it('should return messages using both last and include (cross-thread, deduped)', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const thread2 = createSampleThread();
      await storage.saveThread({ thread: thread2 });

      const now = new Date();

      // Setup: create messages in two threads
      const messages = [
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'A' },
          createdAt: new Date(now.getTime()),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'B' },
          createdAt: new Date(now.getTime() + 1000),
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'C' },
          createdAt: new Date(now.getTime() + 2000),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'D' },
          createdAt: new Date(now.getTime() + 3000),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'E' },
          createdAt: new Date(now.getTime() + 4000),
        }),
        createSampleMessageV2({
          threadId: thread2.id,
          content: { content: 'F' },
          createdAt: new Date(now.getTime() + 5000),
        }),
      ];
      await storage.saveMessages({ messages });

      // Include a message from another thread with context
      const { messages: result } = await storage.listMessages({
        threadId: thread.id,
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'DESC' },
        include: [
          {
            id: messages[4]!.id, // 'E' from thread-bar
            threadId: thread2.id,
            withPreviousMessages: 1,
            withNextMessages: 1,
          },
        ],
      });

      // Should include last 2 from thread-one (B, C) and 3 from thread-two (D, E, F via include)
      expect(result.map((m: any) => m.content.content).sort()).toEqual(['B', 'C', 'D', 'E', 'F']);
      // Should include last 2 from thread-one
      expect(
        result
          .filter((m: any) => m.threadId === thread.id)
          .map((m: any) => m.content.content)
          .sort(),
      ).toEqual(['B', 'C']);
      // Should include 3 from thread-two
      expect(
        result
          .filter((m: any) => m.threadId === thread2.id)
          .map((m: any) => m.content.content)
          .sort(),
      ).toEqual(['D', 'E', 'F']);
    });

    it('should upsert messages: duplicate id and different threadid', async () => {
      const thread1 = createSampleThread();
      const thread2 = createSampleThread();

      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      const message = createSampleMessageV2({
        threadId: thread1.id,
        createdAt: new Date(),
        content: { content: 'Thread1 Content' },
        resourceId: thread1.resourceId,
      });

      // Insert message into thread1
      await storage.saveMessages({ messages: [message] });

      // Attempt to insert a message with the same id but different threadId
      const conflictingMessage = {
        ...createSampleMessageV2({
          threadId: thread2.id, // different thread
          content: { content: 'Thread2 Content' },
          resourceId: thread2.resourceId,
        }),
        id: message.id,
      };

      // Save should move the message to the new thread
      await storage.saveMessages({ messages: [conflictingMessage] });

      // Retrieve messages for both threads
      const { messages: thread1Messages } = await storage.listMessages({ threadId: thread1.id });
      const { messages: thread2Messages } = await storage.listMessages({ threadId: thread2.id });

      // Thread 1 should NOT have the message with that id
      expect(thread1Messages.find(m => m.id === message.id)).toBeUndefined();

      // Thread 2 should have the message with that id
      expect(thread2Messages.find(m => m.id === message.id)?.content.content).toBe('Thread2 Content');
    });

    it('should update thread timestamp when saving messages', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const initialThread = await storage.getThreadById({ threadId: thread.id });
      const initialUpdatedAt = new Date(initialThread!.updatedAt);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const messages = [
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Message 1' },
          resourceId: thread.resourceId,
        }),
        createSampleMessageV2({
          threadId: thread.id,
          content: { content: 'Message 2' },
          resourceId: thread.resourceId,
        }),
      ];
      await storage.saveMessages({ messages });

      // Verify thread updatedAt timestamp was updated
      const updatedThread = await storage.getThreadById({ threadId: thread.id });
      const newUpdatedAt = new Date(updatedThread!.updatedAt);
      expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should upsert messages: duplicate id+threadId results in update, not duplicate row', async () => {
      const thread = await createSampleThread();
      await storage.saveThread({ thread });
      const baseMessage = createSampleMessageV2({
        threadId: thread.id,
        createdAt: new Date(),
        content: { content: 'Original' },
        resourceId: thread.resourceId,
      });

      // Insert the message for the first time
      await storage.saveMessages({ messages: [baseMessage] });

      // Insert again with the same id and threadId but different content
      const updatedMessage = {
        ...createSampleMessageV2({
          threadId: thread.id,
          createdAt: new Date(),
          content: { content: 'Updated' },
          resourceId: thread.resourceId,
        }),
        id: baseMessage.id,
      };

      await storage.saveMessages({ messages: [updatedMessage] });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Retrieve messages for the thread
      const { messages: retrievedMessages } = await storage.listMessages({ threadId: thread.id });

      // Only one message should exist for that id+threadId
      expect(retrievedMessages.filter(m => m.id === baseMessage.id)).toHaveLength(1);

      // The content should be the updated one
      expect(retrievedMessages.find(m => m.id === baseMessage.id)?.content.content).toBe('Updated');
    });

    it('should throw error if threadId is an empty string or whitespace only', async () => {
      await expect(storage.listMessages({ threadId: '' })).rejects.toThrow('threadId must be a non-empty string');

      await expect(storage.listMessages({ threadId: '   ' })).rejects.toThrow('threadId must be a non-empty string');
    });
  });

  describe('listMessagesById', () => {
    const resourceId = 'test-resource-id';
    const resourceId2 = 'test-resource-id-2';
    let threads: StorageThreadType[] = [];
    let thread1Messages: MastraDBMessage[] = [];
    let thread2Messages: MastraDBMessage[] = [];
    let resource2Messages: MastraDBMessage[] = [];

    beforeEach(async () => {
      // Create test threads with different dates
      threads = [
        {
          id: 'thread-1',
          resourceId,
          title: 'Thread 1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-03T10:00:00Z'),
          metadata: {},
        },
        {
          id: 'thread-2',
          resourceId,
          title: 'Thread 2',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:00:00Z'),
          metadata: {},
        },
        {
          id: 'thread-3',
          resourceId: resourceId2,
          title: 'Thread 3',
          createdAt: new Date('2024-01-03T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          metadata: {},
        },
      ];

      // Save threads to storage
      for (const thread of threads) {
        await storage.saveThread({ thread });
      }

      thread1Messages = [
        createSampleMessageV2({
          threadId: threads[0]!.id,
          resourceId,
          content: {
            content: 'Message 1',
          },
        }),
        createSampleMessageV2({
          threadId: threads[0]!.id,
          resourceId,
          content: {
            content: 'Message 2',
          },
        }),
      ];

      thread2Messages = [
        createSampleMessageV2({
          threadId: threads[1]!.id,
          resourceId,
          content: {
            content: 'Message A',
          },
        }),
        createSampleMessageV2({
          threadId: threads[1]!.id,
          resourceId,
          content: {
            content: 'Message B',
          },
        }),
      ];

      resource2Messages = [
        createSampleMessageV2({
          threadId: threads[2]!.id,
          resourceId: resourceId2,
          content: {
            content: 'The quick brown fox jumps over the lazy dog',
          },
        }),
      ];

      await storage.saveMessages({ messages: thread1Messages });
      await storage.saveMessages({ messages: thread2Messages });
      await storage.saveMessages({ messages: resource2Messages });
    });

    it('should return an empty array if no message IDs are provided', async () => {
      const { messages } = await storage.listMessagesById({ messageIds: [] });
      expect(messages).toHaveLength(0);
    });

    it('should return messages sorted by createdAt DESC', async () => {
      const messageIds = [
        thread1Messages[1]!.id,
        thread2Messages[0]!.id,
        resource2Messages[0]!.id,
        thread1Messages[0]!.id,
        thread2Messages[1]!.id,
      ];
      const { messages } = await storage.listMessagesById({
        messageIds,
      });

      expect(messages).toHaveLength(thread1Messages.length + thread2Messages.length + resource2Messages.length);
      expect(messages.every((msg, i, arr) => i === 0 || msg.createdAt >= arr[i - 1]!.createdAt)).toBe(true);
    });

    it('should return V2 messages', async () => {
      const { messages } = await storage.listMessagesById({
        messageIds: thread1Messages.map(msg => msg.id),
      });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every(MessageList.isMastraDBMessage)).toBe(true);
    });

    it('should return messages in MastraDBMessage format', async () => {
      const { messages: v2messages } = await storage.listMessagesById({
        messageIds: thread1Messages.map(msg => msg.id),
      });

      expect(v2messages.length).toBeGreaterThan(0);
      expect(v2messages.every(MessageList.isMastraDBMessage)).toBe(true);
    });

    it('should return messages from multiple threads', async () => {
      const { messages } = await storage.listMessagesById({
        messageIds: [...thread1Messages.map(msg => msg.id), ...thread2Messages.map(msg => msg.id)],
      });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some(msg => msg.threadId === threads[0]?.id)).toBe(true);
      expect(messages.some(msg => msg.threadId === threads[1]?.id)).toBe(true);
    });

    it('should return messages from multiple resources', async () => {
      const { messages } = await storage.listMessagesById({
        messageIds: [...thread1Messages.map(msg => msg.id), ...resource2Messages.map(msg => msg.id)],
      });

      expect(messages).toHaveLength(thread1Messages.length + resource2Messages.length);
      expect(messages.some(msg => msg.resourceId === threads[0]?.resourceId)).toBe(true);
      expect(messages.some(msg => msg.resourceId === threads[2]?.resourceId)).toBe(true);
    });
  });
}
