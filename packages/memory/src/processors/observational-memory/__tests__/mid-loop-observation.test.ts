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
 * Observation happens when the threshold is exceeded on step N > 0.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
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
</observations>
<current-task>
- Primary: Testing mid-loop observation
</current-task>
<suggested-response>
Continue testing
</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [
        {
          type: 'text',
          text: observationText,
        },
      ],
    }),
    doStream: async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: observationText });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  } as any);
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

      // Add messages that will exceed 500 token threshold
      for (let i = 0; i < 20; i++) {
        const msg = createTestMessage(
          `Step ${i}: `.padEnd(200, 'x'), // ~50 tokens per message
          i % 2 === 0 ? 'user' : 'assistant',
          `msg-${i}`,
          new Date(Date.now() - (20 - i) * 1000), // Older messages first
        );
        messageList.add(msg, 'memory');
      }

      // Step 0: Initialize the record (no observation yet)
      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: new AbortController().signal,
      });

      // Step 1: Should trigger observation since threshold is exceeded
      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: new AbortController().signal,
      });

      // Check observation was triggered
      const recordAfterStep1 = await storage.getObservationalMemory(threadId, resourceId);

      // Observations should be saved
      expect(recordAfterStep1?.activeObservations).toBeTruthy();
      expect(recordAfterStep1?.activeObservations).toContain('*');
      expect(recordAfterStep1?.lastObservedAt).toBeDefined();
    });

    it('should NOT trigger observation on step 0', async () => {
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

      // Step 0: Should NOT trigger observation (only initializes record)
      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
      });

      // Check record was created but no observations yet
      const record = await storage.getObservationalMemory(threadId, resourceId);

      // No observations should be saved on step 0
      expect(record?.activeObservations).toBeFalsy();
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

      await omWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: new AbortController().signal,
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
      // Add 15 more messages (~750 tokens) to push total past 1000 threshold.
      for (let i = 0; i < 15; i++) {
        const msg = createTestMessage(
          `Cross threshold ${i}: `.padEnd(200, 'y'),
          i % 2 === 0 ? 'user' : 'assistant',
          `cross-${i}`,
          new Date(Date.now() - (20 - i) * 500),
        );
        messageList.add(msg, 'memory');
      }

      await omWithBuffering.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
        steps: [],
        systemMessages: [],
        model: createMockObserverModel() as any,
        retryCount: 0,
        abort: new AbortController().signal,
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
  });
});
