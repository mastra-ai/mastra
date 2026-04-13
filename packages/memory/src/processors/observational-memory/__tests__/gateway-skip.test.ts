/**
 * Tests that the ObservationalMemoryProcessor skips local processing when the
 * agent is using a Mastra gateway model. The gateway handles OM server-side,
 * so running it locally would double-process messages and cause duplication.
 *
 * Detection uses a duck-type check (model has gatewayId === 'mastra') and
 * stores the result in per-processor state — this avoids leaking flags
 * through RequestContext to child agents.
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

/**
 * Create a plain object mock with the given gatewayId.
 * Detection uses duck typing ('gatewayId' in model), so no real class needed.
 */
function createMockGatewayModel(gatewayId: string) {
  return {
    gatewayId,
    modelId: 'openai/gpt-4o',
    provider: 'mastra',
    specificationVersion: 'v2' as const,
  };
}

describe('ObservationalMemoryProcessor — gateway skip', () => {
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

  it('processInputStep returns messageList unchanged when model is a Mastra gateway model', async () => {
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

    const getThreadContextSpy = vi.spyOn(om, 'getThreadContext');
    const gatewayModel = createMockGatewayModel('mastra');

    const result = await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: gatewayModel as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    // Should return the same messageList without modifications
    expect(result).toBe(messageList);
    // getThreadContext is called before the gateway check (to validate context exists)
    expect(getThreadContextSpy).toHaveBeenCalled();
  });

  it('processOutputResult returns messageList unchanged when gateway flag was stored in state', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });

    // Simulate what processInputStep would have stored in state
    const state: Record<string, unknown> = { __isGatewayModel: true };

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
  });

  it('does NOT skip when model is a non-mastra gateway', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });
    const userMsg: MastraDBMessage = {
      id: 'msg-3',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
      type: 'text',
      createdAt: new Date(),
      threadId,
      resourceId,
    };

    // A ModelRouterLanguageModel with a different gatewayId should NOT trigger the skip
    const nonMastraModel = createMockGatewayModel('netlify');

    const result = await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: nonMastraModel as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    // Should proceed with normal OM flow (not early-return the same messageList ref)
    // The result is still a MessageList but OM would have processed it
    expect(result).toBeDefined();
  });

  it('processInputStep proceeds normally with a plain string model', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });
    const userMsg: MastraDBMessage = {
      id: 'msg-4',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
      type: 'text',
      createdAt: new Date(),
      threadId,
      resourceId,
    };

    const getThreadContextSpy = vi.spyOn(om, 'getThreadContext');

    const result = await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: 'test-model' as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    // Should proceed with normal OM flow
    expect(getThreadContextSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
