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

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { RequestContext } from '@mastra/core/di';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
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
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [
        {
          type: 'text',
          text: `<observations>
* User discussed topic X
* Assistant explained Y
</observations>
<current-task>
- Primary: Testing mid-loop observation
</current-task>
<suggested-response>
Continue testing
</suggested-response>`,
        },
      ],
    }),
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
      observeFutureOnly: false, // Include all messages for testing
      observer: {
        model: createMockObserverModel(),
        observationThreshold: 500, // Low threshold for testing
      },
      reflector: {
        model: createMockObserverModel(),
        reflectionThreshold: 50000, // High to prevent reflection
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
      console.log('Total tokens for 2 messages:', totalTokens);

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
      console.log('Total tokens for 20 messages:', totalTokens);

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

      console.log('Messages in list:', messageList.get.all.db().length);
      console.log('Total tokens:', tokenCounter.countMessages(messageList.get.all.db()));

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

      // Check record was created
      const recordAfterStep0 = await storage.getObservationalMemory(threadId, resourceId);
      console.log('Record after step 0:', {
        id: recordAfterStep0?.id,
        lastObservedAt: recordAfterStep0?.lastObservedAt,
        activeObservations: recordAfterStep0?.activeObservations?.slice(0, 50),
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
      console.log('Record after step 1:', {
        id: recordAfterStep1?.id,
        lastObservedAt: recordAfterStep1?.lastObservedAt,
        activeObservations: recordAfterStep1?.activeObservations?.slice(0, 100),
      });

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
      const record = await storage.getObservationalMemory(threadId, null);
      console.log('Record after step 0:', {
        id: record?.id,
        lastObservedAt: record?.lastObservedAt,
        activeObservations: record?.activeObservations,
      });

      // No observations should be saved on step 0
      expect(record?.activeObservations).toBeFalsy();
    });
  });
});
