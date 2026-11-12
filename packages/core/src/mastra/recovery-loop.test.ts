/**
 * The workflow recovery loop `startWorkers()` starts (#28712): it applies the
 * recovery rule at boot and then on a timer, so a run whose process stopped is
 * restarted without another instance booting. Replicas are Mastra instances
 * sharing one store, the way pods share one database. Leases use a short TTL
 * here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { InMemoryStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { MastraWorker } from '../worker';
import { createStep, createWorkflow } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { runLivenessKey, runWakeKey } from '../workflows/evented/leases';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../workflows/run-ownership';
import { killableProcess } from './test-utils/killable-process';
import { Mastra } from './index';
import type { MastraRecoveryConfig } from './index';

const GRACE_MS = 300;
// Short enough for a test to see several passes.
const scanning = { workflowScanIntervalMs: 100 };

const replicas: { mastra: Mastra; revive?: () => void }[] = [];
afterEach(async () => {
  vi.useRealTimers();
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
/**
 * Settles once the promise callbacks queued so far, and the ones they queue, ran. A pass on the
 * in-memory store goes from a listing to its restarts within them.
 */
const drained = () => new Promise(resolve => setImmediate(resolve));

/** The one-step `recovered-wf` on `engine`, whose step records `<replica>:work` and then runs `then`. */
function oneStep(engine: 'default' | 'evented', replica: string, executions: string[], then?: () => Promise<void>) {
  const create = (engine === 'evented' ? createEventedWorkflow : createWorkflow) as typeof createWorkflow;
  const step = (engine === 'evented' ? createEventedStep : createStep) as typeof createStep;
  return create({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
    .then(
      step({
        id: 'work',
        inputSchema: schema,
        outputSchema: schema,
        execute: async () => {
          executions.push(`${replica}:work`);
          await then?.();
          return {};
        },
      }),
    )
    .commit();
}

/** A replica running `recovered-wf` on `engine`, not started yet. */
function replica(
  storage: InMemoryStore,
  engine: 'default' | 'evented',
  name: string,
  executions: string[],
  recovery: MastraRecoveryConfig = { workflowGraceMs: GRACE_MS },
) {
  const mastra = new Mastra({
    logger: false,
    storage,
    recovery,
    workflows: { 'recovered-wf': oneStep(engine, name, executions) },
  });
  replicas.push({ mastra });
  return mastra;
}

/** Stores a `running` run of `workflowName`, as a process that stopped mid-run leaves it. */
async function persistActiveRun(
  storage: InMemoryStore,
  runId: string,
  { workflowName = 'recovered-wf', parentRunId }: { workflowName?: string; parentRunId?: string } = {},
) {
  await (await storage.getStore('workflows'))!.persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot: {
      ...createEmptyWorkflowSnapshot(runId),
      status: 'running',
      activePaths: [],
      context: { input: {} } as any,
      ...(parentRunId ? { parentWorkflow: { workflowId: 'parent-wf', runId: parentRunId } } : {}),
    } as any,
  });
}

/** The stored status of `runId`. */
async function statusOf(storage: InMemoryStore, runId: string) {
  return (await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({ workflowName: 'recovered-wf', runId }))
    ?.status;
}

/** How many times `listWorkflowRuns` was called for `recovered-wf`; a pass lists its running and its waiting runs. */
function listingsOf(listings: { mock: { calls: unknown[][] } }) {
  return listings.mock.calls.filter(([args]) => (args as { workflowName?: string })?.workflowName === 'recovered-wf')
    .length;
}

/**
 * Holds every `listWorkflowRuns` call of `store` until `release()`. `listing` settles at the first
 * call, `listed` once one of them returned.
 */
function gateListings(store: WorkflowsStorage) {
  const list = store.listWorkflowRuns.bind(store);
  const listing = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const listed = Promise.withResolvers<void>();
  vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async args => {
    listing.resolve();
    await release.promise;
    const runs = await list(args);
    listed.resolve();
    return runs;
  });
  return { listing: listing.promise, listed: listed.promise, release: () => release.resolve() };
}

