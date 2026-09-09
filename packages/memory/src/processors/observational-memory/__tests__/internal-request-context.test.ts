import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import { createObservabilityContext } from '@mastra/core/observability';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Extractor } from '../extractor';
import { withOmInternalThreadId } from '../internal-request-context';
import { ObserverRunner } from '../observer-runner';
import { ReflectorRunner } from '../reflector-runner';

function createMessage(id: string, threadId = 'parent-thread'): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId: 'resource-1',
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'hello' }],
    },
    createdAt: new Date(),
  } as MastraDBMessage;
}

function createObserverRunner(extractors?: Extractor<any>[]) {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
      ...(extractors ? { extractors } : {}),
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: 'mock/model' as any }),
    tokenCounter: {
      countMessages: () => 1,
    } as any,
  });
}

function createReflectorRunner(extractors?: Extractor<any>[]) {
  return new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 1000,
      ...(extractors ? { extractors } : {}),
    } as any,
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
    } as any,
    tokenCounter: {
      countObservations: () => 1,
    } as any,
    storage: {} as any,
    scope: 'thread',
    buffering: {} as any,
    emitDebugEvent: vi.fn(),
    persistMarkerToStorage: vi.fn(),
    persistMarkerToMessage: vi.fn(),
    getCompressionStartLevel: async () => 0,
    resolveModel: () => ({ model: 'mock/model' as any }),
  });
}

function createParentRequestContext() {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_THREAD_ID_KEY, 'parent-thread');
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-1');
  requestContext.set('tenantId', 'tenant-1');
  return requestContext;
}

describe('withOmInternalThreadId', () => {
  it('returns undefined when no request context is provided', () => {
    expect(withOmInternalThreadId(undefined, 'observational-memory-observer')).toBeUndefined();
  });

  it('returns an isolated clone (never the original) when there is no parent thread id', () => {
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');

    const result = withOmInternalThreadId(requestContext, 'observational-memory-observer');

    // Must be a distinct instance so memory-scoped writes made by the internal
    // agent run cannot leak back into the caller's RequestContext.
    expect(result).not.toBe(requestContext);
    expect(result?.get('tenantId')).toBe('tenant-1');

    result?.set('MastraMemory', { thread: { id: 'structured-observer-xyz' }, resourceId: 'structured-observer' });
    expect(requestContext.get('MastraMemory')).toBeUndefined();
  });

  it('derives an OM-internal thread id from the parent thread id and OM agent id', () => {
    const requestContext = createParentRequestContext();

    const result = withOmInternalThreadId(requestContext, 'observational-memory-observer');

    expect(result).not.toBe(requestContext);
    expect(result?.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread-observational-memory-observer');
    expect(result?.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
    expect(result?.get('tenantId')).toBe('tenant-1');
    expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });

  it('does not leak internal MastraMemory writes back into the parent context', () => {
    const requestContext = createParentRequestContext();
    requestContext.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'resource-1' });

    const result = withOmInternalThreadId(requestContext, 'observational-memory-observer');
    // Simulate agent.generate overwriting the memory context with the temporary
    // observer identity while running with the temporary structured-observer memory.
    result?.set('MastraMemory', { thread: { id: 'structured-observer-xyz' }, resourceId: 'structured-observer' });

    expect((requestContext.get('MastraMemory') as { resourceId?: string })?.resourceId).toBe('resource-1');
  });
});

