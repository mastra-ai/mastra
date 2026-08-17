import { ReadableStream } from 'node:stream/web';
import { describe, expect, it, vi } from 'vitest';
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

function createTextDeltaChunk(runId: string, text: string): ChunkType {
  return {
    type: 'text-delta',
    runId,
    from: ChunkFrom.AGENT,
    payload: { id: 'text-1', text },
  } as ChunkType;
}

/**
 * Minimal goal evaluation chunk. `pending: true` marks an in-progress judge
 * update. `shouldContinue` mirrors the goal gate's continuation decision:
 * `true` on evaluations that loop into another judged iteration, `false` on
 * terminal evaluations.
 */
function createGoalChunk(
  runId: string,
  { pending, shouldContinue }: { pending?: boolean; shouldContinue?: boolean } = {},
): ChunkType {
  return {
    type: 'goal',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      objective: 'test objective',
      iteration: 1,
      maxRuns: 5,
      passed: shouldContinue === false,
      status: shouldContinue === false ? 'done' : 'active',
      results: [],
      duration: 0,
      timedOut: false,
      maxRunsReached: false,
      suppressFeedback: false,
      ...(shouldContinue !== undefined ? { shouldContinue } : {}),
      ...(pending ? { pending: true } : {}),
    },
  } as ChunkType;
}

/** Tool-call chunk for a completed (non-streaming) tool invocation. */
function createToolCallChunk(runId: string, toolCallId: string): ChunkType {
  return {
    type: 'tool-call',
    runId,
    from: ChunkFrom.AGENT,
    payload: { toolCallId, toolName: 'searchTool', args: { q: 'x' } },
  } as ChunkType;
}

