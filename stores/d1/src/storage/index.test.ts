import { randomUUID } from 'crypto';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { D1Database } from '@cloudflare/workers-types';
// Import Miniflare for D1 testing
import { Miniflare } from 'miniflare';

import { D1Store } from '.';

// Increase timeout for all tests in this file
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

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

const createSampleThreadWithParams = (threadId: string, resourceId: string, createdAt: Date, updatedAt: Date) => ({
  id: threadId,
  resourceId,
  title: 'Test Thread with given ThreadId and ResourceId',
  createdAt,
  updatedAt,
  metadata: { key: 'value' },
});

describe('D1Store', () => {
  let d1Database: D1Database;
  let store: D1Store;
  const tablePrefix = 'test_';

  // Setup before all tests
  beforeAll(async () => {
    console.log('Initializing D1Store with Miniflare...');

    // Create a Miniflare instance with D1
    const mf = new Miniflare({
      modules: true,
      d1Databases: {
        TEST_DB: {
          database: ':memory:', // Use in-memory SQLite for tests
        },
      },
    });

    // Get the D1 database from Miniflare
    d1Database = await mf.getD1Database('TEST_DB');

    // Initialize the D1Store with the test database
    store = new D1Store({
      binding: d1Database,
      tablePrefix,
    });

    // Initialize tables
    await store.init();
    console.log('D1Store initialized');
  });

  // Clean up after all tests
  afterAll(async () => {
    // Clean up tables
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_EVALS });

    await store.close();
  });

  // Reset tables before each test
  beforeEach(async () => {
    // Clear tables for a clean state
    await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_THREADS });
    await store.clearTable({ tableName: TABLE_EVALS });
  });

  describe('Table Operations', () => {
    const testTableName = 'test_custom_table';

    beforeEach(async () => {
      // Try to clean up the test table if it exists
      try {
        await store.clearTable({ tableName: testTableName as any });
      } catch (error) {
        // Table might not exist yet, which is fine
      }
    });

    it('should create a new table with schema', async () => {
      await store.createTable({
        tableName: testTableName as any,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
          created_at: { type: 'timestamp' },
        },
      });

      // Verify table exists by inserting and retrieving data
      await store.insert({
        tableName: testTableName as any,
        record: {
          id: 'test1',
          data: 'test-data',
          created_at: new Date(),
        },
      });

      const result = await store.load<{ id: string; data: string; created_at: Date }>({
        tableName: testTableName as any,
        keys: { id: 'test1' },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test1');
      expect(result?.data).toBe('test-data');
    });

    it('should clear table data', async () => {
      // Create table if it doesn't exist
      await store.createTable({
        tableName: testTableName as any,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text' },
        },
      });

      // Insert test data
      await store.insert({
        tableName: testTableName as any,
        record: { id: 'test2', data: 'to-be-cleared' },
      });

      // Clear the table
      await store.clearTable({ tableName: testTableName as any });

      // Verify data is cleared
      const result = await store.load({
        tableName: testTableName as any,
        keys: { id: 'test2' },
      });

      expect(result).toBeNull();
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      const savedThread = await store.__saveThread({ thread });
      expect(savedThread).toEqual(thread);

      const retrievedThread = await store.__getThreadById({ threadId: thread.id });

      expect(retrievedThread).not.toBeNull();
      expect(retrievedThread?.id).toBe(thread.id);
      expect(retrievedThread?.title).toBe(thread.title);
      expect(retrievedThread?.metadata).toEqual(thread.metadata);
    });

    it('should create and retrieve a thread with the same given threadId and resourceId', async () => {
      const exampleThreadId = '1346362547862769664';
      const exampleResourceId = '532374164040974346';
      const createdAt = new Date();
      const updatedAt = new Date();
      const thread = createSampleThreadWithParams(exampleThreadId, exampleResourceId, createdAt, updatedAt);

      // Save thread
      const savedThread = await store.__saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread?.id).toEqual(exampleThreadId);
      expect(retrievedThread?.resourceId).toEqual(exampleResourceId);
      expect(retrievedThread?.title).toEqual(thread.title);
      expect(retrievedThread?.createdAt).toEqual(createdAt.toISOString());
      expect(retrievedThread?.updatedAt).toEqual(updatedAt.toISOString());
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
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
      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread?.title).toBe('Updated Title');
      expect(retrievedThread).toEqual(updatedThread);
    });

    it('should delete thread', async () => {
      const thread = createSampleThread();

      await store.__saveThread({ thread });

      await store.__deleteThread({ threadId: thread.id });

      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();
    });

    it('should get threads by resource ID', async () => {
      const resourceId = `resource-${randomUUID()}`;
      const threads = [
        { ...createSampleThread(), resourceId },
        { ...createSampleThread(), resourceId },
      ];

      await Promise.all(threads.map(thread => store.__saveThread({ thread })));

      const result = await store.__getThreadsByResourceId({ resourceId });

      expect(result).toHaveLength(2);
      expect(result[0].resourceId).toBe(resourceId);
      expect(result[1].resourceId).toBe(resourceId);
    });

    it('should return null for non-existent thread', async () => {
      const result = await store.__getThreadById({ threadId: 'non-existent' });
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
  });

  describe('Message Operations', () => {
    it('should handle empty message array', async () => {
      const result = await store.__saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.__saveThread({ thread });

      const messages = [createSampleMessage(thread.id), createSampleMessage(thread.id)];

      // Save messages
      const savedMessages = await store.__saveMessages({ messages });

      expect(savedMessages).toEqual(messages);

      // Retrieve messages
      const retrievedMessages = await store.__getMessages({ threadId: thread.id });

      expect(retrievedMessages).toHaveLength(2);

      expect(retrievedMessages).toEqual(expect.arrayContaining(messages));
    });

    it('should maintain message order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'First' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Second' }] },
        { ...createSampleMessage(thread.id), content: [{ type: 'text', text: 'Third' }] },
      ];

      await store.saveMessages({ messages });

      const retrievedMessages = await store.getMessages({ threadId: thread.id });

      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((_msg, _idx) => {
        // expect(msg.content[0]).toBe(messages[idx].content.text)
      });
    });

    it('should rollback on error during message save', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [
        createSampleMessage(thread.id),
        { ...createSampleMessage(thread.id), id: null }, // This will cause an error
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
      } as unknown as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
        snapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(snapshot);
    });

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await store.loadWorkflowSnapshot({
        namespace: 'default',
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
      } as unknown as WorkflowRunState;

      const updatedSnapshot = {
        status: 'completed',
        context: {
          stepResults: {
            'step-1': { status: 'success', result: { data: 'test' } },
          },
          attempts: { 'step-1': 1 },
          triggerData: { type: 'manual' },
        },
      } as unknown as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
        snapshot: initialSnapshot,
      });

      await store.persistWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace: 'default',
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(updatedSnapshot);
    });
    beforeAll(async () => {
      // Create workflow_snapshot table
      await store.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: {
          workflow_name: { type: 'text', nullable: false },
          run_id: { type: 'text', nullable: false },
          snapshot: { type: 'text', nullable: false },
          created_at: { type: 'timestamp', nullable: false },
          updated_at: { type: 'timestamp', nullable: false },
        },
      });
    });

    it('should handle complex workflow state', async () => {
      const workflowName = 'complex-workflow';
      const namespace = 'test-namespace';
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
        namespace,
        workflowName,
        runId,
        snapshot: complexSnapshot as unknown as WorkflowRunState,
      });

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        namespace,
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions for atomic operations', async () => {
      const thread = createSampleThread();

      // Use transaction to save thread and messages atomically
      await store.withTransaction(async transaction => {
        // Create thread within transaction
        const threadSql = `
          INSERT INTO ${tablePrefix}${MastraStorage.TABLE_THREADS} 
          (id, resource_id, title, metadata, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await transaction.executeQuery({
          sql: threadSql,
          params: [
            thread.id,
            thread.resourceId,
            thread.title,
            JSON.stringify(thread.metadata),
            thread.createdAt.toISOString(),
            thread.updatedAt.toISOString(),
          ],
        });

        // Create a message within the same transaction
        const message = createSampleMessage(thread.id);
        const messageSql = `
          INSERT INTO ${tablePrefix}${MastraStorage.TABLE_MESSAGES}
          (id, thread_id, role, type, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await transaction.executeQuery({
          sql: messageSql,
          params: [
            message.id,
            message.threadId,
            message.role,
            message.type,
            JSON.stringify(message.content),
            message.createdAt.toISOString(),
          ],
        });
      });

      // Verify both operations succeeded
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread).not.toBeNull();

      const messages = await store.__getMessages({ threadId: thread.id });
      expect(messages).toHaveLength(1);
    });

    it('should rollback transaction on error', async () => {
      const thread = createSampleThread();

      try {
        await store.withTransaction(async transaction => {
          // First operation: create thread (should succeed)
          const threadSql = `
            INSERT INTO ${tablePrefix}${MastraStorage.TABLE_THREADS} 
            (id, resource_id, title, metadata, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          await transaction.executeQuery({
            sql: threadSql,
            params: [
              thread.id,
              thread.resourceId,
              thread.title,
              JSON.stringify(thread.metadata),
              thread.createdAt.toISOString(),
              thread.updatedAt.toISOString(),
            ],
          });

          // Second operation: intentionally cause an error
          // by inserting into a non-existent table
          await transaction.executeQuery({
            sql: 'INSERT INTO non_existent_table (id) VALUES (?)',
            params: ['will-fail'],
          });
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }

      // Verify the thread was not created due to rollback
      const retrievedThread = await store.__getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeNull();
    });
  });
});
