import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import type { Memory } from '@mastra/memory';
import type { TextPart, ImagePart, FilePart, ToolCallPart } from 'ai';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const resourceId = 'resource';
// Test helpers
const createTestThread = (title: string, metadata = {}) => ({
  id: randomUUID(),
  title,
  resourceId,
  metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
});

let messageCounter = 0;
const createTestMessage = (
  threadId: string,
  content: string | (TextPart | ImagePart | FilePart)[] | (TextPart | ToolCallPart)[],
  role: 'user' | 'assistant' = 'user',
  type: 'text' | 'tool-call' | 'tool-result' = 'text',
) => {
  messageCounter++;
  return {
    id: randomUUID(),
    threadId,
    content,
    role,
    type,
    createdAt: new Date(Date.now() + messageCounter * 1000), // Add 1 second per message to prevent messages having the same timestamp
    resourceId,
  };
};

export function getPerformanceTests(memory: Memory) {
  beforeEach(async () => {
    // Reset message counter
    messageCounter = 0;
    // Clean up before each test
    const threads = await memory.getThreadsByResourceId({ resourceId });
    await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));
  });

  afterAll(async () => {
    // Final cleanup
    const threads = await memory.getThreadsByResourceId({ resourceId });
    await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));
  });

  describe('Query Performance', () => {
    it('should measure vector query performance with thread filtering', async () => {
      // Create multiple threads with messages
      const threadCount = 10; // Reduced from 30 to focus on per-thread scaling
      const messagesPerThread = 250; // Increased from 50 to better test vector similarity search
      const batchSize = 50; // Increased batch size for more efficient insertion
      const threads = [];

      console.time('Data setup');

      // Create all threads first
      for (let i = 0; i < threadCount; i++) {
        const thread = await memory.saveThread({
          thread: createTestThread(`Performance Test Thread ${i}`),
        });
        threads.push(thread);

        if ((i + 1) % 10 === 0) {
          console.log(`Created ${i + 1}/${threadCount} threads...`);
        }
      }

      // Now create messages in batches for each thread
      for (let i = 0; i < threadCount; i++) {
        const thread = threads[i];
        const allMessages = Array.from({ length: messagesPerThread }, () => {
          // Generate a realistic conversation about various topics
          const topic = faker.helpers.arrayElement([
            'machine learning',
            'system architecture',
            'database optimization',
            'user experience',
            'cloud infrastructure',
          ]);

          const content = [
            faker.lorem.paragraph(3), // Main discussion
            faker.lorem.sentence(10), // Technical details
            `Regarding ${topic}, `,
            faker.lorem.paragraph(2), // Context
            faker.lorem.sentences(3), // Additional thoughts
            faker.helpers.arrayElement([
              'What are your thoughts on this approach?',
              'How would you implement this?',
              'Have you encountered similar issues?',
              'What alternatives should we consider?',
            ]),
          ].join('\n\n');

          return createTestMessage(thread.id, content);
        });

        // Process messages in batches
        for (let j = 0; j < allMessages.length; j += batchSize) {
          const batch = allMessages.slice(j, j + batchSize);
          await memory.saveMessages({ messages: batch });
        }

        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${threadCount} threads (${(i + 1) * messagesPerThread} total messages)...`);
        }
      }

      console.timeEnd('Data setup');
      console.log(`Total messages created: ${threadCount * messagesPerThread}`);

      // Measure query time for each thread with different search patterns
      const searchQueries = [
        'performance optimization techniques',
        'user experience and interface design',
        'database architecture and scaling',
        'testing methodologies and practices',
        'system design patterns',
      ];

      const queryStats: Record<string, number[]> = {};

      console.log('\nRunning queries...');
      for (const searchQuery of searchQueries) {
        queryStats[searchQuery] = [];
        console.time(`Query: ${searchQuery}`);

        for (const thread of threads) {
          const start = performance.now();
          await memory.rememberMessages({
            threadId: thread.id,
            vectorMessageSearch: searchQuery,
            config: {
              semanticRecall: {
                topK: 50,
                messageRange: { before: 5, after: 5 },
              },
            },
          });
          const end = performance.now();
          queryStats[searchQuery].push(end - start);
        }

        console.timeEnd(`Query: ${searchQuery}`);
      }

      // Calculate and log detailed statistics
      const stats = Object.entries(queryStats).map(([query, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        const min = Math.min(...times);
        const sorted = [...times].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        return {
          query,
          averageMs: avg.toFixed(2),
          maxMs: max.toFixed(2),
          minMs: min.toFixed(2),
          p95Ms: p95.toFixed(2),
          p99Ms: p99.toFixed(2),
        };
      });

      console.log('\nVector Query Performance by Search Pattern:');
      console.table(stats);

      console.log('\nTest Configuration:', {
        totalThreads: threadCount,
        messagesPerThread,
        totalMessages: threadCount * messagesPerThread,
        uniqueSearchPatterns: searchQueries.length,
        queriesPerPattern: threadCount,
        totalQueries: threadCount * searchQueries.length,
      });

      // Validate performance expectations
      // Using p95 as it's more stable than max for detecting real issues
      const maxP95 = Math.max(...stats.map(s => parseFloat(s.p95Ms)));
      expect(maxP95).toBeLessThan(10000); // p95 should be under 10 seconds
    });
  }, 600000);
}
