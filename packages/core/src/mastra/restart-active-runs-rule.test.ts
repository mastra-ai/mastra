/**
 * The workflow recovery rule (#28712): a default-engine run is restarted once
 * no process holds its run lease and a grace period passed since it or its
 * lease last changed. Evented runs on a broker that redelivers unacked
 * messages are left to the broker. Replicas are Mastra instances sharing one
 * store, the way pods share one database. Leases use a short TTL here, read
 * when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { persistActiveRun, sleep } from './test-utils/active-runs';
import { sharedBroker } from './test-utils/shared-broker';
import { Mastra } from './index';
import type { MastraRecoveryConfig } from './index';

const GRACE_MS = 300;

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

const schema = z.object({});

/** A replica whose one-step `recovered-wf` runs on `engine` and records `<replica>:work` per execution. */
function startReplica(
  storage: InMemoryStore,
  engine: 'default' | 'evented',
  name: string,
  executions: string[],
  {
    recovery = { workflowGraceMs: GRACE_MS },
    pubsub,
    scheduled = false,
  }: { recovery?: MastraRecoveryConfig; pubsub?: PubSub; scheduled?: boolean } = {},
) {
  const create = (engine === 'evented' ? createEventedWorkflow : createWorkflow) as typeof createWorkflow;
  const step = (engine === 'evented' ? createEventedStep : createStep) as typeof createStep;
  const workflow = create({
    id: 'recovered-wf',
    inputSchema: schema,
    outputSchema: schema,
    // Once a year, so the scheduler never fires during a test.
    ...(scheduled ? { schedule: { cron: '0 0 1 1 *' } } : {}),
  })
    .then(
      step({
        id: 'work',
        inputSchema: schema,
        outputSchema: schema,
        execute: async () => {
          executions.push(`${name}:work`);
          return {};
        },
      }),
    )
    .commit();
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { 'recovered-wf': workflow }, recovery });
  replicas.push(mastra);
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

/** The stored status of `runId` under `workflowName`. */
async function statusOf(storage: InMemoryStore, runId: string, workflowName = 'recovered-wf') {
  return (await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({ workflowName, runId }))?.status;
}

describe('workflow recovery rule (#28712)', () => {
  it('leaves a stopped default-engine run alone during its grace period and restarts it once the grace period passed', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', 'B', executions);

    // The run's last write is just now, and no process holds its lease.
    await persistActiveRun(storage, 'stopped');
    const restarts = vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun');
    await mastra.restartAllActiveWorkflowRuns();
    expect(restarts).not.toHaveBeenCalled();

    // The same run once its last write is a grace period old.
    await persistActiveRun(storage, 'stopped', { updatedAt: new Date(Date.now() - GRACE_MS) });
    await mastra.restartAllActiveWorkflowRuns();
    expect(executions).toEqual(['B:work']);
  });

  // Each evented run here was written just now and nothing holds it, so a default-engine run in its place would
  // still be in its grace period.
  it.each([
    {
      name: 'leaves an evented run to a broker that redelivers unacked messages, without listing its workflow',
      pubsub: () => sharedBroker({ redeliversUnacked: true }).connect(),
      scheduled: false,
      runId: 'stopped',
      restarted: false,
    },
    {
      name: 'leaves an unscheduled run of a scheduled evented workflow to a redelivering broker',
      pubsub: () => sharedBroker({ redeliversUnacked: true }).connect(),
      scheduled: true,
      runId: 'stopped',
      restarted: false,
    },
    {
      // The `mastra.pubsub` proxy keeps a scheduled run's events in the process, so the broker never held them.
      name: 'restarts a scheduled evented run on a redelivering broker at once',
      pubsub: () => sharedBroker({ redeliversUnacked: true }).connect(),
      scheduled: true,
      runId: 'sched_wf_recovered-wf_1700000000000',
      restarted: true,
    },
    {
      name: 'restarts an evented run on a broker that does not redeliver at once',
      pubsub: () => sharedBroker().connect(),
      scheduled: false,
      runId: 'stopped',
      restarted: true,
    },
    {
      name: 'restarts an evented run on the in-process pubsub at once',
      pubsub: () => new EventEmitterPubSub(),
      scheduled: false,
      runId: 'stopped',
      restarted: true,
    },
  ])('$name', async ({ pubsub, scheduled, runId, restarted }) => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const mastra = startReplica(storage, 'evented', 'B', executions, {
      // A minute, so a run restarted here can't have been due under the grace rule.
      recovery: { workflowGraceMs: 60_000 },
      pubsub: pubsub(),
      scheduled,
    });
    await mastra.startWorkers();
    await persistActiveRun(storage, runId);
    const listings = vi.spyOn(store, 'listWorkflowRuns');
    const leaseReads = vi.spyOn(store, 'getRunOwnerships');
    const snapshotReads = vi.spyOn(store, 'getWorkflowRunById');

    await mastra.restartAllActiveWorkflowRuns();

    if (restarted) {
      expect(executions).toEqual(['B:work']);
      expect(await statusOf(storage, runId)).toBe('success');
    } else {
      expect(executions).toEqual([]);
      expect(await statusOf(storage, runId)).toBe('running');
      expect(snapshotReads).not.toHaveBeenCalled();
    }

    // An evented run holds no run lease to read.
    expect(leaseReads).not.toHaveBeenCalled();
    const listed = listings.mock.calls.some(([args]) => args?.workflowName === 'recovered-wf');
    expect(listed).toBe(restarted || scheduled);
  });

  it('anchors the grace period on the last expiry of a lapsed run lease when it is later than the run', async () => {
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
    // `start:<runId>` and `done:<runId>` per step execution, in the order they happened.
    const steps: string[] = [];
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
            steps.push(`start:${runId}`);
            if ([blocked].flat().includes(runId)) {
              started.resolve();
              await release.promise;
              order.push('step-done');
            }

            steps.push(`done:${runId}`);
            return {};
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { 'recovered-wf': workflow }, recovery });
    replicas.push(mastra);
    return { mastra, executions, order, steps, started: started.promise, release: release.resolve };
  }

  it("reads a queued restart's lease again, and leaves the run alone when another instance restarted it meanwhile", async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    // Long enough that the queued run's re-read lands inside the lapsed lease's grace on a loaded machine too.
    const graceMs = 1_500;
    const b = startBlockingReplica(storage, ['run-1', 'run-2'], { workflowGraceMs: graceMs, workflowConcurrency: 1 });
    await persistActiveRun(storage, 'run-1', { updatedAt: new Date(Date.now() - graceMs) });
    await persistActiveRun(storage, 'run-2', { updatedAt: new Date(Date.now() - graceMs) });

    // One run takes the only slot and the other waits for it. Meanwhile another instance restarts the waiting
    // run, and the lease it took lapses at once, as one whose process died would: the run is in its grace
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

  it('lets a later call list the runs again while an earlier call still waits for its restarts', async () => {
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

  it("restarts a run from the recovery loop's next pass when the read right before its restart fails", async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const b = startReplica(storage, 'default', 'B', executions, {
      recovery: { workflowGraceMs: 0, workflowScanIntervalMs: 100 },
    });
    await persistActiveRun(storage, 'stopped');
    const read = store.getRunOwnerships.bind(store);
    vi.spyOn(store, 'getRunOwnerships')
      .mockImplementationOnce(read)
      .mockRejectedValueOnce(new Error('ownership read failed'))
      .mockImplementation(read);

    await b.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    await b.startWorkers();
    await vi.waitFor(() => expect(executions).toEqual(['B:work']));
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
});
