import { randomUUID } from 'crypto';
import type { MetricResult } from '@mastra/core/eval';
import type { MessageType } from '@mastra/core/memory';
import { TABLE_WORKFLOW_SNAPSHOT, TABLE_MESSAGES, TABLE_THREADS, TABLE_EVALS } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';

import { PostgresStore } from '.';
import type { PostgresConfig } from '.';

const TEST_CONFIG: PostgresConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

const connectionString = `postgresql://${TEST_CONFIG.user}:${TEST_CONFIG.password}@${TEST_CONFIG.host}:${TEST_CONFIG.port}/${TEST_CONFIG.database}`;

// Sample test data factory functions
const createSampleThread = () => ({
  id: `thread-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  title: 'Test Thread',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { key: 'value' },
});

const createSampleMessage = (threadId: string) =>
  ({
    id: `msg-${randomUUID()}`,
    role: 'user',
    type: 'text',
    threadId,
    content: [{ type: 'text', text: 'Hello' }],
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

const createSampleEval = (agentName: string, isTest = false) => {
  const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

  return {
    id: randomUUID(),
    agentName,
    input: 'Sample input',
    output: 'Sample output',
    result: { score: 0.8 } as MetricResult,
    metricName: 'sample-metric',
    instructions: 'Sample instructions',
    testInfo,
    globalRunId: `global-${randomUUID()}`,
    runId: `run-${randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
};

describe('PostgresStore', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
  });

  beforeEach(async () => {
    // Only clear tables if store is initialized
    try {
      // Clear tables before each test
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
      await store.clearTable({ tableName: TABLE_MESSAGES });
      await store.clearTable({ tableName: TABLE_THREADS });
      await store.clearTable({ tableName: TABLE_EVALS });
    } catch (error) {
      // Ignore errors during table clearing
      console.warn('Error clearing tables:', error);
    }
  });

  // --- Validation tests ---
  describe('Validation', () => {
    const validConfig = TEST_CONFIG;
    it('throws if connectionString is empty', () => {
      expect(() => new PostgresStore({ connectionString: '' })).toThrow(
        /connectionString must be provided and cannot be empty/,
      );
    });
    it('throws if host is missing or empty', () => {
      expect(() => new PostgresStore({ ...validConfig, host: '' })).toThrow(
        /host must be provided and cannot be empty/,
      );
      const { host, ...rest } = validConfig;
      expect(() => new PostgresStore(rest as any)).toThrow(/host must be provided and cannot be empty/);
    });
    it('throws if user is missing or empty', () => {
      expect(() => new PostgresStore({ ...validConfig, user: '' })).toThrow(
        /user must be provided and cannot be empty/,
      );
      const { user, ...rest } = validConfig;
      expect(() => new PostgresStore(rest as any)).toThrow(/user must be provided and cannot be empty/);
    });
    it('throws if database is missing or empty', () => {
      expect(() => new PostgresStore({ ...validConfig, database: '' })).toThrow(
        /database must be provided and cannot be empty/,
      );
      const { database, ...rest } = validConfig;
      expect(() => new PostgresStore(rest as any)).toThrow(/database must be provided and cannot be empty/);
    });
    it('throws if password is missing or empty', () => {
      expect(() => new PostgresStore({ ...validConfig, password: '' })).toThrow(
        /password must be provided and cannot be empty/,
      );
      const { password, ...rest } = validConfig;
      expect(() => new PostgresStore(rest as any)).toThrow(/password must be provided and cannot be empty/);
    });
    it('does not throw on valid config (host-based)', () => {
      expect(() => new PostgresStore(validConfig)).not.toThrow();
    });
    it('does not throw on non-empty connection string', () => {
      expect(() => new PostgresStore({ connectionString })).not.toThrow();
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toEqual(thread.title);
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

      const threads = await store.getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const newMetadata = { newKey: 'newValue' };
      const updatedThread = await store.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: newMetadata,
      });

      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({
        ...thread.metadata,
        ...newMetadata,
      });

      // Verify persistence
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toEqual(updatedThread);
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];
      await store.saveMessages({ messages });

      await store.deleteThread({ threadId: thread.id });

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];

      // Save messages
      const savedMessages = await store.saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(2);
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
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'First' }] as MessageType['content'] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Second' }] as MessageType['content'] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Third' }] as MessageType['content'] },
      ];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect((msg.content[0] as any).text).toBe((messages[idx].content[0] as any).text);
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id),
        { ...createSampleMessage(thread.id), id: null } as any, // This will cause an error
      ];

      await expect(store.saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await store.getMessages({ threadId: thread.id });
      expect(savedMessages).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle large metadata objects', async () => {
      const thread = createSampleThread();
      const largeMetadata = {
        ...thread.metadata,
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ index: i, data: 'test'.repeat(100) })),
      };

      const threadWithLargeMetadata = {
        ...thread,
        metadata: largeMetadata,
      };

      await store.saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await store.getThreadById({ threadId: thread.id });

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle special characters in thread titles', async () => {
      const thread = {
        ...createSampleThread(),
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      };

      await store.saveThread({ thread });
      const retrieved = await store.getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    });

    it('should handle concurrent thread updates', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Perform multiple updates concurrently
      const updates = Array.from({ length: 5 }, (_, i) =>
        store.updateThread({
          id: thread.id,
          title: `Update ${i}`,
          metadata: { update: i },
        }),
      );

      await expect(Promise.all(updates)).resolves.toBeDefined();

      // Verify final state
      const finalThread = await store.getThreadById({ threadId: thread.id });
      expect(finalThread).toBeDefined();
    });
  });

  describe('Workflow Snapshots', () => {
    it('should persist and load workflow snapshots', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {
          stepResults: {},
          attempts: {},
          triggerData: { type: 'manual' },
        },
      } as any;

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(snapshot);
    });

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await store.loadWorkflowSnapshot({
        workflowName: 'non-existent',
        runId: 'non-existent',
      });

      expect(result).toBeNull();
    });

    it('should update existing workflow snapshot', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const initialSnapshot = {
        status: 'running',
        context: {
          stepResults: {},
          attempts: {},
          triggerData: { type: 'manual' },
        },
      };

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: initialSnapshot as any,
      });

      const updatedSnapshot = {
        status: 'completed',
        context: {
          stepResults: {
            'step-1': { status: 'success', result: { data: 'test' } },
          },
          attempts: { 'step-1': 1 },
          triggerData: { type: 'manual' },
        },
      } as any;

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(updatedSnapshot);
    });

    it('should handle complex workflow state', async () => {
      const workflowName = 'complex-workflow';
      const runId = `run-${randomUUID()}`;
      const complexSnapshot = {
        value: { currentState: 'running' },
        context: {
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
        runId: runId,
        timestamp: Date.now(),
      };

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: complexSnapshot as unknown as WorkflowRunState,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });
  });

  describe('getWorkflowRuns', () => {
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

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

      const { runs, total } = await store.getWorkflowRuns();
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

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

      const { runs, total } = await store.getWorkflowRuns({ workflowName: workflowName1 });
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

      const { runs } = await store.getWorkflowRuns({
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

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName3, runId: runId3, snapshot: workflow3 });

      // Get first page
      const page1 = await store.getWorkflowRuns({ limit: 2, offset: 0 });
      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records
      expect(page1.runs[0]!.workflowName).toBe(workflowName3);
      expect(page1.runs[1]!.workflowName).toBe(workflowName2);
      const firstSnapshot = page1.runs[0]!.snapshot as WorkflowRunState;
      const secondSnapshot = page1.runs[1]!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.steps[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.steps[stepId2]?.status).toBe('running');

      // Get second page
      const page2 = await store.getWorkflowRuns({ limit: 2, offset: 2 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.steps[stepId1]?.status).toBe('completed');
    });
  });

  describe('Eval Operations', () => {
    it('should retrieve evals by agent name', async () => {
      const agentName = `test-agent-${randomUUID()}`;

      // Create sample evals
      const liveEval = createSampleEval(agentName, false);
      const testEval = createSampleEval(agentName, true);
      const otherAgentEval = createSampleEval(`other-agent-${randomUUID()}`, false);

      // Insert evals
      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: liveEval.agentName,
          input: liveEval.input,
          output: liveEval.output,
          result: liveEval.result,
          metric_name: liveEval.metricName,
          instructions: liveEval.instructions,
          test_info: null,
          global_run_id: liveEval.globalRunId,
          run_id: liveEval.runId,
          created_at: liveEval.createdAt,
          createdAt: new Date(liveEval.createdAt),
        },
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: testEval.agentName,
          input: testEval.input,
          output: testEval.output,
          result: testEval.result,
          metric_name: testEval.metricName,
          instructions: testEval.instructions,
          test_info: JSON.stringify(testEval.testInfo),
          global_run_id: testEval.globalRunId,
          run_id: testEval.runId,
          created_at: testEval.createdAt,
          createdAt: new Date(testEval.createdAt),
        },
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: otherAgentEval.agentName,
          input: otherAgentEval.input,
          output: otherAgentEval.output,
          result: otherAgentEval.result,
          metric_name: otherAgentEval.metricName,
          instructions: otherAgentEval.instructions,
          test_info: null,
          global_run_id: otherAgentEval.globalRunId,
          run_id: otherAgentEval.runId,
          created_at: otherAgentEval.createdAt,
          createdAt: new Date(otherAgentEval.createdAt),
        },
      });

      // Test getting all evals for the agent
      const allEvals = await store.getEvalsByAgentName(agentName);
      expect(allEvals).toHaveLength(2);
      expect(allEvals.map(e => e.runId)).toEqual(expect.arrayContaining([liveEval.runId, testEval.runId]));

      // Test getting only live evals
      const liveEvals = await store.getEvalsByAgentName(agentName, 'live');
      expect(liveEvals).toHaveLength(1);
      expect(liveEvals[0].runId).toBe(liveEval.runId);

      // Test getting only test evals
      const testEvals = await store.getEvalsByAgentName(agentName, 'test');
      expect(testEvals).toHaveLength(1);
      expect(testEvals[0].runId).toBe(testEval.runId);
      expect(testEvals[0].testInfo).toEqual(testEval.testInfo);

      // Test getting evals for non-existent agent
      const nonExistentEvals = await store.getEvalsByAgentName('non-existent-agent');
      expect(nonExistentEvals).toHaveLength(0);
    });
  });

  describe('Schema Support', () => {
    const customSchema = 'mastra_test';
    let customSchemaStore: PostgresStore;

    beforeAll(async () => {
      customSchemaStore = new PostgresStore({
        ...TEST_CONFIG,
        schemaName: customSchema,
      });

      await customSchemaStore.init();
    });

    afterAll(async () => {
      await customSchemaStore.close();
      // Re-initialize the main store for subsequent tests
      store = new PostgresStore(TEST_CONFIG);
      await store.init();
    });

    describe('Constructor and Initialization', () => {
      it('should accept connectionString directly', () => {
        // Use existing store instead of creating new one
        expect(store).toBeInstanceOf(PostgresStore);
      });

      it('should accept config object with schema', () => {
        // Use existing custom schema store
        expect(customSchemaStore).toBeInstanceOf(PostgresStore);
      });
    });

    describe('Schema Operations', () => {
      it('should create and query tables in custom schema', async () => {
        // Create thread in custom schema
        const thread = createSampleThread();
        await customSchemaStore.saveThread({ thread });

        // Verify thread exists in custom schema
        const retrieved = await customSchemaStore.getThreadById({ threadId: thread.id });
        expect(retrieved?.title).toBe(thread.title);
      });

      it('should allow same table names in different schemas', async () => {
        // Create threads in both schemas
        const defaultThread = createSampleThread();
        const customThread = createSampleThread();

        await store.saveThread({ thread: defaultThread });
        await customSchemaStore.saveThread({ thread: customThread });

        // Verify threads exist in respective schemas
        const defaultResult = await store.getThreadById({ threadId: defaultThread.id });
        const customResult = await customSchemaStore.getThreadById({ threadId: customThread.id });

        expect(defaultResult?.id).toBe(defaultThread.id);
        expect(customResult?.id).toBe(customThread.id);

        // Verify cross-schema isolation
        const defaultInCustom = await customSchemaStore.getThreadById({ threadId: defaultThread.id });
        const customInDefault = await store.getThreadById({ threadId: customThread.id });

        expect(defaultInCustom).toBeNull();
        expect(customInDefault).toBeNull();
      });
    });
  });

  describe('Permission Handling', () => {
    const schemaRestrictedUser = 'mastra_schema_restricted_storage';
    const restrictedPassword = 'test123';
    const testSchema = 'test_schema';
    let adminDb: pgPromise.IDatabase<{}>;
    let pgpAdmin: pgPromise.IMain;

    beforeAll(async () => {
      // Create a separate pg-promise instance for admin operations
      pgpAdmin = pgPromise();
      adminDb = pgpAdmin(connectionString);
      try {
        await adminDb.tx(async t => {
          // Drop the test schema if it exists from previous runs
          await t.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

          // Create schema restricted user with minimal permissions
          await t.none(`          
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${schemaRestrictedUser}') THEN
              CREATE USER ${schemaRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
            END IF;
          END
          $$;`);

          // Grant only connect and usage to schema restricted user
          await t.none(`
            REVOKE ALL ON DATABASE ${TEST_CONFIG.database} FROM ${schemaRestrictedUser};
            GRANT CONNECT ON DATABASE ${TEST_CONFIG.database} TO ${schemaRestrictedUser};
            REVOKE ALL ON SCHEMA public FROM ${schemaRestrictedUser};
            GRANT USAGE ON SCHEMA public TO ${schemaRestrictedUser};
          `);
        });
      } catch (error) {
        // Clean up the database connection on error
        pgpAdmin.end();
        throw error;
      }
    });

    afterAll(async () => {
      try {
        // First close any store connections
        if (store) {
          await store.close();
        }

        // Then clean up test user in admin connection
        await adminDb.tx(async t => {
          await t.none(`
            REASSIGN OWNED BY ${schemaRestrictedUser} TO postgres;
            DROP OWNED BY ${schemaRestrictedUser};
            DROP USER IF EXISTS ${schemaRestrictedUser};
          `);
        });

        // Finally clean up admin connection
        if (pgpAdmin) {
          pgpAdmin.end();
        }
      } catch (error) {
        console.error('Error cleaning up test user:', error);
        // Still try to clean up connections even if user cleanup fails
        if (store) await store.close();
        if (pgpAdmin) pgpAdmin.end();
      }
    });

    describe('Schema Creation', () => {
      beforeEach(async () => {
        // Create a fresh connection for each test
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          // Ensure schema doesn't exist before each test
          await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

          // Ensure no active connections from restricted user
          await tempDb.none(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE usename = '${schemaRestrictedUser}'
          `);
        } finally {
          tempPgp.end(); // Always clean up the connection
        }
      });

      afterEach(async () => {
        // Create a fresh connection for cleanup
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          // Clean up any connections from the restricted user and drop schema
          await tempDb.none(`
            DO $$
            BEGIN
              -- Terminate connections
              PERFORM pg_terminate_backend(pid) 
              FROM pg_stat_activity 
              WHERE usename = '${schemaRestrictedUser}';

              -- Drop schema
              DROP SCHEMA IF EXISTS ${testSchema} CASCADE;
            END $$;
          `);
        } catch (error) {
          console.error('Error in afterEach cleanup:', error);
        } finally {
          tempPgp.end(); // Always clean up the connection
        }
      });

      it('should fail when user lacks CREATE privilege', async () => {
        const restrictedDB = new PostgresStore({
          ...TEST_CONFIG,
          user: schemaRestrictedUser,
          password: restrictedPassword,
          schemaName: testSchema,
        });

        // Create a fresh connection for verification
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          // Test schema creation by initializing the store
          await expect(async () => {
            await restrictedDB.init();
          }).rejects.toThrow(
            `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
          );

          // Verify schema was not created
          const exists = await tempDb.oneOrNone(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
            [testSchema],
          );
          expect(exists?.exists).toBe(false);
        } finally {
          await restrictedDB.close();
          tempPgp.end(); // Clean up the verification connection
        }
      });

      it('should fail with schema creation error when saving thread', async () => {
        const restrictedDB = new PostgresStore({
          ...TEST_CONFIG,
          user: schemaRestrictedUser,
          password: restrictedPassword,
          schemaName: testSchema,
        });

        // Create a fresh connection for verification
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          await expect(async () => {
            await restrictedDB.init();
            const thread = createSampleThread();
            await restrictedDB.saveThread({ thread });
          }).rejects.toThrow(
            `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
          );

          // Verify schema was not created
          const exists = await tempDb.oneOrNone(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
            [testSchema],
          );
          expect(exists?.exists).toBe(false);
        } finally {
          await restrictedDB.close();
          tempPgp.end(); // Clean up the verification connection
        }
      });
    });
  });

  afterAll(async () => {
    try {
      await store.close();
    } catch (error) {
      console.warn('Error closing store:', error);
    }
  });
});
