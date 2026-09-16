import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

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
 *
 * Two execution paths build that metadata and both are covered here: the
 * regular Agent loop (llm-execution-step.ts `buildResponseModelMetadata`) and
 * the durable agent's mirror of it (durable/workflows/steps/llm-execution.ts).
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

/**
 * The durable agent builds its own response metadata rather than calling
 * `buildResponseModelMetadata`, so the regular-loop tests above cannot cover it.
 * A caller reading messages back has no idea which path produced them, so the
 * traceId has to be there either way.
 */
describe('durable agent trace correlation (#19891)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  async function runDurableAgent(threadId: string, agentId: string) {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });

    const baseAgent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'test',
      model: createModel(),
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const { cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: 'user-1' },
    });

    // Poll until the durable flush lands — a fixed sleep is timing-dependent
    // under CI load (same shape as durable-agent-suspend-metadata.test.ts).
    const store = await storage.getStore('memory');
    let assistant: any;
    for (let i = 0; i < 100 && !assistant; i++) {
      const { messages } = await store!.listMessages({ threadId } as never);
      assistant = messages.find((m: any) => m.role === 'assistant' && m.content?.metadata?.modelId);
      if (!assistant) await new Promise(r => setTimeout(r, 100));
    }
    cleanup();

    return assistant;
  }

  it('persists the traceId in assistant message content.metadata on the durable path', async () => {
    const spy = await mockTracedSpans();

    try {
      const assistant = await runDurableAgent('thread-durable-trace-id', 'durable-trace-id-agent');

      expect(assistant).toBeDefined();
      expect(assistant.content.metadata?.traceId).toBe(TRACE_ID);
      expect(assistant.content.metadata?.modelId).toBe('mock-model-id');
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('omits traceId when the durable run is not traced', async () => {
    const assistant = await runDurableAgent('thread-durable-untraced', 'durable-untraced-agent');

    expect(assistant).toBeDefined();
    expect(assistant.content.metadata?.traceId).toBeUndefined();
    expect(assistant.content.metadata?.modelId).toBe('mock-model-id');
  }, 30000);
});
