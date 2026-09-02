import { describe, it, expect, vi } from 'vitest';
import { createObservabilityContext } from '../../observability';
import type { AnySpan, ObservabilityContext } from '../../observability';
import { deriveToolObserve } from './tool-observe';

/** Minimal child-span stub capturing end/error and running fn in-context. */
function makeChildSpan() {
  return {
    end: vi.fn(),
    error: vi.fn(),
    executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
}

/** Minimal parent span exposing just what deriveToolObserve touches. */
function makeParentSpan(childSpan: ReturnType<typeof makeChildSpan>) {
  return {
    createChildSpan: vi.fn(() => childSpan),
  } as unknown as AnySpan;
}

/** An ObservabilityContext with a spy logger and the given current span. */
function makeContext(currentSpan?: AnySpan): {
  ctx: ObservabilityContext;
  logger: Record<string, ReturnType<typeof vi.fn>>;
} {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
  const ctx: ObservabilityContext = {
    tracing: { currentSpan },
    tracingContext: { currentSpan },
    loggerVNext: logger as unknown as ObservabilityContext['loggerVNext'],
    metrics: {} as ObservabilityContext['metrics'],
  };
  return { ctx, logger };
}

describe('deriveToolObserve', () => {
  it('returns a no-op observe when no span is active', async () => {
    // createObservabilityContext with no span yields no-op logger/tracing.
    const observe = deriveToolObserve(createObservabilityContext());

    // span still runs the function...
    await expect(observe.span('x', () => 42)).resolves.toBe(42);
    // ...and log does not throw.
    expect(() => observe.log('info', 'hello')).not.toThrow();
  });

  it('opens a GENERIC child span, ends it with the output, and returns the result', async () => {
    const childSpan = makeChildSpan();
    const parentSpan = makeParentSpan(childSpan);
    const { ctx } = makeContext(parentSpan);

    const observe = deriveToolObserve(ctx);
    const result = await observe.span('fetch user', async () => 'user-1', { userId: 'u1' });

    expect(result).toBe('user-1');
    expect(parentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'generic', name: 'fetch user', metadata: { userId: 'u1' } }),
    );
    expect(childSpan.executeInContext).toHaveBeenCalledTimes(1);
    expect(childSpan.end).toHaveBeenCalledWith({ output: 'user-1' });
    expect(childSpan.error).not.toHaveBeenCalled();
  });

  it('records the error on the child span and rethrows when fn throws', async () => {
    const childSpan = makeChildSpan();
    const parentSpan = makeParentSpan(childSpan);
    const { ctx } = makeContext(parentSpan);

    const observe = deriveToolObserve(ctx);
    const boom = new Error('boom');

    await expect(
      observe.span('failing', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(childSpan.error).toHaveBeenCalledWith({ error: boom });
    expect(childSpan.end).not.toHaveBeenCalled();
  });

  it('forwards log() to the span-derived logger at the matching level', () => {
    const childSpan = makeChildSpan();
    const parentSpan = makeParentSpan(childSpan);
    const { ctx, logger } = makeContext(parentSpan);

    const observe = deriveToolObserve(ctx);
    observe.log('warn', 'careful', { code: 7 });

    expect(logger.warn).toHaveBeenCalledWith('careful', { code: 7 });
    expect(logger.info).not.toHaveBeenCalled();
  });
});