describe('workflow recovery loop (#28712)', () => {
  it("restarts the stored runs the recovery rule picks from a running instance's tick", async () => {
    const graceMs = 1_000;
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const claim = (runId: string, leaseMs: number) =>
      store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs, force: true });
    const workflows = {
      'recovered-wf': oneStep('default', 'X', []),
      'child-wf': createWorkflow({ id: 'child-wf', inputSchema: schema, outputSchema: schema }).commit(),
      'parent-wf': createWorkflow({ id: 'parent-wf', inputSchema: schema, outputSchema: schema }).commit(),
      'sleeping-wf': createEventedWorkflow({ id: 'sleeping-wf', inputSchema: schema, outputSchema: schema })
        .sleep(60_000)
        .commit(),
    };
    const mastra = new Mastra({
      logger: false,
      storage,
      recovery: { workflowGraceMs: graceMs, ...scanning },
      workflows,
    });
    replicas.push({ mastra });
    // Restarts record the run instead of running it.
    const restarted = new Set<string>();
    for (const workflow of Object.values(workflows)) {
      vi.spyOn(workflow, 'createRun').mockImplementation(async ({ runId } = {}) => {
        restarted.add(runId!);
        return { restart: async () => {} } as any;
      });
    }
    const listings = vi.spyOn(store, 'listWorkflowRuns');

    // The instance's workers, and its loop, were running before any of the runs were stored.
    await mastra.startWorkers();
    // Written longer ago than the grace period.
    for (const runId of ['live', 'expired-past-grace', 'expired-by-shutdown', 'missing-key']) {
      await persistActiveRun(storage, runId);
    }
    await persistActiveRun(storage, 'parent', { workflowName: 'parent-wf' });
    await persistActiveRun(storage, 'nested-under-active-parent', { workflowName: 'child-wf', parentRunId: 'parent' });
    // Evented runs in a sleep, whose liveness lapsed when they stopped handling events.
    for (const runId of ['sleep-not-due', 'sleep-overdue']) {
      await persistActiveRun(storage, runId, { workflowName: 'sleeping-wf' });
      await claim(runLivenessKey(runId), -2 * graceMs);
    }
    await claim(runWakeKey('sleep-not-due'), 60_000);
    await claim(runWakeKey('sleep-overdue'), -2 * graceMs);
    await claim('live', 60_000);
    await claim('parent', 60_000);
    await claim('expired-past-grace', -2 * graceMs);
    const { record } = await claim('expired-by-shutdown', 60_000);
    await sleep(graceMs + 100);
    // A process that shut down just now expired its lease then.
    await store.renewRunOwnership({ ...record!, leaseMs: 1 });
    // Written just now, with no lease at all.
    await persistActiveRun(storage, 'in-grace');

    // Three more passes, all before the runs written last come out of their grace period.
    const seen = listingsOf(listings);
    await vi.waitFor(() => expect(listingsOf(listings)).toBeGreaterThanOrEqual(seen + 6));

    expect([...restarted].sort()).toEqual(['expired-past-grace', 'missing-key', 'sleep-overdue']);
  }, 15_000);

  it('restarts a run whose instance crashed mid-step once its liveness lapsed and the grace period passed, though no instance boots', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const intervalMs = 500;
    // B runs all along: its loop is on before A starts the run.
    const onB = replica(storage, 'evented', 'B', executions, {
      workflowGraceMs: GRACE_MS,
      workflowScanIntervalMs: intervalMs,
    });
    await onB.startWorkers();

    const a = killableProcess({ storage, pubsub: new EventEmitterPubSub() });
    const onA = new Mastra({
      logger: false,
      storage: a.storage,
      pubsub: a.pubsub,
      workflows: { 'recovered-wf': oneStep('evented', 'A', executions, () => new Promise<never>(() => {})) },
    });
    replicas.push({ mastra: onA, revive: a.revive });
    await onA.startWorkers();
    const run = await onA.getWorkflow('recovered-wf').createRun();
    await run.startAsync({ inputData: {} });
    await vi.waitFor(() => expect(executions).toEqual(['A:work']));

    a.kill();
    const killedAt = Date.now();
    await vi.waitFor(() => expect(executions).toEqual(['A:work', 'B:work']), { timeout: 6_000, interval: 10 });
    const restartedAfter = Date.now() - killedAt;

    // A renewed the run's liveness at least every third of a lease TTL, so its key outlived the
    // crash by two thirds of one at least. The first of B's passes to see the key lapsed moves the
    // next one to the end of the grace period, waiting at least a second and up to a fifth more.
    // The last 500 ms leave room for the restarted step to start.
    expect(restartedAfter).toBeGreaterThanOrEqual((WORKFLOW_RUN_LEASE_TTL_MS * 2) / 3 + GRACE_MS);
    expect(restartedAfter).toBeLessThan(WORKFLOW_RUN_LEASE_TTL_MS + intervalMs * 1.2 + 1_200 + 500);
    await vi.waitFor(async () => expect(await statusOf(storage, run.runId)).toBe('success'));
  }, 15_000);

  it('restarts a run its instance left behind at shutdown about a grace period later, from the next instance to boot', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const a = killableProcess({ storage, pubsub: new EventEmitterPubSub() });
    const onA = new Mastra({
      logger: false,
      storage: a.storage,
      pubsub: a.pubsub,
      workflows: { 'recovered-wf': oneStep('evented', 'A', executions, () => new Promise<never>(() => {})) },
    });
    replicas.push({ mastra: onA, revive: a.revive });
    await onA.startWorkers();
    const run = await onA.getWorkflow('recovered-wf').createRun();
    await run.startAsync({ inputData: {} });
    await vi.waitFor(() => expect(executions).toEqual(['A:work']));

    // A shuts down giving up on the step, as a reload does, and its process exits. The default grace
    // with the in-process pubsub is 2 s, counted from when the shutdown expired A's keys.
    const shuttingDownAt = Date.now();
    await onA.shutdown({ drainTimeout: 0 });
    a.kill();
    const shutDownAt = Date.now();
    // The shutdown leaves the key live for another millisecond. A new process boots far later than
    // that; a pass that still saw the key live would come back only a scan interval later.
    const store = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () =>
      expect((await store.getRunOwnership({ runId: runLivenessKey(run.runId) }))?.live).toBe(false),
    );
    const onB = new Mastra({
      logger: false,
      storage,
      workflows: { 'recovered-wf': oneStep('evented', 'B', executions) },
    });
    replicas.push({ mastra: onB });
    await onB.startWorkers();
    await onB.restartAllActiveWorkflowRuns();
    expect(executions).toEqual(['A:work']);

    await vi.waitFor(async () => expect(await statusOf(storage, run.runId)).toBe('success'), {
      timeout: 5_000,
      interval: 50,
    });
    expect(Date.now() - shuttingDownAt).toBeGreaterThanOrEqual(2_000);
    expect(Date.now() - shutDownAt).toBeLessThan(4_000);
    expect(executions).toEqual(['A:work', 'B:work']);
  }, 15_000);

  const scanIntervalMs = 123_456;
  it.each([
    // Up to a fifth earlier or later than the interval.
    ['no run', { stored: false }, 0, scanIntervalMs * 1.196],
    // A live run's keys are renewed while it runs, so its lease expiry says nothing about when it stops.
    ['a run that is live', { leaseMs: 300 }, 0, scanIntervalMs * 1.196],
    // Up to a fifth after the run comes out of its grace period, so instances that saw it don't check at once.
    ['a run in its grace period', {}, 1_500, 1_500 * 1.198],
    // No sooner than a second out.
    ['a run whose grace period ends within a second', {}, 600, 1_000 * 1.198],
  ])(
    'schedules the next pass after a pass that saw %s, on a timer that does not keep the process alive',
    async (_, run, workflowGraceMs, expectedDelay) => {
      const { stored = true, leaseMs }: { stored?: boolean; leaseMs?: number } = run;
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const mastra = replica(storage, 'default', 'B', [], { workflowGraceMs, workflowScanIntervalMs: scanIntervalMs });
      if (stored) {
        await persistActiveRun(storage, 'run');
      }
      if (leaseMs) {
        await store.claimRunOwnership({ runId: 'run', ownerId: 'other-process', leaseMs });
      }
      const timers: { delay: number; timer: ReturnType<typeof setTimeout> }[] = [];
      const setTimer = globalThis.setTimeout;
      vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
        const timer = setTimer(callback, delay);
        timers.push({ delay: delay ?? 0, timer });
        return timer;
      }) as typeof setTimeout);
      // The latest each wait can be.
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      await mastra.startWorkers();
      await mastra.restartAllActiveWorkflowRuns();

      // The run's due time is counted from when it was stored, a few milliseconds before the pass.
      const next = () => timers.find(({ delay }) => delay > expectedDelay - 100 && delay < expectedDelay + 1);
      await vi.waitFor(() => expect(next()).toBeDefined());
      expect(next()!.timer.hasRef()).toBe(false);
    },
  );

  it.each([
    ['stopWorkers()', (mastra: Mastra) => mastra.stopWorkers({ drainTimeout: 0 })],
    ['shutdown()', (mastra: Mastra) => mastra.shutdown({ drainTimeout: 0 })],
  ])('checks storage no more after %s', async (_, stop) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = replica(storage, 'default', 'B', [], scanning);
    const listings = vi.spyOn(store, 'listWorkflowRuns');
    await mastra.startWorkers();
    await vi.waitFor(() => expect(listingsOf(listings)).toBeGreaterThanOrEqual(6));

    await stop(mastra);
    // A pass already running may still list.
    await drained();
    const listed = listingsOf(listings);
    await vi.advanceTimersByTimeAsync(scanning.workflowScanIntervalMs * 10);

    expect(listingsOf(listings)).toBe(listed);
  });

  it.each([
    // Only the stop keeps the pass, which got the stopped run back from the store, from restarting it.
    ['restarts nothing more from it', false, 0],
    // The new workers' loop runs a boot pass of its own instead of joining the stopped one.
    ['the workers started again restart the run from a boot pass of their own', true, 1],
  ])('once stopWorkers() stops a pass in flight, %s', async (_, startAgain, restarts) => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    // The default scan interval: only a boot pass restarts the run within the test.
    const mastra = replica(storage, 'default', 'B', [], { workflowGraceMs: 0 });
    const restarted = vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun');
    await persistActiveRun(storage, 'stopped');
    const gate = gateListings(store);
    await mastra.startWorkers();
    await gate.listing;

    await mastra.stopWorkers({ drainTimeout: 0 });
    if (startAgain) {
      await mastra.startWorkers();
    }
    gate.release();

    if (restarts > 0) {
      await vi.waitFor(() => expect(restarted).toHaveBeenCalled());
    } else {
      await gate.listed;
      await drained();
    }
    expect(restarted).toHaveBeenCalledTimes(restarts);
  });

  it('runs the loop on an instance that starts only its orchestration worker', async () => {
    /** Stands in for the orchestration worker of a pull-mode pubsub, which the in-process one has none of. */
    class OrchestrationWorker extends MastraWorker {
      readonly name = 'orchestration';
      #running = false;
      async start() {
        this.#running = true;
      }
      async stop() {
        this.#running = false;
      }
      get isRunning() {
        return this.#running;
      }
    }
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = new Mastra({
      logger: false,
      storage,
      recovery: scanning,
      workers: [new OrchestrationWorker()],
      workflows: { 'recovered-wf': oneStep('default', 'B', []) },
    });
    replicas.push({ mastra });
    const listings = vi.spyOn(store, 'listWorkflowRuns');

    await mastra.startWorkers('orchestration');

    await vi.waitFor(() => expect(listingsOf(listings)).toBeGreaterThan(0));
  });

  it('starts no loop from a startWorkers() call that stopWorkers() overtook', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const init = storage.init.bind(storage);
    const initializing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    vi.spyOn(storage, 'init').mockImplementation(async () => {
      initializing.resolve();
      await release.promise;
      return init();
    });
    const mastra = replica(storage, 'default', 'B', [], scanning);
    const listings = vi.spyOn(store, 'listWorkflowRuns');

    const starting = mastra.startWorkers();
    await initializing.promise;
    await mastra.stopWorkers({ drainTimeout: 0 });
    release.resolve();
    await starting;
    // A loop's first pass would list at once.
    await drained();

    expect(listings).not.toHaveBeenCalled();
  });

  it('waits on shutdown for a pass in flight', async () => {
    const storage = new InMemoryStore();
    const mastra = replica(storage, 'default', 'B', []);
    const gate = gateListings((await storage.getStore('workflows'))!);
    const order: string[] = [];
    void gate.listed.then(() => order.push('listed'));
    await mastra.startWorkers();
    await gate.listing;

    const shutdown = mastra.shutdown({ drainTimeout: 5_000 }).then(() => order.push('shut down'));
    // Later than a shutdown with nothing to wait for takes.
    setTimeout(gate.release, 200);
    await shutdown;

    expect(order).toEqual(['listed', 'shut down']);
  });

  it.each(['listing the runs', 'opening the workflows store'])(
    'keeps checking after passes whose store failed %s',
    async failing => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const executions: string[] = [];
      const mastra = replica(storage, 'default', 'B', executions, { workflowGraceMs: 0, ...scanning });
      await persistActiveRun(storage, 'stopped');
      let failures = 0;
      const failThrice = async <T>(answer: () => Promise<T>) => {
        if (failures < 3) {
          failures++;
          throw new Error('connection reset');
        }

        return answer();
      };
      if (failing === 'listing the runs') {
        const list = store.listWorkflowRuns.bind(store);
        vi.spyOn(store, 'listWorkflowRuns').mockImplementation(args => failThrice(() => list(args)));
      } else {
        const getStore = storage.getStore.bind(storage);
        vi.spyOn(storage, 'getStore').mockImplementation(((domain: string) =>
          domain === 'workflows' ? failThrice(() => getStore(domain as 'workflows')) : getStore(domain as any)) as any);
      }

      await mastra.startWorkers();

      await vi.waitFor(() => expect(executions).toEqual(['B:work']));
      expect(failures).toBe(3);
    },
  );

  it('keeps checking, and leaves a live run alone, on the passes that failed to probe the store for run fencing', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = replica(storage, 'default', 'B', [], { workflowGraceMs: 0, ...scanning });
    const restarted = vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun');
    await persistActiveRun(storage, 'live');
    await store.claimRunOwnership({ runId: 'live', ownerId: 'other-process', leaseMs: 60_000 });
    const probe = store.supportsRunFencing.bind(store);
    let probes = 0;
    vi.spyOn(store, 'supportsRunFencing').mockImplementation(async () => {
      probes++;
      // The boot pass and a later one.
      if (probes === 1 || probes === 3) {
        throw new Error('connection reset');
      }

      return probe();
    });

    await mastra.startWorkers();
    await vi.waitFor(() => expect(probes).toBeGreaterThan(4));

    expect(restarted).not.toHaveBeenCalled();
  });

  it.each([
    // Nothing tells the run from one another instance still drives.
    ['the store has no run fencing', { workflowGraceMs: 0, ...scanning }],
    ["recovery.workflows is 'off'", { workflows: 'off', workflowGraceMs: 0, ...scanning }],
  ] as const)('lists no runs from the loop when %s', async (_, recovery) => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const probed = Promise.withResolvers<void>();
    // With recovery off the loop never starts, so nothing probes; a probe that answered would let it list.
    const off = recovery.workflows === 'off';
    vi.spyOn(store, 'supportsRunFencing').mockImplementation(async () => {
      probed.resolve();
      return off;
    });
    const listings = vi.spyOn(store, 'listWorkflowRuns');
    const mastra = replica(storage, 'default', 'B', executions, recovery);
    await persistActiveRun(storage, 'stopped');

    await mastra.startWorkers();
    if (!off) {
      await probed.promise;
    }
    // A pass lists right after its probe; a loop's first pass would list at once.
    await drained();

    expect(listingsOf(listings)).toBe(0);
    expect(executions).toEqual([]);
  });

  it('restarts every active run from a restartAllActiveWorkflowRuns() call that joins the loop pass on a store without run fencing', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const probing = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<void>();
    vi.spyOn(store, 'supportsRunFencing').mockImplementation(async () => {
      probing.resolve();
      await answer.promise;
      return false;
    });
    const mastra = replica(storage, 'default', 'B', executions, { workflowGraceMs: 0, ...scanning });
    await persistActiveRun(storage, 'stopped');
    await mastra.startWorkers();
    await probing.promise;

    // Joins the loop's pass, which leaves the run alone; the call restarts it in a pass of its own.
    const call = mastra.restartAllActiveWorkflowRuns();
    answer.resolve();
    await call;

    expect(executions).toEqual(['B:work']);
  });
});
