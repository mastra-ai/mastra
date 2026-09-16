import { describe, expect, it, vi } from 'vitest';
import { SpanType } from '../observability';
import type { AnySpan } from '../observability';
import { createToolObserve } from './observe';
import { noopObserve } from './types';

function createSpan() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
  const childSpan = {
    end: vi.fn(),
    error: vi.fn(),
    executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  } as unknown as AnySpan;
  const span = {
    isValid: true,
    observabilityInstance: {
      getLoggerContext: vi.fn(() => logger),
    },
    createChildSpan: vi.fn(() => childSpan),
  } as unknown as AnySpan;

  return { span, childSpan, logger };
}

describe('createToolObserve', () => {
  it('returns noopObserve without a valid span', async () => {
    expect(createToolObserve()).toBe(noopObserve);
    expect(createToolObserve({ isValid: false } as AnySpan)).toBe(noopObserve);
    await expect(createToolObserve().span('test', () => 'result')).resolves.toBe('result');
  });

  it.each(['debug', 'info', 'warn', 'error', 'fatal'] as const)('dispatches %s logs through the span logger', level => {
    const { span, logger } = createSpan();
    const data = { value: 1 };

    createToolObserve(span).log(level, 'message', data);

    expect(logger[level]).toHaveBeenCalledWith('message', data);
  });

  it('creates and completes a generic child span around the callback', async () => {
    const { span, childSpan } = createSpan();
    const attributes = { operation: 'lookup' };
    const callback = vi.fn(() => ({ found: true }));

    const result = await createToolObserve(span).span('lookup', callback, attributes);

    expect(span.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.GENERIC,
      name: 'lookup',
      attributes,
    });
    expect(childSpan.executeInContext).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(childSpan.end).toHaveBeenCalledWith({ output: result });
    expect(result).toEqual({ found: true });
  });

  it('records callback errors on the child span and rethrows them unchanged', async () => {
    const { span, childSpan } = createSpan();
    const error = new Error('failed');

    await expect(
      createToolObserve(span).span('failure', () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(childSpan.error).toHaveBeenCalledWith({ error, endSpan: true });
    expect(childSpan.end).not.toHaveBeenCalled();
  });
});
