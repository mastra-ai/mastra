import { randomUUID } from 'node:crypto';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { UIMessageWithMetadata } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { MockStore } from '@mastra/core/storage';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { memoryProcessorAgent, weatherAgent } from './mastra/agents/weather';
import { weatherTool, weatherToolCity } from './mastra/tools/weather';

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
    const agentMemory = (await mastra.getAgent('agent').getMemory())!;
    await expect(agentMemory.query({ threadId: '1' })).resolves.not.toThrow();
    const agentMemory2 = (await agent.getMemory())!;
    await expect(agentMemory2.query({ threadId: '1' })).resolves.not.toThrow();
  });

  it('should inherit storage from Mastra instance when workingMemory is enabled', async () => {
    const mastra = new Mastra({
      storage: new LibSQLStore({
        url: dbFile,
      }),
      agents: {
        testAgent: new Agent({
          name: 'Test Agent',
          instructions: 'You are a test agent',
          model: openai('gpt-4o-mini'),
          memory: new Memory({
            options: {
              workingMemory: {
                enabled: true,
              },
            },
          }),
        }),
      },
    });

    const agent = mastra.getAgent('testAgent');
    const memory = await agent.getMemory();
    expect(memory).toBeDefined();

    // Should be able to create a thread and use working memory
    const thread = await memory!.createThread({
      resourceId: 'test-resource',
      title: 'Test Thread',
    });

    expect(thread).toBeDefined();
    expect(thread.id).toBeDefined();

    // Should be able to update working memory without error
    await memory!.updateWorkingMemory({
      threadId: thread.id,
      resourceId: 'test-resource',
      workingMemory: '# Test Working Memory\n- Name: Test User',
    });

    // Should be able to retrieve working memory
    const workingMemoryData = await memory!.getWorkingMemory({
      threadId: thread.id,
      resourceId: 'test-resource',
    });

    expect(workingMemoryData).toBe('# Test Working Memory\n- Name: Test User');
  });

  it('should work with resource-scoped working memory when storage supports it', async () => {
    const mastra = new Mastra({
      storage: new LibSQLStore({
        url: dbFile,
      }),
      agents: {
        testAgent: new Agent({
          name: 'Test Agent',
          instructions: 'You are a test agent',
          model: openai('gpt-4o-mini'),
          memory: new Memory({
            options: {
              workingMemory: {
                enabled: true,
                scope: 'resource',
              },
            },
          }),
        }),
      },
    });

    const agent = mastra.getAgent('testAgent');
    const memory = await agent.getMemory();

    expect(memory).toBeDefined();

    // Create a thread
    const thread = await memory!.createThread({
      resourceId: 'test-resource',
      title: 'Test Thread',
    });

    // Update resource-scoped working memory
    await memory!.updateWorkingMemory({
      threadId: thread.id,
      resourceId: 'test-resource',
      workingMemory: '# Resource Memory\n- Shared across threads',
    });

    const workingMemoryData = await memory!.getWorkingMemory({
      threadId: thread.id,
      resourceId: 'test-resource',
    });

    expect(workingMemoryData).toBe('# Resource Memory\n- Shared across threads');
  });

  it('should call getMemoryMessages for first message in new thread when using resource-scoped semantic recall', async () => {
    const storage = new LibSQLStore({
      url: dbFile,
    });
    const vector = new LibSQLVector({
      connectionUrl: dbFile,
    });

    const mastra = new Mastra({
      storage,
      vectors: { default: vector },
      agents: {
        testAgent: new Agent({
          name: 'Test Agent',
          instructions: 'You are a helpful assistant',
          model: openai('gpt-4o-mini'),
          memory: new Memory({
            options: {
              lastMessages: 5,
              semanticRecall: {
                topK: 5,
                messageRange: 5,
                scope: 'resource',
              },
            },
            storage,
            vector,
            embedder: fastembed,
          }),
        }),
      },
    });

    const agent = mastra.getAgent('testAgent');
    const memory = (await agent.getMemory()) as Memory;
    const resourceId = 'test-resource-semantic';

    // First, create a thread and add some messages to establish history
    const thread1Id = randomUUID();
    await agent.generate('Tell me about cats', {
      memory: {
        thread: thread1Id,
        resource: resourceId,
      },
    });

    // Verify first thread has messages
    const thread1Messages = await memory.query({ threadId: thread1Id, resourceId });
    expect(thread1Messages.messages.length).toBeGreaterThan(0);

    // Now create a second thread - this should be able to access memory from thread1
    // due to resource scope, even on the first message
    const thread2Id = randomUUID();

    // Mock the getMemoryMessages method to track if it's called
    let getMemoryMessagesCalled = false;
    let retrievedMemoryMessages: any[] = [];
    const originalGetMemoryMessages = (agent as any).getMemoryMessages;
    (agent as any).getMemoryMessages = async (...args: any[]) => {
      getMemoryMessagesCalled = true;
      const result = await originalGetMemoryMessages.call(agent, ...args);
      retrievedMemoryMessages = result || [];
      return result;
    };

    const secondResponse = await agent.generate('What did we discuss about cats?', {
      memory: {
        thread: thread2Id,
        resource: resourceId,
      },
    });

    // Restore original method
    (agent as any).getMemoryMessages = originalGetMemoryMessages;

    expect(getMemoryMessagesCalled).toBe(true);

    // Verify that getMemoryMessages actually returned messages from the first thread
    expect(retrievedMemoryMessages.length).toBeGreaterThan(0);

    // Verify that the retrieved messages contain content from the first thread
    const hasMessagesFromFirstThread = retrievedMemoryMessages.some(
      msg =>
        msg.threadId === thread1Id || (typeof msg.content === 'string' && msg.content.toLowerCase().includes('cat')),
    );
    expect(hasMessagesFromFirstThread).toBe(true);
    expect(secondResponse.text.toLowerCase()).toMatch(/(cat|animal|discuss)/);
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
      const agentMemory = (await agent.getMemory())!;
      const { messages, uiMessages } = await agentMemory.query({ threadId });
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
        modelSettings: {
          temperature: 0,
        },
      });

      // 2. Object/output mode
      await agent.generate([{ role: 'user', content: 'Give me JSON' }], {
        threadId,
        resourceId,
        output: z.object({
          result: z.string(),
        }),
        modelSettings: {
          temperature: 0,
        },
      });

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages, uiMessages } = await agentMemory.query({ threadId });
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
        expect.arrayContaining([expect.stringMatching(/2\s*\+\s*2/), expect.stringContaining('"result"')]),
      );

      expect(flattenAssistantMessages(assistantUiMessages)).toEqual(
        expect.arrayContaining([expect.stringMatching(/2\s*\+\s*2/), expect.stringContaining('"result"')]),
      );
    });

    it('should not save messages provided in the context option', async () => {
      const threadId = randomUUID();
      const resourceId = 'context-option-messages-not-saved';

      const userMessageContent = 'This is a user message.';
      const contextMessageContent1 = 'This is the first context message.';
      const contextMessageContent2 = 'This is the second context message.';

      // Send user messages and context messages
      await agent.generate(userMessageContent, {
        threadId,
        resourceId,
        context: [
          { role: 'system', content: contextMessageContent1 },
          { role: 'user', content: contextMessageContent2 },
        ],
      });

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.query({ threadId });

      // Assert that the context messages are NOT saved
      const savedContextMessages = messages.filter(
        (m: any) => m.content === contextMessageContent1 || m.content === contextMessageContent2,
      );
      expect(savedContextMessages.length).toBe(0);

      // Assert that the user message IS saved
      const savedUserMessages = messages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(1);
      expect(savedUserMessages[0].content).toBe(userMessageContent);
    });

    it('should persist UIMessageWithMetadata through agent generate and memory', async () => {
      const threadId = randomUUID();
      const resourceId = 'ui-message-metadata';

      // Create messages with metadata
      const messagesWithMetadata: UIMessageWithMetadata[] = [
        {
          id: 'msg1',
          role: 'user',
          content: 'Hello with metadata',
          parts: [{ type: 'text', text: 'Hello with metadata' }],
          metadata: {
            source: 'web-ui',
            timestamp: Date.now(),
            customField: 'custom-value',
          },
        },
        {
          id: 'msg2',
          role: 'user',
          content: 'Another message with different metadata',
          parts: [{ type: 'text', text: 'Another message with different metadata' }],
          metadata: {
            source: 'mobile-app',
            version: '1.0.0',
            userId: 'user-123',
          },
        },
      ];

      // Send messages with metadata
      await agent.generate(messagesWithMetadata, {
        threadId,
        resourceId,
      });

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { uiMessages } = await agentMemory.query({ threadId });

      // Check that all user messages were saved
      const savedUserMessages = uiMessages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(2);

      // Check that metadata was persisted in the stored messages
      const firstMessage = uiMessages.find((m: any) => m.content === 'Hello with metadata');
      const secondMessage = uiMessages.find((m: any) => m.content === 'Another message with different metadata');

      expect(firstMessage).toBeDefined();
      expect(firstMessage!.metadata).toEqual({
        source: 'web-ui',
        timestamp: expect.any(Number),
        customField: 'custom-value',
      });

      expect(secondMessage).toBeDefined();
      expect(secondMessage!.metadata).toEqual({
        source: 'mobile-app',
        version: '1.0.0',
        userId: 'user-123',
      });

      // Check UI messages also preserve metadata
      const firstUIMessage = uiMessages.find((m: any) => m.content === 'Hello with metadata');
      const secondUIMessage = uiMessages.find((m: any) => m.content === 'Another message with different metadata');

      expect(firstUIMessage?.metadata).toEqual({
        source: 'web-ui',
        timestamp: expect.any(Number),
        customField: 'custom-value',
      });

      expect(secondUIMessage?.metadata).toEqual({
        source: 'mobile-app',
        version: '1.0.0',
        userId: 'user-123',
      });
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

    const agentWithDynamicModelTitle = new Agent({
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model: ({ runtimeContext }) => openai(runtimeContext.get('model') as string),
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

    it('should use generateTitle with runtime context', async () => {
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

      const runtimeContext = new RuntimeContext();
      runtimeContext.set('model', 'gpt-4o-mini');
      await agentWithDynamicModelTitle.generate([{ role: 'user', content: 'Hello, world!' }], {
        threadId,
        resourceId,
        runtimeContext,
      });

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

describe('Agent with message processors', () => {
  it('should apply processors to filter tool messages from context', async () => {
    const threadId = randomUUID();
    const resourceId = 'processor-filter-tool-message';

    // First, ask a question that will trigger a tool call
    const firstResponse = await memoryProcessorAgent.generate('What is the weather in London?', {
      threadId,
      resourceId,
    });

    // The response should contain the weather.
    expect(firstResponse.text).toContain('65');

    // Check that tool calls were saved to memory
    const agentMemory = (await memoryProcessorAgent.getMemory())!;
    const { messages: messagesFromMemory } = await agentMemory.query({ threadId });
    const toolMessages = messagesFromMemory.filter(
      m => m.role === 'tool' || (m.role === 'assistant' && typeof m.content !== 'string'),
    );

    expect(toolMessages.length).toBeGreaterThan(0);

    // Now, ask a follow-up question. The processor should prevent the tool call history
    // from being sent to the model.
    const secondResponse = await memoryProcessorAgent.generate('What was the tool you just used?', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          lastMessages: 10,
        },
      },
    });

    const secondResponseRequestMessages: CoreMessage[] = secondResponse.request.body.input;

    expect(secondResponseRequestMessages.length).toBe(4);
    // Filter out tool messages and tool results, should be the same as above.
    expect(
      secondResponseRequestMessages.filter(m => m.role !== 'tool' || (m as any)?.tool_calls?.[0]?.type !== 'function')
        .length,
    ).toBe(4);
  }, 3000_000);
});

describe('Agent.fetchMemory', () => {
  it('should return messages from memory', async () => {
    const threadId = randomUUID();
    const resourceId = 'fetch-memory-test';

    const response = await weatherAgent.generate('Just a simple greeting to populate memory.', {
      threadId,
      resourceId,
    });

    const { messages } = await weatherAgent.fetchMemory({ threadId, resourceId });

    expect(messages).toBeDefined();
    if (!messages) return;

    expect(messages.length).toBe(2); // user message + assistant response

    const userMessage = messages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();
    if (!userMessage) return;
    expect(userMessage.content[0]).toEqual({ type: 'text', text: 'Just a simple greeting to populate memory.' });

    const assistantMessage = messages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    if (!assistantMessage) return;
    expect(assistantMessage.content).toEqual([{ type: 'text', text: response.text }]);
  }, 30_000);

  it('should apply processors when fetching memory', async () => {
    const threadId = randomUUID();
    const resourceId = 'fetch-memory-processor-test';

    await memoryProcessorAgent.generate('What is the weather in London?', { threadId, resourceId });

    const { messages } = await memoryProcessorAgent.fetchMemory({ threadId, resourceId });

    expect(messages).toBeDefined();
    if (!messages) return;

    const hasToolRelatedMessage = messages.some(
      m => m.role === 'tool' || (Array.isArray(m.content) && m.content.some(c => c.type === 'tool-call')),
    );
    expect(hasToolRelatedMessage).toBe(false);

    const userMessage = messages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();
    if (!userMessage) return;
    expect(userMessage.content[0]).toEqual({ type: 'text', text: 'What is the weather in London?' });
  }, 30_000);

  it('should return nothing if thread does not exist', async () => {
    const threadId = randomUUID();
    const resourceId = 'fetch-memory-no-thread';

    const result = await weatherAgent.fetchMemory({ threadId, resourceId });

    expect(result.messages).toEqual([]);
    expect(result.threadId).toBe(threadId);
  });
});

describe('Agent memory test gemini', () => {
  const memory = new Memory({
    storage: new MockStore(),
    options: {
      threads: {
        generateTitle: false,
      },
      lastMessages: 2,
    },
  });

  const agent = new Agent({
    name: 'gemini-agent',
    instructions:
      'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name.',
    model: google.chat('gemini-2.5-flash-preview-05-20'),
    memory,
    tools: { get_weather: weatherToolCity },
  });

  const resource = 'weatherAgent-memory-test';
  const thread = new Date().getTime().toString();

  it('should not throw error when using gemini', async () => {
    // generate two messages in the db
    await agent.generate(`What's the weather in Tokyo?`, {
      memory: { resource, thread },
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Will throw if the messages sent to the agent aren't cleaned up because a tool call message will be the first message sent to the agent
    // Which some providers like gemini will not allow.
    await expect(
      agent.generate(`What's the weather in London?`, {
        memory: { resource, thread },
      }),
    ).resolves.not.toThrow();
  });
});

describe('Reasoning message consolidation', () => {
  it('should consolidate reasoning details into single part for prompt generation', async () => {
    // Test that reasoning details are consolidated to prevent fragmentation when generating prompts
    const storage = new LibSQLStore({
      url: 'file:reasoning-consolidation-test.db',
    });

    const memory = new Memory({
      storage: storage,
    });

    const threadId = 'ui-test-thread';
    const resourceId = 'ui-test-resource';

    // Initialize storage
    await storage.init();
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId: resourceId,
        title: 'UI Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a message with reasoning parts containing multiple details
    const messageWithReasoning: MastraMessageV2 = {
      id: 'reasoning-msg',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      resourceId,
      type: 'v2',
      content: {
        format: 2,
        parts: [
          {
            type: 'reasoning',
            reasoning: 'I need to analyze this request step by step.',
            details: [
              { type: 'text', text: 'Step 1: Parse the user input' },
              { type: 'text', text: 'Step 2: Identify the required action' },
              { type: 'text', text: 'Step 3: Execute the appropriate tool' },
            ],
            providerMetadata: {
              reasoningId: 'rs_TEST123',
            },
          },
          {
            type: 'text',
            text: 'I understand your request. Let me help you with that.',
          },
        ],
        content: 'I understand your request. Let me help you with that.',
      },
    };

    // Save the message
    await memory.saveMessages({
      messages: [messageWithReasoning],
      format: 'v2',
    });

    // Retrieve messages to simulate conversation reload
    const retrieved = await memory.query({
      threadId,
      resourceId,
      format: 'v2',
    });

    // Verify UI messages maintain reasoning structure
    const uiMessages = retrieved.uiMessages;
    const firstUiMessageWithReasoning = uiMessages?.find(
      (m: any) => Array.isArray(m.parts) && m.parts.some((p: any) => p?.type === 'reasoning'),
    );

    expect(firstUiMessageWithReasoning).toBeDefined();
    expect(firstUiMessageWithReasoning?.parts.filter((p: any) => p?.type === 'reasoning')).toHaveLength(1);

    // Simulate prompt generation for next API call
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(retrieved.messagesV2, 'memory');
    const promptMessages = messageList.get.all.aiV4.prompt();

    // Verify reasoning parts are consolidated in the prompt
    let reasoningCount = 0;
    for (const msg of promptMessages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const reasoningParts = msg.content.filter((p: any) => p.type === 'reasoning');
        reasoningCount += reasoningParts.length;
      }
    }

    // Reasoning should be consolidated into single part
    expect(reasoningCount).toBe(1);
  });

  it('should preserve reasoning metadata and consolidate details in V1 format', async () => {
    // Test that reasoning metadata is preserved when converting to V1 format
    const storage = new LibSQLStore({
      url: 'file:reasoning-v1-format-test.db',
    });

    const memory = new Memory({
      storage: storage,
    });

    const threadId = 'test-thread-123';
    const resourceId = 'test-resource-123';

    // Initialize storage to create tables
    await storage.init();

    // Create the thread first
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId: resourceId,
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a V2 message with reasoning parts and tool invocation
    const messageWithReasoning: MastraMessageV2 = {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      resourceId,
      type: 'v2',
      content: {
        format: 2,
        parts: [
          {
            type: 'reasoning',
            reasoning: 'Let me analyze this step by step.',
            details: [
              {
                type: 'text',
                text: 'First, I need to understand the requirements.',
              },
              {
                type: 'text',
                text: 'Second, I should check the available tools.',
              },
              {
                type: 'text',
                text: 'Finally, I will make the appropriate tool call.',
              },
            ],
            providerMetadata: {
              reasoningId: 'rs_abc123',
            },
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'fc_xyz789',
              toolName: 'analyzeData',
              state: 'call',
              args: { query: 'test query' },
            },
            providerMetadata: {
              functionCallId: 'fc_xyz789',
            },
          },
        ],
        toolInvocations: [
          {
            toolCallId: 'fc_xyz789',
            toolName: 'analyzeData',
            state: 'call',
            args: { query: 'test query' },
          },
        ],
      },
    };

    // Save the message
    await memory.saveMessages({
      messages: [messageWithReasoning],
      format: 'v2',
    });

    // Retrieve the messages
    const retrieved = await memory.query({
      threadId,
      resourceId,
      format: 'v2',
    });

    // Verify V2 messages preserve reasoning structure
    expect(retrieved.messagesV2).toHaveLength(1);
    const retrievedV2 = retrieved.messagesV2[0];
    expect(retrievedV2.content.parts).toHaveLength(2);

    const reasoningPart = retrievedV2.content.parts.find(p => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();
    expect(reasoningPart?.providerMetadata?.reasoningId).toBe('rs_abc123');

    // Verify V1 format consolidates reasoning details
    const v1Messages = retrieved.messages;
    let reasoningPartsCount = 0;
    for (const msg of v1Messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const reasoningParts = msg.content.filter(p => p.type === 'reasoning');
        reasoningPartsCount += reasoningParts.length;
      }
    }
    expect(reasoningPartsCount).toBe(1);

    // Verify pairing information is preserved (tool calls may be in separate messages)
    const hasToolCall = v1Messages.some(
      m =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some(p => p.type === 'tool-call' && p.toolCallId === 'fc_xyz789'),
    );
    expect(hasToolCall).toBe(true);

    // Verify UI messages format

    const uiMessage = retrieved.uiMessages[0];
    if (uiMessage && 'parts' in uiMessage) {
      const uiReasoningParts = uiMessage.parts.filter(p => p.type === 'reasoning');
      expect(uiReasoningParts).toHaveLength(1);
    }
  });

  it('should maintain reasoning and tool call pairing through message conversions', async () => {
    // Verify that reasoning IDs remain paired with their corresponding tool calls
    const storage = new LibSQLStore({
      url: 'file:reasoning-pairing-test.db',
    });

    const threadId = 'pairing-test-thread';
    const resourceId = 'pairing-test-resource';

    // Initialize the storage to create tables
    await storage.init();

    // Create the thread
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId: resourceId,
        title: 'Pairing Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a message with paired reasoning and tool call
    const list = new MessageList({ threadId, resourceId });

    const messageWithPairedElements: MastraMessageV2 = {
      id: 'msg-with-pairing',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      resourceId,
      type: 'v2',
      content: {
        format: 2,
        parts: [
          {
            type: 'reasoning',
            reasoning: 'Analyzing the request to determine the best approach.',
            details: [
              { type: 'text', text: 'The user needs help with X' },
              { type: 'text', text: 'I should use tool Y to accomplish this' },
            ],
            providerMetadata: {
              reasoningId: 'rs_PAIRED_123',
              signature: 'sig_ABC',
            },
          },
          {
            type: 'text',
            text: "I'll help you with that. Let me gather the information.",
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'fc_PAIRED_123',
              toolName: 'getData',
              state: 'call',
              args: { id: 'test' },
            },
            providerMetadata: {
              functionCallId: 'fc_PAIRED_123',
            },
          },
        ],
        content: "I'll help you with that. Let me gather the information.",
      },
    };

    list.add(messageWithPairedElements, 'response');

    // Verify conversions maintain pairing
    const v1Messages = list.get.all.v1();
    const v2Messages = list.get.all.v2();

    // Verify reasoning is consolidated in V1
    const v1AssistantMessages = v1Messages.filter(m => m.role === 'assistant');
    let totalReasoningParts = 0;

    for (const msg of v1AssistantMessages) {
      if (Array.isArray(msg.content)) {
        const reasoningParts = msg.content.filter(p => p.type === 'reasoning');
        totalReasoningParts += reasoningParts.length;

        // Verify metadata preservation
        for (const part of reasoningParts) {
          expect(part.signature).toBeDefined();
        }
      }
    }

    expect(totalReasoningParts).toBe(1);

    // Verify tool call pairing is preserved
    const hasMatchingToolCall = v1Messages.some(
      msg =>
        Array.isArray(msg.content) && msg.content.some(p => p.type === 'tool-call' && p.toolCallId === 'fc_PAIRED_123'),
    );

    expect(hasMatchingToolCall).toBe(true);

    // Test full storage and retrieval cycle
    const memory = new Memory({ storage });

    await memory.saveMessages({
      messages: v2Messages,
      format: 'v2',
    });

    const retrieved = await memory.query({
      threadId,
      resourceId,
      format: 'v2',
    });

    // Verify pairing is maintained after storage retrieval
    const retrievedV1 = retrieved.messages;
    let retrievedReasoningCount = 0;
    for (const msg of retrievedV1) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        retrievedReasoningCount += msg.content.filter(p => p.type === 'reasoning').length;
      }
    }

    expect(retrievedReasoningCount).toBe(1);
  });
});
