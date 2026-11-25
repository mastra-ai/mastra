import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { noopLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import type { RunOwnershipRecord } from '../storage/run-fencing';
import {
  WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
  leaseAfterTakeover,
  renewWorkflowLease,
} from './run-ownership';
import { createStep, createWorkflow } from '.';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('renewWorkflowLease', () => {
  it('waits for a slow renewal to settle before starting the next one', async () => {
    vi.useFakeTimers();
    const store = (await new InMemoryStore().getStore('workflows'))!;
    const { record } = await store.claimRunOwnership({
      runId: 'run',
      ownerId: 'owner',
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: false,
    });
    const renew = store.renewRunOwnership.bind(store);
    const slow = Promise.withResolvers<void>();
    // The store stalls on the first renewal for several intervals.
    const renewals = vi.spyOn(store, 'renewRunOwnership').mockImplementation(async args => {
      if (renewals.mock.calls.length === 1) {
        await slow.promise;
      }

      return renew(args);
    });
    const onError = vi.fn();
    const stop = renewWorkflowLease({
      store,
      fence: { runId: 'run', generation: record!.generation, ownerId: 'owner' },
      onLost: () => {},
      onError,
    });

    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 4);
    expect(renewals).toHaveBeenCalledTimes(1);

    slow.resolve();
    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);
    expect(renewals).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();

    stop();
    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 2);
    expect(renewals).toHaveBeenCalledTimes(2);
  });

  it('warns once per event loop stall that may have cost leases, however many runs it delayed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const warnings: { message: string; context: unknown }[] = [];
    const logger = {
      ...noopLogger,
      warn: (message: string, context: unknown) => warnings.push({ message, context }),
    } as IMastraLogger;
    const gate = Promise.withResolvers<void>();
    let started = 0;
    const step = createStep({
      id: 'wait',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        started++;
        await gate.promise;
        return {};
      },
    });
    const workflow = createWorkflow({
      id: 'wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { leaseTtlMs: 3_000 },
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      logger,
      storage: new InMemoryStore(),
      workflows: { workflow },
      recovery: { workflows: 'off' },
    });
    const runs = await Promise.all([1, 2, 3].map(() => mastra.getWorkflow('workflow').createRun()));
    const results = runs.map(run => run.start({ inputData: {} }));
    while (started < runs.length) await new Promise(resolve => setImmediate(resolve));
    const stalls = () => warnings.filter(({ message }) => message.startsWith('The event loop was blocked'));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(stalls()).toEqual([]);

    // The event loop blocks for 5 s, past the 3 s leases: the clock moves and no timer runs.
    for (const stall of [1, 2]) {
      vi.setSystemTime(Date.now() + 5_000);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(stalls()).toHaveLength(stall);
    }
    expect(stalls()[0]!.context).toMatchObject({ leaseMs: 3_000 });
    expect((stalls()[0]!.context as { blockedMs: number }).blockedMs).toBeGreaterThanOrEqual(4_000);

    // Nobody took the runs over, so they finish.
    gate.resolve();
    expect((await Promise.all(results)).map(result => result.status)).toEqual(['success', 'success', 'success']);
    await mastra.shutdown();
  });
});

describe('leaseAfterTakeover', () => {
  const at = (ms: number) => new Date(1_000_000 + ms);
  const lapsed = (leaseMs: number, extra: Partial<RunOwnershipRecord> = {}): RunOwnershipRecord => ({
    runId: 'run',
    generation: 1,
    ownerId: 'owner',
    leaseExpiresAt: at(leaseMs),
    updatedAt: at(0),
    live: false,
    ...extra,
  });

  it.each([
    ['no record', 1_000, null],
    ['a released lease', 1_000, lapsed(1_000, { leaseExpiresAt: null })],
    ['a record without updatedAt', 1_000, lapsed(1_000, { updatedAt: undefined })],
    ['a lapsed base lease', 2_000, lapsed(1_000)],
    ['a lapsed doubled lease', 8_000, lapsed(4_000)],
    ['a lapsed lease at the cap', 8_000, lapsed(8_000)],
    ['a lapsed lease past the cap', 20_000, lapsed(20_000)],
    ['a lapsed lease shorter than the base', 1_000, lapsed(300)],
  ])('after %s, a 1000 ms base lease becomes %i ms', (_case, expected, previous) => {
    expect(leaseAfterTakeover(1_000, previous).leaseMs).toBe(expected);
  });
});
