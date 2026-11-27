/**
 * Boot-time workflow recovery must not re-drive a run another live replica is
 * executing (issue #25579). Two Mastra instances share one store, the way two
 * replicas share one database.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { noopLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows';
import type { WorkflowOptions } from '../workflows';
import {
  MAX_WORKFLOW_RUN_LEASE_TTL_MS,
  MIN_WORKFLOW_RUN_LEASE_TTL_MS,
  WORKFLOW_RUN_LEASE_TTL_MS,
} from '../workflows/run-ownership';
import { Mastra } from './index';

function buildReplica(
  storage: InMemoryStore,
  onExecute: (runId: string, suspend: (payload: object) => Promise<unknown>) => Promise<void>,
  storageVersion?: 1 | 2,
  options: Partial<ConstructorParameters<typeof Mastra>[0]> = {},
  workflowOptions: WorkflowOptions = {},
) {
  const step = createStep({
    id: 'side-effect',
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
    execute: async ({ runId, suspend }) => {
      await onExecute(runId, suspend);
      return { done: true };
    },
  });
  const workflow = createWorkflow({
    id: 'recoverable-wf',
    inputSchema: z.object({}),
    outputSchema: z.object({ done: z.boolean() }),
    options: { ...workflowOptions, ...(storageVersion ? { storageVersion } : {}) },
  })
    .then(step)
    .commit();
  return new Mastra({ logger: false, ...options, storage, workflows: { workflow } });
}

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  // The recovery restart's saves are refused once a third process takes the run over. That is the
  // new owner's run now, not a failed restart for this replica to report.
  it.each(['Mastra', 'Workflow'] as const)(
    'ends a %s recovery restart that another process took over without logging a failed restart',
    async via => {
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const hold = () => new Promise<void>(resolve => gates.push(resolve));
      const errors: string[] = [];
      const logger = { ...noopLogger, error: (message: string) => errors.push(message) } as IMastraLogger;
      const replicaA = buildReplica(storage, hold);
      const replicaB = buildReplica(storage, hold, undefined, { logger, recovery: { workflowGraceMs: 0 } });
      replicas.push(replicaA, replicaB);
      const workflowsStore = (await storage.getStore('workflows'))!;

      const run = await replicaA.getWorkflow('workflow').createRun();
      const stalled = run.start({ inputData: {} });
      await vi.waitFor(() => expect(gates).toHaveLength(1));
      // A's lease lapses, and B's recovery restarts the run.
      await workflowsStore.claimRunOwnership({ runId: run.runId, ownerId: 'lapsed', leaseMs: -1, force: true });
      const recovering =
        via === 'Mastra'
          ? replicaB.restartAllActiveWorkflowRuns()
          : replicaB.getWorkflow('workflow').restartAllActiveWorkflowRuns();
      await vi.waitFor(() => expect(gates).toHaveLength(2));

      const claim = await workflowsStore.claimRunOwnership({
        runId: run.runId,
        ownerId: 'C',
        leaseMs: 60_000,
        force: true,
      });
      const fence = { runId: run.runId, generation: claim.record!.generation, ownerId: 'C' };
      await workflowsStore.updateWorkflowState({
        workflowName: 'recoverable-wf',
        runId: run.runId,
        opts: { status: 'success' },
        fence,
      });
      gates[1]!();
      await recovering;
      gates[0]!();
      await expect(stalled).rejects.toMatchObject({ id: 'STORAGE_RUN_FENCE_CONFLICT' });

      expect(errors).toEqual([]);
      const stored = await workflowsStore.loadWorkflowSnapshot({ workflowName: 'recoverable-wf', runId: run.runId });
      expect(stored?.status).toBe('success');
      // Neither A nor B stored the step's result over C's run.
      expect(stored?.context['side-effect']?.status).toBe('running');
    },
  );

  describe.each([1, 2] as const)('restart() of a run that stops before the claim (storage v%s)', storageVersion => {
    /**
     * Replica A runs the step up to a gate; replica B's `restart()` reads the run while A is live.
     * Just before B claims the lease, A passes the gate and settles, writing its outcome and
     * releasing its lease for real.
     */
    async function raceRestartWithSettle(afterGate: (suspend: (payload: object) => Promise<unknown>) => Promise<void>) {
      const storage = new InMemoryStore();
      const executions: string[] = [];
      const gate = Promise.withResolvers<void>();
      const started = Promise.withResolvers<void>();
      const replicaA = buildReplica(
        storage,
        async (runId, suspend) => {
          executions.push(`A:${runId}`);
          started.resolve();
          await gate.promise;
          await afterGate(suspend);
        },
        storageVersion,
      );
      const replicaB = buildReplica(
        storage,
        async runId => {
          executions.push(`B:${runId}`);
        },
        storageVersion,
      );
      replicas.push(replicaA, replicaB);

      const run = await replicaA.getWorkflow('workflow').createRun();
      const settled = run.start({ inputData: {} });
      await started.promise;

      const workflowsStore = (await storage.getStore('workflows'))!;
      const claim = workflowsStore.claimRunOwnership.bind(workflowsStore);
      vi.spyOn(workflowsStore, 'claimRunOwnership').mockImplementation(async args => {
        if (args.runId === run.runId && !args.force) {
          gate.resolve();
          await settled;
        }
        return claim(args);
      });

      const runOnB = await replicaB.getWorkflow('workflow').createRun({ runId: run.runId });
      const restarted = runOnB.restart();
      const settledResult = await settled;
      const storedAfterSettle = await workflowsStore.getWorkflowRunById({
        workflowName: 'recoverable-wf',
        runId: run.runId,
      });
      return { run, restarted, settledResult, storedAfterSettle, executions, workflowsStore };
    }

    it('returns the stored result of a run that finished, and does not run its step again', async () => {
      const { run, restarted, settledResult, storedAfterSettle, executions, workflowsStore } =
        await raceRestartWithSettle(async () => {});
      expect(settledResult.status).toBe('success');

      const result = await restarted;
      expect(executions).toEqual([`A:${run.runId}`]);
      expect(result.status).toBe('success');
      expect(result).toMatchObject({ result: { done: true } });
      expect(await workflowsStore.getWorkflowRunById({ workflowName: 'recoverable-wf', runId: run.runId })).toEqual(
        storedAfterSettle,
      );
      expect((await workflowsStore.getRunOwnership({ runId: run.runId }))?.live).toBe(false);
    });

    it('refuses to restart a run that suspended, and does not run its step again', async () => {
      const { run, restarted, settledResult, storedAfterSettle, executions, workflowsStore } =
        await raceRestartWithSettle(async suspend => {
          await suspend({});
        });
      expect(settledResult.status).toBe('suspended');

      await expect(restarted).rejects.toThrow('This workflow run was not active');
      expect(executions).toEqual([`A:${run.runId}`]);
      expect(await workflowsStore.getWorkflowRunById({ workflowName: 'recoverable-wf', runId: run.runId })).toEqual(
        storedAfterSettle,
      );
      expect((await workflowsStore.getRunOwnership({ runId: run.runId }))?.live).toBe(false);
    });
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
  it.each(['parent', 'nested run'] as const)(
    'fails a direct resume of a nested run whose %s lease claim throws, and leaves both runs suspended',
    async leaseOf => {
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

        throw new Error('store unavailable');
      });

      await expect(resume()).rejects.toThrow('store unavailable');
      expect(executions).toEqual(['approve:suspended']);
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'parent', runId: run.runId })).toBe(
        'suspended',
      );
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: 'child', runId: nestedRunId })).toBe(
        'suspended',
      );
    },
  );

  describe('lease length (COR-1634)', () => {
    const fakeTimers = () =>
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    // setImmediate stays real, so this lets in-memory storage work settle without moving the fake clock.
    const until = async (done: () => boolean) => {
      while (!done()) await new Promise(resolve => setImmediate(resolve));
    };
    const leaseOf = async (storage: InMemoryStore, runId: string) => {
      const record = (await (await storage.getStore('workflows'))!.getRunOwnership({ runId }))!;
      return { live: record.live, ms: record.leaseExpiresAt!.getTime() - record.updatedAt!.getTime() };
    };

    it("holds a run's lease for the workflow's leaseTtlMs, or the run's own", async () => {
      fakeTimers();
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const replica = buildReplica(
        storage,
        () => new Promise<void>(resolve => gates.push(resolve)),
        undefined,
        { recovery: { workflows: 'off' } },
        { leaseTtlMs: 3_000 },
      );
      replicas.push(replica);

      const workflowLease = await replica.getWorkflow('workflow').createRun();
      const ownLease = await replica.getWorkflow('workflow').createRun({ leaseTtlMs: 90_000 });
      const hugeLease = await replica.getWorkflow('workflow').createRun({ leaseTtlMs: Number.MAX_SAFE_INTEGER });
      const results = [workflowLease, ownLease, hugeLease].map(run => run.start({ inputData: {} }));
      await until(() => gates.length === 3);
      expect(await leaseOf(storage, workflowLease.runId)).toEqual({ live: true, ms: 3_000 });
      expect(await leaseOf(storage, ownLease.runId)).toEqual({ live: true, ms: 90_000 });
      expect(await leaseOf(storage, hugeLease.runId)).toEqual({ live: true, ms: MAX_WORKFLOW_RUN_LEASE_TTL_MS });

      // Renewals keep the length and come often enough for a lease shorter than the default renew interval.
      for (let second = 0; second < 10; second++) {
        await vi.advanceTimersByTimeAsync(1_000);
        expect(await leaseOf(storage, workflowLease.runId)).toEqual({ live: true, ms: 3_000 });
      }

      gates.forEach(open => open());
      expect((await Promise.all(results)).map(result => result.status)).toEqual(['success', 'success', 'success']);
    });

    // createRun() options can come from a request body, so a tiny lease must not set the storage write rate.
    it('renews a run with a lease under the minimum no more often than one at the minimum', async () => {
      fakeTimers();
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const replica = buildReplica(storage, () => new Promise<void>(resolve => gates.push(resolve)), undefined, {
        recovery: { workflows: 'off' },
      });
      replicas.push(replica);
      const store = (await storage.getStore('workflows'))!;
      const renewals = vi.spyOn(store, 'renewRunOwnership');

      const tiny = await replica.getWorkflow('workflow').createRun({ leaseTtlMs: 1 });
      const minimum = await replica.getWorkflow('workflow').createRun({ leaseTtlMs: MIN_WORKFLOW_RUN_LEASE_TTL_MS });
      const results = [tiny, minimum].map(run => run.start({ inputData: {} }));
      await until(() => gates.length === 2);
      await vi.advanceTimersByTimeAsync(3_000);

      const renewalsOf = (runId: string) => renewals.mock.calls.filter(([args]) => args.runId === runId).length;
      expect(renewalsOf(minimum.runId)).toBeGreaterThan(0);
      expect(renewalsOf(tiny.runId)).toBe(renewalsOf(minimum.runId));
      expect(await leaseOf(storage, tiny.runId)).toEqual({ live: true, ms: MIN_WORKFLOW_RUN_LEASE_TTL_MS });

      gates.forEach(open => open());
      expect((await Promise.all(results)).map(result => result.status)).toEqual(['success', 'success']);
    });

    it("takes a run's leaseTtlMs from a later createRun() for the same run id", async () => {
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const replica = buildReplica(
        storage,
        () => new Promise<void>(resolve => gates.push(resolve)),
        undefined,
        { recovery: { workflows: 'off' } },
        { leaseTtlMs: 3_000 },
      );
      replicas.push(replica);

      const created = await replica.getWorkflow('workflow').createRun();
      const again = await replica.getWorkflow('workflow').createRun({ runId: created.runId, leaseTtlMs: 90_000 });
      expect(again).toBe(created);
      const result = again.start({ inputData: {} });
      await until(() => gates.length === 1);
      expect(await leaseOf(storage, created.runId)).toEqual({ live: true, ms: 90_000 });

      gates.forEach(open => open());
      expect((await result).status).toBe('success');
    });

    it('doubles the lease of a run restarted over a lapsed one, up to 8 times its base, and warns each time', async () => {
      fakeTimers();
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const warnings: { message: string; context: unknown }[] = [];
      const logger = {
        ...noopLogger,
        warn: (message: string, context: unknown) => warnings.push({ message, context }),
      } as IMastraLogger;
      const replica = () => {
        const mastra = buildReplica(
          storage,
          () => new Promise<void>(resolve => gates.push(resolve)),
          undefined,
          { logger, recovery: { workflows: 'off' } },
          { leaseTtlMs: 1_000 },
        );
        replicas.push(mastra);
        return mastra;
      };

      const run = await replica().getWorkflow('workflow').createRun();
      const executions = [run.start({ inputData: {} })];
      await until(() => gates.length === 1);
      const lengths = [(await leaseOf(storage, run.runId)).ms];
      for (let takeover = 1; takeover <= 4; takeover++) {
        // The owner blocks its event loop past its lease: time passes and none of its timers run.
        vi.setSystemTime(Date.now() + 10_000);
        executions.push((await replica().getWorkflow('workflow').createRun({ runId: run.runId })).restart());
        await until(() => gates.length === takeover + 1);
        lengths.push((await leaseOf(storage, run.runId)).ms);
      }

      expect(lengths).toEqual([1_000, 2_000, 4_000, 8_000, 8_000]);
      expect(warnings.filter(({ message }) => message.startsWith('Took over')).map(({ context }) => context)).toEqual([
        { runId: run.runId, previousLeaseMs: 1_000, leaseMs: 2_000 },
        { runId: run.runId, previousLeaseMs: 2_000, leaseMs: 4_000 },
        { runId: run.runId, previousLeaseMs: 4_000, leaseMs: 8_000 },
        { runId: run.runId, previousLeaseMs: 8_000, leaseMs: 8_000 },
      ]);

      // Only the last restart still owns the run.
      gates.forEach(open => open());
      const settled = await Promise.allSettled(executions);
      expect(settled.at(-1)).toMatchObject({ status: 'fulfilled', value: { status: 'success' } });
      for (const stale of settled.slice(0, -1)) {
        expect(stale).toMatchObject({ status: 'rejected', reason: { id: 'STORAGE_RUN_FENCE_CONFLICT' } });
      }
    });

    const tookOver = (warnings: { message: string }[]) =>
      warnings.filter(({ message }) => message.startsWith('Took over'));

    it('restarts with the base lease when the previous lease cannot be read, and still refuses a live run', async () => {
      fakeTimers();
      const storage = new InMemoryStore();
      const gates: (() => void)[] = [];
      const warnings: { message: string; context: unknown }[] = [];
      const logger = { ...noopLogger, warn: (message: string) => warnings.push({ message, context: undefined }) };
      const replica = (options: Partial<ConstructorParameters<typeof Mastra>[0]> = {}) => {
        const mastra = buildReplica(
          storage,
          () => new Promise<void>(resolve => gates.push(resolve)),
          undefined,
          { recovery: { workflows: 'off' }, ...options },
          { leaseTtlMs: 1_000 },
        );
        replicas.push(mastra);
        return mastra;
      };
      const run = await replica().getWorkflow('workflow').createRun();
      const first = run.start({ inputData: {} });
      await until(() => gates.length === 1);
      const store = (await storage.getStore('workflows'))!;
      const read = vi.spyOn(store, 'getRunOwnership').mockRejectedValue(new Error('storage unavailable'));
      const other = await replica({ logger: logger as IMastraLogger })
        .getWorkflow('workflow')
        .createRun({ runId: run.runId });

      await expect(other.restart()).rejects.toMatchObject({ id: 'WORKFLOW_RESTART_RUN_OWNED' });
      vi.setSystemTime(Date.now() + 10_000);
      const restarted = other.restart();
      await until(() => gates.length === 2);
      expect(read).toHaveBeenCalled();
      read.mockRestore();
      expect(await leaseOf(storage, run.runId)).toEqual({ live: true, ms: 1_000 });
      expect(tookOver(warnings)).toEqual([]);

      gates.forEach(open => open());
      expect((await restarted).status).toBe('success');
      await expect(first).rejects.toMatchObject({ id: 'STORAGE_RUN_FENCE_CONFLICT' });
    });

    it('starts and resumes with the base lease, without reading the previous one', async () => {
      const storage = new InMemoryStore();
      const warnings: { message: string }[] = [];
      const logger = { ...noopLogger, warn: (message: string) => warnings.push({ message }) } as IMastraLogger;
      const resumed = Promise.withResolvers<void>();
      const finish = Promise.withResolvers<void>();
      let executions = 0;
      const replica = buildReplica(
        storage,
        async (_runId, suspend) => {
          if (executions++ === 0) {
            await suspend({});
            return;
          }
          resumed.resolve();
          await finish.promise;
        },
        undefined,
        { logger, recovery: { workflows: 'off' } },
        { leaseTtlMs: 1_000 },
      );
      replicas.push(replica);
      const store = (await storage.getStore('workflows'))!;
      const reads = vi.spyOn(store, 'getRunOwnership');

      const run = await replica.getWorkflow('workflow').createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      expect(reads).not.toHaveBeenCalled();
      // A lapsed lease, as a crashed owner leaves it.
      await store.claimRunOwnership({ runId: run.runId, ownerId: 'crashed', leaseMs: 1, force: true });
      await vi.waitFor(async () => expect((await store.getRunOwnership({ runId: run.runId }))?.live).toBe(false));
      reads.mockClear();

      const resuming = run.resume({ step: 'side-effect', resumeData: {} });
      await resumed.promise;
      expect(reads).not.toHaveBeenCalled();
      expect(await leaseOf(storage, run.runId)).toEqual({ live: true, ms: 1_000 });
      expect(tookOver(warnings)).toEqual([]);
      finish.resolve();
      expect((await resuming).status).toBe('success');
    });
  });
});
