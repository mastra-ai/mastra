/**
 * Tests for `Mastra.restartAllActiveWorkflowRuns()` — the boot-time generic
 * recovery hook the deployer calls on server startup.
 *
 * Pins two behaviors:
 * 1. Durable-agent backing workflows are NOT restarted through the generic
 *    path (issue #22598). Their recovery is owned by the dedicated opt-in
 *    path (`recovery.durableAgents: 'auto'`) which holds a recovery lease
 *    and registers thread runtimes — the generic path bypasses all of that.
 * 2. Any workflow can opt out of generic auto-restart via
 *    `options.autoRestartActiveRuns: false`.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MockStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { createWorkflow } from '../workflows';
import type { Workflow } from '../workflows';
import { sharedBroker } from './test-utils/shared-broker';
import { Mastra } from './index';

// The runs these tests store were just written, so without a zero grace the rule would leave them for later.
const stopped = { workflowGraceMs: 0 };

/** Stores a `running` run of `workflowName`, as a process that crashed mid-run leaves it. */
async function persistActiveRun(storage: MockStore, workflowName: string, runId: string) {
  const workflows = await storage.getStore('workflows');
  await workflows!.persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot: { ...createEmptyWorkflowSnapshot(runId), status: 'running' },
  });
}

/** Stores one active run of `workflow` and observes restart attempts. */
async function stubActiveRun(storage: MockStore, workflow: Workflow<any, any, any, any, any, any>, runId: string) {
  await persistActiveRun(storage, workflow.id, runId);
  const restart = vi.fn().mockResolvedValue(undefined);
  const createRun = vi.spyOn(workflow, 'createRun').mockResolvedValue({ restart } as any);
  return { createRun, restart };
}

