import { MastraStorage } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('UpstashStore', () => {
  let store: UpstashStore;
  const testTableName = 'test_table';
  const testTableName2 = 'test_table2';

  beforeAll(async () => {
    console.log('Initializing UpstashStore...');

    await new Promise(resolve => setTimeout(resolve, 5000));
    store = new UpstashStore({
      url: 'http://localhost:8079',
      token: 'test_token',
    });

    await store.init();
    console.log('UpstashStore initialized');
  });

  afterAll(async () => {
    // Clean up test tables
    await store.clearTable({ tableName: testTableName });
    await store.clearTable({ tableName: testTableName2 });
    await store.clearTable({ tableName: MastraStorage.TABLE_THREADS });
    await store.clearTable({ tableName: MastraStorage.TABLE_MESSAGES });
  });

  describe('Table Operations', () => {
    it('should create a new table with schema', async () => {
      await store.createTable({
        tableName: testTableName,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Verify table exists by inserting and retrieving data
      await store.insert({
        tableName: testTableName,
        record: { id: 'test1', data: 'test-data' },
      });

      const result = await store.load({ tableName: testTableName, keys: { id: 'test1' } });
      expect(result).toBeTruthy();
    });

    it('should handle multiple table creation', async () => {
      await store.createTable({
        tableName: testTableName2,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Verify both tables work independently
      await store.insert({
        tableName: testTableName2,
        record: { id: 'test2', data: 'test-data-2' },
      });

      const result = await store.load({ tableName: testTableName2, keys: { id: 'test2' } });
      expect(result).toBeTruthy();
    });
  });

  describe('Thread Operations', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: MastraStorage.TABLE_THREADS });
    });

    it('should create and retrieve a thread', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now,
        updatedAt: now,
        metadata: { key: 'value' },
      };

      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toEqual({
        ...thread,
        createdAt: new Date(now.toISOString()),
        updatedAt: new Date(now.toISOString()),
      });
    });

    it('should return null for non-existent thread', async () => {
      const result = await store.getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const resourceId = 'resource-1';
      const threads = [
        {
          id: 'thread-1',
          resourceId,
          title: 'Thread 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
        {
          id: 'thread-2',
          resourceId,
          title: 'Thread 2',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      await Promise.all(threads.map(thread => store.saveThread({ thread })));

      const retrievedThreads = await store.getThreadsByResourceId({ resourceId });
      expect(retrievedThreads).toHaveLength(2);
      expect(retrievedThreads.map(t => t.id)).toEqual(expect.arrayContaining(['thread-1', 'thread-2']));
    });

    it('should update thread metadata', async () => {
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { initial: 'value' },
      };

      await store.saveThread({ thread });

      const updatedThread = await store.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: { updated: 'value' },
      });

      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({
        initial: 'value',
        updated: 'value',
      });
    });
  });

  describe('Date Handling', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: MastraStorage.TABLE_THREADS });
    });

    it('should handle Date objects in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      };

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle ISO string dates in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-2',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        metadata: {},
      };

      await store.saveThread({ thread: thread as any });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle mixed date formats in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-3',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now,
        updatedAt: now.toISOString(),
        metadata: {},
      };

      await store.saveThread({ thread: thread as any });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle date serialization in getThreadsByResourceId', async () => {
      const now = new Date();
      const threads = [
        {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'Thread 1',
          createdAt: now,
          updatedAt: now.toISOString(),
          metadata: {},
        },
        {
          id: 'thread-2',
          resourceId: 'resource-1',
          title: 'Thread 2',
          createdAt: now.toISOString(),
          updatedAt: now,
          metadata: {},
        },
      ];

      await Promise.all(threads.map(thread => store.saveThread({ thread: thread as any })));

      const retrievedThreads = await store.getThreadsByResourceId({ resourceId: 'resource-1' });
      expect(retrievedThreads).toHaveLength(2);
      retrievedThreads.forEach(thread => {
        expect(thread.createdAt).toBeInstanceOf(Date);
        expect(thread.updatedAt).toBeInstanceOf(Date);
        expect(thread.createdAt.toISOString()).toBe(now.toISOString());
        expect(thread.updatedAt.toISOString()).toBe(now.toISOString());
      });
    });
  });

  describe('Message Operations', () => {
    const threadId = 'test-thread';

    beforeEach(async () => {
      await store.clearTable({ tableName: MastraStorage.TABLE_MESSAGES });
      await store.clearTable({ tableName: MastraStorage.TABLE_THREADS });

      // Create a test thread
      await store.saveThread({
        thread: {
          id: threadId,
          resourceId: 'resource-1',
          title: 'Test Thread',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });
    });

    it('should save and retrieve messages in order', async () => {
      const messages = [
        {
          id: 'msg-1',
          threadId,
          role: 'user',
          type: 'text',
          content: [{ type: 'text', text: 'First' }],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          threadId,
          role: 'assistant',
          type: 'text',
          content: [{ type: 'text', text: 'Second' }],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-3',
          threadId,
          role: 'user',
          type: 'text',
          content: [{ type: 'text', text: 'Third' }],
          createdAt: new Date().toISOString(),
        },
      ];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId });
      expect(retrievedMessages).toHaveLength(3);
      expect(retrievedMessages.map(m => m.content[0].text)).toEqual(['First', 'Second', 'Third']);
    });

    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should handle messages with complex content', async () => {
      const messages = [
        {
          id: 'msg-1',
          threadId,
          role: 'user',
          type: 'text',
          content: [
            { type: 'text', text: 'Message with' },
            { type: 'code', text: 'code block', language: 'typescript' },
            { type: 'text', text: 'and more text' },
          ],
          createdAt: new Date().toISOString(),
        },
      ];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId });
      expect(retrievedMessages[0].content).toEqual(messages[0].content);
    });
  });

  describe('Workflow Operations', () => {
    const testNamespace = 'test';
    const testWorkflow = 'test-workflow';
    const testRunId = 'test-run';

    beforeEach(async () => {
      await store.clearTable({ tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should persist and load workflow snapshots', async () => {
      const mockSnapshot = {
        value: { step1: 'completed' },
        context: {
          stepResults: {
            step1: { status: 'success', payload: { result: 'done' } },
          },
          attempts: {},
          triggerData: {},
        },
        runId: testRunId,
        activePaths: [],
        timestamp: Date.now(),
      };

      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: testWorkflow,
        runId: testRunId,
        snapshot: mockSnapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: testWorkflow,
        runId: testRunId,
      });

      expect(loadedSnapshot).toEqual(mockSnapshot);
    });

    it('should return null for non-existent snapshot', async () => {
      const result = await store.loadWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: 'non-existent',
        runId: 'non-existent',
      });
      expect(result).toBeNull();
    });
  });
});
