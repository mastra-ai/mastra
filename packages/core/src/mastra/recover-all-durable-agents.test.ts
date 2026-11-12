/**
 * Tests for `Mastra.recoverAllDurableAgents()` — the boot-time hook that
 * walks every registered `DurableAgent` and re-drives its orphaned RUNNING
 * runs after a process restart (issue #19056).
 *
 * Most are focused unit tests: we stub `DurableAgent.recoverActiveRuns()`
 * on each agent so we can pin down the fan-out contract of the
 * Mastra-level API without spinning up real durable workflows. The
 * per-agent recovery behavior itself is covered by
 * `recover-active-runs.test.ts` and `recover-run.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { DurableStepIds } from '../agent/durable/constants';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { createEventedAgent } from '../agent/durable/create-evented-agent';
import type { DurableAgent } from '../agent/durable/durable-agent';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { InMemoryStore } from '../storage';
import type { WorkflowRunState } from '../workflows/types';
import { Mastra } from './index';

function makeBaseAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'x',
    model: 'openai/gpt-4o',
  });
}

function makeDurable(id: string): DurableAgent {
  return createDurableAgent({ agent: makeBaseAgent(id) });
}

/**
 * Stub `recoverActiveRuns` on a durable agent so the Mastra-level fan-out
 * is observable without exercising storage or the real workflow.
 */
function stubRecover(
  agent: DurableAgent,
  result:
    | {
        recovered: Array<{ runId: string; status: 'success' | 'failed' | 'skipped'; retryAt?: number }>;
        succeeded: number;
        failed: number;
      }
    | { throw: Error },
) {
  if ('throw' in result) {
    return vi.spyOn(agent, 'recoverActiveRuns').mockRejectedValue(result.throw);
  }
  return vi.spyOn(agent, 'recoverActiveRuns').mockResolvedValue(result);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const emptyRecovery = { recovered: [], succeeded: 0, failed: 0 };

async function seedRunning(store: InMemoryStore, agentId: string, runId: string) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    snapshot: {
      runId,
      status: 'running',
      value: {},
      context: { input: { __workflowKind: 'durable-agent', runId, agentId, messageListState: { memoryInfo: null } } },
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    } as WorkflowRunState,
  });
}

