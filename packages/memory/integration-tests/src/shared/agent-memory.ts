import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import type { UIMessageWithMetadata } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig, CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { ToolCallFilter } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

export function getAgentMemoryTests({
  model,
  tools,
  reasoningModel,
}: {
  model: MastraModelConfig;
  tools: Record<string, any>;
  reasoningModel?: MastraModelConfig;
}) {
  const dbFile = 'file:mastra-agent.db';
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
        connectionUrl: dbFile,
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
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agent.generate('Tell me about cats', {
          threadId: thread1Id,
          resourceId,
        });
      } else {
        await agent.generateLegacy('Tell me about cats', {
          memory: {
            thread: thread1Id,
            resource: resourceId,
          },
        });
      }

      // Verify first thread has messages
      const thread1Messages = await memory.recall({ threadId: thread1Id, resourceId });
      expect(thread1Messages.messages.length).toBeGreaterThan(0);

      // Now create a second thread - this should be able to access memory from thread1
      // due to resource scope, even on the first message
      const thread2Id = randomUUID();

      let secondResponse;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        secondResponse = await agent.generate('What did we discuss about cats?', {
          threadId: thread2Id,
          resourceId,
        });
      } else {
        secondResponse = await agent.generateLegacy('What did we discuss about cats?', {
          memory: {
            thread: thread2Id,
            resource: resourceId,
          },
        });
      }

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
        connectionUrl: dbFile,
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
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
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
      } else {
        await agent.generateLegacy(
          [
            { role: 'user', content: 'First message' },
            { role: 'user', content: 'Second message' },
          ],
          {
            threadId,
            resourceId,
          },
        );
      }

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => {
          // Extract text from MastraDBMessage content.parts
          const textParts = m.content.parts?.filter((p: any) => p.type === 'text') || [];
          return textParts.map((p: any) => p.text).join('');
        });

      expect(userMessages).toEqual(expect.arrayContaining(['First message', 'Second message']));
    });

    it('should save assistant responses for both text and object output modes', async () => {
      const threadId = randomUUID();
      const resourceId = 'assistant-responses';
      // 1. Text mode
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agent.generate([{ role: 'user', content: 'What is 2+2?' }], {
          threadId,
          resourceId,
        });
      } else {
        await agent.generateLegacy([{ role: 'user', content: 'What is 2+2?' }], {
          threadId,
          resourceId,
        });
      }

      // 2. Object/output mode
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agent.generate([{ role: 'user', content: 'Give me JSON' }], {
          threadId,
          resourceId,
          structuredOutput: {
            schema: z.object({
              result: z.string(),
            }),
          },
        });
      } else {
        await agent.generateLegacy([{ role: 'user', content: 'Give me JSON' }], {
          threadId,
          resourceId,
          output: z.object({
            result: z.string(),
          }),
        });
      }

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });
      const userMessages = messages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content.parts?.find((p: any) => p.type === 'text')?.text || '');
      const assistantMessages = messages
        .filter((m: any) => m.role === 'assistant')
        .map((m: any) => m.content.parts?.find((p: any) => p.type === 'text')?.text || '');
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
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agent.generate(userMessageContent, {
          threadId,
          resourceId,
          context: [
            { role: 'system', content: contextMessageContent1 },
            { role: 'user', content: contextMessageContent2 },
          ],
        });
      } else {
        await agent.generateLegacy(userMessageContent, {
          threadId,
          resourceId,
          context: [
            { role: 'system', content: contextMessageContent1 },
            { role: 'user', content: contextMessageContent2 },
          ],
        });
      }

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      // Assert that the context messages are NOT saved
      const savedContextMessages = messages.filter((m: any) => {
        const text = m.content.parts?.find((p: any) => p.type === 'text')?.text || '';
        return text === contextMessageContent1 || text === contextMessageContent2;
      });

      expect(savedContextMessages.length).toBe(0);

      // Assert that the user message IS saved
      const savedUserMessages = messages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(1);
      const savedUserText = savedUserMessages[0].content.parts?.find((p: any) => p.type === 'text')?.text || '';
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

      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agent.generate(messagesWithMetadata, {
          threadId,
          resourceId,
        });
      } else {
        // Send messages with metadata
        await agent.generateLegacy(messagesWithMetadata, {
          threadId,
          resourceId,
        });
      }

      // Fetch messages from memory
      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      // Check that all user messages were saved
      const savedUserMessages = messages.filter((m: any) => m.role === 'user');
      expect(savedUserMessages.length).toBe(2);

      // Check that metadata was persisted in the stored messages
      const firstMessage = messages.find((m: any) => {
        const textContent = m.content?.parts?.find((p: any) => p.type === 'text')?.text;
        return textContent === 'Hello with metadata';
      });
      const secondMessage = messages.find((m: any) => {
        const textContent = m.content?.parts?.find((p: any) => p.type === 'text')?.text;
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
      const firstStoredMessage = messages.find((m: any) => {
        const textContent = m.content?.parts?.find((p: any) => p.type === 'text')?.text;
        return textContent === 'Hello with metadata';
      });
      const secondStoredMessage = messages.find((m: any) => {
        const textContent = m.content?.parts?.find((p: any) => p.type === 'text')?.text;
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

        let result;
        if (
          typeof reasoningModel === 'string' ||
          (reasoningModel &&
            'specificationVersion' in reasoningModel &&
            ['v2', 'v3'].includes(reasoningModel.specificationVersion))
        ) {
          result = await reasoningAgent.generate('What is 2+2? Think through this carefully.', {
            threadId,
            resourceId,
          });
        } else {
          result = await reasoningAgent.generateLegacy('What is 2+2? Think through this carefully.', {
            threadId,
            resourceId,
          });
        }

        expect((result as any).reasoning.length).toBeGreaterThan(0);
        expect((result as any).reasoningText).toBeDefined();
        expect((result as any).reasoningText!.length).toBeGreaterThan(0);

        const originalReasoningText = (result as any).reasoningText;

        const agentMemory = (await reasoningAgent.getMemory())!;
        const { messages } = await agentMemory.recall({ threadId });

        const assistantMessage = messages.find(
          (m: any) => m.role === 'assistant' && m.content.parts?.find((p: any) => p.type === 'reasoning'),
        );

        expect(assistantMessage).toBeDefined();

        const retrievedReasoningParts = assistantMessage?.content.parts?.filter((p: any) => p?.type === 'reasoning');

        expect(retrievedReasoningParts).toBeDefined();
        expect(retrievedReasoningParts?.length).toBeGreaterThan(0);

        const retrievedReasoningText = retrievedReasoningParts
          ?.map((p: any) => p.details?.map((d: any) => (d.type === 'text' ? d.text : '')).join('') || '')
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
      vector: new LibSQLVector({ connectionUrl: dbFile, id: 'test-vector' }),
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
      vector: new LibSQLVector({ connectionUrl: dbFile, id: 'test-vector' }),
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

      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agentWithTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
        await agentWithTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      } else {
        await agentWithTitle.generateLegacy([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
        await agentWithTitle.generateLegacy([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      }

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

      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agentWithDynamicModelTitle.generate([{ role: 'user', content: 'Hello, world!' }], {
          threadId,
          resourceId,
          requestContext,
        });
      } else {
        await agentWithDynamicModelTitle.generateLegacy([{ role: 'user', content: 'Hello, world!' }], {
          threadId,
          resourceId,
          requestContext,
        });
      }

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

      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await agentNoTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
        await agentNoTitle.generate([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      } else {
        await agentNoTitle.generateLegacy([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
        await agentNoTitle.generateLegacy([{ role: 'user', content: 'Hello, world!' }], { threadId, resourceId });
      }

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
        connectionUrl: dbFile,
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
      let firstResponse;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        firstResponse = await memoryProcessorAgent.generate('What is the weather in London?', {
          threadId,
          resourceId,
        });
      } else {
        firstResponse = await memoryProcessorAgent.generateLegacy('What is the weather in London?', {
          threadId,
          resourceId,
        });
      }

      // The response should contain the weather.
      expect(firstResponse.text).toContain('65');

      // Check that tool calls were saved to memory
      const agentMemory = (await memoryProcessorAgent.getMemory())!;
      const { messages: messagesFromMemory } = await agentMemory.recall({ threadId });
      const toolMessages = messagesFromMemory.filter(
        (m: any) => m.role === 'tool' || (m.role === 'assistant' && typeof m.content !== 'string'),
      );

      expect(toolMessages.length).toBeGreaterThan(0);

      // Now, ask a follow-up question. The processor should prevent the tool call history
      // from being sent to the model.
      let secondResponse;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        secondResponse = await memoryProcessorAgent.generate('What was the tool you just used?', {
          threadId,
          resourceId,
        });
      } else {
        secondResponse = await memoryProcessorAgent.generateLegacy('What was the tool you just used?', {
          threadId,
          resourceId,
        });
      }

      const requestBody =
        typeof secondResponse.request.body === 'string'
          ? JSON.parse(secondResponse.request.body)
          : secondResponse.request.body;
      // Legacy API uses 'messages', new API uses 'input'
      const secondResponseRequestMessages: CoreMessage[] = requestBody.messages || requestBody.input;

      // Verify no tool messages or tool results are in the request
      const toolOrToolResultMessages = secondResponseRequestMessages.filter(
        (m: any) => m.role === 'tool' || (m.role === 'assistant' && (m as any)?.tool_calls?.length > 0),
      );
      expect(toolOrToolResultMessages.length).toBe(0);

      // Should have at minimum: system (instructions) + user + assistant + user
      // Optionally: system (semantic recall) if embeddings completed in time
      expect(secondResponseRequestMessages.length).toBeGreaterThanOrEqual(4);

      // Verify message structure
      const systemMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'system');
      const userMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'user');
      const assistantMessages = secondResponseRequestMessages.filter((m: any) => m.role === 'assistant');

      // Should have 1-2 system messages (instructions + optional semantic recall)
      expect(systemMessages.length).toBeGreaterThanOrEqual(1);
      expect(systemMessages.length).toBeLessThanOrEqual(2);

      // Should have 2 user messages (first question + second question)
      expect(userMessages.length).toBe(2);

      // Should have 1 assistant message (response to first question, with tool calls filtered out)
      expect(assistantMessages.length).toBe(1);
    }, 30_000);

    it('should include working memory in LLM request when input processors run', async () => {
      const storage = new LibSQLStore({
        id: 'test-storage-wm',
        url: dbFile,
      });
      const vector = new LibSQLVector({
        connectionUrl: dbFile,
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
      let response;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        response = await agent.generate('What is my favorite color?', {
          threadId,
          resourceId,
        });
      } else {
        response = await agent.generateLegacy('What is my favorite color?', {
          threadId,
          resourceId,
        });
      }

      // Check the actual request body sent to the LLM
      const wmRequestBody =
        typeof response.request.body === 'string' ? JSON.parse(response.request.body) : response.request.body;
      // Legacy API uses 'messages', new API uses 'input'
      const requestMessages = wmRequestBody.messages || wmRequestBody.input;

      // Should have more than just the user message
      // Should include working memory system message + user message
      expect(requestMessages.length).toBeGreaterThan(1);

      // Should include a system message with working memory
      const workingMemoryMessage = requestMessages.find(
        (msg: any) => msg.role === 'system' && msg.content.includes('John Doe') && msg.content.includes('Blue'),
      );

      expect(workingMemoryMessage).toBeDefined();
      expect(workingMemoryMessage.content).toContain('John Doe');
      expect(workingMemoryMessage.content).toContain('Blue');

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
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await mockStoreAgent.generate(`What's the weather in Tokyo?`, {
          threadId: thread,
          resourceId: resource,
        });
      } else {
        await mockStoreAgent.generateLegacy(`What's the weather in Tokyo?`, {
          memory: { resource, thread },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Will throw if the messages sent to the agent aren't cleaned up because a tool call message will be the first message sent to the agent
      // Which some providers like gemini will not allow.
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        await expect(
          mockStoreAgent.generate(`What's the weather in London?`, {
            threadId: thread,
            resourceId: resource,
          }),
        ).resolves.not.toThrow();
      } else {
        await expect(
          mockStoreAgent.generateLegacy(`What's the weather in London?`, {
            memory: { resource, thread },
          }),
        ).resolves.not.toThrow();
      }
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
      let firstResponse;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        firstResponse = await inputProcessorAgent.generate('My name is Alice', {
          threadId,
          resourceId,
        });
      } else {
        firstResponse = await inputProcessorAgent.generateLegacy('My name is Alice', {
          threadId,
          resourceId,
        });
      }

      expect(firstResponse.text).toBeDefined();

      // Verify first message was saved
      const { messages: messagesAfterFirst } = await inputProcessorMemory.recall({ threadId });
      expect(messagesAfterFirst.length).toBe(2); // user + assistant

      // Second message - should include history from MessageHistory input processor
      let secondResponse;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        secondResponse = await inputProcessorAgent.generate('What is my name?', {
          threadId,
          resourceId,
        });
      } else {
        secondResponse = await inputProcessorAgent.generateLegacy('What is my name?', {
          threadId,
          resourceId,
        });
      }

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
        processOutputResult: async ({ messages, abort }: { messages: any[]; abort: (reason?: string) => never }) => {
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
      let result;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        result = await guardrailAgent.generate('Hello, save this message!', {
          threadId,
          resourceId,
        });
      } else {
        result = await guardrailAgent.generateLegacy('Hello, save this message!', {
          threadId,
          resourceId,
        });
      }

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
        processOutputResult: async ({ messages }: { messages: any[] }) => {
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
      let result;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        result = await passingGuardrailAgent.generate('Hello, save this message!', {
          threadId,
          resourceId,
        });
      } else {
        result = await passingGuardrailAgent.generateLegacy('Hello, save this message!', {
          threadId,
          resourceId,
        });
      }

      // Verify no tripwire
      expect(result.tripwire).toBeUndefined();

      // Verify messages WERE saved to memory
      const { messages } = await passingMemory.recall({ threadId });
      expect(messages.length).toBeGreaterThan(0);

      // Should have at least user message and assistant response
      const userMessages = messages.filter((m: any) => m.role === 'user');
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
      expect(userMessages.length).toBe(1);
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should NOT save messages when input guardrail aborts (before LLM call)', async () => {
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
        processInput: async ({ messages, abort }: { messages: any[]; abort: (reason?: string) => never }) => {
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
      let result;
      if (
        typeof model === 'string' ||
        ('specificationVersion' in model && ['v2', 'v3'].includes(model.specificationVersion))
      ) {
        result = await inputGuardrailAgent.generate('Hello, this should be blocked!', {
          threadId,
          resourceId,
        });
      } else {
        result = await inputGuardrailAgent.generateLegacy('Hello, this should be blocked!', {
          threadId,
          resourceId,
        });
      }

      // Verify the guardrail triggered
      expect(result.tripwire).toBeDefined();
      expect(result.tripwire?.reason).toBe('Input blocked by guardrail');

      // Verify NO messages were saved - LLM was never called, output processors never ran
      const { messages } = await inputGuardrailMemory.recall({ threadId });
      expect(messages.length).toBe(0);
    });
  });
}
