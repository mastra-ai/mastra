/**
 * Boot-time workflow recovery must not re-drive a run another live replica is
 * executing (issue #25579). Two Mastra instances share one store, the way two
 * replicas share one database.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../workflows/run-ownership';
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown()));
});

async function persistOrphanedRun(storage: InMemoryStore, mastra: Mastra, leaseMs: number) {
  const workflow = mastra.getWorkflow('workflow');
  const run = await workflow.createRun();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
  await workflowsStore.persistWorkflowSnapshot({
    workflowName: workflow.id,
    runId: run.runId,
    snapshot: { ...snapshot!, status: 'running', activePaths: [0], context: { input: {} } as any },
  });
  await workflowsStore.claimRunOwnership({ runId: run.runId, ownerId: 'crashed-replica', leaseMs });
  return { workflow, run, workflowsStore };
}

async function advanceUntil(condition: () => boolean | Promise<boolean>, maxMs: number, stepMs = 1_000) {
  for (let elapsed = 0; elapsed < maxMs && !(await condition()); elapsed += stepMs) {
    await vi.advanceTimersByTimeAsync(stepMs);
  }
}

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

  it('drains a recheck-driven restart on shutdown', async () => {
    const storage = new InMemoryStore();
    let finish!: () => void;
    const gate = new Promise<void>(resolve => (finish = resolve));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => (signalStarted = resolve));
    const replica = buildReplica(storage, async () => {
      signalStarted();
      await gate;
    });

    const workflow = replica.getWorkflow('workflow');
    const run = await workflow.createRun();
    const workflowsStore = (await storage.getStore('workflows'))!;
    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: run.runId,
      snapshot: { ...snapshot!, status: 'running', activePaths: [0], context: { input: {} } as any },
    });
    await workflowsStore.claimRunOwnership({ runId: run.runId, ownerId: 'crashed-replica', leaseMs: 100 });

    await replica.restartAllActiveWorkflowRuns();
    await started;

    let shutDown = false;
    const shutdown = replica.shutdown().then(() => (shutDown = true));
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(shutDown).toBe(false);

    finish();
    await shutdown;
    expect((await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status).toBe(
      'success',
    );
  }, 15_000);
  it('keeps renewing the lease of a run that outlives the lease TTL', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const storage = new InMemoryStore();
    const executions: string[] = [];
    let finish!: () => void;
    const gate = new Promise<void>(resolve => (finish = resolve));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => (signalStarted = resolve));
    const replicaA = buildReplica(storage, async runId => {
      executions.push(`A:${runId}`);
      signalStarted();
      await gate;
    });
    const replicaB = buildReplica(storage, async runId => {
      executions.push(`B:${runId}`);
    });
    replicas.push(replicaA, replicaB);

    const run = await replicaA.getWorkflow('workflow').createRun();
    const resultPromise = run.start({ inputData: {} });
    await started;

    // A is still executing well past the TTL of the lease it first claimed.
    await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 3);
    const workflowsStore = (await storage.getStore('workflows'))!;
    expect((await workflowsStore.getRunOwnership({ runId: run.runId }))?.live).toBe(true);

    await replicaB.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([`A:${run.runId}`]);
    const runOnB = await replicaB.getWorkflow('workflow').createRun({ runId: run.runId });
    await expect(runOnB.restart()).rejects.toMatchObject({ id: 'WORKFLOW_RESTART_RUN_OWNED' });
    expect(executions).toEqual([`A:${run.runId}`]);

    finish();
    expect((await resultPromise).status).toBe('success');
    expect(executions).toEqual([`A:${run.runId}`]);
  });

  it('retries a recheck that fails with a transient storage error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const replica = buildReplica(storage, async runId => {
      executions.push(runId);
    });
    replicas.push(replica);
    const { workflow, run, workflowsStore } = await persistOrphanedRun(storage, replica, 300);

    await replica.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    // The first recheck after the lease lapses hits a storage error.
    const load = workflowsStore.loadWorkflowSnapshot.bind(workflowsStore);
    let failures = 0;
    vi.spyOn(workflowsStore, 'loadWorkflowSnapshot').mockImplementation(async args => {
      if (failures === 0) {
        failures++;
        throw new Error('connection reset');
      }
      return load(args);
    });

    await advanceUntil(() => failures > 0, 10_000, 100);
    expect(failures).toBe(1);
    expect(executions).toEqual([]);

    // The failed recheck is retried with backoff and recovers the run.
    const status = async () =>
      (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status;
    await advanceUntil(async () => (await status()) === 'success', 120_000);
    expect(executions).toEqual([run.runId]);
    expect(await status()).toBe('success');
  });
});
