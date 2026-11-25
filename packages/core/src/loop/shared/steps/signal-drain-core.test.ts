import { describe, expect, it, vi } from 'vitest';

import type { CreatedAgentSignal } from '../../../agent/signals';
import { drainSignalsToTranscript } from './signal-drain-core';

type DrainDeps = Parameters<typeof drainSignalsToTranscript>[0];

/**
 * Pins the per-engine signal-drain error policy: `'fatal'` (default engine)
 * rethrows drain failures — the released default loop had no catch around
 * either drain site — while `'best-effort'` (durable engine) logs and
 * reports `{ drained: false }` because redelivery re-runs the drain site.
 */
function makeDeps(overrides: Partial<DrainDeps> = {}) {
  const emitted: unknown[] = [];
  const transcript: string[] = [];
  const rotations: Array<string | undefined> = [];
  const logger = { warn: vi.fn() };
  const deps = {
    drainPendingSignals: () => [{ id: 'sig-1' } as any],
    rotateResponseMessageId: (sealMessageId?: string) => {
      rotations.push(sealMessageId);
      return 'msg-next';
    },
    addSignal: (signal: any) => {
      transcript.push(signal.id);
      return { toDataPart: () => ({ type: 'data-signal', signal }) };
    },
    emitChunk: (chunk: unknown) => {
      emitted.push(chunk);
    },
    errorPolicy: 'fatal' as const,
    logger: logger as any,
    ...overrides,
  };
  return { deps, emitted, transcript, rotations, logger };
}

