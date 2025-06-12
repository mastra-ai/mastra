import { randomUUID } from 'crypto';
import {
  createSampleMessageV1,
  createSampleThread,
  createSampleWorkflowSnapshot,
  checkWorkflowSnapshot,
} from '@internal/storage-test-utils';
import type { MastraMessageV1, StorageColumn, WorkflowRunState } from '@mastra/core';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, afterEach } from 'vitest';

import { ClickhouseStore, TABLE_ENGINES } from '.';
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
      const messages = [
        createSampleMessageV1({ threadId: thread.id, resourceId: 'clickhouse-test' }),
        createSampleMessageV1({ threadId: thread.id, resourceId: 'clickhouse-test' }),
      ];
      await store.saveMessages({ messages });

      await store.deleteThread({ threadId: thread.id });

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    }, 10e3);

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
      const message = createSampleMessageV1({ threadId: thread.id });
      await store.saveMessages({ messages: [message] });

      // Retrieve the thread again and check that updatedAt was updated
      const updatedThread = await store.getThreadById({ threadId: thread.id });
      expect(updatedThread).toBeDefined();
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    }, 10e3);
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessageV1({
          threadId: thread.id,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          resourceId: 'clickhouse-test',
        }),
        createSampleMessageV1({ threadId: thread.id, resourceId: 'clickhouse-test' }),
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

      const messages = [
        {
          ...createSampleMessageV1({
            threadId: thread.id,
            createdAt: new Date(Date.now() - 1000 * 3),
            content: 'First',
            resourceId: 'clickhouse-test',
          }),
          role: 'user',
        },
        {
          ...createSampleMessageV1({
            threadId: thread.id,
            createdAt: new Date(Date.now() - 1000 * 2),
            content: 'Second',
            resourceId: 'clickhouse-test',
          }),
          role: 'assistant',
        },
        {
          ...createSampleMessageV1({
            threadId: thread.id,
            createdAt: new Date(Date.now() - 1000 * 1),
            content: 'Third',
            resourceId: 'clickhouse-test',
          }),
          role: 'user',
        },
      ] as MastraMessageV1[];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        // @ts-expect-error
        expect(msg.content[0].text).toBe(messages[idx].content[0].text);
      });
    }, 10e3);

    // it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
    //   const messages: MastraMessageV2[] = [
    //     createSampleMessageV2({ threadId: 'thread-one', content: 'First', resourceId: 'cross-thread-resource' }),
    //     createSampleMessageV2({ threadId: 'thread-one', content: 'Second', resourceId: 'cross-thread-resource' }),
    //     createSampleMessageV2({ threadId: 'thread-one', content: 'Third', resourceId: 'cross-thread-resource' }),

    //     createSampleMessageV2({ threadId: 'thread-two', content: 'Fourth', resourceId: 'cross-thread-resource' }),
    //     createSampleMessageV2({ threadId: 'thread-two', content: 'Fifth', resourceId: 'cross-thread-resource' }),
    //     createSampleMessageV2({ threadId: 'thread-two', content: 'Sixth', resourceId: 'cross-thread-resource' }),

    //     createSampleMessageV2({ threadId: 'thread-three', content: 'Seventh', resourceId: 'other-resource' }),
    //     createSampleMessageV2({ threadId: 'thread-three', content: 'Eighth', resourceId: 'other-resource' }),
    //   ];

    //   await store.saveMessages({ messages: messages, format: 'v2' });

    //   const retrievedMessages = await store.getMessages({ threadId: 'thread-one', format: 'v2' });
    //   expect(retrievedMessages).toHaveLength(3);
    //   expect(retrievedMessages.map((m: any) => m.content.parts[0].text)).toEqual(['First', 'Second', 'Third']);

    //   const retrievedMessages2 = await store.getMessages({ threadId: 'thread-two', format: 'v2' });
    //   expect(retrievedMessages2).toHaveLength(3);
    //   expect(retrievedMessages2.map((m: any) => m.content.parts[0].text)).toEqual(['Fourth', 'Fifth', 'Sixth']);

    //   const retrievedMessages3 = await store.getMessages({ threadId: 'thread-three', format: 'v2' });
    //   expect(retrievedMessages3).toHaveLength(2);
    //   expect(retrievedMessages3.map((m: any) => m.content.parts[0].text)).toEqual(['Seventh', 'Eighth']);

    //   const crossThreadMessages = await store.getMessages({
    //     threadId: 'thread-doesnt-exist',
    //     resourceId: 'cross-thread-resource',
    //     format: 'v2',
    //     selectBy: {
    //       last: 0,
    //       include: [
    //         {
    //           id: messages[1].id,
    //           withNextMessages: 2,
    //           withPreviousMessages: 2,
    //         },
    //         {
    //           id: messages[4].id,
    //           withPreviousMessages: 2,
    //           withNextMessages: 2,
    //         },
    //       ],
    //     },
    //   });

    //   expect(crossThreadMessages).toHaveLength(6);
    //   expect(crossThreadMessages.filter(m => m.threadId === `thread-one`)).toHaveLength(3);
    //   expect(crossThreadMessages.filter(m => m.threadId === `thread-two`)).toHaveLength(3);

    //   const crossThreadMessages2 = await store.getMessages({
    //     threadId: 'thread-one',
    //     resourceId: 'cross-thread-resource',
    //     format: 'v2',
    //     selectBy: {
    //       last: 0,
    //       include: [
    //         {
    //           id: messages[4].id,
    //           withPreviousMessages: 1,
    //           withNextMessages: 30,
    //         },
    //       ],
    //     },
    //   });

    //   expect(crossThreadMessages2).toHaveLength(3);
    //   expect(crossThreadMessages2.filter(m => m.threadId === `thread-one`)).toHaveLength(0);
    //   expect(crossThreadMessages2.filter(m => m.threadId === `thread-two`)).toHaveLength(3);

    //   const crossThreadMessages3 = await store.getMessages({
    //     threadId: 'thread-two',
    //     resourceId: 'cross-thread-resource',
    //     format: 'v2',
    //     selectBy: {
    //       last: 0,
    //       include: [
    //         {
    //           id: messages[1].id,
    //           withNextMessages: 1,
    //           withPreviousMessages: 1,
    //         },
    //       ],
    //     },
    //   });

    //   expect(crossThreadMessages3).toHaveLength(3);
    //   expect(crossThreadMessages3.filter(m => m.threadId === `thread-one`)).toHaveLength(3);
    //   expect(crossThreadMessages3.filter(m => m.threadId === `thread-two`)).toHaveLength(0);
    // });

    // it('should rollback on error during message save', async () => {
    //   const thread = createSampleThread();
    //   await store.saveThread({ thread });

    //   const messages = [
    //     createSampleMessageV1({ threadId: thread.id }),
    //     { ...createSampleMessageV1({ threadId: thread.id }), id: null }, // This will cause an error
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

  describe('alterTable', () => {
    const TEST_TABLE = 'test_alter_table';
    const BASE_SCHEMA = {
      id: { type: 'integer', primaryKey: true, nullable: false },
      name: { type: 'text', nullable: true },
      createdAt: { type: 'timestamp', nullable: false },
      updatedAt: { type: 'timestamp', nullable: false },
    } as Record<string, StorageColumn>;

    TABLE_ENGINES[TEST_TABLE] = 'MergeTree()';

    beforeEach(async () => {
      await store.createTable({ tableName: TEST_TABLE as TABLE_NAMES, schema: BASE_SCHEMA });
    });

    afterEach(async () => {
      await store.clearTable({ tableName: TEST_TABLE as TABLE_NAMES });
    });

    it('adds a new column to an existing table', async () => {
      await store.alterTable({
        tableName: TEST_TABLE as TABLE_NAMES,
        schema: { ...BASE_SCHEMA, age: { type: 'integer', nullable: true } },
        ifNotExists: ['age'],
      });

      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: 1, name: 'Alice', age: 42, createdAt: new Date(), updatedAt: new Date() },
      });

      const row = await store.load<{ id: string; name: string; age?: number }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '1' },
      });
      expect(row?.age).toBe(42);
    });

    it('is idempotent when adding an existing column', async () => {
      await store.alterTable({
        tableName: TEST_TABLE as TABLE_NAMES,
        schema: { ...BASE_SCHEMA, foo: { type: 'text', nullable: true } },
        ifNotExists: ['foo'],
      });
      // Add the column again (should not throw)
      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, foo: { type: 'text', nullable: true } },
          ifNotExists: ['foo'],
        }),
      ).resolves.not.toThrow();
    });

    it('should add a default value to a column when using not null', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: 1, name: 'Bob', createdAt: new Date(), updatedAt: new Date() },
      });

      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, text_column: { type: 'text', nullable: false } },
          ifNotExists: ['text_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, timestamp_column: { type: 'timestamp', nullable: false } },
          ifNotExists: ['timestamp_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, bigint_column: { type: 'bigint', nullable: false } },
          ifNotExists: ['bigint_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        store.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, jsonb_column: { type: 'jsonb', nullable: false } },
          ifNotExists: ['jsonb_column'],
        }),
      ).resolves.not.toThrow();
    });
  });

  afterAll(async () => {
    await store.close();
  });
});
