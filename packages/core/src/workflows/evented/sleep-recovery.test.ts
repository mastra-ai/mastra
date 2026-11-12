/**
 * A sleep is woken by a timer in the process that started it, so it used to be
 * lost when that process stopped (#30012). Its wake time is stored now, and a
 * restart of the run, from any instance, wakes it when that time comes. Until
 * then the run's wake key keeps recovery and `restart()` away from it, while
 * nothing is written for it.
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
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { InMemoryStore } from '../../storage/mock';
import { runLivenessKey, runWakeKey, stepOccurrenceKey } from './leases';
import { forgetWakeTime } from './test-utils/forget-wake-time';
import {
  Num,
  crash,
  interceptWorkflowEvents,
  isStepRunAt,
  observe,
  recordRestarts,
  runIsLive,
  runStatus,
  scanning,
  sleep,
  sleepStatuses,
  sleepingFor,
  sleepingRunId,
  sleepingWorkflows,
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

// The recovery grace period of the replicas that recover runs here, shorter than the default.
const GRACE_MS = 1_000;
const recovering = { ...scanning, workflowGraceMs: GRACE_MS };

/** When the store read the snapshot of any of `runIds`, by any of the calls that return one. */
async function recordSnapshotReads(storage: Store, runIds: string[]) {
  const store = (await storage.getStore('workflows'))!;
  const reads: number[] = [];
  const load = store.loadWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async args => {
    if (runIds.includes(args.runId)) {
      reads.push(Date.now());
    }

    return load(args);
  });
  const byId = store.getWorkflowRunById.bind(store);
  vi.spyOn(store, 'getWorkflowRunById').mockImplementation(async args => {
    if (runIds.includes(args.runId)) {
      reads.push(Date.now());
    }

    return byId(args);
  });

  return reads;
}

