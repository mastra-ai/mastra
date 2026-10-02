/**
 * Ended-turn reuse regression tests (#19740).
 *
 * A parent agentic loop with OM enabled can seal an `ObservationTurn` early
 * (for example when sub-agent `finish` / `step-finish` chunks are forwarded
 * into the parent writer). If the shared processor state still holds that
 * ended turn and the `MessageList` identity has not changed, the next
 * `processInputStep` used to reuse it and throw `Turn already ended`, failing
 * the whole agentic loop.
 *
 * These tests pin the recovery: an ended turn is discarded and a fresh turn is
 * begun, exactly like the existing message-list-identity cleanup.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

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

function createTestMessage(content: string, role: 'user' | 'assistant' = 'user', id?: string): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };

  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: messageContent,
    type: 'text',
    createdAt: new Date(),
  };
}

function createMockObserverModel() {
  const observationText = `<observations>
* User discussed topic X
* Assistant explained Y
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call — OM should use the stream path');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'mock-response', modelId: 'mock-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createAbort() {
  return ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;
}

function createRequestContext(threadId: string, resourceId: string): RequestContext {
  const ctx = new RequestContext();
  ctx.set('MastraMemory', {
    thread: { id: threadId },
    resourceId,
  });
  ctx.set('currentDate', new Date().toISOString());
  return ctx;
}

/** Minimal live-turn shape the shared state carries. */
type LiveTurn = { end: () => Promise<unknown>; ended?: boolean };

describe('ObservationalMemoryProcessor ended-turn reuse (#19740)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;
  const threadId = 'ended-turn-thread';
  const resourceId = 'ended-turn-resource';

  beforeEach(async () => {
    storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Ended turn reuse',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: {
        model: createMockObserverModel(),
        messageTokens: 500,
        bufferTokens: false,
      },
      reflection: {
        model: createMockObserverModel(),
        observationTokens: 50000,
      },
    });
    processor = new ObservationalMemoryProcessor(om, noopMemoryProvider);

    vi.spyOn(om.observer, 'call').mockResolvedValue({
      observations: '* User discussed topic X\n* Assistant explained Y',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildInputStepArgs(messageList: MessageList, state: Record<string, unknown>, stepNumber: number) {
    return {
      messageList,
      messages: messageList.get.all.db(),
      requestContext: createRequestContext(threadId, resourceId),
      stepNumber,
      state,
      steps: [],
      systemMessages: [],
      model: createMockObserverModel() as any,
      retryCount: 0,
      abort: createAbort(),
      abortSignal: new AbortController().signal,
    };
  }

  function buildOutputResultArgs(messageList: MessageList, state: Record<string, unknown>) {
    return {
      messageList,
      messages: messageList.get.response.db(),
      requestContext: createRequestContext(threadId, resourceId),
      state,
      abort: createAbort(),
      result: {} as any,
      retryCount: 0,
    };
  }

  describe('when the active turn was ended but the message list is unchanged', () => {
    it('begins a fresh turn instead of throwing "Turn already ended"', async () => {
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createTestMessage('Hello there', 'user', 'msg-1'), 'memory');
      messageList.add(createTestMessage('Hi, how can I help?', 'assistant', 'msg-2'), 'memory');

      // Step 0 installs the turn into the shared processor state.
      await processor.processInputStep(buildInputStepArgs(messageList, state, 0));

      const sealedTurn = state.__omTurn as LiveTurn | undefined;
      expect(sealedTurn).toBeDefined();

      // Simulate an early seal that leaves the shared state pointing at the
      // ended turn — the exact shape reported in #19740.
      await sealedTurn!.end();

      // Step 1 reuses the same MessageList, so the identity-based cleanup does
      // not fire. This used to throw `Turn already ended`.
      await expect(processor.processInputStep(buildInputStepArgs(messageList, state, 1))).resolves.toBeDefined();

      // A fresh, usable turn must now be in place.
      const nextTurn = state.__omTurn as LiveTurn | undefined;
      expect(nextTurn).toBeDefined();
      expect(nextTurn).not.toBe(sealedTurn);
      expect(nextTurn!.ended).toBe(false);
    });
  });

  describe('when finalization meets an already-ended turn', () => {
    it('resolves and persists the response instead of throwing "Turn already ended"', async () => {
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createTestMessage('Hello there', 'user', 'msg-1'), 'input');
      messageList.add(createTestMessage('Hi, how can I help?', 'assistant', 'msg-2'), 'response');

      // Step 0 installs the turn into the shared processor state.
      await processor.processInputStep(buildInputStepArgs(messageList, state, 0));

      const sealedTurn = state.__omTurn as LiveTurn | undefined;
      expect(sealedTurn).toBeDefined();

      // Seal the turn before the loop finalizes — the shared state still points
      // at the ended turn. A final step has no next input step to recover it, so
      // this used to reach `await turn.end()` a second time and throw.
      await sealedTurn!.end();

      const persistSpy = vi.spyOn(om, 'persistMessages');

      await expect(processor.processOutputResult(buildOutputResultArgs(messageList, state) as any)).resolves.toBe(
        messageList,
      );

      // Finalization clears the ended turn from the shared state instead of
      // leaving it behind for the next run to trip over.
      expect(state.__omTurn).toBeUndefined();

      // The response is persisted directly rather than lost to the throw.
      const persisted = persistSpy.mock.calls.flatMap(call => call[0] as MastraDBMessage[]);
      expect(persisted.some(message => message.id === 'msg-2')).toBe(true);
    });
  });
});
