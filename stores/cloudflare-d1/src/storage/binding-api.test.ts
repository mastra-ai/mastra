import { randomUUID } from 'crypto';
import type { D1Database } from '@cloudflare/workers-types';
import type { MessageType, StorageThreadType } from '@mastra/core';
import {
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import {
  createSampleMessage,
  createSampleThread,
  createSampleThreadWithParams,
  createSampleTrace,
  createSampleWorkflowSnapshot,
  retryUntil,
} from './test-utils';
import { D1Store } from '.';

dotenv.config();

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe('D1Store', () => {
  let d1Database: D1Database;
  let store: D1Store;
  const tablePrefix = 'test_';

  // Setup before all tests
  beforeAll(async () => {
    console.log('Initializing D1Store with Miniflare...');

    // Create a Miniflare instance with D1
    const mf = new Miniflare({
      modules: true,
      script: 'export default {};',
      d1Databases: { TEST_DB: ':memory:' }, // Use in-memory SQLite for tests
    });

    // Get the D1 database from Miniflare
    d1Database = await mf.getD1Database('TEST_DB');

    // Initialize the D1Store with the test database
    store = new D1Store({
      binding: d1Database,
      tablePrefix,
    });

    // Initialize tables
    await store.init();
    console.log('D1Store initialized');
  });

  // Clean up after all tests
  afterAll(async () => {
    // Clean up tables
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_EVALS });

    await store.close();
  });

  // Reset tables before each test
  beforeEach(async () => {
    // Clear tables for a clean state
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_EVALS });
  });

  describe('Trace Operations', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_TRACES });
    });

    it('should retrieve traces with filtering and pagination', async () => {
      // Insert sample traces
      const trace1 = createSampleTrace('test-trace-1', 'scope1', { env: 'prod' });
      const trace2 = createSampleTrace('test-trace-2', 'scope1', { env: 'dev' });
      const trace3 = createSampleTrace('other-trace', 'scope2', { env: 'prod' });

      await store.insert({ tableName: TABLE_TRACES, record: trace1 });
      await store.insert({ tableName: TABLE_TRACES, record: trace2 });
      await store.insert({ tableName: TABLE_TRACES, record: trace3 });

      // Test name filter
      const testTraces = await store.getTraces({ name: 'test-trace', page: 0, perPage: 10 });
      expect(testTraces).toHaveLength(2);
      expect(testTraces.map(t => t.name)).toContain('test-trace-1');
      expect(testTraces.map(t => t.name)).toContain('test-trace-2');

      // Test scope filter
      const scope1Traces = await store.getTraces({ scope: 'scope1', page: 0, perPage: 10 });
      expect(scope1Traces).toHaveLength(2);
      expect(scope1Traces.every(t => t.scope === 'scope1')).toBe(true);

      // Test attributes filter
      const prodTraces = await store.getTraces({
        attributes: { env: 'prod' },
        page: 0,
        perPage: 10,
      });
      expect(prodTraces).toHaveLength(2);
      expect(prodTraces.every(t => t.attributes.env === 'prod')).toBe(true);

      // Test pagination
      const pagedTraces = await store.getTraces({ page: 0, perPage: 2 });
      expect(pagedTraces).toHaveLength(2);

      // Test combined filters
      const combinedTraces = await store.getTraces({
        scope: 'scope1',
        attributes: { env: 'prod' },
        page: 0,
        perPage: 10,
      });
      expect(combinedTraces).toHaveLength(1);
      expect(combinedTraces[0].name).toBe('test-trace-1');

      // Verify trace object structure
      const trace = combinedTraces[0];
      expect(trace).toHaveProperty('id');
      expect(trace).toHaveProperty('parentSpanId');
      expect(trace).toHaveProperty('traceId');
      expect(trace).toHaveProperty('name');
      expect(trace).toHaveProperty('scope');
      expect(trace).toHaveProperty('kind');
      expect(trace).toHaveProperty('status');
      expect(trace).toHaveProperty('events');
      expect(trace).toHaveProperty('links');
      expect(trace).toHaveProperty('attributes');
      expect(trace).toHaveProperty('startTime');
      expect(trace).toHaveProperty('endTime');
      expect(trace).toHaveProperty('other');
      expect(trace).toHaveProperty('createdAt');

      // Verify JSON fields are parsed
      expect(typeof trace.status).toBe('object');
      expect(typeof trace.events).toBe('object');
      expect(typeof trace.links).toBe('object');
      expect(typeof trace.attributes).toBe('object');
      expect(typeof trace.other).toBe('object');
    });

    it('should handle empty results', async () => {
      const traces = await store.getTraces({ page: 0, perPage: 10 });
      expect(traces).toHaveLength(0);
    });

    it('should handle invalid JSON in fields', async () => {
      const trace = createSampleTrace('test-trace');
      trace.status = 'invalid-json{'; // Intentionally invalid JSON

      await store.insert({ tableName: TABLE_TRACES, record: trace });
      const traces = await store.getTraces({ page: 0, perPage: 10 });

      expect(traces).toHaveLength(1);
      expect(traces[0].status).toBe('invalid-json{'); // Should return raw string when JSON parsing fails
    });
  });

  describe('Table Operations', () => {
    const testTableName = TABLE_THREADS;
    const testTableName2 = TABLE_MESSAGES;

    beforeEach(async () => {
      // Try to clean up the test table if it exists
      try {
        await store.clearTable({ tableName: testTableName as any });
      } catch {
        // Table might not exist yet, which is fine
      }
      try {
        await store.clearTable({ tableName: testTableName2 as any });
      } catch {
        // Table might not exist yet, which is fine
      }
    });

    it('should create a new table with schema', async () => {
      await store.createTable({
        tableName: testTableName,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
          created_at: { type: 'timestamp' },
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

    it('should clear table data', async () => {
      await store.createTable({
        tableName: testTableName,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Insert test data
      await store.insert({
        tableName: testTableName,
        record: { id: 'test1', data: 'test-data' } as unknown as StorageThreadType,
      });

      // Clear the table
      await store.clearTable({ tableName: testTableName });

      // Verify data is cleared
      const result = await store.load({
        tableName: testTableName,
        keys: { id: 'test1' },
      });

      expect(result).toBeNull();
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread      const retrievedThread = await store.getThreadById({ threadId: thread.id });

      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.title === thread.title,
      );
      expect(retrievedThread?.title).toEqual(thread.title);
      expect(retrievedThread).not.toBeNull();
      expect(retrievedThread?.id).toBe(thread.id);
      expect(retrievedThread?.title).toBe(thread.title);
      expect(retrievedThread?.metadata).toEqual(thread.metadata);
    });

    it('should return null for non-existent thread', async () => {
      const result = await store.getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const thread1 = createSampleThread();
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };

      await store.saveThread({ thread: thread1 });
      await store.saveThread({ thread: thread2 });

      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread1.resourceId }),
        threads => threads?.length === 2,
      );
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should create and retrieve a thread with the same given threadId and resourceId', async () => {
      const exampleThreadId = '1346362547862769664';
      const exampleResourceId = '532374164040974346';
      const createdAt = new Date();
      const updatedAt = new Date();
      const thread = createSampleThreadWithParams(exampleThreadId, exampleResourceId, createdAt, updatedAt);

      // Save thread
      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.id).toEqual(exampleThreadId);
      expect(retrievedThread?.resourceId).toEqual(exampleResourceId);
      expect(retrievedThread?.title).toEqual(thread.title);
      expect(retrievedThread?.createdAt).toEqual(createdAt.toISOString());
      expect(retrievedThread?.updatedAt).toEqual(updatedAt.toISOString());
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const updatedTitle = 'Updated Title';
      const updatedMetadata = { newKey: 'newValue' };
      const updatedThread = await store.updateThread({
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
        async () =>
          await store.load<StorageThreadType>({
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
      );

      expect(retrieved?.title).toBe(updatedTitle);
      expect(retrieved?.metadata).toEqual(expect.objectContaining(updatedMetadata));
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];
      await store.saveMessages({ messages });

      await store.deleteThread({ threadId: thread.id });

      // Verify thread deletion with retry
      await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        thread => thread === null,
      );

      // Verify messages were also deleted with retry
      const retrievedMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length === 0,
      );
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Message Operations', () => {
    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];

      // Save messages
      const savedMessages = await store.saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages with retry
      const retrievedMessages = await retryUntil(
        async () => {
          const msgs = await store.getMessages({ threadId: thread.id });
          return msgs;
        },
        msgs => msgs.length === 2,
      );

      expect(retrievedMessages).toEqual(expect.arrayContaining(messages));
    });

    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

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

      await store.saveMessages({ messages });

      const retrievedMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length > 0,
      );
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content).toEqual(messages[idx].content);
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id),
        { ...createSampleMessage(thread.id), id: null }, // This will cause an error
      ] as MessageType[];

      await expect(store.saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await store.getMessages({ threadId: thread.id });
      expect(savedMessages).toHaveLength(0);
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

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.runId === workflow.runId,
      );

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
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.value[workflow.runId] === 'completed',
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

      await store.saveThread({ thread });
      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );
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

      await store.saveThread({ thread: thread as any });
      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });
  });

  describe('Message Ordering', () => {
    it('should handle duplicate timestamps gracefully', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with identical timestamps
      const timestamp = new Date();
      const messages = Array.from({ length: 3 }, () => ({
        ...createSampleMessage(thread.id),
        createdAt: timestamp,
      }));

      await store.saveMessages({ messages });

      // Verify order is maintained based on insertion order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === messages.length,
      );

      // Order should match insertion order
      expect(order).toEqual(messages.map(m => m.id));
    });

    it('should preserve write order when messages are saved concurrently', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with different timestamps
      const now = Date.now();
      const messages = Array.from({ length: 3 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now - (2 - i) * 1000), // timestamps: oldest -> newest
      }));

      // Save messages in reverse order to verify write order is preserved
      const reversedMessages = [...messages].reverse(); // newest -> oldest
      await Promise.all(reversedMessages.map(msg => store.saveMessages({ messages: [msg] })));

      // Verify messages are saved and maintain write order (not timestamp order)
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store['getFullOrder'](orderKey);
          // Verify both length and that all messages are present
          return currentOrder.length === messages.length && currentOrder.every(id => messages.some(m => m.id === id))
            ? currentOrder
            : null;
        },
        order => order !== null,
        5000,
      );

      expect(order).toEqual(reversedMessages.map(m => m.id));
    });

    it('should handle score updates correctly', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.saveMessages({ messages });

      // Update scores to reverse order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      await store['updateSortedMessages'](
        orderKey,
        messages.map((msg, i) => ({
          id: msg.id,
          score: messages.length - 1 - i,
        })),
      );

      // Verify new order
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order[0] === messages?.[messages.length - 1]?.id,
      );
      expect(order).toEqual(messages.map(m => m.id).reverse());
    });

    it('should maintain message order using sorted sets', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

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

      await store.saveMessages({ messages });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get messages and verify order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const order = await store['getFullOrder'](orderKey);
          return order;
        },
        order => order.length > 0,
      );
      expect(order.length).toBe(3);

      // Verify we can get specific ranges
      const firstTwo = await retryUntil(
        async () => await store['getRange'](orderKey, 0, 1),
        order => order.length > 0,
      );

      expect(firstTwo.length).toBe(2);

      const lastTwo = await retryUntil(
        async () => await store['getLastN'](orderKey, 2),
        order => order.length > 0,
      );
      expect(lastTwo.length).toBe(2);

      // Verify message ranks
      const firstMessageRank = await retryUntil(
        async () => await store['getRank'](orderKey, messages[0].id),
        order => order !== null,
      );
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

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.runId === workflow.runId,
      );

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

    it('should update existing workflow snapshot', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const initialSnapshot = {
        runId,
        value: { currentState: 'running' },
        timestamp: Date.now(),
        activePaths: [],
        context: {
          steps: {},
          stepResults: {},
          attempts: {},
          triggerData: { type: 'manual' },
        },
      } as WorkflowRunState;

      const updatedSnapshot = {
        runId,
        value: { currentState: 'completed' },
        timestamp: Date.now(),
        activePaths: [],
        context: {
          steps: {},
          stepResults: {
            'step-1': { status: 'success', result: { data: 'test' } },
          },
          attempts: { 'step-1': 1 },
          triggerData: { type: 'manual' },
        },
      } as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
        snapshot: initialSnapshot,
      });

      await store.persistWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(updatedSnapshot);
    });

    it('should handle complex workflow state', async () => {
      const namespace = 'test-namespace';
      const runId = `run-${randomUUID()}`;
      const workflowName = 'complex-workflow';

      const complexSnapshot = {
        runId,
        value: { currentState: 'running' },
        timestamp: Date.now(),
        context: {
          steps: {},
          stepResults: {
            'step-1': {
              status: 'success',
              result: {
                nestedData: {
                  array: [1, 2, 3],
                  object: { key: 'value' },
                  date: new Date().toISOString(),
                },
              },
            },
            'step-2': {
              status: 'waiting',
              dependencies: ['step-3', 'step-4'],
            },
          },
          attempts: { 'step-1': 1, 'step-2': 0 },
          triggerData: {
            type: 'scheduled',
            metadata: {
              schedule: '0 0 * * *',
              timezone: 'UTC',
            },
          },
        },
        activePaths: [
          {
            stepPath: ['step-1'],
            stepId: 'step-1',
            status: 'success',
          },
          {
            stepPath: ['step-2'],
            stepId: 'step-2',
            status: 'waiting',
          },
        ],
      };

      await store.persistWorkflowSnapshot({
        namespace,
        workflowName,
        runId,
        snapshot: complexSnapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace,
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });
  });

  describe('Data Validation', () => {
    it('should handle missing optional fields', async () => {
      const thread = {
        ...createSampleThread(),
        metadata: undefined, // Optional field
      };
      await store.saveThread({ thread });

      // Should be able to retrieve thread
      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread.resourceId }),
        threads => threads.length > 0,
      );
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

      await store.saveThread({ thread });
      await store.saveMessages({ messages: [message] });

      // Should retrieve correctly
      const messages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length > 0,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toEqual(message.content);
    });

    it('should validate thread structure', async () => {
      const invalidThread = {
        ...createSampleThread(),
        createdAt: 'invalid-date' as any, // Invalid date
      };

      // Should throw on invalid data
      await expect(store.saveThread({ thread: invalidThread })).rejects.toThrow();
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions for atomic operations', async () => {
      const thread = createSampleThread();

      // Use transaction to save thread and messages atomically
      await store.withTransaction(async transaction => {
        // Create thread within transaction
        const threadSql = `
          INSERT INTO ${tablePrefix}${TABLE_THREADS} 
          (id, resource_id, title, metadata, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await transaction.executeQuery({
          sql: threadSql,
          params: [
            thread.id,
            thread.resourceId,
            thread.title,
            JSON.stringify(thread.metadata),
            thread.createdAt.toISOString(),
            thread.updatedAt.toISOString(),
          ],
        });

        // Create a message within the same transaction
        const message = createSampleMessage(thread.id);
        const messageSql = `
          INSERT INTO ${tablePrefix}${TABLE_MESSAGES}
          (id, thread_id, role, type, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await transaction.executeQuery({
          sql: messageSql,
          params: [
            message.id,
            message.threadId,
            message.role,
            message.type,
            JSON.stringify(message.content),
            message.createdAt.toISOString(),
          ],
        });
      });

      // Verify both operations succeeded
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).not.toBeNull();

      const messages = await store.getMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
    });

    it('should rollback transaction on error', async () => {
      const thread = createSampleThread();

      try {
        await store.withTransaction(async transaction => {
          // First operation: create thread (should succeed)
          const threadSql = `
            INSERT INTO ${tablePrefix}${TABLE_THREADS} 
            (id, resource_id, title, metadata, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          await transaction.executeQuery({
            sql: threadSql,
            params: [
              thread.id,
              thread.resourceId,
              thread.title,
              JSON.stringify(thread.metadata),
              thread.createdAt.toISOString(),
              thread.updatedAt.toISOString(),
            ],
          });

          // Second operation: intentionally cause an error
          // by inserting into a non-existent table
          await transaction.executeQuery({
            sql: 'INSERT INTO non_existent_table (id) VALUES (?)',
            params: ['will-fail'],
          });
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }

      // Verify the thread was not created due to rollback
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent message updates concurrently', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with sequential timestamps (but write order will be preserved)
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now + i * 1000),
      }));

      // Save messages in parallel - write order should be preserved
      await Promise.all(messages.map(msg => store.saveMessages({ messages: [msg] })));

      // Order should reflect write order, not timestamp order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await store['getFullOrder'](orderKey);

      // Verify messages exist in write order
      const messageIds = messages.map(m => m.id);
      expect(order).toEqual(messageIds);

      // Verify all messages were saved
      expect(order.length).toBe(messages.length);
      expect(new Set(order)).toEqual(new Set(messageIds));
    });

    it('should maintain order with concurrent score updates', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.saveMessages({ messages });

      const orderKey = store['getThreadMessagesKey'](thread.id);

      // Perform multiple concurrent score updates
      await Promise.all([
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Order should be immediately consistent
      const order = await store['getFullOrder'](orderKey);

      const expectedOrder = messages
        .slice()
        .reverse()
        .map(m => m.id);

      expect(order).toEqual(expectedOrder);
    });
  });

  describe('Resource Management', () => {
    it('should clean up orphaned messages when thread is deleted', async () => {
      const thread = createSampleThread();
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));

      await store.saveThread({ thread });
      await store.saveMessages({ messages });

      // Verify messages exist
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const initialOrder = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        messages => messages.length > 0,
      );
      expect(initialOrder).toHaveLength(messages.length);

      // Delete thread
      await store.deleteThread({ threadId: thread.id });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify messages are cleaned up
      const finalOrder = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === 0,
      );
      expect(finalOrder).toHaveLength(0);

      // Verify thread is gone
      const threads = await store.getThreadsByResourceId({ resourceId: thread.resourceId });
      expect(threads).toHaveLength(0);
    });

    it('should handle namespace cleanup edge cases', async () => {
      // Create test data
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create test messages with unique timestamps
      const testMessages = Array.from({ length: 10 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(Date.now() + i * 1000),
      }));
      await store.saveMessages({ messages: testMessages });

      // Verify messages are saved
      const initialMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length === testMessages.length,
      );
      expect(initialMessages).toHaveLength(testMessages.length);

      // Delete thread
      await store.deleteThread({ threadId: thread.id });

      // Verify all data is cleaned up
      const remainingMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length === 0,
      );
      expect(remainingMessages).toHaveLength(0);

      // Verify thread is gone
      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread.resourceId }),
        threads => threads.length === 0,
      );
      expect(threads).toHaveLength(0);

      // Verify message order is cleaned up
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === 0,
      );
      expect(order).toHaveLength(0);
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

      await store.saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle concurrent thread operations', async () => {
      const threads = Array.from({ length: 10 }, () => createSampleThread());

      // Save all threads concurrently
      await Promise.all(threads.map(thread => store.saveThread({ thread })));

      // Retrieve all threads concurrently
      const retrievedThreads = await Promise.all(threads.map(thread => store.getThreadById({ threadId: thread.id })));

      expect(retrievedThreads.length).toBe(threads.length);
      retrievedThreads.forEach((retrieved, i) => {
        expect(retrieved?.id).toBe(threads[i].id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle race conditions in getSortedOrder', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with sequential timestamps
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...createSampleMessage(thread.id),
        createdAt: new Date(now + i * 1000), // Ensure deterministic order
      }));

      // Save messages in parallel to create race condition
      await Promise.all(messages.map(msg => store.saveMessages({ messages: [msg] })));

      // Verify both presence and order consistency
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store['getFullOrder'](orderKey);
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

    it('should handle invalid message data', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Try to save invalid message
      const invalidMessage = {
        ...createSampleMessage(thread.id),
        content: undefined,
      };

      await expect(
        store.saveMessages({
          messages: [invalidMessage as any],
        }),
      ).rejects.toThrow();
    });

    it('should handle missing thread gracefully', async () => {
      const message = createSampleMessage('non-existent-thread');
      await expect(
        store.saveMessages({
          messages: [message],
        }),
      ).rejects.toThrow();
    });

    it('should handle malformed data gracefully', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Test with various malformed data
      const malformedMessage = {
        ...createSampleMessage(thread.id),
        content: [{ type: 'text' as const, text: ''.padStart(1024 * 1024, 'x') }] as MessageType['content'], // Very large content
      };

      await store.saveMessages({ messages: [malformedMessage] });

      // Should still be able to retrieve and handle the message
      const messages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id }),
        messages => messages.length === 1,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(malformedMessage.id);
    });

    it('should handle concurrent updates to sorted order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessage(thread.id));
      await store.saveMessages({ messages });

      // Perform multiple concurrent updates
      const orderKey = store['getThreadMessagesKey'](thread.id);
      await Promise.all([
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Verify order is consistent
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === messages.length,
      );
      expect(order.length).toBe(messages.length);
      expect(new Set(order)).toEqual(new Set(messages.map(m => m.id)));
    });

    it('should handle invalid JSON data gracefully', async () => {
      await store['putNamespaceValue']({
        tableName: TABLE_THREADS,
        key: 'invalid-key',
        value: 'invalid-json',
        metadata: '',
      });

      const result = await store['getKV'](TABLE_THREADS, 'invalid-key');
      expect(result).toBe('invalid-json');
    });
  });
});
