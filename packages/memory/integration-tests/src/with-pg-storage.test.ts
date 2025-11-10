import { randomUUID } from 'crypto';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import dotenv from 'dotenv';
import { describe, it, expect, beforeEach } from 'vitest';

import { getResuableTests } from './reusable-tests';

dotenv.config({ path: '.env.test' });

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
    id: randomUUID(),
  };
};

describe('Memory with PostgresStore Integration', () => {
  const config = parseConnectionString(connectionString);
  const memory = new Memory({
    storage: new PostgresStore(config),
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

  getResuableTests(memory);

  describe('Pagination Bug #6787', () => {
    const resourceId = 'test-resource';
    let threadId: string;

    beforeEach(async () => {
      // Clean up any existing threads
      const { threads } = await memory.listThreadsByResourceId({ resourceId, page: 0, perPage: 10 });
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
            format: 2,
            parts: [{ type: 'text', text: `Message ${i + 1}` }],
          },
          role: 'user' as const,
          createdAt: new Date(Date.now() + i * 1000), // Ensure different timestamps
        });
      }

      // Save all messages
      await memory.saveMessages({ messages });

      // Test 1: Query with pagination - page 0, perPage 3
      console.log('Testing pagination: page 0, perPage 3');
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
      console.log('Testing pagination: page 1, perPage 3');
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
      console.log('Testing pagination: page 0, perPage 1 (original bug report)');
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
      console.log('Testing pagination: page 9, perPage 1 (last page)');
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
      console.log('Testing pagination: page 1, perPage 5 (partial last page)');
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
      console.log('Testing query without pagination (backward compatibility)');
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
      await memory.saveMessages({ messages });

      // Test: Page beyond available data
      console.log('Testing pagination beyond available data');
      const result1 = await memory.recall({
        threadId,
        resourceId,
        page: 5,
        perPage: 2,
      });

      expect(result1.messages, 'Page beyond available data should return empty array').toHaveLength(0);

      // Test: perPage larger than total messages
      console.log('Testing perPage larger than total messages');
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
      const hnswMemory = new Memory({
        storage: new PostgresStore(config),
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
      const resourceId = randomUUID();

      // Create thread first
      await hnswMemory.createThread({
        threadId,
        resourceId,
      });

      // Save a message to trigger index creation
      await hnswMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'Test message for HNSW index',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Query to verify the index works
      const result = await hnswMemory.recall({
        threadId,
        resourceId,
        vectorSearchString: 'HNSW test',
      });

      expect(result.messages).toBeDefined();
    });

    it('should support IVFFlat index configuration with custom lists', async () => {
      const ivfflatMemory = new Memory({
        storage: new PostgresStore(config),
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
      const resourceId = randomUUID();

      // Create thread first
      await ivfflatMemory.createThread({
        threadId,
        resourceId,
      });

      // Save a message to trigger index creation
      await ivfflatMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'Test message for IVFFlat index',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Query to verify the index works
      const result = await ivfflatMemory.recall({
        threadId,
        resourceId,
        vectorSearchString: 'IVFFlat test',
      });

      expect(result.messages).toBeDefined();
    });

    it('should support flat (no index) configuration', async () => {
      const flatMemory = new Memory({
        storage: new PostgresStore(config),
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
      const resourceId = randomUUID();

      // Create thread first
      await flatMemory.createThread({
        threadId,
        resourceId,
      });

      // Save a message to trigger index creation
      await flatMemory.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'Test message for flat scan',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Query to verify the index works
      const result = await flatMemory.recall({
        threadId,
        resourceId,
        vectorSearchString: 'flat scan test',
      });

      expect(result.messages).toBeDefined();
    });

    it('should handle index configuration changes', async () => {
      // Start with IVFFlat
      const memory1 = new Memory({
        storage: new PostgresStore(config),
        vector: new PgVector({ connectionString, id: 'test-vector' }),
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 3,
            indexConfig: {
              type: 'ivfflat',
              metric: 'cosine',
            },
          },
        },
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();

      await memory1.createThread({ threadId, resourceId });
      await memory1.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'First configuration',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Now switch to HNSW - should trigger index recreation
      const memory2 = new Memory({
        storage: new PostgresStore(config),
        vector: new PgVector({ connectionString, id: 'test-vector' }),
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 3,
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
            content: 'Second configuration with HNSW',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Query should work with new index
      const result = await memory2.recall({
        threadId,
        resourceId,
      });
      expect(result.messages).toBeDefined();
    });

    it('should preserve existing index when no config provided', async () => {
      // First, create with HNSW
      const memory1 = new Memory({
        storage: new PostgresStore(config),
        vector: new PgVector({ connectionString, id: 'test-vector' }),
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 3,
            indexConfig: {
              type: 'hnsw',
              metric: 'dotproduct',
              hnsw: { m: 16, efConstruction: 64 },
            },
          },
        },
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();

      await memory1.createThread({ threadId, resourceId });
      await memory1.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'HNSW index created',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Create another memory instance without index config - should preserve HNSW
      const memory2 = new Memory({
        storage: new PostgresStore(config),
        vector: new PgVector({ connectionString, id: 'test-vector' }),
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 3,
            // No indexConfig - should preserve existing HNSW
          },
        },
      });

      await memory2.saveMessages({
        messages: [
          {
            id: randomUUID(),
            content: 'Should still use HNSW index',
            role: 'user',
            createdAt: new Date(),
            threadId,
            resourceId,
            type: 'text',
          },
        ],
      });

      // Query should work with preserved HNSW index
      const result = await memory2.recall({
        threadId,
        resourceId,
      });
      expect(result.messages).toBeDefined();
    });
  });
});
