import type { TransformStreamDefaultController } from 'node:stream/web';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import z from 'zod';
import type { Agent } from '../../agent';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { StructuredOutputProcessor } from './structured-output';

describe('StructuredOutputProcessor', () => {
  const testSchema = z.object({
    color: z.string(),
    intensity: z.string(),
    count: z.number().optional(),
  });

  let processor: StructuredOutputProcessor<typeof testSchema>;
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

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
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
        }),
      ).rejects.toThrow();
    });

    it('should enqueue fallback value with fallback strategy', async () => {
      const fallbackProcessor = new StructuredOutputProcessor({
        schema: testSchema,
        model: mockModel,
        errorStrategy: 'fallback',
        fallbackValue: { color: 'default', intensity: 'medium' },
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

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
          },
        ]),
      };

      vi.spyOn(fallbackProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await fallbackProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

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

      const mockStream = {
        fullStream: convertArrayToReadableStream([
          {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'error',
            payload: { error: new Error('Structuring failed') },
          },
        ]),
      };

      vi.spyOn(warnProcessor['structuringAgent'], 'stream').mockResolvedValue(mockStream as any);

      await warnProcessor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
      });

      expect(mockLogger.warn).toHaveBeenCalled();
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
      });

      await processor.processOutputStream({
        part: finishChunk,
        streamParts: [],
        state: { controller },
        abort,
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
