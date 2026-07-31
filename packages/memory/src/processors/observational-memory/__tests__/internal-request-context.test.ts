import type { MastraDBMessage } from '@mastra/core/agent';
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
  // agent.generate call runs with the parent's RequestContext, it overwrites the shared
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
      stream: async () => ({
        getFullOutput: async () => ({
          text: '<observations>\n- learned something\n</observations>',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
      }),
      generate: async (_prompt: unknown, options: { requestContext?: RequestContext }) => {
        extractionRequestContext = options.requestContext;
        // Emulate agent.generate writing the temporary observer memory identity onto
        // the RequestContext it is given.
        options.requestContext?.set('MastraMemory', {
          thread: { id: 'structured-observer-xyz' },
          resourceId: 'structured-observer',
        });
        return { object: { 'support-profile': { os: 'macOS' } } };
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
      stream: async () => ({
        getFullOutput: async () => ({
          text: '<observations>\n- compressed memory\n</observations>',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
      }),
      generate: async (_prompt: unknown, options: { requestContext?: RequestContext }) => {
        extractionRequestContext = options.requestContext;
        options.requestContext?.set('MastraMemory', {
          thread: { id: 'structured-reflector-xyz' },
          resourceId: 'structured-reflector',
        });
        return { object: { 'support-profile': { os: 'macOS' } } };
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
