/**
 * The workflow recovery rule (#28712): an active run is restarted once no
 * process keeps it live and a grace period passed since it or its liveness
 * last changed. Replicas are Mastra instances sharing one store, the way pods
 * share one database. Leases use a short TTL here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import { InMemoryStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { createStep, createWorkflow } from '../workflows';
import type { WorkflowRunStatus } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { runEndedKey } from '../workflows/evented/leases';
import { Run } from '../workflows/workflow';
import { killableProcess } from './test-utils/killable-process';
import { Mastra } from './index';
import type { MastraRecoveryConfig } from './index';

const GRACE_MS = 300;

const replicas: { mastra: Mastra; revive?: () => void }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    replicas.splice(0).map(({ mastra, revive }) => {
      revive?.();
      return mastra.shutdown({ drainTimeout: 0 });
    }),
  );
});

const schema = z.object({});
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** A step `id` on `engine` that records `<replica>:<id>` and then runs `then`. */
function reportingStep(
  engine: 'default' | 'evented',
  replica: string,
  id: string,
  executions: string[],
  then?: () => Promise<void>,
) {
  const create = (engine === 'evented' ? createEventedStep : createStep) as typeof createStep;
  return create({
    id,
    inputSchema: schema,
    outputSchema: schema,
    execute: async () => {
      executions.push(`${replica}:${id}`);
      await then?.();
      return {};
    },
  });
}

/** A replica whose one-step `recovered-wf` runs on `engine`. */
function startReplica(
  storage: InMemoryStore,
  engine: 'default' | 'evented',
  name: string,
  executions: string[],
  { recovery = { workflowGraceMs: GRACE_MS }, pubsub }: { recovery?: MastraRecoveryConfig; pubsub?: PubSub } = {},
) {
  const create = (engine === 'evented' ? createEventedWorkflow : createWorkflow) as typeof createWorkflow;
  const workflow = create({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
    .then(reportingStep(engine, name, 'work', executions))
    .commit();
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { 'recovered-wf': workflow }, recovery });
  replicas.push({ mastra });
  return mastra;
}

/** Stores a run of `workflowName` its process left `status` mid-run, as a crash leaves it. */
async function persistActiveRun(
  storage: InMemoryStore,
  runId: string,
  { status = 'running', workflowName = 'recovered-wf' }: { status?: WorkflowRunStatus; workflowName?: string } = {},
) {
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot: { ...createEmptyWorkflowSnapshot(runId), status, activePaths: [], context: { input: {} } as any },
  });
}

/** Records the restart start events a pubsub publishes. */
function recordRestarts(inner: PubSub, restarts: string[]): PubSub {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic === 'workflows' && event.type === 'workflow.start' && event.data?.restart) {
            restarts.push(event.runId);
          }

          return target.publish(topic, event, options);
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** The stored status of `runId` under `workflowName`. */
async function statusOf(storage: InMemoryStore, runId: string, workflowName = 'recovered-wf') {
  return (await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({ workflowName, runId }))?.status;
}

