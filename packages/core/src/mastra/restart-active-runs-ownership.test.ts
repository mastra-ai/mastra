/**
 * Boot-time workflow recovery must not re-drive a run another live replica is
 * executing (issue #25579). Two Mastra instances share one store, the way two
 * replicas share one database.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows';
import { Mastra } from './index';

function buildReplica(storage: InMemoryStore, onExecute: (runId: string) => Promise<void>) {
  const step = createStep({
    id: 'side-effect',
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async ({ runId }) => {
      await onExecute(runId);
      return { done: true };
    },
  });
  const workflow = createWorkflow({
    id: 'recoverable-wf',
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
  })
    .then(step)
    .commit();
  return new Mastra({ logger: false, storage, workflows: { workflow } });
}

const replicas: Mastra[] = [];
afterEach(async () => {
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown()));
});

describe('boot-time workflow recovery and run ownership (#25579)', () => {
  it('does not re-execute a run that another live replica is executing', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    let finishFirstExecution!: () => void;
    const firstExecutionBlocked = new Promise<void>(resolve => (finishFirstExecution = resolve));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => (signalStarted = resolve));

    const replicaA = buildReplica(storage, async runId => {
      executions.push(`A:${runId}`);
      signalStarted();
      await firstExecutionBlocked;
    });
    const replicaB = buildReplica(storage, async runId => {
      executions.push(`B:${runId}`);
    });
    replicas.push(replicaA, replicaB);

    const run = await replicaA.getWorkflow('workflow').createRun();
    const resultPromise = run.start({ inputData: {} });
    await started;

    const active = await replicaB.listActiveWorkflowRuns();
    expect(active.runs.map(r => r.runId)).toEqual([run.runId]);

    // Replica B boots while A is still executing the run.
    await replicaB.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([`A:${run.runId}`]);

    finishFirstExecution();
    const result = await resultPromise;
    expect(result.status).toBe('success');
    expect(executions).toEqual([`A:${run.runId}`]);

    // A released its lease when the run settled.
    const workflowsStore = await storage.getStore('workflows');
    expect((await workflowsStore!.getRunOwnership({ runId: run.runId }))?.live).toBe(false);
  });

  it('recovers a run whose owner crashed once its lease expires', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const replica = buildReplica(storage, async runId => {
      executions.push(runId);
    });
    replicas.push(replica);

    // A crashed replica left a running snapshot and a lease it can no longer renew.
    const workflow = replica.getWorkflow('workflow');
    const run = await workflow.createRun();
    const workflowsStore = (await storage.getStore('workflows'))!;
    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
      snapshot: { ...snapshot!, status: 'running', activePaths: [0], context: { input: {} } as any },
    });
    await workflowsStore.claimRunOwnership({ runId: run.runId, ownerId: 'crashed-replica', leaseMs: 300 });

    await replica.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    // The sweep re-checks once the lease lapses (plus jitter) and recovers the run.
    await expect.poll(() => executions, { timeout: 8_000, interval: 100 }).toEqual([run.runId]);
    await expect
      .poll(
        async () =>
          (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status,
        { timeout: 2_000 },
      )
      .toBe('success');
  }, 15_000);
});
