import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

/**
 * Regression test for #19891.
 *
 * A persisted assistant message and the trace that produced it had no link:
 * `mastra_messages` has no traceId column and span records carry no messageId,
 * so a caller holding a messageId (all the AI SDK chat route emits) could not
 * find the matching trace to attach feedback or scores to.
 *
 * The assistant message's `content.metadata` — which already carries modelId
 * and provider — now also carries the traceId of the run that produced it.
 */

const TRACE_ID = 'trace-id-for-message';

function createMockSpan(name: string, parentSpan?: any) {
  const span: Record<string, any> = {
    id: `mock-${name}-id`,
    traceId: TRACE_ID,
    name,
    type: name,
    startTime: new Date(),
    isInternal: false,
    isEvent: false,
    isValid: true,
    isRootSpan: !parentSpan,
    parent: parentSpan,

    end: vi.fn(),
    error: vi.fn(),
    update: vi.fn(),
    exportSpan: vi.fn(),
    getParentSpanId: vi.fn(() => parentSpan?.id),
    findParent: vi.fn(),
    executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
    executeInContextSync: vi.fn((fn: () => any) => fn()),
    get externalTraceId() {
      return TRACE_ID;
    },

    createTracker: vi.fn(() => ({
      // The real tracker hands back the MODEL_GENERATION span it owns.
      getTracingContext: vi.fn(() => ({ currentSpan: span })),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
      updateStep: vi.fn(),
    })),
    createChildSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'child', span)),
    createEventSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'event', span)),
    getCorrelationContext: vi.fn(),
    observabilityInstance: {} as any,
  };

  return span;
}

async function mockTracedSpans() {
  const mod = await import('../../observability/utils');
  return vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((opts: any) => {
    return createMockSpan(opts.type ?? opts.name ?? 'unknown') as any;
  });
}

function createModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

describe('assistant message trace correlation (#19891)', () => {
  it('persists the traceId in assistant message content.metadata alongside modelId', async () => {
    const spy = await mockTracedSpans();

    try {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'trace-id-agent',
        name: 'Trace Id Agent',
        instructions: 'test',
        model: createModel(),
        memory: mockMemory,
      });

      const res = await agent.stream('hello', {
        memory: { resource: 'user-1', thread: { id: 'thread-trace-id' } },
      });

      await res.consumeStream();

      const { messages } = await mockMemory.recall({ threadId: 'thread-trace-id', perPage: false });
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      for (const msg of assistantMessages) {
        // The traceId a caller would use to look the run up, next to the model
        // metadata that already shipped.
        expect(msg.content.metadata?.traceId).toBe(TRACE_ID);
        expect(msg.content.metadata?.modelId).toBe('mock-model-id');
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('matches the traceId reported on the stream result', async () => {
    const spy = await mockTracedSpans();

    try {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'trace-id-agent-parity',
        name: 'Trace Id Agent Parity',
        instructions: 'test',
        model: createModel(),
        memory: mockMemory,
      });

      const res = await agent.stream('hello', {
        memory: { resource: 'user-1', thread: { id: 'thread-trace-id-parity' } },
      });

      await res.consumeStream();

      const { messages } = await mockMemory.recall({ threadId: 'thread-trace-id-parity', perPage: false });
      const assistant = messages.filter(m => m.role === 'assistant');

      expect(res.traceId).toBe(TRACE_ID);
      for (const msg of assistant) {
        expect(msg.content.metadata?.traceId).toBe(res.traceId);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('omits traceId when the run is not traced', async () => {
    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'untraced-agent',
      name: 'Untraced Agent',
      instructions: 'test',
      model: createModel(),
      memory: mockMemory,
    });

    const res = await agent.stream('hello', {
      memory: { resource: 'user-1', thread: { id: 'thread-untraced' } },
    });

    await res.consumeStream();

    const { messages } = await mockMemory.recall({ threadId: 'thread-untraced', perPage: false });
    const assistant = messages.filter(m => m.role === 'assistant');
    expect(assistant.length).toBeGreaterThan(0);

    for (const msg of assistant) {
      expect(msg.content.metadata?.traceId).toBeUndefined();
      // The metadata that already shipped is unaffected.
      expect(msg.content.metadata?.modelId).toBe('mock-model-id');
    }
  });
});
