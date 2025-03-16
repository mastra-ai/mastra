import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { MessageType, StorageThreadType } from '@mastra/core/memory';
import { TABLE_MESSAGES, TABLE_NAMES, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';

import { CloudflareStore } from '.';
import type { CloudflareStoreConfig } from './types';

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

const TEST_CONFIG: CloudflareStoreConfig = {
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
  content: [{ type: 'text' as const, text: 'Hello' }] as MessageType['content'],
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
    __getThreadMessagesKey(threadId: string): string;
    __updateSortedOrder(
      tableName: TABLE_NAMES,
      orderKey: string,
      entries: Array<{ id: string; score: number }>,
    ): Promise<void>;
  }
}

// Helper function to retry until condition is met or timeout
const retryUntil = async <T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  timeout = 1000,
  interval = 100,
): Promise<T> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (condition(result)) return result;
    } catch (error) {
      if (Date.now() - start >= timeout) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
};

describe.skip('CloudflareStore Workers Binding', () => {
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
      __getThreadMessagesKey: CloudflareStore.prototype['getThreadMessagesKey'],
      __updateSortedOrder: CloudflareStore.prototype['updateSortedOrder'],
    });
  });
  let store: CloudflareStore;

  beforeAll(async () => {
    if (!TEST_CONFIG.accountId || !TEST_CONFIG.apiToken) {
      throw new Error('Cloudflare credentials not provided');
    }
    store = new CloudflareStore(TEST_CONFIG);
  });

  //   beforeAll(() => {
  //     // Configure store with Workers binding
  //     store = new CloudflareStore({
  //       // Worker binding configuration will go here
  //     });
  //   });

  // Helper to clean up KV namespaces
  const cleanupNamespaces = async () => {
    const namespaces = [
      `${TEST_CONFIG.namespacePrefix}_mastra_threads`,
      `${TEST_CONFIG.namespacePrefix}_mastra_workflows`,
      `${TEST_CONFIG.namespacePrefix}_mastra_evals`,
      `${TEST_CONFIG.namespacePrefix}_mastra_schemas`,
    ];

    for (const namespace of namespaces) {
      try {
        await store['deleteNamespace'](namespace as any);
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

  describe('Atomic Operations', () => {
    it('should handle concurrent message updates atomically', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create messages with sequential timestamps
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now + i * 1000),
      }));

      // Save messages in parallel - should be atomic with Workers
      await Promise.all(messages.map(msg => store.__saveMessages({ messages: [msg] })));

      // Order should be immediately consistent
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);

      // Verify correct timestamp-based ordering
      const expectedOrder = messages
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(m => m.id);

      expect(order).toEqual(expectedOrder);
    });

    it('should maintain order with concurrent score updates', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.__saveMessages({ messages });

      const orderKey = store.__getThreadMessagesKey(thread.id);

      // Perform multiple concurrent score updates
      await Promise.all([
        store.__updateSortedOrder(
          TABLE_MESSAGES,
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store.__updateSortedOrder(
          TABLE_MESSAGES,
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Order should be immediately consistent
      const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);

      // With atomic operations, the last write should win consistently
      const expectedOrder = messages
        .slice()
        .reverse()
        .map(m => m.id);

      expect(order).toEqual(expectedOrder);
    });
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
    it('should handle duplicate timestamps gracefully', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create messages with identical timestamps
      const timestamp = new Date();
      const messages = Array.from({ length: 3 }, () => ({
        ...createSampleMessage(thread.id),
        createdAt: timestamp,
      }));

      await store.__saveMessages({ messages });

      // Verify order is maintained based on insertion order
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const order = await retryUntil(
        () => store.__getFullOrder(TABLE_MESSAGES, orderKey),
        order => order.length === messages.length,
        5000,
      );

      // Order should match insertion order
      expect(order).toEqual(messages.map(m => m.id));
    });

    it('should maintain order when messages are added out of sequence', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create messages with different timestamps
      const now = Date.now();
      const messages = Array.from({ length: 3 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now - (2 - i) * 1000), // oldest -> newest
      }));

      // Save messages in parallel to stress test ordering
      await Promise.all([...messages].reverse().map(msg => store.__saveMessages({ messages: [msg] })));

      // Verify both presence and order
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
          console.log('Current order:', currentOrder);
          // Verify both length and content
          return currentOrder.length === messages.length && currentOrder.every(id => messages.some(m => m.id === id))
            ? currentOrder
            : null;
        },
        order => order !== null,
        5000,
      );

      expect(order).toEqual(messages.map(m => m.id));
    });

    it('should handle score updates correctly', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.__saveMessages({ messages });

      // Update scores to reverse order
      const orderKey = store.__getThreadMessagesKey(thread.id);
      await store.__updateSortedOrder(
        TABLE_MESSAGES,
        orderKey,
        messages.map((msg, i) => ({
          id: msg.id,
          score: messages.length - 1 - i,
        })),
      );

      // Verify new order
      const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
      expect(order).toEqual(messages.map(m => m.id).reverse());
    });

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

  describe('Data Validation', () => {
    it('should handle missing optional fields', async () => {
      const thread = {
        ...createSampleThread(),
        metadata: undefined, // Optional field
      };
      await store.__saveThread({ thread });

      // Should be able to retrieve thread
      const threads = await store.__getThreadsByResourceId({ resourceId: thread.resourceId });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread.id);
      expect(threads[0].metadata).toStrictEqual({});
    });

    it('should sanitize and handle special characters', async () => {
      const thread = createSampleThread();
      const message = {
        ...createSampleMessage(thread.id),
        content: [{ type: 'text' as const, text: '特殊字符 !@#$%^&*()' }] as MessageType['content'],
      };

      await store.__saveThread({ thread });
      await store.__saveMessages({ messages: [message] });

      // Should retrieve correctly
      const messages = await store.__getMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toEqual(message.content);
    });

    it('should validate thread structure', async () => {
      const invalidThread = {
        ...createSampleThread(),
        createdAt: 'invalid-date' as any, // Invalid date
      };

      // Should throw on invalid data
      await expect(store.__saveThread({ thread: invalidThread })).rejects.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should clean up orphaned messages when thread is deleted', async () => {
      const thread = createSampleThread();
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));

      await store.__saveThread({ thread });
      await store.__saveMessages({ messages });

      // Verify messages exist
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const initialOrder = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
      expect(initialOrder).toHaveLength(messages.length);

      // Delete thread
      await store.__deleteThread({ threadId: thread.id });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify messages are cleaned up
      const finalOrder = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
      expect(finalOrder).toHaveLength(0);

      // Verify thread is gone
      const threads = await store.__getThreadsByResourceId({ resourceId: thread.resourceId });
      expect(threads).toHaveLength(0);
    });

    it('should handle namespace cleanup edge cases', async () => {
      // Create test data
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create test messages with unique timestamps
      const testMessages = Array.from({ length: 10 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(Date.now() + i * 1000),
      }));
      await store.__saveMessages({ messages: testMessages });

      // Verify messages are saved
      const initialMessages = await store.__getMessages({ threadId: thread.id });
      expect(initialMessages).toHaveLength(testMessages.length);

      // Delete thread
      await store.__deleteThread({ threadId: thread.id });

      // Verify cleanup with retries
      await retryUntil(
        async () => {
          const keys = await store.listNamespaceKeys(TABLE_THREADS, {
            limit: 1000,
            prefix: thread.id,
          });
          return keys;
        },
        keys => keys.length === 0,
        5000, // 5 second timeout
        100, // Check every 100ms
      );

      // Verify all data is cleaned up
      const remainingMessages = await store.__getMessages({ threadId: thread.id });
      expect(remainingMessages).toHaveLength(0);

      // Verify thread is gone
      const threads = await store.__getThreadsByResourceId({ resourceId: thread.resourceId });
      expect(threads).toHaveLength(0);

      // Verify message order is cleaned up
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
      expect(order).toHaveLength(0);

      // Verify no orphaned data in any table
      const tablesToCheck: TABLE_NAMES[] = [TABLE_MESSAGES, TABLE_THREADS];
      for (const tableName of tablesToCheck) {
        const keys = await store.listNamespaceKeys(tableName, {
          limit: 1000,
          prefix: thread.id,
        });
        expect(keys).toHaveLength(0);
      }
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
    it('should handle race conditions in getSortedOrder', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create messages with sequential timestamps
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now + i * 1000), // Ensure deterministic order
      }));

      // Save messages in parallel to create race condition
      await Promise.all(messages.map(msg => store.__saveMessages({ messages: [msg] })));

      // Verify both presence and order consistency
      const orderKey = store.__getThreadMessagesKey(thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store.__getFullOrder(TABLE_MESSAGES, orderKey);

          console.log('Current order:', currentOrder);
          // Check both length and content
          const hasAllMessages =
            currentOrder.length === messages.length && currentOrder.every(id => messages.some(m => m.id === id));
          if (!hasAllMessages) return null;

          // Verify messages are in timestamp order
          const orderedMessages = messages.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return currentOrder.join(',') === orderedMessages.map(m => m.id).join(',') ? currentOrder : null;
        },
        order => order !== null,
        10000,
      );

      // Final verification
      const orderedIds = messages
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(m => m.id);
      expect(order).toEqual(orderedIds);
    });

    it('should handle malformed data gracefully', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Test with various malformed data
      const malformedMessage = {
        ...createSampleMessage(thread.id),
        content: [{ type: 'text' as const, text: ''.padStart(1024 * 1024, 'x') }] as MessageType['content'], // Very large content
      };

      await store.__saveMessages({ messages: [malformedMessage] });

      // Should still be able to retrieve and handle the message
      const messages = await store.__getMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(malformedMessage.id);
    });

    it('should handle concurrent updates to sorted order', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.__saveMessages({ messages });

      // Perform multiple concurrent updates
      const orderKey = store.__getThreadMessagesKey(thread.id);
      await Promise.all([
        store.__updateSortedOrder(
          TABLE_MESSAGES,
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store.__updateSortedOrder(
          TABLE_MESSAGES,
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Verify order is consistent
      const order = await store.__getFullOrder(TABLE_MESSAGES, orderKey);
      expect(order.length).toBe(messages.length);
      expect(new Set(order)).toEqual(new Set(messages.map(m => m.id)));
    });

    it('should handle invalid JSON data gracefully', async () => {
      const namespaceId = await store['getNamespaceId']({ tableName: TABLE_THREADS });
      await store['putNamespaceValue']({
        tableName: TABLE_THREADS,
        key: 'invalid-key',
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
