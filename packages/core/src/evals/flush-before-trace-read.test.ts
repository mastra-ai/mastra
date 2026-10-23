import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import { flushBeforeTraceRead } from './flush-before-trace-read';

function buildMastra({ storage = {}, flush = vi.fn().mockResolvedValue(undefined) } = {}) {
  const warn = vi.fn();
  const mastra = {
    getStorage: () => storage,
    observability: { flush },
    getLogger: () => ({ warn }),
  } as unknown as Mastra;
  return { mastra, flush, warn };
}

describe('flushBeforeTraceRead', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes when storage and a trace ID are set', async () => {
    const { mastra, flush } = buildMastra();
    await flushBeforeTraceRead(mastra, 'trace-1');
    expect(flush).toHaveBeenCalledOnce();
  });

  it('skips the flush when there is no trace to read', async () => {
    const noTraceId = buildMastra();
    await flushBeforeTraceRead(noTraceId.mastra, null);
    expect(noTraceId.flush).not.toHaveBeenCalled();

    const noStorage = buildMastra({ storage: null as any });
    await flushBeforeTraceRead(noStorage.mastra, 'trace-1');
    expect(noStorage.flush).not.toHaveBeenCalled();
  });

  it('stops waiting when the flush never finishes', async () => {
    vi.useFakeTimers();
    const { mastra, warn } = buildMastra({ flush: vi.fn(() => new Promise<void>(() => {})) });

    const done = flushBeforeTraceRead(mastra, 'trace-1');
    await vi.advanceTimersByTimeAsync(6_000);
    await done;

    expect(warn).toHaveBeenCalledWith('Observability flush did not finish in 6000 ms; reading the trace anyway.');
  });
});
