import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

describe('Agent error propagation', () => {
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

    it('should expose the same error in fullStream error chunks, onError callback, and result.error', async () => {
      const testErrorMessage = 'Test API error';
      const testErrorStatusCode = 401;
      const testErrorRequestId = 'req_123';
      const testError = new Error(testErrorMessage);
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

      // should be defined
      expect(onErrorCallbackError).toBeDefined();
      expect(fullStreamError).toBeDefined();
      expect(resultError).toBeDefined();

      // should be Error instances
      expect(onErrorCallbackError instanceof Error).toBe(true);
      expect(fullStreamError instanceof Error).toBe(true);
      expect(resultError instanceof Error).toBe(true);

      expect(onErrorCallbackError).toBe(testError);
      expect(fullStreamError).toBe(testError);
      expect(resultError).toBe(testError);

      // should have the same message
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

    it('should call onError with correct error in stream when model throws', async () => {
      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Model stream failed');
        },
        doStream: async () => {
          throw new Error('Model stream failed');
        },
      });

      const agent = new Agent({
        id: 'test-onerror-stream',
        name: 'Test OnError Stream',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      let onErrorCalled = false;
      let onErrorArg: string | Error | null = null;

      const output = await agent.stream('Please use a tool', {
        onError: ({ error }) => {
          onErrorCalled = true;
          onErrorArg = error;
        },
        modelSettings: { maxRetries: 0 },
      });

      // Consume the stream to trigger the error
      for await (const _ of output.fullStream) {
        // Just consume
      }

      expect(onErrorCalled).toBe(true);
      expect(onErrorArg).toBeInstanceOf(Error);
      expect((onErrorArg as unknown as Error).message).toMatch(/Model stream failed/i);
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

    // Helper to create a model that calls a tool which will throw during execution
    function createModelWithFailingToolCall() {
      return new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          content: [{ type: 'tool-call', toolCallId: '123', toolName: 'failingTool', input: '{"input": "test"}' }],
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'response-1',
              modelId: 'mock-model',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolCallType: 'function',
              toolName: 'failingTool',
              input: '{"input": "test"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });
    }

    // Helper to create an agent with a tool that throws during execution
    function createAgentWithFailingTool(model: MockLanguageModelV2) {
      const failingTool = createTool({
        id: 'failingTool',
        description: 'A tool that throws during execution',
        inputSchema: z.object({ input: z.string() }),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      });

      return new Agent({
        id: 'test-tool-execution-error',
        name: 'Test Tool Execution Error',
        model,
        instructions: 'You are a helpful assistant.',
        tools: { failingTool },
      });
    }

    it('should not throw in generate when tool execution fails (error returned to model)', async () => {
      const model = createModelWithFailingToolCall();
      const agent = createAgentWithFailingTool(model);

      // Tool execution failures bail the workflow but don't throw
      const result = await agent.generate('Please use a tool');
      expect(result).toBeDefined();
    });

    it('should not emit error chunks in stream when tool execution fails', async () => {
      const model = createModelWithFailingToolCall();
      const agent = createAgentWithFailingTool(model);

      const output = await agent.stream('Please use a tool');

      const errorChunks: any[] = [];
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'error') {
          errorChunks.push(chunk);
        }
      }

      // Tool execution failures go through bail(), not the error path
      expect(errorChunks.length).toBe(0);
    });

    it('should not call onError in generate when tool execution fails', async () => {
      const model = createModelWithFailingToolCall();
      const agent = createAgentWithFailingTool(model);

      let onErrorCalled = false;

      await agent.generate('Please use a tool', {
        onError: () => {
          onErrorCalled = true;
        },
      });

      // Tool execution failures go through bail(), onError is not called
      expect(onErrorCalled).toBe(false);
    });
  });

  describe('stream options', () => {
    it('should call options.onAbort when stream is aborted in stream', async () => {
      const abortController = new AbortController();
      let pullCalls = 0;

      const abortModel = new MockLanguageModelV2({
        // @ts-expect-error - error
        doGenerate: async () => {
          await new Promise(resolve => setImmediate(resolve));
          abortController.abort();
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            pull(controller) {
              switch (pullCalls++) {
                case 0:
                  controller.enqueue({
                    type: 'stream-start',
                    warnings: [],
                  });
                  break;
                case 1:
                  controller.enqueue({
                    type: 'text-start',
                    id: '1',
                  });
                  break;
                case 2:
                  // Abort during streaming
                  abortController.abort();
                  controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                  break;
              }
            },
          }),
        }),
      });

      const agent = new Agent({
        id: 'test-options-onabort',
        name: 'Test Options OnAbort',
        model: abortModel,
        instructions: 'You are a helpful assistant.',
      });

      let abortCalled = false;
      let abortEvent: any = null;
      const onFinish = vi.fn();

      const stream = await agent.stream('Hello', {
        onAbort: event => {
          abortCalled = true;
          abortEvent = event;
        },
        onFinish,
        abortSignal: abortController.signal,
      });

      const chunks: any[] = [];
      try {
        for await (const chunk of stream.fullStream) chunks.push(chunk);
      } catch {}

      expect(chunks.some(chunk => chunk.type === 'abort')).toBe(true);
      expect(abortCalled).toBe(true);
      expect(abortEvent).toBeDefined();
      expect(onFinish).not.toHaveBeenCalled();
    });
  });
});
