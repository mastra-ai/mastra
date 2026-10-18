import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

function messagePersistenceTests(version: 'v1' | 'v2') {
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

    it('should handle interruption before any part is emitted', async () => {
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

      if (version === 'v1') {
        // Input-only failed turns remain excluded by MessageHistory's orphan guard.
        expect(result.messages.length).toBe(0);
        expect(saveCallCount).toBe(0);
      } else {
        // v2 records the terminal failure as a first-class `error` part, so the
        // failed turn becomes a real user/assistant pair instead of an input-only
        // turn the orphan guard has to drop. It persists through MessageHistory's
        // ordinary storage path, which is why the Memory-level save spy stays at 0.
        expect(result.messages.length).toBe(2);
        expect(result.messages.map(message => message.role)).toEqual(['user', 'assistant']);
        expect(result.messages[1].content.parts).toEqual([
          {
            type: 'error',
            error: { name: 'Error', message: 'Immediate interruption' },
            createdAt: expect.any(Number),
          },
        ]);
        expect(saveCallCount).toBe(0);
      }
    });

    it('should save thread but not messages if error occurs during LLM generation', async () => {
      // Threads are created upfront so storage backends that validate thread existence can
      // persist later messages even when the provider fails before producing output.
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

      expect(thread).not.toBeNull();
      expect(thread?.id).toBe('thread-err');

      expect(saveMessagesSpy).not.toHaveBeenCalled();
    });
  });

  if (version === 'v2') {
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

      it('persists the original terminal error when an output processor transforms its streamed chunk', async () => {
        const mockMemory = new MockMemory();
        const agent = new Agent({
          id: 'processed-terminal-error-agent',
          name: 'Processed Terminal Error Agent',
          instructions: 'test',
          model: createPartialThenErrorModel('original failure'),
          memory: mockMemory,
          outputProcessors: [
            {
              id: 'replace-terminal-error-chunk',
              processOutputStream: ({ part }: { part: ChunkType }) =>
                part.type === 'error'
                  ? { ...part, payload: { ...part.payload, error: new Error('processor replacement') } }
                  : part,
            },
          ],
        });

        const result = await agent.stream('tell me something', {
          memory: { thread: 'thread-processed-error', resource: 'resource-processed-error' },
          modelSettings: { maxRetries: 0 },
        });
        for await (const _chunk of result.fullStream) {
          // drain so the run reaches its terminal error path
        }

        const messages = await recallAll(mockMemory, 'thread-processed-error', 'resource-processed-error');
        expect(errorPartsIn(messages)).toEqual([
          { type: 'error', error: { name: 'Error', message: 'original failure' }, createdAt: expect.any(Number) },
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

    describe('abort persistence', () => {
      it('should persist an immediate abort and recall it on the next turn', async () => {
        const abortController = new AbortController();
        const prompts: unknown[] = [];
        let streamCallCount = 0;
        const model = new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            content: [{ type: 'text', text: 'next response' }],
            warnings: [],
          }),
          doStream: async options => {
            prompts.push(options.prompt);
            streamCallCount++;

            if (streamCallCount === 1) {
              let pullCount = 0;
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: new ReadableStream({
                  pull(controller) {
                    if (pullCount++ === 0) {
                      controller.enqueue({ type: 'stream-start', warnings: [] });
                    } else {
                      abortController.abort();
                      controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                    }
                  },
                }),
              };
            }

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'next-response', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'next-text' },
                { type: 'text-delta', id: 'next-text', delta: 'next response' },
                { type: 'text-end', id: 'next-text' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]),
            };
          },
        });

        const mockMemory = new MockMemory();
        const memoryStore = await mockMemory.storage.getStore('memory');
        const saveMessagesSpy = vi.spyOn(memoryStore!, 'saveMessages');
        let outputProcessorCalls = 0;
        let onAbortCalls = 0;
        let onFinishCalls = 0;
        const agent = new Agent({
          id: 'immediate-abort-memory-agent',
          name: 'Immediate Abort Memory Agent',
          model,
          instructions: 'test',
          memory: mockMemory,
          outputProcessors: [
            {
              id: 'abort-output-processor',
              processOutputResult: async ({ messageList }) => {
                outputProcessorCalls++;
                return messageList;
              },
            },
          ],
        });
        const memory = {
          thread: 'immediate-abort-thread',
          resource: 'immediate-abort-resource',
          options: { lastMessages: 10 },
        } as const;

        const abortedStream = await agent.stream('message before abort', {
          abortSignal: abortController.signal,
          memory,
          modelSettings: { maxRetries: 0 },
          onAbort: () => {
            onAbortCalls++;
          },
          onFinish: () => {
            onFinishCalls++;
          },
        });
        try {
          await abortedStream.consumeStream();
        } catch {
          // Expected abort error.
        }

        const afterAbort = await mockMemory.recall({
          threadId: memory.thread,
          resourceId: memory.resource,
        });
        expect(afterAbort.messages).toHaveLength(1);
        expect(afterAbort.messages[0]).toMatchObject({
          role: 'user',
          content: { parts: [{ type: 'text', text: 'message before abort' }] },
        });
        expect(afterAbort.messages[0]?.id).toBeTruthy();
        expect(saveMessagesSpy).toHaveBeenCalledTimes(1);
        expect(saveMessagesSpy.mock.calls[0]?.[0].messages.map(message => message.id)).toEqual([
          afterAbort.messages[0]?.id,
        ]);
        expect(outputProcessorCalls).toBe(1);
        expect(onAbortCalls).toBe(1);
        expect(onFinishCalls).toBe(0);

        // Abort exits before the terminal-error branch, so the failed turn must
        // not gain a persisted `error` part.
        expect(
          afterAbort.messages.flatMap(message => message.content?.parts ?? []).filter(part => part.type === 'error'),
        ).toEqual([]);

        const nextStream = await agent.stream('message after abort', {
          memory,
          modelSettings: { maxRetries: 0 },
        });
        await nextStream.consumeStream();

        expect(streamCallCount).toBe(2);
        expect(JSON.stringify(prompts[1])).toContain('message before abort');
        expect(JSON.stringify(prompts[1])).toContain('message after abort');
        const afterNextTurn = await mockMemory.recall({
          threadId: memory.thread,
          resourceId: memory.resource,
        });
        expect(afterNextTurn.messages.map(message => message.role)).toEqual(['user', 'user', 'assistant']);
        expect(new Set(afterNextTurn.messages.map(message => message.id)).size).toBe(3);
        expect(afterNextTurn.messages[0]?.id).toBe(afterAbort.messages[0]?.id);
        expect(
          afterNextTurn.messages.flatMap(message => message.content?.parts ?? []).filter(part => part.type === 'error'),
        ).toEqual([]);
      });

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
  }
}

