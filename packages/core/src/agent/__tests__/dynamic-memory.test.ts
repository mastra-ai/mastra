import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

function dynamicMemoryTest(version: 'v1' | 'v2') {
  describe(`${version} - dynamic memory configuration`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Dummy response`,
        }),
      });
    } else {
      dummyModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stream: convertArrayToReadableStream([
            { type: 'text-delta', id: '1', delta: 'Dummy response' },
            {
              type: 'finish',
              id: '2',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          warnings: [],
        }),
      });
    }

    it('should support static memory configuration', async () => {
      const storage = new InMemoryStore();
      const mockMemory = new MockMemory({ storage });
      const agent = new Agent({
        id: 'static-memory-agent',
        name: 'Static Memory Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const memory = await agent.getMemory();
      expect(memory).toBe(mockMemory);
    });

    it('should support dynamic memory configuration with requestContext', async () => {
      const premiumMemory = new MockMemory({ storage: new InMemoryStore() });
      const standardMemory = new MockMemory({ storage: new InMemoryStore() });

      const agent = new Agent({
        id: 'dynamic-memory-agent',
        name: 'Dynamic Memory Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: ({ requestContext }) => {
          const userTier = requestContext.get('userTier');
          return userTier === 'premium' ? premiumMemory : standardMemory;
        },
      });

      // Test with premium context
      const premiumContext = new RequestContext();
      premiumContext.set('userTier', 'premium');
      const premiumResult = await agent.getMemory({ requestContext: premiumContext });
      expect(premiumResult).toBe(premiumMemory);

      // Test with standard context
      const standardContext = new RequestContext();
      standardContext.set('userTier', 'standard');
      const standardResult = await agent.getMemory({ requestContext: standardContext });
      expect(standardResult).toBe(standardMemory);
    });

    it('should support async dynamic memory configuration', async () => {
      const mockMemory = new MockMemory({ storage: new InMemoryStore() });

      const agent = new Agent({
        id: 'async-memory-agent',
        name: 'Async Memory Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: async ({ requestContext }) => {
          const userId = requestContext.get('userId') as string;
          // Simulate async memory creation/retrieval
          await new Promise(resolve => setTimeout(resolve, 10));

          await mockMemory.createThread({
            resourceId: userId,
            threadId: `user-${userId}`,
          });

          return mockMemory;
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user123');

      const memory = await agent.getMemory({ requestContext });
      expect(memory).toBe(mockMemory);
      const thread = await mockMemory.getThreadById({ threadId: `user-user123` });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user123');
    });

    it('should throw error when dynamic memory function returns empty value', async () => {
      const agent = new Agent({
        id: 'invalid-memory-agent',
        name: 'Invalid Memory Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: () => null as any,
      });

      await expect(agent.getMemory()).rejects.toThrow('Function-based memory returned empty value');
    });

    it('should work with memory in generate method with dynamic configuration', async () => {
      const mockMemory = new MockMemory({ storage: new InMemoryStore() });

      const agent = new Agent({
        id: 'generate-memory-agent',
        name: 'Generate Memory Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: ({ requestContext }) => {
          const environment = requestContext.get('environment');
          if (environment === 'test') {
            return mockMemory;
          }
          // Return a default mock memory instead of undefined
          return new MockMemory({ storage: new InMemoryStore() });
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('environment', 'test');

      let response;
      if (version === 'v1') {
        response = await agent.generateLegacy('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
            },
          },
          requestContext,
        });
      } else {
        response = await agent.generate('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
            },
          },
          requestContext,
        });
      }

      expect(response.text).toBe('Dummy response');

      // Verify that thread was created in memory
      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
    });

    it('should work with memory in stream method with dynamic configuration', async () => {
      const storage = new InMemoryStore();
      const mockMemory = new MockMemory({ storage });

      let model;
      if (version === 'v1') {
        model = new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Dynamic' },
                { type: 'text-delta', textDelta: ' memory' },
                { type: 'text-delta', textDelta: ' response' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        model = new MockLanguageModelV2({
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              {
                type: 'stream-start',
                warnings: [],
              },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Dynamic' },
              { type: 'text-delta', id: '1', delta: ' memory' },
              { type: 'text-delta', id: '1', delta: ' response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        });
      }

      const agent = new Agent({
        id: 'stream-memory-agent',
        name: 'Stream Memory Agent',
        instructions: 'test agent',
        model,
        memory: ({ requestContext }) => {
          const enableMemory = requestContext.get('enableMemory');
          return enableMemory ? mockMemory : new MockMemory({ storage: new InMemoryStore() });
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('enableMemory', true);

      let stream;

      if (version === 'v1') {
        stream = await agent.streamLegacy('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-stream',
            },
          },
          requestContext,
        });
      } else {
        stream = await agent.stream('test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-stream',
            },
          },
          requestContext,
        });
      }

      let finalText = '';
      for await (const textPart of stream.textStream) {
        finalText += textPart;
      }

      expect(finalText).toBe('Dynamic memory response');

      // Verify that thread was created in memory
      const thread = await mockMemory.getThreadById({ threadId: 'thread-stream' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
    });

    it('should preserve system messages from user input when memory is enabled', async () => {
      const storage = new InMemoryStore();
      const mockMemory = new MockMemory({ storage });

      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response with jokes! Super!!!!',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Test response with jokes! Super!!!!' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-message-test-agent',
        name: 'System Message Test Agent',
        instructions: 'You are a test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        await agent.generateLegacy(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
      } else {
        await agent.generate(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
      }

      // Check if system message from user input is preserved in the final prompt
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input when memory is enabled (stream)', async () => {
      const storage = new InMemoryStore();
      const mockMemory = new MockMemory({ storage });
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-delta', textDelta: 'Test response with jokes! Super!!!!' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-message-test-agent-stream',
        name: 'System Message Test Agent Stream',
        instructions: 'You are a test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        const stream = await agent.streamLegacy(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }
      } else {
        const stream = await agent.stream(testMessages, {
          threadId: 'test-thread',
          resourceId: 'test-resource',
          runId: 'test-run',
        });
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.fullStream) {
          // Just consume the stream
        }
      }

      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input without memory (stream)', async () => {
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-delta', textDelta: 'Test response with jokes! Super!!!!' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id-3',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-message-test-agent-stream-no-memory',
        name: 'System Message Test Agent Stream No Memory',
        instructions: 'You are a test agent',
        model: dummyModel,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        const stream = await agent.streamLegacy(testMessages);
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.textStream) {
          // Just consume the stream
        }
      } else {
        const stream = await agent.stream(testMessages);
        // Consume the stream to trigger the model call
        for await (const _chunk of stream.fullStream) {
          // Just consume the stream
        }
      }

      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should preserve system messages from user input without memory', async () => {
      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response with jokes! Super!!!!',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Test response with jokes! Super!!!!' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                {
                  type: 'stream-start',
                  warnings: [],
                },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id-2',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response with jokes! Super!!!!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-message-test-agent-no-memory',
        name: 'System Message Test Agent No Memory',
        instructions: 'You are a test agent',
        model: dummyModel,
      });

      const testMessages = [
        {
          role: 'user' as const,
          content: 'Hello, my name is John',
        },
        {
          role: 'system' as const,
          content: 'You always put jokes in your conversation and also always say Super!!!!',
        },
      ];

      if (version === 'v1') {
        await agent.generateLegacy(testMessages);
      } else {
        await agent.generate(testMessages);
      }

      // Check if system message from user input is preserved in the final prompt
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const userSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You always put jokes in your conversation'),
      );

      expect(userSystemMessage).toBeDefined();
      expect(userSystemMessage?.content).toContain(
        'You always put jokes in your conversation and also always say Super!!!!',
      );
    });

    it('should support system option in generate method', async () => {
      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Test response' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-option-generate-test',
        name: 'System Option Generate Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test generate with system option
      if (version === 'v1') {
        await agent.generateLegacy('Hello', {
          system: 'You must respond in JSON format',
        });
      } else {
        await agent.generate('Hello', {
          system: 'You must respond in JSON format',
        });
      }

      // Check if system message from option was added
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const customSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('You must respond in JSON format'),
      );

      expect(customSystemMessage).toBeDefined();
      expect(customSystemMessage?.content).toContain('You must respond in JSON format');
    });

    it('should support system option in stream method', async () => {
      // Mock the LLM to capture what messages it receives
      let capturedMessages: any[] = [];
      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Test response',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: 'text-delta', textDelta: 'Test response' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { promptTokens: 10, completionTokens: 5 },
                  },
                ],
              }),
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Test response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'system-option-stream-test',
        name: 'System Option Stream Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test stream with system option
      if (version === 'v1') {
        const streamResult = await agent.streamLegacy('Hello', {
          system: 'Always be concise',
        });
        // Properly consume the v1 stream
        for await (const _chunk of streamResult.textStream) {
          // Just consume the stream
        }
      } else {
        const streamResult = await agent.stream('Hello', {
          system: 'Always be concise',
        });
        await streamResult.getFullOutput(); // Consume the stream
      }

      // Check if system message from option was added
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const customSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('Always be concise'),
      );

      expect(customSystemMessage).toBeDefined();
      expect(customSystemMessage?.content).toContain('Always be concise');
    });

    it('should work with both instructions override and system option', async () => {
      let capturedMessages: any[] = [];
      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              text: 'Response',
              usage: { promptTokens: 10, completionTokens: 5 },
              finishReason: 'stop',
              rawCall: { rawPrompt: [], rawSettings: {} },
            };
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              content: [{ type: 'text', text: 'Response' }],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            capturedMessages = prompt;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'mock-response-id',
                  modelId: 'mock-model-v2',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Response' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'combined-test-agent',
        name: 'Combined Test Agent',
        instructions: 'Default instructions',
        model: testModel,
      });

      if (version === 'v1') {
        await agent.generateLegacy('Hello', {
          instructions: 'Override instructions',
          system: 'Additional system context',
        });
      } else {
        await agent.generate('Hello', {
          instructions: 'Override instructions',
          system: 'Additional system context',
        });
      }

      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const allSystemContent = systemMessages.map(m => m.content).join(' ');

      expect(allSystemContent).toContain('Override instructions');
      expect(allSystemContent).toContain('Additional system context');
    });

    it('should support CoreSystemMessage object in generate method', async () => {
      // Skip this test for v1 as it only applies to VNext methods
      if (version === 'v1') {
        return;
      }

      let capturedMessages: any[] = [];
      const testModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            content: [{ type: 'text', text: 'Test response' }],
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            finishReason: 'stop',
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'mock-response-id',
                modelId: 'mock-model-v2',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Test response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'core-system-message-test',
        name: 'Core System Message Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test with CoreSystemMessage object
      await agent.generate('Hello', {
        system: {
          role: 'system',
          content: 'You are a helpful assistant that responds in JSON format',
        },
      });

      // Check if system message was properly added
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const jsonSystemMessage = systemMessages.find(
        m =>
          typeof m.content === 'string' &&
          m.content.includes('You are a helpful assistant that responds in JSON format'),
      );

      expect(jsonSystemMessage).toBeDefined();
      expect(jsonSystemMessage?.content).toBe('You are a helpful assistant that responds in JSON format');
    });

    it('should support SystemModelMessage object in stream method', async () => {
      // Skip this test for v1 as it only applies to VNext methods
      if (version === 'v1') {
        return;
      }

      let capturedMessages: any[] = [];
      const testModel = new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'mock-response-id',
                modelId: 'mock-model-v2',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Test' },
              { type: 'text-delta', id: '1', delta: ' response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'system-model-message-stream-test',
        name: 'System Model Message Stream Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test with SystemModelMessage object (AI SDK v5 format)
      const result = await agent.stream('Hello', {
        system: {
          role: 'system',
          content: 'You are an expert programmer who provides detailed explanations',
        },
      });

      // Consume the stream
      const fullContent = await result.textStream;
      for await (const _chunk of fullContent) {
        // Just consume the stream
      }

      // Check if system message was properly handled
      const systemMessages = capturedMessages.filter(m => m.role === 'system');
      const expertSystemMessage = systemMessages.find(
        m =>
          typeof m.content === 'string' &&
          m.content.includes('You are an expert programmer who provides detailed explanations'),
      );

      expect(expertSystemMessage).toBeDefined();
    });

    it('should handle mixed system message types correctly', async () => {
      // Skip this test for v1 as it only applies to VNext methods
      if (version === 'v1') {
        return;
      }

      let capturedMessages: any[] = [];
      const testModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            content: [{ type: 'text', text: 'Test response' }],
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            finishReason: 'stop',
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'mock-response-id',
                modelId: 'mock-model-v2',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Test response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'mixed-system-test',
        name: 'Mixed System Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test 1: String system message
      capturedMessages = [];
      await agent.generate('Test 1', {
        system: 'String system message',
      });
      let systemMessages = capturedMessages.filter(m => m.role === 'system');
      let customSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('String system message'),
      );
      expect(customSystemMessage).toBeDefined();

      // Test 2: CoreSystemMessage object
      capturedMessages = [];
      await agent.generate('Test 2', {
        system: {
          role: 'system',
          content: 'CoreSystemMessage content',
        },
      });
      systemMessages = capturedMessages.filter(m => m.role === 'system');
      customSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('CoreSystemMessage content'),
      );
      expect(customSystemMessage).toBeDefined();

      // Test 3: SystemModelMessage with string content
      capturedMessages = [];
      await agent.generate('Test 3', {
        system: {
          role: 'system',
          content: 'SystemModelMessage with full string content',
        },
      });
      systemMessages = capturedMessages.filter(m => m.role === 'system');
      customSystemMessage = systemMessages.find(
        m => typeof m.content === 'string' && m.content.includes('SystemModelMessage with full string content'),
      );
      expect(customSystemMessage).toBeDefined();
    });

    it('should support arrays of system messages', async () => {
      // Skip this test for v1 as it only applies to VNext methods
      if (version === 'v1') {
        return;
      }

      let capturedMessages: any[] = [];
      const testModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            content: [{ type: 'text', text: 'Test response' }],
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            finishReason: 'stop',
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          capturedMessages = prompt;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'mock-response-id',
                modelId: 'mock-model-v2',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Test response' },
              { type: 'text-end', id: '1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        },
      });

      const agent = new Agent({
        id: 'array-system-test',
        name: 'Array System Test',
        instructions: 'Default instructions',
        model: testModel,
      });

      // Test 1: Array of strings
      capturedMessages = [];
      await agent.generate('Test string array', {
        system: ['First string message', 'Second string message', 'Third string message'],
      });

      let systemMessages = capturedMessages.filter(m => m.role === 'system');
      let hasFirst = systemMessages.some(
        m => typeof m.content === 'string' && m.content.includes('First string message'),
      );
      let hasSecond = systemMessages.some(
        m => typeof m.content === 'string' && m.content.includes('Second string message'),
      );
      let hasThird = systemMessages.some(
        m => typeof m.content === 'string' && m.content.includes('Third string message'),
      );

      expect(hasFirst).toBe(true);
      expect(hasSecond).toBe(true);
      expect(hasThird).toBe(true);

      // Test 2: Array of CoreSystemMessage objects
      capturedMessages = [];
      await agent.generate('Test object array', {
        system: [
          { role: 'system', content: 'First system message' },
          { role: 'system', content: 'Second system message' },
          { role: 'system', content: 'Third system message' },
        ],
      });

      systemMessages = capturedMessages.filter(m => m.role === 'system');
      hasFirst = systemMessages.some(m => typeof m.content === 'string' && m.content.includes('First system message'));
      hasSecond = systemMessages.some(
        m => typeof m.content === 'string' && m.content.includes('Second system message'),
      );
      hasThird = systemMessages.some(m => typeof m.content === 'string' && m.content.includes('Third system message'));

      expect(hasFirst).toBe(true);
      expect(hasSecond).toBe(true);
      expect(hasThird).toBe(true);
    });
  });
}

dynamicMemoryTest('v1');
dynamicMemoryTest('v2');
