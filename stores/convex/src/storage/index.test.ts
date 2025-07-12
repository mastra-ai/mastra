import type { StorageThreadType, MastraMessageV1, MastraMessageV2 } from '@mastra/core';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import { describe, test, expect, afterAll } from 'vitest';
import { api } from '../../convex/_generated/api';
import { ConvexStorage } from './index';

describe('ConvexStorage Tests', () => {
  // Initialize ConvexStorage with local Convex instance, run local Convex server before running tests by using running 'docker compose up' and then 'npx convex dev' to start the server
  const storage = new ConvexStorage({
    convexUrl: 'http://localhost:3210',
    api,
  });

  afterAll(async () => {
    await storage.dropAllTables();
  });

  describe('Table Operations', () => {
    test('should create a table without errors', async () => {
      const tableName = 'tests' as unknown as TABLE_NAMES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'text', primaryKey: true },
        name: { type: 'text', nullable: false },
        createdAt: { type: 'timestamp', nullable: false },
      };

      expect(async () => {
        await storage.createTable({ tableName, schema });
      }).not.toThrow();
    });

    test('should clear a table without errors', async () => {
      const tableName = 'messages' as unknown as TABLE_NAMES;

      expect(async () => {
        await storage.clearTable({ tableName });
      }).not.toThrow();
    });

    test('should alter table schema without errors', async () => {
      const tableName = 'threads' as unknown as TABLE_NAMES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'text', primaryKey: true },
        title: { type: 'text', nullable: false },
        metadata: { type: 'jsonb', nullable: true },
      };
      const ifNotExists = ['metadata'];

      expect(async () => {
        await storage.alterTable({ tableName, schema, ifNotExists });
      }).not.toThrow();
    });

    test('should handle errors when creating invalid table', async () => {
      // In Convex implementation, createTable is essentially a no-op that calls ensureTables
      // This test verifies the error handling behavior

      // Create a storage instance with invalid URL to force an error
      const invalidStorage = new ConvexStorage({
        convexUrl: 'http://invalid-url:3210',
        api,
      });

      expect(async () => {
        await invalidStorage.createTable({
          tableName: 'invalid_table' as unknown as TABLE_NAMES,
          schema: {},
        });
      }).rejects.toThrow();
    });
  });

  describe('ConvexStorage Thread Tests', () => {
    test('should save a new thread', async () => {
      const thread: StorageThreadType = {
        id: 'test-thread-id-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { testKey: 'testValue' },
        resourceId: 'test-resource-id',
      };

      const savedThread = await storage.saveThread({ thread });

      expect(savedThread).toBeDefined();
      expect(savedThread.id).toBe(thread.id);
      expect(savedThread.title).toBe(thread.title);
      expect(savedThread.resourceId).toBe(thread.resourceId);
      expect(savedThread.metadata).toEqual(thread.metadata);
    });

    test('should get a thread by id', async () => {
      const thread: StorageThreadType = {
        id: 'test-thread-id-2',
        title: 'Test Get Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { testKey: 'testValue' },
        resourceId: 'test-resource-id',
      };
      await storage.saveThread({ thread });

      const retrievedThread = await storage.getThreadById({ threadId: thread.id });

      expect(retrievedThread).not.toBeNull();
      expect(retrievedThread?.id).toBe(thread.id);
      expect(retrievedThread?.title).toBe(thread.title);
    });

    test('should return null when getting non-existent thread', async () => {
      const retrievedThread = await storage.getThreadById({ threadId: 'non-existent-id' });

      expect(retrievedThread).toBeNull();
    });

    test('should get threads by resource id', async () => {
      const resourceId = 'shared-resource-id';
      const thread1: StorageThreadType = {
        id: 'test-thread-id-3',
        title: 'Test Thread 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { testKey: 'testValue1' },
        resourceId,
      };
      const thread2: StorageThreadType = {
        id: 'test-thread-id-4',
        title: 'Test Thread 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { testKey: 'testValue2' },
        resourceId,
      };
      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      const threads = await storage.getThreadsByResourceId({ resourceId });

      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id).sort()).toEqual([thread1.id, thread2.id].sort());
    });

    test('should update a thread', async () => {
      const thread: StorageThreadType = {
        id: 'test-thread-id-5',
        title: 'Original Title',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { originalKey: 'originalValue' },
        resourceId: 'test-resource-id',
      };
      await storage.saveThread({ thread });

      const updatedThread = await storage.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: { updatedKey: 'updatedValue' },
      });

      expect(updatedThread).toBeDefined();
      expect(updatedThread.id).toBe(thread.id);
      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({ updatedKey: 'updatedValue' });

      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toBe('Updated Title');
      expect(retrievedThread?.metadata).toEqual({ updatedKey: 'updatedValue' });
    });

    test('should delete a thread', async () => {
      const thread: StorageThreadType = {
        id: 'test-thread-id-6',
        title: 'Thread To Delete',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { testKey: 'testValue' },
        resourceId: 'test-resource-id',
      };
      await storage.saveThread({ thread });

      const beforeDelete = await storage.getThreadById({ threadId: thread.id });
      expect(beforeDelete).not.toBeNull();

      await storage.deleteThread({ threadId: thread.id });

      const afterDelete = await storage.getThreadById({ threadId: thread.id });
      expect(afterDelete).toBeNull();
    });

    test('should save multiple threads and retrieve them correctly', async () => {
      const threads: StorageThreadType[] = [
        {
          id: 'multi-thread-id-1',
          title: 'Multi Thread 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { index: 1 },
          resourceId: 'multi-resource-id',
        },
        {
          id: 'multi-thread-id-2',
          title: 'Multi Thread 2',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { index: 2 },
          resourceId: 'multi-resource-id',
        },
        {
          id: 'multi-thread-id-3',
          title: 'Multi Thread 3',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { index: 3 },
          resourceId: 'another-resource-id',
        },
      ];

      for (const thread of threads) {
        await storage.saveThread({ thread });
      }
      const resourceThreads = await storage.getThreadsByResourceId({ resourceId: 'multi-resource-id' });
      expect(resourceThreads).toHaveLength(2);

      const anotherResourceThreads = await storage.getThreadsByResourceId({ resourceId: 'another-resource-id' });
      expect(anotherResourceThreads).toHaveLength(1);
      expect(anotherResourceThreads[0].id).toBe('multi-thread-id-3');

      for (const thread of threads) {
        const retrievedThread = await storage.getThreadById({ threadId: thread.id });
        expect(retrievedThread).not.toBeNull();
        expect(retrievedThread?.title).toBe(thread.title);
        expect(retrievedThread?.metadata).toEqual(thread.metadata);
      }
    });

    test('should get threads by resource id with pagination', async () => {
      const paginationResourceId = 'pagination-resource-id';
      // Create 5 threads for testing pagination
      const paginationThreads: StorageThreadType[] = [];

      for (let i = 1; i <= 5; i++) {
        const thread: StorageThreadType = {
          id: `pagination-thread-id-${i}`,
          title: `Pagination Thread ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { index: i },
          resourceId: paginationResourceId,
        };
        await storage.saveThread({ thread });
        paginationThreads.push(thread);
      }

      // Test first page (2 items)
      const firstPage = await storage.getThreadsByResourceIdPaginated({
        resourceId: paginationResourceId,
        page: 1,
        perPage: 2,
      });

      expect(firstPage.threads).toHaveLength(2);
      expect(firstPage.total).toBe(5);
      expect(firstPage.page).toBe(1);
      expect(firstPage.perPage).toBe(2);
      expect(firstPage.hasMore).toBe(true);

      // Test second page (2 items)
      const secondPage = await storage.getThreadsByResourceIdPaginated({
        resourceId: paginationResourceId,
        page: 2,
        perPage: 2,
      });

      expect(secondPage.threads).toHaveLength(2);
      expect(secondPage.total).toBe(5);
      expect(secondPage.page).toBe(2);
      expect(secondPage.hasMore).toBe(true);

      // Test third page (1 item left)
      const thirdPage = await storage.getThreadsByResourceIdPaginated({
        resourceId: paginationResourceId,
        page: 3,
        perPage: 2,
      });

      expect(thirdPage.threads).toHaveLength(1);
      expect(thirdPage.total).toBe(5);
      expect(thirdPage.page).toBe(3);
      expect(thirdPage.hasMore).toBe(false);
    });
  });

  describe('ConvexStorage Message Tests', () => {
    const storage = new ConvexStorage({
      convexUrl: 'http://localhost:3210',
      api,
    });

    test('should save a new message', async () => {
      const content: MastraMessageContentV2 = {
        format: 2,
        parts: [
          {
            type: 'text',
            text: 'Hello, this is a test message',
          },
          {
            type: 'reasoning',
            reasoning: 'This is a reasoning part',
            details: [
              {
                type: 'text',
                text: 'Detailed reasoning explanation',
                signature: 'Assistant',
              },
            ],
          },
        ],
      };

      const message: MastraMessageV2 = {
        id: 'test-message-id-1',
        threadId: 'test-thread-id',
        content,
        role: 'user',
        createdAt: new Date(),
      };

      const savedMessage = await storage.saveMessage({ message });
      expect(savedMessage).not.toBeNull();
      expect(savedMessage.id).toBe(message.id);
      expect(savedMessage.threadId).toBe(message.threadId);
      expect(savedMessage.content.content).toStrictEqual(message.content.content);
      expect(savedMessage.role).toBe(message.role);
    });

    test('should get a message by id', async () => {
      const message: MastraMessageV2 = {
        id: 'test-message-id-2',
        threadId: 'test-thread-id',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Test message content for retrieval',
            },
          ],
        },
        role: 'user',
        createdAt: new Date(),
      };

      await storage.saveMessage({ message });

      const retrievedMessage = await storage.getMessage({ id: message.id });

      expect(retrievedMessage).not.toBeNull();
      expect(retrievedMessage?.id).toBe(message.id);
      expect(retrievedMessage?.threadId).toBe(message.threadId);
      expect(retrievedMessage?.content.content).toStrictEqual(message.content);
      expect(retrievedMessage?.role).toBe(message.role);
    });

    test('should return null when getting non-existent message', async () => {
      const retrievedMessage = await storage.getMessage({ id: 'non-existent-message-id' });
      expect(retrievedMessage).toBeNull();
    });

    test('should get messages by thread id using V2 format', async () => {
      const threadId = 'test-thread-id-for-messages';

      // Create multiple messages for the thread
      const messagesToSave: MastraMessageV2[] = [];
      for (let i = 1; i <= 3; i++) {
        messagesToSave.push({
          id: `thread-message-id-${i}`,
          threadId,
          content: {
            format: 2,
            parts: [
              {
                type: 'text',
                text: `Thread message ${i}`,
              },
            ],
          },
          role: i % 2 === 0 ? 'assistant' : 'user',
          createdAt: new Date(),
        });
      }

      // Save all messages
      await storage.saveMessages({ messages: messagesToSave, format: 'v2' });

      // Retrieve messages for this thread
      const retrievedMessages = await storage.getMessages({ threadId, format: 'v2' });
      expect(retrievedMessages).toHaveLength(messagesToSave.length);

      // Verify each message was retrieved correctly
      for (const message of messagesToSave) {
        const found = retrievedMessages.find(m => m.id === message.id);
        expect(found).toBeDefined();
        expect(found?.threadId).toBe(threadId);
        expect(found?.content).toStrictEqual(message.content);
        expect(found?.role).toBe(message.role);
      }
    });

    test('should get messages by thread id using V1 format', async () => {
      const threadId = 'test-thread-id-for-v1-messages';

      // Create messages in V1 format
      const v1MessagesToSave: MastraMessageV1[] = [];
      for (let i = 1; i <= 3; i++) {
        v1MessagesToSave.push({
          id: `v1-thread-message-id-${i}`,
          threadId,
          content: `V1 thread message ${i}`,
          role: i % 2 === 0 ? 'assistant' : 'user',
          createdAt: new Date(),
          type: 'text',
        });
      }

      // Save messages in V1 format
      await storage.saveMessages({ messages: v1MessagesToSave, format: 'v1' });

      // Retrieve messages in V1 format
      const retrievedMessages = await storage.getMessages({ threadId, format: 'v1' });
      expect(retrievedMessages).toHaveLength(v1MessagesToSave.length);

      // Verify each message was retrieved correctly with V1 format
      for (const message of v1MessagesToSave) {
        const found = retrievedMessages.find(m => m.id === message.id);
        expect(found).toBeDefined();
        expect(found?.threadId).toBe(threadId);
        expect(found?.content).toStrictEqual(message.content);
        expect(found?.role).toBe(message.role);
      }
    });

    test('should update messages', async () => {
      const threadId = 'test-thread-id-for-updates';

      // Create a message to update
      const messageToUpdate: MastraMessageV2 = {
        id: 'message-to-update-id',
        threadId,
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Original content',
            },
          ],
        },
        role: 'user',
        createdAt: new Date(),
      };

      await storage.saveMessage({ message: messageToUpdate });

      // Update the message
      const updatedContent: MastraMessageContentV2 = {
        format: 2,
        parts: [
          {
            type: 'text',
            text: 'Updated content',
          },
        ],
      };
      const updatedMessages = await storage.updateMessages({
        messages: [
          {
            id: messageToUpdate.id,
            content: updatedContent,
          },
        ],
      });

      expect(updatedMessages).toHaveLength(1);
      expect(updatedMessages[0].id).toBe(messageToUpdate.id);
      expect(updatedMessages[0].content).toEqual(updatedContent);

      // Verify the update by retrieving the message
      const retrievedMessage = await storage.getMessage({ id: messageToUpdate.id });
      expect(retrievedMessage).not.toBeNull();
      expect(retrievedMessage?.content.content).toEqual(updatedContent);
    });

    test('should save multiple messages with V2 format', async () => {
      const threadId = 'test-thread-id-for-batch-save-v2';

      // Create multiple messages
      const messagesToSave: MastraMessageV2[] = [];
      for (let i = 1; i <= 5; i++) {
        messagesToSave.push({
          id: `batch-v2-message-id-${i}`,
          threadId,
          content: {
            format: 2,
            parts: [
              {
                type: 'text',
                text: `Batch V2 message ${i}`,
              },
            ],
          },
          role: i % 2 === 0 ? 'assistant' : 'user',
          createdAt: new Date(),
        });
      }

      // Batch save messages
      const savedMessages = await storage.saveMessages({ messages: messagesToSave, format: 'v2' });
      expect(savedMessages).toHaveLength(messagesToSave.length);

      // Verify each message was saved with correct format
      for (let i = 0; i < messagesToSave.length; i++) {
        const original = messagesToSave[i];
        const saved = savedMessages[i];
        expect(saved.id).toBe(original.id);
        expect(saved.threadId).toBe(original.threadId);
        expect(saved.content.content).toStrictEqual(original.content.content);
        expect(saved.role).toBe(original.role);
      }
    });

    test('should save multiple messages with V1 format', async () => {
      const threadId = 'test-thread-id-for-batch-save-v1';

      // Create multiple messages in V1 format
      const messagesToSave: MastraMessageV1[] = [];
      for (let i = 1; i <= 5; i++) {
        messagesToSave.push({
          id: `batch-v1-message-id-${i}`,
          threadId,
          content: `Batch V1 message ${i}`,
          role: i % 2 === 0 ? 'assistant' : 'user',
          createdAt: new Date(),
          type: 'text',
        });
      }

      // Batch save messages
      const savedMessages = await storage.saveMessages({ messages: messagesToSave });
      expect(savedMessages).toHaveLength(messagesToSave.length);

      // Verify each message was saved with correct format
      for (let i = 0; i < messagesToSave.length; i++) {
        const original = messagesToSave[i];
        const saved = savedMessages[i];
        expect(saved.id).toBe(original.id);
        expect(saved.threadId).toBe(original.threadId);
        expect(saved.content).toBe(original.content);
        expect(saved.role).toBe(original.role);
      }
    });

    test('should get messages with pagination', async () => {
      const paginationThreadId = 'pagination-thread-id';

      // Create messages for testing pagination
      const paginationMessages: MastraMessageV2[] = [];
      for (let i = 1; i <= 8; i++) {
        paginationMessages.push({
          id: `pagination-message-id-${i}`,
          threadId: paginationThreadId,
          content: {
            format: 2,
            parts: [
              {
                type: 'text',
                text: `Pagination message ${i}`,
              },
            ],
          },
          role: i % 2 === 0 ? 'assistant' : 'user',
          createdAt: new Date(),
        });
      }

      // Save all pagination test messages
      await storage.saveMessages({ messages: paginationMessages, format: 'v2' });

      // Test first page (3 items per page)
      const firstPageResult = await storage.getMessagesPaginated({
        threadId: paginationThreadId,
        selectBy: {
          pagination: {
            page: 1,
            perPage: 3,
          },
        },
        format: 'v2',
      });

      expect(firstPageResult.messages).toHaveLength(3);
      expect(firstPageResult.total).toBe(paginationMessages.length);
      expect(firstPageResult.page).toBe(1);
      expect(firstPageResult.perPage).toBe(3);
      expect(firstPageResult.hasMore).toBe(true);

      // Test second page
      const secondPageResult = await storage.getMessagesPaginated({
        threadId: paginationThreadId,
        selectBy: {
          pagination: {
            page: 2,
            perPage: 3,
          },
        },
        format: 'v2',
      });

      expect(secondPageResult.messages).toHaveLength(3);
      expect(secondPageResult.page).toBe(2);
      expect(secondPageResult.hasMore).toBe(true);

      // Test last page
      const lastPageResult = await storage.getMessagesPaginated({
        threadId: paginationThreadId,
        selectBy: {
          pagination: {
            page: 3,
            perPage: 3,
          },
        },
        format: 'v2',
      });

      expect(lastPageResult.messages).toHaveLength(2); // Only 2 items left
      expect(lastPageResult.page).toBe(3);
      expect(lastPageResult.hasMore).toBe(false);

      // Check page contents are different
      const firstPageIds = new Set(firstPageResult.messages.map(m => m.id));
      const secondPageIds = new Set(secondPageResult.messages.map(m => m.id));
      const lastPageIds = new Set(lastPageResult.messages.map(m => m.id));

      // Ensure no overlap between pages
      for (const id of secondPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
      }

      for (const id of lastPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
        expect(secondPageIds.has(id)).toBe(false);
      }
    });
  });
});
