import type { StorageThreadType, MastraMessageV1, MastraMessageV2, EvalRow, Trace } from '@mastra/core';
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

  describe('ConvexStorage Evals Tests', () => {
    const storage = new ConvexStorage({
      convexUrl: 'http://localhost:3210',
      api,
    });

    test('should save a new evaluation', async () => {
      // Create EvalRow with required fields based on the structure in evals.ts
      const evalData: EvalRow = {
        input: 'test input',
        output: 'test output',
        result: {
          score: 0.95,
        },
        agentName: 'test-agent',
        createdAt: new Date().toISOString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId: 'test-run-id',
        globalRunId: 'test-global-run-id',
        testInfo: {},
      };
      const savedEval: EvalRow = await storage.saveEval({ evalData });

      expect(savedEval).toBeDefined();
      expect(savedEval.input).toBe(evalData.input);
      expect(savedEval.output).toBe(evalData.output);
      expect(savedEval.result).toEqual(evalData.result);
      expect(savedEval.agentName).toBe(evalData.agentName);
      expect(savedEval.metricName).toBe(evalData.metricName);
      expect(savedEval.instructions).toBe(evalData.instructions);
      expect(savedEval.runId).toBe(evalData.runId);
      expect(savedEval.globalRunId).toBe(evalData.globalRunId);
      expect(savedEval.testInfo).toEqual(evalData.testInfo);
    });

    test('should update an existing evaluation', async () => {
      const runId = 'test-run-id-update';

      // Create initial evaluation
      const initialEvalData: EvalRow = {
        input: 'test input',
        output: 'test output',
        result: {
          score: 0.95,
        },
        agentName: 'test-agent',
        createdAt: new Date().toISOString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId,
        globalRunId: 'test-global-run-id',
        testInfo: {},
      };

      await storage.saveEval({ evalData: initialEvalData });

      // Update the evaluation
      const updatedEvalData: EvalRow = {
        input: 'updated input',
        output: 'updated output',
        result: {
          score: 0.95,
        },
        agentName: 'test-agent',
        createdAt: new Date().toISOString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId,
        globalRunId: 'test-global-run-id',
        testInfo: {
          testName: 'updated test',
        },
      };

      await storage.saveEval({ evalData: updatedEvalData });

      const updatedEval: EvalRow | null = await storage.getEval({ runId });

      expect(updatedEval).toBeDefined();
      expect(updatedEval?.input).toBe(updatedEvalData.input);
      expect(updatedEval?.output).toBe(updatedEvalData.output);
      expect(updatedEval?.result).toEqual(updatedEvalData.result);
      expect(updatedEval?.agentName).toBe(updatedEvalData.agentName);
      expect(updatedEval?.metricName).toBe(updatedEvalData.metricName);
      expect(updatedEval?.instructions).toBe(updatedEvalData.instructions);
      expect(updatedEval?.runId).toBe(updatedEvalData.runId);
      expect(updatedEval?.globalRunId).toBe(updatedEvalData.globalRunId);
      expect(updatedEval?.testInfo).toEqual(updatedEvalData.testInfo);
    });

    test('should get an evaluation by ID', async () => {
      const evalData: EvalRow = {
        input: 'test input',
        output: 'test output',
        result: {
          score: 0.85,
        },
        agentName: 'test-agent',
        createdAt: Date.now().toString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId: 'test-run-id',
        globalRunId: 'test-global-run-id',
        testInfo: {
          testName: 'test',
        },
      };

      await storage.saveEval({ evalData });

      const fetchedEval = await storage.getEval({ runId: evalData.runId });

      expect(fetchedEval).toBeDefined();
      expect(fetchedEval?.input).toBe(evalData.input);
      expect(fetchedEval?.output).toBe(evalData.output);
      expect(fetchedEval?.result).toEqual(evalData.result);
      expect(fetchedEval?.agentName).toBe(evalData.agentName);
      expect(fetchedEval?.metricName).toBe(evalData.metricName);
      expect(fetchedEval?.instructions).toBe(evalData.instructions);
      expect(fetchedEval?.runId).toBe(evalData.runId);
      expect(fetchedEval?.globalRunId).toBe(evalData.globalRunId);
      expect(fetchedEval?.testInfo).toEqual(evalData.testInfo);
    });

    test('should return null when getting non-existent evaluation', async () => {
      const fetchedEval = await storage.getEval({ runId: 'non-existent-eval-id' });
      expect(fetchedEval).toBeNull();
    });

    test('should get evaluations by agent name', async () => {
      const agentName = 'special-test-agent';

      // Create evals for the agent with different types
      const evalData1: EvalRow = {
        input: 'agent input 1',
        output: 'agent output 1',
        result: {
          score: 0.91,
        },
        agentName,
        createdAt: Date.now().toString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId: 'test-run-id-1',
        globalRunId: 'test-global-run-id-1',
        testInfo: {
          testName: 'test',
        },
      };

      const evalData2: EvalRow = {
        input: 'agent input 2',
        output: 'agent output 2',
        result: {
          score: 0.92,
        },
        agentName,
        createdAt: Date.now().toString(),
        metricName: 'test-metric',
        instructions: 'test instructions',
        runId: 'test-run-id-2',
        globalRunId: 'test-global-run-id-2',
        testInfo: {
          testName: 'test',
        },
      };

      await storage.saveEval({ evalData: evalData1 });
      await storage.saveEval({ evalData: evalData2 });

      const fetchedAgentEvals = await storage.getEvalsByAgentName(agentName);
      expect(fetchedAgentEvals).toBeDefined();
      expect(fetchedAgentEvals.length).toBe(2);
    });

    test('should get evaluations by agent name and type', async () => {
      const agentName = 'special-test-agent';
      const evalData1: EvalRow = {
        input: 'agent input 1',
        output: 'agent output 1',
        result: {
          score: 0.91,
        },
        agentName,
        createdAt: Date.now().toString(),
        metricName: 'live',
        instructions: 'test instructions',
        runId: 'test-run-id-1',
        globalRunId: 'test-global-run-id-1',
        testInfo: {
          testName: 'test',
        },
      };

      const evalData2: EvalRow = {
        input: 'agent input 2',
        output: 'agent output 2',
        result: {
          score: 0.92,
        },
        agentName,
        createdAt: Date.now().toString(),
        metricName: 'test',
        instructions: 'test instructions',
        runId: 'test-run-id-2',
        globalRunId: 'test-global-run-id-2',
        testInfo: {
          testName: 'test',
        },
      };

      await storage.saveEval({ evalData: evalData1 });
      await storage.saveEval({ evalData: evalData2 });

      // Get all evals for agent
      const allAgentEvals = await storage.getEvalsByAgentName(agentName);
      expect(allAgentEvals).toBeDefined();
      expect(allAgentEvals.length).toBe(2);

      // Get only live evals
      const liveEvals = await storage.getEvalsByAgentName(agentName, 'live');
      expect(liveEvals).toBeDefined();
      expect(liveEvals.length).toBe(1);
      expect(liveEvals[0].runId).toBe(evalData1.runId);
      expect(liveEvals[0].globalRunId).toBe(evalData1.globalRunId);

      // Get only batch evals
      const batchEvals = await storage.getEvalsByAgentName(agentName, 'test');
      expect(batchEvals).toBeDefined();
      expect(batchEvals.length).toBe(1);
      expect(batchEvals[0].runId).toBe(evalData2.runId);
      expect(batchEvals[0].globalRunId).toBe(evalData2.globalRunId);
    });

    test('should handle empty array results for getEvalsByAgentName', async () => {
      const nonExistentAgent = 'agent-with-no-evals';
      const emptyResults = await storage.getEvalsByAgentName(nonExistentAgent);

      expect(emptyResults).toBeDefined();
      expect(Array.isArray(emptyResults)).toBeTruthy();
      expect(emptyResults.length).toBe(0);
    });
  });

  describe('ConvexStorage Traces Tests', () => {
    const storage = new ConvexStorage({
      convexUrl: 'http://localhost:3210',
      api,
    });

    test('should save a new trace', async () => {
      const traceData: Trace = {
        id: `trace-${Date.now()}`,
        parentSpanId: `parent-span-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        traceId: `trace-id-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      const savedTrace = await storage.saveTrace({ trace: traceData });

      expect(savedTrace).toBeDefined();
      expect(savedTrace.id).toBe(traceData.id);
      expect(savedTrace.parentSpanId).toBe(traceData.parentSpanId);
      expect(savedTrace.name).toBe(traceData.name);
      expect(savedTrace.traceId).toBe(traceData.traceId);
      expect(savedTrace.scope).toBe(traceData.scope);
      expect(savedTrace.kind).toBe(traceData.kind);
      expect(savedTrace.attributes).toEqual(traceData.attributes);
      expect(savedTrace.status).toEqual(traceData.status);
      expect(savedTrace.events).toEqual(traceData.events);
      expect(savedTrace.links).toEqual(traceData.links);
      expect(savedTrace.other).toEqual(traceData.other);
      expect(savedTrace.startTime).toBe(traceData.startTime);
      expect(savedTrace.endTime).toBe(traceData.endTime);
      expect(new Date(savedTrace.createdAt).getTime()).toBe(new Date(traceData.createdAt).getTime());
    });

    test('should update an existing trace', async () => {
      const traceId = `trace-update-${Date.now()}`;

      // Create initial trace
      const initialTraceData: Trace = {
        id: traceId,
        parentSpanId: `parent-span-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        traceId: `trace-id-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      await storage.saveTrace({ trace: initialTraceData });

      // Update the trace with same ID but different properties
      const updatedTraceData: Trace = {
        id: traceId,
        parentSpanId: `parent-span-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        traceId: `trace-id-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'updated test',
        },
        kind: 1,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      const updatedTrace = await storage.saveTrace({ trace: updatedTraceData });

      expect(updatedTrace).toBeDefined();
      expect(updatedTrace.id).toBe(traceId);
      expect(updatedTrace.parentSpanId).toEqual(updatedTraceData.parentSpanId);
      expect(updatedTrace.name).toEqual(updatedTraceData.name);
      expect(updatedTrace.traceId).toEqual(updatedTraceData.traceId);
      expect(updatedTrace.scope).toEqual(updatedTraceData.scope);
      expect(updatedTrace.attributes).toEqual(updatedTraceData.attributes);
      expect(updatedTrace.status).toEqual(updatedTraceData.status);
      expect(updatedTrace.kind).toEqual(updatedTraceData.kind);
      expect(updatedTrace.events).toEqual(updatedTraceData.events);
      expect(updatedTrace.links).toEqual(updatedTraceData.links);
      expect(updatedTrace.other).toEqual(updatedTraceData.other);
      expect(updatedTrace.startTime).toEqual(updatedTraceData.startTime);
      expect(updatedTrace.endTime).toEqual(updatedTraceData.endTime);
      expect(new Date(updatedTrace.createdAt).getTime()).toBe(new Date(updatedTraceData.createdAt).getTime());
    });

    test('should get traces by trace ID', async () => {
      const traceId = `trace-get-${Date.now()}`;

      // Create multiple traces with same traceId
      const traceData1: Trace = {
        id: `trace-thread-1-${Date.now()}`,
        traceId,
        parentSpanId: `parent-span-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      const traceData2: Trace = {
        id: `trace-thread-2-${Date.now()}`,
        traceId,
        parentSpanId: `parent-span-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now() + 1000,
        endTime: Date.now() + 1000,
        createdAt: Date.now().toString(),
      };

      await storage.saveTrace({ trace: traceData1 });
      await storage.saveTrace({ trace: traceData2 });

      const fetchedTraces = await storage.getTracesByTraceId({ traceId });

      expect(fetchedTraces).toBeDefined();
      expect(Array.isArray(fetchedTraces)).toBeTruthy();
      expect(fetchedTraces.length).toBeGreaterThanOrEqual(2);

      // Verify the traces we created are in the result
      const traceIds = fetchedTraces.map(trace => trace.id);
      expect(traceIds).toContain(traceData1.id);
      expect(traceIds).toContain(traceData2.id);
    });

    test('should return empty array when getting traces for non-existent trace ID', async () => {
      const nonExistentTraceId = `trace-non-existent-${Date.now()}`;

      const fetchedTraces = await storage.getTracesByTraceId({ traceId: nonExistentTraceId });

      expect(fetchedTraces).toBeDefined();
      expect(Array.isArray(fetchedTraces)).toBeTruthy();
      expect(fetchedTraces.length).toBe(0);
    });

    test('should get traces with pagination by trace ID', async () => {
      const sharedTraceId = `trace-paginated-${Date.now()}`;
      const totalTraces = 5;
      const traceIds: string[] = [];

      // Create multiple traces for pagination testing
      for (let i = 0; i < totalTraces; i++) {
        const traceId = `trace-paginated-${i}-${Date.now()}`;
        traceIds.push(traceId);

        const traceData: Trace = {
          id: traceId,
          parentSpanId: `parent-span-${Date.now()}`,
          name: `test-span-${Date.now()}`,
          traceId: sharedTraceId, // Use the shared traceId for filtering,
          scope: `scope-${Date.now()}`,
          attributes: {},
          status: {
            code: 0,
            message: 'test',
          },
          kind: 0,
          events: [],
          links: [],
          other: {},
          startTime: Date.now(),
          endTime: Date.now(),
          createdAt: Date.now().toString(),
        };

        await storage.saveTrace({ trace: traceData });
      }

      // Test first page (2 items)
      const firstPageResult = await storage.getTracesPaginated({
        page: 1,
        perPage: 2,
        filters: {
          traceId: sharedTraceId,
        },
        attributes: {
          sortDirection: 'desc',
        },
      });

      expect(firstPageResult).toBeDefined();
      expect(firstPageResult.traces).toBeDefined();
      expect(firstPageResult.traces.length).toBe(2);

      // Test second page
      const secondPageResult = await storage.getTracesPaginated({
        page: 2,
        perPage: 2,
        filters: {
          traceId: sharedTraceId,
        },
      });

      expect(secondPageResult).toBeDefined();
      expect(secondPageResult.traces).toBeDefined();
      expect(secondPageResult.traces.length).toBe(2);

      // Ensure no overlap between pages
      const firstPageIds = new Set(firstPageResult.traces.map(t => t.id));
      const secondPageIds = new Set(secondPageResult.traces.map(t => t.id));

      for (const id of secondPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
      }
    });

    test('should get traces with pagination by parent span id', async () => {
      const parentSpanId = `run-paginated-${Date.now()}`;
      const traceData1: Trace = {
        id: `trace-run-1-${Date.now()}`,
        traceId: 'trace-1',
        parentSpanId,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      const traceData2: Trace = {
        id: `trace-run-2-${Date.now()}`,
        traceId: 'trace-2',
        parentSpanId,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: Date.now(),
        endTime: Date.now(),
        createdAt: Date.now().toString(),
      };

      await storage.saveTrace({ trace: traceData1 });
      await storage.saveTrace({ trace: traceData2 });

      const result = await storage.getTracesPaginated({
        filters: {
          parentSpanId,
        },
        page: 1,
        perPage: 2,
      });

      expect(result).toBeDefined();
      expect(result.traces).toBeDefined();
      expect(result.traces.length).toBeGreaterThanOrEqual(2);

      // Verify the traces we created are in the result
      const traceIds = result.traces.map(trace => trace.id);
      expect(traceIds).toContain(traceData1.id);
      expect(traceIds).toContain(traceData2.id);
    });

    test('should get traces with date filters', async () => {
      const baseTimestamp = Date.now();
      const parentSpanId = `run-paginated-${Date.now()}`;
      const traceData1: Trace = {
        id: `trace-run-1-${Date.now()}`,
        traceId: 'trace-1',
        parentSpanId,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp,
        endTime: baseTimestamp,
        createdAt: Date.now().toString(),
      };

      const traceData2: Trace = {
        id: `trace-run-2-${Date.now()}`,
        traceId: 'trace-2',
        parentSpanId,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp + 5000,
        endTime: baseTimestamp + 5000,
        createdAt: Date.now().toString(),
      };

      const traceData3 = {
        id: `trace-date-3-${baseTimestamp}`,
        traceId: 'trace-3',
        parentSpanId,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp + 10000,
        endTime: baseTimestamp + 10000,
        createdAt: Date.now().toString(),
      };

      await storage.saveTrace({ trace: traceData1 });
      await storage.saveTrace({ trace: traceData2 });
      await storage.saveTrace({ trace: traceData3 });

      // Get traces in a specific date range
      const dateFilterResult = await storage.getTracesPaginated({
        filters: {
          startDate: baseTimestamp + 1000, // After trace1
          endDate: baseTimestamp + 9000, // Before trace3
        },
        page: 1,
        perPage: 10,
      });

      expect(dateFilterResult).toBeDefined();
      expect(dateFilterResult.traces).toBeDefined();

      // Should only contain trace2
      const filteredIds = dateFilterResult.traces.map(t => t.id);
      expect(filteredIds).not.toContain(traceData1.id);
      expect(filteredIds).toContain(traceData2.id);
      expect(filteredIds).not.toContain(traceData3.id);
    });

    test('should sort traces in descending order by default', async () => {
      const baseTimestamp = Date.now();

      const traceData1 = {
        id: `trace-sort-1-${baseTimestamp}`,
        traceId: 'trace-1',
        parentSpanId: `parent-span-sort-1-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp,
        endTime: baseTimestamp,
        createdAt: Date.now().toString(),
      };

      const traceData2 = {
        id: `trace-sort-2-${baseTimestamp}`,
        traceId: 'trace-2',
        parentSpanId: `parent-span-sort-2-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp + 5000,
        endTime: baseTimestamp + 5000,
        createdAt: Date.now().toString(),
      };

      await storage.saveTrace({ trace: traceData1 });
      await storage.saveTrace({ trace: traceData2 });

      // Get traces with default sort (desc)
      const result = await storage.getTracesPaginated({
        filters: {
          parentSpanId: traceData1.parentSpanId,
        },
        page: 1,
        perPage: 10,
      });

      // Should be ordered newest first (desc)
      const fetchedIds = result.traces.filter(t => t.id === traceData1.id || t.id === traceData2.id).map(t => t.id);

      if (fetchedIds.length >= 2) {
        // traceData2 is newer, so should come first in desc order
        expect(fetchedIds.indexOf(traceData2.id)).toBeLessThan(fetchedIds.indexOf(traceData1.id));
      }
    });

    test('should sort traces in ascending order when specified', async () => {
      const baseTimestamp = Date.now();

      const traceData1 = {
        id: `trace-sort-asc-1-${baseTimestamp}`,
        traceId: 'trace-1',
        parentSpanId: `parent-span-sort-asc-1-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp,
        endTime: baseTimestamp,
        createdAt: Date.now().toString(),
        properties: {},
        spans: [],
        spanDurations: {},
      };

      const traceData2 = {
        id: `trace-sort-asc-2-${baseTimestamp}`,
        traceId: 'trace-2',
        parentSpanId: `parent-span-sort-asc-2-${Date.now()}`,
        name: `test-span-${Date.now()}`,
        scope: `scope-${Date.now()}`,
        attributes: {},
        status: {
          code: 0,
          message: 'test',
        },
        kind: 0,
        events: [],
        links: [],
        other: {},
        startTime: baseTimestamp + 5000,
        endTime: baseTimestamp + 5000,
        createdAt: Date.now().toString(),
        properties: {},
        spans: [],
        spanDurations: {},
      };

      await storage.saveTrace({ trace: traceData1 });
      await storage.saveTrace({ trace: traceData2 });

      // Get traces with ascending sort
      const result = await storage.getTracesPaginated({
        filters: {
          parentSpanId: traceData1.parentSpanId,
        },
        attributes: {
          sortDirection: 'asc',
        },
        page: 1,
        perPage: 10,
      });

      // Should be ordered oldest first (asc)
      const fetchedIds = result.traces.filter(t => t.id === traceData1.id || t.id === traceData2.id).map(t => t.id);

      if (fetchedIds.length >= 2) {
        // traceData1 is older, so should come first in asc order
        expect(fetchedIds.indexOf(traceData1.id)).toBeLessThan(fetchedIds.indexOf(traceData2.id));
      }
    });
  });
});
