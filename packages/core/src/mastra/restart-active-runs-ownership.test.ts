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

  it('recovers a run whose owner crashed from the recovery loop, once its lease expired and a grace period passed', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const replica = buildReplica(storage, async runId => {
      executions.push(runId);
    });
    replicas.push(replica);
    // A crashed replica left a running snapshot and a lease it can no longer renew.
    const { workflow, run, workflowsStore } = await persistOrphanedRun(storage, replica, 300);

    // The loop's first pass sees the lease live; its next pass comes once the lease and the 2 s
    // in-process grace ran out, well before the 60 s scan interval.
    const startedAt = Date.now();
    await replica.startWorkers();
    await expect.poll(() => executions, { timeout: 6_000, interval: 50 }).toEqual([run.runId]);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2_000);
    await expect
      .poll(
        async () =>
          (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status,
        { timeout: 2_000 },
      )
      .toBe('success');
  }, 15_000);

  it('drains a restart the recovery loop started on shutdown', async () => {
    const storage = new InMemoryStore();
    let finish!: () => void;
    const gate = new Promise<void>(resolve => (finish = resolve));
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => (signalStarted = resolve));
    const replica = buildReplica(storage, async () => {
      signalStarted();
      await gate;
    });
    const { workflow, run, workflowsStore } = await persistOrphanedRun(storage, replica, -60_000);

    await replica.startWorkers();
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
    // The lease renews on a setTimeout chain.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
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

  /** A parent run suspended in its nested `child` workflow, and the nested run's id. */
  async function suspendedInChild(
    storage: InMemoryStore,
    executions: string[],
    approve: () => Promise<void> = async () => {},
  ) {
    const child = createWorkflow({ id: 'child', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'approve',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          resumeSchema: z.object({ approved: z.boolean() }),
          execute: async ({ resumeData, suspend }) => {
            executions.push(`approve:${resumeData ? 'resumed' : 'suspended'}`);
            if (!resumeData) {
              return suspend({});
            }

            await approve();
            return {};
          },
        }),
      )
      .commit();
    const parent = createWorkflow({ id: 'parent', inputSchema: z.object({}), outputSchema: z.any() })
      .then(child)
      .then(
        createStep({
          id: 'after',
          inputSchema: z.any(),
          outputSchema: z.object({}),
          execute: async () => {
            executions.push('after');
            return {};
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { parent, child } });
    replicas.push(mastra);
    const run = await parent.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const workflowsStore = (await storage.getStore('workflows'))!;
    const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: 'parent', runId: run.runId });
    const nestedRunId = (parentSnapshot?.context.child as { suspendPayload?: any }).suspendPayload?.__workflow_meta
      ?.runId as string;
    const resume = async () =>
      (await child.createRun({ runId: nestedRunId })).resume({ step: 'approve', resumeData: { approved: true } });
    return { run, nestedRunId, workflowsStore, resume, parent, child };
  }

  it('leaves a parent run alone while one of its nested runs is resumed directly, and hands it the lease once', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const resumed = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const { run, workflowsStore, resume, parent, child } = await suspendedInChild(storage, executions, async () => {
      resumed.resolve();
      await finish.promise;
    });
    // Another instance sees every stopped run as due at once.
    const other = new Mastra({
      logger: false,
      storage,
      workflows: { parent, child },
      recovery: { workflowGraceMs: 0 },
    });
    replicas.push(other);

    // Resuming the nested run sets the parent `running`, and the parent's lease shows it is driven.
    const claims = vi.spyOn(workflowsStore, 'claimRunOwnership');
    const resuming = resume();
    await resumed.promise;
    expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe('running');
    const restarts = vi.spyOn(parent, 'createRun');
    await other.restartAllActiveWorkflowRuns();
    expect(restarts).not.toHaveBeenCalled();
    restarts.mockRestore();

    finish.resolve();
    expect((await resuming).status).toBe('success');
    await vi.waitFor(async () =>
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe('success'),
    );
    expect(executions).toEqual(['approve:suspended', 'approve:resumed', 'after']);
    // The parent's lease was claimed once, by the nested run's resume, and handed to the parent's resume.
    expect(claims.mock.calls.filter(([args]) => args.runId === run.runId)).toHaveLength(1);
  });

  it('leaves a nested parent run alone while its own nested run is resumed directly, three levels deep', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const resumed = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const step = (id: string, execute: (args: any) => Promise<any>) =>
      createStep({ id, inputSchema: z.any(), outputSchema: z.any(), resumeSchema: z.any(), execute });
    const child = createWorkflow({ id: 'child', inputSchema: z.object({}), outputSchema: z.any() })
      .then(
        step('approve', async ({ resumeData, suspend }) => {
          executions.push(`approve:${resumeData ? 'resumed' : 'suspended'}`);
          if (!resumeData) {
            return suspend({});
          }

          resumed.resolve();
          await finish.promise;
          return {};
        }),
      )
      .commit();
    const middle = createWorkflow({ id: 'middle', inputSchema: z.object({}), outputSchema: z.any() })
      .then(child)
      .commit();
    const top = createWorkflow({ id: 'top', inputSchema: z.object({}), outputSchema: z.any() })
      .then(middle)
      .commit();
    const workflows = { top, middle, child };
    replicas.push(new Mastra({ logger: false, storage, workflows }));
    const run = await top.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const workflowsStore = (await storage.getStore('workflows'))!;
    const nestedRunIdOf = async (workflowName: string, runId: string, stepId: string) =>
      ((await workflowsStore.loadWorkflowSnapshot({ workflowName, runId }))?.context[stepId] as any).suspendPayload
        .__workflow_meta.runId as string;
    const middleRunId = await nestedRunIdOf('top', run.runId, 'middle');
    const childRunId = await nestedRunIdOf('middle', middleRunId, 'child');
    // Another instance sees every stopped run as due at once.
    const other = new Mastra({ logger: false, storage, workflows, recovery: { workflowGraceMs: 0 } });
    replicas.push(other);

    // The top run stays suspended, so the middle run, now running, would be restarted on its own if unleased.
    const resuming = (await child.createRun({ runId: childRunId })).resume({
      step: 'approve',
      resumeData: { approved: true },
    });
    await resumed.promise;
    expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'middle', runId: middleRunId })).toBe('running');
    // A stub, so a restart that slips through fails here instead of blocking on the held step.
    const restarts = vi.spyOn(middle, 'createRun').mockResolvedValue({ restart: async () => {} } as any);
    await other.restartAllActiveWorkflowRuns();
    expect(restarts).not.toHaveBeenCalled();
    restarts.mockRestore();

    finish.resolve();
    expect((await resuming).status).toBe('success');
  });

  it('leaves a directly resumed nested run alone on a store without compare-and-set, where its parent stays suspended', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const resumed = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const { run, workflowsStore, resume, parent, child } = await suspendedInChild(storage, executions, async () => {
      resumed.resolve();
      await finish.promise;
    });
    vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
    const other = new Mastra({
      logger: false,
      storage,
      workflows: { parent, child },
      recovery: { workflowGraceMs: 0 },
    });
    replicas.push(other);

    const resuming = resume();
    await resumed.promise;
    expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe('suspended');
    // A stub, so a restart that slips through fails here instead of blocking on the held step.
    const restarts = vi.spyOn(child, 'createRun').mockResolvedValue({ restart: async () => {} } as any);
    await other.restartAllActiveWorkflowRuns();
    expect(restarts).not.toHaveBeenCalled();
    restarts.mockRestore();

    finish.resolve();
    expect((await resuming).status).toBe('success');
    await vi.waitFor(async () =>
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe('success'),
    );
    expect(executions).toEqual(['approve:suspended', 'approve:resumed', 'after']);
  });

  // The lease is the parent's on a store with compare-and-set, and the nested run's own on a store without.
  it.each([
    ['parent', 'the claim throws', 'store unavailable'],
    // A forced claim can still be refused, for example when retention deletes the record mid-claim.
    ['parent', 'the store refuses the claim', /Failed to claim the lease of parent workflow run/],
    ['nested run', 'the claim throws', 'store unavailable'],
    ['nested run', 'the store refuses the claim', /Failed to claim the lease of nested workflow run/],
  ] as const)(
    'fails a direct resume of a nested run whose %s lease cannot be claimed (%s), and leaves both runs suspended',
    async (leaseOf, _, error) => {
      const storage = new InMemoryStore();
      const executions: string[] = [];
      const { run, nestedRunId, workflowsStore, resume } = await suspendedInChild(storage, executions);
      if (leaseOf === 'nested run') {
        vi.spyOn(workflowsStore, 'supportsConcurrentUpdates').mockReturnValue(false);
      }

      const leased = leaseOf === 'parent' ? run.runId : nestedRunId;
      const claim = workflowsStore.claimRunOwnership.bind(workflowsStore);
      vi.spyOn(workflowsStore, 'claimRunOwnership').mockImplementation(async args => {
        if (args.runId !== leased) {
          return claim(args);
        }

        if (error === 'store unavailable') {
          throw new Error(error);
        }

        return { acquired: false, record: await workflowsStore.getRunOwnership({ runId: leased }) };
      });

      await expect(resume()).rejects.toThrow(error);
      expect(executions).toEqual(['approve:suspended']);
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe(
        'suspended',
      );
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'child', runId: nestedRunId })).toBe(
        'suspended',
      );
    },
  );
});
