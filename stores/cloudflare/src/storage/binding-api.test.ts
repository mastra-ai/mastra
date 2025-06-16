import type { KVNamespace } from '@cloudflare/workers-types';
import {
  createSampleMessageV1,
  createSampleMessageV2,
  createSampleThread,
  checkWorkflowSnapshot,
} from '@internal/storage-test-utils';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import type { TABLE_NAMES } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, afterEach } from 'vitest';
import { createSampleTrace, createSampleWorkflowSnapshot, retryUntil } from './test-utils';
import type { CloudflareStoreConfig } from './types';
import { CloudflareStore } from '.';

export interface Env {
  [TABLE_THREADS]: KVNamespace;
  [TABLE_MESSAGES]: KVNamespace;
  [TABLE_WORKFLOW_SNAPSHOT]: KVNamespace;
  [TABLE_EVALS]: KVNamespace;
  [TABLE_TRACES]: KVNamespace;
}

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

// Initialize Miniflare with minimal worker
const mf = new Miniflare({
  script: 'export default {};',
  modules: true,
  kvNamespaces: [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS, TABLE_TRACES],
});

const TEST_CONFIG: CloudflareStoreConfig = {
  bindings: {} as Env, // Will be populated in beforeAll
  keyPrefix: 'mastra-test', // Fixed prefix for test isolation
};

