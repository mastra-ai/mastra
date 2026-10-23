import { describe, expect, it, vi } from 'vitest';

import { drainSignalsToTranscript } from './signal-drain-core';

/**
 * Pins the per-engine signal-drain error policy: `'fatal'` (default engine)
 * rethrows drain failures — the released default loop had no catch around
 * either drain site — while `'best-effort'` (durable engine) logs and
 * reports `{ drained: false }` because redelivery re-runs the drain site.
 */
function makeDeps(overrides: Partial<Parameters<typeof drainSignalsToTranscript>[0]> = {}) {
  const emitted: unknown[] = [];
  const logger = { warn: vi.fn() };
  const deps = {
    drainPendingSignals: () => [{ id: 'sig-1' } as any],
    rotateResponseMessageId: () => 'msg-next',
    addSignal: (signal: any) => ({ toDataPart: () => ({ type: 'data-signal', signal }) }),
    emitChunk: (chunk: unknown) => {
      emitted.push(chunk);
    },
    errorPolicy: 'fatal' as const,
    logger: logger as any,
    ...overrides,
  };
  return { deps, emitted, logger };
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
