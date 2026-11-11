/**
 * Booting replicas restart every active evented run they find. An evented run
 * holds no run lease, so a replica used to restart runs another replica was
 * still executing, and each step ran once per booting replica (#28712). The
 * worker running a step now holds a lease on that step occurrence.
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
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../run-ownership';
import { stepOccurrenceKey } from './step-lease';
import { abandonLease } from './test-utils/abandon-lease';
import { createStep, createWorkflow } from '.';

const Num = z.object({ n: z.number() });
type Report = (label: string) => Promise<void>;

/** A step that reports `label` (its id by default) before returning its input. */
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
 * foreach item or the loop iteration. `crashed` lists the execution paths of
 * the occurrences running in `blocks`.
 */
const shapes = {
  step: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(work('a', report)).commit(),
    labels: ['a'],
    blocks: ['a'],
    crashed: [[0]],
  },
  parallel: {
    input: { n: 0 },
    build: (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
        .parallel([work('a', report), work('b', report)])
        .commit(),
    labels: ['a', 'b'],
    blocks: ['a', 'b'],
    crashed: [
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
    crashed: [[0, 0]],
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
    crashed: [
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
    crashed: [],
  },
};
type Shape = (typeof shapes)[keyof typeof shapes];

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.stopWorkers({ drainTimeout: 0 })));
});

async function startReplica<W extends ReturnType<Shape['build']>>(
  storage: InstanceType<typeof InMemoryStore>,
  workflow: W,
) {
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { leased: workflow as any } });
  await mastra.startWorkers();
  replicas.push(mastra);
  return { mastra, pubsub, workflow };
}

/** Resolves once step lease claims for `count` distinct occurrences were refused because another worker held them. */
async function refusedStepClaims(storage: InstanceType<typeof InMemoryStore>, count: number) {
  const store = (await storage.getStore('workflows'))!;
  const claim = store.claimRunOwnership.bind(store);
  const refused = new Set<string>();
  const done = Promise.withResolvers<void>();
  vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
    const result = await claim(args);
    if (!result.acquired && args.runId.includes('::step:')) refused.add(args.runId);
    if (refused.size >= count) done.resolve();
    return result;
  });
  return done.promise;
}

/**
 * Delays every lease release the way a remote store's round trip does, so a
 * follow-up a step publishes (its retry, the next loop iteration) is delivered
 * before the step's own lease is released.
 */
async function delayReleases(storage: InstanceType<typeof InMemoryStore>) {
  const store = (await storage.getStore('workflows'))!;
  const release = store.releaseRunOwnership.bind(store);
  vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return release(fence);
  });
}

/** Records every step occurrence a replica runs, and hangs replica A's `blocks` until `release` is called. */
function track(shape: Shape, { hangForever = false } = {}) {
  const executions: string[] = [];
  const gate = Promise.withResolvers<void>();
  const allBlocked = Promise.withResolvers<void>();
  const otherReplicaRan = Promise.withResolvers<void>();
  let blocked = 0;
  const reporter =
    (replica: string): Report =>
    async label => {
      executions.push(`${replica}:${label}`);
      if (replica !== 'A') return otherReplicaRan.resolve();
      if (!shape.blocks.includes(label)) return;
      if (++blocked === shape.blocks.length) allBlocked.resolve();
      await (hangForever ? new Promise<never>(() => {}) : gate.promise);
    };
  return { executions, reporter, release: gate.resolve, allBlocked: allBlocked.promise, otherReplicaRan };
}

