import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys, agentGenerate } from '@internal/test-utils';
import type { MastraDBMessage, UIMessageWithMetadata } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig, CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { ToolCallFilter } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

export async function getAgentMemoryTests({
  model,
  tools,
  reasoningModel,
}: {
  model: MastraModelConfig;
  tools: Record<string, any>;
  reasoningModel?: MastraModelConfig;
}) {
  const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'mastra-agent.db');
  const dbFile = `file:${dbPath}`;

  beforeEach(() => {
    const date = new Date(2026, 2, 10, 13, 56, 0);

    vi.useFakeTimers({
      now: date,
      shouldAdvanceTime: true,
      toFake: ['Date'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Agent Memory Tests', () => {
    it(`inherits storage from Mastra instance`, async () => {
      const agent = new Agent({
        id: 'test-agent',
        name: 'test',
        instructions: '',
        model,
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
          id: 'test-storage',
          url: dbFile,
        }),
        agents: {
          testAgent: new Agent({
            id: 'test-agent',
            name: 'Test Agent',
            instructions: 'You are a test agent',
            model,
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
          id: 'test-storage',
          url: dbFile,
        }),
        agents: {
          testAgent: new Agent({
            id: 'test-agent',
            name: 'Test Agent',
            instructions: 'You are a test agent',
            model,
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
        id: 'inline-storage',
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: 'test-vector',
      });

      const mastra = new Mastra({
        storage,
        vectors: { default: vector },
        agents: {
          testAgent: new Agent({
            id: 'test-agent',
            name: 'Test Agent',
            instructions: 'You are a helpful assistant',
            model,
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

      await agentGenerate(agent, 'Tell me about cats', { threadId: thread1Id, resourceId }, model);

      // Verify first thread has messages
      const thread1Messages = await memory.recall({ threadId: thread1Id, resourceId });
      expect(thread1Messages.messages.length).toBeGreaterThan(0);

      // Now create a second thread - this should be able to access memory from thread1
      // due to resource scope, even on the first message
      const thread2Id = randomUUID();

      const secondResponse = (await agentGenerate(
        agent,
        'What did we discuss about cats?',
        { threadId: thread2Id, resourceId },
        model,
      )) as any;

      // Verify that the agent was able to access cross-thread memory
      // by checking that the response references the previous conversation
      expect(secondResponse.text.toLowerCase()).toMatch(/(cat|animal|discuss)/);

      // Verify that the second thread now has messages
      const thread2Messages = await memory.recall({ threadId: thread2Id, resourceId });
      expect(thread2Messages.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Agent memory message persistence', () => {
    // making a separate memory for agent to avoid conflicts with other tests
    const memory = new Memory({
      options: {
        lastMessages: 10,
        semanticRecall: true,
      },
      storage: new LibSQLStore({
        id: 'test-storage',
        url: dbFile,
      }),
      vector: new LibSQLVector({
        url: dbFile,
        id: 'test-vector',
      }),
      embedder: fastembed,
    });
    const agent = new Agent({
      id: 'test-agent',
      name: 'test',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
      model,
      memory,
      tools,
    });
    it('should save all user messages (not just the most recent)', async () => {
      const threadId = randomUUID();
      const resourceId = 'all-user-messages';

      // Send multiple user messages
      await agentGenerate(
        agent,
        [
          { role: 'user', content: 'First message' },
          { role: 'user', content: 'Second message' },
        ],
        { threadId, resourceId },
        model,
      );

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages
        .filter(m => m.role === 'user')
        .map(m => {
          // Extract text from MastraDBMessage content.parts
          const textParts = m.content.parts?.filter(p => p.type === 'text') || [];
          return textParts.map(p => p.text).join('');
        });

      expect(userMessages).toEqual(expect.arrayContaining(['First message', 'Second message']));
    });

    it('should save assistant responses for both text and object output modes', async () => {
      const threadId = randomUUID();
      const resourceId = 'assistant-responses';
      // 1. Text mode
      await agentGenerate(agent, [{ role: 'user', content: 'What is 2+2?' }], { threadId, resourceId }, model);

      vi.advanceTimersByTime(100);

      // 2. Object/output mode
      await agentGenerate(
        agent,
        [{ role: 'user', content: 'Give me JSON' }],
        { threadId, resourceId, output: z.object({ result: z.string() }) },
        model,
      );

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages
        .filter(m => m.role === 'user')
        .map(m => m.content.parts?.find(p => p.type === 'text')?.text || '');
      const assistantMessages = messages
        .filter(m => m.role === 'assistant')
        .map(m => m.content.parts?.find(p => p.type === 'text')?.text || '');
      expect(userMessages).toEqual(expect.arrayContaining(['What is 2+2?', 'Give me JSON']));
      expect(assistantMessages).toEqual(
        expect.arrayContaining([expect.stringContaining('2 + 2'), expect.stringContaining('"result"')]),
      );
    });

    it('should not save messages provided in the context option', async () => {
      const threadId = randomUUID();
      const resourceId = 'context-option-messages-not-saved';

      const userMessageContent = 'This is a user message.';
      const contextMessageContent1 = 'This is the first context message.';
      const contextMessageContent2 = 'This is the second context message.';

      // Send user messages and context messages
      await agentGenerate(
        agent,
        userMessageContent,
        {
          threadId,
          resourceId,
          context: [
            { role: 'system', content: contextMessageContent1 },
            { role: 'user', content: contextMessageContent2 },
          ],
        },
        model,
      );

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      // Assert that the context messages are NOT saved
      const savedContextMessages = messages.filter(m => {
        const text = m.content.parts?.find(p => p.type === 'text')?.text || '';
        return text === contextMessageContent1 || text === contextMessageContent2;
      });

      expect(savedContextMessages.length).toBe(0);

      // Assert that the user message IS saved
      const savedUserMessages = messages.filter(m => m.role === 'user');
      expect(savedUserMessages.length).toBe(1);
      const savedUserText = savedUserMessages[0].content.parts?.find(p => p.type === 'text')?.text || '';
      expect(savedUserText).toBe(userMessageContent);
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

      await agentGenerate(agent, messagesWithMetadata, { threadId, resourceId }, model);

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      // Check that all user messages were saved
      const savedUserMessages = messages.filter(m => m.role === 'user');
      expect(savedUserMessages.length).toBe(2);

      // Check that metadata was persisted in the stored messages
      const firstMessage = messages.find(m => {
        const textContent = m.content?.parts?.find(p => p.type === 'text')?.text;
        return textContent === 'Hello with metadata';
      });
      const secondMessage = messages.find(m => {
        const textContent = m.content?.parts?.find(p => p.type === 'text')?.text;
        return textContent === 'Another message with different metadata';
      });

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

      // Check stored messages also preserve metadata
      const firstStoredMessage = messages.find(m => {
        const textContent = m.content?.parts?.find(p => p.type === 'text')?.text;
        return textContent === 'Hello with metadata';
      });
      const secondStoredMessage = messages.find(m => {
        const textContent = m.content?.parts?.find(p => p.type === 'text')?.text;
        return textContent === 'Another message with different metadata';
      });

      expect(firstStoredMessage?.content.metadata).toEqual({
        source: 'web-ui',
        timestamp: expect.any(Number),
        customField: 'custom-value',
      });

      expect(secondStoredMessage?.content.metadata).toEqual({
        source: 'mobile-app',
        version: '1.0.0',
        userId: 'user-123',
      });
    });

    it.skipIf(!reasoningModel)(
      'should consolidate reasoning into single part when saving to memory',
      async () => {
        const reasoningAgent = new Agent({
          id: 'reasoning-test-agent',
          name: 'reasoning-test-agent',
          instructions: 'You are a helpful assistant that thinks through problems.',
          model: reasoningModel!,
          memory,
        });

        const threadId = randomUUID();
        const resourceId = 'test-resource-reasoning';

        const result = (await agentGenerate(
          reasoningAgent,
          'What is 2+2? Think through this carefully.',
          { threadId, resourceId },
          reasoningModel!,
        )) as any;

        expect((result as any).reasoning.length).toBeGreaterThan(0);
        expect((result as any).reasoningText).toBeDefined();
        expect((result as any).reasoningText!.length).toBeGreaterThan(0);

        const originalReasoningText = (result as any).reasoningText;

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
      },
      60000,
    );
  });

  describe('Agent thread metadata with generateTitle', () => {
    // Agent with generateTitle: true
    const memoryWithTitle = new Memory({
      options: {
        generateTitle: true,
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ id: 'mastra-storage', url: dbFile }),
      vector: new LibSQLVector({ url: dbFile, id: 'test-vector' }),
      embedder: fastembed,
    });
    const agentWithTitle = new Agent({
      id: 'title-on',
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model,
      memory: memoryWithTitle,
      tools,
    });

    const agentWithDynamicModelTitle = new Agent({
      id: 'title-on',
      name: 'title-on',
      instructions: 'Test agent with generateTitle on.',
      model: ({ requestContext }) => {
        if (
          typeof model === 'string' ||
          ('specificationVersion' in model && ['v2'].includes(model.specificationVersion))
        ) {
          return requestContext.get('model');
        } else if ('specificationVersion' in model && ['v3'].includes(model.specificationVersion)) {
          return openaiV6(requestContext.get('model') as string);
        } else {
          return openai(requestContext.get('model') as string);
        }
      },
      memory: memoryWithTitle,
      tools,
    });

    // Agent with generateTitle: false
    const memoryNoTitle = new Memory({
      options: {
        generateTitle: false,
        semanticRecall: true,
        lastMessages: 10,
      },
      storage: new LibSQLStore({ id: 'mastra-storage', url: dbFile }),
      vector: new LibSQLVector({ url: dbFile, id: 'test-vector' }),
      embedder: fastembed,
    });
    const agentNoTitle = new Agent({
      id: 'title-off',
      name: 'title-off',
      instructions: 'Test agent with generateTitle off.',
      model,
      memory: memoryNoTitle,
      tools,
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

      await agentGenerate(
        agentWithTitle,
        [{ role: 'user', content: 'Hello, world!' }],
        { threadId, resourceId },
        model,
      );
      vi.advanceTimersByTime(100);
      await agentGenerate(
        agentWithTitle,
        [{ role: 'user', content: 'Hello, world!' }],
        { threadId, resourceId },
        model,
      );

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

      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2'].includes(model.specificationVersion))
      ) {
        requestContext.set('model', 'openai/gpt-4o-mini');
      } else {
        requestContext.set('model', 'gpt-4o-mini');
      }

      await agentGenerate(
        agentWithDynamicModelTitle,
        [{ role: 'user', content: 'Hello, world!' }],
        { threadId, resourceId, requestContext },
        model,
      );

      vi.advanceTimersByTime(100);

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

      await agentGenerate(agentNoTitle, [{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId }, model);
      vi.advanceTimersByTime(100);
      await agentGenerate(agentNoTitle, [{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId }, model);

      const existingThread = await memoryNoTitle.getThreadById({ threadId });
      expect(existingThread).toBeDefined();
      expect(existingThread?.metadata).toMatchObject(metadata);
    });
  });

  describe('Agent with message processors', () => {
    const memoryWithProcessor = new Memory({
      embedder: fastembed,
      storage: new LibSQLStore({
        id: 'processor-storage',
        url: dbFile,
      }),
      vector: new LibSQLVector({
        url: dbFile,
        id: 'processor-vector',
      }),
      options: {
        semanticRecall: {
          topK: 20,
          messageRange: {
            before: 10,
            after: 10,
          },
        },
        lastMessages: 20,
        generateTitle: true,
      },
    });

    const memoryProcessorAgent = new Agent({
      id: 'test-processor',
      name: 'test-processor',
      instructions: 'You are a test agent that uses a memory processor to filter out tool call messages.',
      model,
      memory: memoryWithProcessor,
      inputProcessors: [new ToolCallFilter()],
      tools,
    });

    it('should apply processors to filter tool messages from context', async () => {
      const threadId = randomUUID();
      const resourceId = 'processor-filter-tool-message';

      // First, ask a question that will trigger a tool call
      const firstResponse = (await agentGenerate(
        memoryProcessorAgent,
        'What is the weather in London?',
        { threadId, resourceId },
        model,
      )) as any;

      // The response should contain the weather.
      expect(firstResponse.text).toContain('65');

      vi.advanceTimersByTime(100);

      // Check that tool calls were saved to memory
      const agentMemory = (await memoryProcessorAgent.getMemory())!;
      const { messages: messagesFromMemory } = await agentMemory.recall({ threadId });
      const toolMessages = messagesFromMemory.filter(
        (m: any) => m.role === 'tool' || (m.role === 'assistant' && typeof m.content !== 'string'),
      );

      expect(toolMessages.length).toBeGreaterThan(0);

      // Now, ask a follow-up question. The processor should prevent the tool call history
      // from being sent to the model.
      const secondResponse = (await agentGenerate(
        memoryProcessorAgent,
        'What was the tool you just used?',
        { threadId, resourceId },
        model,
      )) as any;

      const requestBody =
        typeof secondResponse.request.body === 'string'
          ? JSON.parse(secondResponse.request.body)
          : secondResponse.request.body;
      // Legacy API uses 'messages', new API uses 'input'
      const secondResponseRequestMessages: CoreMessage[] = requestBody.messages || requestBody.input;

      // Check if this is the v6 OpenAI Response API format (uses item_reference objects)
      // In v6, previous turn messages are referenced by ID rather than included inline
      const isV6ResponseApiFormat = secondResponseRequestMessages.some((m: any) => m.type === 'item_reference');

      // Verify no tool messages or tool results are in the request
      // Skip for v6 format since messages are referenced by ID
      if (!isV6ResponseApiFormat) {
        const toolOrToolResultMessages = secondResponseRequestMessages.filter(
          (m: any) => m.role === 'tool' || (m.role === 'assistant' && (m as any)?.tool_calls?.length > 0),
        );
        expect(toolOrToolResultMessages.length).toBe(0);
      }

      // Should have at minimum: system (instructions) + user + assistant + user
      // Optionally: system (semantic recall) if embeddings completed in time
      // For v6, some messages may be item_references
      expect(secondResponseRequestMessages.length).toBeGreaterThanOrEqual(4);

      // Verify message structure
      const systemMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'system');
      const userMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'user');
      const assistantMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'assistant');
      const itemReferences = secondResponseRequestMessages.filter((m: any) => m.type === 'item_reference');

      // Should have 1-2 system messages (instructions + optional semantic recall)
      expect(systemMessages.length).toBeGreaterThanOrEqual(1);
      expect(systemMessages.length).toBeLessThanOrEqual(2);

      // For v6 Response API format, user/assistant messages from previous turns may be item_references
      // item_reference objects only have {type, id} - no role metadata available
      if (isV6ResponseApiFormat) {
        // Must have at least 1 direct user message (the current question being asked)
        expect(userMessages.length).toBeGreaterThanOrEqual(1);
        // Total user + assistant + item_references should be at least 3:
        // (first user question + assistant response + second user question)
        // Some of these may be inline messages, others may be item_references
        expect(userMessages.length + assistantMessages.length + itemReferences.length).toBeGreaterThanOrEqual(3);
      } else {
        // Should have 2 user messages (first question + second question)
        expect(userMessages.length).toBe(2);

        // Should have 1 assistant message (response to first question, with tool calls filtered out)
        expect(assistantMessages.length).toBe(1);
      }
    }, 30_000);

    it('should include working memory in LLM request when input processors run', async () => {
      const storage = new LibSQLStore({
        id: 'test-storage-wm',
        url: dbFile,
      });
      const vector = new LibSQLVector({
        url: dbFile,
        id: 'test-vector-wm',
      });

      const memoryWithWorkingMemory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          workingMemory: {
            enabled: true,
          },
          lastMessages: 5,
        },
      });

      const agent = new Agent({
        id: 'test-agent-wm',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model,
        memory: memoryWithWorkingMemory,
      });

      const threadId = randomUUID();
      const resourceId = 'test-resource-wm';

      // First, set working memory
      await memoryWithWorkingMemory.updateWorkingMemory({
        threadId,
        resourceId,
        workingMemory: '# User Information\nName: John Doe\nFavorite color: Blue',
      });

      // Now generate a response - this should include working memory in the LLM request
      const response = (await agentGenerate(
        agent,
        'What is my favorite color?',
        { threadId, resourceId },
        model,
      )) as any;

      // Check the actual request body sent to the LLM
      const wmRequestBody =
        typeof response.request.body === 'string' ? JSON.parse(response.request.body) : response.request.body;
      // Legacy API uses 'messages', new API uses 'input'
      const requestMessages: CoreMessage[] = wmRequestBody.messages || wmRequestBody.input;

      // Should have more than just the user message
      // Should include working memory system message + user message
      expect(requestMessages.length).toBeGreaterThan(1);

      // Should include a system message with working memory
      const workingMemoryMessage = requestMessages.find(
        msg => msg.role === 'system' && msg.content.includes('John Doe') && msg.content.includes('Blue'),
      );

      expect(workingMemoryMessage).toBeDefined();
      expect(workingMemoryMessage?.content).toContain('John Doe');
      expect(workingMemoryMessage?.content).toContain('Blue');

      // Response should reference the working memory
      expect(response.text.toLowerCase()).toContain('blue');
    }, 30_000);
  });

  describe('Agent memory test with MockStore', () => {
    const mockMemory = new Memory({
      storage: new MockStore(),
      options: {
        generateTitle: false,
        lastMessages: 2,
      },
    });

    const mockStoreAgent = new Agent({
      id: 'mock-store-agent',
      name: 'mock-store-agent',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name.',
      model,
      memory: mockMemory,
      tools,
    });

    const resource = 'weatherAgent-memory-test';
    const thread = new Date().getTime().toString();

    it('should not throw error when using memory with multiple messages', async () => {
      // generate two messages in the db
      await agentGenerate(
        mockStoreAgent,
        `What's the weather in Tokyo?`,
        { threadId: thread, resourceId: resource },
        model,
      );

      vi.advanceTimersByTime(1000);

      // Will throw if the messages sent to the agent aren't cleaned up because a tool call message will be the first message sent to the agent
      // Which some providers like gemini will not allow.
      await expect(
        agentGenerate(
          mockStoreAgent,
          `What's the weather in London?`,
          { threadId: thread, resourceId: resource },
          model,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Input Processors', () => {
    it('should run MessageHistory input processor and include previous messages in LLM request', async () => {
      const inputProcessorMemory = new Memory({
        storage: new MockStore(),
        options: {
          lastMessages: 10, // Fetch last 10 messages
        },
      });

      const inputProcessorAgent = new Agent({
        id: 'input-processor-agent',
        name: 'Input Processor Agent',
        instructions: 'You are a helpful assistant',
        model,
        memory: inputProcessorMemory,
      });

      const threadId = randomUUID();
      const resourceId = 'input-processor-resource';

      // First message
      const firstResponse = (await agentGenerate(
        inputProcessorAgent,
        'My name is Alice',
        { threadId, resourceId },
        model,
      )) as any;

      expect(firstResponse.text).toBeDefined();

      // Verify first message was saved
      const { messages: messagesAfterFirst } = await inputProcessorMemory.recall({ threadId });
      expect(messagesAfterFirst.length).toBe(2); // user + assistant

      vi.advanceTimersByTime(100);
      // Second message - should include history from MessageHistory input processor
      const secondResponse = (await agentGenerate(
        inputProcessorAgent,
        'What is my name?',
        { threadId, resourceId },
        model,
      )) as any;

      // Check the actual request sent to the LLM
      const requestBody =
        typeof secondResponse.request.body === 'string'
          ? JSON.parse(secondResponse.request.body)
          : secondResponse.request.body;
      const requestMessages: CoreMessage[] = requestBody.messages || requestBody.input;

      // EXPECTED: Should have 3+ messages (previous user + assistant + current user)
      expect(requestMessages.length).toBeGreaterThan(1);

      // Should include the previous conversation
      const previousUserMessage = requestMessages.find(
        (msg: any) =>
          msg.role === 'user' &&
          (msg.content?.includes?.('Alice') || msg.content?.find?.((p: any) => p.text && p.text.includes('Alice'))),
      );
      expect(previousUserMessage).toBeDefined();
    });
  });

  describe('Guardrails + Memory interaction', () => {
    it('should NOT save messages to memory when output guardrail aborts', async () => {
      const guardrailStorage = new MockStore();
      const guardrailMemory = new Memory({
        storage: guardrailStorage,
        options: {
          lastMessages: 10,
        },
      });

      // Create an output guardrail that always aborts
      const abortingGuardrail = {
        id: 'content-blocker',
        name: 'Content Blocker',
        processOutputResult: async ({
          messages,
          abort,
        }: {
          messages: MastraDBMessage[];
          abort: (reason?: string) => never;
        }) => {
          abort('Content blocked by guardrail');
          return messages; // Never reached, but satisfies TypeScript
        },
      };

      const guardrailAgent = new Agent({
        id: 'guardrail-memory-test-agent',
        name: 'Guardrail Memory Test Agent',
        instructions: 'You are a helpful assistant',
        model,
        memory: guardrailMemory,
        outputProcessors: [abortingGuardrail],
      });

      const threadId = randomUUID();
      const resourceId = 'guardrail-memory-test';

      // Generate should complete but with tripwire
      const result = (await agentGenerate(
        guardrailAgent,
        'Hello, save this message!',
        { threadId, resourceId },
        model,
      )) as any;

      // Verify the guardrail triggered
      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Content blocked by guardrail');

      // CRITICAL: Verify NO messages were saved to memory
      const { messages } = await guardrailMemory.recall({ threadId });
      expect(messages.length).toBe(0);
    });

    it('should save messages to memory when output guardrail passes', async () => {
      const passingStorage = new MockStore();
      const passingMemory = new Memory({
        storage: passingStorage,
        options: {
          lastMessages: 10,
        },
      });

      // Create an output guardrail that passes (doesn't abort)
      const passingGuardrail = {
        id: 'content-validator',
        name: 'Content Validator',
        processOutputResult: async ({ messages }: { messages: MastraDBMessage[] }) => {
          return messages;
        },
      };

      const passingGuardrailAgent = new Agent({
        id: 'passing-guardrail-memory-test-agent',
        name: 'Passing Guardrail Memory Test Agent',
        instructions: 'You are a helpful assistant',
        model,
        memory: passingMemory,
        outputProcessors: [passingGuardrail],
      });

      const threadId = randomUUID();
      const resourceId = 'passing-guardrail-memory-test';

      // Generate should complete normally
      const result = (await agentGenerate(
        passingGuardrailAgent,
        'Hello, save this message!',
        { threadId, resourceId },
        model,
      )) as any;

      // Verify no tripwire
      expect(result.tripwire).toBeUndefined();

      // Verify messages WERE saved to memory
      const { messages } = await passingMemory.recall({ threadId });
      expect(messages.length).toBeGreaterThan(0);

      // Should have at least user message and assistant response
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(userMessages.length).toBe(1);
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    });

    it.skip('should NOT save messages when input guardrail aborts (before LLM call)', async () => {
      const inputGuardrailStorage = new MockStore();
      const inputGuardrailMemory = new Memory({
        storage: inputGuardrailStorage,
        options: {
          lastMessages: 10,
        },
      });

      // Create an input guardrail that always aborts
      const inputAbortingGuardrail = {
        id: 'input-content-blocker',
        name: 'Input Content Blocker',
        processInput: async ({
          messages,
          abort,
        }: {
          messages: MastraDBMessage[];
          abort: (reason?: string) => never;
        }) => {
          abort('Input blocked by guardrail');
          return messages; // Never reached, but satisfies TypeScript
        },
      };

      const inputGuardrailAgent = new Agent({
        id: 'input-guardrail-memory-test-agent',
        name: 'Input Guardrail Memory Test Agent',
        instructions: 'You are a helpful assistant',
        model,
        memory: inputGuardrailMemory,
        inputProcessors: [inputAbortingGuardrail],
      });

      const threadId = randomUUID();
      const resourceId = 'input-guardrail-memory-test';

      // Generate should complete but with tripwire (no LLM call made)
      const result = (await agentGenerate(
        inputGuardrailAgent,
        'Hello, this should be blocked!',
        { threadId, resourceId },
        model,
      )) as any;

      // Verify the guardrail triggered
      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Input blocked by guardrail');

      // Verify NO messages were saved - LLM was never called, output processors never ran
      const { messages } = await inputGuardrailMemory.recall({ threadId });
      expect(messages.length).toBe(0);
    });
  });

  describe('Thread Cloning', () => {
    const cloneStorage = new LibSQLStore({
      id: 'clone-storage',
      url: dbFile,
    });
    const cloneVector = new LibSQLVector({
      url: dbFile,
      id: 'clone-vector',
    });
    const cloneMemory = new Memory({
      storage: cloneStorage,
      vector: cloneVector,
      embedder: fastembed,
      options: {
        lastMessages: 10,
        semanticRecall: true,
      },
    });

    const cloneAgent = new Agent({
      id: 'clone-test-agent',
      name: 'Clone Test Agent',
      instructions: 'You are a helpful assistant for testing thread cloning.',
      model,
      memory: cloneMemory,
      tools,
    });

    it('should clone a thread with all messages', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-test-resource';

      // Create a conversation in the source thread
      await agentGenerate(cloneAgent, 'Hello, my name is Alice!', { threadId: sourceThreadId, resourceId }, model);
      vi.advanceTimersByTime(100);
      await agentGenerate(cloneAgent, 'I live in New York.', { threadId: sourceThreadId, resourceId }, model);

      // Verify source thread has messages
      const sourceMessages = await cloneMemory.recall({ threadId: sourceThreadId });
      expect(sourceMessages.messages.length).toBeGreaterThan(0);
      const sourceMessageCount = sourceMessages.messages.length;

      // Clone the thread
      const { thread: clonedThread, clonedMessages } = await cloneMemory.cloneThread({
        sourceThreadId,
      });

      // Verify the cloned thread was created
      expect(clonedThread).toBeDefined();
      expect(clonedThread.id).not.toBe(sourceThreadId);

      // Verify clone metadata
      expect(clonedThread.metadata?.clone).toBeDefined();
      expect((clonedThread.metadata?.clone as any).sourceThreadId).toBe(sourceThreadId);

      // Verify cloned messages match source count
      expect(clonedMessages.length).toBe(sourceMessageCount);

      // Verify cloned messages have new IDs but same content
      const clonedThreadMessages = await cloneMemory.recall({ threadId: clonedThread.id });
      expect(clonedThreadMessages.messages.length).toBe(sourceMessageCount);
    });

    it('should clone a thread with custom title', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-custom-title-resource';

      // Create source thread with a message
      await agentGenerate(cloneAgent, 'Test message for cloning', { threadId: sourceThreadId, resourceId }, model);

      // Clone with custom title
      const customTitle = 'My Custom Clone Title';
      const { thread: clonedThread } = await cloneMemory.cloneThread({
        sourceThreadId,
        title: customTitle,
      });

      expect(clonedThread.title).toBe(customTitle);
    });

    it('should clone a thread with message limit', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-limit-resource';

      // Create multiple messages
      for (let i = 1; i <= 3; i++) {
        await agentGenerate(cloneAgent, `Message number ${i}`, { threadId: sourceThreadId, resourceId }, model);
        vi.advanceTimersByTime(1000);
      }

      // Count total messages (should be 6: 3 user + 3 assistant)
      const sourceMessages = await cloneMemory.recall({ threadId: sourceThreadId });
      expect(sourceMessages.messages.length).toBe(6);

      // Clone with limit of 2 (should get last 2 messages)
      const { clonedMessages } = await cloneMemory.cloneThread({
        sourceThreadId,
        options: { messageLimit: 2 },
      });

      expect(clonedMessages.length).toBe(2);
    });

    it('should allow continuing conversation on cloned thread independently', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-continue-resource';

      // Create initial conversation
      await agentGenerate(cloneAgent, 'My favorite color is blue.', { threadId: sourceThreadId, resourceId }, model);

      // Clone the thread
      const { thread: clonedThread } = await cloneMemory.cloneThread({
        sourceThreadId,
      });

      vi.advanceTimersByTime(100);

      // Continue conversation on cloned thread with different info
      await agentGenerate(
        cloneAgent,
        'Actually, my favorite color is red.',
        { threadId: clonedThread.id, resourceId },
        model,
      );

      // Verify source thread is unchanged
      const sourceMessages = await cloneMemory.recall({ threadId: sourceThreadId });
      const sourceUserMessages = sourceMessages.messages.filter(m => m.role === 'user');
      expect(sourceUserMessages.length).toBe(1); // Only original message

      // Verify cloned thread has additional messages
      const clonedMessages = await cloneMemory.recall({ threadId: clonedThread.id });
      const clonedUserMessages = clonedMessages.messages.filter(m => m.role === 'user');
      expect(clonedUserMessages.length).toBe(2); // Original + new message
    });

    it('should clone thread with custom thread ID', async () => {
      const sourceThreadId = randomUUID();
      const customCloneId = `custom-clone-${randomUUID()}`;
      const resourceId = 'clone-custom-id-resource';

      // Create source thread
      await agentGenerate(cloneAgent, 'Test message', { threadId: sourceThreadId, resourceId }, model);

      // Clone with custom ID
      const { thread: clonedThread } = await cloneMemory.cloneThread({
        sourceThreadId,
        newThreadId: customCloneId,
      });

      expect(clonedThread.id).toBe(customCloneId);
    });

    it('should use utility methods to check clone status', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-utility-resource';

      // Create source thread
      const sourceThread = await cloneMemory.createThread({
        threadId: sourceThreadId,
        resourceId,
        title: 'Source Thread',
      });

      await agentGenerate(cloneAgent, 'Test message', { threadId: sourceThreadId, resourceId }, model);

      // Clone the thread
      const { thread: clonedThread } = await cloneMemory.cloneThread({
        sourceThreadId,
      });

      // Test isClone utility
      expect(cloneMemory.isClone(sourceThread)).toBe(false);
      expect(cloneMemory.isClone(clonedThread)).toBe(true);

      // Test getCloneMetadata utility
      expect(cloneMemory.getCloneMetadata(sourceThread)).toBeNull();
      const cloneMetadata = cloneMemory.getCloneMetadata(clonedThread);
      expect(cloneMetadata).not.toBeNull();
      expect(cloneMetadata?.sourceThreadId).toBe(sourceThreadId);

      // Test getSourceThread utility
      const retrievedSource = await cloneMemory.getSourceThread(clonedThread.id);
      expect(retrievedSource).not.toBeNull();
      expect(retrievedSource?.id).toBe(sourceThreadId);
    });

    it('should list all clones of a source thread', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-list-resource';

      // Create source thread
      await agentGenerate(cloneAgent, 'Test message', { threadId: sourceThreadId, resourceId }, model);

      // Create multiple clones
      await cloneMemory.cloneThread({ sourceThreadId, title: 'Clone 1' });
      await cloneMemory.cloneThread({ sourceThreadId, title: 'Clone 2' });
      await cloneMemory.cloneThread({ sourceThreadId, title: 'Clone 3' });

      // List clones
      const clones = await cloneMemory.listClones(sourceThreadId);

      expect(clones.length).toBe(3);
      expect(clones.every(c => cloneMemory.isClone(c))).toBe(true);
    });

    it('should track clone history chain', async () => {
      const originalThreadId = randomUUID();
      const resourceId = 'clone-history-resource';

      // Create original thread
      await agentGenerate(cloneAgent, 'Original message', { threadId: originalThreadId, resourceId }, model);

      // Create chain: original -> clone1 -> clone2
      const { thread: clone1 } = await cloneMemory.cloneThread({
        sourceThreadId: originalThreadId,
        title: 'First Clone',
      });

      const { thread: clone2 } = await cloneMemory.cloneThread({
        sourceThreadId: clone1.id,
        title: 'Second Clone',
      });

      // Get clone history
      const history = await cloneMemory.getCloneHistory(clone2.id);

      expect(history.length).toBe(3);
      expect(history[0]?.id).toBe(originalThreadId);
      expect(history[1]?.id).toBe(clone1.id);
      expect(history[2]?.id).toBe(clone2.id);
    });

    it('should create embeddings for cloned messages that are searchable via semantic recall', async () => {
      const sourceThreadId = randomUUID();
      const resourceId = 'clone-embedding-resource';

      // Create a unique, memorable message in the source thread
      const uniqueContent = 'The ancient library of Alexandria contained countless scrolls of knowledge.';

      await agentGenerate(cloneAgent, uniqueContent, { threadId: sourceThreadId, resourceId }, model);

      // Wait a moment for embeddings to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clone the thread - this should also create embeddings for the cloned messages
      const { thread: clonedThread } = await cloneMemory.cloneThread({
        sourceThreadId,
      });

      // Wait for embeddings to be created for cloned messages
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now search using semantic recall on the cloned thread
      // The search should find the cloned message via its embeddings
      const searchResults = await cloneMemory.recall({
        threadId: clonedThread.id,
        resourceId,
        vectorSearchString: 'ancient library scrolls',
      });

      // Verify we got results from the cloned thread
      expect(searchResults.messages.length).toBeGreaterThan(0);

      // Verify the cloned messages are in the results
      const hasClonedMessage = searchResults.messages.some(m => {
        const textContent = m.content?.parts?.find(p => p.type === 'text')?.text || '';
        return textContent.includes('Alexandria') || textContent.includes('library');
      });
      expect(hasClonedMessage).toBe(true);
    });
  });
}
