import { randomUUID } from 'node:crypto';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
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

    it('should consolidate reasoning into single part when saving to memory', async () => {
      const reasoningAgent = new Agent({
        name: 'reasoning-test-agent',
        instructions: 'You are a helpful assistant that thinks through problems.',
        model: 'openrouter/openai/gpt-oss-20b',
        memory,
      });

      const threadId = randomUUID();
      const resourceId = 'test-resource-reasoning';

      const result = await reasoningAgent.generate('What is 2+2? Think through this carefully.', {
        threadId,
        resourceId,
      });

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoningText).toBeDefined();
      expect(result.reasoningText!.length).toBeGreaterThan(0);

      const originalReasoningText = result.reasoningText;

      const agentMemory = (await reasoningAgent.getMemory())!;
      const { messages } = await agentMemory.query({ threadId });

      const assistantMessage = messages.find(
        (m: any) =>
          m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p: any) => p?.type === 'reasoning'),
      );

      expect(assistantMessage).toBeDefined();

      const retrievedReasoningParts = Array.isArray((assistantMessage as any).content)
        ? (assistantMessage as any).content.filter((p: any) => p?.type === 'reasoning')
        : [];

      expect(retrievedReasoningParts).toBeDefined();
      expect(retrievedReasoningParts.length).toBeGreaterThan(0);

      const retrievedReasoningText = retrievedReasoningParts.map((p: any) => p.text || '').join('');

      expect(retrievedReasoningText.length).toBeGreaterThan(0);
      expect(retrievedReasoningText).toBe(originalReasoningText);

      // This is the key fix for issue #8073 - before the fix, reasoning was split into many parts
      expect(retrievedReasoningParts.length).toBe(1);
    }, 30000);
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
    model: google.chat('gemini-2.5-flash'),
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

/**
 * Issue #9005: GPT-5 Mini Reasoning Model Compatibility
 *
 * This test reproduces the exact issue from the bug report:
 * - Create an agent with GPT-5 mini and tools
 * - Call generate twice on the same thread
 * - Second call fails with: "Item 'fc_xxx' of type 'function_call' was provided without its required 'reasoning' item: 'rs_xxx'"
 *
 * OpenAI's GPT-5 models (using the Responses API) require:
 * - Each function_call item must be accompanied by its associated reasoning item
 * - Reasoning items MUST have `providerOptions.openai.itemId` set
 * - Without the itemId, the OpenAI SDK will skip the reasoning entirely
 *
 * The bug is more reliably triggered when:
 * - Tool execution fails/throws an error
 * - Multiple tool calls happen in one turn
 */
describe('Issue #9005 - GPT-5 Reasoning Model with Memory', () => {
  const dbFile = 'file:gpt5-reasoning.db';

  const gpt5Memory = new Memory({
    storage: new LibSQLStore({ url: dbFile }),
    options: {
      lastMessages: 10,
    },
  });

  // Create a simple test tool - exactly like in the bug report
  const testTool = {
    id: 'testTool',
    description: 'A test tool that returns a message',
    inputSchema: z.object({
      message: z.string().describe('The message to echo'),
    }),
    execute: async (input: { message: string }) => {
      return { result: `Tool executed: ${input.message}` };
    },
  };

  // Create a tool that always fails - to reproduce the bug more reliably
  const failingTool = {
    id: 'failingTool',
    description: 'A tool that always fails',
    inputSchema: z.object({
      message: z.string().describe('The message'),
    }),
    execute: async (_input: { message: string }) => {
      throw new Error('Tool intentionally failed');
    },
  };

  // Create the GPT-5 agent with the tool - exactly like in the bug report
  const gpt5Agent = new Agent({
    id: 'gpt5-test-agent',
    name: 'GPT-5 Test Agent',
    instructions: 'You are a helpful assistant. When asked to use the testTool, always use it.',
    model: 'openai/gpt-5-mini',
    memory: gpt5Memory,
    tools: { testTool },
  });

  // Agent with a failing tool to reproduce the bug
  const gpt5AgentWithFailingTool = new Agent({
    id: 'gpt5-failing-tool-agent',
    name: 'GPT-5 Failing Tool Agent',
    instructions: 'You are a helpful assistant. When asked to use the failingTool, always use it.',
    model: 'openai/gpt-5-mini',
    memory: gpt5Memory,
    tools: { failingTool },
  });

  it('should NOT fail on second generate call with tool usage history (REPRODUCTION TEST)', async () => {
    const threadId = randomUUID();
    const resourceId = randomUUID();

    // First message - should work fine, will trigger tool call
    console.log('Starting first generate call...');
    await gpt5Agent.stream('Use the testTool to say hello', {
      threadId,
      resourceId,
    });

    // Give a moment for memory to be saved
    await new Promise(resolve => setTimeout(resolve, 1000));

    // DEBUG: Inspect what's stored in memory
    const agentMemory = await gpt5Agent.getMemory();
    if (agentMemory) {
      const { messages } = await agentMemory.query({ threadId });
      console.log('DEBUG - Stored messages in memory:');
      for (const msg of messages) {
        console.log(`  Role: ${msg.role}, Content parts:`);
        if (msg.content && typeof msg.content === 'object' && 'parts' in msg.content) {
          for (const part of (msg.content as any).parts) {
            if (part.type === 'reasoning') {
              console.log(`    - reasoning: providerMetadata=${JSON.stringify(part.providerMetadata)}`);
            } else if (part.type === 'tool-invocation') {
              console.log(
                `    - tool-invocation: ${part.toolInvocation?.toolName}, providerMetadata=${JSON.stringify(part.providerMetadata)}`,
              );
            } else {
              console.log(`    - ${part.type}`);
            }
          }
        }
      }
    }

    // Second message - THIS IS WHERE THE BUG OCCURS
    // The second call retrieves conversation history including the previous function_call
    // but the associated reasoning item is missing, causing OpenAI to reject the request
    console.log('Starting second generate call...');
    const response2 = await gpt5Agent.generate('Now use the tool to say goodbye', {
      threadId,
      resourceId,
    });
    console.log('Second response:', response2.text);

    // If we get here without an error, the bug is fixed!
    expect(response2.text).toBeDefined();
    expect(response2.text.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for API calls

  it('should NOT fail on second generate call when first tool call failed (BUG REPRODUCTION)', async () => {
    const threadId = randomUUID();
    const resourceId = 'gpt5-failing-tool-test';

    // First message - tool will fail, but agent should handle it
    console.log('Starting first generate call with failing tool...');
    const response1 = await gpt5AgentWithFailingTool.generate('Use the failingTool to say hello', {
      threadId,
      resourceId,
    });
    console.log('First response (after tool failure):', response1.text);

    // Give a moment for memory to be saved
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second message - THIS IS WHERE THE BUG OCCURS
    // When the tool failed in the first call, the reasoning item may be missing
    console.log('Starting second generate call...');
    const response2 = await gpt5AgentWithFailingTool.generate('Try using the tool again', {
      threadId,
      resourceId,
    });
    console.log('Second response:', response2.text);

    // If we get here without an error, the bug is fixed!
    expect(response2.text).toBeDefined();
  }, 60000); // 60 second timeout for API calls
});
