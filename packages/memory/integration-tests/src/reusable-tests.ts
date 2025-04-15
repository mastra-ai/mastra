import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import type { TextPart, ImagePart, FilePart, ToolCallPart } from 'ai';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { reorderToolCallsAndResults } from '../../src/utils';

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
                resourceId,
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

      it('should reorder tool calls to be directly before their matching tool results', async () => {
        // Create a unique tool call ID for matching tool calls with results
        const toolCallId = `test-call-${randomUUID()}`;

        let count = 0;
        const start = Date.now();
        const getCreatedAt = () => new Date(start + ++count);

        // Create an assistant message with a tool call
        const toolCallMessage = {
          id: randomUUID(),
          threadId: thread.id as string,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            { type: 'text' as const, text: 'I will call a tool' },
            {
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'test-tool',
              args: { test: true },
            },
          ],
        };

        // First create a standard text message from the user
        const userMessage = {
          ...createTestMessage(thread.id, 'A user message to start the conversation', 'user'),
          createdAt: getCreatedAt(),
        };

        // Create a tool result message
        const toolResultMessage = {
          id: randomUUID(),
          threadId: thread.id,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            {
              type: 'tool-result' as const,
              toolCallId,
              toolName: 'test-tool',
              result: 'test result',
            },
          ],
        };

        // PART 1: Test the utility function directly
        // Create a mock of what these messages would look like when retrieved directly from storage
        // In storage, they would be in the wrong order: tool call, user, tool result
        const rawMessages = [toolCallMessage, userMessage, toolResultMessage];

        // Verify the reordering function works correctly directly
        const reorderedMessages = reorderToolCallsAndResults(rawMessages);

        // Now verify the reordering:
        // 1. All messages should still be present
        expect(reorderedMessages.length).toBe(3);

        // 2. User message should remain in place (middle)
        expect(reorderedMessages[0]).toBe(userMessage);

        // 3. Tool call should come directly before tool result
        expect(reorderedMessages[1]).toBe(toolCallMessage);
        expect(reorderedMessages[2]).toBe(toolResultMessage);

        // PART 2: INTEGRATION TEST - Save the messages and verify through Memory APIs

        // Create a new thread for this part of the test to avoid interference
        const integrationThread = await memory.createThread({
          resourceId,
          title: 'Tool Order Integration Test',
        });

        // Create copies of our test messages with the correct new threadId
        const integrationToolCallMessage = {
          ...toolCallMessage,
          id: randomUUID(), // New ID to avoid conflicts
          threadId: integrationThread.id,
        };

        const integrationUserMessage = {
          ...userMessage,
          id: randomUUID(), // New ID to avoid conflicts
          threadId: integrationThread.id,
        };

        const integrationToolResultMessage = {
          ...toolResultMessage,
          id: randomUUID(), // New ID to avoid conflicts
          threadId: integrationThread.id,
        };

        // Save messages in the wrong order intentionally
        await memory.saveMessages({ messages: [integrationToolCallMessage] });
        await memory.saveMessages({ messages: [integrationUserMessage] });
        await memory.saveMessages({ messages: [integrationToolResultMessage] });

        // Retrieve messages through rememberMessages
        const result = await memory.rememberMessages({
          threadId: integrationThread.id,
          config: { lastMessages: 10 },
        });

        // Check that all messages are present
        expect(result.messages.length).toBe(3);

        // Verify message order directly by index
        // We expect: [userMessage, toolCallMessage, toolResultMessage]
        expect(result.messages[0].id).toBe(integrationUserMessage.id);
        expect(result.messages[1].id).toBe(integrationToolCallMessage.id);
        expect(result.messages[2].id).toBe(integrationToolResultMessage.id);
      });

      it('should reorder tool calls that appear after their results', async () => {
        // Create a unique tool call ID for matching tool calls with results
        const toolCallId = `test-call-${randomUUID()}`;

        let count = 0;
        const start = Date.now();
        const getCreatedAt = () => new Date(start + ++count * 1000);

        // Create a tool result message that appears first
        const toolResultMessage = {
          id: randomUUID(),
          threadId: thread.id,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            {
              type: 'tool-result' as const,
              toolCallId,
              toolName: 'test-tool',
              result: 'test result',
            },
          ],
        };

        // Create a user message that appears second
        const userMessage = {
          ...createTestMessage(thread.id, 'A user message in between', 'user'),
          createdAt: getCreatedAt(),
        };

        // Create an assistant message with a tool call that appears last
        const toolCallMessage = {
          id: randomUUID(),
          threadId: thread.id as string,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            { type: 'text' as const, text: 'I will call a tool' },
            {
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'test-tool',
              args: { test: true },
            },
          ],
        };

        // Create messages in the wrong order: tool result, user, tool call
        const rawMessages = [toolResultMessage, userMessage, toolCallMessage];

        // Verify the reordering function works correctly
        const reorderedMessages = reorderToolCallsAndResults(rawMessages);

        // Now verify the reordering:
        // 1. All messages should still be present
        expect(reorderedMessages.length).toBe(3);

        // 2. Tool call should come first, followed by tool result, then user message
        expect(reorderedMessages[0]).toBe(toolCallMessage);
        expect(reorderedMessages[1]).toBe(toolResultMessage);
        expect(reorderedMessages[2]).toBe(userMessage);

        // PART 2: INTEGRATION TEST
        const integrationThread = await memory.createThread({
          resourceId,
          title: 'Reversed Tool Order Test',
        });

        // Create copies of our test messages with the correct new threadId
        const integrationToolResultMessage = {
          ...toolResultMessage,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        const integrationUserMessage = {
          ...userMessage,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        const integrationToolCallMessage = {
          ...toolCallMessage,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        // Save messages in the wrong order intentionally
        await memory.saveMessages({ messages: [integrationToolResultMessage] });
        await memory.saveMessages({ messages: [integrationUserMessage] });
        await memory.saveMessages({ messages: [integrationToolCallMessage] });

        // Retrieve messages through rememberMessages
        const result = await memory.rememberMessages({
          threadId: integrationThread.id,
          config: { lastMessages: 10 },
        });

        // Check that all messages are present
        expect(result.messages.length).toBe(3);

        // Verify message order directly by index
        expect(result.messages[0].id).toBe(integrationToolCallMessage.id);
        expect(result.messages[1].id).toBe(integrationToolResultMessage.id);
        expect(result.messages[2].id).toBe(integrationUserMessage.id);
      });

      it('should handle complex message content', async () => {
        const complexMessage = [
          { type: 'text' as const, text: 'This is a complex message with multiple parts' },
          { type: 'text' as const, text: 'https://example.com/image.jpg' },
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

      it('should reorder tool calls with multiple messages in between', async () => {
        // Create a unique tool call ID for matching tool calls with results
        const toolCallId = `test-call-${randomUUID()}`;

        let count = 0;
        const start = Date.now();
        const getCreatedAt = () => new Date(start + ++count * 1000);

        // Create an assistant message with a tool call
        const toolCallMessage = {
          id: randomUUID(),
          threadId: thread.id as string,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            { type: 'text' as const, text: 'I will call a tool' },
            {
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'test-tool',
              args: { test: true },
            },
          ],
        };

        // Create two user messages
        const userMessage1 = {
          ...createTestMessage(thread.id, 'First user message in between', 'user'),
          createdAt: getCreatedAt(),
        };
        const userMessage2 = {
          ...createTestMessage(thread.id, 'Second user message in between', 'user'),
          createdAt: getCreatedAt(),
        };

        // Create a tool result message
        const toolResultMessage = {
          id: randomUUID(),
          threadId: thread.id,
          resourceId,
          role: 'assistant' as const,
          type: 'text' as const,
          createdAt: getCreatedAt(),
          content: [
            {
              type: 'tool-result' as const,
              toolCallId,
              toolName: 'test-tool',
              result: 'test result',
            },
          ],
        };

        // Create messages in the wrong order: tool call, user1, user2, tool result
        const rawMessages = [toolCallMessage, userMessage1, userMessage2, toolResultMessage];

        // Verify the reordering function works correctly
        const reorderedMessages = reorderToolCallsAndResults(rawMessages);

        // Now verify the reordering:
        // 1. All messages should still be present
        expect(reorderedMessages.length).toBe(4);

        // 2. User messages should remain in their relative order
        expect(reorderedMessages[0]).toBe(userMessage1);
        expect(reorderedMessages[1]).toBe(userMessage2);

        // 3. Tool call should come directly before tool result
        expect(reorderedMessages[2]).toBe(toolCallMessage);
        expect(reorderedMessages[3]).toBe(toolResultMessage);

        // PART 2: INTEGRATION TEST
        const integrationThread = await memory.createThread({
          resourceId,
          title: 'Multiple Messages Tool Order Test',
        });

        // Create copies of our test messages with the correct new threadId
        const integrationToolCallMessage = {
          ...toolCallMessage,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        const integrationUserMessage1 = {
          ...userMessage1,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        const integrationUserMessage2 = {
          ...userMessage2,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        const integrationToolResultMessage = {
          ...toolResultMessage,
          id: randomUUID(),
          threadId: integrationThread.id,
        };

        // Save messages in the wrong order intentionally
        await memory.saveMessages({ messages: [integrationToolCallMessage] });
        await memory.saveMessages({ messages: [integrationUserMessage1] });
        await memory.saveMessages({ messages: [integrationUserMessage2] });
        await memory.saveMessages({ messages: [integrationToolResultMessage] });

        // Retrieve messages through rememberMessages
        const result = await memory.rememberMessages({
          threadId: integrationThread.id,
          config: { lastMessages: 10 },
        });

        // Check that all messages are present
        expect(result.messages.length).toBe(4);

        // Verify message order directly by index
        expect(result.messages[0].id).toBe(integrationUserMessage1.id);
        expect(result.messages[1].id).toBe(integrationUserMessage2.id);
        expect(result.messages[2].id).toBe(integrationToolCallMessage.id);
        expect(result.messages[3].id).toBe(integrationToolResultMessage.id);
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
        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          config: { lastMessages: 20 },
        });
        expect(result.messages).toHaveLength(messagesBatches.flat().length);
      });
    });
  });
}
