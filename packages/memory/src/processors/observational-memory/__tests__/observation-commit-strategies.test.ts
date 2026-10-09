/**
 * Commit settlement through the real observation strategies.
 *
 * Observation-time curation dispatches only when a hook extractor's `observationCommitted`
 * settles `true`, so each strategy's `persist()` must report a real commit as committed and a
 * skipped commit as not committed. The buffered strategy is the easy one to get wrong: its
 * successful append and its empty or cleared-record skip both end the cycle without
 * activating anything, so this suite runs every strategy end to end against storage instead
 * of a stub.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { Extractor } from '../extractor';
import type { ExtractorOnExtractedContext } from '../extractor';
import { ObservationalMemory } from '../observational-memory';

const threadId = 'commit-thread';
const resourceId = 'commit-resource';

function observationText(scope: 'thread' | 'resource') {
  const body = `* User confirmed the launch date is January 15.`;
  return scope === 'resource'
    ? `<observations>\n<thread id="${threadId}">\n${body}\n</thread>\n</observations>`
    : `<observations>\n${body}\n</observations>`;
}

function createObserverModel(text: string, onCall?: () => Promise<void>) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      await onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        warnings: [],
        content: [{ type: 'text', text }],
      };
    },
    doStream: async () => {
      await onCall?.();
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  } as never);
}

function createMessages(count: number): MastraDBMessage[] {
  const base = Date.now() - count * 1000;
  return Array.from({ length: count }, (_, i) => ({
    id: `${threadId}-msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(base + i * 1000),
    threadId,
    resourceId,
  }));
}

/** Hook extractor that records every commit settlement without blocking the cycle. */
function createCommitProbe() {
  const outcomes: boolean[] = [];
  const settled: Promise<void>[] = [];
  const extractor = new Extractor({
    name: 'Commit probe',
    mode: 'hook',
    onExtracted: ({ observationCommitted }: ExtractorOnExtractedContext<unknown>) => {
      if (!observationCommitted) throw new Error('observation strategy did not pass observationCommitted');
      settled.push(observationCommitted.then(committed => void outcomes.push(committed)));
    },
  });
  return {
    extractor,
    async outcomes() {
      await Promise.all(settled);
      return outcomes;
    },
  };
}

function createOM(
  storage: InMemoryMemory,
  opts: {
    scope: 'thread' | 'resource';
    buffered: boolean;
    extractor: Extractor;
    onObserverCall?: () => Promise<void>;
    observerText?: string;
  },
) {
  const text = opts.observerText ?? observationText(opts.scope);
  return new ObservationalMemory({
    storage,
    scope: opts.scope,
    observation: {
      model: createObserverModel(text, opts.onObserverCall),
      messageTokens: opts.buffered ? 500 : 50,
      bufferTokens: opts.buffered ? 0.2 : false,
      extract: [opts.extractor],
    },
    reflection: { model: createObserverModel(text), observationTokens: 10_000_000 },
  });
}

/** Mirrors the destructive half of `Memory.deleteStoredThread`, which clears the OM record mid-cycle. */
async function clearRecord(storage: InMemoryMemory) {
  await storage.deleteThread({ threadId });
  await storage.clearObservationalMemory(threadId, resourceId);
}

async function seedThread(storage: InMemoryMemory) {
  await storage.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'Commit probe',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await storage.saveMessages({ messages: createMessages(5) });
}

// Static maps leak across tests in this package (`isolate: false` in vitest.config.ts).
beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

describe('observation commit settlement through the real strategies', () => {
  let storage: InMemoryMemory;

  beforeEach(async () => {
    storage = new InMemoryMemory({ db: new InMemoryDB() });
    await seedThread(storage);
  });

  describe('sync thread-scope cycle', () => {
    it('settles true after the observations are written to the record', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, { scope: 'thread', buffered: false, extractor: probe.extractor });

      await expect(om.observe({ threadId, resourceId, messages: createMessages(5) })).resolves.toMatchObject({
        observed: true,
      });

      expect(await probe.outcomes()).toEqual([true]);
      expect((await storage.getObservationalMemory(threadId, resourceId))?.activeObservations).toContain('January 15');
    });

    it('settles false when the record is cleared before the commit', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, {
        scope: 'thread',
        buffered: false,
        extractor: probe.extractor,
        onObserverCall: () => clearRecord(storage),
      });

      await om.observe({ threadId, resourceId, messages: createMessages(5) });

      expect(await probe.outcomes()).toEqual([false]);
      expect(await storage.getObservationalMemory(threadId, resourceId)).toBeNull();
    });
  });

  describe('buffered cycle', () => {
    it('settles true after the buffered chunk is appended', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, { scope: 'thread', buffered: true, extractor: probe.extractor });

      await om.buffer({ threadId, resourceId });
      await om.waitForBuffering(threadId, resourceId, 5000);

      expect(await probe.outcomes()).toEqual([true]);
      expect((await om.getStatus({ threadId, resourceId })).bufferedChunkCount).toBe(1);
    });

    it('settles false when the record is cleared before the append', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, {
        scope: 'thread',
        buffered: true,
        extractor: probe.extractor,
        onObserverCall: () => clearRecord(storage),
      });

      await om.buffer({ threadId, resourceId });
      await om.waitForBuffering(threadId, resourceId, 5000);

      expect(await probe.outcomes()).toEqual([false]);
    });

    // The empty-observations skip is the buffered path that reports no explicit outcome once
    // persist() returns a status object, so it must still settle false rather than start curation.
    it('settles false when the observer returns no observations', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, {
        scope: 'thread',
        buffered: true,
        extractor: probe.extractor,
        observerText: '<observations>\n</observations>',
      });

      await om.buffer({ threadId, resourceId });
      await om.waitForBuffering(threadId, resourceId, 5000);

      expect(await probe.outcomes()).toEqual([false]);
      expect((await om.getStatus({ threadId, resourceId })).bufferedChunkCount).toBe(0);
    });
  });

  describe('resource-scope cycle', () => {
    it('settles true after the observations are written to the resource record', async () => {
      const probe = createCommitProbe();
      const om = createOM(storage, { scope: 'resource', buffered: false, extractor: probe.extractor });

      await expect(om.observe({ threadId, resourceId, messages: createMessages(5) })).resolves.toMatchObject({
        observed: true,
      });

      expect(await probe.outcomes()).toEqual([true]);
      expect((await storage.getObservationalMemory(null, resourceId))?.activeObservations).toContain('January 15');
    });
  });
});
