import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

// These cases need provider behaviour an HTTP mock cannot produce: error objects whose
// identity, cause and custom properties must survive unchanged, an `error` part after a
// completed `text-end`, an error chunk followed by a clean finish, and a provider that
// keeps streaming after cancellation. They use MockLanguageModelV2 for that reason.
// Wire-level failures and persistence across engines live in the persistence-* and
// on-error-callback aimock scenarios.
describe('agent error surfaces', () => {
  describe('terminal error persistence', () => {
    /** Streams one text part, then fails terminally with no recovery available. */
    function createPartialThenErrorModel(errorMessage: string) {
      const error = new Error(errorMessage);
      return new MockLanguageModelV2({
        doGenerate: async () => {
          throw error;
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'partial answer' },
            { type: 'text-end', id: 'text-1' },
            { type: 'error' as const, error },
          ]),
        }),
      });
    }

    function errorPartsIn(messages: MastraDBMessage[]) {
      return messages.flatMap(message => (message.content?.parts ?? []).filter(part => part.type === 'error'));
    }

    async function recallAll(mockMemory: MockMemory, thread: string, resource: string) {
      const result = await mockMemory.recall({ threadId: thread, resourceId: resource });
      return result?.messages ?? [];
    }

    it('appends the error part after the partial parts of the same assistant message', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'partial-terminal-error-agent',
        name: 'Partial Terminal Error Agent',
        instructions: 'test',
        model: createPartialThenErrorModel('stream broke'),
        memory: mockMemory,
        // Terminal-error persistence is the subject; no processor-level retry layer, which would
        // start another step before the error part is appended.
        errorProcessorDefaults: false,
      });

      const result = await agent.stream('tell me something', {
        memory: { thread: 'thread-partial-error', resource: 'resource-partial-error' },
        modelSettings: { maxRetries: 0 },
      });
      for await (const _chunk of result.fullStream) {
        // drain so the run reaches its terminal error path
      }

      const messages = await recallAll(mockMemory, 'thread-partial-error', 'resource-partial-error');

      expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
      expect(messages[1].content.parts.map(part => part.type)).toEqual(['text', 'error']);
      expect(messages[1].content.parts.find(part => part.type === 'text')).toMatchObject({
        text: 'partial answer',
      });
      expect(errorPartsIn(messages)).toEqual([
        { type: 'error', error: { name: 'Error', message: 'stream broke' }, createdAt: expect.any(Number) },
      ]);
    });

    it('keeps partial parts and the error part on one record after a retry-budget-exhausted id rotation', async () => {
      const mockMemory = new MockMemory();
      let rotations = 0;

      const agent = new Agent({
        id: 'rotating-terminal-error-agent',
        name: 'Rotating Terminal Error Agent',
        instructions: 'test',
        model: createPartialThenErrorModel('stream broke'),
        memory: mockMemory,
        maxProcessorRetries: 2,
        errorProcessors: [
          {
            id: 'rotate-then-exhaust',
            name: 'Rotate then exhaust the budget',
            processAPIError: async ({ rotateResponseMessageId, retryCount }) => {
              rotations += 1;
              rotateResponseMessageId();
              // Retry once, then run out of budget so the turn terminates.
              return { retry: retryCount < 1 };
            },
          },
        ],
      });

      const result = await agent.stream('tell me something', {
        memory: { thread: 'thread-rotate-error', resource: 'resource-rotate-error' },
        modelSettings: { maxRetries: 0 },
      });
      for await (const _chunk of result.fullStream) {
        // drain
      }

      expect(rotations).toBeGreaterThanOrEqual(1);

      const messages = await recallAll(mockMemory, 'thread-rotate-error', 'resource-rotate-error');
      const errorParts = errorPartsIn(messages);

      // Exactly one terminal record, and the rotation did not split it from the
      // partial output of the attempt it belongs to.
      expect(errorParts).toHaveLength(1);
      expect(errorParts[0]).toMatchObject({ error: { name: 'Error', message: 'stream broke' } });

      const carrier = messages.find(message => (message.content?.parts ?? []).some(part => part.type === 'error'))!;
      expect(carrier.role).toBe('assistant');
      expect(carrier.content.parts.map(part => part.type)).toEqual(['text', 'error']);
    });
  });
  describe('error handling consistency', () => {
    it('should preserve full APICallError in fullStream chunk, onError callback, and result.error', async () => {
      let onErrorCallbackError: any = null;
      let fullStreamError: any = null;

      const testAPICallError = new APICallError({
        message: 'Test API error',
        url: 'https://test.api.com',
        requestBodyValues: { test: 'test' },
        statusCode: 401,
        isRetryable: false,
        responseBody: 'Test API error response',
      });

      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw testAPICallError;
        },
        doStream: async () => {
          throw testAPICallError;
        },
      });

      const agent = new Agent({
        id: 'test-apicall-error-consistency',
        name: 'Test APICallError Consistency',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      const result = await agent.stream('Hello', {
        onError: ({ error }) => {
          onErrorCallbackError = error;
        },
        modelSettings: {
          maxRetries: 0,
        },
      });

      // Consume fullStream to capture error chunk
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'error') {
          fullStreamError = chunk.payload.error;
        }
      }

      const resultError = result.error;

      // All three should be the exact same APICallError instance (reference equality)
      expect(onErrorCallbackError).toBe(testAPICallError);
      expect(fullStreamError).toBe(testAPICallError);
      expect(resultError).toBe(testAPICallError);

      // Verify it's an APICallError instance
      expect(onErrorCallbackError).toBeInstanceOf(APICallError);
    });

    it('should preserve the error.cause in fullStream error chunks, onError callback, and result.error', async () => {
      const testErrorCauseMessage = 'Test error cause message';
      const testErrorCause = new Error(testErrorCauseMessage);

      const testErrorMessage = 'Test API error';
      const testErrorStatusCode = 401;
      const testErrorRequestId = 'req_123';
      const testError = new Error(testErrorMessage, { cause: testErrorCause });
      // Add some custom properties to verify they're preserved
      (testError as any).statusCode = testErrorStatusCode;
      (testError as any).requestId = testErrorRequestId;

      const errorModel = new MockLanguageModelV2({
        doGenerate() {
          throw testError;
        },
        doStream: async () => {
          throw testError;
        },
      });

      const agent = new Agent({
        id: 'test-error-consistency',
        name: 'Test Error Consistency',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      let onErrorCallbackError: any = null;
      let fullStreamError: any = null;

      const result = await agent.stream('Hello', {
        onError: ({ error }) => {
          onErrorCallbackError = error;
        },
        modelSettings: {
          maxRetries: 0,
        },
      });

      // Consume fullStream to capture error chunk
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'error') {
          fullStreamError = chunk.payload.error;
        }
      }

      // Get result.error
      const resultError = result.error;

      // All three should be defined
      expect(onErrorCallbackError).toBeDefined();
      expect(fullStreamError).toBeDefined();
      expect(resultError).toBeDefined();

      // All three should be Error instances
      expect(onErrorCallbackError instanceof Error).toBe(true);
      expect(fullStreamError instanceof Error).toBe(true);
      expect(resultError instanceof Error).toBe(true);

      expect(onErrorCallbackError).toBe(testError);
      expect(fullStreamError).toBe(testError);
      expect(resultError).toBe(testError);

      expect(onErrorCallbackError.message).toBe(testErrorMessage);
      expect(fullStreamError.message).toBe(testErrorMessage);
      expect((resultError as Error).message).toBe(testErrorMessage);

      // should preserve custom properties
      expect(onErrorCallbackError.statusCode).toBe(testErrorStatusCode);
      expect(onErrorCallbackError.requestId).toBe(testErrorRequestId);
      expect(fullStreamError.statusCode).toBe(testErrorStatusCode);
      expect(fullStreamError.requestId).toBe(testErrorRequestId);
      expect((resultError as any).statusCode).toBe(testErrorStatusCode);
      expect((resultError as any).requestId).toBe(testErrorRequestId);

      // should preserve the error cause
      expect(onErrorCallbackError.cause).toBe(testErrorCause);
      expect(fullStreamError.cause).toBe(testErrorCause);
      expect((resultError as Error).cause).toBe(testErrorCause);
    });

    it('should throw APICallError in generate when model throws rate limit error', async () => {
      const rateLimitError = new APICallError({
        message: 'Rate limit exceeded',
        url: 'https://api.example.com/v1/chat/completions',
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
        responseBody: 'Rate limit exceeded',
      });

      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw rateLimitError;
        },
        doStream: async () => {
          throw rateLimitError;
        },
      });

      const agent = new Agent({
        id: 'test-rate-limit-generate',
        name: 'Test Rate Limit Generate',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      let caughtError: Error | null = null;
      try {
        await agent.generate('Hello', { modelSettings: { maxRetries: 0 } });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(APICallError);
      expect(caughtError!.message).toBe('Rate limit exceeded');
      expect((caughtError as InstanceType<typeof APICallError>).statusCode).toBe(429);
    });

    it('should throw correct error in generate when model throws', async () => {
      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Model generation failed');
        },
        doStream: async () => {
          throw new Error('Model generation failed');
        },
      });

      const agent = new Agent({
        id: 'test-throw-generate',
        name: 'Test Throw Generate',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      let caughtError: Error | null = null;
      try {
        await agent.generate('Please use a tool', { modelSettings: { maxRetries: 0 } });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError!.message).toMatch(/Model generation failed/i);
    });

    it('should have correct error in output.error and fullStream error chunk when model throws in stream', async () => {
      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Model stream failed');
        },
        doStream: async () => {
          throw new Error('Model stream failed');
        },
      });

      const agent = new Agent({
        id: 'test-error-stream',
        name: 'Test Error Stream',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      const output = await agent.stream('Please use a tool', { modelSettings: { maxRetries: 0 } });

      let errorChunk: any;
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'error') {
          errorChunk = chunk;
        }
      }

      // Verify error chunk has correct error
      expect(errorChunk).toBeDefined();
      expect(errorChunk.payload.error).toBeDefined();
      expect(errorChunk.payload.error).toBeInstanceOf(Error);
      expect((errorChunk.payload.error as Error).message).toMatch(/Model stream failed/i);

      // Verify output.error has correct error
      expect(output.error).toBeInstanceOf(Error);
      expect((output.error as Error).message).toMatch(/Model stream failed/i);

      // Verify they are the same instance
      expect(output.error).toBe(errorChunk.payload.error);
    });

    it('should call onError with correct error in generate when model throws', async () => {
      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Model generation failed');
        },
        doStream: async () => {
          throw new Error('Model generation failed');
        },
      });

      const agent = new Agent({
        id: 'test-onerror-generate',
        name: 'Test OnError Generate',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      let onErrorCalled = false;
      let onErrorArg: string | Error | null = null;

      try {
        await agent.generate('Please use a tool', {
          onError: ({ error }) => {
            onErrorCalled = true;
            onErrorArg = error;
          },
          modelSettings: { maxRetries: 0 },
        });
      } catch {
        // Expected to throw
      }

      expect(onErrorCalled).toBe(true);
      expect(onErrorArg).toBeInstanceOf(Error);
      expect((onErrorArg as unknown as Error).message).toMatch(/Model generation failed/i);
    });

    describe('error chunk with non-error finishReason', () => {
      // Tests for the bug where error chunks are emitted mid-stream but the finish chunk
      // has a non-'error' finishReason. Previously, generate() only threw when
      // `finishReason === 'error' && error`, silently swallowing errors in this case.
      const finishReasons = ['stop', 'length', 'content-filter', 'tool-calls', 'other', 'unknown'] as const;

      for (const reason of finishReasons) {
        it(`should throw in generate when error chunk is present but finishReason is '${reason}'`, async () => {
          const streamError = new Error(`Stream error with finishReason '${reason}'`);

          const errorModel = new MockLanguageModelV2({
            doGenerate: async () => {
              throw streamError;
            },
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'response-metadata',
                  id: 'id-0',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'partial response' },
                { type: 'text-end', id: 'text-1' },
                { type: 'error', error: streamError },
                {
                  type: 'finish',
                  finishReason: reason,
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });

          const agent = new Agent({
            id: `test-error-finish-reason-${reason}`,
            name: `Test Error FinishReason ${reason}`,
            model: errorModel,
            instructions: 'You are a helpful assistant.',
          });

          await expect(agent.generate('Hello', { modelSettings: { maxRetries: 0 } })).rejects.toThrow();
        });
      }

      it('should expose error in stream output when error chunk has non-error finishReason', async () => {
        const streamError = new Error('Mid-stream error with stop finish');

        const errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw streamError;
          },
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'partial' },
              { type: 'text-end', id: 'text-1' },
              { type: 'error', error: streamError },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });

        const mockMemory = new MockMemory();
        let outputProcessorCalls = 0;
        const onError = vi.fn();
        let onFinishCalls = 0;
        const agent = new Agent({
          id: 'test-error-stream-non-error-finish',
          name: 'Test Error Stream NonError Finish',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
          memory: mockMemory,
          outputProcessors: [
            {
              id: 'partial-failure-output-processor',
              processOutputResult: async ({ messageList }) => {
                outputProcessorCalls++;
                return messageList;
              },
            },
          ],
        });

        const output = await agent.stream('Hello', {
          modelSettings: { maxRetries: 0 },
          memory: { thread: 'partial-failure-thread', resource: 'partial-failure-resource' },
          onError,
          onFinish: () => {
            onFinishCalls++;
          },
        });

        let errorChunk: any;
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'error') {
            errorChunk = chunk;
          }
        }

        expect(errorChunk).toBeDefined();
        expect(errorChunk.payload.error).toBeInstanceOf(Error);
        expect((errorChunk.payload.error as Error).message).toBe('Mid-stream error with stop finish');
        expect(output.error).toBeInstanceOf(Error);
        expect((output.error as Error).message).toBe('Mid-stream error with stop finish');
        expect(outputProcessorCalls).toBe(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onFinishCalls).toBe(0);

        const recalled = await mockMemory.recall({
          threadId: 'partial-failure-thread',
          resourceId: 'partial-failure-resource',
        });
        expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
        expect(new Set(recalled.messages.map(message => message.id)).size).toBe(2);
        expect(
          recalled.messages[1]?.content.parts
            ?.filter(part => part.type === 'text')
            .map(part => ({ type: part.type, text: part.text })),
        ).toEqual([{ type: 'text', text: 'partial' }]);
      });

      it('should call onError in generate when error chunk has non-error finishReason', async () => {
        const streamError = new Error('Error with stop finish');

        const errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw streamError;
          },
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'error', error: streamError },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });

        const agent = new Agent({
          id: 'test-onerror-non-error-finish',
          name: 'Test OnError NonError Finish',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        let onErrorCalled = false;
        let onErrorArg: any = null;

        try {
          await agent.generate('Hello', {
            onError: ({ error }) => {
              onErrorCalled = true;
              onErrorArg = error;
            },
            modelSettings: { maxRetries: 0 },
          });
        } catch {
          // Expected to throw
        }

        expect(onErrorCalled).toBe(true);
        expect(onErrorArg).toBeInstanceOf(Error);
        expect((onErrorArg as Error).message).toBe('Error with stop finish');
      });

      // The error-chunk-with-mismatched-finishReason scenario requires bypassing the
      // AISDKV5LanguageModel wrapper (which converts doGenerate results via
      // createStreamFromGenerateResult and never inserts error chunks). We subclass
      // AISDKV5LanguageModel so the model passes the instanceof check in resolveModel
      // (avoiding re-wrapping), then override doGenerate to return a raw stream containing
      // an error chunk with finishReason 'stop' — the exact scenario this fix addresses.
      it('should throw in resumeGenerate when error chunk has non-error finishReason', async () => {
        const { Mastra } = await import('../../mastra');
        const { InMemoryStore } = await import('../../storage');
        const { AISDKV5LanguageModel } = await import('../../llm/model/aisdk/v5/model');

        const streamError = new Error('Resume model error with stop finish');
        let generateCallCount = 0;

        const suspendingTool = createTool({
          id: 'suspend-tool',
          description: 'A tool that suspends',
          inputSchema: z.object({ input: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ data: z.string() }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) {
              return await context?.agent?.suspend({ message: 'Need input' });
            }
            return { result: context.agent.resumeData.data };
          },
        });

        const baseModel = new MockLanguageModelV2();

        // Subclass to bypass resolveModel's instanceof check and return raw streams
        class TestModel extends AISDKV5LanguageModel {
          override async doGenerate(): Promise<any> {
            generateCallCount++;
            if (generateCallCount === 1) {
              // First call: trigger tool suspension
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start' as const, warnings: [] },
                  {
                    type: 'response-metadata' as const,
                    id: 'resp-1',
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  {
                    type: 'tool-input-start' as const,
                    id: 'tc-1',
                    toolName: 'suspendTool',
                  },
                  {
                    type: 'tool-input-delta' as const,
                    id: 'tc-1',
                    delta: '{"input": "test"}',
                  },
                  {
                    type: 'tool-input-end' as const,
                    id: 'tc-1',
                  },
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'tc-1',
                    toolName: 'suspendTool',
                    input: '{"input": "test"}',
                  },
                  {
                    type: 'finish' as const,
                    finishReason: 'tool-calls' as const,
                    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                  },
                ]),
                warnings: [],
                request: {},
                rawResponse: {},
              };
            }
            // Second call (after resume): error chunk with non-error finishReason
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start' as const, warnings: [] },
                {
                  type: 'response-metadata' as const,
                  id: 'resp-2',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'error' as const, error: streamError },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                },
              ]),
              warnings: [],
              request: {},
              rawResponse: {},
            };
          }
        }

        const model = new TestModel(baseModel);
        const storage = new InMemoryStore();

        const agent = new Agent({
          id: 'test-resume-error',
          name: 'Test Resume Error',
          model: model as any,
          instructions: 'You are a helpful assistant.',
          tools: { suspendTool: suspendingTool },
        });

        const mastra = new Mastra({
          agents: { testResumeError: agent },
          storage,
          logger: false,
        });

        const registeredAgent = mastra.getAgent('testResumeError');

        // First call suspends
        const output = await registeredAgent.generate('test', {
          maxSteps: 2,
          modelSettings: { maxRetries: 0 },
        });

        expect(output.finishReason).toBe('suspended');

        // Resume should throw because stream has error chunk despite finishReason 'stop'
        await expect(
          registeredAgent.resumeGenerate(
            { data: 'resumed' },
            { runId: output.runId!, modelSettings: { maxRetries: 0 } },
          ),
        ).rejects.toThrow();
      });
    });
  });
  describe('abort with a provider that ignores cancellation', () => {
    it('should persist the assistant text available when the abort is saved', async () => {
      const abortController = new AbortController();
      const totalChunks = 20;
      const abortAfterChunks = 5;
      let resolveProviderFinished!: () => void;
      const providerFinished = new Promise<void>(resolve => {
        resolveProviderFinished = resolve;
      });
      const model = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 200, totalTokens: 210 },
          content: [{ type: 'text', text: 'Full long response' }],
          warnings: [],
        }),
        doStream: async () => {
          const allChunks = [
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start' as const, id: 'text-1' },
            ...Array.from({ length: totalChunks }, (_, index) => ({
              type: 'text-delta' as const,
              id: 'text-1',
              delta: `chunk-${index + 1} `,
            })),
            { type: 'text-end' as const, id: 'text-1' },
            {
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 200, totalTokens: 210 },
            },
          ];
          let index = 0;

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              start(controller) {
                void (async () => {
                  try {
                    while (index < allChunks.length) {
                      await new Promise(resolve => setTimeout(resolve, 5));
                      const chunk = allChunks[index++]!;
                      const textDeltaCount = index - 3;
                      if (chunk.type === 'text-delta' && textDeltaCount === abortAfterChunks) {
                        abortController.abort();
                        await new Promise(resolve => setTimeout(resolve, 0));
                      }

                      try {
                        controller.enqueue(chunk);
                      } catch {
                        // This provider ignores cancellation and keeps generating output.
                      }
                    }
                    try {
                      controller.close();
                    } catch {
                      // The consumer canceled while the provider kept generating.
                    }
                  } finally {
                    resolveProviderFinished();
                  }
                })();
              },
            }),
          };
        },
      });

      const mockMemory = new MockMemory();
      const memoryStore = await mockMemory.storage.getStore('memory');
      const saveMessagesSpy = vi.spyOn(memoryStore!, 'saveMessages');
      const agent = new Agent({
        id: 'bounded-abort-agent',
        name: 'Bounded Abort Agent',
        model,
        instructions: 'test',
        memory: mockMemory,
      });

      const stream = await agent.stream('Write a very long essay', {
        abortSignal: abortController.signal,
        memory: {
          thread: 'bounded-abort-thread',
          resource: 'bounded-abort-resource',
        },
      });
      try {
        await stream.consumeStream();
      } catch {
        // Expected abort error.
      }

      await providerFinished;
      const recalled = await mockMemory.recall({
        threadId: 'bounded-abort-thread',
        resourceId: 'bounded-abort-resource',
      });
      expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
      expect(new Set(recalled.messages.map(message => message.id)).size).toBe(2);
      expect(
        recalled.messages[0]?.content.parts
          ?.filter(part => part.type === 'text')
          .map(part => ({ type: part.type, text: part.text })),
      ).toEqual([{ type: 'text', text: 'Write a very long essay' }]);
      expect(
        recalled.messages[1]?.content.parts
          ?.filter(part => part.type === 'text')
          .map(part => ({ type: part.type, text: part.text })),
      ).toEqual([{ type: 'text', text: 'chunk-1 chunk-2 chunk-3 chunk-4 ' }]);
      expect(saveMessagesSpy).toHaveBeenCalledTimes(1);
      expect(saveMessagesSpy.mock.calls[0]?.[0].messages.map(message => message.id)).toEqual(
        recalled.messages.map(message => message.id),
      );

      // The aborted turn persists its partial assistant text, but abort exits
      // before the terminal-error branch so it must not gain an `error` part.
      expect(
        recalled.messages.flatMap(message => message.content?.parts ?? []).filter(part => part.type === 'error'),
      ).toEqual([]);
    });
  });
});
