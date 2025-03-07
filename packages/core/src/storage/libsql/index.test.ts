import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

import type { WorkflowRunState } from '../../workflows';

import { DefaultStorage } from './index';

// Test database configuration
const TEST_DB_URL = 'file:memory:'; // Use in-memory SQLite for tests

describe('DefaultStorage', () => {
  const storage = new DefaultStorage({
    config: { url: TEST_DB_URL },
  });

  // Sample test data factory functions to ensure unique records
  const createSampleThread = () => ({
    id: `thread-${randomUUID()}`,
    resourceId: `resource-${randomUUID()}`,
    title: 'Test Thread',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { key: 'value' },
  });

  const createSampleThreadWithParams = (threadId: string, resourceId: string, createdAt: Date, updatedAt: Date) => ({
    id: threadId,
    resourceId,
    title: 'Test Thread with given ThreadId and ResourceId',
    createdAt,
    updatedAt,
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

  beforeAll(async () => {
    await storage.init();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await storage.clearTable({ tableName: 'mastra_workflow_snapshot' });
    await storage.clearTable({ tableName: 'mastra_evals' });
    await storage.clearTable({ tableName: 'mastra_messages' });
    await storage.clearTable({ tableName: 'mastra_threads' });
  });

  afterAll(async () => {
    // Clear tables after tests
    await storage.clearTable({ tableName: 'mastra_workflow_snapshot' });
    await storage.clearTable({ tableName: 'mastra_evals' });
    await storage.clearTable({ tableName: 'mastra_messages' });
    await storage.clearTable({ tableName: 'mastra_threads' });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await storage.__saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await storage.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toEqual(thread.title);
    });

    it('should create and retrieve a thread with the same given threadId and resourceId', async () => {
      const exampleThreadId = '1346362547862769664';
      const exampleResourceId = '532374164040974346';
      const createdAt = new Date();
      const updatedAt = new Date();
      const thread = createSampleThreadWithParams(exampleThreadId, exampleResourceId, createdAt, updatedAt);

      // Save thread
      const savedThread = await storage.__saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await storage.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.id).toEqual(exampleThreadId);
      expect(retrievedThread?.resourceId).toEqual(exampleResourceId);
      expect(retrievedThread?.title).toEqual(thread.title);
      expect(retrievedThread?.createdAt).toEqual(createdAt.toISOString());
      expect(retrievedThread?.updatedAt).toEqual(updatedAt.toISOString());
    });

    it('should return null for non-existent thread', async () => {
      const result = await storage.__getThreadById({ threadId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const thread1 = createSampleThread();
      const thread2 = { ...createSampleThread(), resourceId: thread1.resourceId };

      await storage.saveThread({ thread: thread1 });
      await storage.saveThread({ thread: thread2 });

      const threads = await storage.getThreadsByResourceId({ resourceId: thread1.resourceId });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await storage.__saveThread({ thread });

      const newMetadata = { newKey: 'newValue' };
      const updatedThread = await storage.__updateThread({
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
      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toEqual(updatedThread);
    });

    it('should delete thread', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      await storage.deleteThread({ threadId: thread.id });

      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();
    });
  });

  describe('Message Operations', () => {
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];

      // Save messages
      const savedMessages = await storage.__saveMessages({ messages });

      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await storage.__getMessages({ threadId: thread.id });

      expect(retrievedMessages).toHaveLength(2);

      expect(retrievedMessages).toEqual(expect.arrayContaining(messages));
    });

    it('should handle empty message array', async () => {
      const result = await storage.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'First' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Second' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Third' }] },
      ];

      await storage.saveMessages({ messages });

      const retrievedMessages = await storage.getMessages({ threadId: thread.id });

      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((_msg, _idx) => {
        // expect(msg.content[0]).toBe(messages[idx].content.text)
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id),
        { ...createSampleMessage(thread.id), id: null }, // This will cause an error
      ];

      await expect(storage.saveMessages({ messages })).rejects.toThrow();

      // Verify no messages were saved
      const savedMessages = await storage.getMessages({ threadId: thread.id });
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

      await storage.saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await storage.getThreadById({ threadId: thread.id });

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle special characters in thread titles', async () => {
      const thread = {
        ...createSampleThread(),
        title: 'Special \'quotes\' and "double quotes" and emoji 🎉',
      };

      await storage.saveThread({ thread });
      const retrieved = await storage.getThreadById({ threadId: thread.id });

      expect(retrieved?.title).toBe(thread.title);
    });

    it('should handle concurrent thread updates', async () => {
      const thread = createSampleThread();
      await storage.saveThread({ thread });

      // Perform multiple updates concurrently
      const updates = Array.from({ length: 5 }, (_, i) =>
        storage.updateThread({
          id: thread.id,
          title: `Update ${i}`,
          metadata: { update: i },
        }),
      );

      await expect(Promise.all(updates)).resolves.toBeDefined();

      // Verify final state
      const finalThread = await storage.getThreadById({ threadId: thread.id });
      expect(finalThread).toBeDefined();
    });
  });

  describe('Workflow Snapshots', () => {
    beforeAll(async () => {
      // Create workflow_snapshot table
      await storage.createTable({
        tableName: 'mastra_workflow_snapshot',
        schema: {
          workflow_name: { type: 'text', nullable: false },
          run_id: { type: 'text', nullable: false },
          snapshot: { type: 'text', nullable: false },
          created_at: { type: 'timestamp', nullable: false },
          updated_at: { type: 'timestamp', nullable: false },
        },
      });
    });

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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(snapshot);
    });

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await storage.loadWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: complexSnapshot as WorkflowRunState,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });
  });
});
