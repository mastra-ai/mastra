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
import type { WorkflowRuns } from '../storage';
import { MockStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { createWorkflow } from '../workflows';
import type { Workflow, WorkflowRunStatus } from '../workflows';
import { Mastra } from './index';

function createWorkflowRun(
  workflowName: string,
  runId: string,
  status: WorkflowRunStatus,
): WorkflowRuns['runs'][number] {
  return {
    workflowName,
    runId,
    snapshot: {
      ...createEmptyWorkflowSnapshot(runId),
      status,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Stub a workflow to report one active run and observe restart attempts. */
function stubActiveRun(workflow: Workflow<any, any, any, any, any, any>, runId: string) {
  vi.spyOn(workflow, 'listActiveWorkflowRuns').mockResolvedValue({
    runs: [createWorkflowRun(workflow.id, runId, 'running')],
    total: 1,
  });
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

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { userWorkflow },
      agents: { durable },
    });

    // Same instance that addAgent() registered via getDurableWorkflows().
    const durableWorkflow = durable.getWorkflow();

    const user = stubActiveRun(userWorkflow, 'user-run-1');
    const loop = stubActiveRun(durableWorkflow, 'durable-run-1');

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

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { optedOutWorkflow, defaultWorkflow },
    });

    const optedOut = stubActiveRun(optedOutWorkflow, 'opted-out-run-1');
    const restarted = stubActiveRun(defaultWorkflow, 'default-run-1');

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
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow }, recovery });

    vi.spyOn(workflow, 'listActiveWorkflowRuns').mockResolvedValue({
      runs: Array.from({ length: runCount }, (_, i) => createWorkflowRun(workflow.id, `run-${i}`, 'running')),
      total: runCount,
    });
    let inFlight = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const restarted: string[] = [];
    vi.spyOn(workflow, 'createRun').mockImplementation(async ({ runId } = {}) => {
      return {
        restart: async () => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          try {
            if (runId === 'run-0') throw new Error('boom');
            await new Promise<void>(resolve => releases.push(resolve));
            restarted.push(runId!);
          } finally {
            inFlight--;
          }
        },
      } as any;
    });

    let settled = false;
    const sweep = mastra.restartAllActiveWorkflowRuns().then(() => {
      settled = true;
    });
    return {
      sweep,
      isSettled: () => settled,
      peak: () => peak,
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
    await vi.waitFor(() => expect(t.peak()).toBe(5));
    expect(t.isSettled()).toBe(false);

    await t.releaseAll();
    await t.sweep;
    expect(t.peak()).toBe(5);
    // run-0 failed; the sweep logs it and keeps going.
    expect(t.restarted.sort()).toEqual(Array.from({ length: 11 }, (_, i) => `run-${i + 1}`).sort());
  });

  it('honours recovery.workflowConcurrency', async () => {
    const t = await trackConcurrentRestarts({ workflowConcurrency: 2 }, 6);
    await vi.waitFor(() => expect(t.peak()).toBe(2));
    await t.releaseAll();
    await t.sweep;
    expect(t.peak()).toBe(2);
  });

  it('treats workflowConcurrency: Infinity as no limit', async () => {
    const t = await trackConcurrentRestarts({ workflowConcurrency: Infinity }, 8);
    // run-0 fails immediately; the other 7 all start without waiting on each other.
    await vi.waitFor(() => expect(t.peak()).toBe(7));
    await t.releaseAll();
    await t.sweep;
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
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { goneWorkflow, liveWorkflow } });
    stubActiveRun(goneWorkflow, 'gone-run');
    const live = stubActiveRun(liveWorkflow, 'live-run');

    // Simulate the workflow being removed while the active runs were listed.
    const getWorkflowById = mastra.getWorkflowById.bind(mastra);
    vi.spyOn(mastra, 'getWorkflowById').mockImplementation(((id: string) => {
      if (id === 'gone-wf') throw new Error('Workflow with ID gone-wf not found');
      return getWorkflowById(id as any);
    }) as any);

    await expect(mastra.restartAllActiveWorkflowRuns()).resolves.toBeUndefined();
    expect(live.restart).toHaveBeenCalledTimes(1);
  });

  it('resolves recovery defaults', () => {
    expect(new Mastra({ logger: false }).recoveryConfig).toEqual({
      workflows: 'auto',
      workflowConcurrency: 5,
      durableAgents: 'off',
    });
    expect(
      new Mastra({ logger: false, recovery: { workflows: 'off', workflowConcurrency: 0 } }).recoveryConfig,
    ).toMatchObject({ workflows: 'off', workflowConcurrency: 1 });
  });
});