describe('workflow recovery rule (#28712)', () => {
  it.each(['default', 'evented'] as const)(
    '%s: leaves a stopped run alone during its grace period and restarts it once the grace period passed',
    async engine => {
      const storage = new InMemoryStore();
      const executions: string[] = [];
      const mastra = startReplica(storage, engine, 'B', executions);
      if (engine === 'evented') {
        await mastra.startWorkers();
      }

      // The run's last write is just now, and no process keeps it live.
      await persistActiveRun(storage, 'stopped');
      const restarts = vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun');
      await mastra.restartAllActiveWorkflowRuns();
      expect(restarts).not.toHaveBeenCalled();

      await sleep(GRACE_MS);
      await mastra.restartAllActiveWorkflowRuns();
      await vi.waitFor(() => expect(executions).toEqual(['B:work']));
    },
  );

  it('anchors the grace period on the last expiry of a lapsed liveness lease when it is later than the run', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', 'B', executions);
    await persistActiveRun(storage, 'stopped');
    await sleep(GRACE_MS);
    // The run's last write is past the grace period, but its process renewed its lease until just now.
    await store.claimRunOwnership({ runId: 'stopped', ownerId: 'other-process', leaseMs: 1, force: true });
    await sleep(5);

    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    await sleep(GRACE_MS);
    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual(['B:work']);
  });

  /** A replica whose default-engine `recovered-wf` records each run it runs, and holds `blocked` until `release`. */
  function startBlockingReplica(storage: InMemoryStore, blocked: string, recovery: MastraRecoveryConfig) {
    const executions: string[] = [];
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const workflow = createWorkflow({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
      .then(
        createStep({
          id: 'work',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ runId }) => {
            executions.push(runId);
            if (runId === blocked) {
              started.resolve();
              await release.promise;
            }

            return {};
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { 'recovered-wf': workflow }, recovery });
    replicas.push({ mastra });
    return { mastra, executions, started: started.promise, release: release.resolve };
  }

  it("reads a queued restart's keys again, and leaves the run alone when another instance restarted it meanwhile", async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const b = startBlockingReplica(storage, 'run-1', { workflowGraceMs: GRACE_MS, workflowConcurrency: 1 });
    await persistActiveRun(storage, 'run-1');
    await persistActiveRun(storage, 'run-2');
    await sleep(GRACE_MS);

    // run-2 waits for run-1's slot. Meanwhile another instance restarts run-2, and the lease it took
    // lapses at once, as one whose workers lag behind would: the run is in its grace period again.
    const pass = b.mastra.restartAllActiveWorkflowRuns();
    await b.started;
    await store.claimRunOwnership({ runId: 'run-2', ownerId: 'other-instance', leaseMs: 1, force: true });
    await sleep(5);
    b.release();
    await pass;

    expect(b.executions).toEqual(['run-1']);
  });

  it('lets a later call list the runs again while an earlier call still waits for its default-engine restarts', async () => {
    const storage = new InMemoryStore();
    const b = startBlockingReplica(storage, 'run-1', { workflowGraceMs: 0 });
    await persistActiveRun(storage, 'run-1');
    let firstSettled = false;
    const first = b.mastra.restartAllActiveWorkflowRuns().then(() => {
      firstSettled = true;
    });
    await b.started;

    await persistActiveRun(storage, 'run-2');
    await b.mastra.restartAllActiveWorkflowRuns();

    expect(b.executions).toEqual(['run-1', 'run-2']);
    expect(firstSettled).toBe(false);
    b.release();
    await first;
  }, 10_000);

  it('rejects a background restart of an evented run whose end already went out without a stored result', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const restarts: string[] = [];
    const b = startReplica(storage, 'evented', 'B', [], { pubsub: recordRestarts(new EventEmitterPubSub(), restarts) });
    await b.startWorkers();
    // The run's end went out, and the end deleted nothing yet: it still reads running.
    await persistActiveRun(storage, 'ended');
    await store.claimRunOwnership({ runId: runEndedKey('ended'), ownerId: 'other-instance', leaseMs: 60_000 });

    const run = await b.getWorkflow('recovered-wf').createRun({ runId: 'ended' });
    await expect(run.restartInBackground()).rejects.toThrow();

    expect(restarts).toEqual([]);
    expect(await statusOf(storage, 'ended')).toBe('running');
  });

  it('resolves a background restart of an evented run that ended with a stored result to false, without publishing', async () => {
    const storage = new InMemoryStore();
    const restarts: string[] = [];
    const b = startReplica(storage, 'evented', 'B', [], { pubsub: recordRestarts(new EventEmitterPubSub(), restarts) });
    await b.startWorkers();
    await persistActiveRun(storage, 'finished', { status: 'success' });

    const run = await b.getWorkflow('recovered-wf').createRun({ runId: 'finished' });
    await expect(run.restartInBackground()).resolves.toBe(false);

    expect(restarts).toEqual([]);
  });

  it('restarts every active run at once in a store without run fencing', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', 'B', executions);
    vi.spyOn((await storage.getStore('workflows'))!, 'supportsRunFencing').mockResolvedValue(false);
    await persistActiveRun(storage, 'just-written');

    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual(['B:work']);
  });

  it('restarts a run once when it moves from running to waiting between the two listings', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = startReplica(storage, 'default', 'B', [], { recovery: { workflowGraceMs: 0 } });
    const runIds = Array.from({ length: 150 }, (_, i) => `run-${i}`);
    for (const runId of runIds) {
      await persistActiveRun(storage, runId);
    }

    const list = store.listWorkflowRuns.bind(store);
    let markWaiting!: () => void;
    const waiting = new Promise<void>(resolve => (markWaiting = resolve));
    vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async (args = {}) => {
      if (args.workflowName !== 'recovered-wf') {
        return list(args);
      }

      // The `waiting` listing reads only after a sleep step moved every run the `running` listing returned to `waiting`.
      if (args.status === 'waiting') {
        await waiting;
        return list(args);
      }

      const listed = await list(args);
      for (const run of listed.runs) {
        await persistActiveRun(storage, run.runId, { status: 'waiting' });
      }

      markWaiting();
      return listed;
    });
    // The restarts never finish the runs, so every run is still waiting when that status is listed.
    const restarted: string[] = [];
    vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun').mockImplementation(async ({ runId } = {}) => {
      restarted.push(runId!);
      return { restart: async () => {} } as any;
    });

    await mastra.restartAllActiveWorkflowRuns();

    expect([...restarted].sort()).toEqual([...runIds].sort());
  });

  it('restarts a waiting run that becomes running while the pass restarts the running runs', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = startReplica(storage, 'default', 'B', [], { recovery: { workflowGraceMs: 0 } });
    await persistActiveRun(storage, 'running-run');
    await persistActiveRun(storage, 'woken-run', { status: 'waiting' });

    // The sleeping run wakes, and its process dies, while the pass handles the running runs.
    const readOwners = store.getRunOwnerships.bind(store);
    vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
      if (args.runIds.includes('running-run')) {
        await persistActiveRun(storage, 'woken-run', { status: 'running' });
      }

      return readOwners(args);
    });
    const restarted: string[] = [];
    vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun').mockImplementation(async ({ runId } = {}) => {
      restarted.push(runId!);
      return { restart: async () => {} } as any;
    });

    await mastra.restartAllActiveWorkflowRuns();

    expect([...restarted].sort()).toEqual(['running-run', 'woken-run']);
  });

  it('publishes one restart of a stopped run when calls on one instance and on another overlap', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const restarts: string[] = [];
    const b = startReplica(storage, 'evented', 'B', executions, {
      recovery: { workflowGraceMs: 0 },
      pubsub: recordRestarts(new EventEmitterPubSub(), restarts),
    });
    const c = startReplica(storage, 'evented', 'C', executions, {
      recovery: { workflowGraceMs: 0 },
      pubsub: recordRestarts(new EventEmitterPubSub(), restarts),
    });
    await Promise.all([b.startWorkers(), c.startWorkers()]);
    await persistActiveRun(storage, 'stopped');
    const listings = vi.spyOn(store, 'listWorkflowRuns');

    await Promise.all([
      b.restartAllActiveWorkflowRuns(),
      b.restartAllActiveWorkflowRuns(),
      c.restartAllActiveWorkflowRuns(),
    ]);

    expect(restarts).toEqual(['stopped']);
    // B's second call joined its first pass: one listing per status for each instance.
    expect(listings.mock.calls.filter(([args]) => args?.workflowName === 'recovered-wf')).toHaveLength(4);
    await vi.waitFor(async () => expect(await statusOf(storage, 'stopped')).toBe('success'));
    expect(executions).toHaveLength(1);
  });

  it('leaves the restarted evented run without a finish waiter, so shutdown does not wait for it', async () => {
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const executions: string[] = [];
    const workflow = createEventedWorkflow({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
      .then(reportingStep('evented', 'B', 'work', executions))
      .sleep(60_000)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub,
      workflows: { 'recovered-wf': workflow },
      recovery: { workflowGraceMs: 0 },
    });
    await mastra.startWorkers();
    await persistActiveRun(storage, 'stopped');
    const subscribe = vi.spyOn(pubsub, 'subscribe');
    const unsubscribe = vi.spyOn(pubsub, 'unsubscribe');

    await mastra.restartAllActiveWorkflowRuns();
    // The run sleeps for a minute after its first step.
    await vi.waitFor(() => expect(executions).toEqual(['B:work']));

    const finishWaiters = (spy: typeof subscribe | typeof unsubscribe) =>
      spy.mock.calls.filter(([topic]) => topic === 'workflows-finish').length;
    expect(finishWaiters(subscribe)).toBe(finishWaiters(unsubscribe));
    const startedAt = Date.now();
    await mastra.shutdown({ drainTimeout: 5_000 });
    expect(Date.now() - startedAt).toBeLessThan(2_500);
  }, 15_000);

  it('restarts nothing while a nested run works, and restarts the parent once when its instance crashes', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const build = (replica: string, hang: boolean) => {
      const child = createEventedWorkflow({ id: 'nest-child', inputSchema: schema, outputSchema: schema })
        .then(
          reportingStep('evented', replica, 'inner', executions, hang ? () => new Promise<never>(() => {}) : undefined),
        )
        .commit();
      const parent = createEventedWorkflow({ id: 'nest-parent', inputSchema: schema, outputSchema: z.any() })
        .then(child)
        .then(reportingStep('evented', replica, 'after', executions))
        .commit();
      return { 'nest-parent': parent, 'nest-child': child };
    };
    const a = killableProcess({ storage, pubsub: new EventEmitterPubSub() });
    const onA = new Mastra({ logger: false, storage: a.storage, pubsub: a.pubsub, workflows: build('A', true) });
    replicas.push({ mastra: onA, revive: a.revive });
    const onB = new Mastra({
      logger: false,
      storage,
      workflows: build('B', false),
      recovery: { workflowGraceMs: GRACE_MS },
    });
    replicas.push({ mastra: onB });
    await Promise.all([onA.startWorkers(), onB.startWorkers()]);

    const run = await onA.getWorkflow('nest-parent').createRun();
    await run.startAsync({ inputData: {} });
    await vi.waitFor(() => expect(executions).toEqual(['A:inner']));
    const restarted: string[] = [];
    const restartInBackground = Run.prototype.restartInBackground;
    vi.spyOn(Run.prototype, 'restartInBackground').mockImplementation(function (this: Run) {
      restarted.push(this.workflowId);
      return restartInBackground.call(this);
    });

    // Longer than a lease TTL plus the grace period: the nested run keeps both runs live meanwhile.
    for (let pass = 0; pass < 4; pass++) {
      await onB.restartAllActiveWorkflowRuns();
      await sleep(300);
    }
    expect(restarted).toEqual([]);

    a.kill();
    await vi.waitFor(
      async () => {
        await onB.restartAllActiveWorkflowRuns();
        expect(await statusOf(storage, run.runId, 'nest-parent')).toBe('success');
      },
      { timeout: 10_000, interval: 100 },
    );
    expect(restarted).toEqual(['nest-parent']);
    expect(executions.filter(execution => execution.startsWith('B:'))).toEqual(['B:inner', 'B:after']);
  }, 20_000);
});
