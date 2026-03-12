/**
 * Standalone observe() Method Tests
 *
 * Tests for the public `observe()` API added for external consumers
 * like the @mastra/opencode plugin. This API allows triggering observation
 * without going through the full processInputStep pipeline.
 *
 * Key behaviors tested:
 * 1. observe() triggers observation when messages are provided and threshold is met
 * 2. observe() skips observation when threshold is not met
 * 3. observe() calls lifecycle hooks (onObservationStart/End, onReflectionStart/End)
 * 4. observe() works in both thread and resource scope
 * 5. observe() filters unobserved messages when provided directly
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

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

function createMockObserverModel(multiThreadId?: string) {
  const observationText = multiThreadId
    ? `<observations>
<thread id="${multiThreadId}">
* User discussed testing the standalone observe API
* Assistant helped write unit tests
<current-task>
- Primary: Testing standalone observe method
</current-task>
<suggested-response>
Continue testing
</suggested-response>
</thread>
</observations>`
    : `<observations>
* User discussed testing the standalone observe API
* Assistant helped write unit tests
</observations>
<current-task>
- Primary: Testing standalone observe method
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

/**
 * Generate enough messages to exceed a given token threshold.
 * Each message is ~50 tokens (200 chars / ~4 chars per token).
 */
function createMessagesExceedingThreshold(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(
      `Message ${i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `msg-${i}`,
      new Date(Date.now() - (count - i) * 1000),
    ),
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('Standalone observe() method', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'test-thread-standalone';
  const resourceId = 'test-resource';

  beforeEach(() => {
    storage = createInMemoryStorage();

    om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: {
        model: createMockObserverModel(),
        messageTokens: 100, // Low threshold for testing
        bufferTokens: false, // Disable async buffering
      },
      reflection: {
        model: createMockObserverModel(),
        observationTokens: 50000, // High to prevent reflection during tests
      },
    });
  });

  describe('thread scope', () => {
    it('should trigger observation when messages exceed threshold', async () => {
      // Create enough messages to exceed the 100 token threshold
      const messages = createMessagesExceedingThreshold(10);

      await om.observe({
        threadId,
        messages,
      });

      // Check that observations were saved
      const record = await om.getRecord(threadId);
      expect(record).toBeTruthy();
      expect(record!.activeObservations).toBeTruthy();
      expect(record!.activeObservations).toContain('User discussed testing');
      expect(record!.lastObservedAt).toBeDefined();
    });

    it('should skip observation when messages do not exceed threshold', async () => {
      // Create very few messages (below 100 token threshold)
      const messages = [createTestMessage('Hi', 'user', 'msg-1')];

      await om.observe({
        threadId,
        messages,
      });

      // Record should be created but no observations
      const record = await om.getRecord(threadId);
      // If the record was created at all, observations should be empty
      if (record) {
        expect(record.activeObservations).toBeFalsy();
      }
    });

    it('should call onObservationStart and onObservationEnd hooks', async () => {
      const messages = createMessagesExceedingThreshold(10);

      const onObservationStart = vi.fn();
      const onObservationEnd = vi.fn();

      await om.observe({
        threadId,
        messages,
        hooks: {
          onObservationStart,
          onObservationEnd,
        },
      });

      expect(onObservationStart).toHaveBeenCalledOnce();
      expect(onObservationEnd).toHaveBeenCalledOnce();
    });

    it('should NOT call hooks when threshold is not met', async () => {
      const messages = [createTestMessage('Hi', 'user', 'msg-1')];

      const onObservationStart = vi.fn();
      const onObservationEnd = vi.fn();

      await om.observe({
        threadId,
        messages,
        hooks: {
          onObservationStart,
          onObservationEnd,
        },
      });

      expect(onObservationStart).not.toHaveBeenCalled();
      expect(onObservationEnd).not.toHaveBeenCalled();
    });

    it('should filter already-observed messages on second call', async () => {
      const messages = createMessagesExceedingThreshold(10);

      // First observe
      await om.observe({
        threadId,
        messages,
      });

      const recordAfterFirst = await om.getRecord(threadId);
      expect(recordAfterFirst?.lastObservedAt).toBeDefined();

      // Second observe with same messages — should skip since they are already observed
      const onObservationStart = vi.fn();
      await om.observe({
        threadId,
        messages,
        hooks: { onObservationStart },
      });

      // The hook should NOT fire since all messages were already observed
      // (getUnobservedMessages filters them out, resulting in 0 unobserved)
      expect(onObservationStart).not.toHaveBeenCalled();
    });
  });

  describe('resource scope', () => {
    let resourceOm: ObservationalMemory;

    beforeEach(async () => {
      // Create thread in storage for resource scope
      await storage.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Test Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      resourceOm = new ObservationalMemory({
        storage,
        scope: 'resource',
        observation: {
          model: createMockObserverModel(threadId),
          messageTokens: 100,
          bufferTokens: false,
        },
        reflection: {
          model: createMockObserverModel(threadId),
          observationTokens: 50000,
        },
      });
    });

    it('should trigger observation in resource scope when threshold is met', async () => {
      const messages = createMessagesExceedingThreshold(10);

      await resourceOm.observe({
        threadId,
        resourceId,
        messages,
      });

      // In resource scope, the record key uses resourceId
      const record = await resourceOm.getRecord(threadId, resourceId);
      expect(record).toBeTruthy();
      expect(record!.activeObservations).toBeTruthy();
      expect(record!.activeObservations).toContain('User discussed testing');
    });

    it('should call hooks in resource scope', async () => {
      const messages = createMessagesExceedingThreshold(10);

      const onObservationStart = vi.fn();
      const onObservationEnd = vi.fn();

      await resourceOm.observe({
        threadId,
        resourceId,
        messages,
        hooks: {
          onObservationStart,
          onObservationEnd,
        },
      });

      expect(onObservationStart).toHaveBeenCalledOnce();
      expect(onObservationEnd).toHaveBeenCalledOnce();
    });
  });

  describe('getObservations helper', () => {
    it('should return observations after observe()', async () => {
      const messages = createMessagesExceedingThreshold(10);

      await om.observe({ threadId, messages });

      const observations = await om.getObservations(threadId);
      expect(observations).toBeTruthy();
      expect(observations).toContain('User discussed testing');
    });

    it('should return undefined when no observations exist', async () => {
      const observations = await om.getObservations(threadId);
      expect(observations).toBeUndefined();
    });
  });
});
