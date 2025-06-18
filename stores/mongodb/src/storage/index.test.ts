import { randomUUID } from 'crypto';
import type { MastraMessageV1, MastraMessageV2, MetricResult, WorkflowRunState } from '@mastra/core';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { TABLE_EVALS, TABLE_MESSAGES, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MongoDBConfig } from './index';
import { MongoDBStore } from './index';

class Test {
  store: MongoDBStore;

  constructor(store: MongoDBStore) {
    this.store = store;
  }

  build() {
    return this;
  }

  async clearTables() {
    try {
      await this.store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
      await this.store.clearTable({ tableName: TABLE_MESSAGES });
      await this.store.clearTable({ tableName: TABLE_THREADS });
      await this.store.clearTable({ tableName: TABLE_EVALS });
    } catch (error) {
      // Ignore errors during table clearing
      console.warn('Error clearing tables:', error);
    }
  }

  generateSampleThread(options: any = {}) {
    return {
      id: `thread-${randomUUID()}`,
      resourceId: `resource-${randomUUID()}`,
      title: 'Test Thread',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { key: 'value' },
      ...options,
    };
  }

  generateSampleMessageV1({
    threadId,
    resourceId = randomUUID(),
    content = 'Hello',
  }: {
    threadId: string;
    resourceId?: string;
    content?: string;
  }): MastraMessageV1 {
    return {
      id: `msg-${randomUUID()}`,
      role: 'user',
      type: 'text',
      threadId,
      content: [{ type: 'text', text: content }],
      createdAt: new Date(),
      resourceId,
    };
  }

  generateSampleMessageV2({
    threadId,
    resourceId = randomUUID(),
    content = 'Hello',
  }: {
    threadId: string;
    resourceId?: string;
    content?: string;
  }): MastraMessageV2 {
    return {
      id: `msg-${randomUUID()}`,
      role: 'user',
      type: 'text',
      threadId,
      content: {
        format: 2,
        parts: [{ type: 'text', text: content }],
      },
      createdAt: new Date(),
      resourceId,
    };
  }

