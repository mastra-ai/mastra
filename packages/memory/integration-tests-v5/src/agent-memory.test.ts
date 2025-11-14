import { randomUUID } from 'node:crypto';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { UIMessageWithMetadata } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { memoryProcessorAgent } from './mastra/agents/weather';
import { weatherTool, weatherToolCity } from './mastra/tools/weather';

// Helper function to extract text content from MastraDBMessage
function getTextContent(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (message.content && typeof message.content === 'object') {
    // Handle format 2 (MastraMessageContentV2)
    if (message.content.parts && Array.isArray(message.content.parts)) {
      const textParts = message.content.parts.filter((part: any) => part.type === 'text').map((part: any) => part.text);
      return textParts.join(' ');
    }

    // Handle direct text property
    if (message.content.text) {
      return message.content.text;
    }

    // Handle nested content property
    if (message.content.content && typeof message.content.content === 'string') {
      return message.content.content;
    }
  }

  return '';
}

describe('Agent Memory Tests', () => {
  const dbFile = 'file:mastra-agent.db';

  it(`inherits storage from Mastra instance`, async () => {
    const agent = new Agent({
      id: 'test-agent',
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
        id: 'test-mastra-storage',
        url: dbFile,
      }),
    });
    const agentMemory = (await mastra.getAgent('agent').getMemory())!;
    await expect(agentMemory.recall({ threadId: '1' })).resolves.not.toThrow();
    const agentMemory2 = (await agent.getMemory())!;
    await expect(agentMemory2.recall({ threadId: '1' })).resolves.not.toThrow();
  });

  it('should inherit storage from Mastra instance when workingMemory is enabled', async () => {
    const mastra = new Mastra({
      storage: new LibSQLStore({
        id: 'test-working-memory-storage',
        url: dbFile,
      }),
      agents: {
        testAgent: new Agent({
          id: 'test-agent',
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
        id: 'test-resource-scoped-storage',
        url: dbFile,
      }),
      agents: {
        testAgent: new Agent({
          id: 'test-agent',
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
      id: 'semantic-recall-storage',
      url: dbFile,
    });
    const vector = new LibSQLVector({
      id: 'semantic-recall-vector',
      connectionUrl: dbFile,
    });

    const mastra = new Mastra({
      storage,
      vectors: { default: vector },
      agents: {
        testAgent: new Agent({
          id: 'test-agent',
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
    const thread1Messages = await memory.recall({ threadId: thread1Id, resourceId });
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
      retrievedMemoryMessages = result?.messages || [];
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
      msg => msg.threadId === thread1Id || getTextContent(msg).toLowerCase().includes('cat'),
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
        id: 'agent-memory-persistence-storage',
        url: dbFile,
      }),
      vector: new LibSQLVector({
        id: 'agent-memory-persistence-vector',
        connectionUrl: dbFile,
      }),
      embedder: fastembed,
    });
    const agent = new Agent({
      id: 'test-agent',
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
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => getTextContent(m));

      expect(userMessages).toEqual(expect.arrayContaining(['First message', 'Second message']));
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
        structuredOutput: {
          schema: z.object({
            result: z.string(),
          }),
        },
        modelSettings: {
          temperature: 0,
        },
      });

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => getTextContent(m));
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant').map((m: any) => getTextContent(m));
      expect(userMessages).toEqual(expect.arrayContaining(['What is 2+2?', 'Give me JSON']));
      function flattenAssistantMessages(messages: any[]) {
        return messages.flatMap(msg =>
          Array.isArray(msg) ? msg.map(part => (typeof part === 'object' && part.text ? part.text : part)) : msg,
        );
      }

      expect(flattenAssistantMessages(assistantMessages)).toEqual(
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
      const { messages } = await agentMemory.recall({ threadId });

      // Assert that the context messages are NOT saved
      const savedContextMessages = messages.filter(
        (m: any) => getTextContent(m) === contextMessageContent1 || getTextContent(m) === contextMessageContent2,
      );
      expect(savedContextMessages.length).toBe(0);

      // Assert that the user message IS saved
      const savedUserMessages = messages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(1);
      expect(getTextContent(savedUserMessages[0])).toBe(userMessageContent);
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
      const { messages } = await agentMemory.recall({ threadId });

      // Check that all user messages were saved
      const savedUserMessages = messages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(2);

      // Check that metadata was persisted in the stored messages
      const firstMessage = messages.find((m: any) =>
        m.content.parts?.some((p: any) => p.type === 'text' && p.text === 'Hello with metadata'),
      );
      const secondMessage = messages.find((m: any) =>
        m.content.parts?.some((p: any) => p.type === 'text' && p.text === 'Another message with different metadata'),
      );

      expect(firstMessage).toBeDefined();
      expect(firstMessage!.content.metadata).toEqual({
        source: 'web-ui',
        timestamp: expect.any(Number),
        customField: 'custom-value',
      });

      expect(secondMessage).toBeDefined();
      expect(secondMessage!.content.metadata).toEqual({
        source: 'mobile-app',
        version: '1.0.0',
        userId: 'user-123',
      });
    });

    it('should consolidate reasoning into single part when saving to memory', async () => {
      const reasoningAgent = new Agent({
        id: 'reasoning-test-agent',
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
      const { messages } = await agentMemory.recall({ threadId });

      const assistantMessage = messages.find(
        m => m.role === 'assistant' && m.content.parts?.find(p => p.type === 'reasoning'),
      );

      expect(assistantMessage).toBeDefined();

      const retrievedReasoningParts = assistantMessage?.content.parts?.filter(p => p?.type === 'reasoning');

      expect(retrievedReasoningParts).toBeDefined();
      expect(retrievedReasoningParts?.length).toBeGreaterThan(0);

      const retrievedReasoningText = retrievedReasoningParts
        ?.map(p => p.details?.map(d => (d.type === 'text' ? d.text : '')).join('') || '')
        .join('');

      expect(retrievedReasoningText?.length).toBeGreaterThan(0);
      expect(retrievedReasoningText).toBe(originalReasoningText);

      // This is the key fix for issue #8073 - before the fix, reasoning was split into many parts
      expect(retrievedReasoningParts?.length).toBe(1);
    }, 30000);
  });

  describe('Agent thread metadata with generateTitle', () => {
    // Agent with generateTitle: true
    const memoryWithTitle = new Memory({
      options: {
        generateTitle: true,
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ id: 'title-on-storage', url: dbFile }),
      vector: new LibSQLVector({ id: 'title-on-vector', connectionUrl: dbFile }),
      embedder: fastembed,
    });
    const agentWithTitle = new Agent({
      id: 'title-on',
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model: openai('gpt-4o'),
      memory: memoryWithTitle,
      tools: { get_weather: weatherTool },
    });

    const agentWithDynamicModelTitle = new Agent({
      id: 'title-on',
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model: ({ requestContext }) => openai(requestContext.get('model') as string),
      memory: memoryWithTitle,
      tools: { get_weather: weatherTool },
    });

    // Agent with generateTitle: false
    const memoryNoTitle = new Memory({
      options: {
        generateTitle: false,
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ id: 'title-off-storage', url: dbFile }),
      vector: new LibSQLVector({ id: 'title-off-vector', connectionUrl: dbFile }),
      embedder: fastembed,
    });
    const agentNoTitle = new Agent({
      id: 'title-off',
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

    it('should use generateTitle with request context', async () => {
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

      const requestContext = new RequestContext();
      requestContext.set('model', 'gpt-4o-mini');
      await agentWithDynamicModelTitle.generate([{ role: 'user', content: 'Hello, world!' }], {
        threadId,
        resourceId,
        requestContext,
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
    const { messages: messagesFromMemory } = await agentMemory.recall({ threadId });
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

describe('Agent memory test gemini', () => {
  const memory = new Memory({
    storage: new MockStore(),
    options: {
      generateTitle: false,
      lastMessages: 2,
    },
  });

  const agent = new Agent({
    id: 'gemini-agent',
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
