import { randomUUID } from 'node:crypto';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

dotenv.config({ path: '.env.test' });

// Ensure environment variables are set
if (!process.env.DB_URL) {
  console.warn('DB_URL not set, using default local PostgreSQL connection');
}

const connectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';

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

describe('PostgresStore stores initialization', () => {
  it('should have stores.memory available immediately after construction (without calling init)', () => {
    // This test verifies that PostgresStore initializes its stores property
    // synchronously in the constructor, making stores.memory available immediately.
    // This is required for Memory to work correctly with PostgresStore.
    const config = parseConnectionString(connectionString);
    const storage = new PostgresStore({
      id: 'test-stores-init',
      ...config,
    });

    // The stores.memory should be defined immediately after construction
    // Currently this fails because PostgresStore sets stores = {} in constructor
    // and only populates it in the async init() method
    expect(storage.stores).toBeDefined();
    expect(storage.stores.memory).toBeDefined();
    expect(storage.stores.workflows).toBeDefined();
    expect(storage.stores.scores).toBeDefined();
  });
});

describe('Memory with PostgresStore Integration', () => {
  const config = parseConnectionString(connectionString);
  const resourceId = 'test-resource';

  const memory = new Memory({
    storage: new PostgresStore({
      id: 'test-pg-storage',
      ...config,
    }),
    vector: new PgVector({ connectionString, id: 'test-vector' }),
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

  // Clean up orphaned vector embeddings before tests
  beforeAll(async () => {
    const vector = memory.vector as PgVector;
    if (vector && vector.pool) {
      try {
        const client = await vector.pool.connect();
        try {
          const tablesResult = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND (tablename = 'memory_messages' OR tablename LIKE 'memory_messages_%')
          `);

          for (const row of tablesResult.rows) {
            const tableName = row.tablename;
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

  beforeEach(async () => {
    // Clean up threads before each test
    try {
      const { threads } = await memory.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 100,
      });
      await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('Thread Operations', () => {
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

      const { threads, total } = await memory.listThreadsByResourceId({
        resourceId,
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
      expect(texts.some((t: string) => t.toLowerCase().includes('weather') || t.toLowerCase().includes('sunny'))).toBe(
        true,
      );
    });
  });
});