  generateSampleEval(isTest: boolean, options: any = {}) {
    const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

    return {
      id: randomUUID(),
      agentName: 'Agent Name',
      input: 'Sample input',
      output: 'Sample output',
      result: { score: 0.8 } as MetricResult,
      metricName: 'sample-metric',
      instructions: 'Sample instructions',
      testInfo,
      globalRunId: `global-${randomUUID()}`,
      runId: `run-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...options,
    };
  }

  generateSampleWorkflowSnapshot(options: any = {}) {
    const runId = `run-${randomUUID()}`;
    const stepId = `step-${randomUUID()}`;
    const timestamp = options.createdAt || new Date();
    const snapshot = {
      result: { success: true },
      value: {},
      context: {
        [stepId]: {
          status: options.status,
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
      status: options.status,
    } as WorkflowRunState;
    return { snapshot, runId, stepId };
  }
}

const TEST_CONFIG: MongoDBConfig = {
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
};

describe('MongoDBStore', () => {
  let store: MongoDBStore;

  beforeAll(async () => {
    store = new MongoDBStore(TEST_CONFIG);
    await store.init();
  });

  // --- Validation tests ---
  describe('Validation', () => {
    const validConfig = TEST_CONFIG;
    it('throws if url is empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, url: '' })).toThrow(/url must be provided and cannot be empty/);
    });

    it('throws if dbName is missing or empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, dbName: '' })).toThrow(
        /dbName must be provided and cannot be empty/,
      );
      const { dbName, ...rest } = validConfig;
      expect(() => new MongoDBStore(rest as any)).toThrow(/dbName must be provided and cannot be empty/);
    });
    it('does not throw on valid config (host-based)', () => {
      expect(() => new MongoDBStore(validConfig)).not.toThrow();
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();

      // Save thread
      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toEqual(thread.title);
    });

    it('should return null for non-existent thread', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const result = await store.getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const thread1 = test.generateSampleThread();
      const thread2 = test.generateSampleThread({ resourceId: thread1.resourceId });

      await store.saveThread({ thread: thread1 });
      await store.saveThread({ thread: thread2 });

      const threads = await store.getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const thread = test.generateSampleThread();
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
      const test = new Test(store).build();
      await test.clearTables();

      const thread = test.generateSampleThread();
      await store.saveThread({ thread });

      // Add some messages
      const messages = [
        test.generateSampleMessageV1({ threadId: thread.id }),
        test.generateSampleMessageV1({ threadId: thread.id }),
      ];
      await store.saveMessages({ messages });

      await store.deleteThread({ threadId: thread.id });

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    });

    it('should not create duplicate threads with the same threadId but update the existing one', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();

      // Save the thread for the first time
      await store.saveThread({ thread });

      // Modify the thread and save again with the same id
      const updatedThread = { ...thread, title: 'Updated Title', metadata: { key: 'newValue' } };
      await store.saveThread({ thread: updatedThread });

      // Retrieve all threads with this id (should only be one)
      const collection = await store['getCollection'](TABLE_THREADS);
      const allThreads = await collection.find({ id: thread.id }).toArray();
      expect(allThreads).toHaveLength(1);

      // Retrieve the thread and check it was updated
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toBe('Updated Title');
      expect(retrievedThread?.metadata).toEqual({ key: 'newValue' });
    });

    it('should update thread updatedAt when a message is saved to it', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const thread = test.generateSampleThread();
      await store.saveThread({ thread });

      const initialThread = await store.getThreadById({ threadId: thread.id });
      expect(initialThread).toBeDefined();
      const originalUpdatedAt = initialThread!.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      const message = test.generateSampleMessageV1({ threadId: thread.id });
      await store.saveMessages({ messages: [message] });

      const updatedThread = await store.getThreadById({ threadId: thread.id });
      expect(updatedThread).toBeDefined();
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();
      await store.saveThread({ thread });

      const messages = [
        test.generateSampleMessageV1({ threadId: thread.id }),
        { ...test.generateSampleMessageV1({ threadId: thread.id }), role: 'assistant' as const },
      ];

      // Save messages
      const savedMessages = await store.saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(2);
      expect(messages[0]).toEqual(expect.objectContaining(retrievedMessages[0]));
      expect(messages[1]).toEqual(expect.objectContaining(retrievedMessages[1]));
    });

    it('should handle empty message array', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();
      await store.saveThread({ thread });

      const messages = [
        {
          ...test.generateSampleMessageV2({ threadId: thread.id, content: 'First' }),
        },
        {
          ...test.generateSampleMessageV2({ threadId: thread.id, content: 'Second' }),
        },
        {
          ...test.generateSampleMessageV2({ threadId: thread.id, content: 'Third' }),
        },
      ];

      await store.saveMessages({ messages, format: 'v2' });

      const retrievedMessages = await store.getMessages({ threadId: thread.id, format: 'v2' });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect((msg as any).content.parts).toEqual(messages[idx]!.content.parts);
      });
    });

    // it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
    //   const test = new Test(store).build();
    //   const messages: MastraMessageV2[] = [
    //     test.generateSampleMessageV2({ threadId: 'thread-one', content: 'First', resourceId: 'cross-thread-resource' }),
    //     test.generateSampleMessageV2({
    //       threadId: 'thread-one',
    //       content: 'Second',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     test.generateSampleMessageV2({ threadId: 'thread-one', content: 'Third', resourceId: 'cross-thread-resource' }),

    //     test.generateSampleMessageV2({
    //       threadId: 'thread-two',
    //       content: 'Fourth',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     test.generateSampleMessageV2({ threadId: 'thread-two', content: 'Fifth', resourceId: 'cross-thread-resource' }),
    //     test.generateSampleMessageV2({ threadId: 'thread-two', content: 'Sixth', resourceId: 'cross-thread-resource' }),

    //     test.generateSampleMessageV2({ threadId: 'thread-three', content: 'Seventh', resourceId: 'other-resource' }),
    //     test.generateSampleMessageV2({ threadId: 'thread-three', content: 'Eighth', resourceId: 'other-resource' }),
    //   ];

    //   await store.saveMessages({ messages: messages, format: 'v2' });

    //   const retrievedMessages: MastraMessageV2[] = await store.getMessages({ threadId: 'thread-one', format: 'v2' });
    //   expect(retrievedMessages).toHaveLength(3);
    //   expect(retrievedMessages.map(m => (m.content.parts[0] as any).text)).toEqual(['First', 'Second', 'Third']);

    //   const retrievedMessages2: MastraMessageV2[] = await store.getMessages({ threadId: 'thread-two', format: 'v2' });
    //   expect(retrievedMessages2).toHaveLength(3);
    //   expect(retrievedMessages2.map(m => (m.content.parts[0] as any).text)).toEqual(['Fourth', 'Fifth', 'Sixth']);

    //   const retrievedMessages3: MastraMessageV2[] = await store.getMessages({ threadId: 'thread-three', format: 'v2' });
    //   expect(retrievedMessages3).toHaveLength(2);
    //   expect(retrievedMessages3.map(m => (m.content.parts[0] as any).text)).toEqual(['Seventh', 'Eighth']);

    //   const crossThreadMessages: MastraMessageV2[] = await store.getMessages({
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

    //   const crossThreadMessages2: MastraMessageV2[] = await store.getMessages({
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

    //   const crossThreadMessages3: MastraMessageV2[] = await store.getMessages({
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
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle large metadata objects', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();
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
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread({
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      });

      await store.saveThread({ thread });
      const retrieved = await store.getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    });

    it('should handle concurrent thread updates', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const thread = test.generateSampleThread();
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
      const test = new Test(store).build();
      await test.clearTables();
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
        serializedStepGraph: [],
        runId: runId,
        status: 'running',
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
    it('returns empty array when no workflows exist', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const { runs, total } = await store.getWorkflowRuns();
      expect(runs).toEqual([]);
      expect(total).toBe(0);
    });

    it('returns all workflows by default', async () => {
      const test = new Test(store).build();
      await test.clearTables();

      const workflowName1 = 'default_test_1';
      const workflowName2 = 'default_test_2';

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = test.generateSampleWorkflowSnapshot({ status: 'completed' });
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = test.generateSampleWorkflowSnapshot({ status: 'running' });

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
      expect(firstSnapshot.context?.[stepId2]?.status).toBe('running');
      expect(secondSnapshot.context?.[stepId1]?.status).toBe('completed');
    });

    it('filters by workflow name', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = test.generateSampleWorkflowSnapshot({ status: 'completed' });
      const { snapshot: workflow2, runId: runId2 } = test.generateSampleWorkflowSnapshot({ status: 'failed' });

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

      const { runs, total } = await store.getWorkflowRuns({ workflowName: workflowName1 });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.[stepId1]?.status).toBe('completed');
    });

    it('filters by date range', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const workflowName1 = 'date_test_1';
      const workflowName2 = 'date_test_2';
      const workflowName3 = 'date_test_3';

      const { snapshot: workflow1, runId: runId1 } = test.generateSampleWorkflowSnapshot({ status: 'completed' });
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = test.generateSampleWorkflowSnapshot({ status: 'running' });
      const {
        snapshot: workflow3,
        runId: runId3,
        stepId: stepId3,
      } = test.generateSampleWorkflowSnapshot({ status: 'waiting' });

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
      expect(firstSnapshot.context?.[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.[stepId2]?.status).toBe('running');
    });

    it('handles pagination', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = test.generateSampleWorkflowSnapshot({ status: 'completed' });
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = test.generateSampleWorkflowSnapshot({ status: 'running' });
      const {
        snapshot: workflow3,
        runId: runId3,
        stepId: stepId3,
      } = test.generateSampleWorkflowSnapshot({ status: 'waiting' });

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
      expect(firstSnapshot.context?.[stepId3]?.status).toBe('waiting');
      expect(secondSnapshot.context?.[stepId2]?.status).toBe('running');

      // Get second page
      const page2 = await store.getWorkflowRuns({ limit: 2, offset: 2 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.[stepId1]?.status).toBe('completed');
    });
  });

  describe('Eval Operations', () => {
    it('should retrieve evals by agent name', async () => {
      const test = new Test(store).build();
      await test.clearTables();
      const agentName = `test-agent-${randomUUID()}`;

      // Create sample evals
      const liveEval = test.generateSampleEval(false, { agentName });
      const testEval = test.generateSampleEval(true, { agentName });
      const otherAgentEval = test.generateSampleEval(false, { agentName: `other-agent-${randomUUID()}` });

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
      expect(liveEvals[0]!.runId).toBe(liveEval.runId);

      // Test getting only test evals
      const testEvals = await store.getEvalsByAgentName(agentName, 'test');
      expect(testEvals).toHaveLength(1);
      expect(testEvals[0]!.runId).toBe(testEval.runId);
      expect(testEvals[0]!.testInfo).toEqual(testEval.testInfo);

      // Test getting evals for non-existent agent
      const nonExistentEvals = await store.getEvalsByAgentName('non-existent-agent');
      expect(nonExistentEvals).toHaveLength(0);
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

      const row = await store.load<{ id: string; name: string; newField?: number }[]>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '2' },
      });
      expect(row?.[0]?.newField).toBe(123);
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
          ifNotExists: ['extra'],
        }),
      ).resolves.not.toThrow();
    });

    it('can add multiple new fields at write time', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '3', name: 'Charlie', age: 30, city: 'Paris' },
      });
      const row = await store.load<{ id: string; name: string; age?: number; city?: string }[]>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '3' },
      });
      expect(row?.[0]?.age).toBe(30);
      expect(row?.[0]?.city).toBe('Paris');
    });

    it('can retrieve all fields, including dynamically added ones', async () => {
      await store.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: '4', name: 'Dana', hobby: 'skiing' },
      });
      const row = await store.load<{ id: string; name: string; hobby?: string }[]>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '4' },
      });
      expect(row?.[0]?.hobby).toBe('skiing');
    });

    it('does not restrict or error on arbitrary new fields', async () => {
      await expect(
        store.insert({
          tableName: TEST_TABLE as TABLE_NAMES,
          record: { id: '5', weirdField: { nested: true }, another: [1, 2, 3] },
        }),
      ).resolves.not.toThrow();

      const row = await store.load<{ id: string; weirdField?: any; another?: any }[]>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '5' },
      });
      expect(row?.[0]?.weirdField).toEqual({ nested: true });
      expect(row?.[0]?.another).toEqual([1, 2, 3]);
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
