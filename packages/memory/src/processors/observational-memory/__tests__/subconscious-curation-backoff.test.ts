import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import {
  CURATION_BACKOFF_BASE_MS,
  CURATION_BACKOFF_CAP_MS,
  clearedBackoff,
  isBackingOff,
  nextBackoff,
  readAttemptState,
} from '../subconscious/curation-backoff';

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

function createMockModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createBulkMessages(count: number, threadId: string): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${threadId}-${i}`,
    threadId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(Date.now() + i),
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i} with enough text to move the token counter along.` }],
    } as MastraMessageContentV2,
  })) as MastraDBMessage[];
}

type CurationOutcome = 'ran' | 'no-op' | 'skipped' | 'no-model';

function stubMemory(initialOutcome: CurationOutcome, uncurated = 5, advanceCursor = true) {
  let outcome = initialOutcome;
  let cursor: { lastKnowledgeId: string } | null = null;
  const runCuration = vi.fn(async () => {
    if (outcome === 'ran' && advanceCursor) cursor = { lastKnowledgeId: `k-${uncurated - 1}` };
    return { outcome };
  });
  return {
    runCuration,
    setOutcome(next: CurationOutcome) {
      outcome = next;
    },
    storage: {
      getStore: async (domain: string) =>
        domain === 'knowledge'
          ? {
              getCurationCursor: async () => cursor,
              knowledgeBySource: async ({ limit }: { limit?: number }) => ({
                records: Array.from({ length: Math.min(uncurated, limit ?? uncurated) }, (_, i) => ({ id: `k-${i}` })),
                nextCursor: undefined,
              }),
            }
          : undefined,
    },
  };
}

/** Shared storage lets a second engine stand in for the same deployment after a restart. */
function createEngine(memory: unknown, now: () => number, storage = new InMemoryMemory({ db: new InMemoryDB() })) {
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    memory: memory as any,
    curationThreshold: 3,
    now,
    observation: {
      model: createMockModel('<observations>\n* Something happened\n</observations>'),
      messageTokens: 100,
      bufferTokens: false,
    },
    reflection: {
      model: createMockModel('<observations>\n* Condensed\n</observations>'),
      observationTokens: 50_000,
    },
  } as any);
  return { om, storage };
}

describe('curation backoff state', () => {
  it('grows exponentially from one minute and caps at one hour', () => {
    let state = nextBackoff(undefined, 0);
    expect(state).toEqual({ failures: 1, nextAttemptAt: CURATION_BACKOFF_BASE_MS });

    state = nextBackoff(state, 0);
    expect(state.nextAttemptAt).toBe(CURATION_BACKOFF_BASE_MS * 2);

    for (let i = 0; i < 20; i++) state = nextBackoff(state, 0);
    expect(state.nextAttemptAt).toBe(CURATION_BACKOFF_CAP_MS);
  });

  it('reports backing off only inside the window', () => {
    const state = { failures: 1, nextAttemptAt: 1_000 };
    expect(isBackingOff(state, 999)).toBe(true);
    expect(isBackingOff(state, 1_000)).toBe(false);
    expect(isBackingOff(clearedBackoff(), 0)).toBe(false);
    expect(isBackingOff(undefined, 0)).toBe(false);
  });

  it('tolerates absent or malformed persisted state', () => {
    expect(readAttemptState(undefined)).toBeUndefined();
    expect(readAttemptState({})).toBeUndefined();
    expect(readAttemptState({ subconscious: { curationAttempt: { failures: 'lots' } } })).toBeUndefined();
    expect(readAttemptState({ subconscious: { curationAttempt: { failures: 2, nextAttemptAt: 5 } } })).toEqual({
      failures: 2,
      nextAttemptAt: 5,
    });
  });
});

describe('curation backoff in the lifecycle', () => {
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));

  it('does not retry a failed curation on the very next turn', async () => {
    const memory = stubMemory('no-model');
    let now = 1_000_000;
    const { om } = createEngine(memory, () => now);
    const threadId = 'failing-thread';

    await om.observe({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });
    await settle();
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // Same minute: still inside the backoff window.
    now += 30_000;
    const record = (await om.getRecord(threadId))!;
    await om.maybeCurate(threadId, undefined, record, requestContext());
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // Past the window: allowed to try again.
    now += CURATION_BACKOFF_BASE_MS;
    await om.maybeCurate(threadId, undefined, record, requestContext());
    expect(memory.runCuration).toHaveBeenCalledTimes(2);
  });

  it('survives a restart — a fresh instance still honours the persisted backoff', async () => {
    const memory = stubMemory('no-model');
    let now = 2_000_000;
    const { om, storage } = createEngine(memory, () => now);
    const threadId = 'restart-thread';

    await om.observe({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });
    await settle();
    expect(memory.runCuration).toHaveBeenCalledTimes(1);

    // A new engine over the same storage is what a redeploy looks like.
    const restarted = createEngine(memory, () => now + 30_000, storage).om;
    const record = (await restarted.getRecord(threadId))!;
    await restarted.maybeCurate(threadId, undefined, record, requestContext());

    expect(memory.runCuration).toHaveBeenCalledTimes(1);
  });

  it('clears the backoff after a successful curation', async () => {
    const memory = stubMemory('no-model');
    let now = 3_000_000;
    const { om } = createEngine(memory, () => now);
    const threadId = 'recovering-thread';

    await om.observe({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });
    await settle();

    memory.setOutcome('ran');
    now += CURATION_BACKOFF_BASE_MS;
    const record = (await om.getRecord(threadId))!;
    await om.maybeCurate(threadId, undefined, record, requestContext());

    const after = await om.getRecord(threadId);
    expect(readAttemptState(after?.config)).toEqual({ failures: 0, nextAttemptAt: 0 });
  });

  it('leaves backoff state untouched when the curator skips', async () => {
    const memory = stubMemory('skipped');
    const now = 4_000_000;
    const { om } = createEngine(memory, () => now);
    const threadId = 'skipping-thread';

    await om.observe({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });
    await settle();

    const record = await om.getRecord(threadId);
    expect(readAttemptState(record?.config)).toBeUndefined();
  });

  it('backs off when the curator reports ran without advancing the cursor', async () => {
    const memory = stubMemory('ran', 5, false);
    const now = 4_500_000;
    const { om } = createEngine(memory, () => now);
    const threadId = 'no-progress-thread';
    const record = await (om as any).getOrCreateRecord(threadId, undefined);

    await om.maybeCurate(threadId, undefined, record, requestContext());

    const after = await om.getRecord(threadId);
    expect(readAttemptState(after?.config)).toEqual({
      failures: 1,
      nextAttemptAt: now + CURATION_BACKOFF_BASE_MS,
    });
  });

  it('backs off when the curator throws, and rethrows to the caller', async () => {
    const memory = stubMemory('ran');
    memory.runCuration.mockRejectedValue(new Error('curator exploded'));
    const now = 5_000_000;
    const { om } = createEngine(memory, () => now);
    const threadId = 'throwing-thread';
    const record = await (om as any).getOrCreateRecord(threadId, undefined);

    await expect(om.maybeCurate(threadId, undefined, record, requestContext())).rejects.toThrow('curator exploded');

    const after = await om.getRecord(threadId);
    expect(readAttemptState(after?.config)).toEqual({
      failures: 1,
      nextAttemptAt: now + CURATION_BACKOFF_BASE_MS,
    });
  });
});