describe('drainSignalsToTranscript — error policy split', () => {
  it('fatal: rethrows when drainPendingSignals throws', async () => {
    const { deps, logger } = makeDeps({
      errorPolicy: 'fatal',
      drainPendingSignals: () => {
        throw new Error('drain exploded');
      },
    });
    await expect(drainSignalsToTranscript(deps)).rejects.toThrow('drain exploded');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fatal: rethrows when emitChunk throws mid-drain', async () => {
    const { deps } = makeDeps({
      errorPolicy: 'fatal',
      emitChunk: () => {
        throw new Error('emit exploded');
      },
    });
    await expect(drainSignalsToTranscript(deps)).rejects.toThrow('emit exploded');
  });

  it('best-effort: warns and returns { drained: false } when drainPendingSignals throws', async () => {
    const { deps, logger } = makeDeps({
      errorPolicy: 'best-effort',
      drainPendingSignals: () => {
        throw new Error('drain exploded');
      },
    });
    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('best-effort: warns and returns { drained: false } when emitChunk throws mid-drain', async () => {
    const { deps, logger } = makeDeps({
      errorPolicy: 'best-effort',
      emitChunk: () => {
        throw new Error('emit exploded');
      },
    });
    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it.each(['fatal', 'best-effort'] as const)('%s: the no-signals fast path is unaffected by policy', async policy => {
    const { deps, emitted, logger } = makeDeps({
      errorPolicy: policy,
      drainPendingSignals: () => [],
    });
    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(emitted).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each(['fatal', 'best-effort'] as const)('%s: a successful drain emits every signal and rotates', async policy => {
    const { deps, emitted } = makeDeps({
      errorPolicy: policy,
      drainPendingSignals: () => [{ id: 'sig-1' } as any, { id: 'sig-2' } as any],
    });
    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: true, nextMessageId: 'msg-next' });
    expect(emitted).toHaveLength(2);
  });
});

/**
 * Storage-backed queues drain asynchronously, the in-memory queue drains
 * synchronously. Both must land signals in the transcript the same way.
 */
describe('drainSignalsToTranscript with sync and async drains', () => {
  const signal = (id: string) => ({ id }) as CreatedAgentSignal;
  const kinds: Record<'sync' | 'async', (signals: CreatedAgentSignal[]) => DrainDeps['drainPendingSignals']> = {
    sync: signals => () => signals,
    async: signals => async () => signals,
  };
  const kindNames = Object.keys(kinds) as Array<keyof typeof kinds>;

  it.each(kindNames)('%s drain: signals reach the transcript and the stream in queue order', async kind => {
    const { deps, transcript, emitted, rotations } = makeDeps({
      drainPendingSignals: kinds[kind]([signal('sig-1'), signal('sig-2'), signal('sig-3')]),
      sealMessageId: 'msg-1',
    });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: true, nextMessageId: 'msg-next' });
    expect(rotations).toEqual(['msg-1']);
    expect(transcript).toEqual(['sig-1', 'sig-2', 'sig-3']);
    expect(emitted).toEqual([
      { type: 'data-signal', signal: { id: 'sig-1' } },
      { type: 'data-signal', signal: { id: 'sig-2' } },
      { type: 'data-signal', signal: { id: 'sig-3' } },
    ]);
  });

  it.each(kindNames)('%s drain: an empty queue keeps the current response message', async kind => {
    const { deps, transcript, emitted, rotations } = makeDeps({ drainPendingSignals: kinds[kind]([]) });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(rotations).toEqual([]);
    expect(transcript).toEqual([]);
    expect(emitted).toEqual([]);
  });

  // Aborted runs pass no drain at all.
  it('no drain: keeps the current response message', async () => {
    const { deps, transcript, rotations } = makeDeps({ drainPendingSignals: undefined });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(rotations).toEqual([]);
    expect(transcript).toEqual([]);
  });

  it('async drain resolving to nothing is an empty queue', async () => {
    const { deps, transcript, rotations, logger } = makeDeps({
      drainPendingSignals: async () => undefined as unknown as CreatedAgentSignal[],
      errorPolicy: 'best-effort',
    });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(rotations).toEqual([]);
    expect(transcript).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fatal: a rejected async drain fails the drain site', async () => {
    const { deps, transcript, rotations, logger } = makeDeps({
      drainPendingSignals: async () => {
        throw new Error('store unavailable');
      },
      errorPolicy: 'fatal',
    });

    await expect(drainSignalsToTranscript(deps)).rejects.toThrow('store unavailable');
    expect(rotations).toEqual([]);
    expect(transcript).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('best-effort: a rejected async drain is logged and leaves the transcript untouched', async () => {
    const { deps, transcript, rotations, logger } = makeDeps({
      drainPendingSignals: async () => {
        throw new Error('store unavailable');
      },
      errorPolicy: 'best-effort',
    });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(rotations).toEqual([]);
    expect(transcript).toEqual([]);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]![1]).toEqual({ error: new Error('store unavailable') });
  });

  it('fatal: a rejected emit fails the drain site after appending only the signal it was emitting', async () => {
    const { deps, transcript, logger } = makeDeps({
      drainPendingSignals: () => [signal('sig-1'), signal('sig-2')],
      emitChunk: async () => {
        throw new Error('stream closed');
      },
      errorPolicy: 'fatal',
    });

    await expect(drainSignalsToTranscript(deps)).rejects.toThrow('stream closed');
    expect(transcript).toEqual(['sig-1']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('best-effort: a rejected emit is logged after appending only the signal it was emitting', async () => {
    const { deps, transcript, logger } = makeDeps({
      drainPendingSignals: () => [signal('sig-1'), signal('sig-2')],
      emitChunk: async () => {
        throw new Error('stream closed');
      },
      errorPolicy: 'best-effort',
    });

    await expect(drainSignalsToTranscript(deps)).resolves.toEqual({ drained: false });
    expect(transcript).toEqual(['sig-1']);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  // Code that reads the queue or the transcript can run in any microtask. With
  // a synchronous drain it must never observe a signal that has left the queue
  // but is not yet in the transcript.
  it('sync drain: the first signal is in the transcript before any other microtask runs', async () => {
    const queue = [signal('sig-1')];
    const { deps, transcript } = makeDeps({ drainPendingSignals: () => queue.splice(0) });
    let observed: { queued: string[]; transcript: string[] } | undefined;
    queueMicrotask(() => {
      observed = { queued: queue.map(s => s.id), transcript: [...transcript] };
    });

    await drainSignalsToTranscript(deps);

    expect(observed).toEqual({ queued: [], transcript: ['sig-1'] });
  });
});
