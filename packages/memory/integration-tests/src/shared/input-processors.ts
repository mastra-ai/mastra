import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import { MockStore } from '@mastra/core/storage';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { CoreMessage } from 'ai-v5';
import { describe, expect, it } from 'vitest';

import { createMockModel } from './mock-models';
import type { MockModelConfig } from './mock-models';

interface InputProcessorsTestConfig extends MockModelConfig {
  version: string;
}

/**
 * CRITICAL: These tests verify that input processors actually run and modify the LLM request.
 *
 * Each test checks the actual request.body.input sent to the LLM to ensure:
 * 1. MessageHistory processor fetches and includes previous messages
 * 2. WorkingMemory processor adds system messages with user context
 * 3. SemanticRecall processor adds relevant messages from other threads
 *
 * Uses mock models for determinism and speed - we only care about the request, not the response.
 */
export function getInputProcessorsTests(config: InputProcessorsTestConfig) {
  const { version } = config;

  describe(`Input Processor Verification - MessageHistory (${version})`, () => {
    it('should run MessageHistory input processor and include previous messages in LLM request', async () => {
      const testStorage = new MockStore({ id: `mock-store-${randomUUID()}` });
      const memory = new Memory({
        storage: testStorage,
        options: {
          lastMessages: 10, // Fetch last 10 messages
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `message-history-test-${version}-${randomUUID()}`,
        name: 'Message History Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const threadId = `msg-history-${version}-${randomUUID()}`;
      const resourceId = `message-history-resource-${version}-${randomUUID()}`;

      // First message
      await agent.generate('My name is Alice', {
        threadId,
        resourceId,
      });

      // Small delay to ensure message persistence completes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second message
      await agent.generate('I live in Paris', {
        threadId,
        resourceId,
      });

      // Small delay to ensure message persistence completes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify messages were saved
      const { messages: savedMessages } = await memory.recall({ threadId });

      expect(savedMessages.length).toBe(4); // 2 user + 2 assistant

      // Third message - MessageHistory processor should include previous conversation
      const thirdResponse = await agent.generate('What is my name and where do I live?', {
        threadId,
        resourceId,
      });

      // Check the actual request sent to the LLM
      const requestMessages: CoreMessage[] = (thirdResponse.request.body as any).input;

      // Should have system + previous 4 messages + current message = 6 total
      // OR at minimum: previous user + assistant + previous user + assistant + current user = 5
      expect(requestMessages.length).toBeGreaterThanOrEqual(5);

      // Should include "Alice" from first message
      const aliceMessage = requestMessages.find((msg: any) => {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return msg.content.includes('Alice');
          }
          if (Array.isArray(msg.content)) {
            return msg.content.some((part: any) => part.text?.includes('Alice'));
          }
        }
        return false;
      });
      expect(aliceMessage).toBeDefined();

      // Should include "Paris" from second message
      const parisMessage = requestMessages.find((msg: any) => {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return msg.content.includes('Paris');
          }
          if (Array.isArray(msg.content)) {
            return msg.content.some((part: any) => part.text?.includes('Paris'));
          }
        }
        return false;
      });
      expect(parisMessage).toBeDefined();
    });

    it('should respect lastMessages limit in MessageHistory processor', async () => {
      const testStorage = new MockStore({ id: `mock-store-${randomUUID()}` });

      const memory = new Memory({
        storage: testStorage,
        options: {
          lastMessages: 2, // Only fetch last 2 messages
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `message-history-limit-test-${version}-${randomUUID()}`,
        name: 'Message History Limit Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const threadId = `msg-limit-${version}-${randomUUID()}`;
      const resourceId = `limit-test-resource-${version}-${randomUUID()}`;

      // Create 3 exchanges (6 messages total)
      await agent.generate('Message 1', { threadId, resourceId, maxSteps: 1 });
      await agent.generate('Message 2', { threadId, resourceId, maxSteps: 1 });
      await agent.generate('Message 3', { threadId, resourceId, maxSteps: 1 });

      // Fourth message - should only include last 2 messages (Message 3 + its response)
      const fourthResponse = await agent.generate('Message 4', {
        threadId,
        resourceId,
        maxSteps: 1,
      });

      const requestMessages: CoreMessage[] = (fourthResponse.request.body as any).input;

      // Should have: system + last 2 historical messages + current user message
      // With lastMessages: 2, we fetch the 2 most recent messages from storage
      // After 3 exchanges, that's Message 3 (user) + Response 3 (assistant)
      // Total: system (1) + Message 3 (1) + Response 3 (1) + Message 4 current (1) = 4
      expect(requestMessages.length).toBeLessThanOrEqual(6);

      // Should NOT include "Message 1" (too old)
      const message1 = requestMessages.find((msg: any) => {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return msg.content.includes('Message 1');
          }
          if (Array.isArray(msg.content)) {
            return msg.content.some((part: any) => part.text?.includes('Message 1'));
          }
        }
        return false;
      });
      expect(message1).toBeUndefined();

      // Should include "Message 3" (within limit)
      const message3 = requestMessages.find((msg: any) => {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return msg.content.includes('Message 3');
          }
          if (Array.isArray(msg.content)) {
            return msg.content.some((part: any) => part.text?.includes('Message 3'));
          }
        }
        return false;
      });
      expect(message3).toBeDefined();
    });
  });

  describe(`Input Processor Verification - WorkingMemory (${version})`, () => {
    it('should run WorkingMemory input processor and include working memory in LLM request', async () => {
      const memory = new Memory({
        storage: new MockStore({ id: `mock-store-${randomUUID()}` }),
        options: {
          workingMemory: {
            enabled: true,
          },
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `working-memory-test-${version}-${randomUUID()}`,
        name: 'Working Memory Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const threadId = `wm-${version}-${randomUUID()}`;
      const resourceId = `working-memory-resource-${version}-${randomUUID()}`;

      // Set working memory
      await memory.updateWorkingMemory({
        threadId,
        resourceId,
        workingMemory:
          '# User Profile\nName: Bob Smith\nAge: 35\nOccupation: Software Engineer\nFavorite Language: TypeScript',
      });

      // Generate a response - WorkingMemory processor should include the working memory
      const response = await agent.generate('What is my occupation?', {
        threadId,
        resourceId,
      });

      // Check the actual request sent to the LLM
      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should have at least 2 messages: working memory system message + user message
      expect(requestMessages.length).toBeGreaterThanOrEqual(2);

      // Should include a system message with working memory content
      const workingMemoryMessage = requestMessages.find((msg: any) => {
        if (msg.role === 'system') {
          if (typeof msg.content === 'string') {
            return msg.content.includes('Bob Smith') && msg.content.includes('Software Engineer');
          }
          if (Array.isArray(msg.content)) {
            return msg.content.some(
              (part: any) => part.text?.includes('Bob Smith') && part.text?.includes('Software Engineer'),
            );
          }
        }
        return false;
      });

      expect(workingMemoryMessage).toBeDefined();

      // Verify the working memory content is present
      const workingMemoryContent =
        typeof workingMemoryMessage!.content === 'string'
          ? workingMemoryMessage!.content
          : (workingMemoryMessage!.content as any[]).find((part: any) => part.text)?.text || '';

      expect(workingMemoryContent).toContain('Bob Smith');
      expect(workingMemoryContent).toContain('Software Engineer');
      expect(workingMemoryContent).toContain('TypeScript');
    });

    it.skip('should use custom working memory template when provided', async () => {
      // TODO: Fix this test - template should be WorkingMemoryTemplate object, not a function
      const customTemplate = (workingMemory: string) => {
        return `CUSTOM CONTEXT:\n${workingMemory}\n\nUse this information to answer questions.`;
      };

      const memory = new Memory({
        storage: new MockStore({ id: `mock-store-${randomUUID()}` }),
        options: {
          workingMemory: {
            enabled: true,
            template: customTemplate as any,
          },
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `custom-template-test-${version}-${randomUUID()}`,
        name: 'Custom Template Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const threadId = `custom-template-${version}-${randomUUID()}`;
      const resourceId = `custom-template-resource-${version}-${randomUUID()}`;

      await memory.updateWorkingMemory({
        threadId,
        resourceId,
        workingMemory: 'User prefers dark mode',
      });

      const response = await agent.generate('What are my preferences?', {
        threadId,
        resourceId,
      });

      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should include the custom template text
      const customTemplateMessage = requestMessages.find((msg: any) => {
        if (msg.role === 'system') {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : (msg.content as any[]).find((part: any) => part.text)?.text || '';
          return content.includes('CUSTOM CONTEXT') && content.includes('dark mode');
        }
        return false;
      });

      expect(customTemplateMessage).toBeDefined();
    });
  });

  describe(`Input Processor Verification - SemanticRecall (${version})`, () => {
    it('should run SemanticRecall input processor and include semantically similar messages from other threads', async () => {
      // Use shared in-memory database so storage and vector use the same DB
      const dbFile = 'file::memory:?cache=shared';
      const storage = new LibSQLStore({
        id: `semantic-recall-storage-${version}-${randomUUID()}`,
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: `semantic-recall-vector-${version}-${randomUUID()}`,
      });

      // Initialize storage to create tables
      await storage.init();

      const memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 3,
            messageRange: 2,
            scope: 'resource', // Cross-thread recall
          },
          lastMessages: 2,
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `semantic-recall-test-${version}-${randomUUID()}`,
        name: 'Semantic Recall Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const resourceId = `semantic-recall-resource-${version}-${randomUUID()}`;
      const thread1Id = `semantic-thread-1-${version}-${randomUUID()}`;
      const thread2Id = `semantic-thread-2-${version}-${randomUUID()}`;

      // Thread 1: Discuss Python programming
      await agent.generate('I love programming in Python, especially for data science', {
        threadId: thread1Id,
        resourceId,
      });

      await agent.generate('Python has great libraries like pandas and numpy', {
        threadId: thread1Id,
        resourceId,
      });

      // Thread 2: Ask about programming (should recall Python messages from thread 1)
      const response = await agent.generate('What programming languages have we discussed?', {
        threadId: thread2Id,
        resourceId,
      });

      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should have more than just the current message
      // Should include: system + semantically recalled messages + current message
      expect(requestMessages.length).toBeGreaterThan(2);

      // Should include messages about Python from thread 1 in a system message
      const semanticRecallMessage = requestMessages.find((msg: any) => {
        if (msg.role === 'system') {
          const content = typeof msg.content === 'string' ? msg.content : '';
          return content.includes('<remembered_from_other_conversation>') && content.toLowerCase().includes('python');
        }
        return false;
      });

      expect(semanticRecallMessage).toBeDefined();

      // Verify the recalled message is from a different thread (cross-thread recall)
      // This is implicit - if we found Python messages in the semantic recall system message, they must be from thread1
    });

    it('should respect topK limit in SemanticRecall processor', async () => {
      // Use shared in-memory database so storage and vector use the same DB
      const dbFile = 'file::memory:?cache=shared';
      const storage = new LibSQLStore({
        id: `semantic-topk-storage-${version}-${randomUUID()}`,
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: `semantic-topk-vector-${version}-${randomUUID()}`,
      });

      // Initialize storage to create tables
      await storage.init();

      const memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          semanticRecall: {
            topK: 1, // Only recall 1 message
            messageRange: 0, // No context around it
            scope: 'resource',
          },
          lastMessages: 0, // Don't include message history
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `semantic-topk-test-${version}-${randomUUID()}`,
        name: 'Semantic TopK Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const resourceId = `topk-resource-${version}-${randomUUID()}`;
      const thread1Id = `topk-thread-1-${version}-${randomUUID()}`;
      const thread2Id = `topk-thread-2-${version}-${randomUUID()}`;

      // Create multiple messages in thread 1
      await agent.generate('I like cats', { threadId: thread1Id, resourceId });
      await agent.generate('I like dogs', { threadId: thread1Id, resourceId });
      await agent.generate('I like birds', { threadId: thread1Id, resourceId });

      // Query from thread 2 - should only recall 1 message (topK=1)
      const response = await agent.generate('Tell me about cats', {
        threadId: thread2Id,
        resourceId,
      });

      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should have: system + 1 recalled message + current message = 3 total
      // (or possibly just recalled + current = 2 if no system message)
      expect(requestMessages.length).toBeLessThanOrEqual(3);

      // Count user messages (should be at most 2: recalled + current)
      const userMessages = requestMessages.filter((msg: any) => msg.role === 'user');
      expect(userMessages.length).toBeLessThanOrEqual(2);
    });

    it('should only fetch semantically matched messages, not all thread messages', async () => {
      const dbFile = 'file::memory:?cache=shared';
      const storage = new LibSQLStore({
        id: `semantic-perpage-storage-${version}-${randomUUID()}`,
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: `semantic-perpage-vector-${version}-${randomUUID()}`,
      });

      await storage.init();

      const memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          semanticRecall: { topK: 1, scope: 'thread', messageRange: 0 },
          lastMessages: 1,
        },
      });

      const mockModel = createMockModel(config);
      const agent = new Agent({
        id: `semantic-perpage-test-${version}-${randomUUID()}`,
        name: 'Semantic PerPage Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const resourceId = `perpage-resource-${version}-${randomUUID()}`;
      const threadId = `perpage-thread-${version}-${randomUUID()}`;

      // Create 4 messages with distinct topics
      await agent.generate('I really love apples, they are my favorite fruit', { threadId, resourceId });
      await agent.generate('Cats are wonderful pets and companions', { threadId, resourceId });
      await agent.generate('Programming in JavaScript is fun', { threadId, resourceId });
      await agent.generate('Mountains are great for hiking and skiing', { threadId, resourceId });

      // Query about apples - semantic recall should find only the apple message
      const response = await agent.generate('What do you know about apples?', { threadId, resourceId });
      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Extract all user message content
      const allUserContent = requestMessages
        .filter((msg: any) => msg.role === 'user')
        .map((msg: any) => {
          if (typeof msg.content === 'string') return msg.content;
          if (Array.isArray(msg.content)) return msg.content.map((part: any) => part.text || '').join(' ');
          return '';
        })
        .join(' ')
        .toLowerCase();

      expect(allUserContent).toContain('apple');

      // With lastMessages: 1 and topK: 1, only the semantically matched message
      // should appear. Other messages should NOT be fetched.
      expect(allUserContent).not.toContain('cat');
      expect(allUserContent).not.toContain('javascript');
      expect(allUserContent).not.toContain('mountain');
    });
  });

  describe(`Input Processor Verification - Combined Processors (${version})`, () => {
    it('should run all input processors together (MessageHistory + WorkingMemory + SemanticRecall)', async () => {
      // Use shared in-memory database so storage and vector use the same DB
      const dbFile = 'file::memory:?cache=shared';
      const storage = new LibSQLStore({
        id: `combined-storage-${version}-${randomUUID()}`,
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: `combined-vector-${version}-${randomUUID()}`,
      });

      // Initialize storage to create tables
      await storage.init();

      const memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          workingMemory: {
            enabled: true,
          },
          semanticRecall: {
            topK: 2,
            messageRange: 1,
            scope: 'resource',
          },
          lastMessages: 3,
        },
      });

      const mockModel = createMockModel(config);

      const agent = new Agent({
        id: `combined-test-${version}-${randomUUID()}`,
        name: 'Combined Test',
        instructions: 'You are a helpful assistant',
        model: mockModel,
        memory,
      });

      const resourceId = `combined-resource-${version}-${randomUUID()}`;
      const thread1Id = `combined-thread-1-${version}-${randomUUID()}`;
      const thread2Id = `combined-thread-2-${version}-${randomUUID()}`;

      // Set working memory
      await memory.updateWorkingMemory({
        threadId: thread2Id,
        resourceId,
        workingMemory: '# User Info\nName: Charlie\nRole: Developer',
      });

      // Thread 1: Create some history
      await agent.generate('I work with React', { threadId: thread1Id, resourceId });

      // Thread 2: Create some history
      await agent.generate('Hello', { threadId: thread2Id, resourceId });

      // Thread 2: Query - should include all processors
      const response = await agent.generate('What do I work with?', {
        threadId: thread2Id,
        resourceId,
      });

      const requestMessages: CoreMessage[] = (response.request.body as any).input;

      // Should have multiple messages from different processors
      expect(requestMessages.length).toBeGreaterThan(2);

      // Should include working memory (system message with "Charlie")
      const workingMemoryMsg = requestMessages.find((msg: any) => {
        if (msg.role === 'system') {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content.find((part: any) => part.text)?.text || ''
                : '';
          return content.includes('Charlie');
        }
        return false;
      });
      expect(workingMemoryMsg).toBeDefined();

      // Should include message history from thread 2 ("Hello")
      const historyMsg = requestMessages.find((msg: any) => {
        if (msg.role === 'user') {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content.find((part: any) => part.text)?.text || ''
                : '';
          return content.includes('Hello');
        }
        return false;
      });
      expect(historyMsg).toBeDefined();

      // Should include semantically recalled message from thread 1 ("React") in a system message
      const semanticMsg = requestMessages.find((msg: any) => {
        if (msg.role === 'system') {
          const content = typeof msg.content === 'string' ? msg.content : '';
          return content.includes('<remembered_from_other_conversation>') && content.includes('React');
        }
        return false;
      });
      expect(semanticMsg).toBeDefined();
    });
  });
}