describe('CloudflareStore Workers Binding', () => {
  // Add test helper methods to CloudflareStore and set up bindings
  beforeAll(async () => {
    // Get KV namespaces from Miniflare
    const kvBindings = {
      [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
      [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
      [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
      [TABLE_EVALS]: (await mf.getKVNamespace(TABLE_EVALS)) as KVNamespace,
      [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
    };

    // Set bindings in test config
    TEST_CONFIG.bindings = kvBindings;
  });
  let store: CloudflareStore;

  beforeAll(() => {
    store = new CloudflareStore(TEST_CONFIG);
  });

  // Helper to clean up KV data between tests
  const cleanupKVData = async () => {
    // List and delete all keys in each namespace
    const tables = [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS, TABLE_TRACES] as TABLE_NAMES[];

    for (const table of tables) {
      try {
        await clearTableExceptSchema(store, table);
      } catch (error) {
        console.error(`Error cleaning up namespace ${table}:`, error);
      }
    }
  };

  const clearTableExceptSchema = async (store: CloudflareStore, tableName: TABLE_NAMES) => {
    const keys = await store['listKV'](tableName);
    if (keys.length > 0) {
      const schemaPrefix = store['namespacePrefix'] ? `${store['namespacePrefix']}:schema:` : 'schema:';
      const nonSchemaKeys = keys.filter(keyObj => !keyObj.name.startsWith(schemaPrefix));
      if (nonSchemaKeys.length > 0) {
        await Promise.all(nonSchemaKeys.map(keyObj => store['deleteKV'](tableName, keyObj.name)));
      }
    }
  };

  beforeEach(async () => {
    await cleanupKVData();
  });

  afterAll(async () => {
    await cleanupKVData();
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

  describe('Table Operations', () => {
    const testTableName = TABLE_THREADS;
    const testTableName2 = TABLE_MESSAGES;

    beforeEach(async () => {
      // Clear tables before each test
      await clearTableExceptSchema(store, testTableName).catch(() => {});
      await clearTableExceptSchema(store, testTableName2).catch(() => {});
    });

    it('should create a new table with schema', async () => {
      await store.createTable({
        tableName: testTableName,
        schema: {
          id: { type: 'text', primaryKey: true },
          data: { type: 'text', nullable: true },
        },
      });

      // Verify schema key format
      const schemaKey = store['getSchemaKey'](testTableName);
      const expectedSchemaKey = `${TEST_CONFIG.keyPrefix}:schema:${testTableName}`;
      expect(schemaKey).toBe(expectedSchemaKey);

      // Verify schema exists
      const schema = await store['getTableSchema'](testTableName);
      expect(schema).toBeTruthy();
      expect(schema?.id?.type).toBe('text');
      expect(schema?.id?.primaryKey).toBe(true);

      // Verify table exists by inserting and retrieving data
      await store.insert({
        tableName: testTableName,
        record: {
          id: 'test1',
          data: 'test-data',
          title: 'Test Thread',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as StorageThreadType,
      });

      const result = await store.load<StorageThreadType>({ tableName: testTableName, keys: { id: 'test1' } });
      expect(result).toBeTruthy();
      if (result) {
        expect(result.title).toBe('Test Thread');
        expect(result.resourceId).toBe('resource-1');
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      }
    });

    it('should handle multiple table creation', async () => {
      await store.createTable({
        tableName: testTableName2,
        schema: {
          id: { type: 'text', primaryKey: true },
          threadId: { type: 'text', nullable: false }, // Use nullable: false instead of required
          data: { type: 'text', nullable: true },
        },
      });

      // Verify both tables work independently
      await store.insert({
        tableName: testTableName2,
        record: {
          id: 'test2',
          threadId: 'thread-1',
          content: [{ type: 'text', text: 'test-data-2' }],
          role: 'user',
        } as MastraMessageV1,
      });

      const result = await store.load<MastraMessageV1>({
        tableName: testTableName2,
        keys: { id: 'test2', threadId: 'thread-1' },
      });
      expect(result).toBeTruthy();
      if (result) {
        expect(result.threadId).toBe('thread-1');
        expect(result.content).toEqual([{ type: 'text', text: 'test-data-2' }]);
        expect(result.role).toBe('user');
      }
    });
  });

  describe('Thread Operations', () => {
    it('should create and retrieve a thread', async () => {
      const thread = createSampleThread();

      // Save thread
      const savedThread = await store.saveThread({ thread });
      expect(savedThread).toEqual(thread);

      // Retrieve thread
      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.title === thread.title,
      );
      expect(retrievedThread?.title).toEqual(thread.title);
      expect(retrievedThread).not.toBeNull();
      expect(retrievedThread?.id).toBe(thread.id);
      expect(retrievedThread?.title).toBe(thread.title);
      expect(retrievedThread?.metadata).toEqual(thread.metadata);
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

      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread1.resourceId }),
        threads => threads?.length === 2,
      );
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.id)).toEqual(expect.arrayContaining([thread1.id, thread2.id]));
    });

    it('should update thread title and metadata', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const updatedTitle = 'Updated Title';
      const updatedMetadata = { newKey: 'newValue' };
      const updatedThread = await store.updateThread({
        id: thread.id,
        title: updatedTitle,
        metadata: updatedMetadata,
      });

      expect(updatedThread.title).toBe(updatedTitle);
      expect(updatedThread.metadata).toEqual({
        ...thread.metadata,
        ...updatedMetadata,
      });

      // Verify persistence with retry
      const retrieved = await retryUntil(
        async () =>
          await store.load<StorageThreadType>({
            tableName: TABLE_THREADS,
            keys: { id: thread.id },
          }),
        (thread): boolean => {
          if (!thread || !thread.metadata) return false;
          return (
            thread.title === updatedTitle &&
            Object.entries(updatedMetadata).every(([key, value]) => thread?.metadata?.[key] === value)
          );
        },
      );

      expect(retrieved?.title).toBe(updatedTitle);
      expect(retrieved?.metadata).toEqual(expect.objectContaining(updatedMetadata));
    });

    it('should delete thread and its messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Add some messages
      const messages = [createSampleMessageV2({ threadId: thread.id }), createSampleMessageV2({ threadId: thread.id })];
      await store.saveMessages({ messages, format: 'v2' });

      await store.deleteThread({ threadId: thread.id });

      // Verify thread deletion with retry
      await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        thread => thread === null,
      );

      // Verify messages were also deleted with retry
      const retrievedMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length === 0,
      );
      expect(retrievedMessages).toHaveLength(0);
    });
  });

  describe('Message Operations', () => {
    it('should handle empty message array', async () => {
      const result = await store.saveMessages({ messages: [] });
      expect(result).toEqual([]);
    });
    it('should save and retrieve messages', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      const messages = [createSampleMessageV2({ threadId: thread.id }), createSampleMessageV2({ threadId: thread.id })];

      // Save messages
      const savedMessages = await store.saveMessages({ messages, format: 'v2' });
      expect(savedMessages).toEqual(messages);

      // Retrieve messages with retry
      const retrievedMessages = await retryUntil(
        async () => {
          const msgs = await store.getMessages({ threadId: thread.id, format: 'v2' });
          return msgs;
        },
        msgs => msgs.length === 2,
      );

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
        createSampleMessageV2({ threadId: thread.id, content: 'First', resourceId: thread.resourceId }),
        createSampleMessageV2({ threadId: thread.id, content: 'Second', resourceId: thread.resourceId }),
        createSampleMessageV2({ threadId: thread.id, content: 'Third', resourceId: thread.resourceId }),
      ];

      await store.saveMessages({ messages, format: 'v2' });

      const retrievedMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length > 0,
      );
      expect(retrievedMessages).toHaveLength(3);

      // Verify order is maintained
      retrievedMessages.forEach((msg, idx) => {
        expect(msg.content).toEqual(messages[idx].content);
      });
    });

    // it('should retrieve messages w/ next/prev messages by message id + resource id', async () => {
    //   const messages: MastraMessageV2[] = [
    //     createSampleMessageV2({
    //       threadId: 'thread-one',
    //       content: 'First',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     createSampleMessageV2({
    //       threadId: 'thread-one',
    //       content: 'Second',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     createSampleMessageV2({
    //       threadId: 'thread-one',
    //       content: 'Third',
    //       resourceId: 'cross-thread-resource',
    //     }),

    //     createSampleMessageV2({
    //       threadId: 'thread-two',
    //       content: 'Fourth',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     createSampleMessageV2({
    //       threadId: 'thread-two',
    //       content: 'Fifth',
    //       resourceId: 'cross-thread-resource',
    //     }),
    //     createSampleMessageV2({
    //       threadId: 'thread-two',
    //       content: 'Sixth',
    //       resourceId: 'cross-thread-resource',
    //     }),

    //     createSampleMessageV2({
    //       threadId: 'thread-three',
    //       content: 'Seventh',
    //       resourceId: 'other-resource',
    //     }),
    //     createSampleMessageV2({
    //       threadId: 'thread-three',
    //       content: 'Eighth',
    //       resourceId: 'other-resource',
    //     }),
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
  });

  describe('Workflow Operations', () => {
    it('should save and retrieve workflow snapshots', async () => {
      const thread = createSampleThread();
      const { snapshot, runId } = createSampleWorkflowSnapshot(thread.id, 'running');

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId,
        snapshot,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId,
          }),
        snapshot => snapshot?.runId === runId,
      );

      expect(retrieved).toEqual(snapshot);
    });

    it('should handle non-existent workflow snapshots', async () => {
      const result = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: 'non-existent',
      });
      expect(result).toBeNull();
    });

    it('should update workflow snapshot status', async () => {
      const thread = createSampleThread();
      const { snapshot, runId } = createSampleWorkflowSnapshot(thread.id, 'running');

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId,
        snapshot,
      });

      const updatedSnapshot = {
        ...snapshot,
        value: { [runId]: 'completed' },
        timestamp: Date.now(),
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId,
        snapshot: updatedSnapshot,
      });

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId,
          }),
        snapshot => snapshot?.value[runId] === 'completed',
      );

      expect(retrieved?.value[runId]).toBe('completed');
      expect(retrieved?.timestamp).toBeGreaterThan(snapshot.timestamp);
    });
  });

  describe('Date Handling', () => {
    it('should handle Date objects in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-date-1',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      };

      await store.saveThread({ thread });
      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });

    it('should handle ISO string dates in thread operations', async () => {
      const now = new Date();
      const thread = {
        id: 'thread-date-2',
        resourceId: 'resource-1',
        title: 'Test Thread',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        metadata: {},
      };

      await store.saveThread({ thread: thread as any });
      const retrievedThread = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );
      expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
      expect(retrievedThread?.updatedAt).toBeInstanceOf(Date);
      expect(retrievedThread?.createdAt.toISOString()).toBe(now.toISOString());
      expect(retrievedThread?.updatedAt.toISOString()).toBe(now.toISOString());
    });
  });

  describe('Message Ordering', () => {
    it('should handle duplicate timestamps gracefully', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with identical timestamps
      const timestamp = new Date();
      const messages = Array.from({ length: 3 }, () =>
        createSampleMessageV2({ threadId: thread.id, createdAt: timestamp }),
      );

      await store.saveMessages({ messages, format: 'v2' });

      // Verify order is maintained based on insertion order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === messages.length,
      );

      // Order should match insertion order
      expect(order).toEqual(messages.map(m => m.id));
    });

    it('should preserve write order when messages are saved concurrently', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with different timestamps
      const now = Date.now();
      const messages = Array.from({ length: 3 }, (_, i) =>
        createSampleMessageV2({ threadId: thread.id, createdAt: new Date(now - (2 - i) * 1000) }),
      );

      // Save messages in reverse order to verify write order is preserved
      const reversedMessages = [...messages].reverse(); // newest -> oldest
      await Promise.all(reversedMessages.map(msg => store.saveMessages({ messages: [msg], format: 'v2' })));

      // Verify messages are saved and maintain write order (not timestamp order)
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store['getFullOrder'](orderKey);
          // Verify both length and that all messages are present
          return currentOrder.length === messages.length && currentOrder.every(id => messages.some(m => m.id === id))
            ? currentOrder
            : null;
        },
        order => order !== null,
        5000,
      );

      expect(order).toEqual(reversedMessages.map(m => m.id));
    });

    it('should handle score updates correctly', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessageV2({ threadId: thread.id }));
      await store.saveMessages({ messages, format: 'v2' });

      // Update scores to reverse order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      await store['updateSortedMessages'](
        orderKey,
        messages.map((msg, i) => ({
          id: msg.id,
          score: messages.length - 1 - i,
        })),
      );

      // Verify new order
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order[0] === messages?.[messages.length - 1]?.id,
      );
      expect(order).toEqual(messages.map(m => m.id).reverse());
    });

    it('should maintain message order using sorted sets', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with explicit timestamps to test chronological ordering
      const baseTime = new Date('2025-03-14T23:30:20.930Z').getTime();
      const messages = [
        createSampleMessageV1({ threadId: thread.id, content: 'First', createdAt: new Date(baseTime) }),
        createSampleMessageV1({ threadId: thread.id, content: 'Second', createdAt: new Date(baseTime + 1000) }),
        createSampleMessageV1({ threadId: thread.id, content: 'Third', createdAt: new Date(baseTime + 2000) }),
      ];

      await store.saveMessages({ messages });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get messages and verify order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const order = await store['getFullOrder'](orderKey);
          return order;
        },
        order => order.length > 0,
      );
      expect(order.length).toBe(3);

      // Verify we can get specific ranges
      const firstTwo = await retryUntil(
        async () => await store['getRange'](orderKey, 0, 1),
        order => order.length > 0,
      );

      expect(firstTwo.length).toBe(2);

      const lastTwo = await retryUntil(
        async () => await store['getLastN'](orderKey, 2),
        order => order.length > 0,
      );
      expect(lastTwo.length).toBe(2);

      // Verify message ranks
      const firstMessageRank = await retryUntil(
        async () => await store['getRank'](orderKey, messages[0].id),
        order => order !== null,
      );
      expect(firstMessageRank).toBe(0);
    });
  });

  describe('Workflow Snapshots', () => {
    beforeEach(async () => {
      // Clear workflow snapshots before each test
      await store.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should persist and load workflow snapshots', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run',
        value: { 'test-run': 'running' },
        timestamp: Date.now(),
        context: {
          'step-1': {
            status: 'success' as const,
            output: { input: 'test' },
          },
          input: { source: 'test' },
        } as unknown as WorkflowRunState['context'],
        activePaths: [],
        suspendedPaths: {},
        status: 'success',
        serializedStepGraph: [],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.runId === workflow.runId,
      );

      expect(retrieved).toEqual(workflow);
    });

    it('should handle non-existent workflow snapshots', async () => {
      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'non-existent',
        runId: 'non-existent',
      });

      expect(retrieved).toBeNull();
    });

    it('should update workflow snapshot status', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run-2',
        value: { 'test-run-2': 'running' },
        timestamp: Date.now(),
        context: {
          'step-1': {
            status: 'success' as const,
            output: { input: 'test' },
          },
          input: { source: 'test' },
        } as unknown as WorkflowRunState['context'],
        activePaths: [],
        suspendedPaths: {},
        status: 'success',
        serializedStepGraph: [],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      // Update the workflow status
      const updatedWorkflow: WorkflowRunState = {
        ...workflow,
        value: { 'test-run-2': 'completed' },
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: updatedWorkflow,
      });

      const retrieved = await retryUntil(
        async () =>
          await store.loadWorkflowSnapshot({
            namespace: 'test',
            workflowName: 'test-workflow',
            runId: workflow.runId,
          }),
        snapshot => snapshot?.value[workflow.runId] === 'completed',
      );

      expect(retrieved?.value[workflow.runId]).toBe('completed');

      // Verify the workflow is stored in the correct namespace
      const keys = await store['listKV'](TABLE_WORKFLOW_SNAPSHOT);
      const key = store['getKey'](TABLE_WORKFLOW_SNAPSHOT, {
        namespace: 'test',
        workflow_name: 'test-workflow',
        run_id: workflow.runId,
      });
      expect(keys.some(k => k.name === key)).toBe(true);
    });

    it('should handle workflow step updates', async () => {
      const workflow: WorkflowRunState = {
        runId: 'test-run-3',
        value: { 'test-run-3': 'running' },
        timestamp: Date.now(),
        context: {
          'step-1': {
            status: 'success' as const,
            output: { input: 'test' },
          },
          'step-2': {
            status: 'success' as const,
            output: { input: 'test2' },
          },
          input: { source: 'test' },
        } as unknown as WorkflowRunState['context'],
        activePaths: [],
        suspendedPaths: {},
        status: 'success',
        serializedStepGraph: [],
      };

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: workflow,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Update step-1 status to completed
      const updatedWorkflow = {
        ...workflow,
        context: {
          ...workflow.context,
          'step-1': {
            status: 'success' as const,
            output: { result: 'done' },
          },
        },
        activePaths: [],
      } as unknown as WorkflowRunState;

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
        snapshot: updatedWorkflow,
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const retrieved = await store.loadWorkflowSnapshot({
        namespace: 'test',
        workflowName: 'test-workflow',
        runId: workflow.runId,
      });

      expect(retrieved?.context['step-1'].status).toBe('success');
      expect((retrieved?.context['step-1'] as any).output).toEqual({ result: 'done' });
      expect(retrieved?.context['step-2'].status).toBe('success');
      expect(retrieved?.activePaths).toEqual([]);
    });
  });

  describe('getWorkflowRuns', () => {
    const testNamespace = 'test-namespace';
    it('returns empty array when no workflows exist', async () => {
      const { runs, total } = await store.getWorkflowRuns();
      expect(runs).toEqual([]);
      expect(total).toBe(0);
    });

    it('returns all workflows by default', async () => {
      const workflowName1 = 'default_test_1';
      const workflowName2 = 'default_test_2';
      const thread1 = createSampleThread();
      const thread2 = createSampleThread();

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = createSampleWorkflowSnapshot(thread1.id, 'success');
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = createSampleWorkflowSnapshot(thread2.id, 'waiting');

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await store.getWorkflowRuns({ namespace: 'test' });
      expect(runs).toHaveLength(2);
      expect(total).toBe(2);
      expect(runs[0]!.workflowName).toBe(workflowName2); // Most recent first
      expect(runs[1]!.workflowName).toBe(workflowName1);
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId2, 'waiting');
      checkWorkflowSnapshot(secondSnapshot, stepId1, 'success');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';
      const thread = createSampleThread();

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = createSampleWorkflowSnapshot(thread.id, 'success');
      const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot(thread.id, 'failed');

      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await store.persistWorkflowSnapshot({
        namespace: 'test',
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await store.getWorkflowRuns({ namespace: 'test', workflowName: workflowName1 });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot;
      if (typeof snapshot === 'string') {
        throw new Error('Expected WorkflowRunState, got string');
      }
      expect(snapshot.context?.[stepId1]?.status).toBe('success');
    });

    it('filters by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const workflowName1 = 'date_test_1';
      const workflowName2 = 'date_test_2';
      const workflowName3 = 'date_test_3';
      const thread = createSampleThread();

      const { snapshot: workflow1, runId: runId1 } = createSampleWorkflowSnapshot(thread.id, 'success');
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = createSampleWorkflowSnapshot(thread.id, 'waiting');
      const {
        snapshot: workflow3,
        runId: runId3,
        stepId: stepId3,
      } = createSampleWorkflowSnapshot(thread.id, 'skipped');

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
      const firstSnapshot = runs[0]!.snapshot;
      const secondSnapshot = runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'skipped');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'waiting');
    });

    it('handles pagination', async () => {
      const workflowName1 = 'page_test_1';
      const workflowName2 = 'page_test_2';
      const workflowName3 = 'page_test_3';
      const thread = createSampleThread();

      const {
        snapshot: workflow1,
        runId: runId1,
        stepId: stepId1,
      } = createSampleWorkflowSnapshot(thread.id, 'success');
      const {
        snapshot: workflow2,
        runId: runId2,
        stepId: stepId2,
      } = createSampleWorkflowSnapshot(thread.id, 'waiting');
      const {
        snapshot: workflow3,
        runId: runId3,
        stepId: stepId3,
      } = createSampleWorkflowSnapshot(thread.id, 'skipped');

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
      const firstSnapshot = page1.runs[0]!.snapshot;
      const secondSnapshot = page1.runs[1]!.snapshot;
      checkWorkflowSnapshot(firstSnapshot, stepId3, 'skipped');
      checkWorkflowSnapshot(secondSnapshot, stepId2, 'waiting');

      // Get second page
      const page2 = await store.getWorkflowRuns({
        namespace: testNamespace,
        limit: 2,
        offset: 2,
      });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
      expect(page2.runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = page2.runs[0]!.snapshot;
      checkWorkflowSnapshot(snapshot, stepId1, 'success');
    });
  });
  describe('getWorkflowRunById', () => {
    const testNamespace = 'test-workflows-id';
    const workflowName = 'workflow-id-test';
    let runId: string;
    let stepId: string;

    beforeEach(async () => {
      const thread = createSampleThread();
      // Insert a workflow run for positive test
      const sample = createSampleWorkflowSnapshot(thread.id, 'success');
      runId = sample.runId;
      stepId = sample.stepId;
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace: testNamespace,
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
        namespace: testNamespace,
        runId,
        workflowName,
      });
      expect(found).not.toBeNull();
      expect(found?.runId).toBe(runId);
      const snapshot = found?.snapshot;
      checkWorkflowSnapshot(snapshot!, stepId, 'success');
    });

    it('should return null for non-existent workflow run ID', async () => {
      const notFound = await store.getWorkflowRunById({
        namespace: testNamespace,
        runId: 'non-existent-id',
        workflowName,
      });
      expect(notFound).toBeNull();
    });
  });
  describe('getWorkflowRuns with resourceId', () => {
    const testNamespace = 'test-workflows-id';
    const workflowName = 'workflow-id-test';
    let resourceId: string;
    let runIds: string[] = [];

    beforeEach(async () => {
      const thread = createSampleThread();
      // Insert multiple workflow runs for the same resourceId
      resourceId = 'resource-shared';
      for (const status of ['success', 'waiting']) {
        const sample = createSampleWorkflowSnapshot(thread.id, status);
        runIds.push(sample.runId);
        await store.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            namespace: testNamespace,
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
      const other = createSampleWorkflowSnapshot(thread.id, 'waiting');
      await store.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace: testNamespace,
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
        namespace: testNamespace,
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
        namespace: testNamespace,
        resourceId: 'non-existent-resource',
        workflowName,
      });
      expect(Array.isArray(runs)).toBe(true);
      expect(runs.length).toBe(0);
    });
  });

  describe('Data Validation', () => {
    it('should handle missing optional fields', async () => {
      const thread = {
        ...createSampleThread(),
        metadata: undefined, // Optional field
      };
      await store.saveThread({ thread });

      // Should be able to retrieve thread
      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread.resourceId }),
        threads => threads.length > 0,
      );
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread.id);
      expect(threads[0].metadata).toStrictEqual({});
    });

    it('should sanitize and handle special characters', async () => {
      const thread = createSampleThread();
      const message = createSampleMessageV2({ threadId: thread.id, content: '特殊字符 !@#$%^&*()' });

      await store.saveThread({ thread });
      await store.saveMessages({ messages: [message], format: 'v2' });

      // Should retrieve correctly
      const messages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length > 0,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toEqual(message.content);
    });

    it('should validate thread structure', async () => {
      const invalidThread = {
        ...createSampleThread(),
        createdAt: 'invalid-date' as any, // Invalid date
      };

      // Should throw on invalid data
      await expect(store.saveThread({ thread: invalidThread })).rejects.toThrow();
    });
  });

  describe('Key Generation', () => {
    it('should generate correct keys with and without prefix', async () => {
      // Test without prefix
      const storeNoPrefix = new CloudflareStore({
        ...TEST_CONFIG,
        keyPrefix: '',
      });

      // Regular key generation
      expect(storeNoPrefix['getKey'](TABLE_THREADS, { id: 'test1' })).toBe(`${TABLE_THREADS}:test1`);
      expect(storeNoPrefix['getKey'](TABLE_MESSAGES, { threadId: 'thread1', id: 'msg1' })).toBe(
        `${TABLE_MESSAGES}:thread1:msg1`,
      );

      // Test with prefix
      const prefix = 'test-prefix';
      const storeWithPrefix = new CloudflareStore({
        ...TEST_CONFIG,
        keyPrefix: prefix,
      });

      // Regular key generation with prefix
      expect(storeWithPrefix['getKey'](TABLE_THREADS, { id: 'test1' })).toBe(`${prefix}:${TABLE_THREADS}:test1`);
      expect(storeWithPrefix['getKey'](TABLE_MESSAGES, { threadId: 'thread1', id: 'msg1' })).toBe(
        `${prefix}:${TABLE_MESSAGES}:thread1:msg1`,
      );

      // Schema key generation
      const schemaKey = storeWithPrefix['getSchemaKey'](TABLE_THREADS);
      expect(schemaKey).toBe(`${prefix}:schema:${TABLE_THREADS}`);

      // Message ordering key
      const orderKey = storeWithPrefix['getThreadMessagesKey']('thread1');
      expect(orderKey).toBe(`${prefix}:${TABLE_MESSAGES}:thread1:messages`);
    });

    it('should maintain consistent key format across operations', async () => {
      const thread = createSampleThread();
      const message = createSampleMessageV2({ threadId: thread.id });

      // Save thread and message
      await store.saveThread({ thread });
      await store.saveMessages({ messages: [message], format: 'v2' });

      // Verify message key format
      const msgKey = store['getKey'](TABLE_MESSAGES, { threadId: thread.id, id: message.id });
      const expectedMsgKey = `${TEST_CONFIG.keyPrefix}:${TABLE_MESSAGES}:${thread.id}:${message.id}`;
      expect(msgKey).toBe(expectedMsgKey);

      // Verify key format in KV storage
      const kvList = await store['listKV'](TABLE_THREADS);
      const threadKeys = kvList.map(item => item.name);
      const prefix = TEST_CONFIG.keyPrefix;

      // Thread key should have correct prefix
      const expectedThreadKey = prefix ? `${prefix}:${TABLE_THREADS}:${thread.id}` : `${TABLE_THREADS}:${thread.id}`;
      expect(threadKeys).toContain(expectedThreadKey);

      // Message key should have correct prefix
      const threadMsgsKey = store['getThreadMessagesKey'](thread.id);
      const messageOrder = await retryUntil(
        async () => await store['getFullOrder'](threadMsgsKey),
        messages => messages.length > 0,
      );
      expect(messageOrder).toContain(message.id);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent message updates concurrently', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with sequential timestamps (but write order will be preserved)
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) =>
        createSampleMessageV2({ threadId: thread.id, createdAt: new Date(now + i * 1000) }),
      );

      // Save messages in parallel - write order should be preserved
      await Promise.all(messages.map(msg => store.saveMessages({ messages: [msg], format: 'v2' })));

      // Order should reflect write order, not timestamp order
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await store['getFullOrder'](orderKey);

      // Verify messages exist in write order
      const messageIds = messages.map(m => m.id);
      expect(order).toEqual(messageIds);

      // Verify all messages were saved
      expect(order.length).toBe(messages.length);
      expect(new Set(order)).toEqual(new Set(messageIds));
    });

    it('should maintain order with concurrent score updates', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessageV2({ threadId: thread.id }));
      await store.saveMessages({ messages, format: 'v2' });

      const orderKey = store['getThreadMessagesKey'](thread.id);

      // Perform multiple concurrent score updates
      await Promise.all([
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Order should be immediately consistent
      const order = await store['getFullOrder'](orderKey);

      const expectedOrder = messages
        .slice()
        .reverse()
        .map(m => m.id);

      expect(order).toEqual(expectedOrder);
    });
  });

  describe('Resource Management', () => {
    it('should clean up orphaned messages when thread is deleted', async () => {
      const thread = createSampleThread();
      const messages = Array.from({ length: 3 }, () => createSampleMessageV2({ threadId: thread.id }));

      await store.saveThread({ thread });
      await store.saveMessages({ messages, format: 'v2' });

      // Verify messages exist
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const initialOrder = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        messages => messages.length > 0,
      );
      expect(initialOrder).toHaveLength(messages.length);

      // Delete thread
      await store.deleteThread({ threadId: thread.id });

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify messages are cleaned up
      const finalOrder = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === 0,
      );
      expect(finalOrder).toHaveLength(0);

      // Verify thread is gone
      const threads = await store.getThreadsByResourceId({ resourceId: thread.resourceId });
      expect(threads).toHaveLength(0);
    });

    it('should handle namespace cleanup edge cases', async () => {
      // Create test data
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create test messages with unique timestamps
      const testMessages = Array.from({ length: 10 }, (_, i) =>
        createSampleMessageV2({ threadId: thread.id, createdAt: new Date(Date.now() + i * 1000) }),
      );
      await store.saveMessages({ messages: testMessages, format: 'v2' });

      // Verify messages are saved
      const initialMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length === testMessages.length,
      );
      expect(initialMessages).toHaveLength(testMessages.length);

      // Delete thread
      await store.deleteThread({ threadId: thread.id });

      // Verify cleanup with retries
      await retryUntil(
        async () => {
          const keys = await store.listNamespaceKeys(TABLE_THREADS, {
            limit: 1000,
            prefix: thread.id,
          });
          return keys;
        },
        keys => keys.length === 0,
      );

      // Verify all data is cleaned up
      const remainingMessages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length === 0,
      );
      expect(remainingMessages).toHaveLength(0);

      // Verify thread is gone
      const threads = await retryUntil(
        async () => await store.getThreadsByResourceId({ resourceId: thread.resourceId }),
        threads => threads.length === 0,
      );
      expect(threads).toHaveLength(0);

      // Verify message order is cleaned up
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === 0,
      );
      expect(order).toHaveLength(0);

      // Verify no orphaned data in any table
      const tablesToCheck: TABLE_NAMES[] = [TABLE_MESSAGES, TABLE_THREADS];
      for (const tableName of tablesToCheck) {
        const keys = await store.listNamespaceKeys(tableName, {
          limit: 1000,
          prefix: thread.id,
        });
        expect(keys).toHaveLength(0);
      }
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large metadata objects', async () => {
      const thread = createSampleThread();
      const largeMetadata = {
        ...thread.metadata,
        largeArray: Array.from({ length: 1000 }, (_, i) => ({
          index: i,
          data: 'test'.repeat(100),
        })),
      };

      const threadWithLargeMetadata = {
        ...thread,
        metadata: largeMetadata,
      };

      await store.saveThread({ thread: threadWithLargeMetadata });
      const retrieved = await retryUntil(
        async () => await store.getThreadById({ threadId: thread.id }),
        retrievedThread => retrievedThread?.id === thread.id,
      );

      expect(retrieved?.metadata).toEqual(largeMetadata);
    });

    it('should handle concurrent thread operations', async () => {
      const threads = Array.from({ length: 10 }, () => createSampleThread());

      // Save all threads concurrently
      await Promise.all(threads.map(thread => store.saveThread({ thread })));

      // Retrieve all threads concurrently
      const retrievedThreads = await Promise.all(threads.map(thread => store.getThreadById({ threadId: thread.id })));

      expect(retrievedThreads.length).toBe(threads.length);
      retrievedThreads.forEach((retrieved, i) => {
        expect(retrieved?.id).toBe(threads[i].id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle race conditions in getSortedOrder', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create messages with sequential timestamps
      const now = Date.now();
      const messages = Array.from({ length: 5 }, (_, i) =>
        createSampleMessageV2({ threadId: thread.id, createdAt: new Date(now + i * 1000) }),
      );

      // Save messages in parallel to create race condition
      await Promise.all(messages.map(msg => store.saveMessages({ messages: [msg], format: 'v2' })));

      // Verify both presence and order consistency
      const orderKey = store['getThreadMessagesKey'](thread.id);
      const order = await retryUntil(
        async () => {
          const currentOrder = await store['getFullOrder'](orderKey);
          // Check both length and content
          const hasAllMessages =
            currentOrder.length === messages.length && currentOrder.every(id => messages.some(m => m.id === id));
          if (!hasAllMessages) return null;

          // Verify messages are in timestamp order
          const orderedMessages = messages.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return currentOrder.join(',') === orderedMessages.map(m => m.id).join(',') ? currentOrder : null;
        },
        order => order !== null,
        10000,
      );

      // Final verification
      const orderedIds = messages
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(m => m.id);
      expect(order).toEqual(orderedIds);
    });

    it('should handle invalid message data', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Try to save invalid message
      const invalidMessage = {
        ...createSampleMessageV2({ threadId: thread.id }),
        content: undefined,
      };

      await expect(
        store.saveMessages({
          messages: [invalidMessage as any],
          format: 'v2',
        }),
      ).rejects.toThrow();
    });

    it('should handle missing thread gracefully', async () => {
      const message = createSampleMessageV2({ threadId: 'non-existent-thread' });
      await expect(
        store.saveMessages({
          messages: [message],
          format: 'v2',
        }),
      ).rejects.toThrow();
    });

    it('should handle malformed data gracefully', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Test with various malformed data
      const malformedMessage = createSampleMessageV2({ threadId: thread.id, content: ''.padStart(1024 * 1024, 'x') });

      await store.saveMessages({ messages: [malformedMessage], format: 'v2' });

      // Should still be able to retrieve and handle the message
      const messages = await retryUntil(
        async () => await store.getMessages({ threadId: thread.id, format: 'v2' }),
        messages => messages.length === 1,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(malformedMessage.id);
    });

    it('should handle concurrent updates to sorted order', async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });

      // Create initial messages
      const messages = Array.from({ length: 3 }, () => createSampleMessageV2({ threadId: thread.id }));
      await store.saveMessages({ messages, format: 'v2' });

      // Perform multiple concurrent updates
      const orderKey = store['getThreadMessagesKey'](thread.id);
      await Promise.all([
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: i })),
        ),
        store['updateSortedMessages'](
          orderKey,
          messages.map((msg, i) => ({ id: msg.id, score: messages.length - 1 - i })),
        ),
      ]);

      // Verify order is consistent
      const order = await retryUntil(
        async () => await store['getFullOrder'](orderKey),
        order => order.length === messages.length,
      );
      expect(order.length).toBe(messages.length);
      expect(new Set(order)).toEqual(new Set(messages.map(m => m.id)));
    });

    it('should handle invalid JSON data gracefully', async () => {
      await store['putNamespaceValue']({
        tableName: TABLE_THREADS,
        key: 'invalid-key',
        value: 'invalid-json',
        metadata: '',
      });

      const result = await store['getKV'](TABLE_THREADS, 'invalid-key');
      expect(result).toBe('invalid-json');
    });
  });

  describe('alterTable (no-op/schemaless)', () => {
    beforeEach(async () => {
      await clearTableExceptSchema(store, TABLE_MESSAGES);
    });

    afterEach(async () => {
      await clearTableExceptSchema(store, TABLE_MESSAGES);
    });

    it('allows inserting records with new fields without alterTable', async () => {
      await store.insert({
        tableName: TABLE_MESSAGES,
        record: { id: '1', name: 'Alice', threadId: '1' },
      });
      await store.insert({
        tableName: TABLE_MESSAGES,
        record: { id: '2', name: 'Bob', threadId: '1', newField: 123 },
      });

      const row = await store.load<{ id: string; name: string; newField?: number }>({
        tableName: TABLE_MESSAGES,
        keys: { id: '2', threadId: '1' },
      });
      expect(row?.newField).toBe(123);
    });

    it('does not throw when calling alterTable (no-op)', async () => {
      await expect(
        store.alterTable({
          tableName: TABLE_MESSAGES,
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
        tableName: TABLE_MESSAGES,
        record: { id: '3', name: 'Charlie', threadId: '1', age: 30, city: 'Paris' },
      });
      const row = await store.load<{ id: string; name: string; age?: number; city?: string }>({
        tableName: TABLE_MESSAGES,
        keys: { id: '3', threadId: '1' },
      });
      expect(row?.age).toBe(30);
      expect(row?.city).toBe('Paris');
    });

    it('can retrieve all fields, including dynamically added ones', async () => {
      await store.insert({
        tableName: TABLE_MESSAGES,
        record: { id: '4', name: 'Dana', threadId: '1', hobby: 'skiing' },
      });
      const row = await store.load<{ id: string; name: string; hobby?: string }>({
        tableName: TABLE_MESSAGES,
        keys: { id: '4', threadId: '1' },
      });
      expect(row?.hobby).toBe('skiing');
    });

    it('does not restrict or error on arbitrary new fields', async () => {
      await expect(
        store.insert({
          tableName: TABLE_MESSAGES,
          record: { id: '5', threadId: '1', weirdField: { nested: true }, another: [1, 2, 3] },
        }),
      ).resolves.not.toThrow();

      const row = await store.load<{ id: string; weirdField?: any; another?: any }>({
        tableName: TABLE_MESSAGES,
        keys: { id: '5', threadId: '1' },
      });
      expect(row?.weirdField).toEqual({ nested: true });
      expect(row?.another).toEqual([1, 2, 3]);
    });
  });
});