describe('evented step leases (#28712)', () => {
  it.each(Object.keys(shapes) as (keyof typeof shapes)[])(
    '%s: a replica booting mid-run does not run the steps another replica is running',
    async name => {
      const shape = shapes[name];
      const storage = new InMemoryStore();
      await delayReleases(storage);
      const tracked = track(shape);
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const b = await startReplica(storage, shape.build(tracked.reporter('B')));

      const run = await a.workflow.createRun();
      const result = run.start({ inputData: shape.input as any });
      await tracked.allBlocked;

      // B restarts the run while A is still running it. Its deliveries wait on A's leases.
      const held = refusedStepClaims(storage, shape.blocks.length);
      void b.mastra.restartAllActiveWorkflowRuns();
      await Promise.race([held, tracked.otherReplicaRan.promise]);
      tracked.release();

      expect((await result).status).toBe('success');
      // B's waiting deliveries settle once A released its leases.
      await b.mastra.stopWorkers({ drainTimeout: 10_000 });
      expect(tracked.executions.sort()).toEqual(shape.labels.map(label => `A:${label}`).sort());
    },
    20_000,
  );

  it('runs every retry of a failing step once while a booting replica restarts the run', async () => {
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

    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await firstAttempt.promise;
    const held = refusedStepClaims(storage, 1);
    void b.mastra.restartAllActiveWorkflowRuns();
    await Promise.race([held, otherReplicaRan.promise]);
    // The retry takes the lease over from the failed attempt; B keeps waiting behind it.
    failFirstAttempt.resolve();

    expect((await result).status).toBe('success');
    await b.mastra.stopWorkers({ drainTimeout: 10_000 });
    expect(executions).toEqual(['A:attempt-1', 'A:attempt-2']);
  }, 20_000);

  it('runs a redelivered step once the lease of its crashed worker expires', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: { replica: string; at: number }[] = [];
    const started = Promise.withResolvers<void>();
    const build = (replica: string) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'a',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push({ replica, at: Date.now() });
              if (replica === 'A') {
                started.resolve();
                await new Promise<never>(() => {});
              }
              return inputData;
            },
          }),
        )
        .commit();
    const a = await startReplica(storage, build('A'));
    const b = await startReplica(storage, build('B'));

    let delivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (event.type === 'workflow.step.run') delivery = structuredClone(event);
    });
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    await started.promise;

    // A crashes mid-step: its lease stops being renewed and runs out.
    const crashed = await store.claimRunOwnership({
      runId: stepOccurrenceKey(run.runId, [0]),
      ownerId: 'crashed-worker',
      leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
      force: true,
    });
    const leaseExpiresAt = crashed.record!.leaseExpiresAt!.getTime();

    // The broker redelivers A's unacknowledged message to B.
    expect(await b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 2 })).toEqual({ ok: true });

    expect(executions.map(e => e.replica)).toEqual(['A', 'B']);
    expect(executions[1]!.at).toBeGreaterThanOrEqual(leaseExpiresAt);
    await vi.waitFor(async () =>
      expect((await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId }))?.status).toBe('success'),
    );
  }, 20_000);

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
      for (const path of shape.crashed) await abandonLease(storage, stepOccurrenceKey(run.runId, path));

      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      const c = await startReplica(storage, shape.build(tracked.reporter('C')));
      const restarts = await Promise.allSettled([
        (await b.workflow.createRun({ runId: run.runId })).restart(),
        (await c.workflow.createRun({ runId: run.runId })).restart(),
      ]);

      expect(restarts.filter(r => r.status === 'fulfilled').map(r => r.value.status)).toEqual(['success']);
      expect(restarts.filter(r => r.status === 'rejected').map(r => r.reason.id)).toEqual([
        'WORKFLOW_RESTART_RUN_OWNED',
      ]);
      const recovered = tracked.executions.filter(e => !e.startsWith('A:')).map(e => e.slice(2));
      expect(recovered.sort()).toEqual([...shape.labels].sort());
    },
    20_000,
  );

  it('takes no step lease for a workflow that opted out of restarts', async () => {
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

    expect(await store.getRunOwnership({ runId: stepOccurrenceKey(optedOutRun.runId, [0]) })).toBeNull();
    expect(await store.getRunOwnership({ runId: stepOccurrenceKey(leasedRun.runId, [0]) })).toMatchObject({
      live: false,
    });
  });
});
