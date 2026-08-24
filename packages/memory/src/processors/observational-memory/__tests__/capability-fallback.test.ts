/**
 * Storage capability fallback tests (observation buffer claims).
 *
 * `@mastra/memory` can be upgraded independently of storage adapters. An old
 * adapter compiled against the new core base inherits throwing defaults for
 * the five claim methods and never sets `supportsObservationBufferClaims`, so
 * consumers must branch to the legacy (single-process) buffering lifecycle
 * when the flag is false — otherwise the claim acquire throws, the error is
 * swallowed, and Observational Memory is silently disabled.
 *
 * Modeled on `patch-thread.test.ts`'s Legacy/Modern stub pattern: the Legacy
 * stub explicitly overrides, in the stub itself, exactly the surface an old
 * adapter presents when compiled against the new base — flag false plus the
 * five claim operations re-throwing the base's own not-implemented error via
 * `MemoryStorage.prototype.<method>.call(this, ...)` so the thrown value
 * cannot drift from `base.ts`'s default.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB, MemoryStorage } from '@mastra/core/storage';
import type {
  AcquireObservationBufferClaimInput,
  RenewObservationBufferClaimInput,
  ReleaseObservationBufferClaimInput,
  CommitBufferedObservationsInput,
  ObservationBufferClaimOutcome,
  ObservationBufferClaimStatus,
  CommitBufferedObservationsResult,
} from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';

// =============================================================================
// Stubs
// =============================================================================

/**
 * What an OLD adapter looks like when compiled against the NEW core base:
 * no capability flag (resolves to the base default false) and the five claim
 * methods inherited as throwing defaults. Forced explicitly here so the stub
 * keeps modeling that surface even after `InMemoryMemory` itself implements
 * the claims and declares the flag true.
 */
class LegacyMemoryStorage extends InMemoryMemory {
  override readonly supportsObservationBufferClaims: boolean = false;

  override acquireObservationBufferClaim(
    input: AcquireObservationBufferClaimInput,
  ): Promise<ObservationBufferClaimOutcome> {
    return MemoryStorage.prototype.acquireObservationBufferClaim.call(this, input);
  }
  override renewObservationBufferClaim(
    input: RenewObservationBufferClaimInput,
  ): Promise<ObservationBufferClaimOutcome> {
    return MemoryStorage.prototype.renewObservationBufferClaim.call(this, input);
  }
  override releaseObservationBufferClaim(
    input: ReleaseObservationBufferClaimInput,
  ): Promise<ObservationBufferClaimOutcome> {
    return MemoryStorage.prototype.releaseObservationBufferClaim.call(this, input);
  }
  override commitBufferedObservations(
    input: CommitBufferedObservationsInput,
  ): Promise<CommitBufferedObservationsResult> {
    return MemoryStorage.prototype.commitBufferedObservations.call(this, input);
  }
  override getObservationBufferClaimStatus(id: string): Promise<ObservationBufferClaimStatus> {
    return MemoryStorage.prototype.getObservationBufferClaimStatus.call(this, id);
  }
}

/** A claim-capable adapter: plain InMemoryMemory (flag true, real claim ops). */
class ModernMemoryStorage extends InMemoryMemory {}

// =============================================================================
// Helpers
// =============================================================================

const threadId = 'capability-thread';
const resourceId = 'capability-resource';
const filler = 'The quick brown fox jumps over the lazy dog. '.repeat(10);

