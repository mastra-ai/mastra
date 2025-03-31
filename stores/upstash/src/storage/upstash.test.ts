import { randomUUID } from 'crypto';
import { MastraStorage, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const createSampleWorkflowSnapshot = (status: string, createdAt?: Date) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = createdAt || new Date();
  const snapshot = {
    result: { success: true },
    value: {},
    context: {
      steps: {
        [stepId]: {
          status,
          payload: {},
          error: undefined,
        },
      },
      triggerData: {},
      attempts: {},
    },
    activePaths: [],
    runId,
    timestamp: timestamp.getTime(),
  } as WorkflowRunState;
  return { snapshot, runId, stepId };
};

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
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
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

  describe('getWorkflows', () => {
    const testNamespace = 'test-namespace';
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });
    it('returns empty array when no workflows exist', async () => {
      const { runs, total } = await store.__getWorkflows({});
      expect(runs).toEqual([]);
      expect(total).toBe(0);
    });

    it('returns all workflows by default', async () => {
      const workflowName1 = 'default_test_1';
      const workflowName2 = 'default_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');

      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await store.__getWorkflows();
      expect(runs).toHaveLength(2);
      expect(total).toBe(2);
      expect(runs[0]!.workflowName).toBe(workflowName2); // Most recent first
      expect(runs[1]!.workflowName).toBe(workflowName1);
      const firstSnapshot = runs[0]!.snapshot as WorkflowRunState;
      const secondSnapshot = runs[1]!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.steps[stepId2]?.status).toBe('running');
      expect(secondSnapshot.context?.steps[stepId1]?.status).toBe('completed');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot('failed');

      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await store.getWorkflows({ namespace: testNamespace, workflowName: workflowName1 });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.steps[stepId1]?.status).toBe('completed');
    });

    it('filters by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const workflowName1 = 'date_test_1';
      const workflowName2 = 'date_test_2';
      const workflowName3 = 'date_test_3';

      const { snapshot: workflow1, runId: runId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('waiting');

      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          workflow_name: workflowName1,
          run_id: runId1,
          snapshot: workflow1,
          createdAt: twoDaysAgo,
          updatedAt: twoDaysAgo,
        },
      });
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          workflow_name: workflowName2,
          run_id: runId2,
          snapshot: workflow2,
          createdAt: yesterday,
          updatedAt: yesterday,
        },
      });
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          workflow_name: workflowName3,
          run_id: runId3,
          snapshot: workflow3,
          createdAt: now,
          updatedAt: now,
        },
      });

      const { runs } = await store.__getWorkflows({
        fromDate: yesterday,
        toDate: now,
      });

      expect(runs).toHaveLength(2);
      expect(runs[0]!.workflowName).toBe(workflowName3);
      expect(runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = runs[0]!.snapshot as WorkflowRunState;
      const secondSnapshot = runs[1]!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.steps[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.steps[stepId2]?.status).toBe('running');
    });

    it('handles pagination', async () => {
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('waiting');

      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: workflowName3,
        runId: runId3,
        snapshot: workflow3,
      });

      // Get first page
      const page1 = await store.__getWorkflows({ limit: 2, offset: 0 });
      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records
      expect(page1.runs[0]!.workflowName).toBe(workflowName3);
      expect(page1.runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = page1.runs[0]!.snapshot as WorkflowRunState;
      const secondSnapshot = page1.runs[1]!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.steps[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.steps[stepId2]?.status).toBe('running');

      // Get second page
      const page2 = await store.__getWorkflows({ limit: 2, offset: 2 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.steps[stepId1]?.status).toBe('completed');
    });
  });
});
