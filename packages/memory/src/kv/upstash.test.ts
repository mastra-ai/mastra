import { MessageType, ThreadType } from '@mastra/core';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { UpstashKVMemory } from './upstash';

dotenv.config();

// Ensure environment variables are set
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error('Required Vercel KV environment variables are not set');
}

describe('KVMemory Integration Tests', () => {
  let memory: UpstashKVMemory;
  const testPrefix = `test_${Date.now()}`;

  beforeAll(() => {
    memory = new UpstashKVMemory({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
      prefix: testPrefix,
      maxTokens: 1000,
    });
  });

  afterAll(async () => {
    await memory.drop();
  });

  describe('Thread Operations', () => {
    let testThread: ThreadType;

    beforeEach(() => {
      testThread = {
        id: randomUUID(),
        title: 'Integration Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        resourceid: 'test-resource',
        metadata: { test: true },
      };
    });

    it('should create and retrieve a thread', async () => {
      const saved = await memory.saveThread({ thread: testThread });
      expect(saved).toEqual(testThread);

      const retrieved = await memory.getThreadById({ threadId: testThread.id });
      expect(retrieved).toEqual(testThread);
    });

    it('should find threads by resource ID', async () => {
      const thread1 = { ...testThread, id: randomUUID() };
      const thread2 = {
        ...testThread,
        id: randomUUID(),
        resourceid: 'different-resource',
      };

      await memory.saveThread({ thread: thread1 });
      await memory.saveThread({ thread: thread2 });

      const threads = await memory.getThreadsByResourceId({
        resourceid: 'test-resource',
      });

      expect(threads.length).toBeGreaterThanOrEqual(1);
      expect(threads.some(t => t.id === thread1.id)).toBe(true);
      expect(threads.some(t => t.id === thread2.id)).toBe(false);
    });

    it('should update thread title and metadata', async () => {
      await memory.saveThread({ thread: testThread });

      const updatedTitle = 'Updated Title';
      const updatedMetadata = { updated: true };

      const updated = await memory.updateThread(testThread.id, updatedTitle, updatedMetadata);

      expect(updated.title).toBe(updatedTitle);
      expect(updated.metadata).toEqual(updatedMetadata);
      expect(updated.updatedAt).not.toEqual(testThread.updatedAt);
    });

    it('should delete a thread', async () => {
      await memory.saveThread({ thread: testThread });
      await memory.deleteThread(testThread.id);

      const retrieved = await memory.getThreadById({
        threadId: testThread.id,
      });
      expect(retrieved).toBeNull();
    });
  });

  describe('Message Operations', () => {
    let testThread: ThreadType;
    let testMessage: MessageType;

    beforeEach(async () => {
      testThread = {
        id: randomUUID(),
        title: 'Test Thread for Messages',
        createdAt: new Date(),
        updatedAt: new Date(),
        resourceid: 'test-resource',
        metadata: {},
      };

      testMessage = {
        id: randomUUID(),
        content: 'Test message content',
        role: 'user' as const,
        type: 'text' as const,
        createdAt: new Date(),
        threadId: testThread.id,
      };

      await memory.saveThread({ thread: testThread });
    });

    it('should save and retrieve messages', async () => {
      await memory.saveMessages({ messages: [testMessage] });

      const { messages, uiMessages } = await memory.getMessages({
        threadId: testThread.id,
      });

      expect(messages.length).toBe(1);
      expect(messages?.[0]?.content).toBe(testMessage.content);
      expect(uiMessages.length).toBe(1);
    });

    it('should handle message deletion', async () => {
      const message1 = { ...testMessage, id: randomUUID() };
      const message2 = { ...testMessage, id: randomUUID() };

      await memory.saveMessages({ messages: [message1, message2] });
      await memory.deleteMessage(message1.id);

      const { messages } = await memory.getMessages({
        threadId: testThread.id,
      });

      expect(messages.length).toBe(1);
      expect(messages?.[0]?.id).toBe(message2.id);
    });

    it('should respect token limits in context window', async () => {
      // Create a very long message that should exceed our small token limit
      const longMessage: MessageType = {
        ...testMessage,
        content: 'a'.repeat(100), // This should be about 25 tokens
        id: randomUUID(),
      };

      const shortMessage: MessageType = {
        ...testMessage,
        content: 'Short message', // This should be about 3 tokens
        id: randomUUID(),
      };

      await memory.saveMessages({ messages: [longMessage, shortMessage] });

      // Create a new memory instance with a very small token limit
      const lowTokenMemory = new UpstashKVMemory({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
        prefix: testPrefix,
        maxTokens: 5, // Only allow 5 tokens
      });

      const context = await lowTokenMemory.getContextWindow({
        threadId: testThread.id,
        format: 'raw',
      });

      // Should only get the short message
      expect(context.length).toBe(1);
      expect(context?.[0]?.id).toBe(shortMessage.id);
    });

    it('should filter messages by date range', async () => {
      const oldMessage: MessageType = {
        ...testMessage,
        id: randomUUID(),
        createdAt: new Date('2023-01-01'),
      };

      const newMessage: MessageType = {
        ...testMessage,
        id: randomUUID(),
        createdAt: new Date('2024-01-01'),
      };

      await memory.saveMessages({ messages: [oldMessage, newMessage] });

      const context = await memory.getContextWindow({
        threadId: testThread.id,
        format: 'raw',
        startDate: new Date('2023-12-31'),
        endDate: new Date('2024-12-31'),
      });

      expect(context.length).toBe(1);
      expect(context?.[0]?.id).toBe(newMessage.id);
    });
  });

  describe('Tool Cache Operations', () => {
    let testThread: ThreadType;

    beforeEach(async () => {
      testThread = {
        id: randomUUID(),
        title: 'Test Thread for Tool Cache',
        createdAt: new Date(),
        updatedAt: new Date(),
        resourceid: 'test-resource',
        metadata: {},
      };

      await memory.saveThread({ thread: testThread });
    });

    it('should cache and validate tool call arguments', async () => {
      const toolArgs = { test: true };
      const toolName = 'testTool';

      const message: MessageType = {
        id: randomUUID(),
        content: 'Tool test',
        role: 'assistant' as const,
        type: 'text' as const,
        createdAt: new Date(),
        threadId: testThread.id,
        toolCallArgs: [toolArgs],
        toolNames: [toolName],
      };

      await memory.saveMessages({ messages: [message] });

      const result = await memory.getToolResult({
        threadId: testThread.id,
        toolArgs,
        toolName,
      });

      expect(result).toBeNull();
    });
  });
});
