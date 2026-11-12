/**
 * Waking an evented sleep once (#30012): a sleep's timer, a recovery restart,
 * a redelivery of the sleep's event and a time travel can all reach the same
 * sleep, and stopping the workers can interrupt a wake at any point. Each sleep
 * occurrence is set up and woken under its own lease, and a wake checks the
 * stored run before it writes or publishes.
 *
 * Replicas are separate Mastra instances, each with its own pubsub, sharing
 * one store the way pods share one database. Leases use a short TTL here, read
 * when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { InMemoryStore } from '../../storage/mock';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../run-ownership';
import { restartLeaseKey, runLivenessKey, sleepStartKey } from './leases';
import {
  Num,
  interceptWorkflowEvents,
  isSleepKeyOf,
  isStepRunAt,
  observe,
  runStatus,
  scanning,
  sleep,
  sleepingFor,
  sleepingRunId,
  startInBackground,
  startReplica,
  stopReplicas,
  storedSleeps,
  storedWakeTime,
  work,
} from './test-utils/lease-replicas';
import type { Built, Report, Store } from './test-utils/lease-replicas';
import { createStep, createWorkflow } from '.';

afterEach(stopReplicas);

/**
 * Spies on the sleep lease of `runId`: `woken` resolves once a wake released it, and
 * `secondWake` once another wake read it after that. `secondWake` rejects, naming
 * what never happened, when no second wake came within 10 seconds.
 */
async function watchSleepLease(storage: Store, runId: () => string) {
  const store = (await storage.getStore('workflows'))!;
  const woken = Promise.withResolvers<void>();
  const secondWake = Promise.withResolvers<void>();
  const giveUp = setTimeout(
    () => secondWake.reject(new Error('No second wake read the sleep lease within 10 seconds')),
    10_000,
  );
  giveUp.unref?.();
  // Observed by the tests after the run settles; the step waiting on it only needs it to settle.
  secondWake.promise.catch(() => {});
  let released = false;
  const release = store.releaseRunOwnership.bind(store);
  const read = store.getRunOwnership.bind(store);
  vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
    const result = await release(fence);
    if (isSleepKeyOf(fence.runId, runId())) {
      released = true;
      woken.resolve();
    }
    return result;
  });
  // A wake reads the lease before it claims it, so the read is the first sign of a second wake.
  vi.spyOn(store, 'getRunOwnership').mockImplementation(async args => {
    if (released && isSleepKeyOf(args.runId, runId())) {
      secondWake.resolve();
    }

    return read(args);
  });
  return { store, woken: woken.promise, secondWake: secondWake.promise };
}

/** Resolves once the store was asked to release `key`, as the end of a sleep setup does with its start lease. */
async function releaseOf(storage: Store, key: string) {
  const store = (await storage.getStore('workflows'))!;
  const release = store.releaseRunOwnership.bind(store);
  const released = Promise.withResolvers<void>();
  vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
    const result = await release(fence);
    if (fence.runId === key) {
      released.resolve();
    }

    return result;
  });

  return released.promise;
}

/**
 * The `leased` workflow with steps `before` and `after` around a 50 ms sleep whose duration
 * function waits for the test: `resolving` resolves once it runs, and it returns once `resolve()`
 * is called. A copy built with `gated: false` returns at once.
 */
function gatedSleep() {
  const resolving = Promise.withResolvers<void>();
  const gate = Promise.withResolvers<void>();
  const build = (report: Report, gated = true) =>
    createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
      .then(work('before', report))
      .sleep(async () => {
        if (gated) {
          resolving.resolve();
          await gate.promise;
        }

        return 50;
      })
      .then(work('after', report))
      .commit() as unknown as Built;

  return { build, resolving: resolving.promise, resolve: () => gate.resolve() };
}

