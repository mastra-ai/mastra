/**
 * DurableAgent observability tracing tests.
 *
 * Durable runs used to create no AGENT_RUN span, so traces were dropped entirely.
 * These assert the durable path now opens an AGENT_RUN root with a MODEL_GENERATION
 * child for both DurableAgent and EventedAgent.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('DurableAgent observability tracing', () => {
  let pubsub: EventEmitterPubSub;
  let spanIdCounter = 0;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    spanIdCounter = 0;
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function createMockSpan(type: string, parentSpan?: any): any {
    spanIdCounter += 1;
    const span: Record<string, any> = {
      id: `mock-${type}-id-${spanIdCounter}`,
      traceId: 'mock-trace-id',
      name: type,
      type,
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
      executeInContext: vi.fn(async (fn: () => Promise<any>) => fn()),
      executeInContextSync: vi.fn((fn: () => any) => fn()),
      get externalTraceId() {
        return 'mock-trace-id';
      },
      createTracker: vi.fn(() => ({
        getTracingContext: vi.fn(() => ({})),
        reportGenerationError: vi.fn(),
        endGeneration: vi.fn(),
        updateGeneration: vi.fn(),
        wrapStream: vi.fn(<T>(stream: T) => stream),
        startStep: vi.fn(),
        startInference: vi.fn(),
        updateStep: vi.fn(),
        setStepIndex: vi.fn(),
        setDeferStepClose: vi.fn(),
        setInferenceContext: vi.fn(),
        exportCurrentStep: vi.fn(),
        getPendingStepFinishPayload: vi.fn(),
      })),
      createChildSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'child', span)),
      createEventSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'event', span)),
      getCorrelationContext: vi.fn(),
      observabilityInstance: {},
    };
    return span;
  }

  async function spyOnSpans() {
    const agentSpans: any[] = [];
    const mod = await import('../../../observability/utils');
    const spy = vi.spyOn(mod, 'getOrCreateSpan').mockImplementation((opts: any) => {
      const span = createMockSpan(opts.type ?? 'unknown');
      if (opts.type === 'agent_run') {
        agentSpans.push(span);
      }
      return span as any;
    });
    return { spy, agentSpans };
  }

  it('opens an AGENT_RUN root span with a MODEL_GENERATION child for a durable run', async () => {
    const { spy, agentSpans } = await spyOnSpans();

    try {
      const baseAgent = new Agent({
        id: 'trace-agent',
        name: 'Trace Agent',
        instructions: 'You are a test assistant',
        model: createTextStreamModel('Hello') as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { output, cleanup } = await durableAgent.stream('Hi');
      await output.consumeStream();

      // The durable path used to create no agent_run span at all.
      expect(agentSpans.length).toBe(1);

      const agentSpan = agentSpans[0];
      const childSpanTypes = agentSpan.createChildSpan.mock.calls.map((call: any[]) => call[0]?.type);
      expect(childSpanTypes).toContain('model_generation');

      cleanup();
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('opens an AGENT_RUN span for an evented (fire-and-forget) run too', async () => {
    const { spy, agentSpans } = await spyOnSpans();

    try {
      const baseAgent = new Agent({
        id: 'evented-trace-agent',
        name: 'Evented Trace Agent',
        instructions: 'You are a test assistant',
        model: createTextStreamModel('Hello') as LanguageModelV2,
      });
      const eventedAgent = createEventedAgent({ agent: baseAgent, pubsub });

      const { output, cleanup } = await eventedAgent.stream('Hi');
      await output.consumeStream();

      expect(agentSpans.length).toBe(1);
      const childSpanTypes = agentSpans[0].createChildSpan.mock.calls.map((call: any[]) => call[0]?.type);
      expect(childSpanTypes).toContain('model_generation');

      cleanup();
    } finally {
      spy.mockRestore();
    }
  }, 30000);
});
