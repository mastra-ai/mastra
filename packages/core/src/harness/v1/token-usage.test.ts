/**
 * Tests for `Session.getTokenUsage()` durability.
 *
 * Three regressions guarded here:
 *   1. Rehydration: a fresh `Session` instance built from a persisted record
 *      seeds `_tokenUsage` from `SessionRecord.tokenUsage`, so a process
 *      restart / eviction does not reset the cumulative counter to zero.
 *   2. Persistence: increments accumulated during a turn flow into the next
 *      `saveSession` write via the `_flushUpdate` overlay, with no setter
 *      having to thread `tokenUsage` through its closure.
 *   3. `totalTokens` derivation: providers that only emit
 *      `inputTokens`/`outputTokens` still produce a consistent
 *      `totalTokens` aggregate.
 */

import { describe, expect, it } from 'vitest';

import type { FullOutput } from '../../stream/base/output';
import { setupHarness } from './__test-utils__/setup';
import type { Session } from './session';

interface TokenUsageInternals {
  _tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  _recordTurnCompletion(full: FullOutput<unknown>): void;
}

function asInternals(session: Session): TokenUsageInternals {
  return session as unknown as TokenUsageInternals;
}

describe('Session token usage — durability', () => {
  it('seeds the live counter from the persisted record on construction', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'one' });

    // MockAgent emits `{ inputTokens: 1, outputTokens: 1, totalTokens: 2 }` per
    // run, so after one turn the live counter and the persisted record agree.
    const before = session.getTokenUsage();
    expect(before.promptTokens).toBeGreaterThan(0);
    expect(before.completionTokens).toBeGreaterThan(0);
    expect(before.totalTokens).toBeGreaterThanOrEqual(before.promptTokens + before.completionTokens);

    const persisted = session.getRecord().tokenUsage;
    expect(persisted).toEqual(before);
  });

  it('persists counters across rehydration via a new Harness instance', async () => {
    const { harness, agent, storage } = setupHarness();
    agent.enqueueRuns([
      { runId: 'r1', finishReason: 'stop' },
      { runId: 'r2', finishReason: 'stop' },
    ]);

    const original = await harness.session({ threadId: 't-token', resourceId: 'u' });
    const originalId = original.id;
    await original.message({ content: 'one' });
    await original.message({ content: 'two' });
    const before = original.getTokenUsage();
    expect(before.totalTokens).toBeGreaterThan(0);

    // Simulate a process restart: shut down the live harness (releases the
    // session lease) and resolve the same `(threadId, resourceId)` against a
    // fresh harness pointed at the same storage.
    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ threadId: 't-token', resourceId: 'u' });
    expect(rehydrated.id).toBe(originalId);
    expect(rehydrated).not.toBe(original);
    expect(rehydrated.getTokenUsage()).toEqual(before);
  });

  it('persists queued-turn token usage in the same write as the no-replay marker', async () => {
    // Regression guard for the ordering bug surfaced during review:
    // `_finalizeCompletedQueuedTurn` previously wrote `postRunFinalizedAt`
    // before accounting tokens, so a crash between marker and accumulator
    // would resume with the marker set and never re-record the turn's usage.
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ runId: 'q1', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.queue({ content: 'queued' });
    const persisted = session.getRecord().tokenUsage;
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt?.postRunFinalizedAt).toBeDefined();
    expect(persisted.totalTokens).toBeGreaterThan(0);
    expect(session.getTokenUsage()).toEqual(persisted);
  });

  it('continues accumulating after rehydration instead of restarting at zero', async () => {
    const { harness, agent, storage } = setupHarness();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });
    const first = await harness.session({ threadId: 't-cont', resourceId: 'u' });
    await first.message({ content: 'one' });
    const afterFirst = first.getTokenUsage();
    await harness.shutdown();

    const { harness: harness2, agent: agent2 } = setupHarness({ sessions: { storage } });
    agent2.enqueueRun({ runId: 'r2', finishReason: 'stop' });
    const second = await harness2.session({ threadId: 't-cont', resourceId: 'u' });
    expect(second.getTokenUsage()).toEqual(afterFirst);
    await second.message({ content: 'two' });
    const afterSecond = second.getTokenUsage();
    expect(afterSecond.promptTokens).toBeGreaterThan(afterFirst.promptTokens);
    expect(afterSecond.completionTokens).toBeGreaterThan(afterFirst.completionTokens);
    expect(afterSecond.totalTokens).toBeGreaterThan(afterFirst.totalTokens);
  });
});

describe('Session token usage — totalTokens derivation', () => {
  it('derives totalTokens from input + output when the provider omits totalTokens', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 3, outputTokens: 4 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it('respects an explicit totalTokens when the provider supplies one', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 2, outputTokens: 5, totalTokens: 9 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 2, completionTokens: 5, totalTokens: 9 });
  });

  it('does not double-count when both totalTokens and input/output are present across turns', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as unknown as FullOutput<unknown>);
    internals._recordTurnCompletion({
      usage: { inputTokens: 4, outputTokens: 6 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 5, completionTokens: 7, totalTokens: 12 });
  });

  it('leaves promptTokens and completionTokens at zero when only totalTokens is provided', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { totalTokens: 5 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 5 });
  });
});
