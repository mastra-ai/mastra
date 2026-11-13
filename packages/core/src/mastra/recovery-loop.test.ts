/**
 * The workflow recovery loop `startWorkers()` starts (#28712): one instance at
 * a time, the recovery leader, applies the recovery rule to default-engine runs
 * at boot and then on a timer, so a run whose process stopped is restarted
 * without another instance booting. Replicas are Mastra instances sharing one
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
import type { MastraCompositeStore } from '../storage/base';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { InMemoryStore } from '../storage/mock';
import { MastraWorker } from '../worker';
import { createStep, createWorkflow } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../workflows/run-ownership';
import { persistActiveRun } from './test-utils/active-runs';
import { killableProcess } from './test-utils/killable-process';
import { Mastra } from './index';
import type { MastraRecoveryConfig } from './index';

const GRACE_MS = 300;
// Short enough for a test to see several passes.
const scanning = { workflowScanIntervalMs: 100 };
// The run-owners row whose holder runs the passes.
const LEADER = '::recovery-leader';

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
/**
 * Settles once the promise callbacks queued so far, and the ones they queue, ran. A pass on the
 * in-memory store goes from a listing to its restarts within them.
 */
const drained = () => new Promise(resolve => setImmediate(resolve));

/** The one-step default-engine `recovered-wf`, whose step records `<replica>:work` and then runs `then`. */
function oneStep(replica: string, executions: string[], then?: () => Promise<void>) {
  return createWorkflow({ id: 'recovered-wf', inputSchema: schema, outputSchema: schema })
    .then(
      createStep({
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

/**
 * `storage` as one instance sees it, counting the listings of `recovered-wf` this instance makes;
 * a pass lists its running and its waiting runs.
 */
function countingListings(storage: MastraCompositeStore) {
  let listings = 0;
  const counted = new Map<object, WorkflowsStorage>();
  const instanceStorage = new Proxy(storage, {
    get(object, prop) {
      if (prop === 'getStore') {
        return async (name: string) => {
          const domain = await object.getStore(name as never);
          if (name !== 'workflows' || !domain) {
            return domain;
          }

          if (!counted.has(domain)) {
            counted.set(
              domain,
              new Proxy(domain as WorkflowsStorage, {
                get(store, method) {
                  const value = Reflect.get(store, method, store);
                  if (method === 'listWorkflowRuns') {
                    return (args: { workflowName?: string }) => {
                      if (args?.workflowName === 'recovered-wf') {
                        listings++;
                      }

                      return value.call(store, args);
                    };
                  }

                  return typeof value === 'function' ? value.bind(store) : value;
                },
              }),
            );
          }

          return counted.get(domain);
        };
      }

      const value = Reflect.get(object, prop, object);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });
  return { storage: instanceStorage, listings: () => listings };
}

/** A replica running `recovered-wf`, not started yet, with the count of its own listings. */
function replica(
  storage: MastraCompositeStore,
  name: string,
  executions: string[],
  recovery: MastraRecoveryConfig = { workflowGraceMs: GRACE_MS },
  {
    pubsub,
    then,
    revive,
    workflows = {},
  }: { pubsub?: PubSub; then?: () => Promise<void>; revive?: () => void; workflows?: Record<string, any> } = {},
) {
  const counting = countingListings(storage);
  const mastra = new Mastra({
    logger: false,
    storage: counting.storage,
    pubsub,
    recovery,
    workflows: { 'recovered-wf': oneStep(name, executions, then), ...workflows },
  });
  replicas.push({ mastra, revive });
  return { mastra, listings: counting.listings };
}

/** Replaces the restarts of `mastra`'s `workflowId` with no-ops, and returns the IDs of the runs it restarts. */
function stubRestarts(mastra: Mastra, workflowId = 'recovered-wf'): string[] {
  const restarted: string[] = [];
  vi.spyOn(mastra.getWorkflow(workflowId), 'createRun').mockImplementation(async ({ runId } = {}) => {
    restarted.push(runId!);
    return { restart: async () => {} } as any;
  });
  return restarted;
}

/** The stored status of `runId`. */
async function statusOf(storage: InMemoryStore, runId: string) {
  return (await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({ workflowName: 'recovered-wf', runId }))
    ?.status;
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
  it('restarts a run whose instance crashed mid-step, though no instance boots, once the leases of the run and of the crashed leader lapsed and the grace period passed', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const recovery = { workflowGraceMs: GRACE_MS, workflowScanIntervalMs: 500 };
    const a = killableProcess({ storage, pubsub: new EventEmitterPubSub() });
    const onA = replica(a.storage, 'A', executions, recovery, {
      pubsub: a.pubsub,
      then: () => new Promise<never>(() => {}),
      revive: a.revive,
    });
    const onB = replica(storage, 'B', executions, recovery);
    // A leads; B runs all along, and its ticks only try to take A's place.
    await onA.mastra.startWorkers();
    await vi.waitFor(() => expect(onA.listings()).toBeGreaterThan(0));
    await onB.mastra.startWorkers();
    const run = await onA.mastra.getWorkflow('recovered-wf').createRun();
    void run.start({ inputData: {} });
    await vi.waitFor(() => expect(executions).toEqual(['A:work']));
    expect(onB.listings()).toBe(0);

    a.kill();
    const killedAt = Date.now();
    await vi.waitFor(() => expect(executions).toEqual(['A:work', 'B:work']), { timeout: 6_000, interval: 10 });
    const restartedAfter = Date.now() - killedAt;

    // A renewed both leases at least every third of a lease TTL, so they outlived the crash by two thirds
    // of one at least. B's first tick after the leader's lease lapsed takes the row; its pass can still
    // find the run's lease live, and the next one moves the pass after it to the end of the grace period,
    // waiting at least a second and up to a fifth more. The last 500 ms leave room for the step to start.
    expect(restartedAfter).toBeGreaterThanOrEqual((WORKFLOW_RUN_LEASE_TTL_MS * 2) / 3 + GRACE_MS);
    expect(restartedAfter).toBeLessThan(WORKFLOW_RUN_LEASE_TTL_MS + 2 * 500 * 1.2 + 1_200 + 500);
    await vi.waitFor(async () => expect(await statusOf(storage, run.runId)).toBe('success'));
  }, 15_000);

  it('runs the passes of instances that start together on one of them, which keeps the row while passes are further apart than its lease', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    // Longer than the lease TTL: a row held only during passes would lapse between them.
    const recovery = { workflowScanIntervalMs: WORKFLOW_RUN_LEASE_TTL_MS * 2 };
    const a = replica(storage, 'A', [], recovery);
    const b = replica(storage, 'B', [], recovery);

    await Promise.all([a.mastra.startWorkers(), b.mastra.startWorkers()]);
    await vi.waitFor(() => expect(a.listings() + b.listings()).toBeGreaterThan(0));
    const leader = await store.getRunOwnership({ runId: LEADER });
    // Three passes.
    await vi.waitFor(() => expect(a.listings() + b.listings()).toBeGreaterThanOrEqual(6), { timeout: 10_000 });

    expect(Math.min(a.listings(), b.listings())).toBe(0);
    expect(await store.getRunOwnership({ runId: LEADER })).toMatchObject({
      ownerId: leader!.ownerId,
      generation: leader!.generation,
      live: true,
    });
  }, 15_000);

  it("hands the leader row to another instance once the leader's stopWorkers() releases it", async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const a = replica(storage, 'A', [], scanning);
    const b = replica(storage, 'B', [], scanning);
    await a.mastra.startWorkers();
    await vi.waitFor(() => expect(a.listings()).toBeGreaterThan(0));
    const claims = vi.spyOn(store, 'claimRunOwnership');
    await b.mastra.startWorkers();
    // B's ticks were refused twice: it follows.
    await vi.waitFor(() =>
      expect(claims.mock.calls.filter(([args]) => args.runId === LEADER).length).toBeGreaterThanOrEqual(2),
    );
    const held = await store.getRunOwnership({ runId: LEADER });

    await a.mastra.stopWorkers({ drainTimeout: 0 });

    // Released, not left to lapse a lease TTL later: free, or B's already.
    expect(await store.getRunOwnership({ runId: LEADER })).not.toMatchObject({ ownerId: held!.ownerId, live: true });
    await vi.waitFor(() => expect(b.listings()).toBeGreaterThan(0));
  });

  it('leaves the default-engine runs to the leader from an explicit call on another instance, which still restarts its evented runs', async () => {
    const storage = new InMemoryStore();
    const leader = replica(storage, 'A', [], scanning);
    await leader.mastra.startWorkers();
    await vi.waitFor(() => expect(leader.listings()).toBeGreaterThan(0));
    const evented = createEventedWorkflow({ id: 'evented-wf', inputSchema: schema, outputSchema: schema })
      .then(createEventedStep({ id: 'work', inputSchema: schema, outputSchema: schema, execute: async () => ({}) }))
      .commit();
    const other = replica(
      storage,
      'B',
      [],
      { workflowGraceMs: 0, ...scanning },
      { workflows: { 'evented-wf': evented } },
    );
    const eventedRestarts = stubRestarts(other.mastra, 'evented-wf');
    await persistActiveRun(storage, 'stopped');
    await persistActiveRun(storage, 'evented-run', { workflowName: 'evented-wf' });

    // As a server boots: its workers and loop, then the explicit call.
    await other.mastra.startWorkers();
    await other.mastra.restartAllActiveWorkflowRuns();

    expect(eventedRestarts).toEqual(['evented-run']);
    expect(other.listings()).toBe(0);
  });

  it('takes the leader row for one pass from an explicit call on an instance that runs no loop, and hands it back', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const b = replica(storage, 'B', [], { workflowGraceMs: 0 });
    const restarted = stubRestarts(b.mastra);
    await persistActiveRun(storage, 'stopped');

    await b.mastra.restartAllActiveWorkflowRuns();

    expect(restarted).toEqual(['stopped']);
    // Kept, it would be renewed for as long as the process lives, and no loop elsewhere would ever lead.
    expect((await store.getRunOwnership({ runId: LEADER }))?.live).toBe(false);
  });

  const scanIntervalMs = 123_456;
  it.each([
    // Up to a fifth earlier or later than the interval.
    ['no run', { stored: false }, 0, scanIntervalMs * 1.196],
    // A live run's lease is renewed while it runs, so its expiry says nothing about when it stops.
    ['a run that is live', { leaseMs: 300 }, 0, scanIntervalMs * 1.196],
    // Up to a fifth after the run comes out of its grace period.
    ['a run in its grace period', {}, 1_500, 1_500 * 1.198],
    // No sooner than a second out.
    ['a run whose grace period ends within a second', {}, 600, 1_000 * 1.198],
  ])(
    'schedules the next pass after a pass that saw %s, on a timer that does not keep the process alive',
    async (_, run, workflowGraceMs, expectedDelay) => {
      const { stored = true, leaseMs }: { stored?: boolean; leaseMs?: number } = run;
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const { mastra } = replica(storage, 'B', [], { workflowGraceMs, workflowScanIntervalMs: scanIntervalMs });
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
    const { mastra, listings } = replica(storage, 'B', [], scanning);
    await mastra.startWorkers();
    await vi.waitFor(() => expect(listings()).toBeGreaterThanOrEqual(6));

    await stop(mastra);
    // A pass already running may still list.
    await drained();
    const listed = listings();
    await vi.advanceTimersByTimeAsync(scanning.workflowScanIntervalMs * 10);

    expect(listings()).toBe(listed);
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
    const counting = countingListings(new InMemoryStore());
    const mastra = new Mastra({
      logger: false,
      storage: counting.storage,
      recovery: scanning,
      workers: [new OrchestrationWorker()],
      workflows: { 'recovered-wf': oneStep('B', []) },
    });
    replicas.push({ mastra });

    await mastra.startWorkers('orchestration');

    await vi.waitFor(() => expect(counting.listings()).toBeGreaterThan(0));
  });

  it('waits on shutdown for a pass in flight', async () => {
    const storage = new InMemoryStore();
    const { mastra } = replica(storage, 'B', []);
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

  it.each([
    'opening the workflows store',
    'probing the store for run fencing',
    'claiming the recovery leader row',
    'listing the runs',
    'restarting the run',
  ] as const)('keeps checking after passes whose store failed %s', async failing => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const { mastra } = replica(storage, 'B', executions, { workflowGraceMs: 0, ...scanning });
    await persistActiveRun(storage, 'stopped');
    let failures = 0;
    const failThrice = <T>(answer: () => T): T => {
      if (failures < 3) {
        failures++;
        throw new Error('connection reset');
      }

      return answer();
    };
    if (failing === 'opening the workflows store') {
      const getStore = storage.getStore.bind(storage);
      vi.spyOn(storage, 'getStore').mockImplementation(((domain: string) =>
        domain === 'workflows'
          ? failThrice(() => getStore(domain as 'workflows'))
          : getStore(domain as never)) as typeof storage.getStore);
    } else if (failing === 'probing the store for run fencing') {
      const probe = store.supportsRunFencing.bind(store);
      vi.spyOn(store, 'supportsRunFencing').mockImplementation(async () => failThrice(probe));
    } else if (failing === 'claiming the recovery leader row') {
      const claim = store.claimRunOwnership.bind(store);
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args =>
        args.runId === LEADER ? failThrice(() => claim(args)) : claim(args),
      );
    } else if (failing === 'listing the runs') {
      const list = store.listWorkflowRuns.bind(store);
      vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async args => failThrice(() => list(args)));
    } else {
      const workflow = mastra.getWorkflow('recovered-wf');
      const createRun = workflow.createRun.bind(workflow);
      vi.spyOn(workflow, 'createRun').mockImplementation(async args => {
        const run = await createRun(args);
        const restart = run.restart.bind(run);
        return Object.assign(run, { restart: async () => failThrice(restart) });
      });
    }

    await mastra.startWorkers();

    await vi.waitFor(() => expect(executions).toEqual(['B:work']));
    expect(failures).toBe(3);
  });

  it.each([
    // Nothing tells the run from one another instance still drives.
    ['the store has no run fencing', { workflowGraceMs: 0, ...scanning }],
    ["recovery.workflows is 'off'", { workflows: 'off', workflowGraceMs: 0, ...scanning }],
  ] as const)('lists no runs and leads nothing from the loop when %s', async (_, recovery) => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const probed = Promise.withResolvers<void>();
    // With recovery off the loop never starts, so nothing probes; a probe that answered would let it lead.
    const off = recovery.workflows === 'off';
    vi.spyOn(store, 'supportsRunFencing').mockImplementation(async () => {
      probed.resolve();
      return off;
    });
    const claims = vi.spyOn(store, 'claimRunOwnership');
    const { mastra, listings } = replica(storage, 'B', executions, recovery);
    await persistActiveRun(storage, 'stopped');

    await mastra.startWorkers();
    if (!off) {
      await probed.promise;
    }
    // A pass lists right after its claim; a loop's first pass would list at once.
    await drained();

    expect(listings()).toBe(0);
    expect(claims).not.toHaveBeenCalled();
    expect(executions).toEqual([]);
  });
});
