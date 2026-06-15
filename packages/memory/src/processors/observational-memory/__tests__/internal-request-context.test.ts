import type { MastraDBMessage } from '@mastra/core/agent';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

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

function createObserverRunner() {
  return new ObserverRunner({
    observationConfig: {
      model: 'mock/model',
      messageTokens: 1000,
      bufferTokens: false,
      previousObserverTokens: 1000,
      observeAttachments: false,
    } as any,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: 'mock/model' as any }),
    tokenCounter: {
      countMessages: () => 1,
    } as any,
  });
}

function createReflectorRunner() {
  return new ReflectorRunner({
    reflectionConfig: {
      model: 'mock/model',
      observationTokens: 1000,
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

  it('returns the original request context when there is no parent thread id', () => {
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');

    const result = withOmInternalThreadId(requestContext, 'observational-memory-observer');

    expect(result).toBe(requestContext);
    expect(result?.get('tenantId')).toBe('tenant-1');
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
    expect(capturedRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe(
      'parent-thread-observational-memory-observer',
    );
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

    await reflector.call('existing observations', undefined, undefined, undefined, undefined, undefined, 0, parentRequestContext);

    expect(capturedRequestContext).toBeDefined();
    expect(capturedRequestContext).not.toBe(parentRequestContext);
    expect(capturedRequestContext?.get(MASTRA_THREAD_ID_KEY)).toBe(
      'parent-thread-observational-memory-reflector',
    );
    expect(capturedRequestContext?.get(MASTRA_RESOURCE_ID_KEY)).toBe('resource-1');
    expect(capturedRequestContext?.get('tenantId')).toBe('tenant-1');
    expect(parentRequestContext.get(MASTRA_THREAD_ID_KEY)).toBe('parent-thread');
  });
});