async function seedThread(storage: InMemoryMemory, messageCount = 20): Promise<MastraDBMessage[]> {
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Capability Thread',
      createdAt: new Date('2025-01-01T08:00:00Z'),
      updatedAt: new Date('2025-01-01T08:00:00Z'),
      metadata: {},
    },
  });
  const messages: MastraDBMessage[] = [];
  for (let i = 0; i < messageCount; i++) {
    messages.push({
      id: `cap-msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: `Message ${i}: ${filler}` }] },
      type: 'text',
      createdAt: new Date(Date.UTC(2025, 0, 1, 9, i)),
      threadId,
      resourceId,
    } as MastraDBMessage);
  }
  if (messages.length > 0) await storage.saveMessages({ messages: messages as any });
  return messages;
}

function createOM(storage: InMemoryMemory): { om: ObservationalMemory; observerCalls: number[] } {
  const observerCalls: number[] = [];
  const mockModel = new MockLanguageModelV2({
    doStream: async () => {
      observerCalls.push(observerCalls.length + 1);
      const text = `<observations>\nDate: Jan 1, 2025\n* 🔴 Observed by call ${observerCalls.length}\n</observations>`;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'mock-response',
            modelId: 'mock-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          });
          controller.close();
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    model: mockModel as any,
    observation: { messageTokens: 10000, bufferTokens: 1000, bufferActivation: 0.7 },
    reflection: { observationTokens: 50000 },
  });
  return { om, observerCalls };
}

beforeEach(async () => {
  const pending = [...BufferingCoordinator.asyncBufferingOps.values()];
  if (pending.length > 0) await Promise.allSettled(pending);
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

// =============================================================================
// Tests
// =============================================================================

describe('Storage capability fallback (observation buffer claims)', () => {
  it('capability flag: base default resolves false on a legacy adapter, in-memory adapter declares true', () => {
    const legacy = new LegacyMemoryStorage({ db: new InMemoryDB() });
    const modern = new ModernMemoryStorage({ db: new InMemoryDB() });
    expect(legacy.supportsObservationBufferClaims).toBe(false);
    expect(modern.supportsObservationBufferClaims).toBe(true);
    expect(new InMemoryMemory({ db: new InMemoryDB() }).supportsObservationBufferClaims).toBe(true);
  });

  it('legacy adapter: direct buffer() completes a full cycle and persists chunks via the legacy path', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await seedThread(storage);
    const { om, observerCalls } = createOM(storage);
    const record = await om.getOrCreateRecord(threadId, resourceId);

    const result = await om.buffer({ threadId, resourceId });

    expect(result.buffered).toBe(true);
    expect(observerCalls.length).toBe(1);
    const after = await om.getOrCreateRecord(threadId, resourceId);
    expect(after.bufferedObservationChunks ?? []).not.toHaveLength(0);
    expect(after.isBufferingObservation).toBe(false);
    expect(after.observationBufferClaimToken ?? null).toBeNull();
    void record;
  });

  it('legacy adapter: step-triggered buffering path buffers successfully', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    const messages = await seedThread(storage);
    const { om, observerCalls } = createOM(storage);
    const record = await om.getOrCreateRecord(threadId, resourceId);

    const triggered = await om.triggerAsyncBuffering({
      threadId,
      resourceId,
      record,
      pendingTokens: 2214,
      unbufferedPendingTokens: 2214,
      unobservedMessages: messages,
      threshold: 10000,
    });
    expect(triggered).toBe(true);
    await om.waitForBuffering(threadId, resourceId, 5000);

    expect(observerCalls.length).toBe(1);
    const after = await om.getOrCreateRecord(threadId, resourceId);
    expect(after.bufferedObservationChunks ?? []).not.toHaveLength(0);
    expect(after.isBufferingObservation).toBe(false);
  });

  it('legacy adapter: stale isBufferingObservation flag with no local operation is cleared and a new cycle proceeds', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await seedThread(storage);
    const { om, observerCalls } = createOM(storage);
    const record = await om.getOrCreateRecord(threadId, resourceId);

    // A crashed process left the persisted flag behind; no local op exists.
    await storage.setBufferingObservationFlag(record.id, true);

    const result = await om.buffer({ threadId, resourceId });

    expect(result.buffered).toBe(true);
    expect(observerCalls.length).toBe(1);
    const after = await om.getOrCreateRecord(threadId, resourceId);
    expect(after.isBufferingObservation).toBe(false);
  });

  it('legacy adapter: reset/activation lifecycle clears the buffering flag without claim operations', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await seedThread(storage);
    const { om } = createOM(storage);
    const record = await om.getOrCreateRecord(threadId, resourceId);

    await storage.setBufferingObservationFlag(record.id, true, 500);

    await om.resetBufferingState({ threadId, resourceId, recordId: record.id });

    const after = await om.getOrCreateRecord(threadId, resourceId);
    expect(after.isBufferingObservation).toBe(false);
  });

  it('modern adapter: fenced behavior is unchanged — a foreign live claim is not cleared and no observer work runs', async () => {
    const storage = new ModernMemoryStorage({ db: new InMemoryDB() });
    await seedThread(storage);
    const { om, observerCalls } = createOM(storage);
    const record = await om.getOrCreateRecord(threadId, resourceId);

    const foreign = await storage.acquireObservationBufferClaim({
      id: record.id,
      ownerToken: 'foreign-owner',
      leaseMs: 60_000,
    });
    expect(foreign.ok).toBe(true);

    const result = await om.buffer({ threadId, resourceId });

    expect(result.buffered).toBe(false);
    expect(observerCalls.length).toBe(0);
    const after = await om.getOrCreateRecord(threadId, resourceId);
    expect(after.observationBufferClaimToken).toBe('foreign-owner');
    expect(after.isBufferingObservation).toBe(true);
  });
});
