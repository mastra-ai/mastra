import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { weatherTool } from './mastra/tools/weather';

describe('Agent Memory Tests', () => {
  const dbFile = 'file:mastra-agent.db';

  it(`inherits storage from Mastra instance`, async () => {
    const agent = new Agent({
      name: 'test',
      instructions: '',
      model: openai('gpt-4o-mini'),
      memory: new Memory({
        options: {
          lastMessages: 10,
        },
      }),
    });
    const mastra = new Mastra({
      agents: {
        agent,
      },
      storage: new LibSQLStore({
        url: dbFile,
      }),
    });
    await expect(mastra.getAgent('agent').getMemory()!.query({ threadId: '1' })).resolves.not.toThrow();
    await expect(agent.getMemory()!.query({ threadId: '1' })).resolves.not.toThrow();
  });

  describe('Agent memory message persistence', () => {
    // making a separate memory for agent to avoid conflicts with other tests
    const memory = new Memory({
      options: {
        lastMessages: 10,
        semanticRecall: true,
      },
      storage: new LibSQLStore({
        url: dbFile,
      }),
      vector: new LibSQLVector({
        connectionUrl: dbFile,
      }),
      embedder: fastembed,
    });
    const agent = new Agent({
      name: 'test',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
      model: openai('gpt-4o'),
      memory,
      tools: { get_weather: weatherTool },
    });
    it('should save all user messages (not just the most recent)', async () => {
      const threadId = randomUUID();
      const resourceId = 'all-user-messages';

      // Send multiple user messages
      await agent.generate(
        [
          { role: 'user', content: 'First message' },
          { role: 'user', content: 'Second message' },
        ],
        {
          threadId,
          resourceId,
        },
      );

      // Fetch messages from memory
      const { messages, uiMessages } = await agent.getMemory()!.query({ threadId });
      const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content);
      const userUiMessages = uiMessages.filter((m: any) => m.role === 'user').map((m: any) => m.content);

      expect(userMessages).toEqual(expect.arrayContaining(['First message', 'Second message']));
      expect(userUiMessages).toEqual(expect.arrayContaining(['First message', 'Second message']));
    });

    it('should save assistant responses for both text and object output modes', async () => {
      const threadId = randomUUID();
      const resourceId = 'assistant-responses';
      // 1. Text mode
      await agent.generate([{ role: 'user', content: 'What is 2+2?' }], {
        threadId,
        resourceId,
      });

      // 2. Object/output mode
      await agent.generate([{ role: 'user', content: 'Give me JSON' }], {
        threadId,
        resourceId,
        output: z.object({
          result: z.string(),
        }),
      });

      // Fetch messages from memory
      const { messages, uiMessages } = await agent.getMemory()!.query({ threadId });
      const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content);
      const userUiMessages = uiMessages.filter((m: any) => m.role === 'user').map((m: any) => m.content);
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant').map((m: any) => m.content);
      const assistantUiMessages = uiMessages.filter((m: any) => m.role === 'assistant').map((m: any) => m.content);
      expect(userMessages).toEqual(expect.arrayContaining(['What is 2+2?', 'Give me JSON']));
      expect(userUiMessages).toEqual(expect.arrayContaining(['What is 2+2?', 'Give me JSON']));
      function flattenAssistantMessages(messages: any[]) {
        return messages.flatMap(msg =>
          Array.isArray(msg) ? msg.map(part => (typeof part === 'object' && part.text ? part.text : part)) : msg,
        );
      }

      expect(flattenAssistantMessages(assistantMessages)).toEqual(
        expect.arrayContaining([expect.stringContaining('2 + 2'), expect.stringContaining('"result"')]),
      );

      expect(flattenAssistantMessages(assistantUiMessages)).toEqual(
        expect.arrayContaining([expect.stringContaining('2 + 2'), expect.stringContaining('"result"')]),
      );
    });
  });
  describe('Agent thread metadata with generateTitle', () => {
    // Agent with generateTitle: true
    const memoryWithTitle = new Memory({
      options: {
        threads: { generateTitle: true },
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ url: dbFile }),
      vector: new LibSQLVector({ connectionUrl: dbFile }),
      embedder: fastembed,
    });
    const agentWithTitle = new Agent({
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model: openai('gpt-4o'),
      memory: memoryWithTitle,
      tools: { get_weather: weatherTool },
    });

    // Agent with generateTitle: false
    const memoryNoTitle = new Memory({
      options: {
        threads: { generateTitle: false },
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ url: dbFile }),
      vector: new LibSQLVector({ connectionUrl: dbFile }),
      embedder: fastembed,
    });
    const agentNoTitle = new Agent({
      name: 'title-off',
      instructions: 'Test agent with generateTitle off.',
      model: openai('gpt-4o'),
      memory: memoryNoTitle,
      tools: { get_weather: weatherTool },
    });

    it('should preserve metadata when generateTitle is true', async () => {
      const threadId = randomUUID();
      const resourceId = 'gen-title-metadata';
      const metadata = { foo: 'bar', custom: 123 };

      const thread = await memoryWithTitle.createThread({
        threadId,
        resourceId,
        metadata,
      });

      expect(thread).toBeDefined();
      expect(thread?.metadata).toMatchObject(metadata);

      await agentWithTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      await agentWithTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });

      const existingThread = await memoryWithTitle.getThreadById({ threadId });
      expect(existingThread).toBeDefined();
      expect(existingThread?.metadata).toMatchObject(metadata);
    });

    it('should preserve metadata when generateTitle is false', async () => {
      const threadId = randomUUID();
      const resourceId = 'no-gen-title-metadata';
      const metadata = { foo: 'baz', custom: 456 };

      const thread = await memoryNoTitle.createThread({
        threadId,
        resourceId,
        metadata,
      });

      expect(thread).toBeDefined();
      expect(thread?.metadata).toMatchObject(metadata);

      await agentNoTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      await agentNoTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });

      const existingThread = await memoryNoTitle.getThreadById({ threadId });
      expect(existingThread).toBeDefined();
      expect(existingThread?.metadata).toMatchObject(metadata);
    });
  });
});
