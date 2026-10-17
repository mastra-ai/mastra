/**
 * Per-step storage round trips below the observation threshold (#27319).
 *
 * Every model call in a turn runs `processInputStep`. Below `messageTokens`
 * no observation happens, so the step should not re-check that the thread
 * exists, re-read the observed-message cursor, or block on an unchanged
 * pending-token write before each model call.
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { MemoryRunState } from '@mastra/core/memory';
import type { StorageThreadType } from '@mastra/core/memory';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

const threadId = 'round-trip-thread';
const resourceId = 'round-trip-resource';

const noopMemoryProvider: MemoryContextProvider = {
  getContext: async () => ({
    systemMessage: undefined,
    messages: [],
    hasObservations: false,
    omRecord: null,
    continuationMessage: undefined,
    otherThreadsContext: undefined,
  }),
  persistMessages: async () => {},
};

function createTestMessage(content: string, role: 'user' | 'assistant', id: string): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };
  return { id, role, content: messageContent, type: 'text', createdAt: new Date() };
}

function createAbort() {
  return ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;
}

describe('ObservationalMemoryProcessor per-step storage round trips (#27319)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;
  let thread: StorageThreadType;

  beforeEach(async () => {
    storage = new InMemoryMemory({ db: new InMemoryDB() });
    thread = {
      id: threadId,
      resourceId,
      title: 'Round trips',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };
    await storage.saveThread({ thread });

    om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: 'test/unused', messageTokens: 50_000, bufferTokens: false },
      reflection: { model: 'test/unused', observationTokens: 100_000 },
    });
    processor = new ObservationalMemoryProcessor(om, noopMemoryProvider);
    vi.spyOn(om.observer, 'call').mockRejectedValue(new Error('observer must not run below threshold'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRequestContext(runState: MemoryRunState): RequestContext {
    const ctx = new RequestContext();
    ctx.set('MastraMemory', { thread: { id: threadId }, resourceId, runState: () => runState });
    ctx.set('currentDate', new Date().toISOString());
    return ctx;
  }

  function inputStepArgs(
    messageList: MessageList,
    state: Record<string, unknown>,
    stepNumber: number,
    requestContext: RequestContext,
  ) {
    return {
      messageList,
      messages: messageList.get.all.db(),
      requestContext,
      stepNumber,
      state,
      steps: [],
      systemMessages: [],
      model: { provider: 'test', modelId: 'test-model' } as any,
      retryCount: 0,
      abort: createAbort(),
      abortSignal: new AbortController().signal,
    };
  }

  async function runSteps(stepCount: number, extendBetweenSteps: boolean) {
    const runState = new MemoryRunState({ memory: {}, threadId, resourceId, thread, ownershipValidated: true });
    const requestContext = createRequestContext(runState);
    const state: Record<string, unknown> = {};
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(createTestMessage('Look something up', 'user', 'user-1'), 'input');

    const calls: Array<{ getThreadById: number; saveMessages: number; setPendingMessageTokens: number }> = [];
    const getThreadById = vi.spyOn(storage, 'getThreadById');
    const saveMessages = vi.spyOn(storage, 'saveMessages');
    const setPendingMessageTokens = vi.spyOn(storage, 'setPendingMessageTokens');

    for (let step = 0; step < stepCount; step++) {
      getThreadById.mockClear();
      saveMessages.mockClear();
      setPendingMessageTokens.mockClear();
      await processor.processInputStep(inputStepArgs(messageList, state, step, requestContext));
      calls.push({
        getThreadById: getThreadById.mock.calls.length,
        saveMessages: saveMessages.mock.calls.length,
        setPendingMessageTokens: setPendingMessageTokens.mock.calls.length,
      });
      if (extendBetweenSteps) {
        messageList.add(createTestMessage(`Tool step ${step} result`, 'assistant', `assistant-${step}`), 'response');
      }
    }
    return calls;
  }

  it('does not re-read the thread on later steps when nothing was observed', async () => {
    const calls = await runSteps(4, true);

    // Later steps still save the previous step's messages...
    for (const step of calls.slice(1)) expect(step.saveMessages).toBe(1);
    // ...but neither the save nor the cursor lookup re-reads the thread row.
    expect(calls.slice(2).map(step => step.getThreadById)).toEqual([0, 0]);
    expect(calls[1]!.getThreadById).toBeLessThanOrEqual(1);
  });

  it('skips the pending-token write when the count did not change', async () => {
    const calls = await runSteps(3, false);

    expect(calls[1]!.setPendingMessageTokens).toBe(0);
    expect(calls[2]!.setPendingMessageTokens).toBe(0);
  });

  it('still persists changed pending-token counts once background work settles', async () => {
    await runSteps(3, true);
    await om.settled();

    const record = await storage.getObservationalMemory(threadId, resourceId);
    const turnRecord = (processor as any).turn?.record;
    expect(record?.pendingMessageTokens).toBeGreaterThan(0);
    expect(record?.pendingMessageTokens).toBe(turnRecord?.pendingMessageTokens);
  });
});
