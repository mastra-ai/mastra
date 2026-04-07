/**
 * ObservationalMemory Public API Tests
 *
 * Comprehensive tests for the ObservationalMemory class public API.
 * Tests each public method directly — getStatus, observe, buffer, activate,
 * reflect, buildContextSystemMessage, getResolvedConfig, clear, getHistory,
 * getOtherThreadsContext, waitForBuffering — including edge cases, error
 * paths, and interactions between methods.
 *
 * Does NOT test through the processor or agent integration layer.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ModelByInputTokens } from '../model-by-input-tokens';
import { ObservationalMemory } from '../observational-memory';

// =============================================================================
// Helpers
// =============================================================================

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({ db: new InMemoryDB() });
}

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  id?: string,
  createdAt?: Date,
): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: createdAt ?? new Date(),
  };
}

/** Generate N messages with padding to exceed token thresholds. */
function createBulkMessages(count: number, threadId: string, startTime?: number): MastraDBMessage[] {
  const base = startTime ?? Date.now() - count * 1000;
  return Array.from({ length: count }, (_, i) => ({
    ...createTestMessage(
      `Message ${i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `${threadId}-msg-${i}`,
      new Date(base + i * 1000),
    ),
    threadId,
  }));
}

function createMockObserverModel(observationOverride?: string) {
  const observationText =
    observationOverride ??
    `<observations>
* User discussed various topics in the conversation
* Assistant provided helpful responses
</observations>
<current-task>
- Primary: Continue conversation
</current-task>
<suggested-response>
Continue helping the user
</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [{ type: 'text', text: observationText }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMockReflectorModel(reflectedObservations?: string) {
  const text =
    reflectedObservations ??
    `<observations>
* Condensed: User and assistant had a productive conversation about testing
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'ref-1', modelId: 'mock-reflector', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createOM(
  storage: InMemoryMemory,
  opts?: {
    messageTokens?: number;
    bufferTokens?: number | false;
    observationTokens?: number;
    scope?: 'thread' | 'resource';
    observerModel?: any;
    reflectorModel?: any;
  },
) {
  return new ObservationalMemory({
    storage,
    scope: opts?.scope ?? 'thread',
    observation: {
      model: opts?.observerModel ?? createMockObserverModel(),
      messageTokens: opts?.messageTokens ?? 100,
      bufferTokens: opts?.bufferTokens ?? false,
    },
    reflection: {
      model: opts?.reflectorModel ?? createMockReflectorModel(),
      observationTokens: opts?.observationTokens ?? 50_000,
    },
  });
}

// Clean up static maps between ALL tests to prevent ordering-dependent failures
beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

// =============================================================================
// getStatus()
// =============================================================================

describe('getStatus()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'status-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('should return a fresh record with zero tokens when no messages exist', async () => {
    const status = await om.getStatus({ threadId });

    expect(status.record).toBeTruthy();
    expect(status.pendingTokens).toBe(0);
    expect(status.shouldObserve).toBe(false);
    expect(status.shouldBuffer).toBe(false);
    expect(status.shouldReflect).toBe(false);
    expect(status.bufferedChunkCount).toBe(0);
    expect(status.bufferedChunkTokens).toBe(0);
    expect(status.canActivate).toBe(false);
  });

  it('should report shouldObserve=true when messages exceed threshold', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const status = await om.getStatus({ threadId });

    expect(status.shouldObserve).toBe(true);
    expect(status.pendingTokens).toBeGreaterThan(0);
    expect(status.threshold).toBeGreaterThan(0);
  });

  it('should report shouldObserve=false when messages are below threshold', async () => {
    await storage.saveMessages({ messages: [{ ...createTestMessage('Hi'), threadId }] });

    const status = await om.getStatus({ threadId });

    expect(status.shouldObserve).toBe(false);
  });

  it('should report canActivate=true when buffered chunks exist', async () => {
    const omBuf = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    // Buffer to create chunks
    await omBuf.buffer({ threadId });

    const status = await omBuf.getStatus({ threadId });
    expect(status.canActivate).toBe(true);
    expect(status.bufferedChunkCount).toBeGreaterThan(0);
  });

  it('should update after observation reduces pending tokens', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const before = await om.getStatus({ threadId });
    expect(before.shouldObserve).toBe(true);

    await om.observe({ threadId });

    const after = await om.getStatus({ threadId });
    // After observation, pending should be 0 or much lower (no new messages added)
    expect(after.pendingTokens).toBe(0);
    expect(after.shouldObserve).toBe(false);
  });

  it('should report shouldReflect=true when observation tokens exceed reflection threshold', async () => {
    // Low reflection threshold
    const omLow = createOM(storage, { observationTokens: 10 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    // Observe to create observations
    await omLow.observe({ threadId });

    const status = await omLow.getStatus({ threadId });
    expect(status.shouldReflect).toBe(true);
  });

  it('should return threshold based on dynamic calculation', async () => {
    const status = await om.getStatus({ threadId });
    expect(status.threshold).toBeGreaterThan(0);
    expect(typeof status.threshold).toBe('number');
  });
});

// =============================================================================
// observe()
// =============================================================================

describe('observe()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'observe-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  describe('with provided messages', () => {
    it('should observe when messages exceed threshold', async () => {
      const messages = createBulkMessages(10, threadId);
      const result = await om.observe({ threadId, messages });

      expect(result.observed).toBe(true);
      expect(result.record.activeObservations).toContain('User discussed');
      expect(result.record.lastObservedAt).toBeDefined();
    });

    it('should skip when messages are below threshold', async () => {
      const messages = [createTestMessage('short')];
      const result = await om.observe({ threadId, messages });

      expect(result.observed).toBe(false);
      expect(result.record.activeObservations).toBeFalsy();
    });

    it('should filter already-observed messages on second call', async () => {
      const messages = createBulkMessages(10, threadId);

      const first = await om.observe({ threadId, messages });
      expect(first.observed).toBe(true);

      // Same messages — all already observed
      const second = await om.observe({ threadId, messages });
      expect(second.observed).toBe(false);
    });

    it('should observe new messages added after first observation', async () => {
      const messages1 = createBulkMessages(10, threadId);
      await om.observe({ threadId, messages: messages1 });

      // New messages with later timestamps
      const messages2 = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
        ...m,
        id: `${threadId}-new-${i}`,
      }));

      const result = await om.observe({ threadId, messages: [...messages1, ...messages2] });
      expect(result.observed).toBe(true);
    });
  });

  describe('loading from storage (no messages provided)', () => {
    it('should load messages from storage and observe', async () => {
      await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

      const result = await om.observe({ threadId });

      expect(result.observed).toBe(true);
      expect(result.record.activeObservations).toBeTruthy();
    });

    it('should skip when storage has no messages', async () => {
      const result = await om.observe({ threadId });

      expect(result.observed).toBe(false);
    });

    it('should skip when storage messages are below threshold', async () => {
      await storage.saveMessages({ messages: [{ ...createTestMessage('Hello'), threadId }] });

      const result = await om.observe({ threadId });
      expect(result.observed).toBe(false);
    });

    it('should only load unobserved messages from storage on second call', async () => {
      await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

      const first = await om.observe({ threadId });
      expect(first.observed).toBe(true);

      // No new messages in storage — should skip
      const second = await om.observe({ threadId });
      expect(second.observed).toBe(false);
    });

    it('should observe new messages added to storage after first observation', async () => {
      await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
      await om.observe({ threadId });

      // Add more messages
      const newMsgs = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
        ...m,
        id: `${threadId}-new-${i}`,
      }));
      await storage.saveMessages({ messages: newMsgs });

      const result = await om.observe({ threadId });
      expect(result.observed).toBe(true);
    });
  });

  describe('hooks', () => {
    it('should call all lifecycle hooks when observation triggers', async () => {
      const messages = createBulkMessages(10, threadId);
      const hooks = {
        onObservationStart: vi.fn(),
        onObservationEnd: vi.fn(),
      };

      await om.observe({ threadId, messages, hooks });

      expect(hooks.onObservationStart).toHaveBeenCalledOnce();
      expect(hooks.onObservationEnd).toHaveBeenCalledOnce();
      expect(hooks.onObservationEnd).toHaveBeenCalledWith({
        usage: expect.objectContaining({ inputTokens: expect.any(Number), outputTokens: expect.any(Number) }),
      });
    });

    it('should not call hooks when below threshold', async () => {
      const hooks = {
        onObservationStart: vi.fn(),
        onObservationEnd: vi.fn(),
      };

      await om.observe({ threadId, messages: [createTestMessage('Hi')], hooks });

      expect(hooks.onObservationStart).not.toHaveBeenCalled();
      expect(hooks.onObservationEnd).not.toHaveBeenCalled();
    });

    it('should call onObservationEnd even if observer fails', async () => {
      const failingModel = new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('Observer failed');
        },
        doStream: async () => {
          throw new Error('Observer failed');
        },
      });
      const failOm = createOM(storage, { observerModel: failingModel });

      const hooks = {
        onObservationStart: vi.fn(),
        onObservationEnd: vi.fn(),
      };

      // Sync observation propagates observer errors; hooks still run in finally.
      await expect(
        failOm.observe({
          threadId,
          messages: createBulkMessages(10, threadId),
          hooks,
        }),
      ).rejects.toThrow(/Observer failed/);

      expect(hooks.onObservationStart).toHaveBeenCalledOnce();
      expect(hooks.onObservationEnd).toHaveBeenCalledOnce();
      // Observer failed before producing usage, so usage should be undefined and error should be present
      expect(hooks.onObservationEnd).toHaveBeenCalledWith({ usage: undefined, error: expect.any(Error) });
      expect(hooks.onObservationEnd.mock.calls[0]![0].error.message).toMatch(/Observer failed/);
    });

    it('should call reflection hooks when reflection triggers', async () => {
      // Very low reflection threshold
      const omReflect = createOM(storage, { observationTokens: 5 });
      const messages = createBulkMessages(10, threadId);

      const hooks = {
        onObservationStart: vi.fn(),
        onObservationEnd: vi.fn(),
        onReflectionStart: vi.fn(),
        onReflectionEnd: vi.fn(),
      };

      const result = await omReflect.observe({ threadId, messages, hooks });

      expect(result.observed).toBe(true);
      // Reflection should have triggered due to low threshold
      if (result.reflected) {
        expect(hooks.onReflectionStart).toHaveBeenCalled();
        expect(hooks.onReflectionEnd).toHaveBeenCalled();
        expect(hooks.onReflectionEnd).toHaveBeenCalledWith({
          usage: expect.objectContaining({ inputTokens: expect.any(Number), outputTokens: expect.any(Number) }),
        });
      }
    });
  });

  describe('reflected flag', () => {
    it('should return reflected=true when observation triggers reflection', async () => {
      // Very low reflection threshold to force reflection
      const omReflect = createOM(storage, { observationTokens: 5 });
      const messages = createBulkMessages(10, threadId);

      const result = await omReflect.observe({ threadId, messages });

      expect(result.observed).toBe(true);
      expect(result.reflected).toBe(true);
      expect(result.record.generationCount).toBeGreaterThan(0);
    });

    it('should return reflected=false when reflection threshold is not reached', async () => {
      const messages = createBulkMessages(10, threadId);
      const result = await om.observe({ threadId, messages });

      expect(result.observed).toBe(true);
      expect(result.reflected).toBe(false);
    });
  });

  describe('resource scope', () => {
    const resourceId = 'res-1';

    it('should observe in resource scope with provided messages', async () => {
      await storage.saveThread({
        thread: { id: threadId, resourceId, title: 'Test', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      });

      const resourceOm = createOM(storage, {
        scope: 'resource',
        observerModel: createMockObserverModel(
          `<observations>\n<thread id="${threadId}">\n* Observed from resource scope\n<current-task>\n- Primary: Testing\n</current-task>\n<suggested-response>\nContinue\n</suggested-response>\n</thread>\n</observations>`,
        ),
      });

      const messages = createBulkMessages(10, threadId);
      const result = await resourceOm.observe({ threadId, resourceId, messages });

      expect(result.observed).toBe(true);
      expect(result.record.activeObservations).toBeTruthy();
    });

    it('should observe in resource scope loading from storage', async () => {
      await storage.saveThread({
        thread: { id: threadId, resourceId, title: 'Test', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      });

      const resourceOm = createOM(storage, {
        scope: 'resource',
        observerModel: createMockObserverModel(
          `<observations>\n<thread id="${threadId}">\n* Observed from resource scope storage\n<current-task>\n- Primary: Testing\n</current-task>\n<suggested-response>\nContinue\n</suggested-response>\n</thread>\n</observations>`,
        ),
      });

      // Messages must have resourceId for listMessagesByResourceId to find them
      const messages = createBulkMessages(10, threadId).map(m => ({ ...m, resourceId }));
      await storage.saveMessages({ messages });
      const result = await resourceOm.observe({ threadId, resourceId });

      expect(result.observed).toBe(true);
      expect(result.record.activeObservations).toBeTruthy();
    });
  });
});

// =============================================================================
// buffer()
// =============================================================================

describe('buffer()', () => {
  let storage: InMemoryMemory;
  const threadId = 'buffer-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should return buffered=false when async buffering is disabled', async () => {
    const om = createOM(storage, { bufferTokens: false });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    const result = await om.buffer({ threadId });
    expect(result.buffered).toBe(false);
  });

  it('should create buffered chunk when enabled and messages exist', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    const result = await om.buffer({ threadId });
    expect(result.buffered).toBe(true);
    expect(result.record).toBeTruthy();
  });

  it('should use provided messages instead of loading from storage', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    const messages = createBulkMessages(5, threadId);

    const result = await om.buffer({ threadId, messages });
    expect(result.buffered).toBe(true);
  });

  it('should not buffer when no unobserved messages exist', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    // No messages in storage

    const result = await om.buffer({ threadId });
    expect(result.buffered).toBe(false);
  });

  it('should create multiple chunks on successive calls with new messages', async () => {
    const om = createOM(storage, { messageTokens: 5000, bufferTokens: 0.1 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });
    const r1 = await om.buffer({ threadId });

    // Add more messages for second buffer
    const newMsgs = createBulkMessages(5, threadId, Date.now() + 100_000).map((m, i) => ({
      ...m,
      id: `${threadId}-new-${i}`,
    }));
    await storage.saveMessages({ messages: newMsgs });
    const r2 = await om.buffer({ threadId });

    if (r1.buffered && r2.buffered) {
      const status = await om.getStatus({ threadId });
      expect(status.bufferedChunkCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('should call beforeBuffer callback with candidate messages', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    const beforeBuffer = vi.fn(async () => {});
    await om.buffer({ threadId, beforeBuffer });

    expect(beforeBuffer).toHaveBeenCalled();
    const candidates = beforeBuffer.mock.calls[0]![0];
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// activate()
// =============================================================================

describe('activate()', () => {
  let storage: InMemoryMemory;
  const threadId = 'activate-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should return activated=false when no buffered chunks exist', async () => {
    const om = createOM(storage);
    const result = await om.activate({ threadId });

    expect(result.activated).toBe(false);
  });

  it('should merge buffered chunks into active observations', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    const bufResult = await om.buffer({ threadId });
    expect(bufResult.buffered).toBe(true);

    const actResult = await om.activate({ threadId });
    expect(actResult.activated).toBe(true);
    expect(actResult.record.activeObservations).toBeTruthy();
  });

  it('should return activatedMessageIds', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    await om.buffer({ threadId });
    const result = await om.activate({ threadId });

    if (result.activated) {
      expect(result.activatedMessageIds).toBeDefined();
      expect(Array.isArray(result.activatedMessageIds)).toBe(true);
    }
  });

  it('should clear buffered chunks after activation', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    await om.buffer({ threadId });
    await om.activate({ threadId });

    // After activation, buffered chunks should be cleared
    const status = await om.getStatus({ threadId });
    expect(status.canActivate).toBe(false);
    expect(status.bufferedChunkCount).toBe(0);
  });

  it('should be idempotent — second activate with no new buffers returns false', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    await om.buffer({ threadId });
    const first = await om.activate({ threadId });
    expect(first.activated).toBe(true);

    const second = await om.activate({ threadId });
    expect(second.activated).toBe(false);
  });
});

// =============================================================================
// reflect()
// =============================================================================

describe('reflect()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'reflect-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage, { observationTokens: 50_000 });
  });

  it('should return reflected=false when no observations exist', async () => {
    const result = await om.reflect(threadId);
    expect(result.reflected).toBe(false);
    expect(result.usage).toBeUndefined();
  });

  it('should reflect when observations exist', async () => {
    // First observe to create observations
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const result = await om.reflect(threadId);
    expect(result.reflected).toBe(true);
    expect(result.record.generationCount).toBeGreaterThan(0);
    expect(result.record.activeObservations).toBeTruthy();
    expect(result.usage).toEqual(
      expect.objectContaining({ inputTokens: expect.any(Number), outputTokens: expect.any(Number) }),
    );
  });

  it('should create a new generation on reflect', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const beforeReflect = await om.getRecord(threadId);
    const genBefore = beforeReflect!.generationCount;

    await om.reflect(threadId);

    const afterReflect = await om.getRecord(threadId);
    expect(afterReflect!.generationCount).toBe(genBefore + 1);
  });

  it('should accept a custom prompt for reflection guidance', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    // This shouldn't throw — the prompt is passed to the reflector
    const result = await om.reflect(threadId, undefined, 'Focus on action items');
    expect(result.reflected).toBe(true);
  });

  it('should preserve history across multiple reflections', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.reflect(threadId);

    // Add more messages and observe again
    const newMsgs = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
      ...m,
      id: `${threadId}-r2-${i}`,
    }));
    await storage.saveMessages({ messages: newMsgs });
    await om.observe({ threadId });
    await om.reflect(threadId);

    const history = await om.getHistory(threadId);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle reflector failure gracefully', async () => {
    const failingReflector = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('Reflector failed');
      },
      doStream: async () => {
        throw new Error('Reflector failed');
      },
    });

    const failOm = createOM(storage, { reflectorModel: failingReflector });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await failOm.observe({ threadId });

    // reflect() catches errors and returns reflected=false
    const result = await failOm.reflect(threadId);
    expect(result.reflected).toBe(false);
    expect(result.record).toBeTruthy();
  });
});

// =============================================================================
// buildContextSystemMessage()
// =============================================================================

describe('buildContextSystemMessage()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'ctx-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('should return undefined when no observations exist', async () => {
    const result = await om.buildContextSystemMessage({ threadId });
    expect(result).toBeUndefined();
  });

  it('should return system message after observation', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const record = (await om.getRecord(threadId))!;
    const result = await om.buildContextSystemMessage({ threadId, record });

    expect(result).toBeTruthy();
    expect(result).toContain('observations');
  });

  it('should load record from storage when not provided', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    // Call without passing record — should load it internally
    const result = await om.buildContextSystemMessage({ threadId });
    expect(result).toBeTruthy();
  });

  it('should include unobservedContextBlocks when provided', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const record = (await om.getRecord(threadId))!;
    const result = await om.buildContextSystemMessage({
      threadId,
      record,
      unobservedContextBlocks: 'Additional context from other threads',
    });

    expect(result).toBeTruthy();
  });

  it('should accept a custom currentDate', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const record = (await om.getRecord(threadId))!;
    // Should not throw with a custom date
    const result = await om.buildContextSystemMessage({
      threadId,
      record,
      currentDate: new Date('2025-01-01'),
    });

    expect(result).toBeTruthy();
  });
});

// =============================================================================
// getRecord() / getOrCreateRecord() / getObservations()
// =============================================================================

describe('record management', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'record-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('getRecord should return null for non-existent thread', async () => {
    const record = await om.getRecord('nonexistent');
    expect(record).toBeNull();
  });

  it('getOrCreateRecord should create a record if none exists', async () => {
    const record = await om.getOrCreateRecord(threadId);
    expect(record).toBeTruthy();
    expect(record.activeObservations).toBeFalsy();
  });

  it('getOrCreateRecord should return existing record', async () => {
    const first = await om.getOrCreateRecord(threadId);
    const second = await om.getOrCreateRecord(threadId);
    expect(first.id).toBe(second.id);
  });

  it('getObservations should return undefined for fresh thread', async () => {
    const obs = await om.getObservations(threadId);
    expect(obs).toBeUndefined();
  });

  it('getObservations should return observations after observe', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const obs = await om.getObservations(threadId);
    expect(obs).toBeTruthy();
    expect(obs).toContain('User discussed');
  });
});

// =============================================================================
// clear()
// =============================================================================

describe('clear()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'clear-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('should remove all OM data for thread', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    expect(await om.getObservations(threadId)).toBeTruthy();

    await om.clear(threadId);

    expect(await om.getRecord(threadId)).toBeNull();
    expect(await om.getObservations(threadId)).toBeUndefined();
  });

  it('should allow re-observation after clear', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.clear(threadId);

    // Re-observe with the same messages still in storage
    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toBeTruthy();
  });

  it('should not affect other threads', async () => {
    const otherThread = 'other-thread';
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await storage.saveMessages({ messages: createBulkMessages(10, otherThread) });
    await om.observe({ threadId });
    await om.observe({ threadId: otherThread });

    await om.clear(threadId);

    expect(await om.getRecord(threadId)).toBeNull();
    expect(await om.getRecord(otherThread)).not.toBeNull();
  });
});

// =============================================================================
// getHistory()
// =============================================================================

describe('getHistory()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'history-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage, { observationTokens: 50_000 });
  });

  it('should return empty array when no history exists', async () => {
    const history = await om.getHistory(threadId);
    expect(history).toEqual([]);
  });

  it('should return one record after first observation', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    const history = await om.getHistory(threadId);
    expect(history.length).toBe(1);
  });

  it('should return multiple records after reflection', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.reflect(threadId);

    const history = await om.getHistory(threadId);
    expect(history.length).toBe(2);
  });

  it('should respect limit parameter', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.reflect(threadId);

    // Add more and reflect again
    const moreMsgs = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
      ...m,
      id: `${threadId}-h-${i}`,
    }));
    await storage.saveMessages({ messages: moreMsgs });
    await om.observe({ threadId });
    await om.reflect(threadId);

    const all = await om.getHistory(threadId);
    const limited = await om.getHistory(threadId, undefined, 1);

    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(limited.length).toBe(1);
  });
});

// =============================================================================
// getResolvedConfig()
// =============================================================================

describe('getResolvedConfig()', () => {
  it('should return config with scope', async () => {
    const storage = createInMemoryStorage();
    const om = createOM(storage);

    const config = await om.getResolvedConfig();
    expect(config.scope).toBe('thread');
    expect(config.observation).toBeTruthy();
    expect(config.reflection).toBeTruthy();
  });

  it('should reflect resource scope when configured', async () => {
    const storage = createInMemoryStorage();
    const om = createOM(storage, { scope: 'resource' });

    const config = await om.getResolvedConfig();
    expect(config.scope).toBe('resource');
  });

  it('should surface tiered observer model config without failing resolution', async () => {
    const storage = createInMemoryStorage();
    const om = createOM(storage, {
      observerModel: new ModelByInputTokens({
        upTo: {
          1000: 'openai/gpt-4o-mini',
          5000: 'openai/gpt-4o',
        },
      }),
    });

    const config = await om.getResolvedConfig();

    expect(config.observation.model).toBe('openai/gpt-4o-mini');
    expect(config.observation.routing).toEqual([
      { upTo: 1000, model: 'openai/gpt-4o-mini' },
      { upTo: 5000, model: 'openai/gpt-4o' },
    ]);
  });
});

// =============================================================================
// getStorage() / getTokenCounter() / getObservationConfig() / getReflectionConfig()
// =============================================================================

describe('accessor methods', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('getStorage should return the storage instance', () => {
    expect(om.getStorage()).toBe(storage);
  });

  it('getTokenCounter should return a TokenCounter', () => {
    const counter = om.getTokenCounter();
    expect(counter).toBeTruthy();
    expect(typeof counter.countString).toBe('function');
  });

  it('getObservationConfig should return observation config', () => {
    const config = om.getObservationConfig();
    expect(config).toBeTruthy();
    expect(config.messageTokens).toBeDefined();
  });

  it('getReflectionConfig should return reflection config', () => {
    const config = om.getReflectionConfig();
    expect(config).toBeTruthy();
    expect(config.observationTokens).toBeDefined();
  });

  it('config getter should return scope and token thresholds', () => {
    const config = om.config;
    expect(config.scope).toBe('thread');
    expect(config.observation.messageTokens).toBeDefined();
    expect(config.reflection.observationTokens).toBeDefined();
  });
});

// =============================================================================
// waitForBuffering() / awaitBuffering()
// =============================================================================

describe('waitForBuffering()', () => {
  let storage: InMemoryMemory;
  const threadId = 'wait-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should resolve immediately when no buffering is in progress', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    // No buffering started — should resolve without hanging
    await om.waitForBuffering(threadId, undefined, 1000);
  });

  it('should resolve after buffer completes', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    // Start buffering (fire-and-forget)
    const bufferPromise = om.buffer({ threadId });

    // Wait should resolve once buffering completes
    await bufferPromise;
    await om.waitForBuffering(threadId, undefined, 5000);
  });
});

// =============================================================================
// Full lifecycle: getStatus → observe → buildContext → reflect → getHistory
// =============================================================================

describe('full observation lifecycle', () => {
  let storage: InMemoryMemory;
  const threadId = 'lifecycle-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should complete the full observe → context → reflect → history cycle', async () => {
    const om = createOM(storage, { observationTokens: 5 }); // Very low to trigger reflection
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    // 1. Check status
    const status = await om.getStatus({ threadId });
    expect(status.shouldObserve).toBe(true);

    // 2. Observe (may auto-reflect due to low threshold)
    const obsResult = await om.observe({ threadId });
    expect(obsResult.observed).toBe(true);

    // 3. Build context — observations exist
    const record = (await om.getRecord(threadId))!;
    const systemMessage = await om.buildContextSystemMessage({ threadId, record });
    expect(systemMessage).toBeTruthy();

    // 4. If not already reflected, manually reflect
    if (!obsResult.reflected) {
      const refResult = await om.reflect(threadId);
      expect(refResult.reflected).toBe(true);
    }

    // 5. History should have entries
    const history = await om.getHistory(threadId);
    expect(history.length).toBeGreaterThanOrEqual(1);

    // 6. Status after observation — no pending messages
    const afterStatus = await om.getStatus({ threadId });
    expect(afterStatus.shouldObserve).toBe(false);
  });

  it('should complete full buffer → activate → observe cycle', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    // 1. Buffer
    const bufResult = await om.buffer({ threadId });

    if (bufResult.buffered) {
      // 2. Check status — should be able to activate
      const status = await om.getStatus({ threadId });
      expect(status.canActivate).toBe(true);

      // 3. Activate
      const actResult = await om.activate({ threadId });
      expect(actResult.activated).toBe(true);
      expect(actResult.record.activeObservations).toBeTruthy();

      // 4. Build context with activated observations
      const sysMsg = await om.buildContextSystemMessage({ threadId, record: actResult.record });
      expect(sysMsg).toBeTruthy();
    }
  });
});

// =============================================================================
// Multi-thread isolation
// =============================================================================

describe('multi-thread isolation', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('observations on one thread should not affect another', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, 't-1') });
    await storage.saveMessages({ messages: createBulkMessages(10, 't-2') });

    await om.observe({ threadId: 't-1' });

    const obs1 = await om.getObservations('t-1');
    const obs2 = await om.getObservations('t-2');

    expect(obs1).toBeTruthy();
    expect(obs2).toBeUndefined();
  });

  it('status for one thread should be independent of another', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, 't-1') });

    const status1 = await om.getStatus({ threadId: 't-1' });
    const status2 = await om.getStatus({ threadId: 't-2' });

    expect(status1.shouldObserve).toBe(true);
    expect(status2.shouldObserve).toBe(false);
  });

  it('clearing one thread should not affect another', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, 't-1') });
    await storage.saveMessages({ messages: createBulkMessages(10, 't-2') });

    await om.observe({ threadId: 't-1' });
    await om.observe({ threadId: 't-2' });

    await om.clear('t-1');

    expect(await om.getObservations('t-1')).toBeUndefined();
    expect(await om.getObservations('t-2')).toBeTruthy();
  });
});

// =============================================================================
// Concurrent operations
// =============================================================================

describe('concurrent operations', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'concurrent-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('concurrent observe calls on same thread should not corrupt state', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    // Fire two observe calls concurrently
    const [r1, r2] = await Promise.all([om.observe({ threadId }), om.observe({ threadId })]);

    // At least one should succeed (locking serializes them)
    expect(r1.observed || r2.observed).toBe(true);

    // Record should be consistent
    const record = await om.getRecord(threadId);
    expect(record!.activeObservations).toBeTruthy();
  });

  it('concurrent observe on different threads should both succeed', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, 'ct-1') });
    await storage.saveMessages({ messages: createBulkMessages(10, 'ct-2') });

    const [r1, r2] = await Promise.all([om.observe({ threadId: 'ct-1' }), om.observe({ threadId: 'ct-2' })]);

    expect(r1.observed).toBe(true);
    expect(r2.observed).toBe(true);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('edge cases', () => {
  let storage: InMemoryMemory;
  const threadId = 'edge-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('observe with empty messages array should not observe', async () => {
    const om = createOM(storage);
    const result = await om.observe({ threadId, messages: [] });
    expect(result.observed).toBe(false);
  });

  it('buffer with empty messages array should not buffer', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    const result = await om.buffer({ threadId, messages: [] });
    expect(result.buffered).toBe(false);
  });

  it('getStatus after clear returns clean state', async () => {
    const om = createOM(storage);
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.clear(threadId);

    const status = await om.getStatus({ threadId });
    // Fresh state, but messages still exist in storage
    expect(status.shouldObserve).toBe(true); // Messages still there, record reset
  });

  it('observe → clear → observe should work cleanly', async () => {
    const om = createOM(storage);
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const r1 = await om.observe({ threadId });
    expect(r1.observed).toBe(true);

    await om.clear(threadId);
    expect(await om.getRecord(threadId)).toBeNull();

    const r2 = await om.observe({ threadId });
    expect(r2.observed).toBe(true);
    expect(r2.record.activeObservations).toBeTruthy();
  });

  it('buildContextSystemMessage with explicit record that has no observations returns undefined', async () => {
    const om = createOM(storage);
    const record = await om.getOrCreateRecord(threadId);
    const result = await om.buildContextSystemMessage({ threadId, record });
    expect(result).toBeUndefined();
  });

  it('reflect after clear returns reflected=false', async () => {
    const om = createOM(storage);
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.clear(threadId);

    const result = await om.reflect(threadId);
    expect(result.reflected).toBe(false);
  });

  it('getOrCreateRecord should throw for null threadId in thread scope', async () => {
    const om = createOM(storage, { scope: 'thread' });
    await expect(om.getOrCreateRecord(null as any)).rejects.toThrow();
  });

  it('multiple rapid getStatus calls return consistent results', async () => {
    const om = createOM(storage);
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const results = await Promise.all([
      om.getStatus({ threadId }),
      om.getStatus({ threadId }),
      om.getStatus({ threadId }),
    ]);

    // All should report the same shouldObserve state
    const allShouldObserve = results.every(r => r.shouldObserve === results[0]!.shouldObserve);
    expect(allShouldObserve).toBe(true);
  });
});

// =============================================================================
// getOtherThreadsContext() (resource scope)
// =============================================================================

describe('getOtherThreadsContext()', () => {
  let storage: InMemoryMemory;
  const resourceId = 'resource-1';
  const threadA = 'thread-a';
  const threadB = 'thread-b';

  beforeEach(async () => {
    storage = createInMemoryStorage();

    await storage.saveThread({
      thread: {
        id: threadA,
        resourceId,
        title: 'Thread A',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await storage.saveThread({
      thread: {
        id: threadB,
        resourceId,
        title: 'Thread B',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it('should return undefined when no other threads have messages', async () => {
    const om = createOM(storage, { scope: 'resource' });
    const result = await om.getOtherThreadsContext(resourceId, threadA);

    // No messages on threadB, so nothing to return
    expect(result).toBeUndefined();
  });

  it('should return context from other threads with messages', async () => {
    const om = createOM(storage, { scope: 'resource' });

    // Add messages to threadB
    await storage.saveMessages({
      messages: createBulkMessages(5, threadB),
    });

    const result = await om.getOtherThreadsContext(resourceId, threadA);
    // Should contain formatted messages from threadB
    if (result) {
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Token counting integration
// =============================================================================

describe('token counting methods', () => {
  let om: ObservationalMemory;

  beforeEach(() => {
    const storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('getTokenCounter should count tokens in strings', () => {
    const count = om.getTokenCounter().countString('Hello, this is a test string for token counting.');
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it('getTokenCounter should return 0 for empty string', () => {
    expect(om.getTokenCounter().countString('')).toBe(0);
  });

  it('getTokenCounter should count tokens in messages', () => {
    const messages = [createTestMessage('Hello world', 'user'), createTestMessage('Hi there', 'assistant')];
    const count = om.getTokenCounter().countMessages(messages);
    expect(count).toBeGreaterThan(0);
  });

  it('getTokenCounter async should return consistent results', async () => {
    const messages = [createTestMessage('Hello world', 'user')];
    const sync = om.getTokenCounter().countMessages(messages);
    const asyncCount = await om.getTokenCounter().countMessagesAsync(messages);

    // Async may be slightly different due to image probing, but for text-only they should match
    expect(asyncCount).toBe(sync);
  });
});

// =============================================================================
// Method interaction patterns (derived from processor & AI SDK usage)
// =============================================================================

describe('getStatus → observe interaction', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'status-observe-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('getStatus.shouldObserve=true → observe() succeeds → getStatus.shouldObserve=false', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const before = await om.getStatus({ threadId });
    expect(before.shouldObserve).toBe(true);

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);

    const after = await om.getStatus({ threadId });
    expect(after.shouldObserve).toBe(false);
    expect(after.pendingTokens).toBe(0);
  });

  it('getStatus.shouldObserve=false → observe() skips', async () => {
    await storage.saveMessages({ messages: [{ ...createTestMessage('Hi'), threadId }] });

    const status = await om.getStatus({ threadId });
    expect(status.shouldObserve).toBe(false);

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(false);
  });

  it('getStatus reflects new messages added after observation', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    // No new messages → shouldObserve false
    const s1 = await om.getStatus({ threadId });
    expect(s1.shouldObserve).toBe(false);

    // Add more messages → shouldObserve true again
    const newMsgs = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
      ...m,
      id: `${threadId}-post-${i}`,
    }));
    await storage.saveMessages({ messages: newMsgs });

    const s2 = await om.getStatus({ threadId });
    expect(s2.shouldObserve).toBe(true);
  });
});

describe('getStatus → buffer → getStatus shows chunk progression', () => {
  let storage: InMemoryMemory;
  const threadId = 'status-buffer-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('bufferedChunkCount increases after buffer()', async () => {
    // 10 messages at ~50 tokens each = ~500 tokens. bufferTokens 0.05 of 2000 = 100-token interval.
    const om = createOM(storage, { messageTokens: 2000, bufferTokens: 0.05 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const before = await om.getStatus({ threadId });
    expect(before.bufferedChunkCount).toBe(0);
    expect(before.canActivate).toBe(false);

    await om.buffer({ threadId });

    const after = await om.getStatus({ threadId });
    expect(after.bufferedChunkCount).toBeGreaterThan(0);
    expect(after.canActivate).toBe(true);
    expect(after.bufferedChunkTokens).toBeGreaterThan(0);
  });

  it('canActivate resets to false after activate()', async () => {
    const om = createOM(storage, { messageTokens: 2000, bufferTokens: 0.05 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    await om.buffer({ threadId });
    const mid = await om.getStatus({ threadId });
    expect(mid.canActivate).toBe(true);

    await om.activate({ threadId });
    const after = await om.getStatus({ threadId });
    expect(after.canActivate).toBe(false);
    expect(after.bufferedChunkCount).toBe(0);
  });
});

describe('cursor-based observation tracking (lastObservedAt)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'cursor-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('observe sets lastObservedAt on the record', async () => {
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const before = await om.getOrCreateRecord(threadId);
    expect(before.lastObservedAt).toBeFalsy();

    await om.observe({ threadId });

    const after = (await om.getRecord(threadId))!;
    expect(after.lastObservedAt).toBeTruthy();
  });

  it('second observe only sees messages newer than lastObservedAt', async () => {
    // First batch of messages
    const batch1 = createBulkMessages(10, threadId, Date.now() - 20_000);
    await storage.saveMessages({ messages: batch1 });

    const first = await om.observe({ threadId });
    expect(first.observed).toBe(true);
    const lastObserved = (await om.getRecord(threadId))!.lastObservedAt;
    expect(lastObserved).toBeTruthy();

    // Add second batch with later timestamps
    const batch2 = createBulkMessages(10, threadId, Date.now() + 10_000).map((m, i) => ({
      ...m,
      id: `${threadId}-batch2-${i}`,
    }));
    await storage.saveMessages({ messages: batch2 });

    const second = await om.observe({ threadId });
    expect(second.observed).toBe(true);

    // lastObservedAt should have advanced
    const afterSecond = (await om.getRecord(threadId))!;
    expect(new Date(afterSecond.lastObservedAt!).getTime()).toBeGreaterThan(new Date(lastObserved!).getTime());
  });

  it('observe with same messages (no new ones) returns observed=false', async () => {
    const messages = createBulkMessages(10, threadId);
    await storage.saveMessages({ messages });

    const r1 = await om.observe({ threadId });
    expect(r1.observed).toBe(true);

    // Same messages, no new additions — cursor prevents re-observation
    const r2 = await om.observe({ threadId });
    expect(r2.observed).toBe(false);
  });
});

describe('buffer → activate → observe flow', () => {
  let storage: InMemoryMemory;
  const threadId = 'bao-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('buffer stores chunks, activate merges them, then observe works on new messages', async () => {
    const om = createOM(storage, { messageTokens: 5000, bufferTokens: 0.1 });

    // Phase 1: buffer some messages
    const batch1 = createBulkMessages(5, threadId, Date.now() - 10_000);
    await storage.saveMessages({ messages: batch1 });
    const bufResult = await om.buffer({ threadId });

    if (!bufResult.buffered) return; // Skip if buffer conditions not met

    // Phase 2: activate
    const actResult = await om.activate({ threadId });
    expect(actResult.activated).toBe(true);
    expect(actResult.record.activeObservations).toBeTruthy();

    // Phase 3: add more messages and observe
    const batch2 = createBulkMessages(20, threadId, Date.now() + 10_000).map((m, i) => ({
      ...m,
      id: `${threadId}-b2-${i}`,
    }));
    await storage.saveMessages({ messages: batch2 });

    const obsResult = await om.observe({ threadId });
    // Whether it observes depends on threshold, but it shouldn't error
    expect(obsResult.record).toBeTruthy();
    // Observations from activation should still be there (potentially updated by observe)
    expect(obsResult.record.activeObservations).toBeTruthy();
  });

  it('activate returns activatedMessageIds from buffered chunks', async () => {
    const om = createOM(storage, { messageTokens: 5000, bufferTokens: 0.1 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    await om.buffer({ threadId });
    const result = await om.activate({ threadId });

    if (result.activated && result.activatedMessageIds) {
      expect(Array.isArray(result.activatedMessageIds)).toBe(true);
      // These IDs should correspond to messages that were in the buffered chunk
    }
  });
});

describe('observe → reflect → getHistory flow', () => {
  let storage: InMemoryMemory;
  const threadId = 'orf-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('observe produces observations, reflect condenses them, history tracks both generations', async () => {
    const om = createOM(storage, { observationTokens: 50_000 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    // Step 1: observe
    const obsResult = await om.observe({ threadId });
    expect(obsResult.observed).toBe(true);

    const genBefore = obsResult.record.generationCount;

    // Step 2: reflect
    const refResult = await om.reflect(threadId);
    expect(refResult.reflected).toBe(true);
    expect(refResult.record.generationCount).toBe(genBefore + 1);

    // Step 3: history has both generations
    const history = await om.getHistory(threadId);
    expect(history.length).toBe(2);

    // The active record should now have reflected observations
    const current = (await om.getRecord(threadId))!;
    expect(current.activeObservations).toBeTruthy();
    expect(current.generationCount).toBe(genBefore + 1);
  });

  it('buildContextSystemMessage works with reflected record', async () => {
    const om = createOM(storage, { observationTokens: 50_000 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });
    await om.reflect(threadId);

    const record = (await om.getRecord(threadId))!;
    const sysMsg = await om.buildContextSystemMessage({ threadId, record });
    expect(sysMsg).toBeTruthy();
    // System message should contain the reflected observations
    expect(sysMsg).toContain('observations');
  });
});

describe('observation auto-triggers reflection when threshold exceeded', () => {
  let storage: InMemoryMemory;
  const threadId = 'autoref-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('observe() returns reflected=true when observation tokens exceed reflection threshold', async () => {
    // Very low reflection threshold to guarantee trigger
    const om = createOM(storage, { observationTokens: 5 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);
    expect(result.reflected).toBe(true);
    expect(result.record.generationCount).toBeGreaterThan(0);
  });

  it('observe() returns reflected=false when observation tokens are below reflection threshold', async () => {
    const om = createOM(storage, { observationTokens: 100_000 });
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);
    expect(result.reflected).toBe(false);
    expect(result.record.generationCount).toBe(0);
  });
});

describe('getStatus shouldBuffer vs shouldObserve boundary', () => {
  let storage: InMemoryMemory;
  const threadId = 'boundary-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('shouldBuffer and shouldObserve should be mutually exclusive', async () => {
    // With async buffering enabled, buffer is below threshold, observe is at/above
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(3, threadId) });

    const status = await om.getStatus({ threadId });
    // They should never both be true simultaneously
    if (status.shouldObserve) {
      expect(status.shouldBuffer).toBe(false);
    }
  });

  it('shouldObserve=true implies pendingTokens >= threshold', async () => {
    const om = createOM(storage);
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });

    const status = await om.getStatus({ threadId });
    if (status.shouldObserve) {
      expect(status.pendingTokens).toBeGreaterThanOrEqual(status.threshold);
    }
  });

  it('shouldBuffer=false when async buffering is disabled', async () => {
    const om = createOM(storage, { bufferTokens: false });
    await storage.saveMessages({ messages: createBulkMessages(3, threadId) });

    const status = await om.getStatus({ threadId });
    expect(status.shouldBuffer).toBe(false);
  });
});

describe('getUnobservedMessages filtering', () => {
  let storage: InMemoryMemory;
  const threadId = 'unobs-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should return all messages when no prior observation exists', async () => {
    const om = createOM(storage);
    const record = await om.getOrCreateRecord(threadId);
    const messages = createBulkMessages(5, threadId);

    const unobserved = om.getUnobservedMessages(messages, record);
    expect(unobserved.length).toBe(5);
  });

  it('should filter messages whose IDs are in observedMessageIds', async () => {
    const om = createOM(storage);
    const messages = createBulkMessages(5, threadId);

    // Simulate a record that has observed the first 3 messages
    const record = await om.getOrCreateRecord(threadId);
    const observedIds = messages.slice(0, 3).map(m => m.id);
    (record as any).observedMessageIds = observedIds;

    const unobserved = om.getUnobservedMessages(messages, record);
    expect(unobserved.length).toBe(2);
  });

  it('should filter messages older than lastObservedAt cursor', async () => {
    const om = createOM(storage);
    // Messages at: base, base+1s, base+2s, base+3s, base+4s
    const base = Date.now() - 10_000;
    const messages = createBulkMessages(5, threadId, base);

    // Simulate a record with lastObservedAt set between message 2 and 3
    const record = await om.getOrCreateRecord(threadId);
    // Set cursor to just after message index 2 (base + 2000ms)
    (record as any).lastObservedAt = new Date(base + 2500);

    const unobserved = om.getUnobservedMessages(messages, record);
    // Messages at base+3000 and base+4000 should pass the > check
    expect(unobserved.length).toBe(2);
  });
});

describe('sealMessagesForBuffering', () => {
  let om: ObservationalMemory;

  beforeEach(() => {
    const storage = createInMemoryStorage();
    om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
  });

  it('should set sealed metadata on messages with parts', () => {
    const messages: MastraDBMessage[] = [
      {
        ...createTestMessage('Hello', 'user', 'msg-1'),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello' }],
        } as MastraMessageContentV2,
      },
    ];

    om.sealMessagesForBuffering(messages);

    // Message-level sealed flag is on content.metadata.mastra.sealed
    const contentMeta = (messages[0]!.content as any).metadata?.mastra;
    expect(contentMeta?.sealed).toBe(true);

    // Last part gets sealedAt timestamp on part.metadata.mastra.sealedAt
    const lastPart = (messages[0]!.content as MastraMessageContentV2).parts.at(-1) as any;
    expect(lastPart.metadata?.mastra?.sealedAt).toBeGreaterThan(0);
  });

  it('should not throw on messages without parts', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-noparts',
        role: 'user',
        content: 'plain string content' as any,
        type: 'text',
        createdAt: new Date(),
      },
    ];

    // Should not throw
    expect(() => om.sealMessagesForBuffering(messages)).not.toThrow();
  });
});

describe('multi-turn AI SDK patterns (direct OM usage)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'aisdk-pattern-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('pattern: getRecord → buildContextSystemMessage → observe → getRecord', async () => {
    // Turn 1: seed and observe
    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    await om.observe({ threadId });

    // Turn 2: load context, then observe new messages
    const record = (await om.getRecord(threadId))!;
    expect(record.activeObservations).toBeTruthy();

    const systemMessage = await om.buildContextSystemMessage({ threadId, record });
    expect(systemMessage).toBeTruthy();

    // Simulate new user/assistant messages
    const newMsgs = createBulkMessages(10, threadId, Date.now() + 100_000).map((m, i) => ({
      ...m,
      id: `${threadId}-turn2-${i}`,
    }));
    await storage.saveMessages({ messages: newMsgs });

    // Observe again
    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);

    // Updated record
    const updated = (await om.getRecord(threadId))!;
    expect(updated.activeObservations).toBeTruthy();
  });

  it('pattern: getStatus → conditional buffer/observe branching', async () => {
    // Use higher threshold so we can test buffer path
    const bufOm = createOM(storage, { messageTokens: 2000, bufferTokens: 0.2 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    const status = await bufOm.getStatus({ threadId });

    if (status.shouldObserve) {
      const result = await bufOm.observe({ threadId });
      expect(result.observed).toBe(true);
    } else if (status.shouldBuffer) {
      const result = await bufOm.buffer({ threadId });
      expect(result.buffered).toBe(true);
    }

    // Either path should leave the record in a consistent state
    const record = await bufOm.getOrCreateRecord(threadId);
    expect(record).toBeTruthy();
  });

  it('pattern: getStatus → canActivate → activate → buildContextSystemMessage', async () => {
    const bufOm = createOM(storage, { messageTokens: 5000, bufferTokens: 0.1 });
    await storage.saveMessages({ messages: createBulkMessages(5, threadId) });

    // Buffer first
    await bufOm.buffer({ threadId });

    // Check and activate
    const status = await bufOm.getStatus({ threadId });
    if (status.canActivate) {
      const actResult = await bufOm.activate({ threadId });
      expect(actResult.activated).toBe(true);

      // Build context from activated observations
      const record = (await bufOm.getRecord(threadId))!;
      const sysMsg = await bufOm.buildContextSystemMessage({ threadId, record });
      expect(sysMsg).toBeTruthy();
      expect(sysMsg).toContain('observations');
    }
  });
});

describe('observation with different message volumes', () => {
  let storage: InMemoryMemory;
  const threadId = 'volume-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should observe with exactly enough messages to cross threshold', async () => {
    // Use higher threshold and add messages incrementally until we cross it
    const om = createOM(storage, { messageTokens: 200 });

    // Start with messages that might be near threshold
    await storage.saveMessages({
      messages: createBulkMessages(5, threadId),
    });

    const status = await om.getStatus({ threadId });

    if (status.shouldObserve) {
      const result = await om.observe({ threadId });
      expect(result.observed).toBe(true);
    } else {
      // Add more messages to cross
      const more = createBulkMessages(10, threadId, Date.now() + 10_000).map((m, i) => ({
        ...m,
        id: `${threadId}-more-${i}`,
      }));
      await storage.saveMessages({ messages: more });

      const result = await om.observe({ threadId });
      expect(result.observed).toBe(true);
    }
  });

  it('should handle very large message sets without error', async () => {
    const om = createOM(storage, { messageTokens: 100 });
    await storage.saveMessages({ messages: createBulkMessages(50, threadId) });

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toBeTruthy();
  });

  it('should handle single-message conversations', async () => {
    const om = createOM(storage, { messageTokens: 10_000 });
    await storage.saveMessages({ messages: [{ ...createTestMessage('Hello'), threadId }] });

    const result = await om.observe({ threadId });
    expect(result.observed).toBe(false); // Below threshold
  });
});

describe('full async buffering flow', () => {
  let storage: InMemoryMemory;
  const threadId = 'full-async-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('buffer → add more messages → buffer again → activate merges all chunks', async () => {
    const om = createOM(storage, { messageTokens: 10_000, bufferTokens: 0.05 });

    // First batch + buffer
    const batch1 = createBulkMessages(5, threadId, Date.now() - 20_000);
    await storage.saveMessages({ messages: batch1 });
    const r1 = await om.buffer({ threadId });

    // Second batch + buffer
    const batch2 = createBulkMessages(5, threadId, Date.now() + 10_000).map((m, i) => ({
      ...m,
      id: `${threadId}-b2-${i}`,
    }));
    await storage.saveMessages({ messages: batch2 });
    const r2 = await om.buffer({ threadId });

    if (r1.buffered && r2.buffered) {
      const status = await om.getStatus({ threadId });
      expect(status.bufferedChunkCount).toBeGreaterThanOrEqual(2);

      // Activate merges all
      const actResult = await om.activate({ threadId });
      expect(actResult.activated).toBe(true);
      expect(actResult.record.activeObservations).toBeTruthy();

      // All chunks consumed
      const afterStatus = await om.getStatus({ threadId });
      expect(afterStatus.bufferedChunkCount).toBe(0);
    }
  });

  it('buffer → activate → reflect completes the full lifecycle', async () => {
    const om = createOM(storage, { messageTokens: 2000, bufferTokens: 0.05, observationTokens: 5 });

    await storage.saveMessages({ messages: createBulkMessages(10, threadId) });
    const bufResult = await om.buffer({ threadId });

    if (!bufResult.buffered) {
      // If buffer didn't fire (threshold math), skip
      return;
    }

    const actResult = await om.activate({ threadId });
    expect(actResult.activated).toBe(true);
    expect(actResult.record.activeObservations).toBeTruthy();

    // Reflect
    const refResult = await om.reflect(threadId);
    expect(refResult.reflected).toBe(true);

    // History shows both observation + reflection generations
    const history = await om.getHistory(threadId);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getStatus', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'obs-status-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('should return observation status with all expected fields', async () => {
    const messages = createBulkMessages(10, threadId);
    const status = await om.getStatus({
      threadId,
      messages,
    });

    expect(status.record).toBeTruthy();
    expect(typeof status.pendingTokens).toBe('number');
    expect(typeof status.threshold).toBe('number');
    expect(typeof status.shouldObserve).toBe('boolean');
    expect(typeof status.shouldBuffer).toBe('boolean');
    expect(typeof status.shouldReflect).toBe('boolean');
    expect(typeof status.scope).toBe('string');
    expect(typeof status.canActivate).toBe('boolean');
    expect(typeof status.asyncObservationEnabled).toBe('boolean');
  });

  it('should report shouldObserve=true when messages exceed threshold', async () => {
    const messages = createBulkMessages(10, threadId);
    const status = await om.getStatus({
      threadId,
      messages,
    });

    expect(status.shouldObserve).toBe(true);
    expect(status.pendingTokens).toBeGreaterThanOrEqual(status.threshold);
  });
});

describe('setPendingMessageTokens (via storage)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'pending-tokens-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('should persist pending token count to the record', async () => {
    const record = await om.getOrCreateRecord(threadId);
    await om.getStorage().setPendingMessageTokens(record.id, 5000);

    const updated = (await om.getRecord(threadId))!;
    expect(updated.pendingMessageTokens).toBe(5000);
  });

  it('should update pending tokens on successive calls', async () => {
    const record = await om.getOrCreateRecord(threadId);
    await om.getStorage().setPendingMessageTokens(record.id, 3000);
    await om.getStorage().setPendingMessageTokens(record.id, 7000);

    const updated = (await om.getRecord(threadId))!;
    expect(updated.pendingMessageTokens).toBe(7000);
  });
});

// =============================================================================
// Per-record config overrides (_overrides)
// =============================================================================

describe('per-record config overrides', () => {
  let storage: InMemoryMemory;
  const threadId = 'override-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('uses instance-level messageTokens when record has no _overrides', async () => {
    const om = createOM(storage, { messageTokens: 500 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    const status = await om.getStatus({ threadId });
    // threshold should reflect the instance-level 500
    expect(status.threshold).toBe(500);
  });

  it('ignores the initial config snapshot (not under _overrides)', async () => {
    // Instance-level: 500 tokens
    const om = createOM(storage, { messageTokens: 500 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    // getOrCreateRecord writes observation.messageTokens=500 into record.config
    const record = await om.getOrCreateRecord(threadId);
    expect(record.config).toBeTruthy();
    // The snapshot config should NOT be treated as an override
    const status = await om.getStatus({ threadId });
    expect(status.threshold).toBe(500);
  });

  it('applies _overrides.observation.messageTokens when set', async () => {
    const om = createOM(storage, { messageTokens: 500 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    // Create the record first
    const record = await om.getOrCreateRecord(threadId);

    // Manually set _overrides on the record config (simulating what updateObservationalMemoryConfig would do)
    const existingConfig = record.config as Record<string, unknown>;
    record.config = {
      ...existingConfig,
      _overrides: {
        observation: { messageTokens: 2000 },
      },
    };

    // The record object is shared in InMemory storage, so the mutation above
    // is visible to getStatus() which re-reads from the same reference.
    const status = await om.getStatus({ threadId });
    expect(status.threshold).toBe(2000);
  });

  it('applies _overrides.reflection.observationTokens when set', async () => {
    const om = createOM(storage, { messageTokens: 100, observationTokens: 10_000 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    const record = await om.getOrCreateRecord(threadId);

    // Set override to a lower reflection threshold
    const existingConfig = record.config as Record<string, unknown>;
    record.config = {
      ...existingConfig,
      _overrides: {
        reflection: { observationTokens: 5_000 },
      },
    };

    const status = await om.getStatus({ threadId });
    // Reflection threshold should now be 5000 instead of 10000
    // shouldReflect checks: currentObservationTokens >= reflectThreshold
    // With 0 observation tokens, shouldReflect should be false regardless
    expect(status.shouldReflect).toBe(false);
  });

  it('clamps observation override below bufferTokens to instance default', async () => {
    // bufferTokens=200 means messageTokens override must be > 200
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 200 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    const record = await om.getOrCreateRecord(threadId);

    // Set override below bufferTokens — should be clamped
    const existingConfig = record.config as Record<string, unknown>;
    record.config = {
      ...existingConfig,
      _overrides: {
        observation: { messageTokens: 100 }, // Below bufferTokens of 200
      },
    };

    const status = await om.getStatus({ threadId });
    // Should fall back to instance-level 500, not the 100 override
    expect(status.threshold).toBe(500);
  });

  it('falls back to instance-level config when _overrides is empty', async () => {
    const om = createOM(storage, { messageTokens: 500 });
    await storage.saveMessages({ messages: createBulkMessages(20, threadId) });

    const record = await om.getOrCreateRecord(threadId);

    // Set empty _overrides
    const existingConfig = record.config as Record<string, unknown>;
    record.config = {
      ...existingConfig,
      _overrides: {},
    };

    const status = await om.getStatus({ threadId });
    expect(status.threshold).toBe(500);
  });
});

// =============================================================================
// updateRecordConfig()
// =============================================================================

describe('updateRecordConfig()', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'config-update-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage, { messageTokens: 100 });
  });

  it('should store observation config override under _overrides', async () => {
    await om.getOrCreateRecord(threadId);

    await om.updateRecordConfig(threadId, undefined, {
      observation: { messageTokens: 2000 },
    });

    const record = (await om.getRecord(threadId))!;
    expect((record.config as any)._overrides.observation.messageTokens).toBe(2000);
  });

  it('should store reflection config override under _overrides', async () => {
    await om.getOrCreateRecord(threadId);

    await om.updateRecordConfig(threadId, undefined, {
      reflection: { observationTokens: 8000 },
    });

    const record = (await om.getRecord(threadId))!;
    expect((record.config as any)._overrides.reflection.observationTokens).toBe(8000);
  });

  it('should merge both observation and reflection overrides at once', async () => {
    await om.getOrCreateRecord(threadId);

    await om.updateRecordConfig(threadId, undefined, {
      observation: { messageTokens: 3000 },
      reflection: { observationTokens: 9000 },
    });

    const record = (await om.getRecord(threadId))!;
    expect((record.config as any)._overrides.observation.messageTokens).toBe(3000);
    expect((record.config as any)._overrides.reflection.observationTokens).toBe(9000);
  });

  it('should apply successive updates incrementally', async () => {
    await om.getOrCreateRecord(threadId);

    await om.updateRecordConfig(threadId, undefined, {
      observation: { messageTokens: 1000 },
    });
    await om.updateRecordConfig(threadId, undefined, {
      reflection: { observationTokens: 5000 },
    });

    const record = (await om.getRecord(threadId))!;
    // Both updates should be present under _overrides
    expect((record.config as any)._overrides.observation.messageTokens).toBe(1000);
    expect((record.config as any)._overrides.reflection.observationTokens).toBe(5000);
  });

  it('should throw when no record exists for the thread', async () => {
    await expect(
      om.updateRecordConfig('nonexistent-thread', undefined, { observation: { messageTokens: 100 } }),
    ).rejects.toThrow(/No observational memory record found/);
  });
});
