import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';
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
  };
};

export function getResuableTests(memory: Memory) {
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

        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: { lastMessages: 10 },
        });
        expect(result.messages).toHaveLength(10); // lastMessages is set to 10
        expect(result.messages[0].content).toBe('Message 6'); // First message
        expect(result.messages[9].content).toBe('Message 15'); // Last message

        const result2 = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: {
            lastMessages: 15,
          },
        });
        expect(result2.messages).toHaveLength(15); // lastMessages is set to 10
        expect(result2.messages[0].content).toBe('Message 1'); // First message
        expect(result2.messages[14].content).toBe('Message 15'); // Last message
      });

      it('should maintain conversation context', async () => {
        const conversation = [
          createTestMessage(thread.id, 'What is your name?', 'user'),
          createTestMessage(thread.id, 'I am an AI assistant', 'assistant'),
          createTestMessage(thread.id, 'Can you remember that?', 'user'),
          createTestMessage(thread.id, 'Yes, I am an AI assistant', 'assistant'),
        ];

        await memory.saveMessages({ messages: conversation });
        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: { lastMessages: 10 },
        });

        // Verify conversation flow is maintained
        expect(result.messages).toHaveLength(4);
        expect(result.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
      });
    });

    describe('Semantic Search', () => {
      it('should chunk long messages before embedding', async () => {
        const memory = new Memory({
          embedder: openai.embedding(`text-embedding-3-small`),
          options: {
            semanticRecall: {
              topK: 1,
              messageRange: 1,
            },
          },
        });

        const thread = await memory.createThread({
          resourceId,
          title: 'Long chunking test',
        });
        const threadId = thread.id;

        const content = Array(1000).fill(`This is a long message to test chunking with`).join(`\n`);
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
              },
            ],
          }),
        ).resolves.not.toThrow();

        const { messages } = await memory.query({
          threadId,
          resourceId,
          selectBy: {
            vectorSearchString: content,
          },
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
        const weatherQuery = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: { lastMessages: 0, semanticRecall: { messageRange: 1, topK: 1 } },
          vectorMessageSearch: "How's the temperature outside?",
        });

        // Should find the weather-related messages due to semantic similarity
        expect(weatherQuery.messages).toEqual([
          expect.objectContaining({ content: 'The weather is nice today' }),
          expect.objectContaining({ content: "Yes, it's sunny and warm" }),
        ]);

        // Search for location-related messages
        const locationQuery = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          vectorMessageSearch: 'Tell me about cities in France',
          config: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 1, before: 0 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery.messages).toEqual([
          expect.objectContaining({ content: "What's the capital of France?" }),
          expect.objectContaining({ content: 'The capital of France is Paris' }),
        ]);

        // Search for location-related messages
        const locationQuery2 = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          vectorMessageSearch: 'Tell me about cities in France',
          config: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 0, before: 1 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery2.messages).toEqual([
          expect.objectContaining({ content: "Yes, it's sunny and warm" }),
          expect.objectContaining({ content: "What's the capital of France?" }),
        ]);

        // Search for location-related messages
        const locationQuery3 = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          vectorMessageSearch: 'Tell me about cities in France',
          config: {
            semanticRecall: {
              topK: 1,
              messageRange: { after: 1, before: 1 },
            },
            lastMessages: 0,
          },
        });

        // Should find the Paris-related messages
        expect(locationQuery3.messages).toEqual([
          expect.objectContaining({ content: "Yes, it's sunny and warm" }),
          expect.objectContaining({ content: "What's the capital of France?" }),
          expect.objectContaining({ content: 'The capital of France is Paris' }),
        ]);
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

        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          vectorMessageSearch: 'topic X',
          config: {
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
        expect(result.messages[0].content).toBe('Another unrelated message');
        expect(result.messages[1].content).toBe('Message about topic X');
        expect(result.messages[2].content).toBe('Yet another message');

        // Messages should be in the order they were created
        expect(result.messages.every((m, i) => i === 0 || m.createdAt >= result.messages[i - 1].createdAt)).toBe(true);
      });
    });

    describe('Message Types and Roles', () => {
      it('should handle different message types', async () => {
        const messages = [
          createTestMessage(thread.id, 'Hello', 'user', 'text'),
          createTestMessage(thread.id, { type: 'function', name: 'test' }, 'assistant', 'tool-call'),
          createTestMessage(thread.id, { output: 'test result' }, 'assistant', 'tool-result'),
        ];

        await memory.saveMessages({ messages });
        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: {
            lastMessages: 10,
          },
        });

        expect(result.messages).toHaveLength(3);
        expect(result.messages).toEqual([
          expect.objectContaining({ type: 'text' }),
          expect.objectContaining({ type: 'tool-call' }),
          expect.objectContaining({ type: 'tool-result' }),
        ]);
      });

      it('should handle complex message content', async () => {
        const complexMessage = [
          { type: 'text', text: 'This is a complex message with multiple parts' },
          { type: 'image', url: 'https://example.com/image.jpg' },
        ];

        await memory.saveMessages({
          messages: [createTestMessage(thread.id, complexMessage, 'assistant')],
        });

        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: {
            lastMessages: 10,
          },
        });
        expect(result.messages[0].content).toEqual(complexMessage);
      });
    });

    describe('Resource Validation', () => {
      it('should allow access with correct resourceId', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: { lastMessages: 10 },
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].content).toBe('Test message');
      });

      it('should reject access with incorrect resourceId', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        await expect(
          memory.rememberMessages({
            threadId: thread.id,
            resourceId: 'wrong-resource',
            config: { lastMessages: 10 },
          }),
        ).rejects.toThrow(
          `Thread with id ${thread.id} is for resource with id ${resourceId} but resource wrong-resource was queried`,
        );
      });

      it('should handle undefined resourceId gracefully', async () => {
        const messages = [createTestMessage(thread.id, 'Test message')];
        await memory.saveMessages({ messages });

        const result = await memory.rememberMessages({
          threadId: thread.id,
          config: { lastMessages: 10 },
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].content).toBe('Test message');
      });
    });
  });
}