describe('recovery of evented runs in a sleep (#30012)', () => {
  it.each(Object.keys(sleepingWorkflows) as (keyof typeof sleepingWorkflows)[])(
    'a replica still running wakes a run in a %s once its replica stopped, at the wake time plus the grace period, without reading it before',
    async name => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const nested = name === 'sleep of a nested workflow';
      const seen = observe(nested ? 'child' : 'leased');
      const replica = async (replicaName: string, recovery?: typeof recovering) => {
        const built = sleepingWorkflows[name](seen.reporter(replicaName));
        return startReplica(storage, built.workflow as unknown as Built, {
          pubsub: seen.pubsub(replicaName),
          nested: built.nested as any,
          recovery,
        });
      };
      const a = await replica('A');
      await replica('B', recovering);
      const run = await a.workflow.createRun();
      startInBackground(run, { n: 1 });
      const sleeping = await sleepingRunId(storage, run.runId);
      const wakeAt = await storedWakeTime(storage, nested ? 'child' : 'leased', sleeping);
      const restarts = await recordRestarts(storage, run.runId);
      const reads = await recordSnapshotReads(storage, [run.runId, sleeping]);
      // B's recovery passes read the run's wake key with its liveness key.
      const read = store.getRunOwnerships.bind(store);
      let passesBeforeWake = 0;
      vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
        if (Date.now() < wakeAt && args.runIds.includes(runWakeKey(run.runId))) {
          passesBeforeWake++;
        }

        return read(args);
      });

      await crash(a, storage, [runLivenessKey(run.runId), runLivenessKey(sleeping)]);

      // Waits without reading the run, so every read recorded is the replicas'.
      await vi.waitFor(() => expect(seen.executions).toContain('B:after'), { timeout: 10_000 });
      const readsUntilWake = [...reads];
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(seen.executions).toEqual(['A:before', 'B:after']);
      expect(seen.continuations).toEqual(['B']);
      expect(restarts.map(restart => restart.acquired)).toEqual([true]);
      expect(restarts[0]!.at).toBeGreaterThanOrEqual(wakeAt + GRACE_MS);
      expect(restarts[0]!.at).toBeLessThan(wakeAt + GRACE_MS + 1_000);
      // Every pass before the restart left the run alone from the keys alone.
      expect(passesBeforeWake).toBeGreaterThan(1);
      expect(readsUntilWake.length).toBeGreaterThan(0);
      expect(readsUntilWake.filter(at => at < wakeAt + GRACE_MS)).toEqual([]);
    },
    20_000,
  );

  it('leaves a run alone while one parallel branch sleeps after the other finished', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    // The sleep runs in a nested workflow: a parallel branch is a step.
    const build = (report: Report) => {
      const napping = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .sleep(4_000)
        .then(work('after', report))
        .commit();
      const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .parallel([napping, work('quick', report)])
        .commit();
      return { workflow: workflow as unknown as Built, nested: { child: napping as unknown as Built } };
    };
    const onA = build(seen.reporter('A'));
    const a = await startReplica(storage, onA.workflow, { nested: onA.nested, recovery: recovering });
    const onB = build(seen.reporter('B'));
    await startReplica(storage, onB.workflow, { nested: onB.nested, recovery: recovering });
    const run = await a.workflow.createRun();
    const restarts = await recordRestarts(storage, run.runId);

    // `quick` ends right away, and the run's liveness lapses one lease TTL later while the sleep goes on.
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

    expect(restarts).toEqual([]);
    expect([...seen.executions].sort()).toEqual(['A:after', 'A:quick']);
  }, 20_000);

  it('recovers a sleeping run whose process died at about its wake time plus the grace period, though the scan interval is long', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const a = await startReplica(storage, sleepingFor(2_000)(seen.reporter('A')));
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);
    const wakeAt = await storedWakeTime(storage, 'leased', run.runId);
    const restarts = await recordRestarts(storage, run.runId);
    await crash(a, storage, [runLivenessKey(run.runId)]);

    // B's first pass finds the run asleep, and its next pass comes when the sleep is due, not a
    // scan interval later.
    await startReplica(storage, sleepingFor(2_000)(seen.reporter('B')), {
      recovery: { workflows: 'auto', workflowGraceMs: GRACE_MS, workflowScanIntervalMs: 60_000 },
    });

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
    expect(seen.executions).toEqual(['A:before', 'B:after']);
    expect(restarts.map(restart => restart.acquired)).toEqual([true]);
    expect(restarts[0]!.at).toBeGreaterThanOrEqual(wakeAt + GRACE_MS);
    expect(restarts[0]!.at).toBeLessThan(wakeAt + GRACE_MS + 1_500);
  }, 20_000);

  it.each([
    { sleep: 'sleep', until: false },
    { sleep: 'sleepUntil', until: true },
  ])(
    'restart() during a $sleep resumes the rest of it, and the run wakes once',
    async ({ until }) => {
      const storage = new InMemoryStore();
      const seen = observe('leased');
      // The sleepUntil date is computed when the sleep starts, so a restart that started the sleep
      // again would wake the run later.
      const build = (report: Report) => {
        const before = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num }).then(
          work('before', report),
        );
        const slept = until ? before.sleepUntil(async () => new Date(Date.now() + 2_000)) : before.sleep(2_000);
        return slept.then(work('after', report)).commit() as unknown as Built;
      };
      const a = await startReplica(storage, build(seen.reporter('A')), {
        pubsub: seen.pubsub('A'),
        recovery: { workflows: 'off' },
      });
      const b = await startReplica(storage, build(seen.reporter('B')), {
        pubsub: seen.pubsub('B'),
        recovery: { workflows: 'off' },
      });
      const run = await a.workflow.createRun();
      startInBackground(run, { n: 1 });
      await sleepingRunId(storage, run.runId);
      const wakeAt = await storedWakeTime(storage, 'leased', run.runId);
      // A handles no event of the sleeping run, so its liveness lapses while A's timer is still set.
      await vi.waitFor(async () => expect(await runIsLive(storage, run.runId)).toBe(false), { timeout: 5_000 });
      const restarts = await recordRestarts(storage, run.runId);

      // The run ends on whichever replica wakes it, so B's restart may never see the end.
      let restartError: unknown;
      (await b.workflow.createRun({ runId: run.runId })).restart().catch(error => {
        restartError = error;
      });

      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
      expect(restartError).toBeUndefined();
      expect(restarts.map(restart => restart.acquired)).toEqual([true]);
      // A's timer and B's resumed one both fire at the stored wake time; one of them wakes the run.
      const after = seen.executions.filter(execution => execution.endsWith(':after'));
      expect(after).toHaveLength(1);
      expect(seen.executions[0]).toBe('A:before');
      expect(seen.continuations).toHaveLength(1);
      expect(seen.at[after[0]!]! - wakeAt).toBeGreaterThanOrEqual(0);
      expect(seen.at[after[0]!]! - wakeAt).toBeLessThan(100);
      // One sleep, finished, although B's graph gave the sleep a different id than A's.
      expect(await storedSleeps(storage, run.runId)).toEqual(['success']);
    },
    20_000,
  );

  it('restart() keeps the stored wake time of a sleep whose process stopped before it stored the run at the sleep', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const seen = observe('leased');
    const a = await startReplica(storage, sleepingFor(1_500)(seen.reporter('A')));
    const b = await startReplica(storage, sleepingFor(1_500)(seen.reporter('B')), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);
    // A stopped after storing the sleep's result, before it stored the run's path at the sleep and
    // the run's wake key.
    await crash(a, storage, [runLivenessKey(run.runId), runWakeKey(run.runId)]);
    const snapshot = (await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId }))!;
    const sleepId = Object.keys(snapshot.context).find(id => id.startsWith('sleep_'))!;
    const { [sleepId]: _sleep, ...activeStepsPath } = snapshot.activeStepsPath;
    await store.persistWorkflowSnapshot({
      workflowName: 'leased',
      runId: run.runId,
      snapshot: { ...snapshot, activePaths: [0], activeStepsPath },
    });

    await sleep(Math.max(0, seen.at['A:before']! + 700 - Date.now()));
    const restartedAt = Date.now();
    const result = await (await b.workflow.createRun({ runId: run.runId })).restart();

    expect(result.status).toBe('success');
    expect(seen.executions).toEqual(['A:before', 'B:after']);
    // The restart waited for the rest of the stored sleep, not for a whole new one.
    expect(seen.at['B:after']! - Math.max(seen.at['A:before']! + 1_500, restartedAt)).toBeLessThan(500);
    expect(sleepStatuses(result.steps)).toEqual(['success']);
  }, 20_000);

  it('restarts a run in a sleep stored without a wake time once, and the sleep starts over', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    // The duration comes from the sleep's input, which B's copy of the run holds under A's sleep id.
    const build = (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('before', report))
        .sleep(async ({ inputData }) => inputData.n * 3_000)
        .then(work('after', report))
        .commit() as unknown as Built;
    const a = await startReplica(storage, build(seen.reporter('A')));
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);
    // Written before sleeps stored their wake time, the run has neither the wake time nor a wake key.
    await crash(a, storage, [runLivenessKey(run.runId), runWakeKey(run.runId)]);
    await forgetWakeTime(storage, 'leased', run.runId);
    const restarts = await recordRestarts(storage, run.runId);

    await startReplica(storage, build(seen.reporter('B')), { recovery: recovering });

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 15_000 });
    expect(seen.executions).toEqual(['A:before', 'B:after']);
    // The restarted sleep waits its whole duration again, and its wake key keeps it from being
    // restarted a second time meanwhile.
    expect(restarts.map(restart => restart.acquired)).toEqual([true]);
    expect(seen.at['B:after']! - restarts[0]!.at).toBeGreaterThanOrEqual(3_000);
  }, 30_000);

  it('recovers a time-travelled run that stopped mid-step without waiting for the sleep it left', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    let travelling = false;
    const build = (replica: string) => {
      const report = seen.reporter(replica);
      return createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .then(work('before', report))
        .sleep(10_000)
        .then(
          createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData }) => {
              await report('after');
              // A's process stops during the time-travelled step.
              if (replica === 'A' && travelling) {
                await new Promise<never>(() => {});
              }

              return inputData;
            },
          }),
        )
        .commit() as unknown as Built;
    };
    const a = await startReplica(storage, build('A'), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);
    const wakeAt = await storedWakeTime(storage, 'leased', run.runId);
    // The canceled run's wake key still says it sleeps for ten seconds.
    await run.cancel();
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('canceled'));

    travelling = true;
    (await a.workflow.createRun({ runId: run.runId }))
      .timeTravel({ step: 'after', inputData: { n: 2 } } as any)
      .catch(error => console.error('The time travel on the stopped replica rejected', error));
    await vi.waitFor(() => expect(seen.executions).toContain('A:after'));
    await crash(a, storage, [runLivenessKey(run.runId), stepOccurrenceKey(run.runId, [2])]);
    await startReplica(storage, build('B'), { recovery: recovering });

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 8_000 });
    expect(seen.executions).toEqual(['A:before', 'A:after', 'B:after']);
    expect(seen.at['B:after']).toBeLessThan(wakeAt);
  }, 20_000);

  it('keeps the state a sleep duration function set when another replica wakes the run', async () => {
    const storage = new InMemoryStore();
    const seen: Record<string, unknown> = {};
    const build = () =>
      createWorkflow({
        id: 'leased',
        inputSchema: Num,
        outputSchema: z.any(),
        stateSchema: z.object({ scheduled: z.boolean().optional() }),
      })
        .then(work('before', async () => {}))
        .sleep(async ({ setState }) => {
          await setState({ scheduled: true });
          return 300;
        })
        .then(
          createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            stateSchema: z.object({ scheduled: z.boolean().optional() }),
            execute: async ({ inputData, state }) => {
              seen.state = state;
              return inputData;
            },
          }),
        )
        .commit() as unknown as Built;
    // Each delivery gets its own copy of the event, as from a broker. An in-process pubsub hands on
    // the objects the in-memory store keeps, so a state change there would reach the store unwritten.
    const brokered = () =>
      new Proxy(new EventEmitterPubSub(), {
        get(target, prop) {
          if (prop === 'publish') {
            return (topic: string, event: Event, options?: { localOnly?: boolean }) =>
              target.publish(topic, JSON.parse(JSON.stringify(event)), options);
          }

          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as PubSub;
    const a = await startReplica(storage, build(), { pubsub: brokered() });
    await startReplica(storage, build(), { pubsub: brokered(), recovery: scanning });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await sleepingRunId(storage, run.runId);

    // The duration function ran on A only; B resumes the stored sleep without calling it again.
    await crash(a, storage, [runLivenessKey(run.runId)]);

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
    expect(seen.state).toMatchObject({ scheduled: true });
  }, 20_000);

  it('restart() continues a run whose sleep woke but whose next step event was lost, under any sleep id', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    const lost = Promise.withResolvers<void>();
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      isStepRunAt(event, [2]) ? { divert: () => lost.resolve() } : undefined,
    );
    const a = await startReplica(storage, sleepingFor(300)(seen.reporter('A')), { pubsub: pubsubA });
    const b = await startReplica(storage, sleepingFor(300)(seen.reporter('B')), { recovery: { workflows: 'off' } });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });
    await lost.promise;
    await crash(a, storage, [runLivenessKey(run.runId)]);

    const result = await (await b.workflow.createRun({ runId: run.runId })).restart();

    expect(result.status).toBe('success');
    expect(seen.executions).toEqual(['A:before', 'B:after']);
    expect(sleepStatuses(result.steps)).toEqual(['success']);
  }, 20_000);

  it('wakes a sleep again from another instance when publishing the step after it failed', async () => {
    const storage = new InMemoryStore();
    const seen = observe('leased');
    let rejected = false;
    const pubsubA = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (rejected || !isStepRunAt(event, [2])) {
        return undefined;
      }

      rejected = true;
      return { reject: new Error('broker unavailable') };
    });
    const a = await startReplica(storage, sleepingFor(300)(seen.reporter('A')), { pubsub: pubsubA });
    await startReplica(storage, sleepingFor(300)(seen.reporter('B')), { recovery: scanning });
    const run = await a.workflow.createRun();
    startInBackground(run, { n: 1 });

    // The failed wake puts the sleep back to waiting, and B's recovery loop restarts the run.
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
    expect(rejected).toBe(true);
    expect(seen.executions).toEqual(['A:before', 'B:after']);
  }, 20_000);
});
