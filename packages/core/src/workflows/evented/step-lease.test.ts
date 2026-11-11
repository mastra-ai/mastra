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
 * Wraps a pubsub so a `workflow.step.run` the test picks out is held back
 * (`hold` resolves when it may go on) or kept from this replica entirely
 * (`divert` receives it instead).
 */
function interceptStepRuns(
  inner: PubSub,
  pick: (event: Event) => { hold?: Promise<void>; divert?: (event: Event) => void } | undefined,
) {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          const picked = topic === 'workflows' && event.type === 'workflow.step.run' ? pick(event) : undefined;
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

const pathIs = (event: Event, path: number[]) =>
  JSON.stringify((event.data as { executionPath?: number[] }).executionPath) === JSON.stringify(path);

/** Records every lease claim made on the shared store, and waits for claims matching a condition. */
async function recordClaims(storage: Store) {
  const store = (await storage.getStore('workflows'))!;
  const claim = store.claimRunOwnership.bind(store);
  const claims: { key: string; acquired: boolean; at: number }[] = [];
  let notify = () => {};
  vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
    const result = await claim(args);
    claims.push({ key: args.runId, acquired: result.acquired, at: Date.now() });
    notify();
    return result;
  });
  const until = async (done: () => boolean) => {
    while (!done()) await new Promise<void>(resolve => (notify = resolve));
  };
  const livenessWrites = () => claims.filter(c => c.key.endsWith('::live')).length;
  return { claims, until, livenessWrites };
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

async function runStatus(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return (await store.loadWorkflowSnapshot({ workflowName: 'leased', runId }))?.status;
}

