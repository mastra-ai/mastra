/**
 * Adversarial ordering + mixed-version coverage for the deferred replay
 * system (issue #21223 fix).
 *
 * - Mixed-version: an origin running an older @mastra/core publishes
 *   `run-registered` without `sourceId` and `run-completed` without
 *   `persisted`. The subscriber must fall back to the clean-finish heuristic
 *   without dropping clean runs or replaying phantoms.
 * - Ordering permutations: the origin gates terminal publishes on
 *   `broadcastFinished`, but a subscriber must stay correct (no phantom, no
 *   hang, in-order delivery) for every interleaving of registration and
 *   terminal events among the stream parts, since older origins do not gate.
 */
import { describe, expect, it } from 'vitest';

import type { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import type { LeasePubSub } from './thread-stream-test-utils';
import { collectThread, createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

const harness = createHarness('ordering');
const { runId, streamId } = harness;

const setup = () => setupRuntime(harness);
const collect = (runtime: AgentThreadStreamRuntime, pubsub: LeasePubSub) => collectThread(harness, runtime, pubsub);

const finishPart = {
  type: 'finish',
  payload: { stepResult: { reason: 'stop' }, output: { usage: {} }, metadata: {} },
};

describe('mixed-version compat: events from an older origin', () => {
  // Older origins publish run-registered without sourceId and run-completed
  // without persisted. Subscriber must use the clean-finish heuristic.
  it('replays a clean legacy run (no sourceId, no persisted flag)', async () => {
    const { runtime, pubsub, emit } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await emit({
      type: 'stream-part',
      runId,
      streamId,
      sourceId: 'legacy-origin',
      part: { type: 'start', payload: {} },
    });
    await emit({
      type: 'stream-part',
      runId,
      streamId,
      sourceId: 'legacy-origin',
      part: { type: 'text-delta', payload: { text: 'hello' } },
    });
    await emit({ type: 'stream-part', runId, streamId, sourceId: 'legacy-origin', part: finishPart });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected.map(part => part.type)).toEqual(['start', 'text-delta', 'finish']);

    subscription.unsubscribe();
    await consumed;
  });

  it('drops a legacy phantom (error backlog, terminal without persisted flag)', async () => {
    const { runtime, pubsub, emit } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await emit({
      type: 'stream-part',
      runId,
      streamId,
      sourceId: 'legacy-origin',
      part: { type: 'start', payload: {} },
    });
    await emit({
      type: 'stream-part',
      runId,
      streamId,
      sourceId: 'legacy-origin',
      part: { type: 'error', payload: { error: 'boom' } },
    });
    await emit({ type: 'run-completed', runId, streamId });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });

  it('defers a foreign run even when its registration carries a sourceId', async () => {
    // New-origin event observed by a different (new) process: sourceId is
    // present but does not match the subscriber, so it must still defer.
    const { runtime, pubsub, emit } = setup();
    const { subscription, collected, consumed } = await collect(runtime, pubsub);

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1, sourceId: 'some-other-process' });
    await emit({
      type: 'stream-part',
      runId,
      streamId,
      sourceId: 'some-other-process',
      part: { type: 'start', payload: {} },
    });
    await nextTicks();

    expect(collected).toEqual([]);

    subscription.unsubscribe();
    await consumed;
  });
});

describe('adversarial orderings of registration/terminal among stream parts', () => {
  const parts = [{ type: 'start', payload: {} }, { type: 'text-delta', payload: { text: 'hello' } }, finishPart];

  /** All interleavings of markers R (register) and C (complete) among the
   *  ordered parts P0..P2. R always precedes C (origin invariant even on old
   *  versions), but either may land anywhere relative to the parts. */
  function orderings(): string[][] {
    const results: string[][] = [];
    const base = ['P0', 'P1', 'P2'];
    for (let r = 0; r <= base.length; r++) {
      for (let c = r; c <= base.length; c++) {
        const seq = [...base];
        seq.splice(c, 0, 'C');
        seq.splice(r, 0, 'R');
        results.push(seq);
      }
    }
    return results;
  }

  for (const seq of orderings()) {
    it(`dead-run replay stays phantom-free and hang-free for order ${seq.join(' ')}`, async () => {
      const { runtime, pubsub, emit } = setup();
      const { subscription, collected, consumed } = await collect(runtime, pubsub);

      const partsBeforeTerminal = seq.slice(0, seq.indexOf('C')).filter(tok => tok.startsWith('P')).length;

      for (const token of seq) {
        if (token === 'R') {
          await emit({ type: 'run-registered', runId, streamId, streamSeq: 1, sourceId: 'origin' });
        } else if (token === 'C') {
          await emit({ type: 'run-completed', runId, streamId, persisted: true });
        } else {
          const part = parts[Number(token.slice(1))];
          await emit({ type: 'stream-part', runId, streamId, sourceId: 'origin', part });
        }
      }
      await nextTicks();

      // Invariants:
      // 1. In-order subsequence of the published parts (no reordering, no
      //    duplication, no fabricated parts).
      const publishedOrder = parts.map(part => part.type);
      let cursor = 0;
      for (const part of collected) {
        const idx = publishedOrder.indexOf(part.type, cursor);
        expect(idx, `part ${part.type} out of order in ${collected.map(p => p.type).join(',')}`).toBeGreaterThanOrEqual(
          0,
        );
        cursor = idx + 1;
      }
      // 2. persisted: true terminal means everything buffered before the
      //    terminal must be delivered — a clean run is never silently dropped.
      expect(collected.length).toBeGreaterThanOrEqual(partsBeforeTerminal);

      // 3. No hang: unsubscribe ends the consumer loop promptly.
      subscription.unsubscribe();
      await consumed;
    });

    it(`unpersisted-run replay yields nothing for order ${seq.join(' ')}`, async () => {
      const { runtime, pubsub, emit } = setup();
      const { subscription, collected, consumed } = await collect(runtime, pubsub);

      for (const token of seq) {
        if (token === 'R') {
          await emit({ type: 'run-registered', runId, streamId, streamSeq: 1, sourceId: 'origin' });
        } else if (token === 'C') {
          await emit({ type: 'run-completed', runId, streamId, persisted: false });
        } else {
          const part = parts[Number(token.slice(1))];
          await emit({ type: 'stream-part', runId, streamId, sourceId: 'origin', part });
        }
      }
      await nextTicks();

      // Parts published before the terminal must never surface. Parts that
      // arrive after the run was discarded are tolerated only if the run is
      // re-buffered and never released (still nothing delivered).
      expect(collected).toEqual([]);

      subscription.unsubscribe();
      await consumed;
    });
  }
});
