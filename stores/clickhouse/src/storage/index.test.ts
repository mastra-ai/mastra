import { randomUUID } from 'crypto';
import type { WorkflowRunState } from '@mastra/core';
import type { MessageType } from '@mastra/core/memory';
import { TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, afterEach } from 'vitest';

import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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

const createSampleMessage = (threadId: string, createdAt: Date = new Date()): MessageType => ({
  id: `msg-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  role: 'user',
  type: 'text',
  threadId,
  content: [{ type: 'text', text: 'Hello' }] as MessageType['content'],
  createdAt,
});

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

const createSampleWorkflowSnapshot = (status: WorkflowRunState['context']['steps']['status'], createdAt?: Date) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = createdAt || new Date();
  const snapshot = {
    result: { success: true },
    value: {},
    context: {
      [stepId]: {
        status,
        payload: {},
        error: undefined,
        startedAt: timestamp.getTime(),
        endedAt: new Date(timestamp.getTime() + 15000).getTime(),
      },
      input: {},
    },
    serializedStepGraph: [],
    activePaths: [],
    suspendedPaths: {},
    runId,
    timestamp: timestamp.getTime(),
  } as unknown as WorkflowRunState;
  return { snapshot, runId, stepId };
};

const checkWorkflowSnapshot = (snapshot: WorkflowRunState | string, stepId: string, status: string) => {
  if (typeof snapshot === 'string') {
    throw new Error('Expected WorkflowRunState, got string');
  }
  expect(snapshot.context?.[stepId]?.status).toBe(status);
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
      const checkMessages = messages.map(m => {
        const { resourceId, ...rest } = m;
        return rest;
      });
      expect(retrievedMessages).toEqual(expect.arrayContaining(checkMessages));
    }, 10e3);

    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    }, 10e3);

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages: MessageType[] = [
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

      const retrievedMessages = await store.getMessages<MessageType>({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        // @ts-expect-error
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
          input: { type: 'manual' },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
      } as unknown as WorkflowRunState;

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
          input: { type: 'manual' },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
      } as unknown as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: initialSnapshot,
      });

      const updatedSnapshot = {
        status: 'completed',
        context: {
          input: { type: 'manual' },
          'step-1': { status: 'success', result: { data: 'test' } },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
      } as unknown as WorkflowRunState;

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
          'step-1': {
            status: 'success',
            output: {
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
          input: {
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
        suspendedPaths: {},
        runId: runId,
        timestamp: Date.now(),
      } as unknown as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: complexSnapshot,
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

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('suspended');

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
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId2, 'suspended');
      checkWorkflowSnapshot(secondSnapshot, stepId1, 'success');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
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
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('suspended');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('failed');

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
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'failed');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'suspended');
    });

    it('handles pagination', async () => {
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('suspended');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('failed');

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
      const firstSnapshot = page1.runs[0]!.snapshot;
      const secondSnapshot = page1.runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'failed');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'suspended');

      // Get second page
      const page2 = await store.getWorkflowRuns({
        limit: 2,
        offset: 2,
      });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot!;
      checkWorkflowSnapshot(snapshot, stepId1, 'success');
    }, 10e3);
  });
  describe('getWorkflowRunById', () => {
    const workflowName = 'workflow-id-test';
    let runId: string;
    let stepId: string;

    beforeEach(async () => {
      // Insert a workflow run for positive test
      const sample = createSampleWorkflowSnapshot('success');
      runId = sample.runId;
      stepId = sample.stepId;
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
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
        runId,
        workflowName,
      });
      expect(found).not.toBeNull();
      expect(found?.runId).toBe(runId);
      checkWorkflowSnapshot(found?.snapshot!, stepId, 'success');
    });

    it('should return null for non-existent workflow run ID', async () => {
      const notFound = await store.getWorkflowRunById({
        runId: 'non-existent-id',
        workflowName,
      });
      expect(notFound).toBeNull();
    });
  });
  describe('getWorkflowRuns with resourceId', () => {
    const workflowName = 'workflow-id-test';
    let resourceId: string;
    let runIds: string[] = [];

    beforeEach(async () => {
      // Insert multiple workflow runs for the same resourceId
      resourceId = 'resource-shared';
      for (const status of ['completed', 'running']) {
        const sample = createSampleWorkflowSnapshot(status as WorkflowRunState['context']['steps']['status']);
        runIds.push(sample.runId);
        await store.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
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
      const other = createSampleWorkflowSnapshot('suspended');
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
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
        resourceId: 'non-existent-resource',
        workflowName,
      });
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBe(0);
    });
  });

  describe('hasColumn', () => {
    const tempTable = 'temp_test_table';

    beforeEach(async () => {
      // Always try to drop the table before each test, ignore errors if it doesn't exist
      try {
        await store['db'].query({ query: `DROP TABLE IF EXISTS ${tempTable}` });
      } catch {
        /* ignore */
      }
    });

    it('returns true if the column exists', async () => {
      await store['db'].query({
        query: `CREATE TABLE temp_test_table (
          id UInt64,
          resourceId String
        ) ENGINE = MergeTree()
        ORDER BY id
        `,
      });
      expect(await store['hasColumn'](tempTable, 'resourceId')).toBe(true);
    });

    it('returns false if the column does not exist', async () => {
      await store['db'].query({
        query: `CREATE TABLE temp_test_table (
          id UInt64,
        ) ENGINE = MergeTree()
        ORDER BY id
        `,
      });
      expect(await store['hasColumn'](tempTable, 'resourceId')).toBe(false);
    });

    afterEach(async () => {
      // Clean up after each test
      try {
        await store['db'].query({ query: `DROP TABLE IF EXISTS ${tempTable}` });
      } catch {
        /* ignore */
      }
    });
  });

  afterAll(async () => {
    await store.close();
  });
});
