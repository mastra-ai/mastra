import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { MessageType, StorageThreadType } from '@mastra/core/memory';
import { TABLE_MESSAGES, TABLE_NAMES, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';

import { CloudflareStore } from '.';
import type { CloudflareConfig } from '.';

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

const TEST_CONFIG: CloudflareConfig = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  namespacePrefix: 'mastra-test', // Fixed prefix for test isolation
};

// Sample test data factory functions
const createSampleThread = () => ({
  id: `thread-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  title: 'Test Thread',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { key: 'value' },
});

const createSampleMessage = (threadId: string): MessageType => ({
  id: `msg-${randomUUID()}`,
  role: 'user',
  type: 'text',
  threadId,
  content: [{ type: 'text' as const, text: 'Hello' }],
  createdAt: new Date(),
});

const createSampleWorkflowSnapshot = (threadId: string): WorkflowRunState => ({
  value: { [threadId]: 'running' },
  context: {
    steps: {},
    triggerData: {},
    attempts: {},
  },
  activePaths: [
    {
      stepPath: [threadId],
      stepId: threadId,
      status: 'running',
    },
  ],
  runId: threadId,
  timestamp: Date.now(),
});

// Extend CloudflareStore type for testing
declare module '@mastra/core/storage' {
  interface MastraStorage {
    __getFullOrder(tableName: TABLE_NAMES, orderKey: string): Promise<string[]>;
    __getRange(tableName: TABLE_NAMES, orderKey: string, start: number, end: number): Promise<string[]>;
    __getLastN(tableName: TABLE_NAMES, orderKey: string, n: number): Promise<string[]>;
    __getRank(tableName: TABLE_NAMES, orderKey: string, id: string): Promise<number | null>;
    __listKV(tableName: TABLE_NAMES): Promise<Array<{ name: string }>>;
    __getKey(tableName: TABLE_NAMES, keys: Record<string, any>): string;
  }
}

// Helper function to retry until condition is met or timeout
const retryUntil = async <T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  timeout = 1000,
  interval = 100,
) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await fn();
    if (condition(result)) return result;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
};

describe('CloudflareStore', () => {
  // Expose private methods for testing
  const getThreadMessagesKey = (threadId: string) => `${TABLE_MESSAGES}:${threadId}:messages`;

  // Add test helper methods to CloudflareStore
  beforeAll(() => {
    Object.assign(CloudflareStore.prototype, {
      __getFullOrder: CloudflareStore.prototype['getFullOrder'],
      __listKV: CloudflareStore.prototype['listKV'],
      __getKey: CloudflareStore.prototype['getKey'],
      __getRange: CloudflareStore.prototype['getRange'],
      __getLastN: CloudflareStore.prototype['getLastN'],
      __getRank: CloudflareStore.prototype['getRank'],
    });
  });
  let store: CloudflareStore;

  beforeAll(async () => {
    if (!TEST_CONFIG.accountId || !TEST_CONFIG.apiToken) {
      throw new Error('Cloudflare credentials not provided');
    }
    store = new CloudflareStore(TEST_CONFIG);
  });

  // Helper to clean up KV namespaces
  const cleanupNamespaces = async () => {
    const namespaces = [
      `${TEST_CONFIG.namespacePrefix}_mastra_threads`,
      `${TEST_CONFIG.namespacePrefix}_mastra_workflows`,
      `${TEST_CONFIG.namespacePrefix}_mastra_evals`,
    ];

    for (const namespace of namespaces) {
      try {
        const namespaceId = await store['getNamespaceIdByName'](namespace);
        if (namespaceId) {
          await store['client'].kv.namespaces.delete(namespaceId, {
            account_id: TEST_CONFIG.accountId,
          });
        }
      } catch (error) {
        console.error(`Error cleaning up namespace ${namespace}:`, error);
      }
    }
  };

  beforeEach(async () => {
    await cleanupNamespaces();
  });

  afterAll(async () => {
    await cleanupNamespaces();
  });

  describe('Table Operations', () => {
    const testTableName = TABLE_THREADS;
    const testTableName2 = TABLE_MESSAGES;

    beforeEach(async () => {
      // Clear tables before each test
      await store.clearTable({ tableName: testTableName }).catch(() => {});
      await store.clearTable({ tableName: testTableName2 }).catch(() => {});
    });

    it('should create a new table with schema', async () => {
      // Increase timeout for namespace creation and cleanup
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
        record: {
          id: 'test1',
          data: 'test-data',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as StorageThreadType,
      });

      const result = await store.load<StorageThreadType>({ tableName: testTableName, keys: { id: 'test1' } });
      expect(result).toBeTruthy();
      if (result) {
        expect(result.title).toBe('Test Thread');
        expect(result.resourceId).toBe('resource-1');
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      }
    });

    it('should handle multiple table creation', async () => {
      await store.createTable({
        tableName: testTableName2,
        schema: {
          id: { type: 'text', primaryKey: true },
          threadId: { type: 'text', nullable: false }, // Use nullable: false instead of required
          data: { type: 'text', nullable: true },
        },
      });

      // Verify both tables work independently
      await store.insert({
        tableName: testTableName2,
        record: {
          id: 'test2',
          threadId: 'thread-1',
          content: [{ type: 'text', text: 'test-data-2' }],
          role: 'user',
        } as MessageType,
      });

      const result = await store.load<MessageType>({
        tableName: testTableName2,
        keys: { id: 'test2', threadId: 'thread-1' },
      });
      expect(result).toBeTruthy();
      if (result) {
        expect(result.threadId).toBe('thread-1');
        expect(result.content).toEqual([{ type: 'text', text: 'test-data-2' }]);
        expect(result.role).toBe('user');
      }
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await store.__saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toEqual(thread.title);
    });

    it('should return null for non-existent thread', async () => {
      const result = await store.__getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const thread1 = createSampleThread();
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };

      await store.__saveThread({ thread: thread1 });
      await store.__saveThread({ thread: thread2 });

      const threads = await store.__getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const updatedTitle = 'Updated Title';
      const updatedMetadata = { newKey: 'newValue' };
      const updatedThread = await store.__updateThread({
        id: thread.id,
        title: updatedTitle,
        metadata: updatedMetadata,
      });

      expect(updatedThread.title).toBe(updatedTitle);
      expect(updatedThread.metadata).toEqual({
        ...thread.metadata,
        ...updatedMetadata,
      });

      // Verify persistence with retry
      const retrieved = await retryUntil(
        () =>
          store.load<StorageThreadType>({
            tableName: TABLE_THREADS,
            keys: { id: thread.id },
          }),
        (thread): boolean => {
          if (!thread || !thread.metadata) return false;
          return (
            thread.title === updatedTitle &&
            Object.entries(updatedMetadata).every(([key, value]) => thread?.metadata?.[key] === value)
          );
        },
        5000,
      );

      expect(retrieved?.title).toBe(updatedTitle);
      expect(retrieved?.metadata).toEqual(expect.objectContaining(updatedMetadata));
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];
      await store.__saveMessages({ messages });

      await store.__deleteThread({ threadId: thread.id });

      // Verify thread deletion with retry
      await retryUntil(
        () => store.__getThreadById({ threadId: thread.id }),
        thread => thread === null,
        5000,
      );

      // Verify messages were also deleted with retry
      const retrievedMessages = await retryUntil(
        () => store.__getMessages({ threadId: thread.id }),
        messages => messages.length === 0,
      );
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];

      // Save messages
      const savedMessages = await store.__saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages with retry
      const retrievedMessages = await retryUntil(
        async () => {
          const msgs = await store.__getMessages({ threadId: thread.id });
          return msgs;
        },
        msgs => msgs.length === 2,
        5000,
      );

      expect(retrievedMessages).toEqual(expect.arrayContaining(messages));
    });

    it('should handle empty message array', async () => {
      const result = await store.__saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const messages = [
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text' as const, text: 'First' }] as MessageType['content'],
        },
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text' as const, text: 'Second' }] as MessageType['content'],
        },
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text' as const, text: 'Third' }] as MessageType['content'],
        },
      ];

      await store.__saveMessages({ messages });

      const retrievedMessages = await store.__getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content).toEqual(messages[idx].content);
      });
    });
  });

  describe('Workflow Operations', () => {
    it('should save and retrieve workflow snapshots', async () => {
      const thread = createSampleThread();
      const workflow = createSampleWorkflowSnapshot(thread.id);

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
      });

      expect(retrieved).toEqual(workflow);
    });

    it('should handle non-existent workflow snapshots', async () => {
      const result = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: 'non-existent',
      });
      expect(result).toBeNull();
    });

    it('should update workflow snapshot status', async () => {
      const thread = createSampleThread();
      const workflow = createSampleWorkflowSnapshot(thread.id);

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      const updatedSnapshot = {
        ...workflow,
        value: { [workflow.runId]: 'completed' },
        timestamp: Date.now(),
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: updatedSnapshot,
      });

      const retrieved = await retryUntil(
        () =>
          store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.value[workflow.runId] === 'completed',
        5000,
      );

      expect(retrieved?.value[workflow.runId]).toBe('completed');
      expect(retrieved?.timestamp).toBeGreaterThan(workflow.timestamp);
    });
  });

  describe('Date Handling', () => {
    it('should handle Date objects in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-date-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      };

      await store.__saveThread({ thread });
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle ISO string dates in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-date-2',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        metadata: {},
      };

      await store.__saveThread({ thread: thread as any });
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });
  });

  describe('Message Ordering', () => {
    it('should maintain message order using sorted sets', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create messages with explicit timestamps to test chronological ordering
      const baseTime = new Date('2025-03-14T23:30:20.930Z').getTime();
      const messages = [
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text', text: 'First' }],
          createdAt: new Date(baseTime),
        },
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text', text: 'Second' }],
          createdAt: new Date(baseTime + 1000),
        },
        {
          ...createSampleMessage(thread.id),
          content: [{ type: 'text', text: 'Third' }],
          createdAt: new Date(baseTime + 2000),
        },
      ] as MessageType[];

      await store.__saveMessages({ messages });

      // Get messages and verify order
      const orderKey = getThreadMessagesKey(thread.id);
      const order = await retryUntil(
        async () => {
          const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
          return order;
        },
        order => order.length > 0,
        5000,
      );
      expect(order.length).toBe(3);

      // Verify we can get specific ranges
      const firstTwo = await store.__getRange(TABLE_MESSAGES, orderKey, 0, 1);
      expect(firstTwo.length).toBe(2);

      const lastTwo = await store.__getLastN(TABLE_MESSAGES, orderKey, 2);
      expect(lastTwo.length).toBe(2);

      // Verify message ranks
      const firstMessageRank = await store.__getRank(TABLE_MESSAGES, orderKey, messages[0].id);
      expect(firstMessageRank).toBe(0);
    });
  });

  describe('Workflow Snapshots', () => {
    beforeEach(async () => {
      // Clear workflow snapshots before each test
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should persist and load workflow snapshots', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run',
        value: { 'test-run': 'running' },
        timestamp: Date.now(),
        context: {
          steps: {
            'step-1': {
              status: 'waiting' as const,
              payload: { input: 'test' },
            },
          },
          triggerData: { source: 'test' },
          attempts: { 'step-1': 0 },
        },
        activePaths: [{ stepPath: ['main'], stepId: 'step-1', status: 'waiting' }],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
      });

      expect(retrieved).toEqual(workflow);
    });

    it('should handle non-existent workflow snapshots', async () => {
      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'non-existent',
        runId: 'non-existent',
      });

      expect(retrieved).toBeNull();
    });

    it('should update workflow snapshot status', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run-2',
        value: { 'test-run-2': 'running' },
        timestamp: Date.now(),
        context: {
          steps: {
            'step-1': {
              status: 'waiting' as const,
              payload: { input: 'test' },
            },
          },
          triggerData: { source: 'test' },
          attempts: { 'step-1': 0 },
        },
        activePaths: [{ stepPath: ['main'], stepId: 'step-1', status: 'waiting' }],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      // Update the workflow status
      const updatedWorkflow: WorkflowRunState = {
        ...workflow,
        value: { 'test-run-2': 'completed' },
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: updatedWorkflow,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
      });

      expect(retrieved?.value[workflow.runId]).toBe('completed');

      // Verify the workflow is stored in the correct namespace
      const keys = await store.__listKV(TABLE_WORKFLOW_SNAPSHOT);
      const key = store.__getKey(TABLE_WORKFLOW_SNAPSHOT, {
        namespace: 'test',
        workflow_name: 'test-workflow',
        run_id: workflow.runId,
      });
      expect(keys.some(k => k.name === key)).toBe(true);
    });

    it('should handle workflow step updates', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run-3',
        value: { 'test-run-3': 'running' },
        timestamp: Date.now(),
        context: {
          steps: {
            'step-1': {
              status: 'waiting' as const,
              payload: { input: 'test' },
            },
            'step-2': {
              status: 'waiting' as const,
              payload: { input: 'test2' },
            },
          },
          triggerData: { source: 'test' },
          attempts: { 'step-1': 0, 'step-2': 0 },
        },
        activePaths: [
          { stepPath: ['main'], stepId: 'step-1', status: 'waiting' },
          { stepPath: ['main'], stepId: 'step-2', status: 'waiting' },
        ],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      // Update step-1 status to completed
      const updatedWorkflow = {
        ...workflow,
        context: {
          ...workflow.context,
          steps: {
            ...workflow.context.steps,
            'step-1': {
              status: 'success' as const,
              payload: { result: 'done' },
            },
          },
        },
        activePaths: [{ stepPath: ['main'], stepId: 'step-2', status: 'waiting' }],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: updatedWorkflow,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
      });

      expect(retrieved?.context.steps['step-1'].status).toBe('success');
      expect(retrieved?.context.steps['step-1'].payload).toEqual({ result: 'done' });
      expect(retrieved?.context.steps['step-2'].status).toBe('waiting');
      expect(retrieved?.activePaths).toEqual([{ stepPath: ['main'], stepId: 'step-2', status: 'waiting' }]);
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large metadata objects', async () => {
      const thread = createSampleThread();
      const largeMetadata = {
        ...thread.metadata,
        largeArray: Array.from({ length: 1000 }, (_, i) => ({
          index: i,
          data: 'test'.repeat(100),
        })),
      };

      const threadWithLargeMetadata = {
        ...thread,
        metadata: largeMetadata,
      };

      await store.__saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await store.__getThreadById({ threadId: thread.id });

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle concurrent thread operations', async () => {
      const threads = Array.from({ length: 10 }, () => createSampleThread());

      // Save all threads concurrently
      await Promise.all(threads.map(thread => store.__saveThread({ thread })));

      // Retrieve all threads concurrently
      const retrievedThreads = await Promise.all(threads.map(thread => store.__getThreadById({ threadId: thread.id })));

      expect(retrievedThreads.length).toBe(threads.length);
      retrievedThreads.forEach((retrieved, i) => {
        expect(retrieved?.id).toBe(threads[i].id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON data gracefully', async () => {
      const namespaceId = await store['getNamespaceId']({ tableName: TABLE_THREADS });
      await store['client'].kv.namespaces.values.update(namespaceId, 'invalid-key', {
        account_id: TEST_CONFIG.accountId,
        value: 'invalid-json',
        metadata: '',
      });

      const result = await store['getKV'](TABLE_THREADS, 'invalid-key');
      expect(result).toBe('invalid-json');
    });

    it('should handle namespace creation errors', async () => {
      const invalidStore = new CloudflareStore({
        ...TEST_CONFIG,
        accountId: 'invalid-account',
      });

      await expect(invalidStore['getOrCreateNamespaceId']('test-namespace')).rejects.toThrow();
    });
  });
});
