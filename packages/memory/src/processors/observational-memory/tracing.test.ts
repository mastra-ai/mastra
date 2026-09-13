import type { ObservabilityContext } from '@mastra/core/observability';
import { MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
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
function createFakeSpanTree(metadata: Record<string, unknown> = {}) {
  const child = {
    end: vi.fn(),
    error: vi.fn(),
    executeInContext: <T>(fn: () => Promise<T>) => fn(),
  };

  const parent = {
    metadata,
    createChildSpan: vi.fn(() => child),
  };

  const observabilityContext = {
    loggerVNext: {},
    metrics: {},
    tracingContext: { currentSpan: parent },
  } as unknown as ObservabilityContext;

  return { child, parent, observabilityContext };
}

const baseArgs = {
  phase: 'observer' as const,
  model: 'openai/gpt-4.1-mini',
  inputTokens: 123,
};

describe.each(['observer', 'observer-multi-thread', 'reflector'] as const)('%s session correlation', phase => {
  const cases: Array<[string, Record<string, unknown>, unknown, unknown]> = [
    ['explicit session', { sessionId: 'custom', threadId: 'T' }, 'T', 'T'],
    ['empty session suppression', { sessionId: '', threadId: 'T' }, 'T', 'T'],
    ['null session', { sessionId: null, threadId: 'T' }, 'T', 'T'],
    ['undefined session', { sessionId: undefined, threadId: 'T' }, 'T', 'T'],
    ['absent session', { threadId: 'T' }, 'T', 'T'],
    ['caller thread wins', { threadId: 'T' }, 'different', 'T'],
    ['request fallback', {}, 'T', 'T'],
    ['empty caller thread', { threadId: '' }, 'T', 'T'],
    ['no identity', {}, undefined, undefined],
    ['empty request thread', {}, '', undefined],
    ['false session unchanged', { sessionId: false, threadId: 'T' }, 'T', 'T'],
    ['zero session unchanged', { sessionId: 0, threadId: 'T' }, 'T', 'T'],
    ['object session unchanged', { sessionId: { malformed: true } }, 'T', 'T'],
    ['array session unchanged', { sessionId: ['malformed'] }, 'T', 'T'],
    ['numeric session unchanged', { sessionId: 42 }, 'T', 'T'],
    ['false caller thread ignored', { threadId: false }, 'T', 'T'],
    ['numeric caller thread ignored', { threadId: 42 }, 'T', 'T'],
    ['object caller thread ignored', { threadId: {} }, 'T', 'T'],
    ['array caller thread ignored', { threadId: [] }, 'T', 'T'],
    ['malformed request ignored', {}, 42, undefined],
  ];

  it.each(cases)('%s', async (_name, metadata, requestThread, expectedThread) => {
    const { child, parent, observabilityContext } = createFakeSpanTree(metadata);
    observabilityContext.tracing = observabilityContext.tracingContext;
    const before = { ...observabilityContext };
    const beforeMetadata = { ...metadata };
    const requestContext = new RequestContext();
    if (requestThread !== undefined) requestContext.set(MASTRA_THREAD_ID_KEY, requestThread);
    const wrapperMetadata = { diagnostic: 'preserved' };
    const checkCaller = () => {
      expect(observabilityContext.tracingContext).toBe(before.tracingContext);
      expect(observabilityContext.tracing).toBe(before.tracing);
      expect(observabilityContext.tracingContext?.currentSpan).toBe(parent);
      expect(observabilityContext.loggerVNext).toBe(before.loggerVNext);
      expect(observabilityContext.metrics).toBe(before.metrics);
      expect(parent.metadata).toBe(metadata);
      expect(metadata).toEqual(beforeMetadata);
      expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe(requestThread);
    };
    await withOmTracingSpan({
      ...baseArgs,
      phase,
      observabilityContext,
      requestContext,
      metadata: wrapperMetadata,
      callback: async context => {
        checkCaller();
        expect(context).not.toBe(observabilityContext);
        expect(context.tracingContext).not.toBe(before.tracingContext);
        expect(context.tracing).toBe(context.tracingContext);
        expect(context.tracingContext?.currentSpan).toBe(child);
      },
    });
    checkCaller();
    expect(parent.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata:
          expectedThread === undefined
            ? wrapperMetadata
            : { ...wrapperMetadata, __mastraObservationalMemoryCallerThreadId: expectedThread },
      }),
    );
    expect(wrapperMetadata).toEqual({ diagnostic: 'preserved' });
    expect(child.end).toHaveBeenCalledTimes(1);
    expect(child.error).not.toHaveBeenCalled();
  });

  it('preserves the outer caller hint through nested OM and overrides wrapper collisions', async () => {
    const { parent, observabilityContext } = createFakeSpanTree({
      threadId: 'T-observer',
      __mastraObservationalMemoryCallerThreadId: 'T',
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'T-observer');
    await withOmTracingSpan({
      ...baseArgs,
      phase,
      observabilityContext,
      requestContext,
      metadata: { __mastraObservationalMemoryCallerThreadId: 'collision' },
      callback: async () => {},
    });
    expect(parent.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { __mastraObservationalMemoryCallerThreadId: 'T' } }),
    );
  });

  it.each([false, 0, {}, [], ''])('ignores malformed inherited hints: %j', async hint => {
    const { parent, observabilityContext } = createFakeSpanTree({
      threadId: 'T',
      __mastraObservationalMemoryCallerThreadId: hint,
    });
    await withOmTracingSpan({ ...baseArgs, phase, observabilityContext, callback: async () => {} });
    expect(parent.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { __mastraObservationalMemoryCallerThreadId: 'T' } }),
    );
  });

  it('does not create a root just to attach a request session', async () => {
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'T');
    await withOmTracingSpan({
      ...baseArgs,
      phase,
      requestContext,
      callback: async context => {
        expect(context.tracingContext?.currentSpan).toBeUndefined();
        expect(context.tracing?.currentSpan).toBeUndefined();
      },
    });
  });

  it('keeps caller references and metadata intact after failure', async () => {
    const { child, parent, observabilityContext } = createFakeSpanTree({ threadId: 'T' });
    observabilityContext.tracing = observabilityContext.tracingContext;
    const before = { ...observabilityContext };
    const metadata = parent.metadata;
    const failure = new Error('model failed');
    await expect(
      withOmTracingSpan({
        ...baseArgs,
        phase,
        observabilityContext,
        callback: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);
    expect(observabilityContext.tracingContext).toBe(before.tracingContext);
    expect(observabilityContext.tracing).toBe(before.tracing);
    expect(observabilityContext.tracingContext?.currentSpan).toBe(parent);
    expect(observabilityContext.loggerVNext).toBe(before.loggerVNext);
    expect(observabilityContext.metrics).toBe(before.metrics);
    expect(parent.metadata).toBe(metadata);
    expect(metadata).toEqual({ threadId: 'T' });
    expect(child.error).toHaveBeenCalledExactlyOnceWith({ error: failure, endSpan: true });
    expect(child.end).not.toHaveBeenCalled();
  });

  it('preserves tracingContext-first precedence when aliases conflict', async () => {
    const canonical = createFakeSpanTree({ threadId: 'canonical' });
    const legacy = createFakeSpanTree({ threadId: 'legacy' });
    canonical.observabilityContext.tracing = legacy.observabilityContext.tracingContext;
    await withOmTracingSpan({
      ...baseArgs,
      phase,
      observabilityContext: canonical.observabilityContext,
      callback: async () => {},
    });
    expect(canonical.parent.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { __mastraObservationalMemoryCallerThreadId: 'canonical' } }),
    );
    expect(legacy.parent.createChildSpan).not.toHaveBeenCalled();
    expect(canonical.observabilityContext.tracing).toBe(legacy.observabilityContext.tracingContext);
  });
});

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
