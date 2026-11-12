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
import { NoOpObservability, SpanType } from '../observability';
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { runLivenessKey } from '../workflows/evented/leases';
import { Run } from '../workflows/workflow';
import { interceptStarts, persistActiveRun, sleep } from './test-utils/active-runs';
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

/** Replaces the restarts of `mastra`'s `recovered-wf` with no-ops, and returns the IDs of the runs it restarts. */
function stubRestarts(mastra: Mastra): string[] {
  const restarted: string[] = [];
  vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun').mockImplementation(async ({ runId } = {}) => {
    restarted.push(runId!);
    return { restart: async () => {} } as any;
  });
  return restarted;
}

/**
 * A span that records how each WORKFLOW_RUN span below it, itself included, ends in `runSpanEnds`. Its
 * children are recording spans too; every other span method does nothing.
 */
function recordingSpan(
  options: { type: SpanType; entityId?: string },
  runSpanEnds: { attributes?: { status?: string }; output?: unknown }[],
): any {
  const fields: Record<string | symbol, unknown> = {
    id: crypto.randomUUID(),
    traceId: 'recovered-trace',
    type: options.type,
    entityId: options.entityId,
    isValid: true,
  };
  const record = (ended?: { attributes?: { status?: string }; output?: unknown }) => {
    if (options.type === SpanType.WORKFLOW_RUN) {
      runSpanEnds.push({ attributes: ended?.attributes, output: ended?.output });
    }
  };
  return new Proxy(fields, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }

      if (prop === 'end' || prop === 'error') {
        return record;
      }

      if (prop === 'createChildSpan' || prop === 'createEventSpan') {
        return (child: { type: SpanType; entityId?: string }) => recordingSpan(child, runSpanEnds);
      }

      // Not a thenable, so `await` passes it through.
      return prop === 'then' ? undefined : () => undefined;
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

      // The same run once its last write is a grace period old.
      await persistActiveRun(storage, 'stopped', { updatedAt: new Date(Date.now() - GRACE_MS) });
      await mastra.restartAllActiveWorkflowRuns();
      await vi.waitFor(() => expect(executions).toEqual(['B:work']));
    },
  );

  it('anchors the grace period on the last expiry of a lapsed liveness lease when it is later than the run', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', 'B', executions);
    await persistActiveRun(storage, 'stopped', { updatedAt: new Date(Date.now() - GRACE_MS) });
    // The run's last write is past the grace period, but its process renewed its lease until just now.
    await store.claimRunOwnership({ runId: 'stopped', ownerId: 'other-process', leaseMs: 1, force: true });
    await sleep(5);

    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    await sleep(GRACE_MS);
    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual(['B:work']);
  });

  /**
   * A replica whose default-engine `recovered-wf` records each run it runs, and holds the `blocked` runs
   * until `release`. `started` resolves once one of them runs. `order` gets `'step-done'` once a held step
   * resumes.
   */
  function startBlockingReplica(storage: InMemoryStore, blocked: string | string[], recovery: MastraRecoveryConfig) {
    const executions: string[] = [];
    const order: string[] = [];
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
            if ([blocked].flat().includes(runId)) {
              started.resolve();
              await release.promise;
              order.push('step-done');
            }

            return {};
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { 'recovered-wf': workflow }, recovery });
    replicas.push({ mastra });
    return { mastra, executions, order, started: started.promise, release: release.resolve };
  }

  it("reads a queued restart's keys again, and leaves the run alone when another instance restarted it meanwhile", async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    // Long enough that the queued run's re-read lands inside the lapsed lease's grace on a loaded machine too.
    const graceMs = 1_500;
    const b = startBlockingReplica(storage, ['run-1', 'run-2'], { workflowGraceMs: graceMs, workflowConcurrency: 1 });
    await persistActiveRun(storage, 'run-1', { updatedAt: new Date(Date.now() - graceMs) });
    await persistActiveRun(storage, 'run-2', { updatedAt: new Date(Date.now() - graceMs) });

    // One run takes the only slot and the other waits for it. Meanwhile another instance restarts the waiting
    // run, and the lease it took lapses at once, as one whose workers lag behind would: the run is in its grace
    // period again.
    const pass = b.mastra.restartAllActiveWorkflowRuns();
    await b.started;
    const [running] = b.executions;
    const queued = running === 'run-1' ? 'run-2' : 'run-1';
    await store.claimRunOwnership({ runId: queued, ownerId: 'other-instance', leaseMs: 1, force: true });
    await sleep(5);
    b.release();
    await pass;

    expect(b.executions).toEqual([running]);
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

  it('hands out more restarts than workflowConcurrency without holding up a later call, and runs them a slot at a time', async () => {
    const storage = new InMemoryStore();
    const b = startBlockingReplica(storage, ['run-1', 'run-2'], { workflowGraceMs: 0, workflowConcurrency: 1 });
    await persistActiveRun(storage, 'run-1');
    await persistActiveRun(storage, 'run-2');
    const first = b.mastra.restartAllActiveWorkflowRuns();
    await b.started;

    // One run waits for the other's slot, and this call finds both runs already handed out.
    await b.mastra.restartAllActiveWorkflowRuns();

    expect(b.executions).toHaveLength(1);
    b.release();
    await first;
    expect([...b.executions].sort()).toEqual(['run-1', 'run-2']);
  }, 10_000);

  it('restarts runs whose rechecks come due together workflowConcurrency at a time', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const b = startBlockingReplica(storage, ['run-1', 'run-2'], { workflowGraceMs: GRACE_MS, workflowConcurrency: 1 });
    await persistActiveRun(storage, 'run-1');
    await persistActiveRun(storage, 'run-2');
    // No recheck jitter: both runs are in their grace period now, and their rechecks fire together.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const runReads = vi.spyOn(store, 'getWorkflowRunById');

    await b.mastra.restartAllActiveWorkflowRuns();
    await b.started;
    await vi.waitFor(() => {
      const read = runReads.mock.calls.map(([args]) => args.runId);
      expect(read).toEqual(expect.arrayContaining(['run-1', 'run-2']));
    });
    // Both rechecks read their run; a restart outside the limiter would start the second run right after.
    await sleep(100);

    expect(b.executions).toHaveLength(1);
    b.release();
    await vi.waitFor(() => expect([...b.executions].sort()).toEqual(['run-1', 'run-2']));
  }, 10_000);

  it('waits at shutdown for a restart the recovery pass is running', async () => {
    const storage = new InMemoryStore();
    const b = startBlockingReplica(storage, 'run-1', { workflowGraceMs: 0 });
    await persistActiveRun(storage, 'run-1');
    void b.mastra.restartAllActiveWorkflowRuns();
    await b.started;

    const shutdown = b.mastra.shutdown({ drainTimeout: 5_000 }).then(() => b.order.push('shutdown'));
    b.release();
    await shutdown;

    expect(b.order).toEqual(['step-done', 'shutdown']);
    expect(await statusOf(storage, 'run-1')).toBe('success');
  }, 10_000);

  it('resolves a background restart of an evented run that ended with a stored result to false, without publishing', async () => {
    const storage = new InMemoryStore();
    const restarts: string[] = [];
    const b = startReplica(storage, 'evented', 'B', [], {
      pubsub: interceptStarts(new EventEmitterPubSub(), { restarts }),
    });
    await b.startWorkers();
    await persistActiveRun(storage, 'finished', { status: 'success' });

    const run = await b.getWorkflow('recovered-wf').createRun({ runId: 'finished' });
    await expect(run.restartInBackground()).resolves.toBe(false);

    expect(restarts).toEqual([]);
  });

  it('checks a run again one grace period later when the read right before its restart fails', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const b = startReplica(storage, 'default', 'B', executions);
    await persistActiveRun(storage, 'stopped', { updatedAt: new Date(Date.now() - GRACE_MS) });
    // No recheck jitter, so the recheck comes one grace period after the failed read.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const read = store.getRunOwnerships.bind(store);
    vi.spyOn(store, 'getRunOwnerships')
      .mockImplementationOnce(read)
      .mockRejectedValueOnce(new Error('ownership read failed'))
      .mockImplementation(read);

    await b.restartAllActiveWorkflowRuns();

    expect(executions).toEqual([]);
    await vi.waitFor(() => expect(executions).toEqual(['B:work']), { timeout: GRACE_MS * 10 });
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
    const restarted = stubRestarts(mastra);

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
    const restarted = stubRestarts(mastra);

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
      pubsub: interceptStarts(new EventEmitterPubSub(), { restarts }),
    });
    const c = startReplica(storage, 'evented', 'C', executions, {
      recovery: { workflowGraceMs: 0 },
      pubsub: interceptStarts(new EventEmitterPubSub(), { restarts }),
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

  it('keeps one finish listener for an evented run restarted again before it finishes', async () => {
    const storage = new InMemoryStore();
    const inner = new EventEmitterPubSub();
    // The workers never get the restarts, as when a broker holds them: the run never finishes.
    const b = startReplica(storage, 'evented', 'B', [], { pubsub: interceptStarts(inner, { drop: true }) });
    await b.startWorkers();
    await persistActiveRun(storage, 'stuck');
    const subscribe = vi.spyOn(inner, 'subscribe');
    const unsubscribe = vi.spyOn(inner, 'unsubscribe');
    const finishListeners = () =>
      subscribe.mock.calls.filter(([topic]) => topic === 'workflows-finish').length -
      unsubscribe.mock.calls.filter(([topic]) => topic === 'workflows-finish').length;

    const workflow = b.getWorkflow('recovered-wf');
    expect(await (await workflow.createRun({ runId: 'stuck' })).restartInBackground()).toBe(true);
    // The liveness the first restart wrote lapses, so the run can be restarted again.
    const store = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () =>
      expect((await store.getRunOwnership({ runId: runLivenessKey('stuck') }))?.live).toBe(false),
    );
    expect(await (await workflow.createRun({ runId: 'stuck' })).restartInBackground()).toBe(true);

    expect(finishListeners()).toBe(1);
  });

  it('does not keep shutdown waiting for a restarted evented run', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const workflow = createEventedWorkflow({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
      .then(reportingStep('evented', 'B', 'work', executions))
      .sleep(60_000)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { 'recovered-wf': workflow },
      recovery: { workflowGraceMs: 0 },
    });
    await mastra.startWorkers();
    await persistActiveRun(storage, 'stopped');

    await mastra.restartAllActiveWorkflowRuns();
    // The run sleeps for a minute after its first step.
    await vi.waitFor(() => expect(executions).toEqual(['B:work']));

    const startedAt = Date.now();
    await mastra.shutdown({ drainTimeout: 5_000 });
    expect(Date.now() - startedAt).toBeLessThan(2_500);
  }, 15_000);

  it('settles an evented run it restarted once the run finishes: onFinish once, its span ended, the run dropped', async () => {
    const storage = new InMemoryStore();
    const onFinish = vi.fn();
    const observability = new NoOpObservability();
    const runSpanEnds: { attributes?: { status?: string }; output?: unknown }[] = [];
    vi.spyOn(observability, 'getSelectedInstance').mockReturnValue({
      startSpan: (options: { type: SpanType }) => recordingSpan(options, runSpanEnds),
    } as any);
    const workflow = createEventedWorkflow({
      id: 'recovered-wf',
      inputSchema: schema,
      outputSchema: schema,
      options: { onFinish },
    })
      .then(reportingStep('evented', 'B', 'work', []))
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      observability,
      workflows: { 'recovered-wf': workflow },
      recovery: { workflowGraceMs: 0 },
    });
    replicas.push({ mastra });
    await mastra.startWorkers();
    await persistActiveRun(storage, 'stopped');

    await mastra.restartAllActiveWorkflowRuns();

    await vi.waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', runId: 'stopped' })),
    );
    await vi.waitFor(() => expect(workflow.runs.has('stopped')).toBe(false));
    await vi.waitFor(() =>
      expect(runSpanEnds).toContainEqual(expect.objectContaining({ attributes: { status: 'success' } })),
    );
    expect(runSpanEnds).not.toContainEqual(expect.objectContaining({ attributes: { status: 'running' } }));
    await mastra.shutdown();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('settles an evented run it restarted as failed, and drops it from the workflow, when its finish fails to publish', async () => {
    const storage = new InMemoryStore();
    const inner = new EventEmitterPubSub();
    // The workers never get the restart, so the only finish is the failed publish below.
    const b = startReplica(storage, 'evented', 'B', [], { pubsub: interceptStarts(inner, { drop: true }) });
    await b.startWorkers();
    await persistActiveRun(storage, 'stuck');
    const workflow = b.getWorkflow('recovered-wf');
    const run = await workflow.createRun({ runId: 'stuck' });

    expect(await run.restartInBackground()).toBe(true);
    // What a worker publishes when the run's result is too large for the broker.
    await inner.publish('workflows-finish', {
      type: 'workflow.publish-failed',
      runId: 'stuck',
      data: { message: 'result too large', workflowId: 'recovered-wf', runId: 'stuck' },
    } as Event);

    await vi.waitFor(() => expect(workflow.runs.has('stuck')).toBe(false));
    expect(run.workflowRunStatus).toBe('failed');
  });

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
