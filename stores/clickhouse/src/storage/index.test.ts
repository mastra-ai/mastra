import { randomUUID } from 'crypto';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

const TEST_CONFIG: ClickhouseConfig = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
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

describe('ClickhouseStore', () => {
  let store: ClickhouseStore;

  beforeAll(async () => {
    store = new ClickhouseStore(TEST_CONFIG);
    await store.init();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await store.clearTable({ tableName: 'mastra_workflow_snapshot' });
    await store.clearTable({ tableName: 'mastra_messages' });
    await store.clearTable({ tableName: 'mastra_threads' });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();
      console.log('Saving thread:', thread);

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
      console.log('Saving thread:', thread);
      await store.__saveThread({ thread });

      const newMetadata = { newKey: 'newValue' };
      const updatedThread = await store.__updateThread({
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
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread).toEqual(updatedThread);
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];
      await store.__saveMessages({ messages });

      await store.__deleteThread({ threadId: thread.id });

      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();

      // Verify messages were also deleted
      const retrievedMessages = await store.__getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Message Operations', () => {
    it.only('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id, new Date(Date.now() - 1000 * 60 * 60 * 24)),
        createSampleMessage(thread.id),
      ];

      // Save messages
      const savedMessages = await store.__saveMessages({ messages });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.__getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(2);
      console.log('Messages:', messages);
      console.log('Retrieved messages:', retrievedMessages);
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
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'First' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Second' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Third' }] },
      ];

      await store.__saveMessages({ messages });

      const retrievedMessages = await store.__getMessages({ threadId: thread.id });
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content[0].text).toBe(messages[idx].content[0].text);
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id),
        { ...createSampleMessage(thread.id), id: null }, // This will cause an error
      ];

      await expect(store.__saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await store.__getMessages({ threadId: thread.id });
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

      await store.__saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await store.__getThreadById({ threadId: thread.id });

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle special characters in thread titles', async () => {
      const thread = {
        ...createSampleThread(),
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      };

      await store.__saveThread({ thread });
      const retrieved = await store.__getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    });

    it('should handle concurrent thread updates', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      // Perform multiple updates concurrently
      const updates = Array.from({ length: 5 }, (_, i) =>
        store.__updateThread({
          id: thread.id,
          title: `Update ${i}`,
          metadata: { update: i },
        }),
      );

      await expect(Promise.all(updates)).resolves.toBeDefined();

      // Verify final state
      const finalThread = await store.__getThreadById({ threadId: thread.id });
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
        snapshot: complexSnapshot as WorkflowRunState,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });
  });

  afterAll(async () => {
    await store.close();
  });
});
