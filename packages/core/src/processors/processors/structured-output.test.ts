import type { TransformStreamDefaultController } from 'node:stream/web';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod/v4';
import type { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
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
    return vi.fn((reason?: string) => {
      throw new Error(reason || 'Aborted');
    }) as any;
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

    it('should call abort with strict error strategy', async () => {
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

      vi.spyOn(processor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await expect(
        processor.processOutputStream({
          part: finishChunk,
          streamParts: [],
          state: { controller },
          abort,
          retryCount: 0,
        }),
      ).rejects.toThrow('[StructuredOutputProcessor] Structuring failed: Structuring failed');
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

      await expect(
        loggingProcessor.processOutputStream({
          part: finishChunk,
          streamParts: [],
          state: { controller },
          abort,
          retryCount: 0,
        }),
      ).rejects.toThrow('[StructuredOutputProcessor] Structuring failed: No recording found for gpt-5.4');

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

      await expect(
        loggingProcessor.processOutputStream({
          part: finishChunk,
          streamParts: [],
          state: { controller },
          abort,
          retryCount: 0,
        }),
      ).rejects.toThrow('[StructuredOutputProcessor] Structuring failed: Schema failed');

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

      // Call processOutputStream twice with finish chunks
      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
        retryCount: 0,
      });

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
        retryCount: 0,
      });

      // Should only call stream once (guarded by isStructuringAgentStreamStarted)
      expect(streamSpy).toHaveBeenCalledTimes(1);
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