describe.each(['observer', 'multi-thread-observer', 'reflector'] as const)('%s tracing handoff', role => {
  it.each([true, false])(
    'preserves caller session without changing execution identity (caller identity: %s)',
    async hasIdentity => {
      const requestContext = hasIdentity ? createParentRequestContext() : new RequestContext();
      const child = {
        end: vi.fn(),
        error: vi.fn(),
        executeInContext: <T>(fn: () => Promise<T>) => fn(),
      };
      const parent = {
        metadata: hasIdentity ? { threadId: 'invoking-caller' } : {},
        createChildSpan: vi.fn((_options: { metadata: Record<string, unknown> }) => child),
      };
      const caller = createObservabilityContext({ currentSpan: parent } as unknown as Parameters<
        typeof createObservabilityContext
      >[0]);
      const tracing = caller.tracingContext;
      const runner = role === 'reflector' ? createReflectorRunner() : createObserverRunner();
      const id = role === 'multi-thread-observer' ? role : `observational-memory-${role}`;
      const stream = vi.fn(
        async (_prompt: unknown, options: ObservabilityContext & { requestContext?: RequestContext }) => {
          expect(options.tracingContext).not.toBe(tracing);
          expect(options.tracing).toBe(options.tracingContext);
          expect(options.tracingContext?.currentSpan).toBe(child);
          expect(caller.tracingContext).toBe(tracing);
          expect(tracing?.currentSpan).toBe(parent);
          expect(options.requestContext).not.toBe(requestContext);
          expect(options.requestContext?.get(MASTRA_THREAD_ID_KEY)).toBe(
            hasIdentity ? `parent-thread-${id}` : undefined,
          );
          return {
            getFullOutput: async () => ({
              text: '<observations>\n<thread id="batch-thread">\n- learned something\n</thread>\n</observations>',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            }),
          };
        },
      );
      vi.spyOn(runner as any, 'createAgent').mockReturnValue({ id, stream });
      if (runner instanceof ReflectorRunner) {
        await runner.call(
          'existing observations',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          0,
          requestContext,
          undefined,
          caller,
        );
      } else if (role === 'multi-thread-observer') {
        await runner.callMultiThread(
          undefined,
          new Map([['batch-thread', [createMessage('msg-1', 'batch-thread')]]]),
          ['batch-thread'],
          undefined,
          requestContext,
          undefined,
          caller,
        );
      } else {
        await runner.call(undefined, [createMessage('msg-1')], undefined, {
          requestContext,
          observabilityContext: caller,
        });
      }
      expect(stream).toHaveBeenCalledTimes(1);
      expect(parent.createChildSpan).toHaveBeenCalledTimes(1);
      const spanOptions = parent.createChildSpan.mock.calls[0]!;
      if (hasIdentity) expect(spanOptions[0].metadata.sessionId).toBe('invoking-caller');
      else expect(spanOptions[0].metadata).not.toHaveProperty('sessionId');
      expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe(hasIdentity ? 'parent-thread' : undefined);
      expect(caller.tracingContext).toBe(tracing);
      expect(caller.tracingContext?.currentSpan).toBe(parent);
      expect(child.end).toHaveBeenCalledTimes(1);
    },
  );
});

