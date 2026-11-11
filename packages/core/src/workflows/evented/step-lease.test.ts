/**
 * Booting replicas restart every active evented run they find. An evented run
 * holds no run lease, so a replica used to restart runs another replica was
 * still executing, and each step ran once per booting replica (#28712). The
 * worker running a step now holds a lease on that step occurrence and keeps
 * the run's liveness key fresh, and `restart()` refuses while the run is live.
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
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS } from '../run-ownership';
import { runLivenessKey, stepOccurrenceKey } from './step-lease';
import { abandonLease } from './test-utils/abandon-lease';
import { createStep, createWorkflow } from '.';

const Num = z.object({ n: z.number() });
type Report = (label: string) => Promise<void>;
type Store = InstanceType<typeof InMemoryStore>;

/** A step that reports its id before returning its input. */
function work(id: string, report: Report) {
  return createStep({
    id,
    inputSchema: Num,
    outputSchema: Num,
    execute: async ({ inputData }) => {
      await report(id);
      return inputData;
    },
  });
}

/**
 * Workflow shapes whose steps report a label per occurrence: the step id, the
 * foreach item or the loop iteration. `running` lists the execution paths of
 * the occurrences in `blocks`.
 */
const shapes = {
  step: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(work('a', report)).commit(),
    labels: ['a'],
    blocks: ['a'],
    running: [[0]],
  },
  parallel: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .parallel([work('a', report), work('b', report)])
        .commit(),
    labels: ['a', 'b'],
    blocks: ['a', 'b'],
    running: [
      [0, 0],
      [0, 1],
    ],
  },
  conditional: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .branch([
          [async () => true, work('a', report)],
          [async () => false, work('b', report)],
        ])
        .commit(),
    labels: ['a'],
    blocks: ['a'],
    running: [[0, 0]],
  },
  foreach: {
    input: [{ n: 1 }, { n: 2 }, { n: 3 }],
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
        .foreach(
          createStep({
            id: 'item',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              await report(`item:${inputData.n}`);
              return inputData;
            },
          }),
          { concurrency: 3 },
        )
        .commit(),
    labels: ['item:1', 'item:2', 'item:3'],
    blocks: ['item:1', 'item:2', 'item:3'],
    running: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  loop: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .dountil(
          createStep({
            id: 'body',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              await report(`body:${inputData.n + 1}`);
              return { n: inputData.n + 1 };
            },
          }),
          async ({ inputData }) => inputData.n >= 3,
        )
        .commit(),
    labels: ['body:1', 'body:2', 'body:3'],
    blocks: ['body:2'],
    running: [[0]],
  },
};
type Shape = (typeof shapes)[keyof typeof shapes];
type Built = ReturnType<Shape['build']>;

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

/** Starts a replica running `workflow` (registered as `leased`) and any nested workflows it calls. */
async function startReplica<W extends Built>(
  storage: Store,
  workflow: W,
  { pubsub = new EventEmitterPubSub() as PubSub, nested = {} as Record<string, Built> } = {},
) {
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { leased: workflow, ...nested } as any });
  await mastra.startWorkers();
  replicas.push(mastra);
  return { mastra, pubsub, workflow };
}

/** A replica crashing: it stops renewing anything, and the leases it held lapse. */
async function crash(replica: { mastra: Mastra }, storage: Store, keys: string[]) {
  await replica.mastra.shutdown({ drainTimeout: 0 });
  await abandonLease(storage, ...keys);
}

/**
 * Wraps a pubsub so an event on the `workflows` topic the test picks out is
 * held back (`hold` resolves when it may go on), kept from this replica
 * entirely (`divert` receives it instead), or fails to publish (`reject`).
 */