describe('waking an evented sleep once (#30012)', () => {
  it('wakes a sleep once when the timer of the replica that started it races a recovery restart', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const seen = observe('leased');
    const build = (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('before', report))
        .sleep(500)
        .then(work('after', report))
        .commit() as unknown as Built;
    const a = await startReplica(storage, build(seen.reporter('A')), { pubsub: seen.pubsub('A') });
    await startReplica(storage, build(seen.reporter('B')), { pubsub: seen.pubsub('B'), recovery: scanning });
    const run = await a.workflow.createRun();

    // A's timer takes the sleep's lease and stalls before marking the run live. B's loop finds the
    // run's keys lapsed past the grace period meanwhile, and the wake its restart starts finds the
    // lease held. A then goes on.
    const claim = store.claimRunOwnership.bind(store);
    const read = store.getRunOwnership.bind(store);
    const refused = Promise.withResolvers<void>();
    const restarts: boolean[] = [];
    let refusals = 0;
    let woken = false;
    let held = false;
    vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
      if (woken && !held && args.runId === runLivenessKey(run.runId)) {
        held = true;
        await refused.promise;
      }
      const result = await claim(args);
      if (args.runId === restartLeaseKey(run.runId)) {
        restarts.push(result.acquired);
      }

      if (isSleepKeyOf(args.runId, run.runId) && result.acquired) {
        woken = true;
      }

      return result;
    });
    vi.spyOn(store, 'getRunOwnership').mockImplementation(async args => {
      const result = await read(args);
      if (woken && isSleepKeyOf(args.runId, run.runId) && result?.live) {
        refusals++;
        refused.resolve();
      }
      return result;
    });

    expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
    expect(restarts).toEqual([true]);
    expect(refusals).toBe(1);
    expect(seen.continuations).toEqual(['A']);
    expect(seen.executions).toEqual(['A:before', 'A:after']);
  }, 20_000);

  it('wakes a sleep once when a redelivery of the sleep resumes it while it wakes', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    let runId = '';
    const lease = await watchSleepLease(storage, () => runId);
    let sleepEvent: Event | undefined;
    const pubsubA = interceptWorkflowEvents(seen.pubsub('A'), event => {
      if (isStepRunAt(event, [1])) {
        sleepEvent ??= structuredClone(event);
      }

      return undefined;
    });
    const reportA = seen.reporter('A');
    const onA = sleepingFor(800)(async label => {
      await reportA(label);
      if (label === 'after') {
        // A missing second wake fails the test below, where it awaits `secondWake` itself.
        await lease.secondWake.catch(() => {});
      }
    });
    const a = await startReplica(storage, onA, { pubsub: pubsubA });
    const pubsubB = seen.pubsub('B');
    await startReplica(storage, sleepingFor(800)(seen.reporter('B')), {
      pubsub: pubsubB,
      recovery: { workflows: 'off' },
    });
    const run = await a.workflow.createRun();
    runId = run.runId;
    const started = run.start({ inputData: { n: 1 } });
    await sleepingRunId(storage, run.runId);

    // The redelivery reads the sleep before A's wake, and writes it back as `waiting` after it.
    const write = lease.store.updateWorkflowResults.bind(lease.store);
    let held = false;
    vi.spyOn(lease.store, 'updateWorkflowResults').mockImplementation(async args => {
      if (!held && args.result.status === 'waiting') {
        held = true;
        await lease.woken;
      }
      return write(args);
    });
    await pubsubB.publish('workflows', sleepEvent!);

    const result = await started;
    await lease.secondWake;
    expect(result.status).toBe('success');
    expect(seen.continuations).toEqual(['A']);
    expect(seen.executions).toEqual(['A:before', 'A:after']);
    expect(await storedSleeps(storage, run.runId)).toEqual(['success']);
  }, 20_000);

  it('drops a delivery of a sleep that arrives after the run finished', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    let sleepEvent: Event | undefined;
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (isStepRunAt(event, [1])) {
        sleepEvent ??= structuredClone(event);
      }

      return undefined;
    });
    const a = await startReplica(storage, sleepingFor(10)(seen.reporter('A')), { pubsub: pubsubA });
    const b = await startReplica(storage, sleepingFor(10)(seen.reporter('B')), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

    await b.pubsub.publish('workflows', sleepEvent!);
    // Stopping the workers waits for the delivery they are handling.
    await b.mastra.stopWorkers();

    expect(await runStatus(storage, run.runId)).toBe('success');
    expect(await storedSleeps(storage, run.runId)).toEqual(['success']);
    expect(seen.executions).toEqual(['A:before', 'A:after']);
  }, 20_000);

  it('keeps a sleep longer than the longest timer delay waiting', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    // Node warns when it shortens a timer set past the longest delay to 1 ms.
    const overflows: string[] = [];
    const onWarning = (warning: Error) => {
      if (warning.name === 'TimeoutOverflowWarning') {
        overflows.push(warning.message);
      }
    };
    process.on('warning', onWarning);
    try {
      const a = await startReplica(storage, sleepingFor(2 ** 31 + 60_000)(seen.reporter('A')));
      const run = await a.workflow.createRun();
      startInBackground(run, { n: 1 });
      await sleepingRunId(storage, run.runId);
      // The timer is set right after the wake key is written, and a warning is emitted on the next tick.
      await new Promise(resolve => setImmediate(resolve));

      expect(overflows).toEqual([]);
      expect(await runStatus(storage, run.runId)).toBe('running');
      expect(seen.executions).toEqual(['A:before']);
    } finally {
      process.off('warning', onWarning);
    }
  }, 20_000);

  it('sets a sleep up once when two deliveries of its event arrive together', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const afterRan = Promise.withResolvers<void>();
    let resolutions = 0;
    // The second delivery to resolve the sleep's duration takes until the run moved past the sleep.
    const build = (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('before', report))
        .sleep(async () => {
          if (++resolutions > 1) {
            await afterRan.promise;
          }

          return 50;
        })
        .then(
          work('after', async label => {
            await report(label);
            afterRan.resolve();
          }),
        )
        .commit() as unknown as Built;
    const pubsubB = seen.pubsub('B');
    // The sleep's event reaches B too, as a broker that delivers a message twice would.
    const pubsubA = interceptWorkflowEvents(seen.pubsub('A'), event => {
      if (isStepRunAt(event, [1]) && (event.data as { workflowId?: string }).workflowId === 'leased') {
        pubsubB
          .publish('workflows', structuredClone(event))
          .catch(error => console.error("Delivering the sleep's event to B failed", error));
      }
      return undefined;
    });
    const a = await startReplica(storage, build(seen.reporter('A')), { pubsub: pubsubA });
    const b = await startReplica(storage, build(seen.reporter('B')), {
      pubsub: pubsubB,
      recovery: { workflows: 'off' },
    });
    const run = await a.workflow.createRun();

    // Either replica may set the sleep up and finish the run, so the run's end is read from storage.
    startInBackground(run, { n: 1 });
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 5_000 });
    // Stopping the workers waits for the deliveries they are handling.
    await b.mastra.stopWorkers();
    await a.mastra.stopWorkers();

    expect(await runStatus(storage, run.runId)).toBe('success');
    expect(await storedSleeps(storage, run.runId)).toEqual(['success']);
    expect(seen.continuations).toHaveLength(1);
    expect(resolutions).toBe(1);
  }, 20_000);

  it.each([
    ['the workers stop', false],
    ['a shutdown fails before stopping the workers', true],
  ] as const)(
    "ends a running wake's hold on the sleep's lease when %s",
    async (_, failedShutdown) => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const seen = observe('leased');
      // A's wake marks the sleep finished and then waits on a broker that never takes its message.
      const pubsubA = interceptWorkflowEvents(seen.pubsub('A'), event =>
        isStepRunAt(event, [2]) ? { hold: new Promise<void>(() => {}) } : undefined,
      );
      const a = await startReplica(storage, sleepingFor(100)(seen.reporter('A')), { pubsub: pubsubA });
      const run = await a.workflow.createRun();
      const claim = store.claimRunOwnership.bind(store);
      const wakeKey = Promise.withResolvers<string>();
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
        const result = await claim(args);
        if (result.acquired && isSleepKeyOf(args.runId, run.runId)) {
          wakeKey.resolve(args.runId);
        }
        return result;
      });
      startInBackground(run, { n: 1 });
      const key = await wakeKey.promise;
      await vi.waitFor(async () => expect(await storedSleeps(storage, run.runId)).toEqual(['success']));

      if (failedShutdown) {
        vi.spyOn(a.mastra, 'stopWorkers').mockRejectedValue(new Error('transport stuck'));
        await expect(a.mastra.shutdown({ drainTimeout: 0 })).rejects.toThrow('transport stuck');
      } else {
        await a.mastra.stopWorkers({ drainTimeout: 0 });
      }

      // Without renewals the lease lapses, and another process can wake the sleep.
      await vi.waitFor(async () => expect((await store.getRunOwnership({ runId: key }))?.live).toBe(false), {
        timeout: WORKFLOW_RUN_LEASE_TTL_MS * 4,
      });
    },
    20_000,
  );

  /**
   * Where a wake is held until its workers stopped. `reached` resolves once the wake waits there,
   * `release` lets it go on. `wakeKey` is the wake's lease key once it claimed it.
   */
  type WakeHold = {
    reached: Promise<void>;
    release: () => Promise<void>;
    beforeClaim?: (key: string) => Promise<void>;
    beforeRenew?: (key: string, leaseMs: number) => Promise<void>;
    beforeLoad?: (runId: string) => Promise<void>;
  };
  const wakeHolds: Record<
    string,
    (ctx: { runId: string; storage: Store; wakeKey: () => string | undefined }) => WakeHold
  > = {
    // The store grants the wake its lease only once the workers stopped.
    'claimed its lease': ({ runId }) => {
      const reached = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      return {
        reached: reached.promise,
        release: async () => gate.resolve(),
        beforeClaim: async key => {
          if (isSleepKeyOf(key, runId)) {
            reached.resolve();
            await gate.promise;
          }
        },
      };
    },
    // The wake marked the sleep finished and checks its lease before publishing.
    'checked its lease after marking the sleep finished': ({ runId, storage, wakeKey }) => {
      const reached = Promise.withResolvers<void>();
      const gate = Promise.withResolvers<void>();
      return {
        reached: reached.promise,
        release: async () => gate.resolve(),
        beforeRenew: async (key, leaseMs) => {
          if (key === wakeKey() && leaseMs !== 1 && (await storedSleeps(storage, runId))[0] === 'success') {
            reached.resolve();
            await gate.promise;
          }
        },
      };
    },
    // The wake reads the run only once a renewal of its lease is under way, and that renewal lands
    // only after the wake gave up; letting the lease lapse must wait for it, or the renewal would
    // hold the lease from the wake that runs again.
    'had a renewal of its lease in flight': ({ runId, wakeKey }) => {
      const reached = Promise.withResolvers<void>();
      const readHeld = Promise.withResolvers<void>();
      const renewHeld = Promise.withResolvers<void>();
      let readHolding = false;
      let renewHolding = false;
      return {
        reached: reached.promise,
        release: async () => {
          readHeld.resolve();
          // The wake makes no store call between its read and its wait for the renewal, and runs
          // through to that wait on callbacks alone: a few turns of the event loop take it there.
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setImmediate(resolve));
          }
          renewHeld.resolve();
        },
        beforeLoad: async loaded => {
          if (wakeKey() && !readHolding && loaded === runId) {
            readHolding = true;
            await readHeld.promise;
          }
        },
        beforeRenew: async key => {
          if (key === wakeKey() && readHolding && !renewHolding) {
            renewHolding = true;
            reached.resolve();
            await renewHeld.promise;
          }
        },
      };
    },
  };

  it.each(Object.keys(wakeHolds))(
    'stops a wake whose workers stopped while it %s, and wakes the sleep once they start again',
    async name => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const seen = observe('leased');
      const a = await startReplica(storage, sleepingFor(100)(seen.reporter('A')), {
        pubsub: seen.pubsub('A'),
        recovery: { workflows: 'off' },
      });
      const run = await a.workflow.createRun();
      let wakeKey: string | undefined;
      const hold = wakeHolds[name]!({ runId: run.runId, storage, wakeKey: () => wakeKey });
      const lapsed = Promise.withResolvers<void>();
      const claim = store.claimRunOwnership.bind(store);
      const renew = store.renewRunOwnership.bind(store);
      const load = store.loadWorkflowSnapshot.bind(store);
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
        await hold.beforeClaim?.(args.runId);
        const result = await claim(args);
        if (result.acquired && isSleepKeyOf(args.runId, run.runId)) {
          wakeKey = args.runId;
        }

        return result;
      });
      vi.spyOn(store, 'renewRunOwnership').mockImplementation(async args => {
        await hold.beforeRenew?.(args.runId, args.leaseMs);
        const result = await renew(args);
        if (isSleepKeyOf(args.runId, run.runId) && args.leaseMs === 1) {
          lapsed.resolve();
        }

        return result;
      });
      vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async args => {
        await hold.beforeLoad?.(args.runId);
        return load(args);
      });

      startInBackground(run, { n: 1 });
      await hold.reached;
      await a.mastra.stopWorkers({ drainTimeout: 0 });
      await hold.release();
      // The stopped wake lets its lease lapse, after putting back the sleep if it marked it finished.
      await lapsed.promise;

      expect(seen.continuations).toEqual([]);
      expect(await storedSleeps(storage, run.runId)).toEqual(['waiting']);

      // With recovery off, only the interrupted wake running again wakes the sleep. A wake that
      // found its own lease still held would drop the sleep for good, so the run would never finish.
      await a.mastra.startWorkers();
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 5_000 });
      expect(seen.executions).toEqual(['A:before', 'A:after']);
    },
    20_000,
  );

  it('sets a sleep up from a redelivery that arrived while the delivery that died setting it up still held its start lease', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const seen = observe('leased');
    // A dies while its duration function runs, which never returns; B's returns at once.
    const sleeps = gatedSleep();
    let sleepEvent: Event | undefined;
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (isStepRunAt(event, [1])) {
        sleepEvent ??= structuredClone(event);
      }

      return undefined;
    });
    const a = await startReplica(storage, sleeps.build(seen.reporter('A')), { pubsub: pubsubA });
    const b = await startReplica(storage, sleeps.build(seen.reporter('B'), false), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleeps.resolving;

    // A dies: its start lease stays live for one more TTL, and nothing renews it after that.
    await a.mastra.shutdown({ drainTimeout: 0 });
    await store.claimRunOwnership({
      runId: sleepStartKey(run.runId, [1]),
      ownerId: 'crashed-process',
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: true,
    });

    // The broker redelivers the sleep's event to B while that lease is live.
    expect(await b.mastra.handleWorkflowEvent({ ...sleepEvent!, deliveryAttempt: 2 })).toEqual({ ok: true });

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 5_000 });
    expect(seen.executions).toEqual(['A:before', 'B:after']);
  }, 20_000);

  it.each([
    {
      while: 'the run is canceled',
      interfere: async (storage: Store, run: { runId: string; cancel: () => Promise<unknown> }) => {
        await run.cancel();
        await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('canceled'));
      },
      // The cancel is not undone by setting the run running again.
      check: async (storage: Store, runId: string) => expect(await runStatus(storage, runId)).toBe('canceled'),
    },
    {
      while: 'another process takes its start lease',
      // As after A's renewals failed for a lease TTL; that process sets the sleep up itself.
      interfere: async (storage: Store, run: { runId: string }) => {
        const store = (await storage.getStore('workflows'))!;
        await store.claimRunOwnership({
          runId: sleepStartKey(run.runId, [1]),
          ownerId: 'another-process',
          leaseMs: 60_000,
          force: true,
        });
      },
      check: async (storage: Store, runId: string) => expect(await storedSleeps(storage, runId)).toEqual([]),
    },
  ])(
    'drops a sleep setup when $while while its duration resolves',
    async ({ interfere, check }) => {
      const storage = new InMemoryStore();
      const seen = observe('leased');
      const sleeps = gatedSleep();
      const a = await startReplica(storage, sleeps.build(seen.reporter('A')), {
        pubsub: seen.pubsub('A'),
        recovery: { workflows: 'off' },
      });
      const run = await a.workflow.createRun();
      const setUp = releaseOf(storage, sleepStartKey(run.runId, [1]));
      startInBackground(run, { n: 1 });
      await sleeps.resolving;

      await interfere(storage, run);
      sleeps.resolve();
      // The setup is over once it let go of its start lease.
      await setUp;

      await check(storage, run.runId);
      expect(seen.continuations).toEqual([]);
      expect(seen.executions).toEqual(['A:before']);
    },
    20_000,
  );

  it('keeps a sleep set up after its workers stopped for when they start again', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    // The sleep's duration resolves only after the drain gave up on it.
    const sleeps = gatedSleep();
    const a = await startReplica(storage, sleeps.build(seen.reporter('A')), {
      pubsub: seen.pubsub('A'),
      recovery: { workflows: 'off' },
    });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleeps.resolving;

    await a.mastra.stopWorkers({ drainTimeout: 0 });
    sleeps.resolve();
    await vi.waitFor(async () => expect(await storedSleeps(storage, run.runId)).toEqual(['waiting']));
    // Past the sleep's wake time.
    const wakeAt = await storedWakeTime(storage, 'leased', run.runId);
    await sleep(Math.max(0, wakeAt + 200 - Date.now()));
    expect(seen.continuations).toEqual([]);
    expect(await storedSleeps(storage, run.runId)).toEqual(['waiting']);

    await a.mastra.startWorkers();
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 5_000 });
    expect(seen.executions).toEqual(['A:before', 'A:after']);
  }, 20_000);

  it('time travels to a sleep when the stored run still shows the run it travels from', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const report = seen.reporter('A');
    // Only finished runs are stored, so the stored run still shows the first run's last step.
    const workflow = createWorkflow({
      id: 'leased',
      inputSchema: Num,
      outputSchema: z.any(),
      options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
    })
      .then(work('before', report))
      .sleep(50)
      .then(
        createStep({
          id: 'after',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ inputData }) => {
            await report('after');
            return inputData;
          },
        }),
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built, { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
    const sleepId = (workflow.stepGraph[1] as { id: string }).id;

    const travelled = (await a.workflow.createRun({ runId: run.runId })).timeTravel({
      step: sleepId,
      inputData: { n: 1 },
    } as any);

    expect(await Promise.race([travelled.then(result => result.status), sleep(3_000).then(() => 'stalled')])).toBe(
      'success',
    );
    expect(seen.executions).toEqual(['A:before', 'A:after', 'A:after']);
  }, 20_000);

  it('leaves the next step to a time travel that took up a run canceled during its sleep', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const report = seen.reporter('A');
    let travelling = false;
    // Time travel hands a step after a sleep `{}` as its input.
    const anyInput = (id: string) =>
      createStep({
        id,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => {
          await report(id);
          // The time-travelled run is still running when the canceled run's timer fires.
          if (travelling && id === 'after') {
            await sleep(600);
          }

          return inputData;
        },
      });
    const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
      .then(work('before', report))
      .sleep(400)
      .then(anyInput('after'))
      .then(anyInput('final'))
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built, {
      pubsub: seen.pubsub('A'),
      recovery: { workflows: 'off' },
    });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);
    await run.cancel();
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('canceled'));

    // The time travel runs the steps after the sleep while the canceled run's sleep timer is still set.
    travelling = true;
    const travelled = await (
      await a.workflow.createRun({ runId: run.runId })
    ).timeTravel({
      step: 'after',
      inputData: { n: 2 },
    } as any);

    // The time travel stores the sleep without its wake time, so the timer finds a different sleep
    // and publishes nothing: only the time travel's own event starts `after`.
    expect(travelled.status).toBe('success');
    expect(seen.continuations).toEqual(['A']);
    expect(seen.executions).toEqual(['A:before', 'A:after', 'A:final']);
  }, 20_000);

  it('keeps a sleep whose wake time comes while stopping the workers drains another run', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const draining = Promise.withResolvers<void>();
    const drained = Promise.withResolvers<void>();
    const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
      .then(
        createStep({
          id: 'before',
          inputSchema: Num,
          outputSchema: Num,
          execute: async ({ inputData }) => {
            executions.push(`before:${inputData.n}`);
            // The second run's first step holds the drain until the test lets it finish.
            if (inputData.n === 2) {
              draining.resolve();
              await drained.promise;
            }
            return inputData;
          },
        }),
      )
      .sleep(200)
      .then(work('after', async () => void executions.push('after')))
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built, { recovery: { workflows: 'off' } });
    const sleeping = await a.workflow.createRun();
    startInBackground(sleeping, { n: 1 });
    await sleepingRunId(storage, sleeping.runId);
    const held = await a.workflow.createRun();
    startInBackground(held, { n: 2 });
    await draining.promise;

    const stopping = a.mastra.stopWorkers({ drainTimeout: 5_000 });
    // Past the sleep's wake time, while the drain still waits for the second run.
    const wakeAt = await storedWakeTime(storage, 'leased', sleeping.runId);
    await sleep(Math.max(0, wakeAt + 200 - Date.now()));
    drained.resolve();
    await stopping;
    expect(await storedSleeps(storage, sleeping.runId)).toEqual(['waiting']);

    await a.mastra.startWorkers();
    await vi.waitFor(async () => expect(await runStatus(storage, sleeping.runId)).toBe('success'), {
      timeout: 5_000,
    });
  }, 20_000);

  it('stops a wake whose lease another process took before it marked the sleep finished', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const seen = observe('leased');
    const a = await startReplica(storage, sleepingFor(200)(seen.reporter('A')), { pubsub: seen.pubsub('A') });
    const run = await a.workflow.createRun();

    // A's wake takes the sleep's lease and stalls; meanwhile another process takes the lease over.
    const claim = store.claimRunOwnership.bind(store);
    const renew = store.renewRunOwnership.bind(store);
    const stolen = Promise.withResolvers<void>();
    let wakeKey: string | undefined;
    let held = false;
    let refused = false;
    vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
      if (wakeKey && !held && args.runId === runLivenessKey(run.runId)) {
        held = true;
        await stolen.promise;
      }
      const result = await claim(args);
      if (result.acquired && !wakeKey && isSleepKeyOf(args.runId, run.runId)) {
        wakeKey = args.runId;
      }
      return result;
    });
    vi.spyOn(store, 'renewRunOwnership').mockImplementation(async args => {
      const result = await renew(args);
      if (args.runId === wakeKey && !result.renewed) {
        refused = true;
      }

      return result;
    });
    startInBackground(run, { n: 1 });
    await vi.waitFor(() => expect(held).toBe(true));
    await claim({ runId: wakeKey!, ownerId: 'another-process', leaseMs: 60_000, force: true });
    stolen.resolve();

    // Either the wake found its lease gone, or it went on and published.
    await vi.waitFor(() => expect(refused || seen.continuations.length > 0).toBe(true));
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setImmediate(resolve));
    }

    expect(seen.continuations).toEqual([]);
    expect(await storedSleeps(storage, run.runId)).toEqual(['waiting']);
  }, 20_000);
});
