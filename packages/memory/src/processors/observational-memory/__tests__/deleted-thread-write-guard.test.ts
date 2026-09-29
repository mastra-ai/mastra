/**
 * Deleted-thread write guards (https://github.com/mastra-ai/mastra/issues/23177)
 *
 * An observational-memory cycle keeps running after the LLM call that produced its
 * observations. If the thread is deleted during that call, the cycle used to persist
 * into rows and vector indexes that `Memory.deleteThread` had already cleaned up —
 * leaving the deleted thread's text permanently retrievable, resurrecting its OM
 * record, or throwing `Observational memory record not found` from a background path.
 *
 * The interleave is made deterministic by having the mock observer delete the thread
 * from inside `doStream`, which the observer runner awaits before `process()`/`persist()`
 * run. No timers, no polling, no reliance on scheduling luck.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';

const OBSERVATION_TEXT = `<observations>
* The deploy key lives at /etc/secrets/deploy-key
</observations>
<current-task>
- Primary: Continue conversation
</current-task>`;

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

/** Generate N messages padded to comfortably exceed the configured token thresholds. */
function createBulkMessages(count: number, threadId: string): MastraDBMessage[] {
  const base = Date.now() - count * 1000;
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

/**
 * Observer model that runs `onCall` while the LLM request is in flight — the point at
 * which a real `deleteThread` would interleave.
 */
function createObserverModel(onCall?: () => Promise<void>) {
  const runHook = async () => {
    if (onCall) await onCall();
  };

  return new MockLanguageModelV2({
    doGenerate: async () => {
      await runHook();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        warnings: [],
        content: [{ type: 'text', text: OBSERVATION_TEXT }],
      };
    },
    doStream: async () => {
      await runHook();
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: OBSERVATION_TEXT },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  } as never);
}

function createOM(
  storage: InMemoryMemory,
  opts: {
    model: unknown;
    onIndexObservations: ReturnType<typeof vi.fn>;
    /** Low observation threshold so the sync path observes; buffered path uses bufferTokens. */
    messageTokens?: number;
    bufferTokens?: number | false;
    scope?: 'thread' | 'resource';
  },
) {
  return new ObservationalMemory({
    storage,
    scope: opts.scope ?? 'thread',
    retrieval: { vector: true },
    onIndexObservations: opts.onIndexObservations,
    observation: {
      model: opts.model as never,
      messageTokens: opts.messageTokens ?? 50,
      bufferTokens: opts.bufferTokens ?? false,
    },
    reflection: { model: createObserverModel() as never, observationTokens: 10_000_000 },
  });
}

/** Mirrors the destructive half of `Memory.deleteStoredThread`. */
async function simulateThreadDeletion(storage: InMemoryMemory, threadId: string, resourceId: string) {
  await storage.deleteThread({ threadId });
  await storage.clearObservationalMemory(threadId, resourceId);
}

async function seedThread(storage: InMemoryMemory, threadId: string, resourceId: string, messageCount = 5) {
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Write guard probe',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await storage.saveMessages({
    messages: createBulkMessages(messageCount, threadId).map(message => ({ ...message, resourceId })),
  });
}

// Static maps leak across tests in this package (`isolate: false` in vitest.config.ts).
beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

describe('deleted-thread write guards', () => {
  let storage: InMemoryMemory;
  const threadId = 'guard-thread';
  const resourceId = 'guard-resource';

  beforeEach(() => {
    storage = new InMemoryMemory({ db: new InMemoryDB() });
  });

  describe('sync observation cycle', () => {
    it('writes no observation vectors and does not resurrect the record when the thread is deleted mid-cycle', async () => {
      const onIndexObservations = vi.fn().mockResolvedValue(undefined);
      const updateActive = vi.spyOn(storage, 'updateActiveObservations');
      const initialize = vi.spyOn(storage, 'initializeObservationalMemory');
      await seedThread(storage, threadId, resourceId);

      const om = createOM(storage, {
        model: createObserverModel(() => simulateThreadDeletion(storage, threadId, resourceId)),
        onIndexObservations,
      });
      const messages = createBulkMessages(5, threadId).map(message => ({ ...message, resourceId }));

      // Must not reject: persisting into the cleared record used to throw
      // `Observational memory record not found` out of this path.
      const result = await om.observe({ threadId, resourceId, messages });

      expect(onIndexObservations).not.toHaveBeenCalled();
      expect(updateActive).not.toHaveBeenCalled();
      // The record is not recreated for a thread that no longer exists.
      expect(initialize).toHaveBeenCalledTimes(1);
      expect(await storage.getObservationalMemory(threadId, resourceId)).toBeNull();
      expect(await storage.getThreadById({ threadId })).toBeNull();
      // observe() still returns a usable record — callers read `.record.id`.
      expect(result.record).toBeTruthy();
      expect(result.reflected).toBe(false);
    });

    it('still indexes observations when the thread survives the cycle', async () => {
      const onIndexObservations = vi.fn().mockResolvedValue(undefined);
      const updateActive = vi.spyOn(storage, 'updateActiveObservations');
      await seedThread(storage, threadId, resourceId);

      const om = createOM(storage, { model: createObserverModel(), onIndexObservations });
      const messages = createBulkMessages(5, threadId).map(message => ({ ...message, resourceId }));

      await om.observe({ threadId, resourceId, messages });

      expect(onIndexObservations).toHaveBeenCalled();
      expect(updateActive).toHaveBeenCalled();
      expect(await storage.getObservationalMemory(threadId, resourceId)).toBeTruthy();
      const indexed = onIndexObservations.mock.calls.map(call => call[0]);
      expect(indexed.every(entry => entry.threadId === threadId && entry.resourceId === resourceId)).toBe(true);
      expect(indexed.some(entry => String(entry.text).includes('deploy-key'))).toBe(true);
    });
  });

  describe('buffered observation cycle', () => {
    it('writes no buffered chunk and no vectors when the thread is deleted mid-cycle', async () => {
      const onIndexObservations = vi.fn().mockResolvedValue(undefined);
      const updateBuffered = vi.spyOn(storage, 'updateBufferedObservations');
      await seedThread(storage, threadId, resourceId);

      const om = createOM(storage, {
        model: createObserverModel(() => simulateThreadDeletion(storage, threadId, resourceId)),
        onIndexObservations,
        messageTokens: 500,
        bufferTokens: 0.2,
      });

      await om.buffer({ threadId, resourceId });
      await om.waitForBuffering(threadId, resourceId, 5000);

      expect(onIndexObservations).not.toHaveBeenCalled();
      expect(updateBuffered).not.toHaveBeenCalled();
      expect(await storage.getThreadById({ threadId })).toBeNull();
    });

    it('still buffers and indexes when the thread survives the cycle', async () => {
      const onIndexObservations = vi.fn().mockResolvedValue(undefined);
      const updateBuffered = vi.spyOn(storage, 'updateBufferedObservations');
      await seedThread(storage, threadId, resourceId);

      const om = createOM(storage, {
        model: createObserverModel(),
        onIndexObservations,
        messageTokens: 500,
        bufferTokens: 0.2,
      });

      await om.buffer({ threadId, resourceId });
      await om.waitForBuffering(threadId, resourceId, 5000);

      expect(onIndexObservations).toHaveBeenCalled();
      expect(updateBuffered).toHaveBeenCalled();
      const status = await om.getStatus({ threadId, resourceId });
      expect(status.bufferedChunkCount).toBe(1);
    });
  });
});
