import type { TransformStreamDefaultController } from 'node:stream/web';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod/v4';
import type { Agent } from '../../agent';
import { MessageList } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { ProcessOutputStepArgs } from '../index';
import { StructuredOutputProcessor } from './structured-output';

describe('StructuredOutputProcessor', () => {
  const testSchema = z.object({
    color: z.string(),
    intensity: z.string(),
    count: z.number().optional(),
  });

  let processor: StructuredOutputProcessor<z.infer<typeof testSchema>>;
  let mockModel: MockLanguageModelV2;

  // Helper to create a mock controller that captures enqueued chunks
  function createMockController() {
    const enqueuedChunks: any[] = [];
    return {
      controller: {
        enqueue: vi.fn((chunk: any) => {
          enqueuedChunks.push(chunk);
        }),
        terminate: vi.fn(),
        error: vi.fn(),
      } as unknown as TransformStreamDefaultController<any>,
      enqueuedChunks,
    };
  }

  // Helper to create a mock abort function
  function createMockAbort() {
    return vi.fn((reason?: string, options = {}) => {
      throw new TripWire(reason || 'Aborted', options);
    }) as any;
  }

  function outputStepArgs(
    state: Record<string, unknown>,
    abort: ProcessOutputStepArgs['abort'],
  ): ProcessOutputStepArgs {
    return {
      state,
      abort,
      messages: [],
      messageList: new MessageList(),
      systemMessages: [],
      steps: [],
      stepNumber: 0,
      retryCount: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta' as const, id: 'text-1', delta: '{"color": "blue", "intensity": "bright"}' },
        ]),
      }),
    });

    processor = new StructuredOutputProcessor({
      schema: testSchema,
      model: mockModel,
      errorStrategy: 'strict',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('__registerMastra', () => {
    it('should propagate mastra registration to the internal structuring agent', () => {
      const mastra = new Mastra({ logger: false });

      expect((processor as any).structuringAgent.getMastraInstance()).toBeUndefined();

      (processor as any).__registerMastra(mastra);

      expect((processor as any).structuringAgent.getMastraInstance()).toBe(mastra);
    });
  });

  describe('logger and recovery propagation', () => {
    it('registers the explicit logger immediately and preserves it over the Mastra logger', () => {
      const logger = new ConsoleLogger({ level: 'error' });
      const child = vi.spyOn(logger, 'child');
      const mastra = new Mastra({ logger: new ConsoleLogger({ level: 'error' }) });
      const loggingProcessor = new StructuredOutputProcessor({ schema: testSchema, model: mockModel, logger });

      expect(child).toHaveBeenLastCalledWith({ component: 'AGENT' });
      expect(loggingProcessor['structuringAgent']['logger']).toBe(child.mock.results.at(-1)?.value);
      loggingProcessor.__registerMastra(mastra);
      expect(child).toHaveBeenCalledTimes(2);
      expect(loggingProcessor['structuringAgent']['logger']).toBe(child.mock.results.at(-1)?.value);
      expect(loggingProcessor['structuringAgent'].getMastraInstance()).toBe(mastra);
    });

    it('inherits the Mastra logger when no processor logger was supplied', () => {
      const logger = new ConsoleLogger({ level: 'error' });
      const child = vi.spyOn(logger, 'child');
      processor.__registerMastra(new Mastra({ logger }));
      expect(child).toHaveBeenLastCalledWith({ component: 'AGENT' });
      expect(processor['structuringAgent']['logger']).toBe(child.mock.results.at(-1)?.value);
    });

    it('preserves upstream error chunks when fallback has no value', async () => {
      const recoveryProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'fallback',
      });
      const errorChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'error',
        payload: { error: new Error('Invalid structured output') },
      };
      vi.spyOn(recoveryProcessor['structuringAgent'], 'stream').mockResolvedValue({
        fullStream: convertArrayToReadableStream([errorChunk]),
      } as any);
      const { controller, enqueuedChunks } = createMockController();
      await recoveryProcessor.processOutputStream({
        part: {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        },
        streamParts: [],
        state: { controller },
        abort: createMockAbort(),
        retryCount: 0,
      });
      expect(enqueuedChunks).toEqual([{ ...errorChunk, metadata: { from: 'structured-output' } }]);
    });

    describe.each([false, true])('useAgent: %s', useAgent => {
      it.each(['warn', 'fallback', 'missing-fallback'] as const)(
        'forwards %s policy and preserves nested metadata',
        async policy => {
          const fallbackValue = { color: 'default', intensity: 'medium' };
          const recoveryProcessor = new StructuredOutputProcessor({
            schema: testSchema,
            model: mockModel,
            useAgent,
            errorStrategy: policy === 'warn' ? 'warn' : 'fallback',
            ...(policy === 'fallback' ? { fallbackValue } : {}),
          });
          const resultChunk: ChunkType = {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: fallbackValue,
            metadata: { fallback: true, from: 'nested', custom: 'preserved' },
          };
          const stream = { fullStream: convertArrayToReadableStream([resultChunk]) };
          const internalStream = vi.spyOn(recoveryProcessor['structuringAgent'], 'stream');
          const agent = { stream: vi.fn().mockResolvedValue(stream) } as unknown as Agent;
          recoveryProcessor.setAgent(agent);
          if (!useAgent) internalStream.mockResolvedValue(stream as any);
          const requestContext = new RequestContext();
          requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-123');
          const { controller, enqueuedChunks } = createMockController();
          await recoveryProcessor.processOutputStream({
            part: {
              runId: 'test-run',
              from: ChunkFrom.AGENT,
              type: 'finish',
              payload: {
                stepResult: { reason: 'stop' },
                output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
                metadata: {},
                messages: { all: [], user: [], nonUser: [] },
              },
            },
            streamParts: [],
            state: { controller },
            abort: createMockAbort(),
            retryCount: 0,
            requestContext,
          });

          const selectedStream = useAgent ? agent.stream : internalStream;
          expect(selectedStream).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              structuredOutput: {
                schema: testSchema,
                jsonPromptInjection: undefined,
                errorStrategy: policy === 'missing-fallback' ? 'strict' : policy,
                ...(policy === 'fallback' ? { fallbackValue } : {}),
              },
            }),
          );
          expect(useAgent ? internalStream : agent.stream).not.toHaveBeenCalled();
          expect(enqueuedChunks).toEqual([
            { ...resultChunk, metadata: { fallback: true, from: 'structured-output', custom: 'preserved' } },
          ]);
        },
      );
    });
  });

  describe('processOutputStream', () => {
    it('should pass through non-finish chunks unchanged', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const textChunk = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'text-delta' as const,
        payload: { id: 'test-id', text: 'Hello' },
      };

      const result = await processor.processOutputStream({
        part: textChunk,
        streamParts: [],
        state: { controller },
        abort,
        retryCount: 0,
      });

      expect(result).toBe(textChunk);
      expect(controller.enqueue).not.toHaveBeenCalled();
    });

    it.each(['error-chunk', 'thrown'] as const)('should defer strict %s failures to the output step', async failure => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const upstreamError = new Error('Structuring failed');
      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: upstreamError },
          },
        ]),
      };

      const streamSpy = vi.spyOn(processor['structuringAgent'], 'stream');
      if (failure === 'thrown') streamSpy.mockRejectedValueOnce(upstreamError);
      else streamSpy.mockResolvedValueOnce(mockStream as any);
      const reason = `[StructuredOutputProcessor] ${failure === 'thrown' ? 'Structured output processing failed' : 'Structuring failed'}: Structuring failed`;

      const state = { controller };
      await expect(
        processor.processOutputStream({ part: finishChunk, streamParts: [], state, abort, retryCount: 0 }),
      ).resolves.toBe(finishChunk);
      expect(abort).not.toHaveBeenCalled();
      expect(controller.enqueue).not.toHaveBeenCalled();
      let tripwire: TripWire<{ error: Error }> | undefined;
      try {
        processor.processOutputStep(outputStepArgs(state, abort));
      } catch (error) {
        tripwire = error as TripWire<{ error: Error }>;
      }
      expect(tripwire).toBeInstanceOf(TripWire);
      expect(tripwire?.message).toBe(reason);
      expect(tripwire?.options).toEqual({ retry: true, metadata: { error: upstreamError } });
      expect(tripwire?.options.metadata?.error).toBe(upstreamError);
      expect(abort).toHaveBeenCalledWith(reason, { retry: true, metadata: { error: upstreamError } });
      const stepArgs = outputStepArgs(state, abort);
      expect(processor.processOutputStep(stepArgs)).toBe(stepArgs.messages);

      const objectChunk = {
        type: 'object-result',
        object: { color: 'blue', intensity: 'bright' },
      };
      streamSpy.mockResolvedValueOnce({ fullStream: convertArrayToReadableStream([objectChunk]) } as any);
      await processor.processOutputStream({ part: finishChunk, streamParts: [], state, abort, retryCount: 1 });
      expect(streamSpy).toHaveBeenCalledTimes(2);
      expect(controller.enqueue).toHaveBeenCalledWith({ ...objectChunk, metadata: { from: 'structured-output' } });
      expect(processor.processOutputStep(stepArgs)).toBe(stepArgs.messages);
      expect(abort).toHaveBeenCalledTimes(1);
    });

    it('should preserve upstream error details in strict logs', async () => {
      const upstreamError = new Error('No recording found for gpt-5.4');
      (upstreamError as any).statusCode = 404;
      (upstreamError as any).requestId = 'req_structuring_123';

      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      };

      const loggingProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        logger: mockLogger as any,
      });

      const { controller } = createMockController();
      const abort = createMockAbort();
      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: upstreamError },
          },
        ]),
      };

      vi.spyOn(loggingProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      const state = { controller };
      await loggingProcessor.processOutputStream({ part: finishChunk, streamParts: [], state, abort, retryCount: 0 });
      expect(abort).not.toHaveBeenCalled();
      expect(() => loggingProcessor.processOutputStep(outputStepArgs(state, abort))).toThrow(
        '[StructuredOutputProcessor] Structuring failed: No recording found for gpt-5.4',
      );
      expect(abort).toHaveBeenCalledWith(
        '[StructuredOutputProcessor] Structuring failed: No recording found for gpt-5.4',
        { retry: true, metadata: { error: upstreamError } },
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[StructuredOutputProcessor] Structuring failed: No recording found for gpt-5.4',
        upstreamError,
      );
    });

    it('should use the explicit agent with model override and read-only memory when request context is available', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();
      const agent = {
        stream: vi.fn().mockResolvedValue({
          fullStream: convertArrayToReadableStream([
            {
              runId: 'test-run',
              from: ChunkFrom.AGENT,
              type: 'object-result',
              object: { color: 'blue', intensity: 'bright' },
            },
          ]),
        }),
      } as unknown as Agent;
      const fallbackStreamSpy = vi.spyOn(processor['structuringAgent'], 'stream');

      processor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        useAgent: true,
      });
      processor.setAgent(agent);

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-123');
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-456');

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: { id: 'text-1', text: 'The answer is blue and bright' },
          },
        ],
        state: { controller },
        abort,
        retryCount: 0,
        requestContext,
      });

      expect(agent.stream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Extract and structure information from the conversation so far.'),
              }),
            ]),
          }),
        ]),
        expect.objectContaining({
          model: mockModel,
          requestContext: expect.any(RequestContext),
          toolChoice: 'none',
          structuredOutput: {
            schema: testSchema,
            jsonPromptInjection: undefined,
            errorStrategy: 'strict',
          },
          memory: {
            thread: 'thread-123',
            resource: 'resource-456',
            options: { readOnly: true },
          },
        }),
      );
      const [, options] = vi.mocked(agent.stream).mock.calls[0]!;
      expect(options.requestContext).not.toBe(requestContext);
      expect(Array.from(options.requestContext?.entries() ?? [])).toEqual(Array.from(requestContext.entries()));
      expect(fallbackStreamSpy).not.toHaveBeenCalled();
    });

    it('should use the explicit agent with thread-only read-only memory when resource context is missing', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();
      const agent = {
        stream: vi.fn().mockResolvedValue({
          fullStream: convertArrayToReadableStream([
            {
              runId: 'test-run',
              from: ChunkFrom.AGENT,
              type: 'object-result',
              object: { color: 'green', intensity: 'soft' },
            },
          ]),
        }),
      } as unknown as Agent;
      const fallbackStreamSpy = vi.spyOn(processor['structuringAgent'], 'stream');

      processor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        useAgent: true,
      });
      processor.setAgent(agent);

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-123');

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: { id: 'text-1', text: 'The answer is green and soft' },
          },
        ],
        state: { controller },
        abort,
        retryCount: 0,
        requestContext,
      });

      expect(agent.stream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Extract and structure information from the conversation so far.'),
              }),
            ]),
          }),
        ]),
        expect.objectContaining({
          model: mockModel,
          requestContext: expect.any(RequestContext),
          toolChoice: 'none',
          structuredOutput: {
            schema: testSchema,
            jsonPromptInjection: undefined,
            errorStrategy: 'strict',
          },
          memory: {
            thread: 'thread-123',
            options: { readOnly: true },
          },
        }),
      );
      const [, options] = vi.mocked(agent.stream).mock.calls[0]!;
      expect(options.requestContext).not.toBe(requestContext);
      expect(Array.from(options.requestContext?.entries() ?? [])).toEqual(Array.from(requestContext.entries()));
      expect(agent.stream).not.toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          memory: expect.objectContaining({
            resource: expect.anything(),
          }),
        }),
      );
      expect(fallbackStreamSpy).not.toHaveBeenCalled();
    });

    it('should fall back to serialized message list memory when request context is missing', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();
      const agent = {
        stream: vi.fn().mockResolvedValue({
          fullStream: convertArrayToReadableStream([
            {
              runId: 'test-run',
              from: ChunkFrom.AGENT,
              type: 'object-result',
              object: { color: 'violet', intensity: 'deep' },
            },
          ]),
        }),
      } as unknown as Agent;
      const fallbackStreamSpy = vi.spyOn(processor['structuringAgent'], 'stream');

      processor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        useAgent: true,
      });
      processor.setAgent(agent);

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: { id: 'text-1', text: 'The answer is violet and deep' },
          },
        ],
        state: { controller },
        abort,
        retryCount: 0,
        messageList: {
          serialize: () => ({
            memoryInfo: { threadId: 'thread-123', resourceId: 'resource-456' },
          }),
        },
      });

      expect(agent.stream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Extract and structure information from the conversation so far.'),
              }),
            ]),
          }),
        ]),
        expect.objectContaining({
          model: mockModel,
          toolChoice: 'none',
          structuredOutput: {
            schema: testSchema,
            jsonPromptInjection: undefined,
            errorStrategy: 'strict',
          },
          memory: {
            thread: 'thread-123',
            resource: 'resource-456',
            options: { readOnly: true },
          },
        }),
      );
      expect(fallbackStreamSpy).not.toHaveBeenCalled();
    });

    it('should include unsaved current-run messages when reusing the explicit agent', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();
      const agent = {
        stream: vi.fn().mockResolvedValue({
          fullStream: convertArrayToReadableStream([
            {
              runId: 'test-run',
              from: ChunkFrom.AGENT,
              type: 'object-result',
              object: { color: 'violet', intensity: 'deep' },
            },
          ]),
        }),
      } as unknown as Agent;

      processor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        useAgent: true,
      });
      processor.setAgent(agent);

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-123');
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-456');

      const unsavedInputMessage = {
        id: 'input-1',
        role: 'user' as const,
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: 'My favorite color is violet.' }],
        },
        createdAt: new Date(0),
        threadId: 'thread-123',
        resourceId: 'resource-456',
      };
      const unsavedResponseMessage = {
        id: 'response-1',
        role: 'assistant' as const,
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: 'Acknowledged.' }],
        },
        createdAt: new Date(0),
        threadId: 'thread-123',
        resourceId: 'resource-456',
      };

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: { id: 'text-1', text: 'Return a profile summary.' },
          },
        ],
        state: { controller },
        abort,
        retryCount: 0,
        requestContext,
        messageList: {
          get: {
            input: { db: () => [unsavedInputMessage] },
            response: { db: () => [unsavedResponseMessage] },
          },
          serialize: () => ({
            memoryInfo: { threadId: 'thread-123', resourceId: 'resource-456' },
          }),
        } as any,
      });

      expect(agent.stream).toHaveBeenCalledWith(
        [
          unsavedInputMessage,
          unsavedResponseMessage,
          {
            role: 'user',
            content: [
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Extract and structure information from the conversation so far.'),
              }),
            ],
          },
        ],
        expect.objectContaining({
          model: mockModel,
          requestContext: expect.any(RequestContext),
          toolChoice: 'none',
          structuredOutput: {
            schema: testSchema,
            jsonPromptInjection: undefined,
            errorStrategy: 'strict',
          },
          memory: {
            thread: 'thread-123',
            resource: 'resource-456',
            options: { readOnly: true },
          },
        }),
      );
      const [, options] = vi.mocked(agent.stream).mock.calls[0]!;
      expect(options.requestContext).not.toBe(requestContext);
      expect(Array.from(options.requestContext?.entries() ?? [])).toEqual(Array.from(requestContext.entries()));
    });

    it('should surface plain object error messages', async () => {
      const upstreamError = { message: 'Schema failed' };
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      };

      const loggingProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
        logger: mockLogger as any,
      });

      const { controller } = createMockController();
      const abort = createMockAbort();
      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: upstreamError },
          },
        ]),
      };

      vi.spyOn(loggingProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      const state = { controller };
      await loggingProcessor.processOutputStream({ part: finishChunk, streamParts: [], state, abort, retryCount: 0 });
      expect(abort).not.toHaveBeenCalled();
      expect(() => loggingProcessor.processOutputStep(outputStepArgs(state, abort))).toThrow(
        '[StructuredOutputProcessor] Structuring failed: Schema failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[StructuredOutputProcessor] Structuring failed: Schema failed',
        upstreamError,
      );
    });

    it('should enqueue fallback value with fallback strategy', async () => {
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      };
      const fallbackProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'fallback',
        fallbackValue: { color: 'default', intensity: 'medium' },
        logger: mockLogger as any,
      });

      const { controller, enqueuedChunks } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const upstreamError = { message: 'Structuring failed' };
      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: upstreamError },
          },
        ]),
      };

      vi.spyOn(fallbackProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await fallbackProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
        retryCount: 0,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[StructuredOutputProcessor] Structuring failed: Structuring failed (using fallback)',
        upstreamError,
      );
      expect(enqueuedChunks).toHaveLength(1);
      expect(enqueuedChunks[0].type).toBe('object-result');
      expect(enqueuedChunks[0].object).toEqual({ color: 'default', intensity: 'medium' });
      expect(enqueuedChunks[0].metadata.fallback).toBe(true);
    });

    it('should warn but not abort with warn strategy', async () => {
      const mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };
      const warnProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'warn',
        logger: mockLogger as any,
      });

      const { controller } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const upstreamError = { message: 'Structuring failed' };
      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: upstreamError },
          },
        ]),
      };

      vi.spyOn(warnProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await warnProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
        retryCount: 0,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[StructuredOutputProcessor] Structuring failed: Structuring failed',
        upstreamError,
      );
      expect(abort).not.toHaveBeenCalled();
    });

    it('should only process once even if called multiple times', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'blue', intensity: 'bright' },
          },
        ]),
      };

      const streamSpy = vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      // Call processOutputStream twice with finish chunks from the same request.
      const state = { controller };
      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort,
        retryCount: 0,
      });

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort,
        retryCount: 0,
      });

      // Should only call stream once (guarded by request-local state)
      expect(streamSpy).toHaveBeenCalledTimes(1);
    });

    it('isolates structuring guards and failures between processor instances sharing one state', async () => {
      const firstProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
      });
      const secondProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'strict',
      });
      const { controller } = createMockController();
      const firstAbort = createMockAbort();
      const secondAbort = createMockAbort();
      const state = { controller };
      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };
      const firstError = new Error('first processor failed');
      const errorChunk = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'error',
        payload: { error: firstError },
      };
      const objectChunk = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'object-result',
        object: { color: 'blue', intensity: 'bright' },
      };
      const firstStreamSpy = vi
        .spyOn(firstProcessor['structuringAgent'], 'stream')
        .mockResolvedValueOnce({ fullStream: convertArrayToReadableStream([errorChunk]) } as any)
        .mockResolvedValueOnce({ fullStream: convertArrayToReadableStream([objectChunk]) } as any);
      const secondStreamSpy = vi
        .spyOn(secondProcessor['structuringAgent'], 'stream')
        .mockResolvedValue({ fullStream: convertArrayToReadableStream([objectChunk]) } as any);

      await firstProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort: firstAbort,
        retryCount: 0,
      });
      await secondProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort: secondAbort,
        retryCount: 0,
      });

      expect(firstStreamSpy).toHaveBeenCalledTimes(1);
      expect(secondStreamSpy).toHaveBeenCalledTimes(1);
      const secondStepArgs = outputStepArgs(state, secondAbort);
      expect(secondProcessor.processOutputStep(secondStepArgs)).toBe(secondStepArgs.messages);
      expect(secondAbort).not.toHaveBeenCalled();

      const firstReason = '[StructuredOutputProcessor] Structuring failed: first processor failed';
      expect(() => firstProcessor.processOutputStep(outputStepArgs(state, firstAbort))).toThrow(firstReason);
      expect(firstAbort).toHaveBeenCalledWith(firstReason, { retry: true, metadata: { error: firstError } });

      await firstProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort: firstAbort,
        retryCount: 1,
      });
      await secondProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state,
        abort: secondAbort,
        retryCount: 1,
      });

      expect(firstStreamSpy).toHaveBeenCalledTimes(2);
      expect(secondStreamSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('prompt building', () => {
    it('should build prompt from different chunk types', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const streamParts: ChunkType[] = [
        // Text chunks
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: 'text-1', text: 'User input' },
        },
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: 'text-2', text: 'Agent response' },
        },
        // Tool call chunk
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'tool-call' as const,
          payload: {
            toolCallId: 'call-1',
            toolName: 'calculator',
            // @ts-expect-error - tool call chunk args are unknown
            args: { operation: 'add', a: 1, b: 2 },
            output: 3,
          },
        },
        // Tool result chunk
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'tool-result' as const,
          payload: {
            toolCallId: 'call-1',
            toolName: 'calculator',
            result: 3,
          },
        },
      ];

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      // Mock the structuring agent
      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'green', intensity: 'low', count: 5 },
          },
        ]),
      };

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await processor.processOutputStream({
        part: finishChunk,
        streamParts,
        state: { controller },
        abort,
        retryCount: 0,
      });

      // Check that the prompt was built correctly with all the different sections
      const call = (processor['structuringAgent'].stream as any).mock.calls[0];
      const prompt = call[0];

      expect(prompt).toContain('# Assistant Response');
      expect(prompt).toContain('User input');
      expect(prompt).toContain('Agent response');
      expect(prompt).toContain('# Tool Calls');
      expect(prompt).toContain('## calculator');
      expect(prompt).toContain('### Input:');
      expect(prompt).toContain('### Output:');
      expect(prompt).toContain('# Tool Results');
      expect(prompt).toContain('calculator:');
    });
  });

  describe('instruction generation', () => {
    it('should generate instructions based on schema', () => {
      const instructions = (processor as any).generateInstructions();

      expect(instructions).toContain('data structuring specialist');
      expect(instructions).toContain('JSON format');
      expect(instructions).toContain('Extract relevant information');
      expect(typeof instructions).toBe('string');
    });

    it('should use custom instructions if provided', async () => {
      const customInstructions = 'Custom structuring instructions';
      const customProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        instructions: customInstructions,
      });

      const agent = (customProcessor as unknown as { structuringAgent: Agent }).structuringAgent;
      // The custom instructions should be used instead of generated ones
      expect(await agent.getInstructions()).toBe(customInstructions);
    });
  });

  describe('integration scenarios', () => {
    it('should handle reasoning chunks', async () => {
      const { controller } = createMockController();
      const abort = createMockAbort();

      const streamParts = [
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'reasoning-delta' as const,
          payload: { id: 'text-1', text: 'I need to analyze the color and intensity' },
        },
        {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'text-delta' as const,
          payload: { id: 'text-2', text: 'The answer is blue and bright' },
        },
      ];

      const finishChunk: ChunkType = {
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        type: 'finish' as const,
        payload: {
          stepResult: { reason: 'stop' as const },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'object-result',
            object: { color: 'blue', intensity: 'bright' },
          },
        ]),
      };

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await processor.processOutputStream({
        part: finishChunk,
        streamParts,
        state: { controller },
        abort,
        retryCount: 0,
      });

      // Check that the prompt includes reasoning
      const call = (processor['structuringAgent'].stream as any).mock.calls[0];
      const prompt = call[0];

      expect(prompt).toContain('# Assistant Reasoning');
      expect(prompt).toContain('I need to analyze the color and intensity');
      expect(prompt).toContain('# Assistant Response');
      expect(prompt).toContain('The answer is blue and bright');
    });
  });
});
