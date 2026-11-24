import { describe, expect, it, vi } from 'vitest';

import { startRetentionScheduler } from '../../src/workers/retention-scheduler.js';
import { retentionIntervalMs } from '../../src/config/retention.js';
import type { OperationalStore } from '../../src/db/operational-store.js';

const config = {
  enabled: true,
  tenantId: 'tenant-a',
  limit: 8,
  maxBatchesPerRun: 2,
  intervalMs: retentionIntervalMs,
} as const;
const result = {
  sweepId: 'retention-test',
  dryRun: false,
  scanned: 0,
  deleted: 0,
  minimized: 0,
  retainedAuthority: 0,
} as const;

describe('retention scheduler', () => {
  it('runs at startup, serializes the 24h callback, and waits during shutdown', async () => {
    let scheduled: (() => void) | undefined;
    let resolveSecond: (() => void) | undefined;
    const runSweep = vi
      .fn()
      .mockResolvedValueOnce(result)
      .mockImplementationOnce(
        () =>
          new Promise<typeof result>(resolve => {
            resolveSecond = () => resolve(result);
          }),
      );
    const logger = { write: vi.fn() };
    const scheduler = await startRetentionScheduler({} as OperationalStore, config, logger, {
      now: () => new Date('2026-08-31T00:00:00.000Z'),
      runSweep,
      setInterval: (callback, intervalMs) => {
        expect(intervalMs).toBe(retentionIntervalMs);
        scheduled = callback;
        return { unref: () => {} } as NodeJS.Timeout;
      },
      clearInterval: vi.fn(),
    });
    expect(runSweep).toHaveBeenCalledTimes(1);
    scheduled?.();
    await Promise.resolve();
    scheduled?.();
    expect(runSweep).toHaveBeenCalledTimes(2);

    let stopped = false;
    const stopping = scheduler!.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    resolveSecond?.();
    await stopping;
    expect(stopped).toBe(true);
    expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.sweep.completed' }));
  });

  it('fails startup explicitly and logs later scheduled failures', async () => {
    const logger = { write: vi.fn() };
    await expect(
      startRetentionScheduler({} as OperationalStore, config, logger, {
        runSweep: async () => {
          throw new Error('storage unavailable');
        },
      }),
    ).rejects.toThrow('storage unavailable');
    expect(logger.write).toHaveBeenCalledWith({
      event: 'retention.sweep.failed',
      errorCode: 'RETENTION_SWEEP_FAILED',
    });
  });

  it('drains bounded batches, records exhausted budget, and rapidly reschedules without overlap', async () => {
    let rapid: (() => void) | undefined;
    const logger = { write: vi.fn() };
    const runSweep = vi
      .fn()
      .mockResolvedValueOnce({ ...result, scanned: 8 })
      .mockResolvedValueOnce({ ...result, scanned: 8 })
      .mockResolvedValueOnce({ ...result, scanned: 3 });
    const scheduler = await startRetentionScheduler({} as OperationalStore, config, logger, {
      runSweep,
      setInterval: () => {
        return { unref: () => {} } as NodeJS.Timeout;
      },
      clearInterval: vi.fn(),
      setTimeout: (callback, delayMs) => {
        expect(delayMs).toBe(0);
        rapid = callback;
        return { unref: () => {} } as NodeJS.Timeout;
      },
      clearTimeout: vi.fn(),
    });
    expect(runSweep).toHaveBeenCalledTimes(2);
    expect(logger.write).toHaveBeenCalledWith({
      event: 'retention.sweep.budget.exhausted',
      errorCode: 'RETENTION_SWEEP_BUDGET_EXHAUSTED',
    });
    rapid?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runSweep).toHaveBeenCalledTimes(3);
    await scheduler!.stop();
  });
});
