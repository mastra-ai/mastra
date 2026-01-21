/**
 * Mid-Loop Observation Tests
 *
 * These tests verify that when observation is triggered mid-loop:
 * 1. The correct messages are observed
 * 2. Observed messages are filtered from subsequent steps
 * 3. Token count decreases after observation
 * 4. Observations are properly saved to storage
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { RequestContext } from '@mastra/core/di';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

  describe('processOutputStep mid-loop observation', () => {
    it('should trigger observation when threshold is exceeded', async () => {
      const requestContext = createRequestContext(threadId, resourceId);

      // Create initial messageList with messages that exceed threshold
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

      // First, run processInputStep to initialize the record
      const state: Record<string, unknown> = {};
      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
      });

      // Check record was created
      const recordBefore = await storage.getObservationalMemory(threadId, null);
      console.log('Record before processOutputStep:', {
        id: recordBefore?.id,
        lastObservedAt: recordBefore?.lastObservedAt,
        activeObservations: recordBefore?.activeObservations?.slice(0, 50),
      });

      // Run processOutputStep - should trigger observation
      await om.processOutputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        finishReason: 'tool-calls',
        state,
      });

      // Check observation was triggered
      console.log('State after processOutputStep:', {
        observationTriggeredThisLoop: state.observationTriggeredThisLoop,
        observedMessageIds: (state.observedMessageIds as string[])?.length,
      });

      // Check record was updated
      const recordAfter = await storage.getObservationalMemory(threadId, null);
      console.log('Record after processOutputStep:', {
        id: recordAfter?.id,
        lastObservedAt: recordAfter?.lastObservedAt,
        activeObservations: recordAfter?.activeObservations?.slice(0, 100),
      });

      // Observations should be saved
      expect(recordAfter?.activeObservations).toBeTruthy();
      expect(recordAfter?.activeObservations).toContain('*');
      expect(recordAfter?.lastObservedAt).toBeDefined();
    });

    it('should filter observed messages in subsequent processInputStep', async () => {
      const requestContext = createRequestContext(threadId, resourceId);
      const state: Record<string, unknown> = {};

      // Helper to create fresh messageList (simulating Mastra repopulating it)
      const createPopulatedMessageList = () => {
        const ml = new MessageList({ threadId, resourceId });
        for (let i = 0; i < 20; i++) {
          const msg = createTestMessage(
            `Step ${i}: `.padEnd(200, 'x'),
            i % 2 === 0 ? 'user' : 'assistant',
            `msg-${i}`,
            new Date(Date.now() - (20 - i) * 1000),
          );
          ml.add(msg, 'memory');
        }
        return ml;
      };

      // Step 0: Initial setup
      let messageList = createPopulatedMessageList();
      console.log('=== Step 0 ===');
      console.log('Messages before processInputStep:', messageList.get.all.db().length);

      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
      });

      console.log('Messages after processInputStep:', messageList.get.all.db().length);

      // Trigger observation in processOutputStep
      await om.processOutputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        finishReason: 'tool-calls',
        state,
      });

      console.log('State after step 0:', {
        observationTriggeredThisLoop: state.observationTriggeredThisLoop,
        observedMessageIds: (state.observedMessageIds as string[])?.length,
      });

      // Step 1: Mastra repopulates messageList, processInputStep should filter
      messageList = createPopulatedMessageList();
      console.log('\n=== Step 1 ===');
      console.log('Messages before processInputStep (repopulated):', messageList.get.all.db().length);

      await om.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 1,
        state,
      });

      const messagesAfterFilter = messageList.get.all.db();
      console.log('Messages after processInputStep (filtered):', messagesAfterFilter.length);
      console.log(
        'Message IDs remaining:',
        messagesAfterFilter.map(m => m.id),
      );

      // Key assertion: messages should be filtered out!
      // If observation worked, we should have fewer messages
      expect(messagesAfterFilter.length).toBeLessThan(20);
    });

    it('should track which threadId observation happens on', async () => {
      // This test verifies the bug: observation happens on wrong threadId
      // Use a unique threadId to avoid interference from previous tests
      const uniqueThreadId = `thread-${Date.now()}`;
      const requestContext = createRequestContext(uniqueThreadId, resourceId);
      const state: Record<string, unknown> = {};

      // Create thread in storage for this test
      await storage.saveThread({
        thread: {
          id: uniqueThreadId,
          resourceId,
          title: 'Test Thread for Debug',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });

      // Capture debug events via callback
      const debugEvents: any[] = [];
      const omWithDebug = new ObservationalMemory({
        storage,
        scope: 'thread',
        observer: {
          model: createMockObserverModel(),
          observationThreshold: 500,
        },
        reflector: {
          model: createMockObserverModel(),
          reflectionThreshold: 50000,
        },
        onDebugEvent: (event) => {
          debugEvents.push(event);
        },
      });

      const messageList = new MessageList({ threadId: uniqueThreadId, resourceId });
      for (let i = 0; i < 20; i++) {
        messageList.add(
          createTestMessage(`Message ${i}`.padEnd(200, 'x'), 'user', `msg-${i}`),
          'memory',
        );
      }

      await omWithDebug.processInputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        state,
      });

      await omWithDebug.processOutputStep({
        messageList,
        messages: messageList.get.all.db(),
        requestContext,
        stepNumber: 0,
        finishReason: 'tool-calls',
        state,
      });

      // Log all debug events to understand what's happening
      console.log('All debug events:', debugEvents.map(e => ({
        type: e.type,
        threadId: e.threadId,
        pendingTokens: e.pendingTokens,
        threshold: e.threshold,
        willObserve: e.willObserve,
      })));

      // Find observation_triggered event
      const observationEvent = debugEvents.find(e => e.type === 'observation_triggered');
      console.log('Observation triggered event:', {
        threadId: observationEvent?.threadId,
        expectedThreadId: uniqueThreadId,
        match: observationEvent?.threadId === uniqueThreadId,
      });

      // The observation should happen on the CURRENT thread
      expect(observationEvent?.threadId).toBe(uniqueThreadId);
    });
  });
});
