import { randomUUID } from 'crypto';
import { TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

const TEST_CONFIG: ClickhouseConfig = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  ttl: {
    mastra_traces: {
      row: { interval: 10, unit: 'SECOND' },
    },
    mastra_evals: {
      columns: {
        result: { interval: 10, unit: 'SECOND' },
      },
    },
  },
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

const createSampleMessage = (threadId: string, createdAt: Date = new Date()) =>
  ({
    id: `msg-${randomUUID()}`,
    role: 'user',
    type: 'text',
    threadId,
    content: [{ type: 'text', text: 'Hello' }],
    createdAt,
  }) as any;

const createSampleTrace = () => ({
  id: `trace-${randomUUID()}`,
  name: 'Test Trace',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { key: 'value' },
});

const createSampleEval = () => ({
  agent_name: 'test-agent',
  run_id: 'test-run-1',
  result: '{ "score": 1 }',
  createdAt: new Date(),
});

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

describe('ClickhouseStore', () => {
  let store: ClickhouseStore;

  beforeAll(async () => {
    store = new ClickhouseStore(TEST_CONFIG);
    await store.init();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
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
    }, 10e3);

    it('should return null for non-existent thread', async () => {
      const result = await store.getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    }, 10e3);

    it('should get threads by resource ID', async () => {
      const thread1 = createSampleThread();
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };

      await store.saveThread({ thread: thread1 });
      await store.saveThread({ thread: thread2 });

      const threads = await store.getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    }, 10e3);

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
    }, 10e3);

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
    }, 10e3);
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id, new Date(Date.now() - 1000 * 60 * 60 * 24)),
        createSampleMessage(thread.id),
      ];

      // Save messages
      const savedMessages = await store.saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(2);
      expect(retrievedMessages).toEqual(expect.arrayContaining(messages));
    }, 10e3);

    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    }, 10e3);

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        {
          ...createSampleMessage(thread.id, new Date(Date.now() - 1000 * 3)),
          content: [{ type: 'text', text: 'First' }],
        },
        {
          ...createSampleMessage(thread.id, new Date(Date.now() - 1000 * 2)),
          content: [{ type: 'text', text: 'Second' }],
        },
        {
          ...createSampleMessage(thread.id, new Date(Date.now() - 1000 * 1)),
          content: [{ type: 'text', text: 'Third' }],
        },
      ];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content[0].text).toBe(messages[idx].content[0].text);
      });
    }, 10e3);

    // it('should rollback on error during message save', async () => {
    //   const thread = createSampleThread();
    //   await store.saveThread({ thread });

    //   const messages = [
    //     createSampleMessage(thread.id),
    //     { ...createSampleMessage(thread.id), id: null }, // This will cause an error
    //   ];

    //   await expect(store.saveMessages({ messages })).rejects.toThrow();

    //   // Verify no messages were saved
    //   const savedMessages = await store.getMessages({ threadId: thread.id });
    //   expect(savedMessages).toHaveLength(0);
    // });
  });

  describe('Traces and TTL', () => {
    it('should create and retrieve a trace, but not when row level ttl expires', async () => {
      const trace = createSampleTrace();
      await store.batchInsert({
        tableName: 'mastra_traces',
        records: [trace],
      });
      let traces = await store.getTraces({
        page: 0,
        perPage: 10,
      });

      expect(traces).toHaveLength(1);
      expect(traces[0]!.id).toBe(trace.id);

      await new Promise(resolve => setTimeout(resolve, 10e3));
      await store.optimizeTable({ tableName: 'mastra_traces' });

      traces = await store.getTraces({
        page: 0,
        perPage: 10,
      });

      expect(traces).toHaveLength(0);
    }, 60e3);

    // NOTE: unable to clear column level TTLs for the test case nicely, but it does seem to get applied correctly
    it.skip('should create and retrieve a trace, but not expired columns when column level ttl expires', async () => {
      await store.clearTable({ tableName: 'mastra_evals' });
      const ev = createSampleEval();
      await store.batchInsert({
        tableName: 'mastra_evals',
        records: [ev],
      });
      let evals = await store.getEvalsByAgentName('test-agent');
      console.log(evals);

      expect(evals).toHaveLength(1);
      expect(evals[0]!.agentName).toBe('test-agent');
      expect(evals[0]!.runId).toBe('test-run-1');

      await new Promise(resolve => setTimeout(resolve, 12e3));
      await store.materializeTtl({ tableName: 'mastra_evals' });
      await store.optimizeTable({ tableName: 'mastra_evals' });

      evals = await store.getEvalsByAgentName('test-agent');

      expect(evals).toHaveLength(1);
      expect(evals[0]!.agentName).toBe('test-agent');
      expect(evals[0]!.runId).toBeNull();
    }, 60e3);
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
    }, 10e3);

    it('should handle special characters in thread titles', async () => {
      const thread = {
        ...createSampleThread(),
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      };

      await store.saveThread({ thread });
      const retrieved = await store.getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    }, 10e3);

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
    }, 10e3);
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
    }, 10e3);

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await store.loadWorkflowSnapshot({
        workflowName: 'non-existent',
        runId: 'non-existent',
      });

      expect(result).toBeNull();
    }, 10e3);

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
    }, 10e3);

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
        snapshot: complexSnapshot as WorkflowRunState,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    }, 10e3);
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

      await store.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

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

      await store.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await store.getWorkflowRuns({
        workflowName: workflowName1,
      });
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

      await store.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        workflowName: workflowName3,
        runId: runId3,
        snapshot: workflow3,
      });

      // Get first page
      const page1 = await store.getWorkflowRuns({
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
        limit: 2,
        offset: 2,
      });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.steps[stepId1]?.status).toBe('completed');
    }, 10e3);
  });

  afterAll(async () => {
    await store.close();
  });
});
