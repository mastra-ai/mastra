import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { SharedMemoryConfig } from '@mastra/core/memory';
import type { LibSQLConfig, LibSQLVectorConfig } from '@mastra/libsql';
import type { Memory } from '@mastra/memory';
import type { PostgresStoreConfig } from '@mastra/pg';
import type { UpstashConfig } from '@mastra/upstash';
import type { ToolResultPart, TextPart, ToolCallPart } from 'ai';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const resourceId = 'resource';
const NUMBER_OF_WORKERS = 2;

export enum StorageType {
  LibSQL = 'libsql',
  Postgres = 'pg',
  Upstash = 'upstash',
}

interface WorkerTestConfig {
  storageTypeForWorker: StorageType;
  storageConfigForWorker: (LibSQLConfig | PostgresStoreConfig | UpstashConfig) & { id: string };
  vectorConfigForWorker?: LibSQLVectorConfig & { id: string };
  memoryOptionsForWorker?: SharedMemoryConfig['options'];
}

const createTestThread = (title: string, metadata = {}, i = 0) => {
  const now = Date.now();
  return {
    id: randomUUID(),
    title,
    resourceId,
    metadata,
    createdAt: new Date(now + i),
    updatedAt: new Date(now + i),
  };
};

let messageCounter = 0;
const createTestMessage = (
  threadId: string,
  content: string | TextPart[] | ToolCallPart[] | ToolResultPart[],
  role: 'user' | 'assistant' | 'tool' = 'user',
  type: 'text' | 'tool-call' | 'tool-result' = 'text',
): MastraDBMessage => {
  messageCounter++;

  // Convert content to MastraDBMessage format
  let parts: (TextPart | ToolCallPart | ToolResultPart)[];
  if (typeof content === 'string') {
    parts = [{ type: 'text', text: content }];
  } else {
    parts = content;
  }

  return {
    id: randomUUID(),
    threadId,
    content: {
      format: 2,
      parts,
    },
    role,
    type: type === 'text' ? undefined : type,
    createdAt: new Date(Date.now() + messageCounter * 1000), // Add 1 second per message to prevent messages having the same timestamp
    resourceId,
  };
};

// Helper to extract text content from MastraDBMessage
const getTextContent = (message: any): string => {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content?.parts && Array.isArray(message.content.parts)) {
    // Concatenate all text parts
    const textParts = message.content.parts.filter((p: any) => p.type === 'text' && p.text).map((p: any) => p.text);
    if (textParts.length > 0) {
      return textParts.join(' ');
    }
  }
  // Fallback: check if content has a direct text property
  if (message.content?.text) {
    return message.content.text;
  }
  // Fallback: check if content.content exists (nested structure)
  if (message.content?.content && typeof message.content.content === 'string') {
    return message.content.content;
  }
  console.error('Unable to extract text from message:', JSON.stringify(message, null, 2));
  return '';
};