async function restartError(replica: { workflow: Built }, runId: string) {
  return (await replica.workflow.createRun({ runId })).restart().then(
    result => ({ id: `resolved:${result.status}`, leaseExpiresAt: undefined }),
    (error: { id?: string; details?: { leaseExpiresAt?: string | null } }) => ({
      id: error.id,
      leaseExpiresAt: error.details?.leaseExpiresAt,
    }),
  );
}

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
      const recorder = await recordClaims(storage);
      const redeliveries = shape.running.map(path => {
        const event = delivered.findLast(e => pathIs(e, path))!;
        return b.mastra.handleWorkflowEvent({ ...event, deliveryAttempt: 2 });
      });
      await Promise.race([
        recorder.until(() => recorder.claims.filter(c => !c.acquired).length >= shape.running.length),
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
      if (event.type === 'workflow.step.run' && pathIs(event, [0])) firstDelivery ??= structuredClone(event);
    });

    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await firstAttempt.promise;
    const recorder = await recordClaims(storage);
    const redelivery = b.mastra.handleWorkflowEvent({ ...firstDelivery!, deliveryAttempt: 2 });
    await Promise.race([recorder.until(() => recorder.claims.some(c => !c.acquired)), otherReplicaRan.promise]);
    // The retry takes the lease over from the failed attempt; B keeps waiting behind it.
    failFirstAttempt.resolve();

    expect((await result).status).toBe('success');
    expect(await redelivery).toEqual({ ok: true });
    expect(executions).toEqual(['A:attempt-1', 'A:attempt-2']);
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

  it.each(['step', 'parallel', 'conditional', 'foreach'] as const)(
    '%s: two replicas restarting a crashed run at once run each step once',
    async name => {
      const shape = shapes[name];
      const storage = new InMemoryStore();
      const tracked = track(shape, { hangForever: true });
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const run = await a.workflow.createRun();
      void run.start({ inputData: shape.input as any });
      await tracked.allBlocked;
      await crash(a, storage, [
        ...shape.running.map(path => stepOccurrenceKey(run.runId, path)),
        runLivenessKey(run.runId),
      ]);

      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      const c = await startReplica(storage, shape.build(tracked.reporter('C')));
      const restarts = await Promise.all([restartError(b, run.runId), restartError(c, run.runId)]);

      expect(restarts.map(r => r.id).sort()).toEqual(['WORKFLOW_RESTART_RUN_OWNED', 'resolved:success']);
      const recovered = tracked.executions.filter(e => !e.startsWith('A:')).map(e => e.slice(2));
      expect(recovered.sort()).toEqual([...shape.labels].sort());
    },
    20_000,
  );

  it.each(['start', 'startAsync'] as const)(
    'refuses to restart a run another replica is running, started with %s()',
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

      const refusals = await Promise.all([restartError(b, run.runId), restartError(c, run.runId)]);
      expect(refusals).toEqual([
        { id: 'WORKFLOW_RESTART_RUN_OWNED', leaseExpiresAt: expect.any(String) },
        { id: 'WORKFLOW_RESTART_RUN_OWNED', leaseExpiresAt: expect.any(String) },
      ]);

      tracked.release();
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

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
    const pubsub = interceptStepRuns(new EventEmitterPubSub(), event => {
      if (!pathIs(event, [1])) return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    const a = await startReplica(storage, build(tracked.reporter('A')), { pubsub });
    const b = await startReplica(storage, build(tracked.reporter('B')));
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: { n: 1 } });
    await queued.promise;

    expect((await restartError(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

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
    const pubsub = interceptStepRuns(new EventEmitterPubSub(), event =>
      pathIs(event, [0, 1]) ? { divert: diverted.resolve } : undefined,
    );
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const c = await startReplica(storage, build('C'));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    const onB = b.mastra.handleWorkflowEvent(await diverted.promise);
    await Promise.all([started.a.promise, started.b.promise]);

    expect((await restartError(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    // Branch a finishes on A, and A has been idle for longer than a lease TTL; B still runs branch b.
    branchA.resolve();
    await vi.waitFor(async () => {
      const store = (await storage.getStore('workflows'))!;
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
      expect(snapshot?.context.a?.status).toBe('success');
    });
    await new Promise(resolve => setTimeout(resolve, WORKFLOW_RUN_LEASE_TTL_MS + 100));
    expect((await restartError(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    branchB.resolve();
    expect(await onB).toEqual({ ok: true });
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions.sort()).toEqual(['A:a', 'B:b']);
  }, 20_000);

  it('refuses to restart a parent run while a step of its nested workflow runs', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['inner'] });
    const build = (replica: string) => {
      const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .then(work('inner', tracked.reporter(replica)))
        .commit();
      const parent = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num }).then(child).commit();
      return { parent, child };
    };
    const onA = build('A');
    const onB = build('B');
    const a = await startReplica(storage, onA.parent, { nested: { child: onA.child } });
    const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    // The parent's step only dispatched the nested run; its own liveness lapses while the nested step runs.
    await new Promise(resolve => setTimeout(resolve, WORKFLOW_RUN_LEASE_TTL_MS + 100));
    expect((await restartError(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    tracked.release();
    expect((await result).status).toBe('success');
    expect(tracked.executions).toEqual(['A:inner']);
  }, 20_000);

  it('lets a finished run stop counting as live one lease TTL after its last step', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const tracked = track({ blocks: [] });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
    const live = async () => (await store.getRunOwnership({ runId: runLivenessKey(run.runId) }))?.live;

    expect(await live()).toBe(true);
    await vi.waitFor(async () => expect(await live()).toBe(false), { timeout: WORKFLOW_RUN_LEASE_TTL_MS * 3 });

    // Restarting a finished run still returns its stored result without running anything.
    expect((await restartError(a, run.runId)).id).toBe('resolved:success');
    expect(tracked.executions).toEqual(['A:a']);
  }, 20_000);

  it('writes the liveness of a run once per renew interval however many of its steps run at once', async () => {
    const storage = new InMemoryStore();
    const recorder = await recordClaims(storage);
    const allStarted = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let started = 0;
    const workflow = createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
      .foreach(
        createStep({
          id: 'item',
          inputSchema: Num,
          outputSchema: Num,
          execute: async ({ inputData }) => {
            if (++started === 10) allStarted.resolve();
            await finish.promise;
            return inputData;
          },
        }),
        { concurrency: 10 },
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built);
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: Array.from({ length: 10 }, (_, n) => ({ n })) as any });
    await allStarted.promise;
    expect(recorder.livenessWrites()).toBe(1);

    const runningSince = Date.now();
    await new Promise(resolve => setTimeout(resolve, WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 3));
    const intervals = (Date.now() - runningSince) / WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS;
    expect(recorder.livenessWrites() - 1).toBeLessThanOrEqual(Math.ceil(intervals));
    expect(recorder.livenessWrites() - 1).toBeGreaterThanOrEqual(Math.floor(intervals) - 1);

    finish.resolve();
    expect((await result).status).toBe('success');
  }, 20_000);

  it('writes the liveness of a run once for quick steps that follow each other', async () => {
    const storage = new InMemoryStore();
    const recorder = await recordClaims(storage);
    const report: Report = async () => {};
    const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
      .then(work('s1', report))
      .then(work('s2', report))
      .then(work('s3', report))
      .then(work('s4', report))
      .then(work('s5', report))
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built);
    const startedAt = Date.now();
    expect((await (await a.workflow.createRun()).start({ inputData: { n: 1 } })).status).toBe('success');

    const stepClaims = recorder.claims.filter(c => c.key.includes('::step:'));
    expect(stepClaims).toHaveLength(5);
    const intervals = Math.floor((Date.now() - startedAt) / WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS);
    expect(recorder.livenessWrites()).toBeGreaterThanOrEqual(1);
    expect(recorder.livenessWrites()).toBeLessThanOrEqual(1 + intervals);
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
