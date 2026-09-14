import type { ObservabilityContext } from '@mastra/core/observability';
import { describe, expect, it, vi } from 'vitest';

import { withOmTracingSpan } from './tracing';

/**
 * `getOrCreateSpan` creates a child span whenever the tracing context carries a
 * current span, so a fake parent span is the seam for observing the child's
 * lifecycle. These tests exist because the helper used to create the
 * `om.observer` / `om.reflector` spans and never end them, which pinned whole
 * traces (and their payloads) in exporters that hold a trace open until every
 * span finishes.
 */
function createFakeSpanTree() {
  const child = {
    end: vi.fn(),
    error: vi.fn(),
    executeInContext: <T>(fn: () => Promise<T>) => fn(),
  };

  const parent = {
    createChildSpan: vi.fn(() => child),
  };

  const observabilityContext = {
    tracingContext: { currentSpan: parent },
  } as unknown as ObservabilityContext;

  return { child, parent, observabilityContext };
}

const baseArgs = {
  phase: 'observer' as const,
  model: 'openai/gpt-4.1-mini',
  inputTokens: 123,
};

describe('withOmTracingSpan', () => {
  it('ends the span once the callback resolves', async () => {
    const { child, observabilityContext } = createFakeSpanTree();

    const result = await withOmTracingSpan({
      ...baseArgs,
      observabilityContext,
      callback: async () => {
        // Yield so a span ended before the callback settles would be caught.
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(child.end).not.toHaveBeenCalled();
        return 'done';
      },
    });

    expect(result).toBe('done');
    expect(child.end).toHaveBeenCalledTimes(1);
    expect(child.error).not.toHaveBeenCalled();
  });

  it('records the error, ends the span, and rethrows when the callback fails', async () => {
    const { child, observabilityContext } = createFakeSpanTree();
    const failure = new Error('observer failed');

    await expect(
      withOmTracingSpan({
        ...baseArgs,
        observabilityContext,
        callback: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(child.error).toHaveBeenCalledTimes(1);
    expect(child.error).toHaveBeenCalledWith({ error: failure, endSpan: true });
    // `error({ endSpan: true })` terminates the span; ending it again would double-end.
    expect(child.end).not.toHaveBeenCalled();
  });

  it('still runs the callback when no span is created', async () => {
    const callback = vi.fn(async () => 'no-span');

    await expect(withOmTracingSpan({ ...baseArgs, callback })).resolves.toBe('no-span');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
