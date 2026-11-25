import { describe, expect, it } from 'vitest';

import { createActiveRunSignalQueues } from './active-run-signal-queues';
import { createSignal } from './signals';
import type { CreatedAgentSignal } from './signals';

const key = 'resource\u0000thread';
const message = (id: string) => createSignal({ id, type: 'user', contents: id });
const ids = (signals: Iterable<CreatedAgentSignal>) => [...signals].map(signal => signal.id);

function queuesWith({ preRun = [], pending = [] }: { preRun?: string[]; pending?: string[] }) {
  const queues = createActiveRunSignalQueues();
  for (const id of preRun) queues.enqueue('pre-run', key, message(id));
  for (const id of pending) queues.enqueue('pending', key, message(id));
  return queues;
}

/**
 * Ordering and duplicate rules of the queues that the thread runtime's
 * end-to-end signal tests do not reach. Each queue is read back with `take`,
 * which is what the run loop sees.
 */
describe('active-run signal queues', () => {
  it('a forwarded duplicate is recognised whichever queue holds the original', () => {
    const queues = queuesWith({ preRun: ['early'], pending: ['late'] });

    expect(queues.includes(key, 'early')).toBe(true);
    expect(queues.includes(key, 'late')).toBe(true);
    expect(queues.includes(key, 'other')).toBe(false);
  });

  it('pre-run signals a finished run never took are delivered before its follow-ups', () => {
    const queues = queuesWith({ preRun: ['early-1', 'early-2'], pending: ['follow-up'] });

    queues.foldPreRunIntoPending(key);

    expect(ids(queues.take('pending', key))).toEqual(['early-1', 'early-2', 'follow-up']);
    expect(queues.take('pre-run', key)).toEqual([]);
  });

  it("a follow-up run's first request gets the remaining follow-ups ahead of its own pre-run input", () => {
    const queues = queuesWith({ preRun: ['joined'], pending: ['follow-up-2', 'follow-up-3'] });

    const batched = queues.batchPendingIntoPreRun(key);

    expect(ids(batched)).toEqual(['follow-up-2', 'follow-up-3']);
    expect(ids(queues.take('pre-run', key))).toEqual(['follow-up-2', 'follow-up-3', 'joined']);
    expect(queues.hasSignals(key)).toBe(false);
  });

  it('a follow-up returned after a lost lease is delivered before later follow-ups', () => {
    const queues = queuesWith({ pending: ['later'] });

    queues.returnToFront(key, message('returned'));

    expect(ids(queues.take('pending', key))).toEqual(['returned', 'later']);
  });

  it('a failed follow-up start requeues its signal, then its batched input, then newer follow-ups', () => {
    const queues = queuesWith({ preRun: ['batched'], pending: ['newer'] });

    queues.restoreAfterFailedStart(key, message('drained'));

    expect(ids(queues.take('pending', key))).toEqual(['drained', 'batched', 'newer']);
    expect(queues.take('pre-run', key)).toEqual([]);
  });

  it("a reservation rollback drops only the thread's pre-run input", () => {
    const queues = queuesWith({ preRun: ['provisional'], pending: ['follow-up'] });

    queues.discardPreRunQueue(key);

    expect(queues.take('pre-run', key)).toEqual([]);
    expect(ids(queues.take('pending', key))).toEqual(['follow-up']);
  });

  it('a hand-off forwards pre-run input first, marked as pre-run, and leaves nothing queued', () => {
    const queues = queuesWith({ preRun: ['early'], pending: ['follow-up'] });
    const forwarded: Array<[string, boolean]> = [];

    queues.handOff(key, (signal, preRun) => forwarded.push([signal.id, preRun]));

    expect(forwarded).toEqual([
      ['early', true],
      ['follow-up', false],
    ]);
    expect(queues.hasSignals(key)).toBe(false);
  });

  it('thread history lists pre-run input before follow-ups', () => {
    const queues = queuesWith({ preRun: ['early'], pending: ['follow-up'] });

    expect(ids(queues.queued(key))).toEqual(['early', 'follow-up']);
  });
});