messagePersistenceTests('v1');
messagePersistenceTests('v2');

/**
 * Submitted messages and completed tool side effects are historical facts. Aborting a run
 * must not erase them, especially because a completed tool may have caused an irreversible
 * external action even though the assistant never produced a final response.
 */
describe('message persistence across completed steps', () => {
  it('should persist raw tool results separately from providerMetadata.mastra.modelOutput during savePerStep', async () => {
    let doStreamCallCount = 0;

    const toolCallModel = new MockLanguageModelV2({
      doStream: async () => {
        doStreamCallCount++;
        if (doStreamCallCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'echo-tool',
                input: '{"input": "hello"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response after tool' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const mockMemory = new MockMemory();
    const persistedSnapshots: MastraDBMessage[][] = [];
    mockMemory.saveMessages = async function (...args) {
      persistedSnapshots.push(structuredClone(args[0].messages));
      return MockMemory.prototype.saveMessages.apply(this, args);
    };

    const rawResult = {
      output: 'hello',
      nested: { raw: true },
      rows: [{ id: 1, value: 'x' }],
    };
    const modelOutput = [{ type: 'text', text: 'Echoed hello' }];

    const echoTool = createTool({
      id: 'echo-tool',
      description: 'Echoes the input',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({
        output: z.string(),
        nested: z.object({ raw: z.boolean() }),
        rows: z.array(z.object({ id: z.number(), value: z.string() })),
      }),
      execute: async () => rawResult,
      toModelOutput: () => modelOutput,
    });

    const agent = new Agent({
      id: 'save-per-step-model-output-agent',
      name: 'Save Per Step Model Output Test',
      instructions: 'Call the echo-tool, then summarize the result.',
      model: toolCallModel,
      memory: mockMemory,
      tools: { 'echo-tool': echoTool },
    });

    const result = await agent.stream('test message', {
      memory: {
        thread: 'thread-save-per-step-model-output',
        resource: 'resource-save-per-step-model-output',
      },
      savePerStep: true,
    });

    await result.consumeStream();

    expect(persistedSnapshots.length).toBeGreaterThan(0);

    const recalled = await mockMemory.recall({
      threadId: 'thread-save-per-step-model-output',
      resourceId: 'resource-save-per-step-model-output',
    });

    const assistantMessages = recalled.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    const toolResultPart = assistantMessages
      .flatMap(message => message.content.parts ?? [])
      .find(
        part =>
          part.type === 'tool-invocation' &&
          (part as any).toolInvocation?.toolCallId === 'call-1' &&
          (part as any).toolInvocation?.state === 'result',
      ) as any;

    const persistedAssistantText = assistantMessages
      .flatMap(message => message.content.parts ?? [])
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');

    expect(toolResultPart).toBeDefined();
    expect(toolResultPart.toolInvocation.result).toEqual(rawResult);
    expect(toolResultPart.providerMetadata?.mastra?.modelOutput).toEqual(modelOutput);
    expect(persistedAssistantText).toContain('Response after tool');
  });

  it('should persist messages from completed steps when stream is aborted', async () => {
    let doStreamCallCount = 0;

    // Cancellation cannot erase submitted history or completed tool calls/results: they are
    // historical facts, and the tool may already have caused an irreversible external side effect.
    // Model that produces a tool call on first invocation, then text on second
    const toolCallModel = new MockLanguageModelV2({
      doStream: async () => {
        doStreamCallCount++;
        if (doStreamCallCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-0' },
              { type: 'text-delta', id: 'text-0', delta: 'Response after tool' },
              { type: 'text-end', id: 'text-0' },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'echo-tool',
                input: '{"input": "hello"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response after tool' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const mockMemory = new MockMemory();
    const memoryStore = await mockMemory.storage.getStore('memory');
    const saveMessagesSpy = vi.spyOn(memoryStore!, 'saveMessages');
    let outputProcessorCalls = 0;

    const echoTool = createTool({
      id: 'echo-tool',
      description: 'Echoes the input',
      inputSchema: z.object({ input: z.string() }),
      execute: async input => ({ output: input.input }),
    });

    const agent = new Agent({
      id: 'save-per-step-abort-agent',
      name: 'Save Per Step Abort Test',
      instructions: 'test',
      model: toolCallModel,
      memory: mockMemory,
      tools: { 'echo-tool': echoTool },
      outputProcessors: [
        {
          id: 'completed-step-abort-output-processor',
          processOutputResult: async ({ messageList }) => {
            outputProcessorCalls++;
            return messageList;
          },
        },
      ],
    });

    const abortController = new AbortController();
    let stepFinishCount = 0;

    const result = await agent.stream('test message', {
      memory: {
        thread: 'thread-save-per-step-abort',
        resource: 'resource-save-per-step-abort',
      },
      abortSignal: abortController.signal,
      onStepFinish: async () => {
        stepFinishCount++;
      },
      onChunk: async chunk => {
        if (doStreamCallCount === 2 && chunk.type === 'text-delta') {
          abortController.abort();
        }
      },
    });

    // Consume the stream (may throw due to abort)
    try {
      for await (const _chunk of result.fullStream) {
        // consume
      }
    } catch {
      // Expected: stream may error on abort
    }

    expect(stepFinishCount).toBe(1);
    expect(outputProcessorCalls).toBe(1);

    const recalled = await mockMemory.recall({
      threadId: 'thread-save-per-step-abort',
      resourceId: 'resource-save-per-step-abort',
    });
    expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant', 'assistant']);
    expect(new Set(recalled.messages.map(message => message.id)).size).toBe(3);
    expect(saveMessagesSpy).toHaveBeenCalledTimes(1);
    expect(saveMessagesSpy.mock.calls[0]?.[0].messages.map(message => message.id)).toEqual(
      recalled.messages.map(message => message.id),
    );

    const toolInvocationParts = recalled.messages
      .flatMap(message => message.content.parts ?? [])
      .filter(part => part.type === 'tool-invocation');
    expect(toolInvocationParts).toHaveLength(1);
    expect(toolInvocationParts[0]).toMatchObject({
      toolInvocation: {
        toolCallId: 'call-1',
        toolName: 'echo-tool',
        state: 'result',
        args: { input: 'hello' },
        result: { output: 'hello' },
      },
    });
    expect(
      recalled.messages
        .flatMap(message => message.content.parts ?? [])
        .filter(part => part.type === 'text')
        .map(part => part.text),
    ).toEqual(['test message', 'Response after tool', 'Response after tool']);
  });

  it('should preserve savePerStep persistence when aborting after a completed step', async () => {
    let doStreamCallCount = 0;
    const toolCallModel = new MockLanguageModelV2({
      doStream: async () => {
        doStreamCallCount++;
        if (doStreamCallCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'echo-tool',
                input: '{"input": "hello"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response after tool' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
    const mockMemory = new MockMemory();
    const saveMessagesSpy = vi.spyOn(mockMemory, 'saveMessages');
    const echoTool = createTool({
      id: 'echo-tool',
      description: 'Echoes the input',
      inputSchema: z.object({ input: z.string() }),
      execute: async input => ({ output: input.input }),
    });
    const agent = new Agent({
      id: 'save-per-step-abort-regression-agent',
      name: 'Save Per Step Abort Regression',
      instructions: 'test',
      model: toolCallModel,
      memory: mockMemory,
      tools: { 'echo-tool': echoTool },
    });
    const abortController = new AbortController();
    let stepFinishCount = 0;

    const result = await agent.stream('test message', {
      memory: {
        thread: 'thread-save-per-step-abort-regression',
        resource: 'resource-save-per-step-abort-regression',
      },
      savePerStep: true,
      abortSignal: abortController.signal,
      onStepFinish: async () => {
        stepFinishCount++;
        if (stepFinishCount === 1) {
          abortController.abort();
        }
      },
    });

    try {
      await result.consumeStream();
    } catch {
      // Expected: stream may error on abort.
    }

    expect(stepFinishCount).toBeGreaterThanOrEqual(1);
    expect(saveMessagesSpy).toHaveBeenCalled();
    const recalled = await mockMemory.recall({
      threadId: 'thread-save-per-step-abort-regression',
      resourceId: 'resource-save-per-step-abort-regression',
    });
    expect(recalled.messages.some(message => message.role === 'user')).toBe(true);
  });
});
