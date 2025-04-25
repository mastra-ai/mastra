import { randomUUID } from 'crypto';
import type { MessageType } from '@mastra/core/memory';
import type { TABLE_NAMES } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const createSampleThread = (date?: Date) => ({
  id: `thread-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  title: 'Test Thread',
  createdAt: date || new Date(),
  updatedAt: date || new Date(),
  metadata: { key: 'value' },
});

const createSampleMessage = (threadId: string, content: string = 'Hello') =>
  ({
    id: `msg-${randomUUID()}`,
    role: 'user',
    type: 'text',
    threadId,
    content: [{ type: 'text', text: content }],
    createdAt: new Date(),
  }) as any;

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

const createSampleTrace = (name: string, scope?: string, attributes?: Record<string, string>) => ({
  id: `trace-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 'internal',
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? JSON.stringify(attributes) : undefined,
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: new Date().toISOString(),
});

const createSampleEval = (agentName: string, isTest = false) => {
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
    created_at: new Date().toISOString(),
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
      const thread = createSampleThread(now);

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
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };
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
  });

  describe('Date Handling', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_THREADS });
    });

    it('should handle Date objects in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread(now);

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle ISO string dates in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread(now);

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle mixed date formats in thread operations', async () => {
      const now = new Date();
      const thread = createSampleThread(now);

      await store.saveThread({ thread });
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle date serialization in getThreadsByResourceId', async () => {
      const now = new Date();
      const thread1 = createSampleThread(now);
      const thread2 = { ...createSampleThread(now), resourceId: thread1.resourceId };
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
      const messages = [
        createSampleMessage(threadId, 'First'),
        createSampleMessage(threadId, 'Second'),
        createSampleMessage(threadId, 'Third'),
      ];

      await store.saveMessages({ messages: messages as MessageType[] });

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
          createdAt: new Date(),
        },
      ];

      await store.saveMessages({ messages: messages as MessageType[] });

      const retrievedMessages = await store.getMessages({ threadId });
      expect(retrievedMessages[0].content).toEqual(messages[0].content);
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
          stepResults: {
            step1: { status: 'success', payload: { result: 'done' } },
          },
          attempts: {},
          triggerData: {},
        },
        runId: testRunId,
        activePaths: [],
        timestamp: Date.now(),
      } as unknown as WorkflowRunState;

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

      const { runs, total } = await store.getWorkflowRuns({ namespace: testNamespace });
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

      const { runs, total } = await store.getWorkflowRuns({ namespace: testNamespace, workflowName: workflowName1 });
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
      const page1 = await store.getWorkflowRuns({
        namespace: testNamespace,
        limit: 2,
        offset: 0,
      });
      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records
      expect(page1.runs[0]!.workflowName).toBe(workflowName3);
      expect(page1.runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = page1.runs[0]!.snapshot as WorkflowRunState;
      const secondSnapshot = page1.runs[1]!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.steps[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.steps[stepId2]?.status).toBe('running');

      // Get second page
      const page2 = await store.getWorkflowRuns({
        namespace: testNamespace,
        limit: 2,
        offset: 2,
      });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.steps[stepId1]?.status).toBe('completed');
    });
  });
});
