import { randomUUID } from 'crypto';
import {
  createSampleEval,
  createSampleTraceForDB,
  createSampleThread,
  createSampleMessageV1,
  createSampleWorkflowSnapshot,
  resetRole,
  checkWorkflowSnapshot,
} from '@internal/storage-test-utils';
import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

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

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const createSampleMessageV2 = ({
  threadId,
  resourceId,
  role = 'user',
  content,
  createdAt,
  thread,
}: {
  threadId: string;
  resourceId?: string;
  role?: 'user' | 'assistant';
  content?: Partial<MastraMessageContentV2>;
  createdAt?: Date;
  thread?: StorageThreadType;
}): MastraMessageV2 => {
  return {
    id: randomUUID(),
    threadId,
    resourceId: resourceId || thread?.resourceId || 'test-resource',
    role,
    createdAt: createdAt || new Date(),
    content: {
      format: 2,
      parts: content?.parts || [{ type: 'text', text: content?.content ?? '' }],
      content: content?.content || `Sample content ${randomUUID()}`,
      ...content,
    },
    type: 'v2',
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
      await store.clearTable({ tableName: TABLE_TRACES });
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
      const messages = [createSampleMessageV1({ threadId: thread.id }), createSampleMessageV1({ threadId: thread.id })];
      await store.saveMessages({ messages });

      await store.deleteThread({ threadId: thread.id });

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
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
      const message = createSampleMessageV1({ threadId: thread.id });
      await store.saveMessages({ messages: [message] });

      // Retrieve the thread again and check that updatedAt was updated
      const updatedThread = await store.getThreadById({ threadId: thread.id });
      expect(updatedThread).toBeDefined();
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [createSampleMessageV1({ threadId: thread.id }), createSampleMessageV1({ threadId: thread.id })];

      // Save messages
      const savedMessages = await store.saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.getMessages({ threadId: thread.id, format: 'v1' });
      expect(retrievedMessages).toHaveLength(2);
      const checkMessages = messages.map(m => {
        const { resourceId, ...rest } = m;
        return rest;
      });
      expect(retrievedMessages).toEqual(expect.arrayContaining(checkMessages));
    });

    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messageContent = ['First', 'Second', 'Third'];

      const messages = messageContent.map(content =>
        createSampleMessageV2({ threadId: thread.id, content: { content, parts: [{ type: 'text', text: content }] } }),
      );

      await store.saveMessages({ messages, format: 'v2' });

      const retrievedMessages = await store.getMessages({ threadId: thread.id, format: 'v2' });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect((msg.content.parts[0] as any).text).toEqual(messageContent[idx]);
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessageV1({ threadId: thread.id }),
        { ...createSampleMessageV1({ threadId: thread.id }), id: null } as any, // This will cause an error
      ];

      await expect(store.saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await store.getMessages({ threadId: thread.id });
      expect(savedMessages).toHaveLength(0);
    });

    it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
      const thread = createSampleThread({ id: 'thread-one' });
      await store.saveThread({ thread });

      const thread2 = createSampleThread({ id: 'thread-two' });
      await store.saveThread({ thread: thread2 });

      const thread3 = createSampleThread({ id: 'thread-three' });
      await store.saveThread({ thread: thread3 });

      const messages: MastraMessageV2[] = [
        createSampleMessageV2({
          threadId: 'thread-one',
          content: { content: 'First' },
          resourceId: 'cross-thread-resource',
        }),
        createSampleMessageV2({
          threadId: 'thread-one',
          content: { content: 'Second' },
          resourceId: 'cross-thread-resource',
        }),
        createSampleMessageV2({
          threadId: 'thread-one',
          content: { content: 'Third' },
          resourceId: 'cross-thread-resource',
        }),

        createSampleMessageV2({
          threadId: 'thread-two',
          content: { content: 'Fourth' },
          resourceId: 'cross-thread-resource',
        }),
        createSampleMessageV2({
          threadId: 'thread-two',
          content: { content: 'Fifth' },
          resourceId: 'cross-thread-resource',
        }),
        createSampleMessageV2({
          threadId: 'thread-two',
          content: { content: 'Sixth' },
          resourceId: 'cross-thread-resource',
        }),

        createSampleMessageV2({
          threadId: 'thread-three',
          content: { content: 'Seventh' },
          resourceId: 'other-resource',
        }),
        createSampleMessageV2({
          threadId: 'thread-three',
          content: { content: 'Eighth' },
          resourceId: 'other-resource',
        }),
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

      const crossThreadMessages: MastraMessageV2[] = await store.getMessages({
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

      const crossThreadMessages2: MastraMessageV2[] = await store.getMessages({
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

      const crossThreadMessages3: MastraMessageV2[] = await store.getMessages({
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
  });

  describe('updateMessages', () => {
    let thread: StorageThreadType;

    beforeEach(async () => {
      const threadData = createSampleThread();
      thread = await store.saveThread({ thread: threadData as StorageThreadType });
    });

    it('should update a single field of a message (e.g., role)', async () => {
      const originalMessage = createSampleMessageV2({ threadId: thread.id, role: 'user', thread });
      await store.saveMessages({ messages: [originalMessage], format: 'v2' });

      const updatedMessages = await store.updateMessages({
        messages: [{ id: originalMessage.id, role: 'assistant' }],
      });

      expect(updatedMessages).toHaveLength(1);
      expect(updatedMessages[0].role).toBe('assistant');
      expect(updatedMessages[0].content).toEqual(originalMessage.content); // Ensure content is unchanged
    });

    it('should update only the metadata within the content field, preserving other content', async () => {
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        content: { content: 'hello world', parts: [{ type: 'text', text: 'hello world' }] },
        thread,
      });
      await store.saveMessages({ messages: [originalMessage], format: 'v2' });

      const newMetadata = { someKey: 'someValue' };
      await store.updateMessages({
        messages: [{ id: originalMessage.id, content: { metadata: newMetadata } as any }],
      });

      const fromDb = await store.getMessages({ threadId: thread.id, format: 'v2' });
      expect(fromDb[0].content.metadata).toEqual(newMetadata);
      expect(fromDb[0].content.content).toBe('hello world');
      expect(fromDb[0].content.parts).toEqual([{ type: 'text', text: 'hello world' }]);
    });

    it('should deep merge metadata, not overwrite it', async () => {
      const originalMessage = createSampleMessageV2({
        threadId: thread.id,
        content: { metadata: { initial: true }, content: 'old content' },
        thread,
      });
      await store.saveMessages({ messages: [originalMessage], format: 'v2' });

      const newMetadata = { updated: true };
      await store.updateMessages({
        messages: [{ id: originalMessage.id, content: { metadata: newMetadata } as any }],
      });

      const fromDb = await store.getMessages({ threadId: thread.id, format: 'v2' });
      expect(fromDb[0].content.metadata).toEqual({ initial: true, updated: true });
    });

    it('should update multiple messages at once', async () => {
      const msg1 = createSampleMessageV2({ threadId: thread.id, role: 'user', thread });
      const msg2 = createSampleMessageV2({ threadId: thread.id, content: { content: 'original' }, thread });
      await store.saveMessages({ messages: [msg1, msg2], format: 'v2' });

      await store.updateMessages({
        messages: [
          { id: msg1.id, role: 'assistant' },
          { id: msg2.id, content: { content: 'updated' } as any },
        ],
      });

      const fromDb = await store.getMessages({ threadId: thread.id, format: 'v2' });
      const updatedMsg1 = fromDb.find(m => m.id === msg1.id)!;
      const updatedMsg2 = fromDb.find(m => m.id === msg2.id)!;

      expect(updatedMsg1.role).toBe('assistant');
      expect(updatedMsg2.content.content).toBe('updated');
    });

    it('should update the parent thread updatedAt timestamp', async () => {
      const originalMessage = createSampleMessageV2({ threadId: thread.id, thread });
      await store.saveMessages({ messages: [originalMessage], format: 'v2' });
      const initialThread = await store.getThreadById({ threadId: thread.id });

      await new Promise(r => setTimeout(r, 10));

      await store.updateMessages({ messages: [{ id: originalMessage.id, role: 'assistant' }] });

      const updatedThread = await store.getThreadById({ threadId: thread.id });

      expect(new Date(updatedThread!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread!.updatedAt).getTime(),
      );
    });

    it('should update timestamps on both threads when moving a message', async () => {
      const thread2 = await store.saveThread({ thread: createSampleThread() });
      const message = createSampleMessageV2({ threadId: thread.id, thread });
      await store.saveMessages({ messages: [message], format: 'v2' });

      const initialThread1 = await store.getThreadById({ threadId: thread.id });
      const initialThread2 = await store.getThreadById({ threadId: thread2.id });

      await new Promise(r => setTimeout(r, 10));

      await store.updateMessages({
        messages: [{ id: message.id, threadId: thread2.id }],
      });

      const updatedThread1 = await store.getThreadById({ threadId: thread.id });
      const updatedThread2 = await store.getThreadById({ threadId: thread2.id });

      expect(new Date(updatedThread1!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread1!.updatedAt).getTime(),
      );
      expect(new Date(updatedThread2!.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialThread2!.updatedAt).getTime(),
      );

      // Verify the message was moved
      const thread1Messages = await store.getMessages({ threadId: thread.id, format: 'v2' });
      const thread2Messages = await store.getMessages({ threadId: thread2.id, format: 'v2' });
      expect(thread1Messages).toHaveLength(0);
      expect(thread2Messages).toHaveLength(1);
      expect(thread2Messages[0].id).toBe(message.id);
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
          input: { type: 'manual' },
          step1: { status: 'success', output: { data: 'test' } },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
        serializedStepGraph: [],
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
          input: { type: 'manual' },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
        serializedStepGraph: [],
      };

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: initialSnapshot as unknown as WorkflowRunState,
      });

      const updatedSnapshot = {
        status: 'success',
        context: {
          input: { type: 'manual' },
          'step-1': { status: 'success', result: { data: 'test' } },
        },
        value: {},
        activePaths: [],
        suspendedPaths: {},
        runId,
        timestamp: new Date().getTime(),
      };

      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: updatedSnapshot as unknown as WorkflowRunState,
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
        serializedStepGraph: [],
        status: 'running',
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

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('failed');

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

      const { runs, total } = await store.getWorkflowRuns();
      expect(runs).toHaveLength(2);
      expect(total).toBe(2);
      expect(runs[0]!.workflowName).toBe(workflowName2); // Most recent first
      expect(runs[1]!.workflowName).toBe(workflowName1);
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId2, 'failed');
      checkWorkflowSnapshot(secondSnapshot, stepId1, 'success');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot('failed');

      await store.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

      const { runs, total } = await store.getWorkflowRuns({ workflowName: workflowName1 });
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
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('failed');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('suspended');

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
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'suspended');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'failed');
    });

    it('handles pagination', async () => {
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('failed');
      const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('suspended');

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
      const firstSnapshot = page1.runs[0]!.snapshot;
      const secondSnapshot = page1.runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'suspended');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'failed');

      // Get second page
      const page2 = await store.getWorkflowRuns({ limit: 2, offset: 2 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot;
      checkWorkflowSnapshot(snapshot, stepId1, 'success');
    });
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
      for (const status of ['success', 'failed']) {
        const sample = createSampleWorkflowSnapshot(status as WorkflowRunState['context'][string]['status']);
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

  describe('Eval Operations', () => {
    it('should retrieve evals by agent name', async () => {
      const agentName = `test-agent-${randomUUID()}`;

      // Create sample evals using the imported helper
      const liveEval = createSampleEval(agentName, false); // createSampleEval returns snake_case
      const testEval = createSampleEval(agentName, true);
      const otherAgentEval = createSampleEval(`other-agent-${randomUUID()}`, false);

      // Insert evals - ensure DB columns are snake_case
      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: liveEval.agent_name, // Use snake_case
          input: liveEval.input,
          output: liveEval.output,
          result: liveEval.result,
          metric_name: liveEval.metric_name, // Use snake_case
          instructions: liveEval.instructions,
          test_info: liveEval.test_info, // test_info from helper can be undefined or object
          global_run_id: liveEval.global_run_id, // Use snake_case
          run_id: liveEval.run_id, // Use snake_case
          created_at: new Date(liveEval.created_at as string), // created_at from helper is string or Date
        },
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: testEval.agent_name,
          input: testEval.input,
          output: testEval.output,
          result: testEval.result,
          metric_name: testEval.metric_name,
          instructions: testEval.instructions,
          test_info: testEval.test_info ? JSON.stringify(testEval.test_info) : null,
          global_run_id: testEval.global_run_id,
          run_id: testEval.run_id,
          created_at: new Date(testEval.created_at as string),
        },
      });

      await store.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: otherAgentEval.agent_name,
          input: otherAgentEval.input,
          output: otherAgentEval.output,
          result: otherAgentEval.result,
          metric_name: otherAgentEval.metric_name,
          instructions: otherAgentEval.instructions,
          test_info: otherAgentEval.test_info, // Can be null/undefined directly
          global_run_id: otherAgentEval.global_run_id,
          run_id: otherAgentEval.run_id,
          created_at: new Date(otherAgentEval.created_at as string),
        },
      });

      // Test getting all evals for the agent
      const allEvals = await store.getEvalsByAgentName(agentName);
      expect(allEvals).toHaveLength(2);
      // EvalRow type expects camelCase, but PostgresStore.transformEvalRow converts snake_case from DB to camelCase
      expect(allEvals.map(e => e.runId)).toEqual(expect.arrayContaining([liveEval.run_id, testEval.run_id]));

      // Test getting only live evals
      const liveEvals = await store.getEvalsByAgentName(agentName, 'live');
      expect(liveEvals).toHaveLength(1);
      expect(liveEvals[0].runId).toBe(liveEval.run_id); // Comparing with snake_case run_id from original data

      // Test getting only test evals
      const testEvalsResult = await store.getEvalsByAgentName(agentName, 'test');
      expect(testEvalsResult).toHaveLength(1);
      expect(testEvalsResult[0].runId).toBe(testEval.run_id);
      expect(testEvalsResult[0].testInfo).toEqual(testEval.test_info);

      // Test getting evals for non-existent agent
      const nonExistentEvals = await store.getEvalsByAgentName('non-existent-agent');
      expect(nonExistentEvals).toHaveLength(0);
    });
  });

  describe('hasColumn', () => {
    const tempTable = 'temp_test_table';

    beforeEach(async () => {
      // Always try to drop the table before each test, ignore errors if it doesn't exist
      try {
        await store['db'].query(`DROP TABLE IF EXISTS ${tempTable}`);
      } catch {
        /* ignore */
      }
    });

    it('returns true if the column exists', async () => {
      await store['db'].query(`CREATE TABLE ${tempTable} (id SERIAL PRIMARY KEY, resourceId TEXT)`);
      expect(await store['hasColumn'](tempTable, 'resourceId')).toBe(true);
    });

    it('returns false if the column does not exist', async () => {
      await store['db'].query(`CREATE TABLE ${tempTable} (id SERIAL PRIMARY KEY)`);
      expect(await store['hasColumn'](tempTable, 'resourceId')).toBe(false);
    });

    afterEach(async () => {
      // Always try to drop the table after each test, ignore errors if it doesn't exist
      try {
        await store['db'].query(`DROP TABLE IF EXISTS ${tempTable}`);
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
    } as Record<string, StorageColumn>;

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
        record: { id: 1, name: 'Alice', age: 42 },
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
        record: { id: 1, name: 'Bob' },
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

  describe('Schema Support', () => {
    const customSchema = 'mastraTest';
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

  describe('Pagination Features', () => {
    beforeEach(async () => {
      await store.clearTable({ tableName: TABLE_EVALS });
      await store.clearTable({ tableName: TABLE_TRACES });
      await store.clearTable({ tableName: TABLE_MESSAGES });
      await store.clearTable({ tableName: TABLE_THREADS });
    });

    describe('getEvals with pagination', () => {
      it('should return paginated evals with total count (page/perPage)', async () => {
        const agentName = 'pagination-agent-evals';
        const evalPromises = Array.from({ length: 25 }, (_, i) => {
          const evalData = createSampleEval(agentName, i % 2 === 0);
          return store.insert({
            tableName: TABLE_EVALS,
            record: {
              run_id: evalData.run_id,
              agent_name: evalData.agent_name,
              input: evalData.input,
              output: evalData.output,
              result: evalData.result,
              metric_name: evalData.metric_name,
              instructions: evalData.instructions,
              test_info: evalData.test_info,
              global_run_id: evalData.global_run_id,
              created_at: new Date(evalData.created_at as string),
            },
          });
        });
        await Promise.all(evalPromises);

        const page1 = await store.getEvals({ agentName, page: 0, perPage: 10 });
        expect(page1.evals).toHaveLength(10);
        expect(page1.total).toBe(25);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(10);
        expect(page1.hasMore).toBe(true);

        const page3 = await store.getEvals({ agentName, page: 2, perPage: 10 });
        expect(page3.evals).toHaveLength(5);
        expect(page3.total).toBe(25);
        expect(page3.page).toBe(2);
        expect(page3.hasMore).toBe(false);
      });

      it('should support limit/offset pagination for getEvals', async () => {
        const agentName = 'pagination-agent-lo-evals';
        const evalPromises = Array.from({ length: 15 }, () => {
          const evalData = createSampleEval(agentName);
          return store.insert({
            tableName: TABLE_EVALS,
            record: {
              run_id: evalData.run_id,
              agent_name: evalData.agent_name,
              input: evalData.input,
              output: evalData.output,
              result: evalData.result,
              metric_name: evalData.metric_name,
              instructions: evalData.instructions,
              test_info: evalData.test_info,
              global_run_id: evalData.global_run_id,
              created_at: new Date(evalData.created_at as string),
            },
          });
        });
        await Promise.all(evalPromises);

        const result = await store.getEvals({ agentName, perPage: 5, page: 2 });
        expect(result.evals).toHaveLength(5);
        expect(result.total).toBe(15);
        expect(result.page).toBe(2);
        expect(result.perPage).toBe(5);
        expect(result.hasMore).toBe(false);
      });

      it('should filter by type with pagination for getEvals', async () => {
        const agentName = 'pagination-agent-type-evals';
        const testEvalPromises = Array.from({ length: 10 }, () => {
          const evalData = createSampleEval(agentName, true);
          return store.insert({
            tableName: TABLE_EVALS,
            record: {
              run_id: evalData.run_id,
              agent_name: evalData.agent_name,
              input: evalData.input,
              output: evalData.output,
              result: evalData.result,
              metric_name: evalData.metric_name,
              instructions: evalData.instructions,
              test_info: evalData.test_info,
              global_run_id: evalData.global_run_id,
              created_at: new Date(evalData.created_at as string),
            },
          });
        });
        const liveEvalPromises = Array.from({ length: 8 }, () => {
          const evalData = createSampleEval(agentName, false);
          return store.insert({
            tableName: TABLE_EVALS,
            record: {
              run_id: evalData.run_id,
              agent_name: evalData.agent_name,
              input: evalData.input,
              output: evalData.output,
              result: evalData.result,
              metric_name: evalData.metric_name,
              instructions: evalData.instructions,
              test_info: evalData.test_info,
              global_run_id: evalData.global_run_id,
              created_at: new Date(evalData.created_at as string),
            },
          });
        });
        await Promise.all([...testEvalPromises, ...liveEvalPromises]);

        const testResults = await store.getEvals({ agentName, type: 'test', page: 0, perPage: 5 });
        expect(testResults.evals).toHaveLength(5);
        expect(testResults.total).toBe(10);

        const liveResults = await store.getEvals({ agentName, type: 'live', page: 1, perPage: 3 });
        expect(liveResults.evals).toHaveLength(3);
        expect(liveResults.total).toBe(8);
        expect(liveResults.hasMore).toBe(true);
      });

      it('should filter by date with pagination for getEvals', async () => {
        const agentName = 'pagination-agent-date-evals';
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const createEvalAtDate = (date: Date) => {
          const evalData = createSampleEval(agentName, false, date); // Pass date to helper
          return store.insert({
            tableName: TABLE_EVALS,
            record: {
              run_id: evalData.run_id, // Use snake_case from helper
              agent_name: evalData.agent_name,
              input: evalData.input,
              output: evalData.output,
              result: evalData.result,
              metric_name: evalData.metric_name,
              instructions: evalData.instructions,
              test_info: evalData.test_info,
              global_run_id: evalData.global_run_id,
              created_at: evalData.created_at, // Use created_at from helper (already Date or ISO string)
            },
          });
        };

        await Promise.all([
          createEvalAtDate(dayBeforeYesterday),
          createEvalAtDate(dayBeforeYesterday),
          createEvalAtDate(yesterday),
          createEvalAtDate(yesterday),
          createEvalAtDate(yesterday),
          createEvalAtDate(now),
          createEvalAtDate(now),
          createEvalAtDate(now),
          createEvalAtDate(now),
        ]);

        const fromYesterday = await store.getEvals({ agentName, dateRange: { start: yesterday }, page: 0, perPage: 3 });
        expect(fromYesterday.total).toBe(7); // 3 yesterday + 4 now
        expect(fromYesterday.evals).toHaveLength(3);
        // Evals are sorted DESC, so first 3 are from 'now'
        fromYesterday.evals.forEach(e =>
          expect(new Date(e.createdAt).getTime()).toBeGreaterThanOrEqual(yesterday.getTime()),
        );

        const onlyDayBefore = await store.getEvals({
          agentName,
          dateRange: {
            end: new Date(yesterday.getTime() - 1),
          },
          page: 0,
          perPage: 5,
        });
        expect(onlyDayBefore.total).toBe(2);
        expect(onlyDayBefore.evals).toHaveLength(2);
      });
    });

    describe('getTraces with pagination', () => {
      it('should return paginated traces with total count', async () => {
        const tracePromises = Array.from({ length: 18 }, (_, i) =>
          store.insert({ tableName: TABLE_TRACES, record: createSampleTraceForDB(`test-trace-${i}`, 'pg-test-scope') }),
        );
        await Promise.all(tracePromises);

        const page1 = await store.getTracesPaginated({
          scope: 'pg-test-scope',
          page: 0,
          perPage: 8,
        });
        expect(page1.traces).toHaveLength(8);
        expect(page1.total).toBe(18);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(8);
        expect(page1.hasMore).toBe(true);

        const page3 = await store.getTracesPaginated({
          scope: 'pg-test-scope',
          page: 2,
          perPage: 8,
        });
        expect(page3.traces).toHaveLength(2);
        expect(page3.total).toBe(18);
        expect(page3.hasMore).toBe(false);
      });

      it('should filter by attributes with pagination for getTraces', async () => {
        const tracesWithAttr = Array.from({ length: 8 }, (_, i) =>
          store.insert({
            tableName: TABLE_TRACES,
            record: createSampleTraceForDB(`trace-${i}`, 'pg-attr-scope', { environment: 'prod' }),
          }),
        );
        const tracesWithoutAttr = Array.from({ length: 5 }, (_, i) =>
          store.insert({
            tableName: TABLE_TRACES,
            record: createSampleTraceForDB(`trace-other-${i}`, 'pg-attr-scope', { environment: 'dev' }),
          }),
        );
        await Promise.all([...tracesWithAttr, ...tracesWithoutAttr]);

        const prodTraces = await store.getTracesPaginated({
          scope: 'pg-attr-scope',
          attributes: { environment: 'prod' },
          page: 0,
          perPage: 5,
        });
        expect(prodTraces.traces).toHaveLength(5);
        expect(prodTraces.total).toBe(8);
        expect(prodTraces.hasMore).toBe(true);
      });

      it('should filter by date with pagination for getTraces', async () => {
        const scope = 'pg-date-traces';
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        await Promise.all([
          store.insert({
            tableName: TABLE_TRACES,
            record: createSampleTraceForDB('t1', scope, undefined, dayBeforeYesterday),
          }),
          store.insert({ tableName: TABLE_TRACES, record: createSampleTraceForDB('t2', scope, undefined, yesterday) }),
          store.insert({ tableName: TABLE_TRACES, record: createSampleTraceForDB('t3', scope, undefined, yesterday) }),
          store.insert({ tableName: TABLE_TRACES, record: createSampleTraceForDB('t4', scope, undefined, now) }),
          store.insert({ tableName: TABLE_TRACES, record: createSampleTraceForDB('t5', scope, undefined, now) }),
        ]);

        const fromYesterday = await store.getTracesPaginated({
          scope,
          dateRange: {
            start: yesterday,
          },
          page: 0,
          perPage: 2,
        });
        expect(fromYesterday.total).toBe(4); // 2 yesterday + 2 now
        expect(fromYesterday.traces).toHaveLength(2);
        fromYesterday.traces.forEach(t =>
          expect(new Date(t.createdAt).getTime()).toBeGreaterThanOrEqual(yesterday.getTime()),
        );

        const onlyNow = await store.getTracesPaginated({
          scope,
          dateRange: {
            start: now,
            end: now,
          },
          page: 0,
          perPage: 5,
        });
        expect(onlyNow.total).toBe(2);
        expect(onlyNow.traces).toHaveLength(2);
      });
    });

    describe('getMessages with pagination', () => {
      it('should return paginated messages with total count', async () => {
        const thread = createSampleThread();
        await store.saveThread({ thread });
        // Reset role to 'assistant' before creating messages
        resetRole();
        // Create messages sequentially to ensure unique timestamps
        for (let i = 0; i < 15; i++) {
          const message = createSampleMessageV1({ threadId: thread.id, content: `Message ${i + 1}` });
          await store.saveMessages({
            messages: [message],
          });
          await new Promise(r => setTimeout(r, 5));
        }

        const page1 = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 0, perPage: 5 } },
          format: 'v2',
        });
        console.log(page1);
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
      });

      it('should filter by date with pagination for getMessages', async () => {
        resetRole();
        const threadData = createSampleThread();
        const thread = await store.saveThread({ thread: threadData as StorageThreadType });
        const now = new Date();
        const yesterday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        );
        const dayBeforeYesterday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 2,
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        );

        // Ensure timestamps are distinct for reliable sorting by creating them with a slight delay for testing clarity
        const messagesToSave: MastraMessageV1[] = [];
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: dayBeforeYesterday }));
        await new Promise(r => setTimeout(r, 5));
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: dayBeforeYesterday }));
        await new Promise(r => setTimeout(r, 5));
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: yesterday }));
        await new Promise(r => setTimeout(r, 5));
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: yesterday }));
        await new Promise(r => setTimeout(r, 5));
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: now }));
        await new Promise(r => setTimeout(r, 5));
        messagesToSave.push(createSampleMessageV1({ threadId: thread.id, createdAt: now }));

        await store.saveMessages({ messages: messagesToSave, format: 'v1' });
        // Total 6 messages: 2 now, 2 yesterday, 2 dayBeforeYesterday (oldest to newest)

        const fromYesterday = await store.getMessagesPaginated({
          threadId: thread.id,
          selectBy: { pagination: { page: 0, perPage: 3, dateRange: { start: yesterday } } },
          format: 'v2',
        });
        expect(fromYesterday.total).toBe(4);
        expect(fromYesterday.messages).toHaveLength(3);
        const firstMessageTime = new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).getTime();
        expect(firstMessageTime).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime());
        if (fromYesterday.messages.length > 0) {
          expect(new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).toISOString().slice(0, 10)).toEqual(
            yesterday.toISOString().slice(0, 10),
          );
        }
      });
    });

    describe('getThreadsByResourceId with pagination', () => {
      it('should return paginated threads with total count', async () => {
        const resourceId = `pg-paginated-resource-${randomUUID()}`;
        const threadPromises = Array.from({ length: 17 }, () =>
          store.saveThread({ thread: { ...createSampleThread(), resourceId } }),
        );
        await Promise.all(threadPromises);

        const page1 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 0, perPage: 7 });
        expect(page1.threads).toHaveLength(7);
        expect(page1.total).toBe(17);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(7);
        expect(page1.hasMore).toBe(true);

        const page3 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 2, perPage: 7 });
        expect(page3.threads).toHaveLength(3); // 17 total, 7 per page, 3rd page has 17 - 2*7 = 3
        expect(page3.total).toBe(17);
        expect(page3.hasMore).toBe(false);
      });

      it('should return paginated results when no pagination params for getThreadsByResourceId', async () => {
        const resourceId = `pg-non-paginated-resource-${randomUUID()}`;
        await store.saveThread({ thread: { ...createSampleThread(), resourceId } });

        const results = await store.getThreadsByResourceIdPaginated({ resourceId });
        expect(Array.isArray(results.threads)).toBe(true);
        expect(results.threads.length).toBe(1);
        expect(results.total).toBe(1);
        expect(results.page).toBe(0);
        expect(results.perPage).toBe(100);
        expect(results.hasMore).toBe(false);
      });
    });
  });

  describe('PgStorage Table Name Quoting', () => {
    const camelCaseTable = 'TestCamelCaseTable';
    const snakeCaseTable = 'test_snake_case_table';
    const BASE_SCHEMA = {
      id: { type: 'integer', primaryKey: true, nullable: false },
      name: { type: 'text', nullable: true },
    } as Record<string, StorageColumn>;

    beforeEach(async () => {
      // Only clear tables if store is initialized
      try {
        // Clear tables before each test
        await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
        await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
      } catch (error) {
        // Ignore errors during table clearing
        console.warn('Error clearing tables:', error);
      }
    });

    afterEach(async () => {
      // Only clear tables if store is initialized
      try {
        // Clear tables before each test
        await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
        await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
      } catch (error) {
        // Ignore errors during table clearing
        console.warn('Error clearing tables:', error);
      }
    });

    it('should create and upsert to a camelCase table without quoting errors', async () => {
      await expect(
        store.createTable({
          tableName: camelCaseTable as TABLE_NAMES,
          schema: BASE_SCHEMA,
        }),
      ).resolves.not.toThrow();

      await store.insert({
        tableName: camelCaseTable as TABLE_NAMES,
        record: { id: '1', name: 'Alice' },
      });

      const row = await store.load({
        tableName: camelCaseTable as TABLE_NAMES,
        keys: { id: '1' },
      });
      expect(row?.name).toBe('Alice');
    });

    it('should create and upsert to a snake_case table without quoting errors', async () => {
      await expect(
        store.createTable({
          tableName: snakeCaseTable as TABLE_NAMES,
          schema: BASE_SCHEMA,
        }),
      ).resolves.not.toThrow();

      await store.insert({
        tableName: snakeCaseTable as TABLE_NAMES,
        record: { id: '2', name: 'Bob' },
      });

      const row = await store.load({
        tableName: snakeCaseTable as TABLE_NAMES,
        keys: { id: '2' },
      });
      expect(row?.name).toBe('Bob');
    });
  });

  describe('Permission Handling', () => {
    const schemaRestrictedUser = 'mastra_schema_restricted_storage';
    const restrictedPassword = 'test123';
    const testSchema = 'testSchema';
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
