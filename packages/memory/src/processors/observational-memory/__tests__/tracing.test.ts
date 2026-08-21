import { describe, expect, it, vi, beforeEach } from 'vitest';

const getOrCreateSpanMock = vi.fn();

vi.mock('@mastra/core/observability', () => ({
  getOrCreateSpan: (...args: unknown[]) => getOrCreateSpanMock(...args),
  createObservabilityContext: ({ currentSpan }: { currentSpan?: unknown }) => ({
    tracingContext: { currentSpan },
  }),
  EntityType: { OUTPUT_STEP_PROCESSOR: 'output_step_processor' },
  SpanType: { GENERIC: 'generic' },
}));

import { withOmTracingSpan } from '../tracing';

function createMockSpan() {
  return {
    executeInContext: vi.fn((fn: () => unknown) => fn()),
    end: vi.fn(),
    error: vi.fn(),
  };
}

describe('withOmTracingSpan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ends the span when the callback resolves', async () => {
    const span = createMockSpan();
    getOrCreateSpanMock.mockReturnValue(span);

    const result = await withOmTracingSpan({
      phase: 'observer',
      model: 'test/model',
      inputTokens: 123,
      callback: async () => 'ok',
    });

    expect(result).toBe('ok');
    expect(span.end).toHaveBeenCalledTimes(1);
    expect(span.error).not.toHaveBeenCalled();
  });

  it('records the error and rethrows when the callback fails', async () => {
    const span = createMockSpan();
    getOrCreateSpanMock.mockReturnValue(span);
    const failure = new Error('observer failed');

    await expect(
      withOmTracingSpan({
        phase: 'reflector',
        model: 'test/model',
        inputTokens: 456,
        callback: async () => {
          throw failure;
        },
      }),
    ).rejects.toThrow('observer failed');

    expect(span.error).toHaveBeenCalledWith({ error: failure });
    expect(span.end).not.toHaveBeenCalled();
  });

  it('runs the callback directly when no span is created', async () => {
    getOrCreateSpanMock.mockReturnValue(undefined);
    const callback = vi.fn(async () => 'no-span');

    await expect(
      withOmTracingSpan({
        phase: 'observer',
        model: 'test/model',
        inputTokens: 0,
        callback,
      }),
    ).resolves.toBe('no-span');

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
