/**
 * Observational memory used to disable itself whenever the agent's model was a
 * Mastra gateway model, because the gateway ran observation server-side and
 * doing it in both places doubled the message history.
 *
 * The gateway no longer does any of that. It proxies the request and records
 * the turn, without injecting history or observations, so a user who configures
 * observational memory locally must get it. These tests pin that: the processor
 * runs for a gateway model exactly as it does for any other.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

function createStubMemoryProvider(): MemoryContextProvider {
  return {
    getContext: vi.fn().mockResolvedValue({
      systemMessage: undefined,
      messages: [],
      hasObservations: false,
      omRecord: null,
      continuationMessage: undefined,
      otherThreadsContext: undefined,
    }),
    persistMessages: vi.fn().mockResolvedValue(undefined),
  };
}

/** Detection used to be a duck-type check on `gatewayId`, so a plain object is enough. */
function createMockGatewayModel(gatewayId: string) {
  return {
    gatewayId,
    modelId: 'openai/gpt-4o',
    provider: 'mastra',
    specificationVersion: 'v2' as const,
  };
}

describe('ObservationalMemoryProcessor — gateway models', () => {
  const threadId = 'test-thread';
  const resourceId = 'test-resource';

  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;

  beforeEach(() => {
    const storage = createInMemoryStorage();
    om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
    });
    processor = new ObservationalMemoryProcessor(om, createStubMemoryProvider());
  });

  async function runInputStep(model: unknown) {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });
    const userMsg: MastraDBMessage = {
      id: 'msg-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
      type: 'text',
      createdAt: new Date(),
      threadId,
      resourceId,
    };

    const state: Record<string, unknown> = {};
    const result = await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state,
      steps: [],
      systemMessages: [],
      model: model as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    return { result, state };
  }

  it.each([
    ['a Mastra gateway model', createMockGatewayModel('mastra')],
    ['another gateway', createMockGatewayModel('netlify')],
  ])('processes input locally for %s', async (_label, model) => {
    const { state } = await runInputStep(model);

    // Set once the processor is past the point where it used to bail out for
    // gateway models, so its presence means local processing ran.
    expect(state.__omActorModelContext).toBeDefined();
    expect(state.__isGatewayModel).toBeUndefined();
  });

  it('processes input locally for a plain string model', async () => {
    // A string model carries no modelId, so the processor records no actor
    // model context. Reaching the output-path setup is the signal here.
    const { result, state } = await runInputStep('openai/gpt-4o');

    expect(result).toBeDefined();
    expect(state.__isGatewayModel).toBeUndefined();
  });

  it('processes output for a Mastra gateway model', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });

    // A stale gateway flag must no longer short-circuit the output path. The
    // old code returned before reaching the token counter, so a call to it
    // proves the flag is now inert.
    const state: Record<string, unknown> = { __isGatewayModel: true };
    const tokenCounterSpy = vi.spyOn(om, 'getTokenCounter');

    const result = await processor.processOutputResult({
      messageList,
      messages: [],
      requestContext,
      state,
      result: { text: 'Hello back' } as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    expect(result).toBeDefined();
    expect(tokenCounterSpy).toHaveBeenCalled();
  });
});
