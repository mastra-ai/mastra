import { randomUUID } from 'node:crypto';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { afterAll, describe, it, expect, beforeAll, beforeEach, onTestFinished } from 'vitest';

import { getResuableTests } from './reusable-tests';

// Helper function to extract text content from MastraDBMessage
function getTextContent(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content?.parts && Array.isArray(message.content.parts)) {
    return message.content.parts.map((p: any) => p.text || '').join('');
  }
  if (message.content?.text) {
    return message.content.text;
  }
  if (typeof message.content?.content === 'string') {
    return message.content.content;
  }
  return '';
}

const parseConnectionString = (url: string) => {
  const parsedUrl = new URL(url);
  return {
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port),
    user: parsedUrl.username,
    password: parsedUrl.password,
    database: parsedUrl.pathname.slice(1),
  };
};

/** Creates a Memory instance and registers onTestFinished to close its storage/vector pools. */
function createMemoryWithCleanup(opts: ConstructorParameters<typeof Memory>[0]): Memory {
  const mem = new Memory(opts);
  onTestFinished(async () => {
    await Promise.allSettled([
      (mem.storage as PostgresStore).close().catch(() => {}),
      mem.vector ? (mem.vector as PgVector).disconnect().catch(() => {}) : Promise.resolve(),
    ]);
  });
  return mem;
}