/** Tool-result chunk matching a prior tool-call. */
function createToolResultChunk(runId: string, toolCallId: string): ChunkType {
  return {
    type: 'tool-result',
    runId,
    from: ChunkFrom.AGENT,
    payload: { toolCallId, toolName: 'searchTool', result: { hits: 3 } },
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

    it('exposes the step providerMetadata via _getImmediateProviderMetadata for output-step processors', async () => {
      const runId = 'test-run';
      const providerMetadata = {
        anthropic: { cacheReadInputTokens: 12 },
      };
      const messageList = new MessageList({ threadId: 'test-thread' });

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId, providerMetadata)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      expect(output._getImmediateProviderMetadata()).toEqual(providerMetadata);
    });

    it('surfaces guardrail providerMetadata on a content-filter block where steps is empty', async () => {
      // The RFC scenario: a Bedrock guardrail intervenes, the step finishes with
      // reason "content-filter", the completed-steps array is empty, and the
      // guardrail trace is only reachable through providerMetadata.
      const runId = 'test-run';
      const guardrailTrace = {
        bedrock: {
          trace: {
            guardrail: {
              actionReason: 'Guardrail blocked.',
              inputAssessment: {
                'guardrail-1': {
                  contentPolicy: { filters: [{ type: 'PROMPT_ATTACK', action: 'BLOCKED', confidence: 'HIGH' }] },
                },
              },
            },
          },
        },
      };
      const messageList = new MessageList({ threadId: 'test-thread' });

      const contentFilterFinish = {
        type: 'finish',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          id: 'finish-1',
          output: {
            steps: [],
            usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
          },
          stepResult: {
            reason: 'content-filter',
            warnings: [],
            isContinued: false,
          },
          metadata: {},
          providerMetadata: guardrailTrace,
          messages: { nonUser: [], all: [] },
        },
      } as ChunkType;

      const stream = createChunkStream([contentFilterFinish]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      // No completed step recorded, but the guardrail trace is still surfaced.
      expect(await output.steps).toHaveLength(0);
      expect(output._getImmediateFinishReason()).toBe('content-filter');
      expect(output._getImmediateProviderMetadata()).toEqual(guardrailTrace);
    });

    it('leaves _getImmediateProviderMetadata undefined when the step has no providerMetadata', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      expect(output._getImmediateProviderMetadata()).toBeUndefined();
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

    it('should call onFinish with the suspended payload shape when the stream suspends', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'partial answer' },
        },
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'findUserTool',
            args: { name: 'Dero Israel' },
            providerExecuted: false,
          },
        },
        {
          type: 'tool-call-approval',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'findUserTool',
            args: { name: 'Dero Israel' },
            resumeSchema: '{}',
          },
        },
      ] as ChunkType[]);

      const output = new MastraModelOutput({
        model: { modelId: '__GATEWAY_OPENAI_MODEL__', provider: 'test', version: 'v3' },
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

      // Core fields the AGENT_RUN span end reads.
      expect(finishPayload).toMatchObject({
        finishReason: 'suspended',
        suspendReason: 'tool-call-approval',
        toolName: 'findUserTool',
        toolCallId: 'call-1',
      });
      // Empty defaults keep the suspended callback payload contract-complete.
      expect(finishPayload.text).toBe('');
      expect(finishPayload.toolCalls).toEqual([]);
      expect(finishPayload.toolResults).toEqual([]);
      expect(finishPayload.steps).toEqual([]);
      expect(finishPayload.usage).toEqual({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined });
      expect(finishPayload.totalUsage).toEqual({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      });
      expect(finishPayload.response).toEqual({});
      expect(finishPayload.content).toEqual([]);
    });

    it('should call onFinish with the aborted payload shape when the stream is aborted', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });
      let finishPayload: any;

      const stream = createChunkStream([
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'partial answer' },
        },
        {
          type: 'abort',
          runId,
          from: ChunkFrom.AGENT,
          payload: {},
        },
      ] as ChunkType[]);

      const output = new MastraModelOutput({
        model: { modelId: '__GATEWAY_OPENAI_MODEL__', provider: 'test', version: 'v3' },
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

      // Core field the AGENT_RUN span end reads.
      expect(finishPayload).toMatchObject({
        finishReason: 'aborted',
      });
      // Empty defaults keep the aborted callback payload contract-complete without
      // reconstructing partial buffered state from a mid-flight canceled stream.
      expect(finishPayload.text).toBe('');
      expect(finishPayload.toolCalls).toEqual([]);
      expect(finishPayload.toolResults).toEqual([]);
      expect(finishPayload.steps).toEqual([]);
      expect(finishPayload.usage).toEqual({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined });
      expect(finishPayload.totalUsage).toEqual({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      });
      expect(finishPayload.response).toEqual({});
      expect(finishPayload.content).toEqual([]);
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
          cacheCreationInputTokens5m: 900,
          cacheCreationInputTokens1h: 67,
        },
        {
          inputTokens: 4848,
          outputTokens: 117,
          totalTokens: 4965,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 296,
          cacheCreationInputTokens5m: 200,
          cacheCreationInputTokens1h: 96,
        },
        {
          inputTokens: 8557,
          outputTokens: 1270,
          totalTokens: 9827,
          cachedInputTokens: 4551,
          cacheCreationInputTokens: 4005,
          cacheCreationInputTokens5m: 3000,
          cacheCreationInputTokens1h: 1005,
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
      expect(finishPayload?.totalUsage?.cacheCreationInputTokens5m).toBe(4100);
      expect(finishPayload?.totalUsage?.cacheCreationInputTokens1h).toBe(1168);
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

  describe('client tool observability carriers', () => {
    it('preserves observability on synthetic tool calls created from streaming input', async () => {
      const runId = 'test-run';
      const observability = {
        traceparent: '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01',
      };
      const messageList = new MessageList({ threadId: 'test-thread' });
      const stream = createChunkStream([
        {
          type: 'tool-call-input-streaming-start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'getWeather',
            providerExecuted: false,
            observability,
          },
        },
        {
          type: 'tool-call-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'getWeather',
            argsTextDelta: '{"location":"Paris"}',
          },
        },
        {
          type: 'tool-call-input-streaming-end',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
          },
        },
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ] as ChunkType[]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();
      const result = await output.getFullOutput();

      expect(result.toolCalls[0]?.payload).toMatchObject({
        toolCallId: 'call-1',
        toolName: 'getWeather',
        args: { location: 'Paris' },
        observability,
      });
    });

    it('merges observability from the final tool-call onto an existing synthetic tool call', async () => {
      const runId = 'test-run';
      const observability = {
        traceparent: '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01',
      };
      const messageList = new MessageList({ threadId: 'test-thread' });
      const stream = createChunkStream([
        {
          type: 'tool-call-input-streaming-start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'getWeather',
            providerExecuted: false,
          },
        },
        {
          type: 'tool-call-input-streaming-end',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
          },
        },
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'call-1',
            toolName: 'getWeather',
            args: { location: 'Paris' },
            providerExecuted: false,
            observability,
          },
        },
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ] as ChunkType[]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();
      const result = await output.getFullOutput();

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.payload.observability).toEqual(observability);
    });
  });

  describe('consumeStream onError fan-out', () => {
    it('invokes every callers onError when the shared drain errors', async () => {
      const drainError = new Error('drain boom');
      const stream = new ReadableStream<ChunkType>({
        pull(controller) {
          controller.error(drainError);
        },
      });

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId: 'test-run' },
      });

      const firstErrors: unknown[] = [];
      const secondErrors: unknown[] = [];

      // First caller starts the drain; second caller shares the same drain promise.
      await Promise.all([
        output.consumeStream({ onError: e => firstErrors.push(e) }),
        output.consumeStream({ onError: e => secondErrors.push(e) }),
      ]);

      expect(firstErrors).toEqual([drainError]);
      expect(secondErrors).toEqual([drainError]);
    });

    it('does not call onError when the drain succeeds', async () => {
      const runId = 'test-run';
      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      const onError = vi.fn();
      await output.consumeStream({ onError });
      await output.consumeStream({ onError });

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('consumeStream completion sharing', () => {
    it('resolves every caller only after the stream actually finishes', async () => {
      const runId = 'test-run';

      // A stream we hold open until release() is called, so we can assert that
      // no consumeStream() caller resolves before the stream is truly done.
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const stream = new ReadableStream<ChunkType>({
        async pull(controller) {
          controller.enqueue(createStepFinishChunk(runId));
          await gate;
          controller.enqueue(createFinishChunk(runId));
          controller.close();
        },
      });

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      let firstResolved = false;
      let lateResolved = false;

      // First caller starts the drain.
      const first = output.consumeStream().then(() => {
        firstResolved = true;
      });

      // Let the drain begin and buffer the first chunk while the gate is closed.
      await new Promise(resolve => setTimeout(resolve, 10));

      // A caller that arrives AFTER consumption already started must still wait
      // for the stream to finish (this is the early-return bug Fix 2 closed).
      const late = output.consumeStream().then(() => {
        lateResolved = true;
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(firstResolved).toBe(false);
      expect(lateResolved).toBe(false);

      release();
      await Promise.all([first, late]);

      expect(firstResolved).toBe(true);
      expect(lateResolved).toBe(true);
    });
  });

  describe('goal evaluation run-buffer truncation', () => {
    /**
     * The normal terminal goal-loop sequence in durable-engine chunk order:
     * each judged turn ends with a step-finish followed by a goal evaluation,
     * and the LAST evaluation is terminal (`shouldContinue: false`) — the
     * final turn's chunks arrive BEFORE it, never after. (In-process engines
     * emit the goal chunk before the judged turn's step-finish; covered
     * separately below.)
     */
    function createGoalLoopChunks(runId: string): ChunkType[] {
      return [
        // Turn 1: text + a tool call/result → continuing evaluation.
        createTextDeltaChunk(runId, 'turn one'),
        createToolCallChunk(runId, 'tc-1'),
        createToolResultChunk(runId, 'tc-1'),
        createStepFinishChunk(runId),
        createGoalChunk(runId, { shouldContinue: true }),
        // Turn 2: another tool turn → continuing evaluation.
        createTextDeltaChunk(runId, 'turn two'),
        createToolCallChunk(runId, 'tc-2'),
        createToolResultChunk(runId, 'tc-2'),
        createStepFinishChunk(runId),
        createGoalChunk(runId, { shouldContinue: true }),
        // Terminal turn: the answer, then the terminal evaluation.
        createTextDeltaChunk(runId, 'final answer'),
        createStepFinishChunk(runId),
        createGoalChunk(runId, { shouldContinue: false }),
        createFinishChunk(runId),
      ];
    }

    it('bounds buffering across continuing evaluations but preserves the terminal turn in getFullOutput()', async () => {
      const runId = 'test-run';
      const stream = createChunkStream(createGoalLoopChunks(runId));

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      const fullOutput = await output.getFullOutput();

      // Run-end results cover the segment after the last CONTINUING
      // evaluation — the terminal turn survives because the terminal
      // evaluation does not truncate.
      expect(fullOutput.steps).toHaveLength(1);
      expect(fullOutput.text).toBe('final answer');
      // Earlier turns' tool data was dropped at the continuing boundaries.
      expect(fullOutput.toolCalls).toHaveLength(0);
      expect(fullOutput.toolResults).toHaveLength(0);

      // Token usage still spans the whole run (10/20/30 per step-finish, x3).
      expect(fullOutput.totalUsage).toMatchObject({ inputTokens: 30, outputTokens: 60, totalTokens: 90 });
    });

    it('clears buffered chunks on continuing evaluations so late streams replay from the last iteration boundary', async () => {
      const runId = 'test-run';
      const stream = createChunkStream(createGoalLoopChunks(runId));

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      // A stream attached after consumption replays from the last continuing
      // evaluation onward: the boundary goal chunk, the terminal turn, the
      // terminal evaluation, and the finish.
      const replayed: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        replayed.push(chunk);
      }

      expect(replayed.map(c => c.type)).toEqual(['goal', 'text-delta', 'step-finish', 'goal', 'finish']);
    });

    it('drops the judged turn arriving as a step-finish AFTER a continuing evaluation (in-process chunk order)', async () => {
      const runId = 'test-run';
      // In-process engines run the goal gate before emitting the turn's
      // step-finish (the gate decides `isContinued` first), so the judged
      // turn's step-finish lands after the continuing evaluation.
      const stream = createChunkStream([
        createTextDeltaChunk(runId, 'turn one'),
        createToolCallChunk(runId, 'tc-1'),
        createToolResultChunk(runId, 'tc-1'),
        createGoalChunk(runId, { shouldContinue: true }),
        createStepFinishChunk(runId),
        createTextDeltaChunk(runId, 'final answer'),
        createGoalChunk(runId, { shouldContinue: false }),
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      const fullOutput = await output.getFullOutput();

      // The judged turn's late step-finish was dropped at the boundary; the
      // terminal turn (whose evaluation was terminal) is preserved.
      expect(fullOutput.steps).toHaveLength(1);
      expect(fullOutput.text).toBe('final answer');
      expect(fullOutput.toolCalls).toHaveLength(0);
      expect(fullOutput.toolResults).toHaveLength(0);
      expect(fullOutput.totalUsage).toMatchObject({ inputTokens: 20, outputTokens: 40, totalTokens: 60 });
    });

    it('does not truncate on a terminal evaluation without a prior continuing one', async () => {
      const runId = 'test-run';
      // A goal satisfied on the first judged turn: no continuing boundary ever
      // occurs, so the whole (single-turn) run is preserved.
      const stream = createChunkStream([
        createTextDeltaChunk(runId, 'only turn'),
        createStepFinishChunk(runId),
        createGoalChunk(runId, { shouldContinue: false }),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      const fullOutput = await output.getFullOutput();

      expect(fullOutput.text).toBe('only turn');
      expect(fullOutput.steps).toHaveLength(1);
    });

    it('does not clear buffered chunks on pending goal chunks', async () => {
      const runId = 'test-run';
      const stream = createChunkStream([
        createTextDeltaChunk(runId, 'before pending'),
        createGoalChunk(runId, { pending: true }),
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      await output.consumeStream();

      const replayed: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        replayed.push(chunk);
      }

      expect(replayed.map(c => c.type)).toEqual(['text-delta', 'goal', 'step-finish', 'finish']);
    });

    it('still delivers all chunks live to streams attached before the goal evaluation', async () => {
      const runId = 'test-run';
      const stream = createChunkStream([
        createTextDeltaChunk(runId, 'before '),
        createGoalChunk(runId, { shouldContinue: true }),
        createTextDeltaChunk(runId, 'after'),
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      // Attach BEFORE consumption starts — this consumer drives the stream and
      // must see every chunk regardless of replay-buffer truncation.
      const live: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        live.push(chunk);
      }

      expect(live.map(c => c.type)).toEqual(['text-delta', 'goal', 'text-delta', 'step-finish', 'finish']);
    });
  });

  describe('multi-consumer fullStream cancellation (#19743)', () => {
    it('does not stop other fullStream subscribers when one subscriber cancels', async () => {
      let enqueue: (chunk: ChunkType) => void = () => {};
      let closeSource: () => void = () => {};
      const source = new ReadableStream<ChunkType>({
        start(controller) {
          enqueue = chunk => controller.enqueue(chunk);
          closeSource = () => controller.close();
        },
      });
      const runId = 'test-run';
      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream: source,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });
      const receivedByA: ChunkType[] = [];
      let aClosed = false;
      const consumeA = (async () => {
        for await (const chunk of output.fullStream) {
          receivedByA.push(chunk);
        }
        aClosed = true;
      })();
      // Let consumer A's start() register its listeners before anything is enqueued.
      await Promise.resolve();
      await Promise.resolve();
      // Consumer B attaches, reads one chunk, then cancels — simulating a client
      // disconnect on a second concurrent stream of the same output.
      const readerB = output.fullStream.getReader();
      enqueue(createTextDeltaChunk(runId, 'before '));
      await readerB.read();
      await readerB.cancel();
      // More chunks arrive after B has cancelled — A must still receive them.
      enqueue(createTextDeltaChunk(runId, 'after'));
      enqueue(createStepFinishChunk(runId));
      enqueue(createFinishChunk(runId));
      closeSource();
      await consumeA;
      expect(aClosed).toBe(true);
      expect(receivedByA.map(c => c.type)).toEqual(['text-delta', 'text-delta', 'step-finish', 'finish']);
    }, 5000);
  });

  describe('_waitUntilFinished on stream error', () => {
    it('settles a waiter that subscribed before an error chunk terminates the stream', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });
      // The source stays open after the terminal error chunk, like a provider
      // connection that died mid-stream: flush() is never reached.
      const stream = new ReadableStream<ChunkType>({
        start(controller) {
          controller.enqueue({
            type: 'error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { error: new Error('provider connection error') },
          } as ChunkType);
        },
      });

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: { runId },
      });

      // Subscribe BEFORE consumption starts, like #watchThreadRunCompletion does at
      // run registration. An errored stream never reaches flush(), so without the
      // error branch emitting 'finish' this promise hangs forever.
      const armedBeforeError = output._waitUntilFinished();

      void output.consumeStream({ onError: () => {} });

      const outcome = await Promise.race([
        armedBeforeError.then(() => 'settled' as const),
        new Promise<'hung'>(resolve => setTimeout(() => resolve('hung'), 500)),
      ]);
      expect(outcome).toBe('settled');
      expect(output.status).toBe('failed');
    });
  });

  describe('per-step reasoning', () => {
    const reasoningStart = (runId: string, id: string, providerMetadata?: Record<string, unknown>): ChunkType =>
      ({ type: 'reasoning-start', runId, from: ChunkFrom.AGENT, payload: { id, providerMetadata } }) as ChunkType;
    const reasoningDelta = (runId: string, id: string, text: string): ChunkType =>
      ({ type: 'reasoning-delta', runId, from: ChunkFrom.AGENT, payload: { id, text } }) as ChunkType;
    const reasoningEnd = (runId: string, id: string, providerMetadata?: Record<string, unknown>): ChunkType =>
      ({ type: 'reasoning-end', runId, from: ChunkFrom.AGENT, payload: { id, providerMetadata } }) as ChunkType;

    it('reports only the current step reasoning to steps and onStepFinish, and keeps run-level reasoning cumulative', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      // Two reasoning blocks in two steps. Each step-finish should carry only its
      // own reasoning, mirroring how `text` is scoped per step.
      const stream = createChunkStream([
        reasoningStart(runId, 'rs1'),
        reasoningDelta(runId, 'rs1', 'STEP-ONE-THINKING'),
        reasoningEnd(runId, 'rs1'),
        createStepFinishChunk(runId),
        reasoningStart(runId, 'rs2'),
        reasoningDelta(runId, 'rs2', 'STEP-TWO-THINKING'),
        reasoningEnd(runId, 'rs2'),
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const stepFinishReasoning: { text: string; ids: string[] }[] = [];
      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onStepFinish: async (payload: any) => {
            stepFinishReasoning.push({
              text: payload.reasoningText,
              ids: payload.reasoning.map((r: any) => r.payload.id),
            });
          },
        },
      });

      await output.consumeStream();
      const steps = await output.steps;

      expect(steps).toHaveLength(2);

      expect(steps[0]!.reasoningText).toBe('STEP-ONE-THINKING');
      expect(steps[0]!.reasoning.map(r => r.payload.id)).toEqual(['rs1']);

      // The second step must not inherit the first step's reasoning.
      expect(steps[1]!.reasoningText).toBe('STEP-TWO-THINKING');
      expect(steps[1]!.reasoning.map(r => r.payload.id)).toEqual(['rs2']);
      expect(steps[1]!.reasoning[0]!.payload.text).toBe('STEP-TWO-THINKING');

      // onStepFinish sees the same step-local reasoning.
      expect(stepFinishReasoning).toEqual([
        { text: 'STEP-ONE-THINKING', ids: ['rs1'] },
        { text: 'STEP-TWO-THINKING', ids: ['rs2'] },
      ]);

      // Run-level reasoning stays cumulative across the whole run.
      expect(await output.reasoningText).toBe('STEP-ONE-THINKINGSTEP-TWO-THINKING');
      expect((await output.reasoning).map(r => r.payload.id)).toEqual(['rs1', 'rs2']);
    });

    it('keeps the onStepFinish reasoning intact when a goal continuation truncates run-lifetime buffers before the step-finish', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      // In-process goal runs emit the continuation goal chunk BEFORE the judged
      // turn's step-finish. That goal boundary clears the run-lifetime reasoning
      // buffers (and drops the judged step from the run-end `steps`), but
      // onStepFinish still fires for that step first. Reading the run-lifetime
      // buffers there would surface empty reasoning; the per-step buffer must
      // still carry it.
      const stream = createChunkStream([
        reasoningStart(runId, 'rs1'),
        reasoningDelta(runId, 'rs1', 'JUDGED-TURN-THINKING'),
        reasoningEnd(runId, 'rs1'),
        createGoalChunk(runId, { shouldContinue: true }),
        createStepFinishChunk(runId),
        createGoalChunk(runId, { shouldContinue: false }),
        createFinishChunk(runId),
      ]);

      const stepFinishReasoning: { text: string; ids: string[] }[] = [];
      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          onStepFinish: async (payload: any) => {
            stepFinishReasoning.push({
              text: payload.reasoningText,
              ids: payload.reasoning.map((r: any) => r.payload.id),
            });
          },
        },
      });

      await output.consumeStream();

      expect(stepFinishReasoning).toEqual([{ text: 'JUDGED-TURN-THINKING', ids: ['rs1'] }]);
    });

    it('preserves per-step reasoning-start/end metadata and blocks with no text delta', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      const startMeta = { openai: { itemId: 'block-1' } };
      const endMeta = { openai: { signature: 'sig-1' } };

      // rsA carries providerMetadata only on start/end (never on a delta); rsB is a
      // reasoning block with no text delta at all. Both must survive per step.
      const stream = createChunkStream([
        reasoningStart(runId, 'rsA', startMeta),
        reasoningDelta(runId, 'rsA', 'THINKING'),
        reasoningEnd(runId, 'rsA', endMeta),
        reasoningStart(runId, 'rsB'),
        reasoningEnd(runId, 'rsB'),
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
      const steps = await output.steps;

      expect(steps).toHaveLength(1);
      expect(steps[0]!.reasoning.map(r => r.payload.id)).toEqual(['rsA', 'rsB']);
      // reasoning-end metadata wins over the start metadata for the same block.
      expect(steps[0]!.reasoning[0]!.payload.providerMetadata).toEqual(endMeta);
      expect(steps[0]!.reasoning[0]!.payload.text).toBe('THINKING');
      // The delta-less block is still reported with empty text.
      expect(steps[0]!.reasoning[1]!.payload.text).toBe('');
      expect(steps[0]!.reasoningText).toBe('THINKING');
    });

    it('reports empty reasoning for a step that produced none', async () => {
      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      const stream = createChunkStream([
        reasoningStart(runId, 'rs1'),
        reasoningDelta(runId, 'rs1', 'ONLY-STEP-ONE'),
        reasoningEnd(runId, 'rs1'),
        createStepFinishChunk(runId),
        // Second step has no reasoning at all.
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
      const steps = await output.steps;

      expect(steps).toHaveLength(2);
      expect(steps[0]!.reasoningText).toBe('ONLY-STEP-ONE');
      expect(steps[1]!.reasoningText).toBe('');
      expect(steps[1]!.reasoning).toEqual([]);
    });
  });
});