function interceptWorkflowEvents(
  inner: PubSub,
  pick: (event: Event) => { hold?: Promise<void>; divert?: (event: Event) => void; reject?: Error } | undefined,
) {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          const picked = topic === 'workflows' ? pick(event) : undefined;
          if (picked?.reject) throw picked.reject;
          if (picked?.divert) return picked.divert(structuredClone(event));
          if (picked?.hold) await picked.hold;
          return target.publish(topic, event, options);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Whether `event` is the `workflow.step.run` of the step at `path`. */
const isStepRunAt = (event: Event, path: number[]) =>
  event.type === 'workflow.step.run' &&
  JSON.stringify((event.data as { executionPath?: number[] }).executionPath) === JSON.stringify(path);

/** Records every lease claim and lease read on the shared store, and waits for ones matching a condition. */
async function recordLeases(storage: Store) {
  const store = (await storage.getStore('workflows'))!;
  const claim = store.claimRunOwnership.bind(store);
  const read = store.getRunOwnership.bind(store);
  const claims: { key: string; acquired: boolean }[] = [];
  const reads: string[] = [];
  let notify = () => {};
  vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
    const result = await claim(args);
    claims.push({ key: args.runId, acquired: result.acquired });
    notify();
    return result;
  });
  vi.spyOn(store, 'getRunOwnership').mockImplementation(async args => {
    const result = await read(args);
    reads.push(args.runId);
    notify();
    return result;
  });
  const until = async (done: () => boolean) => {
    while (!done()) await new Promise<void>(resolve => (notify = resolve));
  };
  return { claims, reads, until };
}

/**
 * Delays every lease release the way a remote store's round trip does, so a
 * follow-up a step publishes (its retry, the next loop iteration) is delivered
 * before the step's own lease is released.
 */
async function delayReleases(storage: Store) {
  const store = (await storage.getStore('workflows'))!;
  const release = store.releaseRunOwnership.bind(store);
  vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return release(fence);
  });
}

/** Records every step occurrence a replica runs, and holds replica A's `blocks` until `release` is called. */
function track(shape: Pick<Shape, 'blocks'>, { hangForever = false } = {}) {
  const executions: string[] = [];
  const at: Record<string, number> = {};
  const gate = Promise.withResolvers<void>();
  const allBlocked = Promise.withResolvers<void>();
  const otherReplicaRan = Promise.withResolvers<void>();
  let blocked = 0;
  const reporter =
    (replica: string): Report =>
    async label => {
      executions.push(`${replica}:${label}`);
      at[`${replica}:${label}`] = Date.now();
      if (replica !== 'A') return otherReplicaRan.resolve();
      if (!shape.blocks.includes(label)) return;
      if (++blocked === shape.blocks.length) allBlocked.resolve();
      await (hangForever ? new Promise<never>(() => {}) : gate.promise);
    };
  return { executions, at, reporter, release: gate.resolve, allBlocked: allBlocked.promise, otherReplicaRan };
}

/** The stored status of the `leased` workflow's run. */
async function runStatus(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return (await store.loadWorkflowSnapshot({ workflowName: 'leased', runId }))?.status;
}

/** Whether the run's liveness key is live; `undefined` when it was never written. */
async function runIsLive(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return (await store.getRunOwnership({ runId: runLivenessKey(runId) }))?.live;
}

/** Restarts the run from `replica`: `resolved:<status>`, or the error id and lease expiry it threw. */
async function restartOutcome(replica: { workflow: Built }, runId: string) {
  return (await replica.workflow.createRun({ runId })).restart().then(
    result => ({ id: `resolved:${result.status}`, leaseExpiresAt: undefined }),
    (error: { id?: string; details?: { leaseExpiresAt?: string | null } }) => ({
      id: error.id,
      leaseExpiresAt: error.details?.leaseExpiresAt,
    }),
  );
}