export function getPgStorageTests(connectionString: string) {
  const config = parseConnectionString(connectionString);

  // Limit pool size to avoid "too many clients" errors in tests
  const poolLimits = { max: 2, idleTimeoutMillis: 5000 } as const;

  // Track all PG pools created during tests so they can be closed before Docker teardown
  const allStorages: PostgresStore[] = [];
  const allVectors: PgVector[] = [];
  const storesToClose: PostgresStore[] = [];
  const vectorsToClose: PgVector[] = [];

  afterAll(async () => {
    // Close every PG pool we opened so the container can shut down cleanly
    await Promise.allSettled([
      ...allStorages.map(s => s.close().catch(() => {})),
      ...allVectors.map(v => v.disconnect().catch(() => {})),
    ]);
  });

  describe('PostgresStore stores initialization', () => {
    it('should have stores.memory available immediately after construction (without calling init)', async () => {
      // This test verifies that PostgresStore initializes its stores property
      // synchronously in the constructor, making stores.memory available immediately.
      // This is required for Memory to work correctly with PostgresStore.
      const storage = new PostgresStore({
        id: 'test-stores-init',
        ...config,
        ...poolLimits,
      });
      storesToClose.push(storage);

      // The stores.memory should be defined immediately after construction
      expect(storage.stores).toBeDefined();
      expect(storage.stores.memory).toBeDefined();
      expect(storage.stores.workflows).toBeDefined();
      expect(storage.stores.scores).toBeDefined();

      await storage.close();
    });
  });

  getResuableTests(() => {
    const storage = new PostgresStore({
      id: randomUUID(),
      ...config,
    });
    const vector = new PgVector({ connectionString, id: 'test-vector' });
    allStorages.push(storage);
    allVectors.push(vector);

    return {
      memory: new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          lastMessages: 10,
          semanticRecall: {
            topK: 3,
            messageRange: 2,
          },
          generateTitle: false,
        },
      }),
    };
  });

  const integrationStorage = new PostgresStore({ id: randomUUID(), ...config, ...poolLimits });
  const integrationVector = new PgVector({ connectionString, id: 'test-vector', ...poolLimits });
  storesToClose.push(integrationStorage);
  vectorsToClose.push(integrationVector);

  describe('Memory with PostgresStore Integration', () => {
    const integrationStorage = new PostgresStore({
      id: randomUUID(),
      ...config,
    });
    const integrationVector = new PgVector({ connectionString, id: 'test-vector' });
    allStorages.push(integrationStorage);
    allVectors.push(integrationVector);

    const memory = new Memory({
      storage: integrationStorage,
      vector: integrationVector,
      embedder: fastembed,
      options: {
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
        generateTitle: false,
      },
    });

    const resourceId = 'test-resource';

    // Clean up orphaned vector embeddings before tests
    beforeAll(async () => {
      const vector = memory.vector as PgVector;
      if (vector && vector.pool) {
        try {
          const client = await vector.pool.connect();
          try {
            // Delete all embeddings for the test resource from all vector tables
            const tablesResult = await client.query(`
              SELECT tablename 
              FROM pg_tables 
              WHERE schemaname = 'public' 
              AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
            `);

            for (const row of tablesResult.rows) {
              const tableName = row.tablename;
              // Clean up all test data - both 'test-resource' and any UUID-based resources
              await client.query(`
                DELETE FROM "public"."${tableName}" 
                WHERE metadata->>'resource_id' LIKE 'test-%' 
                   OR metadata->>'resource_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              `);
            }
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('Failed to clean up orphaned embeddings:', error);
        }
      }
    });

    describe('Thread Operations', () => {
      beforeEach(async () => {
        // Clean up threads before each test in this block
        try {
          const { threads } = await memory.listThreads({
            filter: { resourceId },
            page: 0,
            perPage: 100,
          });
          await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));
        } catch {
          // Ignore errors during cleanup
        }
      });
      it('should create and retrieve a thread', async () => {
        const threadId = randomUUID();
        const thread = await memory.createThread({
          threadId,
          resourceId,
          title: 'Test Thread',
        });

        expect(thread).toBeDefined();
        expect(thread.id).toBe(threadId);
        expect(thread.title).toBe('Test Thread');

        const retrievedThread = await memory.getThreadById({ threadId });
        expect(retrievedThread).toBeDefined();
        expect(retrievedThread?.id).toBe(threadId);
      });

      it('should list threads by resource id', async () => {
        // Create multiple threads
        await memory.createThread({
          threadId: randomUUID(),
          resourceId,
          title: 'Thread 1',
        });
        await memory.createThread({
          threadId: randomUUID(),
          resourceId,
          title: 'Thread 2',
        });

        const { threads, total } = await memory.listThreads({
          filter: { resourceId },
          page: 0,
          perPage: 10,
        });

        expect(threads.length).toBe(2);
        expect(total).toBe(2);
      });
    });

    describe('Message Operations', () => {
      let threadId: string;

      beforeEach(async () => {
        threadId = randomUUID();
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Message Test Thread',
        });
      });

      it('should save and recall messages', async () => {
        const messages = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Hello, how are you?' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'I am doing well, thank you!' }],
            },
            createdAt: new Date(Date.now() + 1000),
          },
        ];

        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId,
          resourceId,
          perPage: 10,
        });

        expect(result.messages.length).toBe(2);
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[1].role).toBe('assistant');
      });

      it('should respect lastMessages limit', async () => {
        // Create 15 messages
        const messages = Array.from({ length: 15 }, (_, i) => ({
          id: randomUUID(),
          threadId,
          resourceId,
          role: 'user' as const,
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: `Message ${i + 1}` }],
          },
          createdAt: new Date(Date.now() + i * 1000),
        }));

        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId,
          resourceId,
          perPage: 10,
        });

        // Should only get 10 messages (lastMessages limit)
        expect(result.messages.length).toBe(10);
      });
    });

    describe('Semantic Search', () => {
      let threadId: string;

      beforeEach(async () => {
        threadId = randomUUID();
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Semantic Test Thread',
        });
      });

      it('should find semantically similar messages', async () => {
        const messages = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'The weather is nice today' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Yes, it is sunny and warm' }],
            },
            createdAt: new Date(Date.now() + 1000),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'What is the capital of France?' }],
            },
            createdAt: new Date(Date.now() + 2000),
          },
        ];

        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId,
          resourceId,
          vectorSearchString: 'How is the temperature outside?',
          threadConfig: {
            lastMessages: 0,
            semanticRecall: { messageRange: 1, topK: 1 },
          },
        });

        // Should find weather-related messages
        expect(result.messages.length).toBeGreaterThan(0);
        const texts = result.messages.map(m => {
          const parts = (m.content as any)?.parts || [];
          const textPart = parts.find((p: any) => p.type === 'text');
          return textPart?.text || '';
        });
        expect(
          texts.some((t: string) => t.toLowerCase().includes('weather') || t.toLowerCase().includes('sunny')),
        ).toBe(true);
      });
    });

    describe('Pagination Bug #6787', () => {
      let threadId: string;

      beforeEach(async () => {
        // Clean up any existing threads
        const { threads } = await memory.listThreads({ filter: { resourceId }, page: 0, perPage: 10 });
        await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));

        // Create a fresh thread for testing
        const thread = await memory.saveThread({
          thread: {
            id: randomUUID(),
            title: 'Pagination Test Thread',
            resourceId,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        threadId = thread.id;
      });

      it('should respect pagination parameters when querying messages', async () => {
        // Create 10 test messages
        const messages = [];
        for (let i = 0; i < 10; i++) {
          messages.push({
            id: randomUUID(),
            threadId,
            resourceId,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i + 1}` }],
            },
            role: 'user' as const,
            createdAt: new Date(Date.now() + i * 1000), // Ensure different timestamps
          });
        }

        // Save all messages
        await memory.saveMessages({ messages: messages as any });

        // Test 1: Query with pagination - page 0, perPage 3
        console.info('Testing pagination: page 0, perPage 3');
        const result1 = await memory.recall({
          threadId,
          resourceId,
          page: 0,
          perPage: 3,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result1.messages, 'Page 0 with perPage 3 should return exactly 3 messages').toHaveLength(3);
        // Database orders by createdAt DESC (newest first), so page 0 gets the 3 newest messages
        // But MessageList sorts them chronologically (oldest to newest) for display
        expect(getTextContent(result1.messages[0])).toBe('Message 8');
        expect(getTextContent(result1.messages[1])).toBe('Message 9');
        expect(getTextContent(result1.messages[2])).toBe('Message 10');

        // Test 2: Query with pagination - page 1, perPage 3
        console.info('Testing pagination: page 1, perPage 3');
        const result2 = await memory.recall({
          threadId,
          resourceId,
          page: 1,
          perPage: 3,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result2.messages, 'Page 1 with perPage 3 should return exactly 3 messages').toHaveLength(3);
        expect(getTextContent(result2.messages[0])).toBe('Message 5');
        expect(getTextContent(result2.messages[1])).toBe('Message 6');
        expect(getTextContent(result2.messages[2])).toBe('Message 7');

        // Test 3: Query with pagination - page 0, perPage 1
        console.info('Testing pagination: page 0, perPage 1 (original bug report)');
        const result3 = await memory.recall({
          threadId,
          resourceId,
          page: 0,
          perPage: 1,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result3.messages, 'Page 0 with perPage 1 should return exactly 1 message').toHaveLength(1);
        expect(getTextContent(result3.messages[0])).toBe('Message 10');

        // Test 4: Query with pagination - page 9, perPage 1 (last page)
        console.info('Testing pagination: page 9, perPage 1 (last page)');
        const result4 = await memory.recall({
          threadId,
          resourceId,
          page: 9,
          perPage: 1,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result4.messages, 'Page 9 with perPage 1 should return exactly 1 message').toHaveLength(1);
        expect(getTextContent(result4.messages[0])).toBe('Message 1');

        // Test 5: Query with pagination - page 1, perPage 5 (partial last page)
        console.info('Testing pagination: page 1, perPage 5 (partial last page)');
        const result5 = await memory.recall({
          threadId,
          resourceId,
          page: 1,
          perPage: 5,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result5.messages, 'Page 1 with perPage 5 should return exactly 5 messages').toHaveLength(5);
        expect(getTextContent(result5.messages[0])).toBe('Message 1');
        expect(getTextContent(result5.messages[4])).toBe('Message 5');

        // Test 6: Query without pagination should still work
        console.info('Testing query without pagination (backward compatibility)');
        const result6 = await memory.recall({
          threadId,
          resourceId,
          perPage: 5,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result6.messages, 'Query with last: 5 should return exactly 5 messages').toHaveLength(5);
        // Should return the 5 most recent messages
        expect(getTextContent(result6.messages[0])).toBe('Message 6');
        expect(getTextContent(result6.messages[4])).toBe('Message 10');
      });

      it('should handle edge cases with pagination', async () => {
        // Create just 3 messages
        const messages = [];
        for (let i = 0; i < 3; i++) {
          messages.push({
            id: randomUUID(),
            threadId,
            resourceId,
            content: `Message ${i + 1}`,
            role: 'user' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() + i * 1000),
          });
        }
        await memory.saveMessages({ messages: messages as any });

        // Test: Page beyond available data
        console.info('Testing pagination beyond available data');
        const result1 = await memory.recall({
          threadId,
          resourceId,
          page: 5,
          perPage: 2,
        });

        expect(result1.messages, 'Page beyond available data should return empty array').toHaveLength(0);

        // Test: perPage larger than total messages
        console.info('Testing perPage larger than total messages');
        const result2 = await memory.recall({
          threadId,
          resourceId,
          page: 0,
          perPage: 10,
        });

        expect(result2.messages, 'perPage larger than total should return all 3 messages').toHaveLength(3);
      });
    });

    describe('PostgreSQL Vector Index Configuration', () => {
      it('should support HNSW index configuration', async () => {
        const hnswMemory = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            lastMessages: 5,
            semanticRecall: {
              topK: 3,
              messageRange: 2,
              indexConfig: {
                type: 'hnsw',
                metric: 'dotproduct',
                hnsw: {
                  m: 16,
                  efConstruction: 64,
                },
              },
            },
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        // Create thread first
        await hnswMemory.createThread({
          threadId,
          resourceId: testResourceId,
        });

        // Save a message to trigger index creation
        await hnswMemory.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'Test message for HNSW index' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Query to verify the index works
        const result = await hnswMemory.recall({
          threadId,
          resourceId: testResourceId,
          vectorSearchString: 'HNSW test',
        });

        expect(result.messages).toBeDefined();
      });

      it('should support IVFFlat index configuration with custom lists', async () => {
        const ivfflatMemory = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            lastMessages: 5,
            semanticRecall: {
              topK: 2,
              messageRange: 1,
              indexConfig: {
                type: 'ivfflat',
                metric: 'cosine',
                ivf: {
                  lists: 500,
                },
              },
            },
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        // Create thread first
        await ivfflatMemory.createThread({
          threadId,
          resourceId: testResourceId,
        });

        // Save a message to trigger index creation
        await ivfflatMemory.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'Test message for IVFFlat index' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Query to verify the index works
        const result = await ivfflatMemory.recall({
          threadId,
          resourceId: testResourceId,
          vectorSearchString: 'IVFFlat test',
        });

        expect(result.messages).toBeDefined();
      });

      it('should support flat (no index) configuration', async () => {
        const flatMemory = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            lastMessages: 5,
            semanticRecall: {
              topK: 2,
              messageRange: 1,
              indexConfig: {
                type: 'flat',
                metric: 'euclidean',
              },
            },
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        // Create thread first
        await flatMemory.createThread({
          threadId,
          resourceId: testResourceId,
        });

        // Save a message to trigger index creation
        await flatMemory.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'Test message for flat scan' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Query to verify the index works
        const result = await flatMemory.recall({
          threadId,
          resourceId: testResourceId,
          vectorSearchString: 'flat scan test',
        });

        expect(result.messages).toBeDefined();
      });

      it('should handle index configuration changes', async () => {
        // Start with IVFFlat
        const memory1 = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            semanticRecall: {
              topK: 3,
              messageRange: 2,
              indexConfig: {
                type: 'ivfflat',
                metric: 'cosine',
              },
            },
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        await memory1.createThread({ threadId, resourceId: testResourceId });
        await memory1.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'First configuration' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Now switch to HNSW - should trigger index recreation
        const memory2 = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            semanticRecall: {
              topK: 3,
              messageRange: 2,
              indexConfig: {
                type: 'hnsw',
                metric: 'dotproduct',
                hnsw: { m: 16, efConstruction: 64 },
              },
            },
          },
        });

        await memory2.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'Second configuration with HNSW' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Query should work with new index
        const result = await memory2.recall({
          threadId,
          resourceId: testResourceId,
        });
        expect(result.messages).toBeDefined();
      });

      it('should preserve existing index when no config provided', async () => {
        // First, create with HNSW
        const memory1 = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            semanticRecall: {
              topK: 3,
              messageRange: 2,
              indexConfig: {
                type: 'hnsw',
                metric: 'dotproduct',
                hnsw: { m: 16, efConstruction: 64 },
              },
            },
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        await memory1.createThread({ threadId, resourceId: testResourceId });
        await memory1.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'HNSW index created' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Create another memory instance without index config - should preserve HNSW
        const memory2 = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          vector: new PgVector({ connectionString, id: 'test-vector' }),
          embedder: fastembed,
          options: {
            semanticRecall: {
              topK: 3,
              messageRange: 2,
              // No indexConfig - should preserve existing HNSW
            },
          },
        });

        await memory2.saveMessages({
          messages: [
            {
              id: randomUUID(),
              content: 'Should still use HNSW index' as any,
              role: 'user',
              createdAt: new Date(),
              threadId,
              resourceId: testResourceId,
              type: 'text',
            },
          ],
        });

        // Query should work with preserved HNSW index
        const result = await memory2.recall({
          threadId,
          resourceId: testResourceId,
        });
        expect(result.messages).toBeDefined();
      });
    });

    describe('lastMessages should return newest messages, not oldest', () => {
      it('should return the LAST N messages when using lastMessages config without explicit orderBy', async () => {
        // This test exposes a critical bug where recall() with lastMessages config
        // returns the OLDEST messages instead of the NEWEST messages.
        //
        // The bug: When you set lastMessages: 3 and have 10 messages in a thread,
        // you expect to get messages 8, 9, 10 (the last 3).
        // Instead, the buggy behavior returns messages 1, 2, 3 (the first 3).
        //
        // This breaks conversation history for any thread that exceeds lastMessages.

        const memoryWithLimit = createMemoryWithCleanup({
          storage: new PostgresStore({ ...config, id: randomUUID() }),
          options: {
            lastMessages: 3, // Limit to 3 messages
          },
        });

        const threadId = randomUUID();
        const testResourceId = randomUUID();

        // Create thread
        await memoryWithLimit.createThread({
          threadId,
          resourceId: testResourceId,
        });

        // Create 10 messages with sequential timestamps
        // Message 1 is oldest, Message 10 is newest
        const messages = [];
        const baseTime = Date.now();
        for (let i = 1; i <= 10; i++) {
          messages.push({
            id: randomUUID(),
            threadId,
            resourceId: testResourceId,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: `Message ${i}` }],
            },
            role: 'user' as const,
            createdAt: new Date(baseTime + i * 1000), // Each message 1 second apart
          });
        }

        await memoryWithLimit.saveMessages({ messages: messages as any });

        // Call recall WITHOUT explicit orderBy - this is the typical usage pattern
        // The config says lastMessages: 3, so we expect the LAST 3 messages
        const result = await memoryWithLimit.recall({
          threadId,
          resourceId: testResourceId,
          // NO orderBy - this is the bug trigger
        });

        expect(result.messages).toHaveLength(3);

        // Extract text content for comparison
        const contents = result.messages.map(m => {
          if (typeof m.content === 'string') return m.content;
          if (m.content?.parts?.[0] && 'text' in m.content.parts[0]) return (m.content.parts[0] as any).text;
          if (m.content?.content) return m.content.content;
          return '';
        });

        // The CORRECT behavior: should return the NEWEST 3 messages (8, 9, 10)
        // in chronological order (oldest to newest within the window)
        expect(contents).toContain('Message 8');
        expect(contents).toContain('Message 9');
        expect(contents).toContain('Message 10');

        // Should NOT contain old messages
        expect(contents).not.toContain('Message 1');
        expect(contents).not.toContain('Message 2');
        expect(contents).not.toContain('Message 3');

        // Verify chronological order (oldest first within the returned window)
        expect(contents[0]).toBe('Message 8');
        expect(contents[1]).toBe('Message 9');
        expect(contents[2]).toBe('Message 10');
      });
    });
  });
}
