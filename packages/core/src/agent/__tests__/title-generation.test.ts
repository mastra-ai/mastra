import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { noopLogger } from '../../logger';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

function titleGenerationTests(version: 'v1' | 'v2') {
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'Dummy response',
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    } else {
      dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Dummy response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
    }
  });

  describe(`${version} - title generation`, () => {
    it('should use custom model for title generation when provided in generateTitle config', async () => {
      // Track which model was used for title generation
      let titleModelUsed = false;
      let agentModelUsed = false;

      let agentModel;
      let titleModel;

      if (version === 'v1') {
        // Create a mock model for the agent's main model
        agentModel = new MockLanguageModelV1({
          doGenerate: async () => {
            agentModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: `Agent model response`,
            };
          },
        });

        titleModel = new MockLanguageModelV1({
          doGenerate: async () => {
            titleModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Custom Title Model Response`,
            };
          },
        });
      } else {
        agentModel = new MockLanguageModelV2({
          doGenerate: async () => {
            agentModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: `Agent model response`,
              content: [
                {
                  type: 'text',
                  text: `Agent model response`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            agentModelUsed = true;
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Agent model response' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          },
        });

        titleModel = new MockLanguageModelV2({
          doGenerate: async () => {
            titleModelUsed = true;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Custom Title Model Response`,
              content: [
                {
                  type: 'text',
                  text: `Custom Title Model Response`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            titleModelUsed = true;
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Custom Title Model Response' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Create memory with generateTitle config using custom model
      const mockMemory = new MockMemory();

      // Override getMergedThreadConfig to return our test config
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
          },
        };
      };

      const agent = new Agent({
        id: 'title-test-agent',
        name: 'Title Test Agent',
        instructions: 'test agent for title generation',
        model: agentModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        // Generate a response that will trigger title generation
        await agent.generateLegacy('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-1',
              title: 'New Thread 2024-01-01T00:00:00.000Z', // Starts with "New Thread" to trigger title generation
            },
          },
        });
      }

      // The agent's main model should have been used for the response
      expect(agentModelUsed).toBe(true);

      // Give some time for the async title generation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // The custom title model should have been used for title generation
      expect(titleModelUsed).toBe(true);

      // Verify the thread was created
      const thread = await mockMemory.getThreadById({ threadId: 'thread-1' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
      expect(thread?.title).toBe('Custom Title Model Response');
    });

    it('should support dynamic model selection for title generation', async () => {
      let usedModelName = '';

      // Create two different models
      let premiumModel: MockLanguageModelV1 | MockLanguageModelV2;
      let standardModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        premiumModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Premium Title`,
            };
          },
        });

        standardModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Standard Title`,
            };
          },
        });
      } else {
        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Standard Title`,
              content: [
                {
                  type: 'text',
                  text: `Standard Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'standard';
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Standard Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const mockMemory = new MockMemory();

      // Override getMergedThreadConfig to return dynamic model selection
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: ({ requestContext }: { requestContext: RequestContext }) => {
              const userTier = requestContext.get('userTier');
              return userTier === 'premium' ? premiumModel : standardModel;
            },
          },
        };
      };

      const agent = new Agent({
        id: 'dynamic-title-test-agent',
        name: 'Dynamic Title Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      // Generate with premium context
      const requestContext = new RequestContext();
      requestContext.set('userTier', 'premium');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-premium',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('premium');

      // Reset and test with standard tier
      usedModelName = '';
      const standardContext = new RequestContext();
      standardContext.set('userTier', 'standard');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: standardContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-standard',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: standardContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('standard');
    });

    it('should allow agent model to be updated', async () => {
      let usedModelName = '';

      // Create two different models
      let premiumModel: MockLanguageModelV1 | MockLanguageModelV2;
      let standardModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        premiumModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Premium Title`,
            };
          },
        });

        standardModel = new MockLanguageModelV1({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Standard Title`,
            };
          },
        });
      } else {
        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Standard Title`,
              content: [
                {
                  type: 'text',
                  text: `Standard Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'standard';
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Standard Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      const agent = new Agent({
        id: 'update-model-agent',
        name: 'Update Model Agent',
        instructions: 'test agent',
        model: standardModel,
      });

      if (version === 'v1') {
        await agent.generateLegacy('Test message');
      } else {
        await agent.generate('Test message');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('standard');

      agent.__updateModel({ model: premiumModel });
      usedModelName = '';

      if (version === 'v1') {
        await agent.generateLegacy('Test message');
      } else {
        await agent.generate('Test message');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedModelName).toBe('premium');
    });

    it('should handle boolean generateTitle config for backward compatibility', async () => {
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;

      const mockMemory = new MockMemory();

      // Test with generateTitle: true
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: true,
        };
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `Generated Title`,
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: `Agent Response`,
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `Generated Title`,
                content: [
                  {
                    type: 'text',
                    text: `Generated Title`,
                  },
                ],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: `Agent Response`,
                content: [
                  {
                    type: 'text',
                    text: `Agent Response`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Generated Title' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              agentCallCount++;
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Agent Response' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });
      }

      const agent = new Agent({
        id: 'boolean-title-agent',
        name: 'Boolean Title Agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-bool',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(1);

      // Test with generateTitle: false
      titleGenerationCallCount = 0;
      agentCallCount = 0;
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: false,
        };
      };

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-bool-false',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(0); // No title generation should happen
      expect(agentCallCount).toBe(1); // But main agent should still be called
    });

    it('should not generate title for pre-created threads (thread already exists)', async () => {
      // Pre-created threads already exist in the DB, so threadExists is true.
      // Title generation only fires when the thread is newly created by the agent.
      // If apps pre-create threads for URL routing, they should set the title themselves.
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;

      const mockMemory = new MockMemory();

      // Pre-create the thread (simulating client SDK pre-creation)
      const customTitle = 'New Chat';
      const threadId = 'pre-created-thread-custom-title';
      await mockMemory.saveThread({
        thread: {
          id: threadId,
          title: customTitle,
          resourceId: 'user-123',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      });

      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: true,
        };
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: 'Help with coding project',
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: 'Agent Response',
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: 'Help with coding project',
                content: [{ type: 'text', text: 'Help with coding project' }],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: 'Agent Response',
                content: [{ type: 'text', text: 'Agent Response' }],
                warnings: [],
              };
            }
          },
        });
      }

      const agent = new Agent({
        id: 'pre-created-thread-agent',
        name: 'Pre-created Thread Agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      // Send first message to the pre-created thread
      if (version === 'v1') {
        await agent.generateLegacy('Help me with my coding project', {
          memory: {
            resource: 'user-123',
            thread: threadId,
          },
        });
      } else {
        await agent.generate('Help me with my coding project', {
          memory: {
            resource: 'user-123',
            thread: threadId,
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Title generation should NOT trigger because the thread already existed
      expect(titleGenerationCallCount).toBe(0);
      expect(agentCallCount).toBe(1);

      // Thread should keep its original title
      const thread = await mockMemory.getThreadById({ threadId });
      expect(thread?.title).toBe(customTitle);
    });

    it('should handle errors in title generation gracefully', async () => {
      const mockMemory = new MockMemory();

      // Pre-create the thread with the expected title
      const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
      await mockMemory.saveThread({
        thread: {
          id: 'thread-error',
          title: originalTitle,
          resourceId: 'user-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      });

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doGenerate: async () => {
            throw new Error('Title generation failed');
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw new Error('Title generation failed');
          },
          doStream: async () => {
            throw new Error('Title generation failed');
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: errorModel,
          },
        };
      };

      const agent = new Agent({
        id: 'error-title-agent',
        name: 'Error Title Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });
      agent.__setLogger(noopLogger);

      // This should not throw, title generation happens async
      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-error',
              title: originalTitle,
            },
          },
        });
      }

      // Give time for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Thread should still exist with the original title (preserved when generation fails)
      const thread = await mockMemory.getThreadById({ threadId: 'thread-error' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe(originalTitle);
    });

    it('should not generate title when config is undefined or null', async () => {
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;
      const mockMemory = new MockMemory();

      // Test with undefined config
      mockMemory.getMergedThreadConfig = () => {
        return {};
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `Should not be called`,
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: `Agent Response`,
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `Should not be called`,
                content: [
                  {
                    type: 'text',
                    text: `Should not be called`,
                  },
                ],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: `Agent Response`,
                content: [
                  {
                    type: 'text',
                    text: `Agent Response`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            // Check if this is for title generation based on the prompt
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Should not be called' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              agentCallCount++;
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Agent Response' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });
      }

      const agent = new Agent({
        id: 'undefined-config-agent',
        name: 'Undefined Config Agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(0); // No title generation should happen
      expect(agentCallCount).toBe(1); // But main agent should still be called
    });

    it('should support dynamic instructions selection for title generation', async () => {
      let capturedPrompt = '';
      let usedLanguage = '';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `日本語のタイトル`,
              };
            } else {
              usedLanguage = 'en';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: `English Title`,
              };
            }
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `日本語のタイトル`,
                content: [
                  {
                    type: 'text',
                    text: `日本語のタイトル`,
                  },
                ],
                warnings: [],
              };
            } else {
              usedLanguage = 'en';
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: `English Title`,
                content: [
                  {
                    type: 'text',
                    text: `English Title`,
                  },
                ],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }

            if (capturedPrompt.includes('簡潔なタイトル')) {
              usedLanguage = 'ja';
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: '日本語のタイトル' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              usedLanguage = 'en';
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
                    id: 'id-0',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'English Title' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            }
          },
        });
      }

      // Override getMergedThreadConfig to return dynamic instructions selection
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
            instructions: ({ requestContext }: { requestContext: RequestContext }) => {
              const language = requestContext.get('language');
              return language === 'ja'
                ? '会話内容に基づいて簡潔なタイトルを生成してください'
                : 'Generate a concise title based on the conversation';
            },
          },
        };
      };

      const agent = new Agent({
        id: 'dynamic-instructions-agent',
        name: 'Dynamic Instructions Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      // Test with Japanese context
      const japaneseContext = new RequestContext();
      japaneseContext.set('language', 'ja');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: japaneseContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-ja',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: japaneseContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedLanguage).toBe('ja');
      expect(capturedPrompt).toContain('簡潔なタイトル');

      // Reset and test with English context
      capturedPrompt = '';
      usedLanguage = '';
      const englishContext = new RequestContext();
      englishContext.set('language', 'en');

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: englishContext,
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-en',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
          requestContext: englishContext,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(usedLanguage).toBe('en');
      expect(capturedPrompt).toContain('Generate a concise title based on the conversation');
    });

    it('should use custom instructions for title generation when provided in generateTitle config', async () => {
      let capturedPrompt = '';
      const customInstructions = 'Generate a creative and engaging title based on the conversation';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Creative Custom Title`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Creative Custom Title`,
              content: [
                {
                  type: 'text',
                  text: `Creative Custom Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            // Capture the prompt to verify custom instructions are used
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Creative Custom Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Override getMergedThreadConfig to return our test config with custom instructions
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
            instructions: customInstructions,
          },
        };
      };

      const agent = new Agent({
        id: 'custom-instructions-test-agent',
        name: 'Custom Instructions Test Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('What is the weather like today?', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-custom-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      // Give some time for the async title generation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the custom instructions were used
      expect(capturedPrompt).toBe(customInstructions);

      // Verify the thread was updated with the custom title
      const thread = await mockMemory.getThreadById({ threadId: 'thread-custom-instructions' });
      expect(thread).toBeDefined();
      expect(thread?.resourceId).toBe('user-1');
      expect(thread?.title).toBe('Creative Custom Title');
    });

    it('should use default instructions when instructions config is undefined', async () => {
      let capturedPrompt = '';

      const mockMemory = new MockMemory();

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Default Title`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Default Title`,
              content: [
                {
                  type: 'text',
                  text: `Default Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Default Title' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
            // instructions field is intentionally omitted
          },
        };
      };

      const agent = new Agent({
        id: 'default-instructions-test-agent',
        name: 'Default Instructions Test Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-default',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used
      expect(capturedPrompt).toContain('you will generate a short title');
      expect(capturedPrompt).toContain('ensure it is not more than 80 characters long');

      const thread = await mockMemory.getThreadById({ threadId: 'thread-default' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe('Default Title');
    });

    it('should handle errors in dynamic instructions gracefully', async () => {
      const mockMemory = new MockMemory();

      // Pre-create the thread with the expected title
      const originalTitle = 'New Thread 2024-01-01T00:00:00.000Z';
      await mockMemory.saveThread({
        thread: {
          id: 'thread-instructions-error',
          title: originalTitle,
          resourceId: 'user-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      });

      let titleModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel = new MockLanguageModelV1({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with error handling`,
            };
          },
        });
      } else {
        titleModel = new MockLanguageModelV2({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with error handling`,
              content: [
                {
                  type: 'text',
                  text: `Title with error handling`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with error handling' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
            instructions: () => {
              throw new Error('Instructions selection failed');
            },
          },
        };
      };

      const agent = new Agent({
        id: 'error-instructions-test-agent',
        name: 'Error Instructions Test Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });
      agent.__setLogger(noopLogger);

      // This should not throw, title generation happens async
      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-instructions-error',
              title: originalTitle,
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-instructions-error',
              title: originalTitle,
            },
          },
        });
      }

      // Give time for async title generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Thread should still exist with the original title (preserved when generation fails)
      const thread = await mockMemory.getThreadById({ threadId: 'thread-instructions-error' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe(originalTitle);
    });

    it('should handle empty or null instructions appropriately', async () => {
      let capturedPrompt = '';

      const mockMemory = new MockMemory();

      let titleModel1: MockLanguageModelV1 | MockLanguageModelV2;
      let titleModel2: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        titleModel1 = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with default instructions`,
            };
          },
        });

        titleModel2 = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 10 },
              text: `Title with null instructions`,
            };
          },
        });
      } else {
        titleModel1 = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with default instructions`,
              content: [
                {
                  type: 'text',
                  text: `Title with default instructions`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with default instructions' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        titleModel2 = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Title with null instructions`,
              content: [
                {
                  type: 'text',
                  text: `Title with null instructions`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const systemMessage = messages.find((msg: any) => msg.role === 'system');
            if (systemMessage) {
              capturedPrompt =
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content);
            }
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
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Title with null instructions' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });
      }

      // Test with empty string instructions
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel1,
            instructions: '', // Empty string
          },
        };
      };

      const agent = new Agent({
        id: 'empty-instructions-test-agent',
        name: 'Empty Instructions Test Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });

      agent.__setLogger(noopLogger);

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used when empty string was provided
      expect(capturedPrompt).toContain('you will generate a short title');

      // Test with null instructions (via dynamic function)
      capturedPrompt = '';
      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel2,
            instructions: () => '', // Function returning empty string
          },
        };
      };

      if (version === 'v1') {
        await agent.generateLegacy('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: 'New Thread 2024-01-01T00:00:00.000Z',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that default instructions were used when null was returned
      expect(capturedPrompt).toContain('you will generate a short title');
    });

    it('should not generate title on subsequent messages when lastMessages is disabled', async () => {
      // This test validates the fix for the bug where generateTitle fires on every turn
      // when MessageHistory is not loaded (e.g., lastMessages is disabled).
      // The fix uses threadExists instead of remembered.db() to determine first turn.
      //
      // Root cause: when lastMessages is false, the MessageHistory processor is not added,
      // so messageList.get.remembered.db() always returns empty, making the old
      // isFirstUserMessage check always true.
      let titleGenerationCallCount = 0;
      let agentCallCount = 0;

      const mockMemory = new MockMemory();

      // Directly set threadConfig to disable lastMessages and enable generateTitle.
      // We can't use enableMessageHistory: false because undefined gets lost in deepMerge
      // with the default lastMessages: 10. We need lastMessages: false to properly disable it.
      (mockMemory as any).threadConfig = { lastMessages: false, generateTitle: true };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: 'Generated Title',
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                text: 'Agent Response',
              };
            }
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: 'Generated Title',
                content: [{ type: 'text', text: 'Generated Title' }],
                warnings: [],
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: 'Agent Response',
                content: [{ type: 'text', text: 'Agent Response' }],
                warnings: [],
              };
            }
          },
          doStream: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              titleGenerationCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Generated Title' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                  },
                ]),
              };
            } else {
              agentCallCount++;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Agent Response' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });
      }

      const agent = new Agent({
        id: 'no-message-history-title-agent',
        name: 'No Message History Title Agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      const threadId = 'thread-no-history';

      // First call - should generate title
      if (version === 'v1') {
        await agent.generateLegacy('First message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: threadId,
              title: 'New Thread',
            },
          },
        });
      } else {
        await agent.generate('First message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: threadId,
              title: 'New Thread',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(1);
      expect(agentCallCount).toBe(1);

      // Second call to the same thread - should NOT generate title again
      if (version === 'v1') {
        await agent.generateLegacy('Second message', {
          memory: {
            resource: 'user-1',
            thread: threadId,
          },
        });
      } else {
        await agent.generate('Second message', {
          memory: {
            resource: 'user-1',
            thread: threadId,
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(1);
      expect(agentCallCount).toBe(2);

      // Verify the thread has the generated title
      const thread = await mockMemory.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe('Generated Title');
    });
  });
}

titleGenerationTests('v1');
titleGenerationTests('v2');