describe('OM internal agent request contexts', () => {
  it('passes a derived thread id to the single-thread observer stream call', async () => {
    const observer = createObserverRunner();
    const parentRequestContext = createParentRequestContext();
    let capturedRequestContext: RequestContext | undefined;

    vi.spyOn(observer as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-observer',
      stream: async (_prompt: unknown, options: { requestContext?: RequestContext }) => {
        capturedRequestContext = options.requestContext;
        return {
          getFullOutput: async () => ({
            text: '<observations>\n- learned something\n</observations>',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }),
        };
      },
    });

    await observer.call(undefined, [createMessage('msg-1')], undefined, { requestContext: parentRequestContext });

    expect(capturedRequestContext).toBeDefined();
    expect(capturedRequestContext).not.toBe(parentRequestContext);
    expect(capturedRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread-observational-memory-observer');
    expect(capturedRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
    expect(capturedRequestContext?.get('tenantId')).toBe('tenant-1');
    expect(parentRequestContext.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });

  it('passes a derived thread id to the multi-thread observer stream call', async () => {
    const observer = createObserverRunner();
    const parentRequestContext = createParentRequestContext();
    let capturedRequestContext: RequestContext | undefined;

    vi.spyOn(observer as any, 'createAgent').mockReturnValue({
      id: 'multi-thread-observer',
      stream: async (_prompt: unknown, options: { requestContext?: RequestContext }) => {
        capturedRequestContext = options.requestContext;
        return {
          getFullOutput: async () => ({
            text: '<observations>\n<thread id="parent-thread">\n- learned something\n</thread>\n</observations>',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }),
        };
      },
    });

    await observer.callMultiThread(
      undefined,
      new Map([['parent-thread', [createMessage('msg-1')]]]),
      ['parent-thread'],
      undefined,
      parentRequestContext,
    );

    expect(capturedRequestContext).toBeDefined();
    expect(capturedRequestContext).not.toBe(parentRequestContext);
    expect(capturedRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread-multi-thread-observer');
    expect(capturedRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
    expect(capturedRequestContext?.get('tenantId')).toBe('tenant-1');
    expect(parentRequestContext.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });

  it('passes a derived thread id to the reflector stream call', async () => {
    const reflector = createReflectorRunner();
    const parentRequestContext = createParentRequestContext();
    let capturedRequestContext: RequestContext | undefined;

    vi.spyOn(reflector as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-reflector',
      stream: async (_prompt: unknown, options: { requestContext?: RequestContext }) => {
        capturedRequestContext = options.requestContext;
        return {
          getFullOutput: async () => ({
            text: '<observations>\n- compressed memory\n</observations>',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }),
        };
      },
    });

    await reflector.call(
      'existing observations',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      parentRequestContext,
    );

    expect(capturedRequestContext).toBeDefined();
    expect(capturedRequestContext).not.toBe(parentRequestContext);
    expect(capturedRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread-observational-memory-reflector');
    expect(capturedRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
    expect(capturedRequestContext?.get('tenantId')).toBe('tenant-1');
    expect(parentRequestContext.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });
});

describe('schema-backed extraction does not leak the temporary observer identity', () => {
  function createStructuredExtractor() {
    return new Extractor({
      name: 'Support profile',
      instructions: 'Extract user context.',
      schema: z.object({ os: z.string().optional() }),
    });
  }

  // Reproduces the reported bug: for a schema-backed Extractor the observer runs a
  // structured-extraction pass with a temporary `structured-observer` memory. If that
  // agent.stream call runs with the parent's RequestContext, it overwrites the shared
  // `MastraMemory` entry, and the parent OM turn later injects a continuation message
  // with resourceId 'structured-observer' — which fails MessageList's resourceId
  // validation ("Received input message with wrong resourceId").
  it('runs the observer structured extraction with an isolated context', async () => {
    const observer = createObserverRunner([createStructuredExtractor()]);
    const parentRequestContext = createParentRequestContext();
    parentRequestContext.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'resource-1' });
    let extractionRequestContext: RequestContext | undefined;

    vi.spyOn(observer as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-observer',
      stream: async (_prompt: unknown, options?: { requestContext?: RequestContext; structuredOutput?: unknown }) => {
        if (options?.structuredOutput) {
          extractionRequestContext = options.requestContext;
          // Emulate agent.stream writing the temporary observer memory identity onto
          // the RequestContext it is given.
          options.requestContext?.set('MastraMemory', {
            thread: { id: 'structured-observer-xyz' },
            resourceId: 'structured-observer',
          });
          return { object: Promise.resolve({ 'support-profile': { os: 'macOS' } }) };
        }
        return {
          getFullOutput: async () => ({
            text: '<observations>\n- learned something\n</observations>',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }),
        };
      },
    });

    await observer.call(undefined, [createMessage('msg-1')], undefined, { requestContext: parentRequestContext });

    expect(extractionRequestContext).toBeDefined();
    expect(extractionRequestContext).not.toBe(parentRequestContext);
    expect((parentRequestContext.get('MastraMemory') as { resourceId?: string })?.resourceId).toBe('resource-1');
  });

  it('runs the reflector structured extraction with an isolated context', async () => {
    const reflector = createReflectorRunner([createStructuredExtractor()]);
    const parentRequestContext = createParentRequestContext();
    parentRequestContext.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'resource-1' });
    let extractionRequestContext: RequestContext | undefined;

    vi.spyOn(reflector as any, 'createAgent').mockReturnValue({
      id: 'observational-memory-reflector',
      stream: async (_prompt: unknown, options?: { requestContext?: RequestContext; structuredOutput?: unknown }) => {
        if (options?.structuredOutput) {
          extractionRequestContext = options.requestContext;
          options.requestContext?.set('MastraMemory', {
            thread: { id: 'structured-reflector-xyz' },
            resourceId: 'structured-reflector',
          });
          return { object: Promise.resolve({ 'support-profile': { os: 'macOS' } }) };
        }
        return {
          getFullOutput: async () => ({
            text: '<observations>\n- compressed memory\n</observations>',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }),
        };
      },
    });

    await reflector.call(
      'existing observations',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      parentRequestContext,
    );

    expect(extractionRequestContext).toBeDefined();
    expect(extractionRequestContext).not.toBe(parentRequestContext);
    expect((parentRequestContext.get('MastraMemory') as { resourceId?: string })?.resourceId).toBe('resource-1');
  });
});