export function getResuableTests(optionsFactory: () => { memory: Memory; workerTestConfig?: WorkerTestConfig }) {
  const cleanupAllThreads = async (memory: Memory) => {
    let allThreads: any[] = [];
    let page = 0;
    const perPage = 100;
    while (true) {
      const { threads, hasMore } = await memory.listThreads({
        filter: { resourceId },
        page,
        perPage,
      });
      allThreads.push(...threads);
      if (!hasMore || threads.length === 0) break;
      page++;
    }
    await Promise.all(allThreads.map(thread => memory.deleteThread(thread.id)));

    const indexes = await memory.vector?.listIndexes();
    if (indexes) {
      await Promise.all(
        indexes.map(index =>
          memory.vector?.deleteVectors({
            indexName: index,
            filter: { thread_id: { $in: allThreads.map(thread => thread.id) } },
          }),
        ),
      );
    }
  };

  let memory: Memory;
  let workerTestConfig: WorkerTestConfig | undefined;
  beforeEach(async () => {
    messageCounter = 0;
    await cleanupAllThreads(memory);
  });

  beforeAll(() => {
    const options = optionsFactory();
    memory = options.memory;
    workerTestConfig = options.workerTestConfig;
  });

  afterAll(async () => {
    await cleanupAllThreads(memory);
  });

  describe('Memory Features', () => {
    let thread: any;

    beforeEach(async () => {
      thread = await memory.saveThread({
        thread: createTestThread('Memory Test Thread'),
      });
    });

    describe('Message History', () => {
      it('should respect lastMessages limit in query', async () => {
        // Create more messages than the limit
        const messages = Array.from({ length: 15 }, (_, i) => createTestMessage(thread.id, `Message ${i + 1}`));
        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });
        expect(result.messages).toHaveLength(10); // lastMessages is set to 10
        expect(getTextContent(result.messages[0])).toBe('Message 6'); // First message
        expect(getTextContent(result.messages[9])).toBe('Message 15'); // Last message

        const result2 = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 15,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });
        expect(result2.messages).toHaveLength(15); // lastMessages is set to 10
        expect(getTextContent(result2.messages[0])).toBe('Message 1'); // First message
        expect(getTextContent(result2.messages[14])).toBe('Message 15'); // Last message
      });

      it('should maintain conversation context', async () => {
        const conversation = [
          createTestMessage(thread.id, 'What is your name?', 'user'),
          createTestMessage(thread.id, 'I am an AI assistant', 'assistant'),
          createTestMessage(thread.id, 'Can you remember that?', 'user'),
          createTestMessage(thread.id, 'Yes, I am an AI assistant', 'assistant'),
        ];

        await memory.saveMessages({ messages: conversation });
        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
        });

        // Verify conversation flow is maintained
        expect(result.messages).toHaveLength(4);
        expect(result.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      });
    });

    describe('Semantic Search', () => {
      it('should chunk long messages before embedding', async () => {
        const thread = await memory.createThread({
          resourceId,
          title: 'Long chunking test',
        });
        const threadId = thread.id;

        const content = Array(1000).fill(`This is a long message to test chunking with`).join(`
  `);
        await expect(
          memory.saveMessages({
            messages: [
              {
                type: 'text',
                role: 'user',
                content,
                threadId,
                id: `long-chunking-message-${Date.now()}`,
                createdAt: new Date(),
                resourceId,
              },
            ],
          }),
        ).resolves.not.toThrow();

        const { messages } = await memory.recall({
          threadId,
          resourceId,
          vectorSearchString: content,
          threadConfig: {
            semanticRecall: {
              topK: 2,
              messageRange: 2,
            },
          },
        });

        expect(messages.length).toBe(1);
      });

      it('should find semantically similar messages', async () => {
        const messages = [
          createTestMessage(thread.id, 'The weather is nice today', 'user'),
          createTestMessage(thread.id, "Yes, it's sunny and warm", 'assistant'),
          createTestMessage(thread.id, "What's the capital of France?", 'user'),
          createTestMessage(thread.id, 'The capital of France is Paris', 'assistant'),
        ];

        await memory.saveMessages({ messages });

        // Search for weather-related messages
        const weatherQuery = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: "How's the temperature outside?",
          threadConfig: {
            lastMessages: 0,
            semanticRecall: { messageRange: 1, topK: 1 },
          },
        });

        // Should find the weather-related messages due to semantic similarity
        expect(weatherQuery.messages.length).toBe(2);
        expect(getTextContent(weatherQuery.messages[0])).toBe('The weather is nice today');
        expect(getTextContent(weatherQuery.messages[1])).toBe("Yes, it's sunny and warm");

        // Search for location-related messages
        const locationQuery = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'Tell me about cities in France',
          threadConfig: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 1, before: 0 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery.messages.length).toBe(2);
        expect(getTextContent(locationQuery.messages[0])).toBe("What's the capital of France?");
        expect(getTextContent(locationQuery.messages[1])).toBe('The capital of France is Paris');

        // Search for location-related messages
        const locationQuery2 = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'Tell me about cities in France',
          threadConfig: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 0, before: 1 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery2.messages.length).toBe(2);
        expect(getTextContent(locationQuery2.messages[0])).toBe("Yes, it's sunny and warm");
        expect(getTextContent(locationQuery2.messages[1])).toBe("What's the capital of France?");

        // Search for location-related messages
        const locationQuery3 = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'Tell me about cities in France',
          threadConfig: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 1, before: 1 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery3.messages.length).toBe(3);
        expect(getTextContent(locationQuery3.messages[0])).toBe("Yes, it's sunny and warm");
        expect(getTextContent(locationQuery3.messages[1])).toBe("What's the capital of France?");
        expect(getTextContent(locationQuery3.messages[2])).toBe('The capital of France is Paris');
      });

      it('should respect semantic search configuration', async () => {
        // Create messages with a specific pattern so we can verify the exact messages returned
        const messages = [
          createTestMessage(thread.id, 'First unrelated message'),
          createTestMessage(thread.id, 'Another unrelated message'),
          createTestMessage(thread.id, 'Message about topic X'), // This should be our match
          createTestMessage(thread.id, 'Yet another message'),
          createTestMessage(thread.id, 'One more message'),
          createTestMessage(thread.id, 'Message about topic Y'), // Another potential match, but should not be included since topK=1
          createTestMessage(thread.id, 'Final message'),
        ];
        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'topic X',
          threadConfig: {
            lastMessages: 0,
            semanticRecall: {
              topK: 1,
              messageRange: {
                before: 1,
                after: 1,
              },
            },
          },
        });

        // Should respect semantic search configuration
        // - topK: 1 (finds 1 most similar message)
        // - messageRange: { before: 1, after: 1 } (includes 1 message before and after)
        // Messages are returned in chronological order by createdAt
        expect(result.messages).toBeDefined();
        expect(result.messages.length).toBe(3); // Should still only get 3 messages even though there are 7 total

        // Should get exactly these 3 consecutive messages in chronological order
        expect(getTextContent(result.messages[0])).toBe('Another unrelated message');
        expect(getTextContent(result.messages[1])).toBe('Message about topic X');
        expect(getTextContent(result.messages[2])).toBe('Yet another message');

        // Messages should be in the order they were created
        expect(
          result.messages.every((m, i) => i === 0 || (m as any).createdAt >= (result.messages[i - 1] as any).createdAt),
        ).toBe(true);
      });
      it('should embed and recall both string and TextPart messages', async () => {
        // Plain string messages (semantically unrelated)
        const stringWeather = createTestMessage(thread.id, 'The weather is rainy and cold.', 'user', 'text');
        const stringTravel = createTestMessage(thread.id, 'I am planning a trip to Japan.', 'user', 'text');
        const stringSports = createTestMessage(thread.id, 'The football match was exciting.', 'user', 'text');

        // TextPart messages (semantically unrelated to above)
        const textPartProgramming = createTestMessage(
          thread.id,
          [{ type: 'text', text: 'JavaScript is a versatile language.' }],
          'user',
          'text',
        );
        const textPartFood = createTestMessage(
          thread.id,
          [{ type: 'text', text: 'Sushi is my favorite food.' }],
          'user',
          'text',
        );
        const textPartMusic = createTestMessage(
          thread.id,
          [{ type: 'text', text: 'Classical music is relaxing.' }],
          'user',
          'text',
        );

        await memory.saveMessages({
          messages: [stringWeather, stringTravel, stringSports, textPartProgramming, textPartFood, textPartMusic],
        });

        // Semantic search for a TextPart topic
        const resultProgramming = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'JavaScript',
          threadConfig: {
            lastMessages: 0,
            semanticRecall: { messageRange: 0, topK: 1 },
          },
        });

        const programmingContents = resultProgramming.messages.map(m => getTextContent(m));
        expect(programmingContents).toContain('JavaScript is a versatile language.');
        expect(programmingContents).not.toContain('The weather is rainy and cold.');

        // Semantic search for a string topic
        const resultWeather = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'rainy',
          threadConfig: {
            lastMessages: 0,
            semanticRecall: { messageRange: 0, topK: 1 },
          },
        });
        const weatherContents = resultWeather.messages.map(m => getTextContent(m));
        expect(weatherContents).toContain('The weather is rainy and cold.');
        expect(weatherContents).not.toContain('JavaScript is a versatile language.');
      });

      it('should embed and recall message with multiple TextParts concatenated', async () => {
        const multiTextParts = createTestMessage(
          thread.id,
          [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'world' },
            { type: 'text', text: 'again' },
          ],
          'user',
          'text',
        );
        await memory.saveMessages({ messages: [multiTextParts] });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'world',
          threadConfig: { lastMessages: 0, semanticRecall: { messageRange: 0, topK: 1, scope: 'thread' } },
        });
        const contents = result.messages.map(m => getTextContent(m));
        expect(contents[0]).toContain('world');
        expect(contents[0]).toContain('Hello');
        expect(contents[0]).toContain('again');
      });

      it('should embed and recall assistant message with TextPart array', async () => {
        const assistantTextParts = createTestMessage(
          thread.id,
          [
            { type: 'text', text: 'Assistant says hello.' },
            { type: 'text', text: 'This is a test.' },
          ],
          'assistant',
          'text',
        );
        await memory.saveMessages({ messages: [assistantTextParts] });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          vectorSearchString: 'assistant',
          threadConfig: { lastMessages: 0, semanticRecall: { messageRange: 0, topK: 1, scope: 'thread' } },
        });
        const contents = result.messages.map(m => getTextContent(m));
        expect(contents[0]).toContain('Assistant says hello.');
        expect(contents[0]).toContain('This is a test.');
      });

      it('should respect scope for semantic search', async () => {
        // Create two threads within the same resource
        const thread1 = await memory.saveThread({
          thread: createTestThread('Search Scope Test Thread 1'),
        });
        const thread2 = await memory.saveThread({
          thread: createTestThread('Search Scope Test Thread 2'),
        });

        // Add similar messages to both threads
        const messagesThread1 = [
          createTestMessage(thread1.id, 'The sky is blue today', 'user'),
          createTestMessage(thread1.id, 'Yes, very clear skies', 'assistant'),
        ];
        const messagesThread2 = [
          createTestMessage(thread2.id, 'Oceans are vast and blue', 'user'),
          createTestMessage(thread2.id, 'Indeed, the deep blue sea', 'assistant'),
        ];

        await memory.saveMessages({ messages: messagesThread1 });
        await memory.saveMessages({ messages: messagesThread2 });

        const searchQuery = 'Tell me about the color blue';

        // 1. Test thread scope (explicitly set)
        const threadScopeResult = await memory.recall({
          threadId: thread1.id,
          resourceId, // resourceId is defined globally in this file
          vectorSearchString: searchQuery,
          threadConfig: {
            lastMessages: 0,
            semanticRecall: {
              topK: 1,
              messageRange: 1,
              scope: 'thread', // Explicitly set (default is now 'resource')
            },
          },
        });

        // Should only find messages from thread1
        expect(threadScopeResult.messages).toHaveLength(2);
        expect(threadScopeResult.messages.map(m => m.threadId)).toEqual([thread1.id, thread1.id]);
        expect(getTextContent(threadScopeResult.messages[0])).toBe('The sky is blue today');
        expect(getTextContent(threadScopeResult.messages[1])).toBe('Yes, very clear skies');

        // 2. Test resource scope (explicitly set)
        const resourceScopeResult = await memory.recall({
          threadId: thread1.id, // Still need a threadId, but scope overrides
          resourceId,
          vectorSearchString: searchQuery,
          threadConfig: {
            lastMessages: 0,
            semanticRecall: {
              topK: 5, // Increase topK to potentially get both matches
              messageRange: 2,
              scope: 'resource',
            },
          },
        });

        // Should find messages from both thread1 and thread2 (ordered by similarity/creation)
        // We expect 4 messages: the matched message + range (1) from thread1, and matched message + range (1) from thread2
        expect(resourceScopeResult.messages).toHaveLength(4);
        // Verify messages from both threads are present
        expect(resourceScopeResult.messages.some(m => m.threadId === thread1.id)).toBe(true);
        expect(resourceScopeResult.messages.some(m => m.threadId === thread2.id)).toBe(true);
        // Check content to be reasonably sure we got the right ones (order might vary based on embedding similarity)
        const contents = resourceScopeResult.messages.map(m => getTextContent(m));
        expect(contents).toContain('The sky is blue today');
        expect(contents).toContain('Yes, very clear skies');
        expect(contents).toContain('Oceans are vast and blue');
        expect(contents).toContain('Indeed, the deep blue sea');

        // Ensure messages are still ordered chronologically overall
        expect(
          resourceScopeResult.messages.every(
            (m, i) => i === 0 || m.createdAt >= resourceScopeResult.messages[i - 1].createdAt,
          ),
        ).toBe(true);

        // 3. Test default scope (should be resource now)
        const defaultScopeResult = await memory.recall({
          threadId: thread1.id,
          resourceId,
          vectorSearchString: searchQuery,
          threadConfig: {
            lastMessages: 0,
            semanticRecall: {
              topK: 5,
              messageRange: 2,
              // No scope specified - should default to 'resource'
            },
          },
        });

        // Should behave like resource scope (find messages from both threads)
        expect(defaultScopeResult.messages).toHaveLength(4);
        expect(defaultScopeResult.messages.some(m => m.threadId === thread1.id)).toBe(true);
        expect(defaultScopeResult.messages.some(m => m.threadId === thread2.id)).toBe(true);
        const defaultContents = defaultScopeResult.messages.map(m => getTextContent(m));
        expect(defaultContents).toContain('The sky is blue today');
        expect(defaultContents).toContain('Yes, very clear skies');
        expect(defaultContents).toContain('Oceans are vast and blue');
        expect(defaultContents).toContain('Indeed, the deep blue sea');
      });
    });

    describe('Message Types and Roles', () => {
      it('should handle different message types', async () => {
        const userMessage = createTestMessage(thread.id, 'Hello', 'user', 'text');
        const assistantMessages = [
          createTestMessage(
            thread.id,
            [{ type: 'tool-call', toolCallId: '1', args: {}, toolName: 'ok' }],
            'assistant',
            'tool-call',
          ),
          createTestMessage(
            thread.id,
            [{ type: 'tool-result', toolName: 'ok', toolCallId: '1', result: 'great' }],
            'tool',
            'tool-result',
          ),
        ];

        const messageList = new MessageList();
        messageList.add(userMessage, 'user');
        messageList.add(assistantMessages, 'response');

        const messages = messageList.get.all.db();

        await memory.saveMessages({ messages });
        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
        });

        expect(result.messages).toHaveLength(3);
        expect(result.messages).toEqual([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({ role: 'assistant' }),
          expect.objectContaining({ role: 'tool' }),
        ]);
      });

      it('should handle user message with TextPart content', async () => {
        const userPart = { type: 'text', text: 'Hello' } as TextPart;
        const assistantPart = { type: 'text', text: 'Goodbye' } as TextPart;
        const messages = [
          createTestMessage(thread.id, [userPart], 'user', 'text'),
          createTestMessage(thread.id, [assistantPart], 'assistant', 'text'),
        ];
        await memory.saveMessages({ messages });
        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
        });
        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]).toMatchObject({
          role: 'user',
        });
        // Check content.parts structure for MastraDBMessage
        expect(result.messages[0].content.parts).toBeDefined();
        expect(result.messages[0].content.parts[0]).toMatchObject({
          type: 'text',
          text: 'Hello',
        });
        expect(result.messages[1]).toMatchObject({
          role: 'assistant',
        });
        expect(result.messages[1].content.parts).toBeDefined();
        expect(result.messages[1].content.parts[0]).toMatchObject({
          type: 'text',
          text: 'Goodbye',
        });
      });

      it('should handle complex message content', async () => {
        const complexMessage = [
          { type: 'text' as const, text: 'This is a complex message with multiple parts' },
          { type: 'text' as const, text: 'https://example.com/image.jpg' },
        ];

        await memory.saveMessages({
          messages: [createTestMessage(thread.id, complexMessage, 'assistant')],
        });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
        });
        expect(result.messages[0].content.parts).toEqual(complexMessage);
      });
    });

    describe('Message Deletion', () => {
      it('should delete a message successfully', async () => {
        const messages = [
          createTestMessage(thread.id, 'Message 1'),
          createTestMessage(thread.id, 'Message 2'),
          createTestMessage(thread.id, 'Message 3'),
        ];
        const savedMessages = await memory.saveMessages({ messages });
        const messageToDelete = savedMessages.messages[1];

        // Delete the middle message
        await memory.deleteMessages([messageToDelete.id]);

        // Verify message is deleted
        const remainingMessages = await memory.recall({
          threadId: thread.id,
          perPage: 10,
        });

        expect(remainingMessages.messages).toHaveLength(2);
        expect(remainingMessages.messages.map(m => getTextContent(m))).toEqual(['Message 1', 'Message 3']);
        expect(remainingMessages.messages.find(m => m.id === messageToDelete.id)).toBeUndefined();
      });

      it('should handle deleting non-existent message gracefully', async () => {
        const nonExistentId = randomUUID();

        // Should not throw when deleting non-existent message
        await expect(memory.deleteMessages([nonExistentId])).resolves.not.toThrow();
      });

      it('should update thread updatedAt timestamp after deletion', async () => {
        const message = createTestMessage(thread.id, 'Test message');
        await memory.saveMessages({ messages: [message] });

        const threadBefore = await memory.getThreadById({ threadId: thread.id });
        const updatedAtBefore = threadBefore?.updatedAt;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        await memory.deleteMessages([message.id]);

        const threadAfter = await memory.getThreadById({ threadId: thread.id });
        const updatedAtAfter = threadAfter?.updatedAt;

        expect(updatedAtAfter).toBeDefined();
        expect(updatedAtBefore).toBeDefined();
        expect(new Date(updatedAtAfter!).getTime()).toBeGreaterThan(new Date(updatedAtBefore!).getTime());
      });

      it('should handle deletion of messages with different content types', async () => {
        const textMessage = createTestMessage(thread.id, 'Simple text');
        const complexMessage = createTestMessage(
          thread.id,
          [
            { type: 'text', text: 'Complex content' },
            { type: 'text', text: 'More content' },
          ],
          'assistant',
        );

        const savedMessages = await memory.saveMessages({ messages: [textMessage, complexMessage] });

        // Delete the complex message
        await memory.deleteMessages([savedMessages.messages[1].id]);

        const remainingMessages = await memory.recall({
          threadId: thread.id,
          perPage: 10,
        });

        expect(remainingMessages.messages).toHaveLength(1);
        expect(getTextContent(remainingMessages.messages[0])).toBe('Simple text');
      });

      it('should not affect other threads when deleting a message', async () => {
        // Create another thread
        const otherThread = await memory.saveThread({
          thread: createTestThread('Other Thread'),
        });

        // Add messages to both threads
        const message1 = createTestMessage(thread.id, 'Thread 1 message');
        const message2 = createTestMessage(otherThread.id, 'Thread 2 message');

        await memory.saveMessages({ messages: [message1, message2] });

        // Delete message from first thread
        await memory.deleteMessages([message1.id]);

        // Verify first thread has no messages
        const thread1Messages = await memory.recall({
          threadId: thread.id,
          perPage: 10,
        });
        expect(thread1Messages.messages).toHaveLength(0);

        // Verify second thread still has its message
        const thread2Messages = await memory.recall({
          threadId: otherThread.id,
          perPage: 10,
        });
        expect(thread2Messages.messages).toHaveLength(1);
        expect(getTextContent(thread2Messages.messages[0])).toBe('Thread 2 message');
      });

      it('should throw error when messageId is not provided', async () => {
        await expect(memory.deleteMessages([''])).rejects.toThrow('All message IDs must be non-empty strings');
      });
    });

    describe('Resource Validation', () => {
      it('should allow access with correct resourceId', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 10,
        });

        expect(result.messages).toHaveLength(1);
        const textContent = result.messages[0].content.parts?.find((p: any) => p.type === 'text')?.text;
        expect(textContent).toBe('Test message');
      });

      it('should reject access with incorrect resourceId', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        await expect(
          memory.recall({
            threadId: thread.id,
            resourceId: 'wrong-resource',
            perPage: 10,
          }),
        ).rejects.toThrow(
          `Thread with id ${thread.id} is for resource with id ${resourceId} but resource wrong-resource was queried`,
        );
      });

      it('should handle undefined resourceId gracefully', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        const result = await memory.recall({
          threadId: thread.id,
          perPage: 10,
        });

        expect(result.messages).toHaveLength(1);
        const textContent = result.messages[0].content.parts?.find((p: any) => p.type === 'text')?.text;
        expect(textContent).toBe('Test message');
      });
    });
    describe('Concurrent Operations', () => {
      it('should handle concurrent message saves with embeddings', async () => {
        const thread = await memory.saveThread({
          thread: createTestThread('Concurrent Test Thread'),
        });

        // Create multiple batches of messages with embeddings
        const messagesBatches = Array(5)
          .fill(null)
          .map(() => [
            createTestMessage(thread.id, 'Test message with embedding'),
            createTestMessage(thread.id, 'Another test message with embedding'),
          ]);

        // Try to save all batches concurrently
        const promises = messagesBatches.map(messages => memory.saveMessages({ messages }));

        // Should handle concurrent index creation gracefully
        await expect(Promise.all(promises)).resolves.not.toThrow();

        // Verify all messages were saved
        const result = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 20,
        });
        expect(result.messages).toHaveLength(messagesBatches.flat().length);
      });
    });
  });

  describe('Thread Pagination', () => {
    it('should return paginated threads with correct metadata', async () => {
      // Create multiple test threads (25 threads)
      await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          memory.saveThread({
            thread: createTestThread(`Paginated Thread ${i + 1}`, {}, i),
          }),
        ),
      );

      // Get first page
      const result = await memory.listThreads({
        filter: { resourceId },
        page: 0,
        perPage: 10,
      });

      expect(result.threads).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(10);
      expect(result.hasMore).toBe(true);

      // Verify threads are retrieved in latest-first order
      expect(result.threads[0].title).toBe('Paginated Thread 25');
      expect(result.threads[9].title).toBe('Paginated Thread 16');
    });

    it('should handle edge cases (empty results, last page)', async () => {
      // Empty result set
      const emptyResult = await memory.listThreads({
        filter: { resourceId: 'non-existent-resource' },
        page: 0,
        perPage: 10,
      });

      expect(emptyResult.threads).toHaveLength(0);
      expect(emptyResult.total).toBe(0);
      expect(emptyResult.hasMore).toBe(false);

      // Create 5 threads and test final page
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          memory.saveThread({
            thread: createTestThread(`Edge Case Thread ${i + 1}`, {}, i),
          }),
        ),
      );

      const lastPageResult = await memory.listThreads({
        filter: { resourceId },
        page: 0,
        perPage: 10,
      });

      expect(lastPageResult.threads).toHaveLength(5);
      expect(lastPageResult.total).toBe(5);
      expect(lastPageResult.hasMore).toBe(false);
    });

    it('should handle page boundaries correctly', async () => {
      // Test page boundaries (create 15 threads, perPage=7 makes 3 pages)
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          memory.saveThread({
            thread: createTestThread(`Boundary Thread ${i + 1}`, {}, i),
          }),
        ),
      );

      // Test second page
      const page2Result = await memory.listThreads({
        filter: { resourceId },
        page: 1,
        perPage: 7,
      });

      expect(page2Result.threads).toHaveLength(7);
      expect(page2Result.page).toBe(1);
      expect(page2Result.hasMore).toBe(true);

      // Test third page (final page)
      const page3Result = await memory.listThreads({
        filter: { resourceId },
        page: 2,
        perPage: 7,
      });

      expect(page3Result.threads).toHaveLength(1);
      expect(page3Result.page).toBe(2);
      expect(page3Result.hasMore).toBe(false);
    });

    it('should reject negative page values', async () => {
      await memory.saveThread({
        thread: createTestThread('Validation Test Thread'),
      });

      await expect(
        memory.listThreads({
          filter: { resourceId },
          page: -1,
          perPage: 10,
        }),
      ).rejects.toThrow();
    });

    it('should handle perPage edge cases', async () => {
      await memory.saveThread({
        thread: createTestThread('perPage Edge Case Thread'),
      });

      // Test perPage = 0 (should return zero results)
      const zeroResult = await memory.listThreads({
        filter: { resourceId },
        page: 0,
        perPage: 0,
      });
      expect(zeroResult.threads).toHaveLength(0);
      expect(zeroResult.perPage).toBe(0);

      // Test negative perPage (should throw an error - invalid input)
      await expect(
        memory.listThreads({
          filter: { resourceId },
          page: 0,
          perPage: -5,
        }),
      ).rejects.toThrow('perPage must be >= 0');
    });
  });

  if (workerTestConfig) {
    describe('Concurrent Operations with Workers', () => {
      it('should save multiple messages concurrently using Memory instance in workers to a single thread', async () => {
        const totalMessages = 1;
        const mainThread = await memory.saveThread({
          thread: createTestThread(`Reusable Concurrent Worker Test Thread`),
        });
        const messagesToSave: ReturnType<typeof createTestMessage>[] = [];
        for (let i = 0; i < totalMessages; i++) {
          messagesToSave.push(createTestMessage(mainThread.id, `Message ${i + 1} for reusable concurrent test`));
        }
        const messagesForWorkers = messagesToSave.map(message => ({
          originalMessage: message,
        }));

        const chunkSize = Math.ceil(totalMessages / NUMBER_OF_WORKERS);
        const workerPromises = [];
        console.info(`Using ${NUMBER_OF_WORKERS} generic Memory workers to process ${totalMessages} messages.`);
        for (let i = 0; i < NUMBER_OF_WORKERS; i++) {
          const chunk = messagesForWorkers.slice(i * chunkSize, (i + 1) * chunkSize);
          if (chunk.length === 0) continue;
          const workerPromise = new Promise((resolve, reject) => {
            const worker = new Worker(path.resolve(__dirname, '..', 'worker', 'generic-memory-worker.js'), {
              workerData: {
                messages: chunk,
                storageType: workerTestConfig.storageTypeForWorker,
                storageConfig: workerTestConfig.storageConfigForWorker,
                memoryOptions: workerTestConfig.memoryOptionsForWorker || { generateTitle: false },
                vectorConfig: workerTestConfig.vectorConfigForWorker,
              },
            });
            let completed = false;
            worker.on('message', msg => {
              if ((msg as any).success) {
                resolve(msg);
                completed = true;
              } else {
                console.error('Worker error (reusable test):', (msg as any).error);
                reject(new Error((msg as any).error?.message || 'Worker failed in reusable test'));
              }
            });
            worker.on('error', reject);
            worker.on('exit', code => {
              if (!completed && code !== 0) {
                reject(new Error(`Reusable test worker stopped with exit code ${code}`));
              }
            });
          });
          workerPromises.push(workerPromise);
        }
        try {
          await Promise.all(workerPromises);
        } catch (error) {
          console.error('Error during reusable worker execution:', error);
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 10_000));

        const result = await memory.recall({
          threadId: mainThread.id,
          resourceId,
          perPage: totalMessages,
        });
        expect(result.messages).toHaveLength(totalMessages);

        // Sort based on numeric part of content for consistent comparison
        const sortedResultMessages = [...result.messages].sort((a, b) => {
          const numA = parseInt(getTextContent(a).match(/Message (\d+)/)?.[1] || '0');
          const numB = parseInt(getTextContent(b).match(/Message (\d+)/)?.[1] || '0');
          return numA - numB;
        });

        const sortedExpectedMessages = [...messagesToSave].sort((a, b) => {
          const numA = parseInt(getTextContent(a).match(/Message (\d+)/)?.[1] || '0');
          const numB = parseInt(getTextContent(b).match(/Message (\d+)/)?.[1] || '0');
          return numA - numB;
        });

        sortedExpectedMessages.forEach((expectedMessage, index) => {
          expect(getTextContent(sortedResultMessages[index])).toBe(getTextContent(expectedMessage));
        });
      });
    });
  }
}