describe('Mastra.recoverAllDurableAgents', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not dispatch after shutdown before entry, but still counts registered agents', async () => {
    const a = makeDurable('shutdown-a');
    const b = makeDurable('shutdown-b');
    const mastra = new Mastra({ agents: { a: a as any, b: b as any }, storage: store });
    const aSpy = stubRecover(a, emptyRecovery);
    const bSpy = stubRecover(b, emptyRecovery);
    await mastra.shutdown();

    expect(await mastra.recoverAllDurableAgents()).toEqual({
      agents: 2,
      recovered: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    });
    expect(aSpy).not.toHaveBeenCalled();
    expect(bSpy).not.toHaveBeenCalled();
  });

  it('does not dispatch queued agents when shutdown begins during five gated batches', async () => {
    vi.useFakeTimers();
    const active = Array.from({ length: 5 }, (_, index) => makeDurable(`gated-${index}`));
    const b = makeDurable('queued-agent');
    const agents = Object.fromEntries([...active, b].map(agent => [agent.id, agent]));
    const mastra = new Mastra({ agents: agents as any, storage: store });
    const gate = deferred<typeof emptyRecovery>();
    const running = active.map(agent => vi.spyOn(agent, 'recoverActiveRuns').mockReturnValue(gate.promise));
    const bSpy = stubRecover(b, emptyRecovery);
    const traversal = mastra.recoverAllDurableAgents();
    await vi.advanceTimersByTimeAsync(0);
    expect(running.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(bSpy).not.toHaveBeenCalled();
    const shutdown = mastra.shutdown({ drainTimeout: 500 });
    try {
      gate.resolve(emptyRecovery);
      await traversal;
      await vi.advanceTimersByTimeAsync(500);
      await shutdown;
      expect(bSpy).not.toHaveBeenCalled();
    } finally {
      gate.resolve(emptyRecovery);
      await traversal;
      await vi.advanceTimersByTimeAsync(500);
      await shutdown;
    }
  });

  it('reaches a queued sixth agent after bounded waits expire without settling the first five setups', async () => {
    vi.useFakeTimers();
    const agents = Array.from({ length: 6 }, (_, index) => makeDurable(`wave-${index}`));
    const mastra = new Mastra({
      agents: Object.fromEntries(agents.map(agent => [agent.id, agent])) as any,
      storage: store,
    });
    const gate = deferred<void>();
    const recoveries = agents.map((agent, index) =>
      vi.spyOn(agent, 'recover').mockImplementation(async () => {
        if (index < 5) await gate.promise;
        return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
      }),
    );
    for (const agent of agents) await seedRunning(store, agent.id, `${agent.id}-run`);
    const traversal = mastra.recoverAllDurableAgents();
    try {
      await vi.advanceTimersByTimeAsync(29_999);
      expect(recoveries.slice(0, 5).every(spy => spy.mock.calls.length === 1)).toBe(true);
      expect(recoveries[5]).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(recoveries[5]).toHaveBeenCalledTimes(1);
      expect(await traversal).toEqual({ agents: 6, recovered: 1, succeeded: 1, failed: 0, skipped: 5 });
    } finally {
      gate.resolve();
      await traversal;
      await mastra.shutdown({ drainTimeout: 0 });
    }
  });

  it('drains a boot traversal that settles within the shutdown budget', async () => {
    vi.useFakeTimers();
    const agent = makeDurable('drained-boot');
    const mastra = new Mastra({ agents: { agent: agent as any }, storage: store });
    const gate = deferred<typeof emptyRecovery>();
    vi.spyOn(agent, 'recoverActiveRuns').mockReturnValue(gate.promise);
    const traversal = mastra.recoverAllDurableAgents();
    await vi.advanceTimersByTimeAsync(0);
    let settled = false;
    const shutdown = mastra.shutdown({ drainTimeout: 500 }).then(() => {
      settled = true;
    });
    try {
      await vi.advanceTimersByTimeAsync(100);
      expect(settled).toBe(false);
      gate.resolve(emptyRecovery);
      await traversal;
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(true);
      await shutdown;
    } finally {
      gate.resolve(emptyRecovery);
      await traversal;
      await vi.advanceTimersByTimeAsync(500);
      await shutdown;
    }
  });

  it('bounds an unsettled boot traversal by one shared shutdown deadline', async () => {
    vi.useFakeTimers();
    const agent = makeDurable('bounded-boot');
    const mastra = new Mastra({ agents: { agent: agent as any }, storage: store });
    const gate = deferred<typeof emptyRecovery>();
    vi.spyOn(agent, 'recoverActiveRuns').mockReturnValue(gate.promise);
    const traversal = mastra.recoverAllDurableAgents();
    await vi.advanceTimersByTimeAsync(0);
    let settled = false;
    const shutdown = mastra.shutdown({ drainTimeout: 500 }).then(() => {
      settled = true;
    });
    try {
      await vi.advanceTimersByTimeAsync(499);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      await shutdown;
    } finally {
      gate.resolve(emptyRecovery);
      await traversal;
      await vi.advanceTimersByTimeAsync(500);
      await shutdown;
    }
  });

  it('removes a settled boot traversal so shutdown does not consume its drain budget', async () => {
    vi.useFakeTimers();
    const agent = makeDurable('settled-boot');
    const mastra = new Mastra({ agents: { agent: agent as any }, storage: store });
    stubRecover(agent, emptyRecovery);
    await mastra.recoverAllDurableAgents();
    let settled = false;
    const shutdown = mastra.shutdown({ drainTimeout: 500 }).then(() => {
      settled = true;
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(true);
      await shutdown;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await vi.advanceTimersByTimeAsync(500);
      await shutdown;
    }
  });

  // Keep discovery and recoverActiveRuns real. Only the setup boundary in
  // recover() is gated; the foreign-owner path still exercises real fencing.
  async function startStalledBoot(withForeignOwner = false) {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const a = makeDurable('real-recovery-a');
    const b = makeDurable('real-recovery-b');
    const mastra = new Mastra({ agents: { a: a as any, b: b as any }, storage: store });
    if (withForeignOwner) {
      await seedRunning(store, a.id, 'foreign');
      const workflows = (await store.getStore('workflows'))!;
      await workflows.claimRunOwnership({ runId: 'foreign', ownerId: 'other-instance', leaseMs: 30_000 });
    }
    await seedRunning(store, a.id, 'stalled');
    await seedRunning(store, b.id, 'later-agent');
    // If the foreign lease expires during its recheck, restart only the
    // workflow boundary: no provider or background model execution is needed.
    vi.spyOn(a, 'getWorkflow').mockReturnValue({
      createRun: vi.fn(async () => ({ restart: vi.fn(async () => ({ status: 'success' })) })),
    } as any);
    const gate = deferred<void>();
    const originalRecover = a.recover.bind(a);
    const aRecover = vi.spyOn(a, 'recover').mockImplementation(async (runId, options) => {
      if (runId === 'foreign') return originalRecover(runId, options);
      await gate.promise;
      return { cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>;
    });
    vi.spyOn(b, 'recover').mockResolvedValue({ cleanup: vi.fn() } as Awaited<ReturnType<DurableAgent['recover']>>);
    const aBatch = vi.spyOn(a, 'recoverActiveRuns');
    const bBatch = vi.spyOn(b, 'recoverActiveRuns');
    let settled = false;
    const traversal = mastra.recoverAllDurableAgents().then(result => {
      settled = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(0);
    return {
      mastra,
      aRecover,
      aBatch,
      bBatch,
      traversal,
      isSettled: () => settled,
      async cleanup() {
        gate.resolve();
        await traversal;
        const shutdown = mastra.shutdown({ drainTimeout: 500 });
        await vi.advanceTimersByTimeAsync(500);
        await shutdown;
      },
    };
  }

  it('reaches another agent before the real first batch exhausts its 30-second setup wait', async () => {
    const boot = await startStalledBoot();
    try {
      expect(boot.aRecover).toHaveBeenCalledWith('stalled', expect.anything());
      await vi.advanceTimersByTimeAsync(29_999);
      expect(boot.bBatch).toHaveBeenCalledTimes(1);
      expect(boot.isSettled()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(boot.bBatch).toHaveBeenCalledTimes(1);
      // Check settlement before awaiting: on the regression the original
      // promise is still gated and must not hang the test runner.
      expect(boot.isSettled()).toBe(true);
      expect(await boot.traversal).toEqual({ agents: 2, recovered: 1, succeeded: 1, failed: 0, skipped: 1 });
      expect(boot.aBatch.mock.results[0]?.type).toBe('return');
      const firstBatch = await boot.aBatch.mock.results[0]!.value;
      expect(firstBatch).toMatchObject({
        succeeded: 0,
        failed: 0,
        recovered: [{ runId: 'stalled', status: 'skipped', reason: 'recovery-timeout' }],
      });
      expect(firstBatch.recovered[0].retryAt).toBe(Date.now() + 30_000);
    } finally {
      await boot.cleanup();
    }
  });

  it('keeps timed-out setup in the drain after the real boot traversal settles', async () => {
    const boot = await startStalledBoot();
    let shutdown: Promise<void> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(boot.isSettled()).toBe(true);
      await boot.traversal;
      let shutdownSettled = false;
      shutdown = boot.mastra.shutdown({ drainTimeout: 500 }).then(() => {
        shutdownSettled = true;
      });
      await vi.advanceTimersByTimeAsync(499);
      expect(shutdownSettled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(shutdownSettled).toBe(true);
      await shutdown;
    } finally {
      await boot.cleanup();
      await shutdown;
    }
  });

  it('schedules a foreign-owner recheck without duplicating the pending timed-out setup', async () => {
    const boot = await startStalledBoot(true);
    try {
      expect(boot.aRecover.mock.calls.map(([runId]) => runId)).toEqual(['foreign', 'stalled']);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(boot.isSettled()).toBe(true);
      expect(await boot.traversal).toEqual({ agents: 2, recovered: 1, succeeded: 1, failed: 0, skipped: 2 });
      // The skipped foreign run is allowed to wait for the bounded batch.
      // Its recheck must still be scheduled once that batch returns.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(boot.aBatch).toHaveBeenCalledTimes(2);
      expect(boot.aBatch).toHaveBeenLastCalledWith({ runId: 'foreign' });
      expect(boot.aRecover.mock.calls.filter(([runId]) => runId === 'stalled')).toHaveLength(1);
    } finally {
      await boot.cleanup();
    }
  });

  it('returns zeroed counts when no durable agents are registered', async () => {
    const plainAgent = makeBaseAgent('plain');
    const mastra = new Mastra({
      agents: { plain: plainAgent },
      storage: store,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(result).toEqual({ agents: 0, recovered: 0, succeeded: 0, failed: 0, skipped: 0 });
  });

  it('only calls recoverActiveRuns on DurableAgent instances', async () => {
    const durable = makeDurable('durable-a');
    const plainAgent = makeBaseAgent('plain');
    const mastra = new Mastra({
      agents: {
        durableA: durable as any,
        plain: plainAgent,
      },
      storage: store,
    });
    const spy = stubRecover(durable, {
      recovered: [{ runId: 'r-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ agents: 1, recovered: 1, succeeded: 1, failed: 0, skipped: 0 });
  });

  it('aggregates counts across every durable agent', async () => {
    const a = makeDurable('durable-a');
    const b = makeDurable('durable-b');
    const mastra = new Mastra({
      agents: { a: a as any, b: b as any },
      storage: store,
    });
    stubRecover(a, {
      recovered: [
        { runId: 'a-1', status: 'success' },
        { runId: 'a-2', status: 'failed' },
      ],
      succeeded: 1,
      failed: 1,
    });
    stubRecover(b, {
      recovered: [{ runId: 'b-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(result).toEqual({ agents: 2, recovered: 3, succeeded: 2, failed: 1, skipped: 0 });
  });

  it('does not let a single agent failure abort recovery for the rest', async () => {
    const a = makeDurable('durable-a');
    const b = makeDurable('durable-b');
    const mastra = new Mastra({
      agents: { a: a as any, b: b as any },
      storage: store,
    });
    stubRecover(a, { throw: new Error('boom-a') });
    const bSpy = stubRecover(b, {
      recovered: [{ runId: 'b-1', status: 'success' }],
      succeeded: 1,
      failed: 0,
    });

    const result = await mastra.recoverAllDurableAgents();

    expect(bSpy).toHaveBeenCalledTimes(1);
    // Both agents count as registered — the throwing one just contributes 0.
    expect(result).toEqual({ agents: 2, recovered: 1, succeeded: 1, failed: 0, skipped: 0 });
  });

  it('re-checks a run another instance drives once its claim may have lapsed, until it is no longer skipped', async () => {
    vi.useFakeTimers();
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const spy = vi
      .spyOn(durable, 'recoverActiveRuns')
      .mockResolvedValueOnce({
        recovered: [
          { runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 30_000 },
          { runId: 'live-here', status: 'skipped', reason: 'run-active-locally' },
          { runId: 'orphan', status: 'success' },
        ],
        succeeded: 1,
        failed: 0,
      })
      .mockResolvedValueOnce({
        recovered: [{ runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 60_000 }],
        succeeded: 0,
        failed: 0,
      })
      .mockResolvedValueOnce({ recovered: [{ runId: 'live-elsewhere', status: 'success' }], succeeded: 1, failed: 0 });

    const result = await mastra.recoverAllDurableAgents();
    expect(result).toEqual({ agents: 1, recovered: 1, succeeded: 1, failed: 0, skipped: 2 });

    // Not before the holder's claim may have lapsed.
    await vi.advanceTimersByTimeAsync(29_999);
    expect(spy).toHaveBeenCalledTimes(1);
    // Within the jitter after it: only the run another instance drove is re-checked.
    await vi.advanceTimersByTimeAsync(5_001);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    // Still skipped: re-checked again at the new retryAt, then never again.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  describe.each(['default', 'evented'] as const)('%s timed-out recovery rechecks', engine => {
    const runId = `timeout-recheck-${engine}`;
    let durable: DurableAgent;
    let mastra: Mastra;
    let gate: ReturnType<typeof Promise.withResolvers<void>>;
    let recover: ReturnType<typeof vi.spyOn<DurableAgent, 'recover'>>;
    let bulkRecover: ReturnType<typeof vi.spyOn<DurableAgent, 'recoverActiveRuns'>>;
    let restart: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const agent = makeBaseAgent(`timeout-agent-${engine}`);
      durable = engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent });
      mastra = new Mastra({ agents: { durable: durable as any }, storage: store });
      await seedRunning(store, durable.id, runId);
      gate = Promise.withResolvers<void>();
      // Gate only the first setup boundary; discovery, retries, storage and
      // the second recover() claim/fence lifecycle remain real.
      recover = vi.spyOn(durable, 'recover').mockImplementationOnce(async () => {
        await gate.promise;
        throw new Error('setup failed after timeout');
      });
      bulkRecover = vi.spyOn(durable, 'recoverActiveRuns');
      restart = vi.fn(async () => ({ status: 'success' }));
      vi.spyOn(durable, 'getWorkflow').mockReturnValue({
        createRun: vi.fn(async () => ({ restart })),
      } as any);
    });

    afterEach(async () => {
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      const shutdown = mastra.shutdown({ drainTimeout: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await shutdown;
      globalRunRegistry.delete(runId);
    });

    it('rechecks a pending timeout repeatedly without duplicate recovery, then retries its late failure', async () => {
      const traversal = mastra.recoverAllDurableAgents();
      await vi.advanceTimersByTimeAsync(30_000);
      const aggregate = await traversal;
      const batch = await bulkRecover.mock.results[0]!.value;
      const original = structuredClone(batch);
      expect(aggregate).toEqual({ agents: 1, recovered: 0, succeeded: 0, failed: 0, skipped: 1 });
      expect(batch.recovered).toEqual([
        { runId, status: 'skipped', reason: 'recovery-timeout', retryAt: Date.now() + 30_000 },
      ]);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(bulkRecover).toHaveBeenCalledTimes(3);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(recover).toHaveBeenCalledTimes(2);
      expect(restart).toHaveBeenCalledTimes(1);
      expect(await bulkRecover.mock.results[3]!.value).toEqual({
        recovered: [{ runId, status: 'success' }],
        succeeded: 1,
        failed: 0,
      });
      expect(batch).toEqual(original);
      expect(aggregate).toEqual({ agents: 1, recovered: 0, succeeded: 0, failed: 0, skipped: 1 });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(recover).toHaveBeenCalledTimes(2);
    });

    it.each(['success', 'failed', 'suspended'] as const)(
      'does not retry a timeout whose persisted snapshot became %s',
      async status => {
        const traversal = mastra.recoverAllDurableAgents();
        await vi.advanceTimersByTimeAsync(30_000);
        await traversal;
        const workflows = (await store.getStore('workflows'))!;
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
        await workflows.persistWorkflowSnapshot({
          workflowName: DurableStepIds.AGENTIC_LOOP,
          runId,
          snapshot: { ...snapshot!, status },
        });
        gate.resolve();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(bulkRecover).toHaveBeenCalledTimes(2);
        expect(recover).toHaveBeenCalledTimes(1);
        expect(restart).not.toHaveBeenCalled();
      },
    );

    it('cancels timeout rechecks on shutdown even when the original fails later', async () => {
      const traversal = mastra.recoverAllDurableAgents();
      await vi.advanceTimersByTimeAsync(30_000);
      await traversal;
      const shutdown = mastra.shutdown({ drainTimeout: 100 });
      await vi.advanceTimersByTimeAsync(100);
      await shutdown;
      gate.resolve();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(bulkRecover).toHaveBeenCalledTimes(1);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
    });
  });

  describe('transient per-run recovery failures', () => {
    const runId = 'transient-boot-recovery';
    let durable: DurableAgent;
    let mastra: Mastra;
    let restart: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
      durable = makeDurable('transient-agent');
      mastra = new Mastra({ agents: { durable: durable as any }, storage: store });
      const workflows = (await store.getStore('workflows'))!;
      await workflows.persistWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
        snapshot: {
          runId,
          status: 'running',
          value: {},
          context: {
            input: {
              __workflowKind: 'durable-agent',
              runId,
              agentId: durable.id,
              messageListState: { memoryInfo: null },
            },
          },
          activePaths: [],
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          serializedStepGraph: [],
          waitingPaths: {},
          timestamp: Date.now(),
        } as WorkflowRunState,
      });
      restart = vi.fn(async () => ({ status: 'success' }));
      vi.spyOn(durable, 'getWorkflow').mockReturnValue({
        createRun: vi.fn(async () => ({ restart })),
      } as any);
    });

    afterEach(async () => {
      await mastra.shutdown();
      globalRunRegistry.delete(runId);
    });

    it('automatically recovers a transiently skipped run at retryAt without another boot or manual recovery', async () => {
      const recover = vi
        .spyOn(durable, 'recover')
        .mockRejectedValueOnce(new Error('LOADING Redis is loading the dataset'));
      const bulkRecover = vi.spyOn(durable, 'recoverActiveRuns');
      const before = Date.now();

      await expect(mastra.recoverAllDurableAgents()).resolves.toEqual({
        agents: 1,
        recovered: 0,
        succeeded: 0,
        failed: 0,
        skipped: 1,
      });
      await expect(bulkRecover.mock.results[0]!.value).resolves.toEqual({
        recovered: [{ runId, status: 'skipped', reason: 'transient-error', retryAt: before + 30_000 }],
        succeeded: 0,
        failed: 0,
      });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(recover).toHaveBeenCalledTimes(2);
      expect(bulkRecover).toHaveBeenLastCalledWith({ runId });
      expect(restart).toHaveBeenCalledTimes(1);
      await expect(bulkRecover.mock.results[1]!.value).resolves.toEqual({
        recovered: [{ runId, status: 'success' }],
        succeeded: 1,
        failed: 0,
      });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(recover).toHaveBeenCalledTimes(2);
    });

    it('keeps scheduling resolved transient skips until recovery succeeds', async () => {
      const recover = vi
        .spyOn(durable, 'recover')
        .mockRejectedValueOnce(new Error('LOADING Redis is loading the dataset'))
        .mockRejectedValueOnce(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }));
      const bulkRecover = vi.spyOn(durable, 'recoverActiveRuns');

      await mastra.recoverAllDurableAgents();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(recover).toHaveBeenCalledTimes(2);
      await expect(bulkRecover.mock.results[1]!.value).resolves.toMatchObject({
        recovered: [{ runId, status: 'skipped', reason: 'transient-error', retryAt: Date.now() + 30_000 }],
        failed: 0,
      });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(recover).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(recover).toHaveBeenCalledTimes(3);
      expect(restart).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(recover).toHaveBeenCalledTimes(3);
    });

    it('stops scheduling when the next per-run recovery fails permanently', async () => {
      const permanentError = new Error('invalid agent configuration');
      const recover = vi
        .spyOn(durable, 'recover')
        .mockRejectedValueOnce(new Error('LOADING Redis is loading the dataset'))
        .mockRejectedValueOnce(permanentError);
      const bulkRecover = vi.spyOn(durable, 'recoverActiveRuns');

      await mastra.recoverAllDurableAgents();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(recover).toHaveBeenCalledTimes(2);
      await expect(bulkRecover.mock.results[1]!.value).resolves.toEqual({
        recovered: [{ runId, status: 'failed', error: permanentError }],
        succeeded: 0,
        failed: 1,
      });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(recover).toHaveBeenCalledTimes(2);
      expect(restart).not.toHaveBeenCalled();
    });

    it('cancels a pending transient retry on shutdown', async () => {
      const recover = vi
        .spyOn(durable, 'recover')
        .mockRejectedValueOnce(new Error('LOADING Redis is loading the dataset'));

      await expect(mastra.recoverAllDurableAgents()).resolves.toMatchObject({ skipped: 1, failed: 0 });
      await mastra.shutdown();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
    });
  });

  it('shutdown() cancels pending re-checks', async () => {
    vi.useFakeTimers();
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const spy = stubRecover(durable, {
      recovered: [{ runId: 'live-elsewhere', status: 'skipped', retryAt: Date.now() + 30_000 }],
      succeeded: 0,
      failed: 0,
    });

    await mastra.recoverAllDurableAgents();
    await mastra.shutdown();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries a re-check that throws with doubling delays, starting over once a re-check succeeds', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const skippedUntil = (ms: number) => async () => ({
      recovered: [
        {
          runId: 'live-elsewhere',
          status: 'skipped' as const,
          reason: 'run-active' as const,
          retryAt: Date.now() + ms,
        },
      ],
      succeeded: 0,
      failed: 0,
    });
    const spy = vi
      .spyOn(durable, 'recoverActiveRuns')
      .mockImplementationOnce(skippedUntil(30_000))
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockImplementationOnce(skippedUntil(30_000))
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce({ recovered: [{ runId: 'live-elsewhere', status: 'success' }], succeeded: 1, failed: 0 });

    await mastra.recoverAllDurableAgents();

    // First re-check at retryAt throws: retried 30s later.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(spy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    // Throws again: the next delay doubles to 60s.
    await vi.advanceTimersByTimeAsync(59_999);
    expect(spy).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(4);
    // That re-check succeeds (still skipped), so the next failure starts back at 30s.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(6);
    expect(spy).toHaveBeenLastCalledWith({ runId: 'live-elsewhere' });
    // Recovered: never re-checked again.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('stops retrying a re-check that keeps throwing after five retries', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const logError = vi.spyOn(mastra.getLogger(), 'error');
    const spy = vi
      .spyOn(durable, 'recoverActiveRuns')
      .mockResolvedValueOnce({
        recovered: [{ runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 30_000 }],
        succeeded: 0,
        failed: 0,
      })
      .mockRejectedValue(new Error('storage unavailable'));

    await mastra.recoverAllDurableAgents();

    // The re-check at 30s, then retries 30s, 60s, 120s, 240s and 480s after each failure.
    await vi.advanceTimersByTimeAsync(30_000 + 30_000 + 60_000 + 120_000 + 240_000 + 479_999);
    expect(spy).toHaveBeenCalledTimes(6);
    expect(logError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(7);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]![0]).toMatch(/next boot or a manual recover\(\)/);

    await vi.advanceTimersByTimeAsync(10_000_000);
    expect(spy).toHaveBeenCalledTimes(7);
  });

  it('shutdown() cancels a pending retry of a re-check that threw', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const durable = makeDurable('durable-a');
    const mastra = new Mastra({ agents: { durableA: durable as any }, storage: store });
    const spy = vi
      .spyOn(durable, 'recoverActiveRuns')
      .mockResolvedValueOnce({
        recovered: [{ runId: 'live-elsewhere', status: 'skipped', reason: 'run-active', retryAt: Date.now() + 30_000 }],
        succeeded: 0,
        failed: 0,
      })
      .mockRejectedValue(new Error('storage unavailable'));

    await mastra.recoverAllDurableAgents();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(2);

    await mastra.shutdown();
    await vi.advanceTimersByTimeAsync(10_000_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('exposes the recovery config via recoveryConfig (default off)', () => {
    const mastra = new Mastra({ storage: store });
    expect(mastra.recoveryConfig).toEqual({ workflows: 'auto', workflowConcurrency: 5, durableAgents: 'off' });
  });

  it('reflects an explicit recovery.durableAgents = "auto" config', () => {
    const mastra = new Mastra({
      storage: store,
      recovery: { durableAgents: 'auto' },
    });
    expect(mastra.recoveryConfig).toEqual({ workflows: 'auto', workflowConcurrency: 5, durableAgents: 'auto' });
  });

  it('does not auto-invoke recoverAllDurableAgents on construction', async () => {
    const durable = makeDurable('durable-a');
    const spy = vi.spyOn(durable, 'recoverActiveRuns');

    // Even in 'auto' mode, the boot hook is the deployer's job — construction
    // itself must remain side-effect-free so operators can wire recovery
    // wherever they want (cron, leader election, etc.).
    new Mastra({
      agents: { durableA: durable as any },
      storage: store,
      recovery: { durableAgents: 'auto' },
    });

    // Give any microtasks a chance to flush.
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });
});
