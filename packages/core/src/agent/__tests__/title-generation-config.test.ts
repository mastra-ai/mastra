import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger';
import { MockMemory } from '../../memory/mock';
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

    it('keeps title persistence alive via waitUntil without blocking generate (#20682)', async () => {
      // Title gen stays fire-and-forget so generate() is not slowed for serverless.
      // Callers pass platform waitUntil so the isolate stays alive until persistence finishes.
      let releaseTitleWrite: (() => void) | undefined;
      const titleWriteGate = new Promise<void>(resolve => {
        releaseTitleWrite = resolve;
      });
      let titlePersisted = false;

      const mockMemory = new MockMemory();
      mockMemory.getMergedThreadConfig = () => ({
        generateTitle: true,
      });

      const originalUpdateThread = mockMemory.updateThread.bind(mockMemory);
      mockMemory.updateThread = async args => {
        if (args.title) {
          await titleWriteGate;
          titlePersisted = true;
        }
        return originalUpdateThread(args);
      };

      let testModel: MockLanguageModelV1 | MockLanguageModelV2;

      if (version === 'v1') {
        testModel = new MockLanguageModelV1({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { promptTokens: 5, completionTokens: 10 },
                text: 'Serverless Safe Title',
              };
            }

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'Agent Response',
            };
          },
        });
      } else {
        testModel = new MockLanguageModelV2({
          doGenerate: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));

            if (isForTitle) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                text: 'Serverless Safe Title',
                content: [{ type: 'text', text: 'Serverless Safe Title' }],
                warnings: [],
              };
            }

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'Agent Response',
              content: [{ type: 'text', text: 'Agent Response' }],
              warnings: [],
            };
          },
          doStream: async options => {
            const messages = options.prompt;
            const isForTitle = messages.some((msg: any) => msg.content?.includes?.('you will generate a short title'));
            const text = isForTitle ? 'Serverless Safe Title' : 'Agent Response';

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: text },
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
      }

      const agent = new Agent({
        id: 'waituntil-title-agent',
        name: 'WaitUntil Title Agent',
        instructions: 'test agent',
        model: testModel,
        memory: mockMemory,
      });

      const threadId = `thread-waituntil-title-${version}`;
      const pending: Promise<unknown>[] = [];
      const waitUntil = (promise: Promise<unknown>) => {
        pending.push(promise);
      };

      if (version === 'v1') {
        // Legacy already awaits title generation inline — no waitUntil hook needed.
        releaseTitleWrite?.();
        await agent.generateLegacy('Name this conversation', {
          memory: {
            resource: 'user-await',
            thread: {
              id: threadId,
              title: '',
            },
          },
        });
        expect(titlePersisted).toBe(true);
      } else {
        await agent.generate('Name this conversation', {
          serverless: { waitUntil },
          memory: {
            resource: 'user-await',
            thread: {
              id: threadId,
              title: '',
            },
          },
        });

        // generate() must resolve without waiting on title persistence.
        expect(titlePersisted).toBe(false);
        expect(pending.length).toBe(1);

        releaseTitleWrite?.();
        await Promise.all(pending);
        expect(titlePersisted).toBe(true);
      }

      const thread = await mockMemory.getThreadById({ threadId });
      expect(thread?.title).toBe('Serverless Safe Title');
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
            }
            agentCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: `Agent Response`,
            };
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
            }
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
            }
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-undefined',
              title: '',
            },
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(titleGenerationCallCount).toBe(0); // No title generation should happen
      expect(agentCallCount).toBe(1); // But main agent should still be called
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

    it('should catch title persistence failures without causing an unhandled rejection', async () => {
      if (version !== 'v2') {
        return;
      }

      const titleText = 'Generated thread title';
      const mockMemory = new MockMemory();
      const originalUpdateThread = mockMemory.updateThread.bind(mockMemory);
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn().mockReturnValue(new Map()),
        listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
        listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
      };

      vi.spyOn(mockMemory, 'updateThread').mockImplementation(async args => {
        if (args.title === titleText) {
          throw new Error('sqlite write failed');
        }

        return originalUpdateThread(args);
      });

      const titleModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: titleText,
          content: [{ type: 'text', text: titleText }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: titleText },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
          ]),
        }),
      });

      mockMemory.getMergedThreadConfig = () => {
        return {
          generateTitle: {
            model: titleModel,
          },
        };
      };

      const agent = new Agent({
        id: 'title-persist-error-agent',
        name: 'Title Persist Error Agent',
        instructions: 'test agent',
        model: dummyModel,
        memory: mockMemory,
      });
      agent.__setLogger(logger as any);

      let unhandledReason: unknown = null;
      const onUnhandledRejection = (reason: unknown) => {
        unhandledReason = reason;
      };
      process.once('unhandledRejection', onUnhandledRejection);

      try {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-title-persist-error',
              title: '',
            },
          },
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      } finally {
        process.removeListener('unhandledRejection', onUnhandledRejection);
      }

      expect(unhandledReason).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error persisting generated title:',
        expect.objectContaining({ message: 'sqlite write failed' }),
      );

      const thread = await mockMemory.getThreadById({ threadId: 'thread-title-persist-error' });
      expect(thread).toBeDefined();
      expect(thread?.title).toBe('');
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: 'thread-empty-instructions',
              title: '',
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('Test message', {
          memory: {
            resource: 'user-2',
            thread: {
              id: 'thread-null-instructions',
              title: '',
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
            }
            agentCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'Agent Response',
            };
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
            }
            agentCallCount++;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'Agent Response',
              content: [{ type: 'text', text: 'Agent Response' }],
              warnings: [],
            };
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
            }
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
              title: '',
            },
          },
        });
      } else {
        await agent.generate('First message', {
          memory: {
            resource: 'user-1',
            thread: {
              id: threadId,
              title: '',
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
