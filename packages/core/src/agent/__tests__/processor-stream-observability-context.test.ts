import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

/**
 * Regression test for #23198.
 *
 * `MastraModelOutput` hands every streamed chunk to the output processor
 * runner together with a resolved observability context. Resolving that
 * context derives logger and metrics contexts from the current span, and
 * each derivation clones the span metadata. Doing this per chunk made the
 * cost of tracing scale with the number of streamed chunks even when no
 * processor consumed the context (e.g. final-only processors, which #23147
 * already skips inside the runner).
 *
 * The context is now resolved once per LLM step and reused for all chunks.
 * This test goes through the real `Agent.stream()` -> `MastraModelOutput`
 * path and asserts the derivation count does not grow with the chunk count.
 */

function createMockSpan(name: string, instance: Record<string, any>, parentSpan?: any) {
  const span: Record<string, any> = {
    id: `mock-${name}-id`,
    traceId: 'trace',
    name,
    type: name,
    metadata: { field: 'value' },
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
    createTracker: vi.fn(() => ({
      getTracingContext: vi.fn(() => ({ currentSpan: span })),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
      updateStep: vi.fn(),
    })),
    createChildSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'child', instance, span)),
    createEventSpan: vi.fn((opts: any) => createMockSpan(opts?.type ?? 'event', instance, span)),
    getCorrelationContext: vi.fn(),
    observabilityInstance: instance,
  };
  return span;
}

function createModel(chunkCount: number, text: string) {
  const size = text.length / chunkCount;
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        ...Array.from({ length: chunkCount }, (_, i) => ({
          type: 'text-delta' as const,
          id: 'text-1',
          delta: text.slice(i * size, (i + 1) * size),
        })),
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

async function streamWithTracing(chunkCount: number) {
  const text = 'x'.repeat(1000);
  const instance = {
    getLoggerContext: vi.fn(() => ({ debug() {}, info() {}, warn() {}, error() {}, fatal() {} })),
    getMetricsContext: vi.fn(() => ({
      counter: () => ({ add() {} }),
      gauge: () => ({ set() {} }),
      histogram: () => ({ record() {} }),
    })),
  };
  const utils = await import('../../observability/utils');
  const spy = vi
    .spyOn(utils, 'getOrCreateSpan')
    .mockImplementation((opts: any) => createMockSpan(opts.type ?? opts.name ?? 'unknown', instance) as any);

  const final = vi.fn<NonNullable<Processor['processOutputResult']>>(({ messages }) => messages);
  try {
    const agent = new Agent({
      id: 'ctx',
      name: 'ctx',
      instructions: 'test',
      model: createModel(chunkCount, text),
      outputProcessors: [{ id: 'final', processOutputResult: final }],
    });
    const result = await agent.stream('hi');
    await result.consumeStream();
    expect(await result.text).toBe(text);
    expect(final).toHaveBeenCalledTimes(1);
    return instance.getLoggerContext.mock.calls.length + instance.getMetricsContext.mock.calls.length;
  } finally {
    spy.mockRestore();
  }
}

describe('output processor observability context per stream (#23198)', () => {
  it('does not derive logger/metrics contexts once per chunk', async () => {
    const one = await streamWithTracing(1);
    const hundred = await streamWithTracing(100);
    expect(one).toBeGreaterThan(0);
    expect(hundred).toBe(one);
  });
});
