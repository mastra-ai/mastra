import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraError } from '../../error';
import type { IMastraLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression test for orphaned AGENT_RUN spans.
 *
 * When an LLM call throws (e.g. AI_APICallError), the `onFinish` callback
 * in map-results-step returns early for `finishReason === 'error'`, which
 * used to skip `executeOnFinish` — the only place `agentSpan.end()` is called.
 *
 * The result: the AGENT_RUN span was never ended, so exporters (like
 * Datadog) that wait for the root span to end never emitted the trace.
 *
 * MockLanguageModelV3 is used because these cases need a finish with
 * finishReason `error` and no error payload, which the OpenAI-compatible aimock
 * provider cannot emit.
 */
describe('AGENT_RUN span must be ended on LLM errors', () => {
  const v3Usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 302, text: 302, reasoning: undefined },
  };

  // A provider that ends the stream with finishReason 'error' and never enqueues an
  // error part — the shape Google produces for MALFORMED_FUNCTION_CALL.
  function finishReasonErrorModelV3(finishReason: { unified: 'error'; raw?: string }) {
    return new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [],
        finishReason,
        usage: v3Usage,
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStreamV3([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'finish', finishReason, usage: v3Usage },
        ]),
      }),
    });
  }

  function createMockModelSpanTracker() {
    return {
      getTracingContext: vi.fn(() => ({})),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
    };
  }

  function createMockSpan(name: string, parentSpan?: any) {
    const span: Record<string, any> = {
      id: `mock-${name}-id`,
      traceId: 'mock-trace-id',
      name,
      type: name,
      startTime: new Date(),
      isInternal: false,
      isEvent: false,
      isValid: true,
      isRootSpan: !parentSpan,
      parent: parentSpan,

      end: vi.fn(),
      endTree: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
      exportSpan: vi.fn(),
      snapshot: vi.fn(),
      getParentSpanId: vi.fn(() => parentSpan?.id),
      findParent: vi.fn(),
      executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
      executeInContextSync: vi.fn((fn: () => any) => fn()),
      get externalTraceId() {
        return 'mock-trace-id';
      },

      createTracker: vi.fn(() => createMockModelSpanTracker()),
      createChildSpan: vi.fn((_opts: any) => createMockSpan(_opts?.type ?? 'child', span)),
      createEventSpan: vi.fn((_opts: any) => createMockSpan(_opts?.type ?? 'event', span)),
      getCorrelationContext: vi.fn(),
      observabilityInstance: {} as any,
    };

    return span;
  }

  async function mockGetOrCreateSpan() {
    let agentRunSpan: any;

    const mod = await import('../../observability/utils');
    const spy = vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((opts: any) => {
      const span = createMockSpan(opts.type ?? opts.name ?? 'unknown');
      if (opts.type === 'agent_run') {
        agentRunSpan = span;
      }
      return span as any;
    });

    return { spy, getAgentRunSpan: () => agentRunSpan };
  }

  function simpleMockModel() {
    return new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('should not be called');
      },
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
      }),
    });
  }

  it('should end the AGENT_RUN span tree when the prepare workflow resolves as failed', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();
    const { Workflow } = await import('../../workflows/workflow');
    const createRunSpy = vi.spyOn(Workflow.prototype as unknown as Record<string, any>, 'createRun').mockResolvedValue({
      start: vi.fn().mockResolvedValue({ status: 'failed', error: { message: 'prepare step failed' } }),
    });

    try {
      const agent = new Agent({
        id: 'test-prepare-failed-result',
        name: 'Test Prepare Failed Result',
        model: simpleMockModel(),
        instructions: 'You are a helpful assistant.',
      });

      await expect(agent.stream('Hello')).rejects.toThrow('prepare step failed');

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).toHaveBeenCalledTimes(1);
      expect(agentRunSpan.error.mock.calls[0][0]).toMatchObject({ endTree: true });
      expect(agentRunSpan.error.mock.calls[0][0].error.message).toBe('prepare step failed');
      expect(agentRunSpan.endTree).not.toHaveBeenCalled();
    } finally {
      createRunSpy.mockRestore();
      spy.mockRestore();
    }
  });

  it('should end the AGENT_RUN span tree when the prepare workflow rejects', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();
    const { Workflow } = await import('../../workflows/workflow');
    const prepareError = new Error('prepare workflow rejected');
    const createRunSpy = vi.spyOn(Workflow.prototype as unknown as Record<string, any>, 'createRun').mockResolvedValue({
      start: vi.fn().mockRejectedValue(prepareError),
    });

    try {
      const agent = new Agent({
        id: 'test-prepare-workflow-rejection',
        name: 'Test Prepare Workflow Rejection',
        model: simpleMockModel(),
        instructions: 'You are a helpful assistant.',
      });

      await expect(agent.stream('Hello')).rejects.toThrow(prepareError);

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).toHaveBeenCalledWith({ error: prepareError, endTree: true });
      expect(agentRunSpan.endTree).not.toHaveBeenCalled();
    } finally {
      createRunSpy.mockRestore();
      spy.mockRestore();
    }
  });

  it('should end the AGENT_RUN span when the model throws during doStream', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const errorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('LLM API call failed');
        },
        doStream: async () => {
          throw new Error('LLM API call failed');
        },
      });

      const agent = new Agent({
        id: 'test-orphaned-span',
        name: 'Test Orphaned Span',
        model: errorModel,
        instructions: 'You are a helpful assistant.',
      });

      const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

      for await (const _chunk of output.fullStream) {
        // drain
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).toHaveBeenCalled();
      expect(agentRunSpan.error.mock.calls[0][0]).toMatchObject({ endTree: true });
      expect(agentRunSpan.endTree).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should synthesize a MastraError when the stream finishes with finishReason error but no error payload', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        getTransports: vi.fn().mockReturnValue(new Map()),
        listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
        listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
      } satisfies IMastraLogger;
      const mastra = new Mastra({ logger });

      const errorFinishModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [],
          finishReason: 'error',
          usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'gemini-2.5-flash',
              timestamp: new Date(0),
            },
            {
              type: 'finish',
              finishReason: 'error',
              usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
            },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-finish-reason-error-without-payload',
        name: 'Test Finish Reason Error Without Payload',
        model: errorFinishModel,
        instructions: 'You are a helpful assistant.',
        mastra,
      });

      const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

      await output.consumeStream();

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).toHaveBeenCalled();
      expect(agentRunSpan.error.mock.calls[0][0]).toMatchObject({ endTree: true });
      expect(agentRunSpan.endTree).not.toHaveBeenCalled();
      expect(agentRunSpan.error.mock.calls[0][0].error).toBeInstanceOf(MastraError);
      expect(agentRunSpan.error.mock.calls[0][0].error.message).toBe(
        'Agent stream finished with finishReason "error" but no error payload was provided',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error in agent stream',
        expect.objectContaining({
          error: expect.any(MastraError),
          modelId: 'mock-model-id',
          provider: 'mock-provider',
          runId: expect.any(String),
        }),
      );
      const loggedError = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][1]?.error;
      expect(loggedError).toBeInstanceOf(MastraError);
      expect(loggedError).not.toBeUndefined();
      expect(loggedError.message).toBe(
        'Agent stream finished with finishReason "error" but no error payload was provided',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('should emit an error chunk to the client when the stream finishes with finishReason error but no error payload', async () => {
    const onErrorCalls: { error: Error }[] = [];

    const agent = new Agent({
      id: 'test-client-visible-finish-error',
      name: 'Test Client Visible Finish Error',
      model: finishReasonErrorModelV3({ unified: 'error', raw: 'MALFORMED_FUNCTION_CALL' }),
      instructions: 'You are a helpful assistant.',
      // Error surfacing is the subject; opt out of the default MALFORMED_FUNCTION_CALL retry.
      errorProcessorDefaults: false,
    });

    const output = await agent.stream('Hello', {
      modelSettings: { maxRetries: 0 },
      onError: (payload: { error: Error }) => onErrorCalls.push(payload),
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter(chunk => chunk.type === 'error');
    expect(errorChunks).toHaveLength(1);

    const emitted = (errorChunks[0] as { payload: { error: MastraError } }).payload.error;
    expect(emitted).toBeInstanceOf(MastraError);
    expect(emitted.message).toBe(
      'Agent stream finished with finishReason "error" (provider reported "MALFORMED_FUNCTION_CALL") but no error payload was provided',
    );
    expect(emitted.details).toMatchObject({ rawFinishReason: 'MALFORMED_FUNCTION_CALL' });

    // The error must reach onError, not just the server log
    expect(onErrorCalls).toHaveLength(1);
    expect(onErrorCalls[0].error.message).toBe(emitted.message);

    // The finish chunk still reports the terminal reason
    const finishChunk = chunks.find(chunk => chunk.type === 'finish') as
      | { payload: { stepResult: { reason: string } } }
      | undefined;
    expect(finishChunk?.payload.stepResult.reason).toBe('error');
  });

  it('should preserve the provider raw finish reason on the finish chunk', async () => {
    const agent = new Agent({
      id: 'test-raw-finish-reason',
      name: 'Test Raw Finish Reason',
      model: finishReasonErrorModelV3({ unified: 'error', raw: 'MALFORMED_FUNCTION_CALL' }),
      instructions: 'You are a helpful assistant.',
      // The provider's raw finish reason is the subject; opt out of processor-level retry.
      errorProcessorDefaults: false,
    });

    const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream) {
      chunks.push(chunk);
    }

    const stepFinish = chunks.find(chunk => chunk.type === 'step-finish') as
      | { payload: { stepResult: { reason: string; rawReason?: string } } }
      | undefined;
    expect(stepFinish?.payload.stepResult.reason).toBe('error');
    expect(stepFinish?.payload.stepResult.rawReason).toBe('MALFORMED_FUNCTION_CALL');
  });

  it('should not emit an error chunk when the stream finishes normally', async () => {
    const agent = new Agent({
      id: 'test-no-spurious-error-chunk',
      name: 'Test No Spurious Error Chunk',
      model: new MockLanguageModelV3({
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Hello there' }],
          finishReason: { unified: 'stop', raw: 'STOP' },
          usage: v3Usage,
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello there' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: { unified: 'stop', raw: 'STOP' }, usage: v3Usage },
          ]),
        }),
      }),
      instructions: 'You are a helpful assistant.',
    });

    const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream) {
      chunks.push(chunk);
    }

    expect(chunks.filter(chunk => chunk.type === 'error')).toHaveLength(0);
    expect(await output.text).toBe('Hello there');
  });

  it('should end the AGENT_RUN span when the model stream emits an error chunk mid-stream', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const streamError = new Error('LLM mid-stream error');
      const errorMidStreamModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw streamError;
        },
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'partial ' },
            { type: 'text-end', id: 'text-1' },
            { type: 'error' as const, error: streamError },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-orphaned-span-midstream',
        name: 'Test Orphaned Span MidStream',
        model: errorMidStreamModel,
        instructions: 'You are a helpful assistant.',
      });

      const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

      for await (const _chunk of output.fullStream) {
        // drain
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).toHaveBeenCalled();
      expect(agentRunSpan.error.mock.calls[0][0]).toMatchObject({ endTree: true });
      expect(agentRunSpan.endTree).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should end the AGENT_RUN span on successful stream (control test)', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const successModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Hello!' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-span-success',
        name: 'Test Span Success',
        model: successModel,
        instructions: 'You are a helpful assistant.',
      });

      const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });

      for await (const _chunk of output.fullStream) {
        // drain
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.end).toHaveBeenCalled();
      expect(agentRunSpan.error).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should end the AGENT_RUN span when the stream suspends for tool-call-approval', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const findUserTool = createTool({
        id: 'findUserTool',
        description: 'Returns a user record',
        inputSchema: z.object({ name: z.string() }),
        requireApproval: true,
        execute: async () => ({ name: 'Dero Israel', email: 'dero@mail.com' }),
      });

      const approvalModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: '__GATEWAY_OPENAI_MODEL__', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      });

      const agent = new Agent({
        id: 'test-orphaned-span-suspend',
        name: 'Test Orphaned Span Suspend',
        model: approvalModel,
        instructions: 'You are a helpful assistant.',
        tools: { findUserTool },
        memory: new MockMemory(),
      });

      const output = await agent.stream('Find the user with name - Dero Israel', {
        memory: { thread: 'thread-suspend', resource: 'resource-suspend' },
        modelSettings: { maxRetries: 0 },
      });

      for await (const _chunk of output.fullStream) {
        // drain
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).not.toHaveBeenCalled();
      expect(agentRunSpan.end).toHaveBeenCalledWith({
        endTree: true,
        output: {
          status: 'suspended',
          reason: 'tool-call-approval',
          toolName: 'findUserTool',
          toolCallId: 'call-1',
        },
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('should end the AGENT_RUN span when the stream is aborted mid-flight', async () => {
    const { spy, getAgentRunSpan } = await mockGetOrCreateSpan();

    try {
      const abortController = new AbortController();
      let pullCalls = 0;

      const abortMidStreamModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            pull(controller) {
              switch (pullCalls++) {
                case 0:
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  break;
                case 1:
                  controller.enqueue({
                    type: 'response-metadata',
                    id: 'id-0',
                    modelId: '__GATEWAY_OPENAI_MODEL__',
                    timestamp: new Date(0),
                  });
                  break;
                case 2:
                  // Abort during streaming, before any finish chunk reaches output.ts.
                  // This mirrors the browser-disconnect / AbortController.abort() path
                  // that previously left the AGENT_RUN span orphaned.
                  abortController.abort();
                  controller.error(new DOMException('The user aborted a request.', 'AbortError'));
                  break;
              }
            },
          }),
        }),
      });

      const agent = new Agent({
        id: 'test-orphaned-span-abort',
        name: 'Test Orphaned Span Abort',
        model: abortMidStreamModel,
        instructions: 'You are a helpful assistant.',
      });

      const output = await agent.stream('Hello', {
        abortSignal: abortController.signal,
        modelSettings: { maxRetries: 0 },
      });

      try {
        for await (const _chunk of output.fullStream) {
          // drain
        }
      } catch {
        // expected: stream may error on abort
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const agentRunSpan = getAgentRunSpan();
      expect(agentRunSpan).toBeDefined();
      expect(agentRunSpan.error).not.toHaveBeenCalled();
      expect(agentRunSpan.end).toHaveBeenCalledWith({
        endTree: true,
        output: {
          status: 'aborted',
          reason: 'abort',
        },
      });
    } finally {
      spy.mockRestore();
    }
  });
});
