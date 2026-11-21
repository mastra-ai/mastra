import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { getUnobservedParts } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';
import { TokenCounter } from '../token-counter';

const THREAD_ID = 'cleanup-parity-thread';
const RESOURCE_ID = 'cleanup-parity-resource';

function createOm() {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    model: new MockLanguageModelV2({}) as any,
    observation: { messageTokens: 5_000 },
    reflection: { observationTokens: 200_000 },
  });
}

/** Deterministic PRNG so failures are reproducible. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeMessages(count: number, random: () => number, partialRate = 0.3): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const words = (n: number) => Array.from({ length: n }, (_, w) => `word${i}x${w}`).join(' ');
    const partial = random() < partialRate;
    const parts: any[] = partial
      ? [
          { type: 'text', text: words(5 + Math.floor(random() * 200)) },
          { type: 'data-om-observation-end', data: { cycleId: `cycle-${i}` } },
          { type: 'text', text: words(5 + Math.floor(random() * 200)) },
        ]
      : [{ type: 'text', text: words(5 + Math.floor(random() * 400)) }];
    return {
      id: `msg-${i}`,
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: { format: 2, parts },
      createdAt: new Date(Date.UTC(2025, 0, 1, 10, 0, 0, i)),
    } as MastraDBMessage;
  });
}

/**
 * The cleanup algorithm as it stood before the running-total change: every
 * candidate removal re-counts the whole remaining transcript. It is the oracle
 * the optimized implementation must match exactly.
 */
function referenceRemovedIds(
  messages: MastraDBMessage[],
  observedIds: string[],
  retentionFloor: number,
  preserve: string[] = [],
): string[] {
  const observedSet = new Set(observedIds);
  const preserveSet = new Set(preserve);
  const idsToRemove = new Set<string>();
  const removalOrder: string[] = [];
  const counter = new TokenCounter();

  for (const msg of messages) {
    if (!msg?.id || msg.id === 'om-continuation' || !observedSet.has(msg.id)) continue;
    if (preserveSet.has(msg.id)) continue;

    const unobservedParts = getUnobservedParts(msg);
    const totalParts = msg.content?.parts?.length ?? 0;
    if (unobservedParts.length > 0 && unobservedParts.length < totalParts) {
      msg.content.parts = unobservedParts;
      continue;
    }

    const nextRemaining = messages.filter(
      m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id) && m.id !== msg.id,
    );
    if (counter.countMessages(nextRemaining) < retentionFloor) break;

    idsToRemove.add(msg.id);
    removalOrder.push(msg.id);
  }

  if (idsToRemove.size > 0) {
    const remaining = () => messages.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
    let tokens = counter.countMessages(remaining());
    while (tokens < retentionFloor && removalOrder.length > 0) {
      idsToRemove.delete(removalOrder.pop()!);
      tokens = counter.countMessages(remaining());
    }
  }

  return [...idsToRemove];
}

describe('getObservedMessageIdsForCleanup retention floor', () => {
  it('removes exactly the same message ids and trims the same parts as the full re-count', async () => {
    const om = createOm();
    const counter = new TokenCounter();
    let compared = 0;
    let withBackoff = 0;

    for (let seed = 1; seed <= 60; seed++) {
      const random = seededRandom(seed);
      const count = 3 + Math.floor(random() * 60);
      const base = makeMessages(count, random);
      const observedIds = base.filter(() => random() < 0.85).map(m => m.id);
      const total = counter.countMessages(base);
      const retentionFloor = Math.floor(total * random() * 0.9);
      const preserve = base.filter(() => random() < 0.05).map(m => m.id);

      const expectedMessages = structuredClone(base);
      const actualMessages = structuredClone(base);

      const expected = referenceRemovedIds(expectedMessages, observedIds, retentionFloor, preserve);
      const actual = await om.getObservedMessageIdsForCleanup({
        threadId: THREAD_ID,
        resourceId: RESOURCE_ID,
        messages: actualMessages,
        observedMessageIds: observedIds,
        retentionFloor,
        preserveMessageIds: preserve,
      });

      expect(actual, `seed ${seed}`).toEqual(expected);
      expect(
        actualMessages.map(m => m.content.parts),
        `seed ${seed} trimmed parts`,
      ).toEqual(expectedMessages.map(m => m.content.parts));
      compared++;
      if (expected.length < observedIds.length) withBackoff++;
    }

    expect(compared).toBe(60);
    // Guard against a vacuous test: the floor must actually limit removal in many cases.
    expect(withBackoff).toBeGreaterThan(20);
  });

  it('matches when every message is removable and the floor backs off in the restore pass', async () => {
    const om = createOm();
    const random = seededRandom(99);
    const base = makeMessages(40, random, 0);
    const observedIds = base.map(m => m.id);
    const total = new TokenCounter().countMessages(base);

    for (const fraction of [0, 0.25, 0.5, 0.9, 1, 2]) {
      const retentionFloor = Math.floor(total * fraction);
      const expected = referenceRemovedIds(structuredClone(base), observedIds, retentionFloor);
      const actual = await om.getObservedMessageIdsForCleanup({
        threadId: THREAD_ID,
        resourceId: RESOURCE_ID,
        messages: structuredClone(base),
        observedMessageIds: observedIds,
        retentionFloor,
      });
      expect(actual, `fraction ${fraction}`).toEqual(expected);
    }
  });

  it('counts each message a bounded number of times instead of re-counting the transcript per removal', async () => {
    const om = createOm();
    const random = seededRandom(7);
    const messages = makeMessages(400, random, 0);
    const observedIds = messages.map(m => m.id);
    const countMessage = vi.spyOn(TokenCounter.prototype, 'countMessage');

    try {
      await om.getObservedMessageIdsForCleanup({
        threadId: THREAD_ID,
        resourceId: RESOURCE_ID,
        messages,
        observedMessageIds: observedIds,
        retentionFloor: 1,
      });
      // Linear: one count per message for the initial total and one for its per-message tokens.
      // The re-counting implementation made ~n^2 / 2 (80,000) calls here.
      expect(countMessage.mock.calls.length).toBeLessThanOrEqual(messages.length * 4);
    } finally {
      countMessage.mockRestore();
    }
  });
});
