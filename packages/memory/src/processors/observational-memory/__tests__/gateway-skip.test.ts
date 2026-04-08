/**
 * Tests that the ObservationalMemoryProcessor skips local processing when the
 * agent is using a Mastra gateway model. The gateway handles OM server-side,
 * so running it locally would double-process messages and cause duplication.
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

  it('processInputStep returns messageList unchanged when __mastra_gateway_memory is set', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });
    requestContext.set('__mastra_gateway_memory', true);

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

    // Should return the same messageList without modifications
    expect(result).toBe(messageList);
    // getThreadContext is called before the gateway check (to validate context exists),
    // but the engine should NOT have proceeded further
    expect(getThreadContextSpy).toHaveBeenCalled();
  });

  it('processOutputResult returns messageList unchanged when __mastra_gateway_memory is set', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });
    requestContext.set('__mastra_gateway_memory', true);

    const messageList = new MessageList({ threadId, resourceId });

    const result = await processor.processOutputResult({
      messageList,
      messages: [],
      requestContext,
      state: {},
      result: { text: 'Hello back' } as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    expect(result).toBe(messageList);
  });

  it('processInputStep proceeds normally without __mastra_gateway_memory flag', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });
    // Note: NOT setting __mastra_gateway_memory

    const messageList = new MessageList({ threadId, resourceId });
    const userMsg: MastraDBMessage = {
      id: 'msg-2',
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

    // Should still call getThreadContext and proceed further
    expect(getThreadContextSpy).toHaveBeenCalled();
    // The result is a MessageList (may have been modified by the normal OM flow)
    expect(result).toBeDefined();
  });
});
