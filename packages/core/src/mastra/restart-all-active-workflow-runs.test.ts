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
});
