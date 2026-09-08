/**
 * Mid-Loop Observation Tests
 *
 * These tests verify that when observation is triggered during processInputStep:
 * 1. The correct messages are observed
 * 2. Observed messages are filtered from subsequent steps
 * 3. Token count decreases after observation
 * 4. Observations are properly saved to storage
 *
 * NOTE: All observation logic is now consolidated in processInputStep.
 * Observation happens when the threshold is exceeded on any step — including
 * step 0 (since #16523), as long as there are no incomplete tool calls.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
import { TokenCounter } from '../token-counter';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  id?: string,
  createdAt?: Date,
): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };

  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: messageContent,
    type: 'text',
    createdAt: createdAt ?? new Date(),
  };
}

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
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
        {
          type: 'response-metadata',
          id: 'mock-response',
          modelId: 'mock-model',
          timestamp: new Date(),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
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

function mockCallObserver(target: ObservationalMemory) {
  return vi.spyOn(target.observer, 'call').mockResolvedValue({
    observations: '* User discussed topic X\n* Assistant explained Y',
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  });
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

// =============================================================================
// Tests
// =============================================================================

describe('Mid-Loop Observation', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  let processor: ObservationalMemoryProcessor;
  const threadId = 'test-thread-123';
  const resourceId = 'test-resource';
  const tokenCounter = new TokenCounter();

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Create thread in storage
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    om = new ObservationalMemory({
      storage,
      scope: 'thread', // Use thread scope for simpler testing

      observation: {
        model: createMockObserverModel(),
        messageTokens: 500, // Low threshold for testing
        bufferTokens: false, // Disable async buffering — test expects synchronous observation
      },
      reflection: {
        model: createMockObserverModel(),
        observationTokens: 50000, // High to prevent reflection
      },
    });
    processor = new ObservationalMemoryProcessor(om, noopMemoryProvider);

    mockCallObserver(om);
  });

  afterEach(() => {
    // The suite runs with `isolate: false` — restore all spies (including the
    // rejecting observer mock in the failure-propagation test) so nothing leaks
    // across tests or files. `beforeEach` re-creates `om` and re-spies.
    vi.restoreAllMocks();
  });

  describe('Token counting and threshold detection', () => {
    it('should correctly calculate pending tokens from messageList', async () => {
      const messages: MastraDBMessage[] = [
        createTestMessage('Hello, this is a test message from user', 'user', 'msg-1'),
        createTestMessage('This is a response from the assistant', 'assistant', 'msg-2'),
      ];

      const totalTokens = tokenCounter.countMessages(messages);

      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should detect when threshold is exceeded', async () => {
      // Create many messages to exceed threshold
      // Each message needs ~25 tokens to exceed 500 total with 20 messages
      const messages: MastraDBMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push(createTestMessage(`Message ${i}: `.padEnd(150, 'x'), 'user', `msg-${i}`));
      }

      const totalTokens = tokenCounter.countMessages(messages);

      // With 500 token threshold, 20 150-char messages should exceed it
      expect(totalTokens).toBeGreaterThan(500);
    });
  });

  describe('processInputStep observation (consolidated logic)', () => {
    it('should trigger observation on step N > 0 when threshold is exceeded', async () => {
      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};

      // Create messageList with messages that exceed threshold
      const messageList = new MessageList({
        threadId,
        resourceId,
      });

      // Stay BELOW the 500 token threshold at step 0 (step 0 also observes when over
      // threshold since #16523, so an over-threshold start would observe before step 1)
      for (let i = 0; i < 8; i++) {
        const msg = createTestMessage(
          `Step ${i}: `.padEnd(200, 'x'), // ~50 tokens per message
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (20 - i) * 1000), // Older messages first
        );
        messageList.add(msg, 'memory');
      }

      // Step 0: Initialize the record (below threshold — no observation yet)
      await processor.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
      });

      const recordAfterStep0 = await storage.getObservationalMemory(threadId, resourceId);
      expect(recordAfterStep0?.activeObservations).toBeFalsy();

      // Cross the threshold before step 1
      for (let i = 8; i < 20; i++) {
        const msg = createTestMessage(
          `Step ${i}: `.padEnd(200, 'x'),
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (20 - i) * 1000),
        );
        messageList.add(msg, 'memory');
      }

      // Step 1: Should trigger observation since threshold is exceeded
      await processor.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
      });

      // Check observation was triggered
      const recordAfterStep1 = await storage.getObservationalMemory(threadId, resourceId);

      // Observations should be saved
      expect(recordAfterStep1?.activeObservations).toBeTruthy();
      expect(recordAfterStep1?.activeObservations).toContain('*');
      expect(recordAfterStep1?.lastObservedAt).toBeDefined();
    });

    it('should rotate the response message id after synchronous observation persists', async () => {
      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};
      const sealedAtRotate: boolean[] = [];
      const rotateResponseMessageId = vi.fn(() => {
        const latestAssistant = [...messageList.get.all.db()].reverse().find(message => message.role === 'assistant');
        sealedAtRotate.push(
          !!(latestAssistant?.content.metadata as { mastra?: { sealed?: boolean } } | undefined)?.mastra?.sealed,
        );
        return 'rotated-response-id';
      });

      const messageList = new MessageList({
        threadId,
        resourceId,
      });

      for (let i = 0; i < 20; i++) {
        const msg = createTestMessage(
          `Step ${i}: `.padEnd(200, 'x'),
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (20 - i) * 1000),
        );
        messageList.add(msg, 'memory');
      }

      await processor.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
        rotateResponseMessageId,
      });

      // Step 0 observes when over threshold (#16523). Without an active messageId there
      // is no seeded response message, so the rotation hook still fires post-observation.
      expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
      expect(sealedAtRotate).toEqual([true]);

      await processor.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
        rotateResponseMessageId,
      });

      // No second observation at step 1 — everything was observed at step 0
      expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
    });

    it('should trigger observation on step 0 when threshold exceeded', async () => {
      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};

      // Create messageList with messages that exceed threshold
      const messageList = new MessageList({
        threadId,
        resourceId,
      });

      // Add messages that will exceed 500 token threshold
      for (let i = 0; i < 20; i++) {
        const msg = createTestMessage(
          `Step ${i}: `.padEnd(200, 'x'),
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (20 - i) * 1000),
        );
        messageList.add(msg, 'memory');
      }

      // Step 0: over threshold → observes immediately (#16523 — previously a dead zone:
      // a first prompt already over messageTokens hit neither buffering nor observation)
      await processor.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
      });

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBeTruthy();
      expect(record?.activeObservations).toContain('*');
      expect(record?.lastObservedAt).toBeDefined();
    });

    it('should activate buffered observations mid-step when threshold is crossed (not defer to next user turn)', async () => {
      // This test uses async buffering (bufferTokens enabled) to expose the bug where
      // unbufferedPendingTokens is calculated using c.tokenCount (observation tokens)
      // instead of c.messageTokens (message tokens being removed from context).

      // Create a separate OM instance with async buffering enabled.
      const omWithBuffering = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: {
          model: createMockObserverModel(),
          messageTokens: 1000, // Threshold for activation
          bufferTokens: 200, // Buffer every 200 tokens (async buffering enabled)
          bufferActivation: 0.8, // Activate 80% of buffered content
        },
        reflection: {
          model: createMockObserverModel(),
          observationTokens: 50000, // High to prevent reflection
        },
      });
      const processorWithBuffering = new ObservationalMemoryProcessor(omWithBuffering, noopMemoryProvider);

      mockCallObserver(omWithBuffering);

      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};

      const messageList = new MessageList({ threadId, resourceId });

      // Step 0: Add messages below threshold to trigger async buffering (not activation).
      // Each message is ~50 tokens, so 10 messages = ~500 tokens (below 1000 threshold).
      // With bufferTokens=200, buffering should trigger multiple times.
      for (let i = 0; i < 10; i++) {
        const msg = createTestMessage(
          `Warmup ${i}: `.padEnd(200, 'x'),
          i % 2 === 0 ? 'user' : 'assistant',
          `warmup-${i}`,
          new Date(Date.now() - (100 - i) * 1000),
        );
        messageList.add(msg, 'memory');
      }

      await processorWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
      });

      // Wait for async buffering to complete (fire-and-forget operation)
      // Poll for buffered chunks to appear
      let recordAfterStep0 = await storage.getObservationalMemory(threadId, resourceId);
      for (let i = 0; i < 20; i++) {
        if (recordAfterStep0?.bufferedObservationChunks?.length) break;
        await new Promise(r => setTimeout(r, 100));
        recordAfterStep0 = await storage.getObservationalMemory(threadId, resourceId);
      }

      // Should have buffered chunks but no active observations yet (below threshold).
      expect(recordAfterStep0?.bufferedObservationChunks?.length).toBeGreaterThan(0);
      expect(recordAfterStep0?.activeObservations).toBeFalsy();

      // Step 1: Add more messages to cross threshold and trigger mid-step activation.
      // Add 25 more messages (~1250 tokens) to push total well past 1000 threshold.
      // We use a generous count so that the activation safety check
      // (projectedRemaining <= maxRemaining) is satisfied even with tokenx's
      // ~2-5% variance compared to tiktoken.
      for (let i = 0; i < 25; i++) {
        const msg = createTestMessage(
          `Cross threshold ${i}: `.padEnd(200, 'y'),
          i % 2 === 0 ? 'user' : 'assistant',
          `cross-${i}`,
          new Date(Date.now() - (20 - i) * 500),
        );
        messageList.add(msg, 'memory');
      }

      await processorWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
      });

      const recordAfterStep1 = await storage.getObservationalMemory(threadId, resourceId);

      // CRITICAL ASSERTION: Mid-step activation should have happened on step 1.
      // If this fails (activeObservations is empty), it means activation was deferred
      // to step 0 of the next turn, indicating the bug where unbufferedPendingTokens
      // calculation uses c.tokenCount instead of c.messageTokens.
      expect(recordAfterStep1?.activeObservations).toBeTruthy();
      expect(recordAfterStep1?.activeObservations).toContain('*');
      expect(recordAfterStep1?.lastObservedAt).toBeDefined();

      // Note: We don't assert that buffered chunks are empty because new buffering
      // can legitimately trigger during the same step for unbuffered messages.
      // The key assertion is that activation happened (above checks).
      // The bug we're fixing is that activation was DEFERRED to step 0 of next turn,
      // which would have left activeObservations empty after step 1.
    });

    it('should rotate the active response message id only when OM seals a buffered chunk', async () => {
      const persistMessages = vi.fn(async () => {});
      const memoryProvider: MemoryContextProvider = {
        ...noopMemoryProvider,
        persistMessages,
      };
      const omWithBuffering = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: {
          model: createMockObserverModel(),
          messageTokens: 1000,
          bufferTokens: 200,
          bufferActivation: 0.8,
        },
        reflection: {
          model: createMockObserverModel(),
          observationTokens: 50000,
        },
      });
      const processorWithBuffering = new ObservationalMemoryProcessor(omWithBuffering, memoryProvider);
      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};
      const messageList = new MessageList({ threadId, resourceId });
      const rotateResponseMessageId = vi.fn(() => 'rotated-response-id');

      for (let i = 0; i < 10; i++) {
        messageList.add(
          createTestMessage(
            `Warmup ${i}: `.padEnd(200, 'x'),
            i % 2 === 0 ? 'user' : 'assistant',
            `warmup-${i}`,
            new Date(Date.now() - (100 - i) * 1000),
          ),
          'memory',
        );
      }

      await processorWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
        rotateResponseMessageId,
      });

      for (let i = 0; i < 20; i++) {
        if (persistMessages.mock.calls.length > 0) break;
        await new Promise(r => setTimeout(r, 100));
      }

      expect(persistMessages).toHaveBeenCalled();
      expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);

      const rotateCallsAfterBufferedStep = rotateResponseMessageId.mock.calls.length;

      await processorWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
        rotateResponseMessageId,
      });

      expect(rotateResponseMessageId).toHaveBeenCalledTimes(rotateCallsAfterBufferedStep);
    });
  });

  describe('#16523 — step-0 observation of a single over-threshold message', () => {
    // A single first message exceeding messageTokens used to hit a dead zone:
    // shouldBuffer requires pendingTokens < threshold and observation was gated
    // to step > 0, so neither path ever fired.
    function createGiantMessage(id = 'giant-msg', role: 'user' | 'assistant' = 'user') {
      return createTestMessage('Giant: '.padEnd(4000, 'z'), role, id, new Date(Date.now() - 1000));
    }

    function stepArgs(
      messageList: MessageList,
      extra: Record<string, unknown> = {},
      proc: ObservationalMemoryProcessor = processor,
    ) {
      void proc;
      return {
        messageList,
        messages: messageList.get.all.db(),
        requestContext: createRequestContext(threadId, resourceId),
        stepNumber: 0,
        state: {} as Record<string, unknown>,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: createAbort(),
        abortSignal: new AbortController().signal,
        ...extra,
      };
    }

    it('observes at step 0 under the sync-only config (bufferTokens: false)', async () => {
      const observerSpy = mockCallObserver(om);
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await processor.processInputStep(stepArgs(messageList));

      expect(observerSpy).toHaveBeenCalled();
      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBeTruthy();
      expect(record?.lastObservedAt).toBeDefined();
    });

    it('observes at step 0 under the DEFAULT config (async buffering enabled)', async () => {
      const omDefault = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: {
          model: createMockObserverModel(),
          messageTokens: 500,
          // bufferTokens unset → default async buffering. A single giant message still
          // can't buffer (shouldBuffer requires pendingTokens < threshold).
        },
        reflection: { model: createMockObserverModel(), observationTokens: 50000 },
      });
      const procDefault = new ObservationalMemoryProcessor(omDefault, noopMemoryProvider);
      const observerSpy = mockCallObserver(omDefault);

      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await procDefault.processInputStep(stepArgs(messageList));

      expect(observerSpy).toHaveBeenCalled();
      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBeTruthy();
    });

    it('observes at step 0 under resource scope', async () => {
      const omResource = new ObservationalMemory({
        storage,
        scope: 'resource',
        observation: { model: createMockObserverModel(), messageTokens: 500 },
        reflection: { model: createMockObserverModel(), observationTokens: 50000 },
      });
      const procResource = new ObservationalMemoryProcessor(omResource, noopMemoryProvider);
      // Resource scope routes observation through observer.callMultiThread, not observer.call
      // (resource-scoped.ts strategy batches threads per observer request).
      const observerSpy = vi.spyOn(omResource.observer, 'callMultiThread').mockResolvedValue({
        results: new Map([[threadId, { observations: '* User discussed topic X' }]]),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });

      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await procResource.processInputStep(stepArgs(messageList));

      expect(observerSpy).toHaveBeenCalled();
      // Resource-scoped records are stored under threadId null, keyed by resourceId.
      const record = await storage.getObservationalMemory(null as never, resourceId);
      expect(record?.activeObservations).toBeTruthy();
    });

    it('does NOT observe at step 0 while an incomplete tool call is pending', async () => {
      const observerSpy = mockCallObserver(om);
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'memory');
      const pendingToolMsg: MastraDBMessage = {
        id: 'pending-tool-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'tc-1', toolName: 'test-tool', args: {} },
            } as any,
          ],
        },
        type: 'text',
        createdAt: new Date(),
      };
      messageList.add(pendingToolMsg, 'response');

      await processor.processInputStep(stepArgs(messageList));

      expect(observerSpy).not.toHaveBeenCalled();
      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBeFalsy();
    });

    it('keeps the freshly observed giant message in context and in the input bucket', async () => {
      mockCallObserver(om);
      const sealSpy = vi.spyOn(om, 'sealMessagesForBuffering');
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await processor.processInputStep(stepArgs(messageList));

      const record = await storage.getObservationalMemory(threadId, resourceId);
      expect(record?.activeObservations).toBeTruthy();
      // Step-0 cleanup must preserve the just-observed lone message by identity —
      // the model still needs it to answer the prompt that carried it.
      const survivor = messageList.get.all.db().find(msg => msg.id === 'giant-msg');
      expect(survivor).toBeDefined();
      // And it must remain in the INPUT bucket: semantic recall embeds
      // `get.input.db()` and the durable loop reads the first input message for
      // task tracking — draining the bucket at step 0 would starve both.
      expect(messageList.get.input.db().map(msg => msg.id)).toContain('giant-msg');
      // The user prompt must NOT be sealed: `sealed` metadata persisted on a user
      // message would route any future same-id re-add through the re-id branch.
      // Anchor on the seal API itself (not just the metadata path, which would
      // vacuously resolve to undefined if the path were renamed): the user prompt
      // must never be handed to sealMessagesForBuffering.
      const sealedIds = sealSpy.mock.calls.flatMap(([msgs]) => (msgs ?? []).map((msg: any) => msg.id));
      expect(sealedIds).not.toContain('giant-msg');
      expect(((survivor as any)?.content?.metadata?.mastra as any)?.sealed).toBeUndefined();
    });

    it('preserves the fresh prompt at step 0 even with an explicit bufferActivation of 1 (retention floor 0)', async () => {
      // resolveRetentionFloor(1, threshold) === 0 — the token-based floor cannot
      // protect anything under this config, so survival must come from identity
      // preservation of the in-flight messages, not the floor backoff.
      const omFloorZero = new ObservationalMemory({
        storage,
        scope: 'thread',
        observation: {
          model: createMockObserverModel(),
          messageTokens: 500,
          bufferTokens: 100,
          bufferActivation: 1,
        },
        reflection: { model: createMockObserverModel(), observationTokens: 50000 },
      });
      const procFloorZero = new ObservationalMemoryProcessor(omFloorZero, noopMemoryProvider);
      const observerSpy = mockCallObserver(omFloorZero);

      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await procFloorZero.processInputStep(stepArgs(messageList));

      expect(observerSpy).toHaveBeenCalled();
      const survivor = messageList.get.all.db().find(msg => msg.id === 'giant-msg');
      expect(survivor).toBeDefined();
    });

    it('seeds the active response message: markers on the assistant seed, rotation suppressed, seed persisted', async () => {
      mockCallObserver(om);
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');
      const rotateResponseMessageId = vi.fn(() => 'rotated-response-id');

      await processor.processInputStep(
        stepArgs(messageList, { messageId: 'active-response-1', rotateResponseMessageId }),
      );

      // The seed holds the ACTIVE response id — rotating would orphan it
      expect(rotateResponseMessageId).not.toHaveBeenCalled();

      const all = messageList.get.all.db();
      const seed = all.find(msg => msg.id === 'active-response-1');
      expect(seed?.role).toBe('assistant');
      const seedMarkerTypes = (seed?.content.parts ?? [])
        .map((part: any) => String(part?.type))
        .filter(type => type.startsWith('data-om-'));
      expect(seedMarkerTypes).toContain('data-om-observation-start');

      // Binding constraint (PR #16612 review): lifecycle markers NEVER on user messages
      for (const msg of all) {
        if (msg.role === 'user') {
          const userMarkers = (msg.content.parts ?? []).filter((part: any) =>
            String(part?.type).startsWith('data-om-'),
          );
          expect(userMarkers).toEqual([]);
        }
      }

      // Durable-run survival: the seed reached storage with its marker before turn end,
      // so a resumed run that rebuilds a fresh MessageList from the DB still sees it.
      const stored = await storage.listMessages({ threadId });
      const storedSeed = stored.messages.find((msg: any) => msg.id === 'active-response-1');
      expect(storedSeed).toBeDefined();
      expect(
        ((storedSeed as any)?.content?.parts ?? []).some((part: any) => String(part?.type).startsWith('data-om-')),
      ).toBe(true);
    });

    it('propagates a step-0 observer failure and persists the failed marker on an assistant message', async () => {
      vi.spyOn(om.observer, 'call').mockRejectedValue(new Error('observer exploded'));
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await expect(
        processor.processInputStep(stepArgs(messageList, { messageId: 'active-response-fail' })),
      ).rejects.toThrow();

      const stored = await storage.listMessages({ threadId });
      const markerCarriers = stored.messages.filter((msg: any) =>
        (msg.content?.parts ?? []).some((part: any) => String(part?.type) === 'data-om-observation-failed'),
      );
      expect(markerCarriers.length).toBeGreaterThan(0);
      for (const carrier of markerCarriers) {
        expect((carrier as any).role).toBe('assistant');
      }
    });

    it('still observes at step 0 without a messageId (legacy dispatch) and never marks a user message', async () => {
      // The legacy v1 dispatch calls runProcessInputStep without a messageId, so no
      // response message can be seeded. Observation must still fire; markers fall back
      // to the storage scan and must never land on a user message.
      const observerSpy = mockCallObserver(om);
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      // stepArgs supplies no messageId by default — this mirrors the legacy dispatch.
      await processor.processInputStep(stepArgs(messageList));

      expect(observerSpy).toHaveBeenCalled();
      // No seed: the live list must not contain an empty assistant message.
      expect(messageList.get.all.db().some(msg => msg.role === 'assistant')).toBe(false);
      // Markers never land on user messages, live or stored.
      const stored = await storage.listMessages({ threadId });
      for (const msg of [...messageList.get.all.db(), ...stored.messages]) {
        if ((msg as any).role !== 'user') continue;
        const hasMarker = ((msg as any).content?.parts ?? []).some((part: any) =>
          String(part?.type ?? '').startsWith('data-om-'),
        );
        expect(hasMarker).toBe(false);
      }
    });

    it('does not prune unobserved messages when the fresh re-check declines observation at step 0', async () => {
      const observerSpy = mockCallObserver(om);
      const realGetStatus = (om as any).getStatus.bind(om);
      let passedThroughObserve = false;
      const statusSpy = vi.spyOn(om as any, 'getStatus').mockImplementation(async (args: any) => {
        const status = await realGetStatus(args);
        if (!passedThroughObserve && status.shouldObserve) {
          // First over-threshold snapshot passes through (arms willObserveNow)…
          passedThroughObserve = true;
          return status;
        }
        // …every later check declines (simulates tokens dropping between snapshot and re-check)
        return { ...status, shouldObserve: false };
      });

      const messageList = new MessageList({ threadId, resourceId });
      messageList.add(createGiantMessage(), 'input');

      await processor.processInputStep(stepArgs(messageList));

      // Prove the branch under test actually executed: the first snapshot armed
      // willObserveNow, and the fresh re-check inside the observation path ran.
      expect(passedThroughObserve).toBe(true);
      expect(statusSpy.mock.calls.length).toBeGreaterThan(1);
      // The persist block ran, but at step 0 the input bucket must NOT be drained —
      // downstream consumers (semantic recall embedding, durable-loop task tracking)
      // read `get.input.db()` after this point.
      expect(messageList.get.input.db().map(msg => msg.id)).toEqual(['giant-msg']);
      expect(observerSpy).not.toHaveBeenCalled();
      // …and marker-boundary pruning must NOT have dropped the unobserved message
      const survivor = messageList.get.all.db().find(msg => msg.id === 'giant-msg');
      expect(survivor).toBeDefined();
    });

    it('marker-boundary cleanup never trims or removes a preserved marker anchor', async () => {
      // The marker anchor itself can be an in-flight message (the step-0 seeded
      // response message carries only data-om-* parts). When its id is preserved,
      // cleanup must not remove it even though it has no unobserved parts.
      const anchor: MastraDBMessage = {
        id: 'anchor-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'data-om-observation-end', data: { cycleId: 'cycle-1' } } as any],
        },
        type: 'text',
        createdAt: new Date(),
        threadId,
        resourceId,
      };
      const older = createTestMessage('an older, fully observed message', 'user', 'old-1');

      const remaining = await om.cleanupMessages({
        threadId,
        resourceId,
        messages: [older, anchor],
        preserveMessageIds: ['anchor-1'],
      });

      const remainingIds = remaining.map(msg => msg.id);
      expect(remainingIds).toContain('anchor-1');
      expect(remainingIds).not.toContain('old-1');
      // Preserved anchors keep their parts untouched (no unobserved-part trimming).
      expect(remaining.find(msg => msg.id === 'anchor-1')?.content.parts).toHaveLength(1);
    });
  });
});
