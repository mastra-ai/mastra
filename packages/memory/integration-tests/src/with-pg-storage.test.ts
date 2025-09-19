import { randomUUID } from 'crypto';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import dotenv from 'dotenv';
import { describe, it, expect, beforeEach } from 'vitest';

import { getResuableTests } from './reusable-tests';

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

describe('Memory with PostgresStore Integration', () => {
  const config = parseConnectionString(connectionString);
  const memory = new Memory({
    storage: new PostgresStore(config),
    vector: new PgVector({ connectionString }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
      },
      threads: {
        generateTitle: false,
      },
    },
  });

  getResuableTests(memory);

  describe('Pagination Bug #6787', () => {
    const resourceId = 'test-resource';
    let threadId: string;

    beforeEach(async () => {
      // Clean up any existing threads
      const threads = await memory.getThreadsByResourceId({ resourceId });
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
          content: `Message ${i + 1}`,
          role: 'user' as const,
          type: 'text' as const,
          createdAt: new Date(Date.now() + i * 1000), // Ensure different timestamps
        });
      }

      // Save all messages
      await memory.saveMessages({ messages });

      // Test 1: Query with pagination - page 0, perPage 3
      console.log('Testing pagination: page 0, perPage 3');
      const result1 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 0,
            perPage: 3,
          },
        },
      });

      expect(result1.messages, 'Page 0 with perPage 3 should return exactly 3 messages').toHaveLength(3);
      // Database orders by createdAt DESC (newest first), so page 0 gets the 3 newest messages
      // But MessageList sorts them chronologically (oldest to newest) for display
      expect(result1.messages[0].content).toBe('Message 8');
      expect(result1.messages[1].content).toBe('Message 9');
      expect(result1.messages[2].content).toBe('Message 10');

      // Test 2: Query with pagination - page 1, perPage 3
      console.log('Testing pagination: page 1, perPage 3');
      const result2 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 1,
            perPage: 3,
          },
        },
      });

      expect(result2.messages, 'Page 1 with perPage 3 should return exactly 3 messages').toHaveLength(3);
      expect(result2.messages[0].content).toBe('Message 5');
      expect(result2.messages[1].content).toBe('Message 6');
      expect(result2.messages[2].content).toBe('Message 7');

      // Test 3: Query with pagination - page 0, perPage 1
      console.log('Testing pagination: page 0, perPage 1 (original bug report)');
      const result3 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 0,
            perPage: 1,
          },
        },
      });

      expect(result3.messages, 'Page 0 with perPage 1 should return exactly 1 message').toHaveLength(1);
      expect(result3.messages[0].content).toBe('Message 10');

      // Test 4: Query with pagination - page 9, perPage 1 (last page)
      console.log('Testing pagination: page 9, perPage 1 (last page)');
      const result4 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 9,
            perPage: 1,
          },
        },
      });

      expect(result4.messages, 'Page 9 with perPage 1 should return exactly 1 message').toHaveLength(1);
      expect(result4.messages[0].content).toBe('Message 1');

      // Test 5: Query with pagination - page 1, perPage 5 (partial last page)
      console.log('Testing pagination: page 1, perPage 5 (partial last page)');
      const result5 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 1,
            perPage: 5,
          },
        },
      });

      expect(result5.messages, 'Page 1 with perPage 5 should return exactly 5 messages').toHaveLength(5);
      expect(result5.messages[0].content).toBe('Message 1');
      expect(result5.messages[4].content).toBe('Message 5');

      // Test 6: Query without pagination should still work
      console.log('Testing query without pagination (backward compatibility)');
      const result6 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          last: 5,
        },
      });

      expect(result6.messages, 'Query with last: 5 should return exactly 5 messages').toHaveLength(5);
      // Should return the 5 most recent messages
      expect(result6.messages[0].content).toBe('Message 6');
      expect(result6.messages[4].content).toBe('Message 10');
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
      const result1 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 5,
            perPage: 2,
          },
        },
      });

      expect(result1.messages, 'Page beyond available data should return empty array').toHaveLength(0);

      // Test: perPage larger than total messages
      console.log('Testing perPage larger than total messages');
      const result2 = await memory.query({
        threadId,
        resourceId,
        selectBy: {
          pagination: {
            page: 0,
            perPage: 10,
          },
        },
      });

      expect(result2.messages, 'perPage larger than total should return all 3 messages').toHaveLength(3);
    });
  });
});
