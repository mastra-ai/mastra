import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

function saveAndErrorTests(version: 'v1' | 'v2') {
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: `Dummy response`,
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
          content: [
            {
              type: 'text',
              text: 'Dummy response',
            },
          ],
          warnings: [],
        }),
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
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });
    }
  });

  describe(`${version} - Agent save message parts`, () => {
    // Model that emits 10 parts
    let dummyResponseModel: MockLanguageModelV1 | MockLanguageModelV2;
    let emptyResponseModel: MockLanguageModelV1 | MockLanguageModelV2;
    let errorResponseModel: MockLanguageModelV1 | MockLanguageModelV2;

    beforeEach(() => {
      if (version === 'v1') {
        dummyResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => ({
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async _options => {
            let count = 0;
            const stream = new ReadableStream({
              pull(controller) {
                if (count < 10) {
                  controller.enqueue({
                    type: 'text-delta',
                    textDelta: `Dummy response ${count}`,
                    createdAt: new Date(Date.now() + count * 1000).toISOString(),
                  });
                  count++;
                } else {
                  controller.close();
                }
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        // Model never emits any parts
        emptyResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => ({
            text: undefined,
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });

        // Model throws immediately before emitting any part
        errorResponseModel = new MockLanguageModelV1({
          doGenerate: async _options => {
            throw new Error('Immediate interruption');
          },
          doStream: async _options => {
            const stream = new ReadableStream({
              pull() {
                throw new Error('Immediate interruption');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });
      } else {
        dummyResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => ({
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            content: [
              {
                type: 'text',
                text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
              },
            ],
            warnings: [],
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async _options => ({
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
              ...Array.from({ length: 10 }, (_, count) => ({
                type: 'text-delta' as const,
                id: '1',
                delta: `Dummy response ${count} `,
              })),
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
              },
            ]),
          }),
        });

        // Model never emits any parts
        emptyResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => ({
            text: undefined,
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            content: [],
            warnings: [],
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
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
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              },
            ]),
          }),
        });

        // Model throws immediately before emitting any part
        errorResponseModel = new MockLanguageModelV2({
          doGenerate: async _options => {
            throw new Error('Immediate interruption');
          },
          doStream: async _options => {
            throw new Error('Immediate interruption');
          },
        });
      }
    });

    describe('generate', () => {
      it('should persist the full message after a successful run', async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'test-agent-generate',
          name: 'Test Agent Generate',
          instructions: 'test',
          model: dummyResponseModel,
          memory: mockMemory,
        });
        if (version === 'v1') {
          await agent.generateLegacy('repeat tool calls', {
            threadId: 'thread-1-generate',
            resourceId: 'resource-1-generate',
          });
        } else {
          await agent.generate('repeat tool calls', {
            memory: {
              thread: 'thread-1-generate',
              resource: 'resource-1-generate',
            },
          });
        }

        const result = await mockMemory.recall({
          threadId: 'thread-1-generate',
          resourceId: 'resource-1-generate',
        });
        const messages = result.messages;
        // Check that the last message matches the expected final output
        expect(
          messages[messages.length - 1]?.content?.parts?.some(
            p => p.type === 'text' && p.text?.includes('Dummy response'),
          ),
        ).toBe(true);
      });

      it.skip('should only call saveMessages for the user message when no assistant parts are generated', async () => {
        const mockMemory = new MockMemory();

        let saveCallCount = 0;

        mockMemory.saveMessages = async function (...args) {
          saveCallCount++;
          return MockMemory.prototype.saveMessages.apply(this, args);
        };

        const agent = new Agent({
          id: 'no-progress-agent-generate',
          name: 'No Progress Agent Generate',
          instructions: 'test',
          model: emptyResponseModel,
          memory: mockMemory,
        });

        if (version === 'v1') {
          await agent.generateLegacy('no progress', {
            threadId: `thread-2-${version}-generate`,
            resourceId: `resource-2-${version}-generate`,
          });
        } else {
          await agent.generate('no progress', {
            memory: {
              thread: `thread-2-${version}-generate`,
              resource: `resource-2-${version}-generate`,
            },
          });
        }

        expect(saveCallCount).toBe(1);

        const result = await mockMemory.recall({
          threadId: `thread-2-${version}-generate`,
          resourceId: `resource-2-${version}-generate`,
        });
        const messages = result?.messages ?? [];

        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content.content).toBe('no progress');
      });
    }, 500000);

    it('should not save any message if interrupted before any part is emitted', async () => {
      const mockMemory = new MockMemory();
      let saveCallCount = 0;

      mockMemory.saveMessages = async function (...args) {
        saveCallCount++;
        return MockMemory.prototype.saveMessages.apply(this, args);
      };

      const agent = new Agent({
        id: 'immediate-interrupt-agent-generate',
        name: 'Immediate Interrupt Agent Generate',
        instructions: 'test',
        model: errorResponseModel,
        memory: mockMemory,
      });

      try {
        if (version === 'v1') {
          await agent.generateLegacy('interrupt before step', {
            threadId: 'thread-3-generate',
            resourceId: 'resource-3-generate',
          });
        } else {
          await agent.generate('interrupt before step', {
            memory: {
              thread: 'thread-3-generate',
              resource: 'resource-3-generate',
            },
          });
        }
      } catch (err: any) {
        expect(err.message).toBe('Immediate interruption');
      }

      const result = await mockMemory.recall({
        threadId: 'thread-3-generate',
        resourceId: 'resource-3-generate',
      });

      // TODO: output processors in v2 still run when the model throws an error! that doesn't seem right.
      // it means in v2 our message history processor saves the input message.
      if (version === `v1`) {
        expect(result.messages.length).toBe(0);
        expect(saveCallCount).toBe(0);
      }
    });

    it('should save thread but not messages if error occurs during LLM generation', async () => {
      // Both v1 and v2: Threads are now created upfront to prevent race conditions with
      // storage backends like PostgresStore that validate thread existence before saving
      // messages. When an error occurs during LLM generation, the thread will exist but
      // no messages will be saved since the response never completed.
      const mockMemory = new MockMemory();
      const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');

      let errorModel: MockLanguageModelV1 | MockLanguageModelV2;
      if (version === 'v1') {
        errorModel = new MockLanguageModelV1({
          doGenerate: async () => {
            throw new Error('Simulated error during response');
          },
        });
      } else {
        errorModel = new MockLanguageModelV2({
          doGenerate: async () => {
            throw new Error('Simulated error during response');
          },
          doStream: async () => {
            throw new Error('Simulated error during response');
          },
        });
      }

      const agent = new Agent({
        id: 'error-agent',
        name: 'Error Agent',
        instructions: 'test',
        model: errorModel,
        memory: mockMemory,
      });

      let errorCaught = false;
      try {
        if (version === 'v1') {
          await agent.generateLegacy('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err',
              },
            },
          });
        } else {
          await agent.generate('trigger error', {
            memory: {
              resource: 'user-err',
              thread: {
                id: 'thread-err',
              },
            },
          });
        }
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toMatch(/Simulated error/);
      }
      expect(errorCaught).toBe(true);

      const thread = await mockMemory.getThreadById({ threadId: 'thread-err' });

      // Both v1 and v2: Thread should exist (created upfront to prevent race conditions
      // with storage backends like PostgresStore that validate thread existence before saving messages)
      expect(thread).not.toBeNull();
      expect(thread?.id).toBe('thread-err');
      // But no messages should be saved since the LLM call failed
      expect(saveMessagesSpy).not.toHaveBeenCalled();
    });
  });

  if (version === 'v2') {
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

      it('should not call onError in stream when tool execution fails', async () => {
        const model = createModelWithFailingToolCall();
        const agent = createAgentWithFailingTool(model);

        let onErrorCalled = false;

        const output = await agent.stream('Please use a tool', {
          onError: () => {
            onErrorCalled = true;
          },
        });

        for await (const _ of output.fullStream) {
          // Just consume
        }

        // Tool execution failures go through bail(), onError is not called
        expect(onErrorCalled).toBe(false);
      });
    });

    describe('stream options', () => {
      it('should call options.onError when stream error occurs in stream', async () => {
        const errorModel = new MockLanguageModelV2({
          doGenerate() {
            throw new Error('Simulated stream error');
          },
          doStream: async () => {
            throw new Error('Simulated stream error');
          },
        });

        const agent = new Agent({
          id: 'test-options-onerror',
          name: 'Test Options OnError',
          model: errorModel,
          instructions: 'You are a helpful assistant.',
        });

        let errorCaught = false;
        let caughtError: any = null;

        const stream = await agent.stream('Hello', {
          onError: ({ error }) => {
            errorCaught = true;
            caughtError = error;
          },
          modelSettings: {
            maxRetries: 0,
          },
        });

        // Consume the stream to trigger the error
        try {
          await stream.consumeStream();
        } catch {}

        expect(errorCaught).toBe(true);
        expect(caughtError).toBeDefined();
        expect(caughtError.message).toMatch(/Simulated stream error/);
      });

      it('should call options.onChunk when streaming in stream', async () => {
        const agent = new Agent({
          id: 'test-options-onchunk',
          name: 'Test Options OnChunk',
          model: dummyModel,
          instructions: 'You are a helpful assistant.',
        });

        const chunks: any[] = [];

        const stream = await agent.stream('Hello', {
          onChunk: chunk => {
            chunks.push(chunk);
          },
        });

        // Consume the stream to trigger chunks
        await stream.consumeStream();

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0]).toHaveProperty('type');
      });

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

        const stream = await agent.stream('Hello', {
          onAbort: event => {
            abortCalled = true;
            abortEvent = event;
          },
          abortSignal: abortController.signal,
        });

        // Consume the stream to trigger the abort
        try {
          await stream.consumeStream();
        } catch {}

        expect(abortCalled).toBe(true);
        expect(abortEvent).toBeDefined();
      });
    });
  }
}

saveAndErrorTests('v1');
saveAndErrorTests('v2');