describe('Mastra.restartAllActiveWorkflowRuns', () => {
  it('restarts user workflow runs but never durable-agent workflow runs (issue #22598)', async () => {
    const userWorkflow = createWorkflow({
      id: 'user-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();

    const durable = createDurableAgent({
      agent: new Agent({
        id: 'durable-a',
        name: 'durable-a',
        instructions: 'x',
        model: 'openai/gpt-4o',
      }),
    });

    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { userWorkflow },
      agents: { durable },
      recovery: stopped,
    });

    // Same instance that addAgent() registered via getDurableWorkflows().
    const durableWorkflow = durable.getWorkflow();

    const user = await stubActiveRun(storage, userWorkflow, 'user-run-1');
    const loop = await stubActiveRun(storage, durableWorkflow, 'durable-run-1');

    await mastra.restartAllActiveWorkflowRuns();

    expect(user.createRun).toHaveBeenCalledTimes(1);
    expect(user.createRun).toHaveBeenCalledWith({ runId: 'user-run-1' });
    expect(user.restart).toHaveBeenCalledTimes(1);

    // Durable-agent runs must only be recovered via recovery.durableAgents: 'auto'.
    expect(loop.createRun).not.toHaveBeenCalled();
    expect(loop.restart).not.toHaveBeenCalled();
  });

  it('skips workflows that opt out via options.autoRestartActiveRuns', async () => {
    const optedOutWorkflow = createWorkflow({
      id: 'opted-out-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { autoRestartActiveRuns: false },
    }).commit();
    const defaultWorkflow = createWorkflow({
      id: 'default-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();

    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { optedOutWorkflow, defaultWorkflow },
      recovery: stopped,
    });

    const optedOut = await stubActiveRun(storage, optedOutWorkflow, 'opted-out-run-1');
    const restarted = await stubActiveRun(storage, defaultWorkflow, 'default-run-1');

    await mastra.restartAllActiveWorkflowRuns();

    expect(restarted.createRun).toHaveBeenCalledTimes(1);
    expect(restarted.restart).toHaveBeenCalledTimes(1);

    expect(optedOut.createRun).not.toHaveBeenCalled();
    expect(optedOut.restart).not.toHaveBeenCalled();
  });

  async function trackConcurrentRestarts(recovery: { workflowConcurrency?: number } | undefined, runCount: number) {
    const workflow = createWorkflow({
      id: 'busy-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { workflow },
      recovery: { ...recovery, ...stopped },
    });

    for (let i = 0; i < runCount; i++) {
      await persistActiveRun(storage, workflow.id, `run-${i}`);
    }

    // Counts the restarts blocked at once. run-0 fails before it blocks, so the peak does not
    // depend on where the store lists it.
    let inFlight = 0;
    let peak = 0;
    const peakWaiters: Array<{ peak: number; resolve: () => void }> = [];
    const releases: Array<() => void> = [];
    const restarted: string[] = [];
    vi.spyOn(workflow, 'createRun').mockImplementation(async ({ runId } = {}) => {
      return {
        restart: async () => {
          if (runId === 'run-0') {
            throw new Error('boom');
          }

          inFlight++;
          peak = Math.max(peak, inFlight);
          peakWaiters.filter(waiter => peak >= waiter.peak).forEach(waiter => waiter.resolve());
          try {
            await new Promise<void>(resolve => releases.push(resolve));
            restarted.push(runId!);
          } finally {
            inFlight--;
          }
        },
      } as any;
    });

    let settled = false;
    // Awaited by every test through `sweep`, which reports a rejection there.
    const sweep = mastra.restartAllActiveWorkflowRuns().then(() => {
      settled = true;
    });

    return {
      sweep,
      isSettled: () => settled,
      peak: () => peak,
      /** Resolves once `count` restarts were blocked at the same time. */
      peakReached: (count: number) =>
        new Promise<void>(resolve => (peak >= count ? resolve() : peakWaiters.push({ peak: count, resolve }))),
      restarted,
      releaseAll: async () => {
        while (!settled) {
          releases.splice(0).forEach(release => release());
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      },
    };
  }

  it('restarts runs in parallel, capped at 5 by default, and resolves once all settle', async () => {
    const t = await trackConcurrentRestarts(undefined, 12);
    await t.peakReached(5);
    expect(t.isSettled()).toBe(false);

    await t.releaseAll();
    await t.sweep;
    expect(t.peak()).toBe(5);
    // run-0 failed; the sweep logs it and keeps going.
    expect(t.restarted.sort()).toEqual(Array.from({ length: 11 }, (_, i) => `run-${i + 1}`).sort());
  });

  it('honours recovery.workflowConcurrency', async () => {
    const t = await trackConcurrentRestarts({ workflowConcurrency: 2 }, 6);
    await t.peakReached(2);
    await t.releaseAll();
    await t.sweep;
    expect(t.peak()).toBe(2);
  });

  it('treats workflowConcurrency: Infinity as no limit', async () => {
    const t = await trackConcurrentRestarts({ workflowConcurrency: Infinity }, 8);
    // run-0 fails immediately; the other 7 all start without waiting on each other.
    await t.peakReached(7);
    await t.releaseAll();
    await t.sweep;
    expect(t.peak()).toBe(7);
  });

  it('keeps restarting other runs when one run cannot resolve its workflow', async () => {
    const goneWorkflow = createWorkflow({
      id: 'gone-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const liveWorkflow = createWorkflow({
      id: 'live-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, workflows: { goneWorkflow, liveWorkflow }, recovery: stopped });
    await stubActiveRun(storage, goneWorkflow, 'gone-run');
    const live = await stubActiveRun(storage, liveWorkflow, 'live-run');

    // Simulate the workflow being removed while the active runs were listed.
    const getWorkflowById = mastra.getWorkflowById.bind(mastra);
    vi.spyOn(mastra, 'getWorkflowById').mockImplementation(((id: string) => {
      if (id === 'gone-wf') throw new Error('Workflow with ID gone-wf not found');
      return getWorkflowById(id as any);
    }) as any);

    await expect(mastra.restartAllActiveWorkflowRuns()).resolves.toBeUndefined();
    expect(live.restart).toHaveBeenCalledTimes(1);
  });

  it('keeps restarting other runs when one run has an unparseable snapshot', async () => {
    const corruptWorkflow = createWorkflow({
      id: 'corrupt-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const liveWorkflow = createWorkflow({
      id: 'live-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { corruptWorkflow, liveWorkflow },
      recovery: stopped,
    });
    const corrupt = await stubActiveRun(storage, corruptWorkflow, 'corrupt-run');
    const live = await stubActiveRun(storage, liveWorkflow, 'live-run');
    // Stores hand back a snapshot they fail to parse as the raw string, e.g. a truncated row.
    const workflows = (await storage.getStore('workflows'))!;
    const listWorkflowRuns = workflows.listWorkflowRuns.bind(workflows);
    vi.spyOn(workflows, 'listWorkflowRuns').mockImplementation(async args => {
      const listed = await listWorkflowRuns(args);
      return {
        ...listed,
        runs: listed.runs.map(run =>
          run.runId === 'corrupt-run' ? { ...run, snapshot: '{"status":"running","value"' } : run,
        ),
      };
    });

    await expect(mastra.restartAllActiveWorkflowRuns()).resolves.toBeUndefined();
    expect(live.restart).toHaveBeenCalledTimes(1);
    expect(corrupt.restart).toHaveBeenCalledTimes(1);
  });

  it('resolves recovery defaults', () => {
    expect(new Mastra({ logger: false }).recoveryConfig).toEqual({
      workflows: 'auto',
      workflowConcurrency: 5,
      workflowGraceMs: 2_000,
      durableAgents: 'off',
    });
    expect(
      new Mastra({ logger: false, recovery: { workflows: 'off', workflowConcurrency: 0 } }).recoveryConfig,
    ).toMatchObject({ workflows: 'off', workflowConcurrency: 1 });
  });

  // The grace only covers default-engine runs, so it doesn't depend on the pubsub.
  it.each([
    { pubsub: 'the in-process pubsub', create: () => new EventEmitterPubSub() },
    {
      pubsub: 'a broker that redelivers unacked messages',
      create: () => sharedBroker({ redeliversUnacked: true }).connect(),
    },
  ])('defaults workflowGraceMs to 2 s with $pubsub, and honors an explicit value', ({ create }) => {
    expect(new Mastra({ logger: false, pubsub: create() }).recoveryConfig.workflowGraceMs).toBe(2_000);
    expect(
      new Mastra({ logger: false, pubsub: create(), recovery: { workflowGraceMs: 0 } }).recoveryConfig,
    ).toMatchObject({ workflowGraceMs: 0 });
    expect(
      new Mastra({ logger: false, pubsub: create(), recovery: { workflowGraceMs: -1 } }).recoveryConfig,
    ).toMatchObject({ workflowGraceMs: 2_000 });
  });
});
