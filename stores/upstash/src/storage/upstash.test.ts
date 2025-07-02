import { randomUUID } from 'crypto';
import {
  checkWorkflowSnapshot,
  createSampleMessageV2,
  createSampleThread,
  createSampleWorkflowSnapshot,
} from '@internal/storage-test-utils';
import type { MastraMessageV2 } from '@mastra/core';
import type { TABLE_NAMES } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, afterEach } from 'vitest';

import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const createSampleTrace = (
  name: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt: Date = new Date(),
) => ({
  id: `trace-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 'internal',
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: createdAt.getTime() }]),
  links: JSON.stringify([]),
  attributes: attributes ? JSON.stringify(attributes) : undefined,
  startTime: createdAt.toISOString(),
  endTime: new Date(createdAt.getTime() + 1000).toISOString(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: createdAt.toISOString(),
});

const createSampleEval = (agentName: string, isTest = false, createdAt: Date = new Date()) => {
  const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

  return {
    agent_name: agentName,
    input: 'Sample input',
    output: 'Sample output',
    result: JSON.stringify({ score: 0.8 }),
    metric_name: 'sample-metric',
    instructions: 'Sample instructions',
    test_info: testInfo ? JSON.stringify(testInfo) : undefined,
    global_run_id: `global-${randomUUID()}`,
    run_id: `run-${randomUUID()}`,
    created_at: createdAt.toISOString(),
  };
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
    await store.clearTable({ tableName: testTableName as TABLE_NAMES });
    await store.clearTable({ tableName: testTableName2 as TABLE_NAMES });
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await store.clearTable({ tableName: TABLE_EVALS });
    await store.clearTable({ tableName: TABLE_TRACES });
  });

  describe('Table Operations', () => {
    it('should create a new table with schema', async () => {
      await store.createTable({
        tableName: testTableName as TABLE_NAMES,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Verify table exists by inserting and retrieving data
      await store.insert({
        tableName: testTableName as TABLE_NAMES,
        record: { id: 'test1', data: 'test-data' },
      });

      const result = await store.load({ tableName: testTableName as TABLE_NAMES, keys: { id: 'test1' } });
      expect(result).toBeTruthy();
    });

    it('should handle multiple table creation', async () => {
      await store.createTable({
        tableName: testTableName2 as TABLE_NAMES,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Verify both tables work independently
      await store.insert({
        tableName: testTableName2 as TABLE_NAMES,
        record: { id: 'test2', data: 'test-data-2' },
      });

      const result = await store.load({ tableName: testTableName2 as TABLE_NAMES, keys: { id: 'test2' } });
      expect(result).toBeTruthy();
    });
  });

  describe('Thread Operations', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_THREADS });
    });

    it('should create and retrieve a thread', async () => {
      const now = new Date();
      const thread = createSampleThread({ date: now });

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
      const thread1 = createSampleThread();
      const thread2 = createSampleThread({ resourceId: thread1.resourceId });
      const threads = [thread1, thread2];

      const resourceId = threads[0].resourceId;
      const threadIds = threads.map(t => t.id);

      await Promise.all(threads.map(thread => store.saveThread({ thread })));

      const retrievedThreads = await store.getThreadsByResourceId({ resourceId });
      expect(retrievedThreads).toHaveLength(2);
      expect(retrievedThreads.map(t => t.id)).toEqual(expect.arrayContaining(threadIds));
    });

    it('should update thread metadata', async () => {
      const thread = createSampleThread();

      await store.saveThread({ thread });

      const updatedThread = await store.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: { updated: 'value' },
      });

      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({
        key: 'value',
        updated: 'value',
      });
    });

    it('should update thread updatedAt when a message is saved to it', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Get the initial thread to capture the original updatedAt
      const initialThread = await store.getThreadById({ threadId: thread.id });
      expect(initialThread).toBeDefined();
      const originalUpdatedAt = initialThread!.updatedAt;

      // Wait a small amount to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create and save a message to the thread
      const message = createSampleMessageV2({ threadId: thread.id });
      await store.saveMessages({ messages: [message], format: 'v2' });

      // Retrieve the thread again and check that updatedAt was updated
      const updatedThread = await store.getThreadById({ threadId: thread.id });
      expect(updatedThread).toBeDefined();
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should fetch >100000 threads by resource ID', async () => {
      const resourceId = `resource-${randomUUID()}`;
      const total = 100_000;
      const threads = Array.from({ length: total }, () => createSampleThread({ resourceId }));

      await store.batchInsert({ tableName: TABLE_THREADS, records: threads });

      const retrievedThreads = await store.getThreadsByResourceId({ resourceId });
      expect(retrievedThreads).toHaveLength(total);
    });
    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessageV2({ threadId: thread.id }), createSampleMessageV2({ threadId: thread.id })];
      await store.saveMessages({ messages, format: 'v2' });

      await store.deleteThread({ threadId: thread.id });

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Date Handling', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_THREADS });
    });

    it('should handle Date objects in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread({ date: now });

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle ISO string dates in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread({ date: now });

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle mixed date formats in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread({ date: now });

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle date serialization in getThreadsByResourceId', async () => {
      const now = new Date();
      const thread1 = createSampleThread({ date: now });
      const thread2 = { ...createSampleThread({ date: now }), resourceId: thread1.resourceId };
      const threads = [thread1, thread2];

      await Promise.all(threads.map(thread => store.saveThread({ thread })));

      const retrievedThreads = await store.getThreadsByResourceId({ resourceId: threads[0].resourceId });
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
      await store.clearTable({ tableName: TABLE_MESSAGES });
      await store.clearTable({ tableName: TABLE_THREADS });

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
      const messages: MastraMessageV2[] = [
        createSampleMessageV2({ threadId, content: 'First' }),
        createSampleMessageV2({ threadId, content: 'Second' }),
        createSampleMessageV2({ threadId, content: 'Third' }),
      ];

      await store.saveMessages({ messages, format: 'v2' });

      const retrievedMessages = await store.getMessages({ threadId, format: 'v2' });
      expect(retrievedMessages).toHaveLength(3);
      expect(retrievedMessages.map((m: any) => m.content.parts[0].text)).toEqual(['First', 'Second', 'Third']);
    });

    it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
      const thread = createSampleThread({ id: 'thread-one' });
      await store.saveThread({ thread });

      const thread2 = createSampleThread({ id: 'thread-two' });
      await store.saveThread({ thread: thread2 });

      const thread3 = createSampleThread({ id: 'thread-three' });
      await store.saveThread({ thread: thread3 });

      const messages: MastraMessageV2[] = [
        createSampleMessageV2({ threadId: 'thread-one', content: 'First', resourceId: 'cross-thread-resource' }),
        createSampleMessageV2({ threadId: 'thread-one', content: 'Second', resourceId: 'cross-thread-resource' }),
        createSampleMessageV2({ threadId: 'thread-one', content: 'Third', resourceId: 'cross-thread-resource' }),

        createSampleMessageV2({ threadId: 'thread-two', content: 'Fourth', resourceId: 'cross-thread-resource' }),
        createSampleMessageV2({ threadId: 'thread-two', content: 'Fifth', resourceId: 'cross-thread-resource' }),
        createSampleMessageV2({ threadId: 'thread-two', content: 'Sixth', resourceId: 'cross-thread-resource' }),

        createSampleMessageV2({ threadId: 'thread-three', content: 'Seventh', resourceId: 'other-resource' }),
        createSampleMessageV2({ threadId: 'thread-three', content: 'Eighth', resourceId: 'other-resource' }),
      ];

      await store.saveMessages({ messages: messages, format: 'v2' });

      const retrievedMessages = await store.getMessages({ threadId: 'thread-one', format: 'v2' });
      expect(retrievedMessages).toHaveLength(3);
      expect(retrievedMessages.map((m: any) => m.content.parts[0].text)).toEqual(['First', 'Second', 'Third']);

      const retrievedMessages2 = await store.getMessages({ threadId: 'thread-two', format: 'v2' });
      expect(retrievedMessages2).toHaveLength(3);
      expect(retrievedMessages2.map((m: any) => m.content.parts[0].text)).toEqual(['Fourth', 'Fifth', 'Sixth']);

      const retrievedMessages3 = await store.getMessages({ threadId: 'thread-three', format: 'v2' });
      expect(retrievedMessages3).toHaveLength(2);
      expect(retrievedMessages3.map((m: any) => m.content.parts[0].text)).toEqual(['Seventh', 'Eighth']);

      const crossThreadMessages = await store.getMessages({
        threadId: 'thread-doesnt-exist',
        format: 'v2',
        selectBy: {
          last: 0,
          include: [
            {
              id: messages[1].id,
              threadId: 'thread-one',
              withNextMessages: 2,
              withPreviousMessages: 2,
            },
            {
              id: messages[4].id,
              threadId: 'thread-two',
              withPreviousMessages: 2,
              withNextMessages: 2,
            },
          ],
        },
      });

      expect(crossThreadMessages).toHaveLength(6);
      expect(crossThreadMessages.filter(m => m.threadId === `thread-one`)).toHaveLength(3);
      expect(crossThreadMessages.filter(m => m.threadId === `thread-two`)).toHaveLength(3);

      const crossThreadMessages2 = await store.getMessages({
        threadId: 'thread-one',
        format: 'v2',
        selectBy: {
          last: 0,
          include: [
            {
              id: messages[4].id,
              threadId: 'thread-two',
              withPreviousMessages: 1,
              withNextMessages: 1,
            },
          ],
        },
      });

      expect(crossThreadMessages2).toHaveLength(3);
      expect(crossThreadMessages2.filter(m => m.threadId === `thread-one`)).toHaveLength(0);
      expect(crossThreadMessages2.filter(m => m.threadId === `thread-two`)).toHaveLength(3);

      const crossThreadMessages3 = await store.getMessages({
        threadId: 'thread-two',
        format: 'v2',
        selectBy: {
          last: 0,
          include: [
            {
              id: messages[1].id,
              threadId: 'thread-one',
              withNextMessages: 1,
              withPreviousMessages: 1,
            },
          ],
        },
      });

      expect(crossThreadMessages3).toHaveLength(3);
      expect(crossThreadMessages3.filter(m => m.threadId === `thread-one`)).toHaveLength(3);
      expect(crossThreadMessages3.filter(m => m.threadId === `thread-two`)).toHaveLength(0);
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
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Message with' },
              { type: 'code', text: 'code block', language: 'typescript' },
              { type: 'text', text: 'and more text' },
            ],
          },
          createdAt: new Date(),
        },
      ] as MastraMessageV2[];

      await store.saveMessages({ messages, format: 'v2' });

      const retrievedMessages = await store.getMessages({ threadId, format: 'v2' });
      expect(retrievedMessages[0].content).toEqual(messages[0].content);
    });

    describe('getMessagesPaginated', () => {
      it('should return paginated messages with total count', async () => {
        const thread = createSampleThread();
        await store.saveThread({ thread });

        const messages = Array.from({ length: 15 }, (_, i) =>
          createSampleMessageV2({ threadId: thread.id, content: `Message ${i + 1}` }),
        );

        await store.saveMessages({ messages, format: 'v2' });

        const page1 = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 0, perPage: 5 } },
          format: 'v2',
        });
        expect(page1.messages).toHaveLength(5);
        expect(page1.total).toBe(15);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(5);
        expect(page1.hasMore).toBe(true);

        const page3 = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 2, perPage: 5 } },
          format: 'v2',
        });
        expect(page3.messages).toHaveLength(5);
        expect(page3.total).toBe(15);
        expect(page3.hasMore).toBe(false);

        const page4 = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 3, perPage: 5 } },
          format: 'v2',
        });
        expect(page4.messages).toHaveLength(0);
        expect(page4.total).toBe(15);
        expect(page4.hasMore).toBe(false);
      });

      it('should maintain chronological order in pagination', async () => {
        const thread = createSampleThread();
        await store.saveThread({ thread });

        const messages = Array.from({ length: 10 }, (_, i) => {
          const message = createSampleMessageV2({ threadId: thread.id, content: `Message ${i + 1}` });
          // Ensure different timestamps
          message.createdAt = new Date(Date.now() + i * 1000);
          return message;
        });

        await store.saveMessages({ messages, format: 'v2' });

        const page1 = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 0, perPage: 3 } },
          format: 'v2',
        });

        // Check that messages are in chronological order
        for (let i = 1; i < page1.messages.length; i++) {
          const prevMessage = page1.messages[i - 1] as MastraMessageV2;
          const currentMessage = page1.messages[i] as MastraMessageV2;
          expect(new Date(prevMessage.createdAt).getTime()).toBeLessThanOrEqual(
            new Date(currentMessage.createdAt).getTime(),
          );
        }
      });

      it('should support date filtering with pagination', async () => {
        const thread = createSampleThread();
        await store.saveThread({ thread });

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const oldMessages = Array.from({ length: 3 }, (_, i) => {
          const message = createSampleMessageV2({ threadId: thread.id, content: `Old Message ${i + 1}` });
          message.createdAt = yesterday;
          return message;
        });

        const newMessages = Array.from({ length: 4 }, (_, i) => {
          const message = createSampleMessageV2({ threadId: thread.id, content: `New Message ${i + 1}` });
          message.createdAt = tomorrow;
          return message;
        });

        await store.saveMessages({ messages: [...oldMessages, ...newMessages], format: 'v2' });

        const recentMessages = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: {
            pagination: {
              page: 0,
              perPage: 10,
              dateRange: { start: now },
            },
          },
          format: 'v2',
        });
        expect(recentMessages.messages).toHaveLength(4);
        expect(recentMessages.total).toBe(4);
      });
    });
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
          step1: {
            status: 'success',
            output: { result: 'done' },
            payload: {},
            startedAt: new Date().getTime(),
            endedAt: new Date(Date.now() + 15000).getTime(),
          },
        } as WorkflowRunState['context'],
        serializedStepGraph: [],
        runId: testRunId,
        activePaths: [],
        suspendedPaths: {},
        timestamp: Date.now(),
        status: 'success',
      };

      await store.persistWorkflowSnapshot({
        namespace: testNamespace,
        workflowName: testWorkflow,
        runId: testRunId,
        snapshot: mockSnapshot as WorkflowRunState,
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

  describe('Eval Operations', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_EVALS });
    });

    it('should retrieve evals by agent name', async () => {
      const agentName = `test-agent-${randomUUID()}`;

      // Create sample evals
      const liveEval = createSampleEval(agentName, false);
      const testEval = createSampleEval(agentName, true);
      const otherAgentEval = createSampleEval(`other-agent-${randomUUID()}`, false);

      // Insert evals
      await store.insert({
        tableName: TABLE_EVALS,
        record: liveEval,
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: testEval,
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: otherAgentEval,
      });

      // Test getting all evals for the agent
      const allEvals = await store.getEvalsByAgentName(agentName);
      expect(allEvals).toHaveLength(2);
      expect(allEvals.map(e => e.runId)).toEqual(expect.arrayContaining([liveEval.run_id, testEval.run_id]));

      // Test getting only live evals
      const liveEvals = await store.getEvalsByAgentName(agentName, 'live');
      expect(liveEvals).toHaveLength(1);
      expect(liveEvals[0].runId).toBe(liveEval.run_id);

      // Test getting only test evals
      const testEvals = await store.getEvalsByAgentName(agentName, 'test');
      expect(testEvals).toHaveLength(1);
      expect(testEvals[0].runId).toBe(testEval.run_id);

      // Verify the test_info was properly parsed
      if (testEval.test_info) {
        const expectedTestInfo = JSON.parse(testEval.test_info);
        expect(testEvals[0].testInfo).toEqual(expectedTestInfo);
      }

      // Test getting evals for non-existent agent
      const nonExistentEvals = await store.getEvalsByAgentName('non-existent-agent');
      expect(nonExistentEvals).toHaveLength(0);
    });
  });

  describe('getWorkflowRuns', () => {
    const testNamespace = 'test-namespace';
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });
    it('returns empty array when no workflows exist', async () => {
      const { runs, total } = await store.getWorkflowRuns();
      expect(runs).toEqual([]);
      expect(total).toBe(0);
    });

    it('returns all workflows by default', async () => {
      const workflowName1 = 'default_test_1';
      const workflowName2 = 'default_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('waiting');

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

      const { runs, total } = await store.getWorkflowRuns({ namespace: testNamespace });
      expect(runs).toHaveLength(2);
      expect(total).toBe(2);
      expect(runs[0]!.workflowName).toBe(workflowName2); // Most recent first
      expect(runs[1]!.workflowName).toBe(workflowName1);
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId2, 'waiting');
      checkWorkflowSnapshot(secondSnapshot, stepId1, 'success');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
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

      const { runs, total } = await store.getWorkflowRuns({ namespace: testNamespace, workflowName: workflowName1 });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot;
      checkWorkflowSnapshot(snapshot, stepId1, 'success');
    });

    it('filters by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const workflowName1 = 'date_test_1';
      const workflowName2 = 'date_test_2';
      const workflowName3 = 'date_test_3';

      const { snapshot: workflow1, runId: runId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('waiting');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('skipped');

      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace: testNamespace,
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
          namespace: testNamespace,
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
          namespace: testNamespace,
          workflow_name: workflowName3,
          run_id: runId3,
          snapshot: workflow3,
          createdAt: now,
          updatedAt: now,
        },
      });

      const { runs } = await store.getWorkflowRuns({
        namespace: testNamespace,
        fromDate: yesterday,
        toDate: now,
      });

      expect(runs).toHaveLength(2);
      expect(runs[0]!.workflowName).toBe(workflowName3);
      expect(runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'skipped');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'waiting');
    });

    it('handles pagination', async () => {
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('waiting');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('skipped');

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
      const page1 = await store.getWorkflowRuns({
        namespace: testNamespace,
        limit: 2,
        offset: 0,
      });
      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records
      expect(page1.runs[0]!.workflowName).toBe(workflowName3);
      expect(page1.runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = page1.runs[0]!.snapshot;
      const secondSnapshot = page1.runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'skipped');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'waiting');

      // Get second page
      const page2 = await store.getWorkflowRuns({
        namespace: testNamespace,
        limit: 2,
        offset: 2,
      });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot;
      checkWorkflowSnapshot(snapshot, stepId1, 'success');
    });
  });
  describe('getWorkflowRunById', () => {
    const testNamespace = 'test-workflows-id';
    const workflowName = 'workflow-id-test';
    let runId: string;
    let stepId: string;

    beforeAll(async () => {
      // Insert a workflow run for positive test
      const sample = createSampleWorkflowSnapshot('success');
      runId = sample.runId;
      stepId = sample.stepId;
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace: testNamespace,
          workflow_name: workflowName,
          run_id: runId,
          resourceId: 'resource-abc',
          snapshot: sample.snapshot,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    it('should retrieve a workflow run by ID', async () => {
      const found = await store.getWorkflowRunById({
        namespace: testNamespace,
        runId,
        workflowName,
      });
      expect(found).not.toBeNull();
      expect(found?.runId).toBe(runId);
      const snapshot = found?.snapshot;
      checkWorkflowSnapshot(snapshot!, stepId, 'success');
    });

    it('should return null for non-existent workflow run ID', async () => {
      const notFound = await store.getWorkflowRunById({
        namespace: testNamespace,
        runId: 'non-existent-id',
        workflowName,
      });
      expect(notFound).toBeNull();
    });
  });
  describe('getWorkflowRuns with resourceId', () => {
    const testNamespace = 'test-workflows-id';
    const workflowName = 'workflow-id-test';
    let resourceId: string;
    let runIds: string[] = [];

    beforeAll(async () => {
      // Insert multiple workflow runs for the same resourceId
      resourceId = 'resource-shared';
      for (const status of ['success', 'waiting']) {
        const sample = createSampleWorkflowSnapshot(status);
        runIds.push(sample.runId);
        await store.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            namespace: testNamespace,
            workflow_name: workflowName,
            run_id: sample.runId,
            resourceId,
            snapshot: sample.snapshot,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      // Insert a run with a different resourceId
      const other = createSampleWorkflowSnapshot('waiting');
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace: testNamespace,
          workflow_name: workflowName,
          run_id: other.runId,
          resourceId: 'resource-other',
          snapshot: other.snapshot,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    it('should retrieve all workflow runs by resourceId', async () => {
      const { runs } = await store.getWorkflowRuns({
        namespace: testNamespace,
        resourceId,
        workflowName,
      });
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBeGreaterThanOrEqual(2);
      for (const run of runs) {
        expect(run.resourceId).toBe(resourceId);
      }
    });

    it('should return an empty array if no workflow runs match resourceId', async () => {
      const { runs } = await store.getWorkflowRuns({
        namespace: testNamespace,
        resourceId: 'non-existent-resource',
        workflowName,
      });
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBe(0);
    });
  });

  describe('alterTable (no-op/schemaless)', () => {
    const TEST_TABLE = 'test_alter_table'; // Use "table" or "collection" as appropriate
    beforeEach(async () => {
      await store.clearTable({ tableName: TEST_TABLE as TABLE_NAMES });
    });

    afterEach(async () => {
      await store.clearTable({ tableName: TEST_TABLE as TABLE_NAMES });
    });

    it('allows inserting records with new fields without alterTable', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '1', name: 'Alice' },
      });
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '2', name: 'Bob', newField: 123 },
      });

      const row = await store.load<{ id: string; name: string; newField?: number }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '2' },
      });
      expect(row?.newField).toBe(123);
    });

    it('does not throw when calling alterTable (no-op)', async () => {
      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: {
            id: { type: 'text', primaryKey: true, nullable: false },
            name: { type: 'text', nullable: true },
            extra: { type: 'integer', nullable: true },
          },
          ifNotExists: [],
        }),
      ).resolves.not.toThrow();
    });

    it('can add multiple new fields at write time', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '3', name: 'Charlie', age: 30, city: 'Paris' },
      });
      const row = await store.load<{ id: string; name: string; age?: number; city?: string }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '3' },
      });
      expect(row?.age).toBe(30);
      expect(row?.city).toBe('Paris');
    });

    it('can retrieve all fields, including dynamically added ones', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '4', name: 'Dana', hobby: 'skiing' },
      });
      const row = await store.load<{ id: string; name: string; hobby?: string }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '4' },
      });
      expect(row?.hobby).toBe('skiing');
    });

    it('does not restrict or error on arbitrary new fields', async () => {
      await expect(
        store.insert({
          tableName: TEST_TABLE as TABLE_NAMES,
          record: { id: '5', weirdField: { nested: true }, another: [1, 2, 3] },
        }),
      ).resolves.not.toThrow();

      const row = await store.load<{ id: string; weirdField?: any; another?: any }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '5' },
      });
      expect(row?.weirdField).toEqual({ nested: true });
      expect(row?.another).toEqual([1, 2, 3]);
    });
  });

  describe('Pagination Features', () => {
    beforeEach(async () => {
      // Clear all test data
      await store.clearTable({ tableName: TABLE_THREADS });
      await store.clearTable({ tableName: TABLE_MESSAGES });
      await store.clearTable({ tableName: TABLE_EVALS });
      await store.clearTable({ tableName: TABLE_TRACES });
    });

    describe('getEvals with pagination', () => {
      it('should return paginated evals with total count', async () => {
        const agentName = 'test-agent';
        const evals = Array.from({ length: 25 }, (_, i) => createSampleEval(agentName, i % 2 === 0));

        // Insert all evals
        for (const evalRecord of evals) {
          await store.insert({
            tableName: TABLE_EVALS,
            record: evalRecord,
          });
        }

        // Test page-based pagination
        const page1 = await store.getEvals({ agentName, page: 0, perPage: 10 });
        expect(page1.evals).toHaveLength(10);
        expect(page1.total).toBe(25);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(10);
        expect(page1.hasMore).toBe(true);

        const page2 = await store.getEvals({ agentName, page: 1, perPage: 10 });
        expect(page2.evals).toHaveLength(10);
        expect(page2.total).toBe(25);
        expect(page2.hasMore).toBe(true);

        const page3 = await store.getEvals({ agentName, page: 2, perPage: 10 });
        expect(page3.evals).toHaveLength(5);
        expect(page3.total).toBe(25);
        expect(page3.hasMore).toBe(false);
      });

      it('should support page/perPage pagination', async () => {
        const agentName = 'test-agent-2';
        const evals = Array.from({ length: 15 }, () => createSampleEval(agentName));

        for (const evalRecord of evals) {
          await store.insert({
            tableName: TABLE_EVALS,
            record: evalRecord,
          });
        }

        // Test offset-based pagination
        const result1 = await store.getEvals({ agentName, page: 0, perPage: 5 });
        expect(result1.evals).toHaveLength(5);
        expect(result1.total).toBe(15);
        expect(result1.hasMore).toBe(true);

        const result2 = await store.getEvals({ agentName, page: 2, perPage: 5 });
        expect(result2.evals).toHaveLength(5);
        expect(result2.total).toBe(15);
        expect(result2.hasMore).toBe(false);
      });

      it('should filter by type with pagination', async () => {
        const agentName = 'test-agent-3';
        const testEvals = Array.from({ length: 10 }, () => createSampleEval(agentName, true));
        const liveEvals = Array.from({ length: 8 }, () => createSampleEval(agentName, false));

        for (const evalRecord of [...testEvals, ...liveEvals]) {
          await store.insert({
            tableName: TABLE_EVALS,
            record: evalRecord,
          });
        }

        const testResults = await store.getEvals({ agentName, type: 'test', page: 0, perPage: 5 });
        expect(testResults.evals).toHaveLength(5);
        expect(testResults.total).toBe(10);

        const liveResults = await store.getEvals({ agentName, type: 'live', page: 0, perPage: 5 });
        expect(liveResults.evals).toHaveLength(5);
        expect(liveResults.total).toBe(8);
      });

      it('should filter by date with pagination', async () => {
        const agentName = 'test-agent-date';
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const evals = [createSampleEval(agentName, false, now), createSampleEval(agentName, false, yesterday)];
        for (const evalRecord of evals) {
          await store.insert({
            tableName: TABLE_EVALS,
            record: evalRecord,
          });
        }
        const result = await store.getEvals({
          agentName,
          page: 0,
          perPage: 10,
          dateRange: { start: now },
        });
        expect(result.evals).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });

    describe('getTraces with pagination', () => {
      it('should return paginated traces with total count', async () => {
        const traces = Array.from({ length: 18 }, (_, i) => createSampleTrace(`test-trace-${i}`, 'test-scope'));

        for (const trace of traces) {
          await store.insert({
            tableName: TABLE_TRACES,
            record: trace,
          });
        }

        const page1 = await store.getTracesPaginated({
          scope: 'test-scope',
          page: 0,
          perPage: 8,
        });
        expect(page1.traces).toHaveLength(8);
        expect(page1.total).toBe(18);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(8);
        expect(page1.hasMore).toBe(true);

        const page3 = await store.getTracesPaginated({
          scope: 'test-scope',
          page: 2,
          perPage: 8,
        });
        expect(page3.traces).toHaveLength(2);
        expect(page3.total).toBe(18);
        expect(page3.hasMore).toBe(false);
      });

      it('should filter by date with pagination', async () => {
        const scope = 'test-scope-date';
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const traces = [
          createSampleTrace(`test-trace-now`, scope, undefined, now),
          createSampleTrace(`test-trace-yesterday`, scope, undefined, yesterday),
        ];

        for (const trace of traces) {
          await store.insert({
            tableName: TABLE_TRACES,
            record: trace,
          });
        }

        const result = await store.getTracesPaginated({
          scope,
          page: 0,
          perPage: 10,
          dateRange: { start: now },
        });

        expect(result.traces).toHaveLength(1);
        expect(result.traces[0].name).toBe('test-trace-now');
        expect(result.total).toBe(1);
      });
    });

    describe('Enhanced existing methods with pagination', () => {
      it('should support pagination in getThreadsByResourceId', async () => {
        const resourceId = 'enhanced-resource';
        const threads = Array.from({ length: 17 }, () => createSampleThread({ resourceId }));

        for (const thread of threads) {
          await store.saveThread({ thread });
        }

        const page1 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 0, perPage: 7 });
        expect(page1.threads).toHaveLength(7);

        const page3 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 2, perPage: 7 });
        expect(page3.threads).toHaveLength(3);

        const limited = await store.getThreadsByResourceIdPaginated({ resourceId, page: 1, perPage: 5 });
        expect(limited.threads).toHaveLength(5);
      });
    });
  });
});