/** Waits `ms`, for the tests that must let a lease TTL pass. */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('evented step leases (#28712)', () => {
  it.each(Object.keys(shapes) as (keyof typeof shapes)[])(
    '%s: a redelivered step another replica is running waits and is dropped once that replica finishes it',
    async name => {
      const shape = shapes[name];
      const storage = new InMemoryStore();
      await delayReleases(storage);
      const tracked = track(shape);
      const delivered: Event[] = [];
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      await a.pubsub.subscribe('workflows', event => {
        if (event.type === 'workflow.step.run') delivered.push(structuredClone(event));
      });

      const result = (await a.workflow.createRun()).start({ inputData: shape.input as any });
      await tracked.allBlocked;

      // The broker redelivers the messages of the running occurrences to B.
      const leases = await recordLeases(storage);
      const redeliveries = shape.running.map(path => {
        const event = delivered.findLast(e => isStepRunAt(e, path))!;
        return b.mastra.handleWorkflowEvent({ ...event, deliveryAttempt: 2 });
      });
      await Promise.race([
        leases.until(() => leases.claims.filter(c => !c.acquired).length >= shape.running.length),
        tracked.otherReplicaRan.promise,
      ]);
      tracked.release();

      expect((await result).status).toBe('success');
      expect(await Promise.all(redeliveries)).toEqual(shape.running.map(() => ({ ok: true })));
      expect(tracked.executions.sort()).toEqual(shape.labels.map(label => `A:${label}`).sort());
    },
    20_000,
  );

  it('runs every retry of a failing step once while its first attempt is redelivered', async () => {
    const storage = new InMemoryStore();
    await delayReleases(storage);
    const executions: string[] = [];
    const firstAttempt = Promise.withResolvers<void>();
    const failFirstAttempt = Promise.withResolvers<void>();
    const otherReplicaRan = Promise.withResolvers<void>();
    const build = (replica: string) => {
      let attempts = 0;
      const flaky = createStep({
        id: 'flaky',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => {
          executions.push(`${replica}:attempt-${++attempts}`);
          if (replica !== 'A') otherReplicaRan.resolve();
          else if (attempts === 1) {
            firstAttempt.resolve();
            await failFirstAttempt.promise;
            throw new Error('transient');
          }
          return inputData;
        },
      });
      return createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
        .then(flaky)
        .commit();
    };
    const a = await startReplica(storage, build('A'));
    const b = await startReplica(storage, build('B'));
    let firstDelivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (isStepRunAt(event, [0])) firstDelivery ??= structuredClone(event);
    });

    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await firstAttempt.promise;
    const leases = await recordLeases(storage);
    const redelivery = b.mastra.handleWorkflowEvent({ ...firstDelivery!, deliveryAttempt: 2 });
    await Promise.race([leases.until(() => leases.claims.some(c => !c.acquired)), otherReplicaRan.promise]);
    // The retry takes the lease over from the failed attempt; B keeps waiting behind it.
    failFirstAttempt.resolve();

    expect((await result).status).toBe('success');
    expect(await redelivery).toEqual({ ok: true });
    expect(executions).toEqual(['A:attempt-1', 'A:attempt-2']);
  }, 20_000);

  it('runs a retry whose first receiver crashed after taking it over', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const retried = Promise.withResolvers<Event>();
    // The retry A publishes goes to another replica instead of A.
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      event.type === 'workflow.step.run' && (event.data as { retryCount?: number }).retryCount === 1
        ? { divert: retried.resolve }
        : undefined,
    );
    const build = (replica: string) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
        .then(
          createStep({
            id: 'flaky',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push(replica);
              if (replica === 'A') throw new Error('transient');
              return inputData;
            },
          }),
        )
        .commit();
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    const retry = await retried.promise;

    // The replica the retry went to first took the step lease over, then crashed before running it.
    const { key, generation } = (retry.data as { stepLeaseHandoff: { key: string; generation: number } })
      .stepLeaseHandoff;
    await store.claimRunOwnership({
      runId: key,
      ownerId: 'crashed-adopter',
      leaseMs: 1,
      force: true,
      expectedGeneration: generation,
    });
    await sleep(5);

    expect(await b.mastra.handleWorkflowEvent({ ...retry, deliveryAttempt: 2 })).toEqual({ ok: true });
    expect(executions).toEqual(['A', 'B']);
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
  }, 20_000);

  it('runs a failed step again at once when publishing its retry failed', async () => {
    const storage = new InMemoryStore();
    const attemptsAt: number[] = [];
    let rejected = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (rejected || event.type !== 'workflow.step.run' || (event.data as { retryCount?: number }).retryCount !== 1) {
        return undefined;
      }
      rejected = true;
      return { reject: new Error('broker unavailable') };
    });
    const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
      .then(
        createStep({
          id: 'flaky',
          inputSchema: Num,
          outputSchema: Num,
          execute: async () => {
            attemptsAt.push(Date.now());
            throw new Error('transient');
          },
        }),
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built, { pubsub });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');

    // The delivery whose retry could not be published is redelivered and runs the first attempt
    // again, then the retry runs. The redelivery finds the step lease released, so it does not
    // wait for the lease to expire first.
    expect(rejected).toBe(true);
    expect(attemptsAt).toHaveLength(3);
    expect(attemptsAt[1]! - attemptsAt[0]!).toBeLessThan(
      WORKFLOW_RUN_LEASE_TTL_MS - WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS,
    );
  }, 20_000);

  it('runs a redelivered step once the lease of its crashed worker expires', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const tracked = track({ blocks: ['a'] }, { hangForever: true });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
    let delivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (event.type === 'workflow.step.run') delivery = structuredClone(event);
    });
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    // A crashes mid-step: its lease stops being renewed and runs out.
    await a.mastra.shutdown({ drainTimeout: 0 });
    const crashed = await store.claimRunOwnership({
      runId: stepOccurrenceKey(run.runId, [0]),
      ownerId: 'crashed-worker',
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: true,
    });

    // The broker redelivers A's unacknowledged message to B.
    expect(await b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 2 })).toEqual({ ok: true });

    expect(tracked.executions).toEqual(['A:a', 'B:a']);
    expect(tracked.at['B:a']).toBeGreaterThanOrEqual(crashed.record!.leaseExpiresAt!.getTime());
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
  }, 20_000);

  it('hands a waiting delivery back to the broker when its replica shuts down', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['a'] });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
    let delivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (event.type === 'workflow.step.run') delivery = structuredClone(event);
    });
    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    const leases = await recordLeases(storage);
    const waiting = b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 2 });
    await leases.until(() => leases.claims.some(c => !c.acquired));
    void b.mastra.shutdown({ drainTimeout: 0 });

    expect(await Promise.race([waiting, sleep(WORKFLOW_RUN_LEASE_TTL_MS * 3).then(() => 'still waiting')])).toEqual({
      ok: false,
      retry: true,
    });
    tracked.release();
    expect((await result).status).toBe('success');
    expect(tracked.executions).toEqual(['A:a']);
  }, 20_000);

  it('does not fail a run when a delivery of its running step has used up its attempts', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['a'] });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
    let delivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (event.type === 'workflow.step.run') delivery = structuredClone(event);
    });
    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    // Replicas that shut down while this delivery waited for A handed it back, and the broker
    // counted every hand-back as a delivery attempt.
    expect(await b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 10 })).toEqual({ ok: true });

    tracked.release();
    expect((await result).status).toBe('success');
    expect(tracked.executions).toEqual(['A:a']);
  }, 20_000);

  it('recovers a run once when the replica running its step crashes after an exhausted delivery was dropped', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['a'] }, { hangForever: true });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
    let delivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (event.type === 'workflow.step.run') delivery = structuredClone(event);
    });
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;
    expect(await b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 10 })).toEqual({ ok: true });

    // The dropped delivery can no longer bring the step back, so B re-checks the run itself.
    await crash(a, storage, [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]);

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 15_000 });
    expect(tracked.executions).toEqual(['A:a', 'B:a']);
  }, 30_000);

  it('runs a step once when three replicas boot after the replica running it crashed', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const tracked = track({ blocks: ['a'] }, { hangForever: true });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    // A crashes mid-step. Its step lease and the run's liveness run out one TTL later.
    await a.mastra.shutdown({ drainTimeout: 0 });
    let expiresAt = 0;
    for (const key of [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]) {
      const { record } = await store.claimRunOwnership({
        runId: key,
        ownerId: 'crashed-worker',
        leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
        force: true,
      });
      expiresAt = Math.max(expiresAt, record!.leaseExpiresAt!.getTime());
    }

    const booting = await Promise.all(
      ['B', 'C', 'D'].map(name => startReplica(storage, shapes.step.build(tracked.reporter(name)))),
    );
    await Promise.all(booting.map(replica => replica.mastra.restartAllActiveWorkflowRuns()));
    expect(tracked.executions).toEqual(['A:a']);

    // The sweeps re-check once the leases could have lapsed, and one of them recovers the run.
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 15_000 });
    const recovered = tracked.executions.filter(e => !e.startsWith('A:'));
    expect(recovered).toHaveLength(1);
    expect(tracked.at[recovered[0]!]).toBeGreaterThanOrEqual(expiresAt);
  }, 30_000);

  it.each(['step', 'parallel', 'conditional', 'foreach', 'loop'] as const)(
    '%s: two replicas restarting a crashed run at once run each step once',
    async name => {
      const shape = shapes[name];
      // The crashed loop was in its second iteration, so the restart runs that iteration and the third.
      const iteration = name === 'loop' ? 1 : undefined;
      const recoveredLabels = name === 'loop' ? ['body:2', 'body:3'] : shape.labels;
      const storage = new InMemoryStore();
      const tracked = track(shape, { hangForever: true });
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const run = await a.workflow.createRun();
      void run.start({ inputData: shape.input as any });
      await tracked.allBlocked;
      await crash(a, storage, [
        ...shape.running.map(path => stepOccurrenceKey(run.runId, path, iteration)),
        runLivenessKey(run.runId),
      ]);

      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      const c = await startReplica(storage, shape.build(tracked.reporter('C')));
      const restarts = await Promise.all([restartOutcome(b, run.runId), restartOutcome(c, run.runId)]);

      expect(restarts.map(r => r.id).sort()).toEqual(['WORKFLOW_RESTART_RUN_OWNED', 'resolved:success']);
      const recovered = tracked.executions.filter(e => !e.startsWith('A:')).map(e => e.slice(2));
      expect(recovered.sort()).toEqual([...recoveredLabels].sort());
    },
    20_000,
  );

  it.each(['start', 'startAsync'] as const)(
    'leaves a run started with %s() to the replica running it when two replicas boot',
    async method => {
      const storage = new InMemoryStore();
      const tracked = track({ blocks: ['a'] });
      const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
      const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
      const c = await startReplica(storage, shapes.step.build(tracked.reporter('C')));
      const run = await a.workflow.createRun();
      if (method === 'start') void run.start({ inputData: { n: 1 } });
      else await run.startAsync({ inputData: { n: 1 } });
      await tracked.allBlocked;
      const blockedSince = Date.now();

      // Both sweeps are refused, then re-check the run once the liveness they saw could have
      // lapsed. A keeps it fresh, so at least one re-check is refused as well.
      const leases = await recordLeases(storage);
      await Promise.all([b.mastra.restartAllActiveWorkflowRuns(), c.mastra.restartAllActiveWorkflowRuns()]);
      await leases.until(() => leases.reads.filter(key => key === runLivenessKey(run.runId)).length >= 3);
      await sleep(Math.max(0, blockedSince + WORKFLOW_RUN_LEASE_TTL_MS * 2 - Date.now()));

      tracked.release();
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it.each([
    ['its start event is still queued', false],
    ['its first step event is queued after its start event sat queued for a lease TTL', true],
  ] as const)(
    'leaves a just-started run to its replica while %s',
    async (_, startQueuedPastTtl) => {
      const storage = new InMemoryStore();
      const tracked = track({ blocks: [] });
      const startQueued = Promise.withResolvers<void>();
      const deliverStart = Promise.withResolvers<void>();
      const stepQueued = Promise.withResolvers<void>();
      const deliverStep = Promise.withResolvers<void>();
      // The events that start the run and its first step sit in the broker's queue for a while.
      const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
        if (event.type === 'workflow.start') {
          startQueued.resolve();
          return { hold: deliverStart.promise };
        }
        if (!startQueuedPastTtl || !isStepRunAt(event, [0])) return undefined;
        stepQueued.resolve();
        return { hold: deliverStep.promise };
      });
      const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')), { pubsub });
      const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
      const run = await a.workflow.createRun();
      // startAsync() resolves once its start event is published, which the queue holds back here.
      const started = run.startAsync({ inputData: { n: 1 } });
      await startQueued.promise;
      if (startQueuedPastTtl) {
        // The liveness the caller wrote lapses; the worker taking the start event writes it again.
        await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
        expect(await runIsLive(storage, run.runId)).toBe(false);
        deliverStart.resolve();
        await stepQueued.promise;
      }

      await b.mastra.restartAllActiveWorkflowRuns();
      deliverStart.resolve();
      deliverStep.resolve();
      await started;

      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it('leaves a time-travelled run to its replica while its start event is still queued', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    let holding = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!holding || event.type !== 'workflow.start') return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    // The step fails for the run's input, and the run is time travelled with a corrected one.
    const build = (replica: string) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'a',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push(`${replica}:${inputData.n}`);
              if (inputData.n === 1) throw new Error('bad input');
              return inputData;
            },
          }),
        )
        .commit();
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');
    // The failed run's liveness lapses before it is time travelled.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect(await runIsLive(storage, run.runId)).toBe(false);

    holding = true;
    const travelled = (await a.workflow.createRun({ runId: run.runId })).timeTravel({ step: 'a', inputData: { n: 2 } });
    await queued.promise;
    await b.mastra.restartAllActiveWorkflowRuns();
    deliver.resolve();

    expect((await travelled).status).toBe('success');
    expect(executions).toEqual(['A:1', 'A:2']);
  }, 20_000);

  it('leaves a parent run to its replica while the resume of its nested run is still queued', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    let holding = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!holding || event.type !== 'workflow.resume') return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    const build = (replica: string) => {
      const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'approve',
            inputSchema: Num,
            outputSchema: Num,
            resumeSchema: z.object({ approved: z.boolean() }),
            execute: async ({ inputData, resumeData, suspend }) => {
              executions.push(`${replica}:${resumeData ? 'resumed' : 'suspended'}`);
              return resumeData ? inputData : suspend({});
            },
          }),
        )
        .commit();
      const parent = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit();
      return { parent: parent as unknown as Built, child: child as unknown as Built };
    };
    const onA = build('A');
    const onB = build('B');
    const a = await startReplica(storage, onA.parent, { pubsub, nested: { child: onA.child } });
    const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('suspended');
    const parentSnapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
    const nestedRunId = (parentSnapshot?.context.child as { suspendPayload?: any }).suspendPayload?.__workflow_meta
      ?.runId as string;
    // The suspended runs' liveness lapses before the nested run is resumed.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect(await runIsLive(storage, run.runId)).toBe(false);
    expect(await runIsLive(storage, nestedRunId)).toBe(false);

    // Resuming the nested run directly makes its parent `running` again too.
    holding = true;
    const resumed = (await onA.child.createRun({ runId: nestedRunId })).resume({ resumeData: { approved: true } });
    await queued.promise;
    await b.mastra.restartAllActiveWorkflowRuns();
    deliver.resolve();

    expect((await resumed).status).toBe('success');
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions).toEqual(['A:suspended', 'A:resumed']);
  }, 20_000);

  it('refuses to restart a run between one step finishing and the next one starting', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: [] });
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    const build = (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('first', report))
        .then(work('second', report))
        .commit();
    // The message starting the second step sits in the broker's queue for a while.
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!isStepRunAt(event, [1])) return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    const a = await startReplica(storage, build(tracked.reporter('A')), { pubsub });
    const b = await startReplica(storage, build(tracked.reporter('B')));
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: { n: 1 } });
    await queued.promise;

    expect((await restartOutcome(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    deliver.resolve();
    expect((await result).status).toBe('success');
    expect(tracked.executions).toEqual(['A:first', 'A:second']);
  }, 20_000);

  it('refuses to restart a parallel run while a branch runs on another replica', async () => {
    const storage = new InMemoryStore();
    const branchA = Promise.withResolvers<void>();
    const branchB = Promise.withResolvers<void>();
    const executions: string[] = [];
    const started = { a: Promise.withResolvers<void>(), b: Promise.withResolvers<void>() };
    const build = (replica: string) =>
      shapes.parallel.build(async label => {
        executions.push(`${replica}:${label}`);
        if (replica === 'C') return;
        started[label as 'a' | 'b'].resolve();
        await (label === 'a' ? branchA : branchB).promise;
      });
    // Branch b's message goes to replica B instead of A.
    const diverted = Promise.withResolvers<Event>();
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      isStepRunAt(event, [0, 1]) ? { divert: diverted.resolve } : undefined,
    );
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const c = await startReplica(storage, build('C'));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    const onB = b.mastra.handleWorkflowEvent(await diverted.promise);
    await Promise.all([started.a.promise, started.b.promise]);

    expect((await restartOutcome(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    // Branch a finishes on A, and A has been idle for longer than a lease TTL; B still runs branch b.
    branchA.resolve();
    await vi.waitFor(async () => {
      const store = (await storage.getStore('workflows'))!;
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
      expect(snapshot?.context.a?.status).toBe('success');
    });
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect((await restartOutcome(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    branchB.resolve();
    expect(await onB).toEqual({ ok: true });
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions.sort()).toEqual(['A:a', 'B:b']);
  }, 20_000);

  it.each(['then', 'foreach'] as const)(
    'refuses to restart a parent run while a step of a nested workflow it started with .%s() runs',
    async kind => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const tracked = track({ blocks: ['inner:1'] });
      const build = (replica: string) => {
        const report = tracked.reporter(replica);
        const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
          .then(
            createStep({
              id: 'inner',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                await report(`inner:${inputData.n}`);
                return inputData;
              },
            }),
          )
          .commit();
        const parent =
          kind === 'then'
            ? createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit()
            : createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
                .foreach(child, { concurrency: 2 })
                .commit();
        return { parent: parent as unknown as Built, child: child as unknown as Built };
      };
      const onA = build('A');
      const onB = build('B');
      const a = await startReplica(storage, onA.parent, { nested: { child: onA.child } });
      const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
      const run = await a.workflow.createRun();
      const result = run.start({ inputData: (kind === 'then' ? { n: 1 } : [{ n: 1 }, { n: 2 }]) as any });
      await tracked.allBlocked;
      if (kind === 'foreach') {
        // The second item's nested run finished; only the first item's nested run still runs.
        await vi.waitFor(async () => {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
          expect((snapshot?.context.child as { output?: unknown[] } | undefined)?.output?.[1]).toBeTruthy();
        });
      }

      // The parent's step only dispatched the nested run; its own liveness lapses while the nested step runs.
      await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
      expect((await restartOutcome(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

      tracked.release();
      expect((await result).status).toBe('success');
      expect(tracked.executions.sort()).toEqual(kind === 'then' ? ['A:inner:1'] : ['A:inner:1', 'A:inner:2']);
    },
    20_000,
  );

  it('writes the liveness of a run about once per renew interval however many of its steps run at once', async () => {
    const storage = new InMemoryStore();
    const leases = await recordLeases(storage);
    const workflow = createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
      .foreach(
        work('item', async () => {}),
        { concurrency: 10 },
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built);
    const startedAt = Date.now();
    const result = await (
      await a.workflow.createRun()
    ).start({
      inputData: Array.from({ length: 10 }, (_, n) => ({ n })) as any,
    });
    expect(result.status).toBe('success');

    const writes = leases.claims.filter(c => c.key.endsWith('::live')).length;
    // The liveness timer ticks at the renew interval, or at a third of the TTL when that is shorter.
    const tick = Math.min(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 3));
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(writes).toBeLessThanOrEqual(1 + Math.ceil((Date.now() - startedAt) / tick));
  }, 20_000);

  it('takes no step lease and no liveness for a workflow that opted out of restarts', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const report: Report = async () => {};
    const optedOut = createWorkflow({
      id: 'opted-out',
      inputSchema: Num,
      outputSchema: Num,
      options: { autoRestartActiveRuns: false },
    })
      .then(work('a', report))
      .commit();
    const leased = shapes.step.build(report);
    const mastra = new Mastra({ logger: false, storage, workflows: { optedOut, leased } });
    replicas.push(mastra);
    await mastra.startWorkers();

    const optedOutRun = await optedOut.createRun();
    const leasedRun = await leased.createRun();
    expect((await optedOutRun.start({ inputData: { n: 1 } })).status).toBe('success');
    expect((await leasedRun.start({ inputData: { n: 1 } })).status).toBe('success');

    const lease = (key: string) => store.getRunOwnership({ runId: key });
    expect(await lease(stepOccurrenceKey(optedOutRun.runId, [0]))).toBeNull();
    expect(await lease(runLivenessKey(optedOutRun.runId))).toBeNull();
    expect(await lease(stepOccurrenceKey(leasedRun.runId, [0]))).toMatchObject({ live: false });
    expect(await lease(runLivenessKey(leasedRun.runId))).toMatchObject({ live: true });
  });
});
