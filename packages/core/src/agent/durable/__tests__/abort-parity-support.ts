/**
 * Fixtures shared by the two ported cases that drive an abort: T14
 * (durable-agent-abort-parity.test.ts) and T36 (durable-agent-callback-order.test.ts).
 *
 * Both park a step on the same deferred pair, wait on the run's abort signal, and declare the same
 * COR-1415 difference. Keeping one copy means the two cases cannot drift apart — and when plain
 * stops finalising the aborted step, one deletion here retires the difference for both.
 *
 * `parity-harness.ts` stays frozen; this module only holds fixtures the ports own.
 */

import type { CapturedRequest, EngineDifference } from './parity-harness';

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

export function aborted(signal?: AbortSignal): Promise<void> {
  return new Promise<void>(resolve => {
    if (!signal) return;
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

/** Number of tool results the model has already been handed. */
export function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool') continue;
    for (const part of message.content) {
      if (part.type === 'tool-result') count += 1;
    }
  }
  return count;
}

/**
 * COR-1415 — plain's abort surface. Plain delivers the aborted step's `tool-result` a second time,
 * immediately before the `abort` chunk, and reports `reason: 'tripwire'` on the finish chunk while
 * durable and evented abort directly. The `expect` maps plain's observation onto the wrapped
 * engines' shape, so the comparison outside these fields stays exact. When plain stops finalising
 * the aborted step the difference no longer reproduces and the helper fails the test, which is the
 * signal to delete this declaration.
 */
export const ABORT_ARTIFACT: EngineDifference = {
  reason:
    "COR-1415: plain emits the aborted step's tool-result a second time and finishes the abort as 'tripwire'; durable and evented abort without it.",
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      // Plain's spurious chunk sits directly before the abort chunk it also emits; both wrapped
      // engines go straight from the parked step to `abort`.
      const spurious = turn.chunkTypes.indexOf('abort') - 1;
      const withoutSpurious = <T>(list: T[]): T[] => list.filter((_, index) => index !== spurious);
      return {
        ...turn,
        chunks: withoutSpurious(turn.chunks),
        chunkTypes: withoutSpurious(turn.chunkTypes),
        chunkPayloads: withoutSpurious(turn.chunkPayloads),
        finishChunk: { ...turn.finishChunk, reason: 'abort' },
        // The duplicate result sorts next to the result it duplicates.
        toolResults: turn.toolResults.slice(0, -1),
      };
    }),
  }),
};
