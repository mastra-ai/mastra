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
function createStepFinishChunk(runId: string, providerMetadata?: Record<string, unknown>): ChunkType {
  return {
    type: 'step-finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'step-1',
      output: {
        steps: [],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
function createFinishChunk(runId: string, providerMetadata?: Record<string, unknown>): ChunkType {
  return {
    type: 'finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'finish-1',
      output: {
        steps: [],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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
  });
});
