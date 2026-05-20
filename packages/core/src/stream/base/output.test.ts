import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { Processor, ProcessorStreamWriter } from '../../processors';
import { ChunkFrom } from '../types';
import type { ChunkType } from '../types';
import { MastraModelOutput } from './output';

/**
 * Creates a ReadableStream that emits the given chunks in order.
 */
function createChunkStream<OUTPUT = undefined>(chunks: ChunkType<OUTPUT>[]): ReadableStream<ChunkType<OUTPUT>> {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/**
 * Minimal step-finish chunk to populate bufferedSteps before the finish chunk.
 */
function createStepFinishChunk(
  runId: string,
  providerMetadata?: Record<string, unknown>,
  usageOverride?: Record<string, unknown>,
): ChunkType {
  return {
    type: 'step-finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'step-1',
      output: {
        steps: [],
        usage: usageOverride ?? { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
      stepResult: {
        reason: 'stop',
        warnings: [],
        isContinued: false,
      },
      metadata: providerMetadata ? { providerMetadata } : {},
      messages: { nonUser: [], all: [] },
      providerMetadata,
    },
  } as ChunkType;
}

/**
 * Minimal finish chunk for the outer MastraModelOutput.
 */
function createFinishChunk(
  runId: string,
  providerMetadata?: Record<string, unknown>,
  usageOverride?: Record<string, unknown>,
): ChunkType {
  return {
    type: 'finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'finish-1',
      output: {
        steps: [],
        usage: usageOverride ?? { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
      stepResult: {
        reason: 'stop',
        warnings: [],
        isContinued: false,
      },
      metadata: {},
      providerMetadata,
      messages: { nonUser: [], all: [] },
    },
  } as ChunkType;
}

describe('MastraModelOutput', () => {
  describe('writer in output processors (outer context)', () => {
    it('should pass a defined writer to processOutputResult', async () => {
      let receivedWriter: ProcessorStreamWriter | undefined;

      const processor: Processor = {
        id: 'writer-capture',
        name: 'Writer Capture',
        processOutputResult: async ({ messages, writer }) => {
          receivedWriter = writer;
          return messages;
        },
      };

      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      // Add a response message so the processor has something to work with
      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          outputProcessors: [processor],
          // isLLMExecutionStep is NOT set — this is the outer context
        },
      });

      await output.consumeStream();

      expect(receivedWriter).toBeDefined();
      expect(typeof receivedWriter!.custom).toBe('function');
    });

    it('should deliver custom chunks emitted via writer before the finish chunk', async () => {
      const processor: Processor = {
        id: 'custom-emitter',
        name: 'Custom Emitter',
        processOutputResult: async ({ messages, writer }) => {
          await writer!.custom({ type: 'data-moderation', data: { flagged: true } });
          return messages;
        },
      };

      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          outputProcessors: [processor],
        },
      });

      // Collect all chunks from the fullStream
      const chunks: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
      }

      const customChunk = chunks.find(c => c.type === 'data-moderation');
      const finishIndex = chunks.findIndex(c => c.type === 'finish');
      const customIndex = chunks.findIndex(c => c.type === 'data-moderation');

      expect(customChunk).toBeDefined();
      expect((customChunk as any).data).toEqual({ flagged: true });
      // Custom chunk should appear before the finish chunk
      expect(customIndex).toBeLessThan(finishIndex);
    });

    it('should include traceId and spanId in the final stream result when tracing context exists', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);
      const agentRunSpan = {
        id: 'mastra-agent-span-id',
        externalTraceId: 'mastra-trace-id',
        isInternal: false,
        isValid: true,
      };
      const workflowStepSpan = {
        id: 'mastra-workflow-step-span-id',
        externalTraceId: 'mastra-trace-id',
        isInternal: true,
        isValid: true,
        parent: agentRunSpan,
      };
      const modelGenerationSpan = {
        id: 'mastra-model-span-id',
        externalTraceId: 'mastra-trace-id',
        isInternal: false,
        isValid: true,
        parent: workflowStepSpan,
      };
      const modelStepSpan = {
        id: 'mastra-model-step-span-id',
        externalTraceId: 'mastra-trace-id',
        isInternal: false,
        isValid: true,
        parent: modelGenerationSpan,
      };

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          tracingContext: {
            currentSpan: modelStepSpan,
          } as any,
        },
      });

      await output.consumeStream();
      const result = await output.getFullOutput();

      expect(result.traceId).toBe('mastra-trace-id');
      expect(result.spanId).toBe('mastra-agent-span-id');
    });

    it('should resolve top-level finish providerMetadata on the final output', async () => {
      const runId = 'test-run';
      const providerMetadata = {
        anthropic: {
          cacheReadInputTokens: 94,
          cacheCreationInputTokens: 6,
        },
      };
      const messageList = new MessageList({ threadId: 'test-thread' });

      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId, providerMetadata)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
        },
      });

      await output.consumeStream();

      expect(await output.providerMetadata).toEqual(providerMetadata);
    });

    it('should propagate arbitrary finish providerMetadata to steps and onFinish', async () => {
      const runId = 'test-run';
      const providerMetadata = {
        customProvider: {
          route: 'priority',
          finishMetrics: {
            latencyMs: 42,
            region: 'us-central1',
          },
        },
      };
      let onFinishPayload: any;
      const messageList = new MessageList({ threadId: 'test-thread' });

      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId, providerMetadata)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onFinish: async payload => {
            onFinishPayload = payload;
          },
        },
      });

      await output.consumeStream();

      expect(await output.providerMetadata).toEqual(providerMetadata);
      expect((await output.steps).at(-1)?.providerMetadata).toEqual(providerMetadata);
      expect(onFinishPayload?.providerMetadata).toEqual(providerMetadata);
    });

    it('should merge args from real tool-call into synthetic tool-call when synthetic args are empty', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      const toolCallId = 'tool-1';

      const stream = createChunkStream([
        // Simulate streaming start (creates synthetic later)
        {
          type: 'tool-call-input-streaming-start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId,
            toolName: 'my-tool',
          },
        },

        // No delta → synthetic will have empty args {}

        {
          type: 'tool-call-input-streaming-end',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId,
          },
        },

        // Real tool-call arrives with actual args
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId,
            toolName: 'my-tool',
            args: { query: 'SELECT 1' } as any,
          },
        },

        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      const toolCalls = await output.toolCalls;

      expect(toolCalls.length).toBeGreaterThan(0);
      expect(toolCalls[0].payload.args).toEqual({ query: 'SELECT 1' });
    });
  });

  describe('usage raw passthrough', () => {
    it('should expose raw usage in onStepFinish callback', async () => {
      const runId = 'test-run';
      const rawUsage = {
        inputTokens: { total: 12071, noCache: 323, cacheRead: 11748, cacheWrite: 0 },
        outputTokens: { total: 53, reasoning: 0 },
      };
      const stepUsage = {
        inputTokens: 12071,
        outputTokens: 53,
        totalTokens: 12124,
        cachedInputTokens: 11748,
        raw: rawUsage,
      };
      const messageList = new MessageList({ threadId: 'test-thread' });
      const stepPayloads: any[] = [];

      const stream = createChunkStream([
        createStepFinishChunk(runId, undefined, stepUsage),
        createFinishChunk(runId, undefined, stepUsage),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onStepFinish: async payload => {
            stepPayloads.push(payload);
          },
        },
      });

      await output.consumeStream();

      expect(stepPayloads).toHaveLength(1);
      expect(stepPayloads[0].usage.raw).toEqual(rawUsage);
      expect(stepPayloads[0].usage.cachedInputTokens).toBe(11748);
    });

    it('should expose raw usage in onFinish usage and totalUsage', async () => {
      const runId = 'test-run';
      const rawUsage = {
        inputTokens: { total: 12071, noCache: 323, cacheRead: 11748, cacheWrite: 0 },
        outputTokens: { total: 53, reasoning: 0 },
      };
      const stepUsage = {
        inputTokens: 12071,
        outputTokens: 53,
        totalTokens: 12124,
        cachedInputTokens: 11748,
        raw: rawUsage,
      };
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([
        createStepFinishChunk(runId, undefined, stepUsage),
        createFinishChunk(runId, undefined, stepUsage),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onFinish: async payload => {
            finishPayload = payload;
          },
        },
      });

      await output.consumeStream();

      expect(finishPayload?.usage?.raw).toEqual(rawUsage);
      expect(finishPayload?.totalUsage?.raw).toEqual(rawUsage);
      expect((await output.usage)?.raw).toEqual(rawUsage);
      expect((await output.totalUsage)?.raw).toEqual(rawUsage);
    });

    it('should keep the latest step raw usage across multiple steps', async () => {
      const runId = 'test-run';
      const firstRaw = {
        inputTokens: { total: 100, cacheRead: 0, cacheWrite: 100 },
        outputTokens: { total: 20 },
      };
      const secondRaw = {
        inputTokens: { total: 150, cacheRead: 100, cacheWrite: 0 },
        outputTokens: { total: 30 },
      };
      const firstUsage = {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        raw: firstRaw,
      };
      const secondUsage = {
        inputTokens: 150,
        outputTokens: 30,
        totalTokens: 180,
        cachedInputTokens: 100,
        raw: secondRaw,
      };
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([
        createStepFinishChunk(runId, undefined, firstUsage),
        createStepFinishChunk(runId, undefined, secondUsage),
        createFinishChunk(runId, undefined, secondUsage),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onFinish: async payload => {
            finishPayload = payload;
          },
        },
      });

      await output.consumeStream();

      expect(finishPayload?.totalUsage?.raw).toEqual(secondRaw);
      expect(finishPayload?.totalUsage?.inputTokens).toBe(250);
      expect(finishPayload?.totalUsage?.outputTokens).toBe(50);
    });

    it('should sum cacheCreationInputTokens across multi-step Anthropic runs', async () => {
      // Regression for PR #14674: per-step cacheWrite must be summed, not overwritten.
      const runId = 'test-run';
      const stepUsages = [
        {
          inputTokens: 4557,
          outputTokens: 113,
          totalTokens: 4670,
          cachedInputTokens: 3584,
          cacheCreationInputTokens: 967,
        },
        {
          inputTokens: 4848,
          outputTokens: 117,
          totalTokens: 4965,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 296,
        },
        {
          inputTokens: 8557,
          outputTokens: 1270,
          totalTokens: 9827,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 4005,
        },
      ];
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([
        createStepFinishChunk(runId, undefined, stepUsages[0]),
        createStepFinishChunk(runId, undefined, stepUsages[1]),
        createStepFinishChunk(runId, undefined, stepUsages[2]),
        createFinishChunk(runId, undefined, stepUsages[2]),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onFinish: async payload => {
            finishPayload = payload;
          },
        },
      });

      await output.consumeStream();

      expect(finishPayload?.totalUsage?.inputTokens).toBe(17962);
      expect(finishPayload?.totalUsage?.outputTokens).toBe(1500);
      expect(finishPayload?.totalUsage?.cachedInputTokens).toBe(12686);
      expect(finishPayload?.totalUsage?.cacheCreationInputTokens).toBe(5268);
    });

    it('should omit raw when upstream usage has no raw field', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onFinish: async payload => {
            finishPayload = payload;
          },
        },
      });

      await output.consumeStream();

      expect(finishPayload?.usage).toBeDefined();
      expect('raw' in finishPayload.usage).toBe(false);
      expect('raw' in finishPayload.totalUsage).toBe(false);
    });
  });
});
