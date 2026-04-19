/**
 * Ensures #15294 fix runs inside processInputStep (not only the standalone helper).
 * Live Vertex/Gemini is not invoked — credentials are not available in CI.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

function toolResultPart(
  callId: string,
  toolName: string,
  providerMetadata?: { vertex?: { thoughtSignature?: string }; google?: { thoughtSignature?: string } },
): MastraDBMessage['content']['parts'][number] {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: callId,
      toolName,
      args: {},
      result: { ok: true },
    },
    ...(providerMetadata ? { providerMetadata } : {}),
  } as MastraDBMessage['content']['parts'][number];
}

describe('ObservationalMemoryProcessor + Vertex thought signatures (#15294)', () => {
  const threadId = 'thread-15294';
  const resourceId = 'resource-15294';

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

  it('processInputStep propagates thoughtSignature across split assistant tool-invocation messages', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: threadId }, resourceId });

    const messageList = new MessageList({ threadId, resourceId });

    const userMsg: MastraDBMessage = {
      id: 'u1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Run tools' }] },
      type: 'text',
      createdAt: new Date(),
      threadId,
      resourceId,
    };

    const assistantSplitA: MastraDBMessage = {
      id: 'asst-a',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: [toolResultPart('c1', 'query_data', { vertex: { thoughtSignature: 'sig-from-stream' } })],
      },
    };

    const assistantSplitB: MastraDBMessage = {
      id: 'asst-b',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      resourceId,
      content: {
        format: 2,
        parts: [toolResultPart('c2', 'query_data')],
      },
    };

    messageList.add(userMsg, 'input');
    messageList.add(assistantSplitA, 'response');
    messageList.add(assistantSplitB, 'response');

    await processor.processInputStep({
      messageList,
      messages: [userMsg],
      requestContext,
      stepNumber: 0,
      state: {},
      steps: [],
      systemMessages: [],
      model: { provider: 'google.vertex', modelId: 'gemini-3-flash-preview' } as any,
      retryCount: 0,
      abort: (() => {
        throw new Error('aborted');
      }) as any,
    });

    const db = messageList.get.all.db();
    const withSecondCall = db.find(m =>
      m.content.parts?.some(
        p =>
          p.type === 'tool-invocation' &&
          (p as { toolInvocation?: { toolCallId?: string } }).toolInvocation?.toolCallId === 'c2',
      ),
    );
    expect(withSecondCall).toBeDefined();
    const part = withSecondCall!.content.parts.find(p => p.type === 'tool-invocation') as {
      providerMetadata?: { vertex?: { thoughtSignature?: string } };
    };
    expect(part.providerMetadata?.vertex?.thoughtSignature).toBe('sig-from-stream');
  });
});
