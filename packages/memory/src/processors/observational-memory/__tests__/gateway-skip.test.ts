/**
 * Regression tests for Mastra Gateway models with observational memory.
 *
 * Gateway-routed actor models must still run the local ObservationalMemoryProcessor.
 * Observations/reflections are controlled by the user's memory config and should not
 * be implicitly delegated to Gateway built-in memory behavior.
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

function createMockGatewayModel(gatewayId: string) {
  return {
    gatewayId,
    modelId: 'openai/gpt-4o',
    provider: 'mastra',
    specificationVersion: 'v2' as const,
  };
}

async function createMessageListContext(threadId: string, resourceId: string) {
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

  return { messageList, requestContext, userMsg };
}

describe('ObservationalMemoryProcessor — gateway models', () => {
  const threadId = 'test-thread';
  const resourceId = 'test-resource';

  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;
  let memoryProvider: MemoryContextProvider;

  beforeEach(() => {
    const storage = createInMemoryStorage();
    om = new ObservationalMemory({
      storage,
      observation: { messageTokens: 100_000, model: 'test-model' },
      reflection: { observationTokens: 100_000, model: 'test-model' },
      scope: 'thread',
    });
    memoryProvider = createStubMemoryProvider();
    processor = new ObservationalMemoryProcessor(om, memoryProvider);
  });

  it('processInputStep runs local OM processing when model is routed through Mastra Gateway', async () => {
    const { messageList, requestContext, userMsg } = await createMessageListContext(threadId, resourceId);
    const gatewayModel = createMockGatewayModel('mastra');
    const beginTurnSpy = vi.spyOn(om, 'beginTurn');

    const state: Record<string, unknown> = {};
    const result = await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state,
      steps: [],
      systemMessages: [],
      model: gatewayModel as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    expect(result).toBe(messageList);
    expect(beginTurnSpy).toHaveBeenCalled();
    expect(state.__omTurn).toBeDefined();
    expect(state.__omActorModelContext).toMatchObject({ provider: 'mastra', modelId: 'openai/gpt-4o' });
  });

  it('processOutputResult ends the local OM turn for Mastra Gateway models', async () => {
    const { messageList, requestContext, userMsg } = await createMessageListContext(threadId, resourceId);
    const gatewayModel = createMockGatewayModel('mastra');
    const state: Record<string, unknown> = {};

    await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state,
      steps: [],
      systemMessages: [],
      model: gatewayModel as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    const turn = state.__omTurn as { end: () => Promise<void> };
    const endSpy = vi.spyOn(turn, 'end');

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

    expect(result).toBe(messageList);
    expect(endSpy).toHaveBeenCalled();
    expect(state.__omTurn).toBeUndefined();
  });
});
