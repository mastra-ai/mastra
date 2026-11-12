/**
 * Replicas, workflow shapes and event interceptors shared by the evented lease
 * and sleep tests. Replicas are separate Mastra instances, each with its own
 * pubsub, sharing one store the way pods share one database.
 */
import { expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraRecoveryConfig } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { restartLeaseKey, runLivenessKey, stepOccurrenceKey } from '../leases';
import { abandonLease } from './abandon-lease';
import { createStep, createWorkflow } from '..';

export const Num = z.object({ n: z.number() });
export type Report = (label: string) => Promise<void>;
export type Store = InstanceType<typeof InMemoryStore>;

/** A step that reports its id before returning its input. */
export function work(id: string, report: Report) {
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
export const shapes = {
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
export type Shape = (typeof shapes)[keyof typeof shapes];
export type Built = ReturnType<Shape['build']>;

/**
 * Steps `before` and `after` around a two-second sleep, and the nested
 * workflows to register. The `sleepUntil` date is computed when the sleep
 * starts, so every replica's copy of the workflow sleeps until the same time
 * after `before`.
 */
export const sleepingWorkflows = {
  sleep: (report: Report) => ({
    workflow: createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
      .then(work('before', report))
      .sleep(2_000)
      .then(work('after', report))
      .commit(),
    nested: {},
  }),
  sleepUntil: (report: Report) => ({
    workflow: createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
      .then(work('before', report))
      .sleepUntil(async () => new Date(Date.now() + 2_000))
      .then(work('after', report))
      .commit(),
    nested: {},
  }),
  'sleep of a nested workflow': (report: Report) => {
    const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
      .then(work('before', report))
      .sleep(2_000)
      .then(work('after', report))
      .commit();
    return {
      workflow: createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit(),
      nested: { child },
    };
  },
};

/** Every Mastra instance a test started; {@link stopReplicas} shuts them down. */
export const replicas: Mastra[] = [];

/** Restores mocks and shuts every replica a test started down; run it after each test. */
export async function stopReplicas() {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
}

/** Recovery settings that turn a replica's recovery loop on, and let it find a stopped run within a test. */
export const scanning = { workflows: 'auto', workflowScanIntervalMs: 100 } as const;

/**
 * Starts a replica running `workflow` (registered as `leased`) and any nested workflows it calls,
 * with `recovery` as its recovery settings.
 */
export async function startReplica<W extends Built>(
  storage: Store,
  workflow: W,
  {
    pubsub = new EventEmitterPubSub() as PubSub,
    nested = {} as Record<string, Built>,
    recovery = undefined as MastraRecoveryConfig | undefined,
  } = {},
) {
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    workflows: { leased: workflow, ...nested } as any,
    // A zero grace leaves only the leases to keep a replica's recovery off a run, which is what these tests check.
    // The recovery loop is off unless a test turns it on (see `scanning`): with a zero grace its boot pass
    // would restart a crashed run before the test's own restart() calls. `restartAllActiveWorkflowRuns()`
    // still restarts runs with it off.
    recovery: { workflowGraceMs: 0, workflows: 'off', ...recovery },
  });
  await mastra.startWorkers();
  replicas.push(mastra);
  return { mastra, pubsub, workflow };
}

/**
 * Replicas A and B on a new store, with A running a `shapes.step` run and held in step `a`
 * (for good with `hangForever`). `delivery` is the `workflow.step.run` A got, to redeliver to B.
 */
export async function stepRunningOnA({
  hangForever = false,
  b: bOptions = {},
}: { hangForever?: boolean; b?: Parameters<typeof startReplica>[2] } = {}) {
  const storage = new InMemoryStore();
  const tracked = track({ blocks: ['a'] }, { hangForever });
  const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
  const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')), bOptions);
  let delivery: Event | undefined;
  await a.pubsub.subscribe('workflows', event => {
    if (event.type === 'workflow.step.run') {
      delivery = structuredClone(event);
    }
  });
  const run = await a.workflow.createRun();
  const result = run.start({ inputData: { n: 1 } });
  await tracked.allBlocked;
  return { storage, tracked, a, b, run, result, delivery: delivery! };
}

/** A replica crashing: it stops renewing anything, and the leases it held lapse. */
export async function crash(replica: { mastra: Mastra }, storage: Store, keys: string[]) {
  await replica.mastra.shutdown({ drainTimeout: 0 });
  await abandonLease(storage, ...keys);
}

/**
 * Wraps a pubsub so an event on the `workflows` topic the test picks out is
 * held back (`hold` resolves when it may go on), kept from this replica
 * entirely (`divert` receives it instead), or fails to publish (`reject`).
 */
export function interceptWorkflowEvents(
  inner: PubSub,
  pick: (event: Event) => { hold?: Promise<void>; divert?: (event: Event) => void; reject?: Error } | undefined,
) {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          const picked = topic === 'workflows' ? pick(event) : undefined;
          if (picked?.reject) {
            throw picked.reject;
          }

          if (picked?.divert) {
            return picked.divert(structuredClone(event));
          }

          if (picked?.hold) {
            await picked.hold;
          }

          return target.publish(topic, event, options);
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * A pubsub over `inner` whose `workflows` events `match` picks sit in the broker's queue until
 * `deliver()`. `held` resolves once the first of them is published.
 */
export function holdEvents(match: (event: Event) => boolean, inner: PubSub = new EventEmitterPubSub()) {
  const held = withResolvers<void>();
  const delivered = withResolvers<void>();
  const pubsub = interceptWorkflowEvents(inner, event => {
    if (!match(event)) {
      return undefined;
    }

    held.resolve();
    return { hold: delivered.promise };
  });
  return { pubsub, held: held.promise, deliver: delivered.resolve };
}

/** Whether `event` is the `workflow.step.run` of the step at `path`. */
export const isStepRunAt = (event: Event, path: number[]) =>
  event.type === 'workflow.step.run' &&
  JSON.stringify((event.data as { executionPath?: number[] }).executionPath) === JSON.stringify(path);

/** Records every lease claim and lease read on the shared store, and waits for ones matching a condition. */
export async function recordLeases(storage: Store) {
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
  // Recovery passes read the keys of many runs in one call.
  const readMany = store.getRunOwnerships.bind(store);
  vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
    const result = await readMany(args);
    reads.push(...args.runIds);
    notify();
    return result;
  });

  // Re-checks `done` after every recorded claim or read.
  const until = async (done: () => boolean) => {
    while (!done()) {
      await new Promise<void>(resolve => (notify = resolve));
    }
  };

  return { claims, reads, until };
}

/**
 * Delays every lease release the way a remote store's round trip does, so a
 * follow-up a step publishes (its retry, the next loop iteration) is delivered
 * before the step's own lease is released.
 */
export async function delayReleases(storage: Store) {
  const store = (await storage.getStore('workflows'))!;
  const release = store.releaseRunOwnership.bind(store);
  vi.spyOn(store, 'releaseRunOwnership').mockImplementation(async fence => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return release(fence);
  });
}

/** `Promise.withResolvers()`, which the ES2023 library this non-test module compiles against lacks. */
function withResolvers<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Records every step occurrence a replica runs, and holds replica A's `blocks` until `release` is called. */
export function track(shape: Pick<Shape, 'blocks'>, { hangForever = false } = {}) {
  const executions: string[] = [];
  const at: Record<string, number> = {};
  const gate = withResolvers<void>();
  const allBlocked = withResolvers<void>();
  const otherReplicaRan = withResolvers<void>();
  let blocked = 0;

  const reporter =
    (replica: string): Report =>
    async label => {
      executions.push(`${replica}:${label}`);
      at[`${replica}:${label}`] = Date.now();

      // Only replica A blocks; any other replica running a step is what the tests watch for.
      if (replica !== 'A') {
        return otherReplicaRan.resolve();
      }

      if (!shape.blocks.includes(label)) {
        return;
      }

      blocked++;
      if (blocked === shape.blocks.length) {
        allBlocked.resolve();
      }

      // A hanging step stands for a crashed replica: it never finishes.
      await (hangForever ? new Promise<never>(() => {}) : gate.promise);
    };

  return { executions, at, reporter, release: gate.resolve, allBlocked: allBlocked.promise, otherReplicaRan };
}

/** The stored status of the `leased` workflow's run. */
export async function runStatus(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return (await store.loadWorkflowSnapshot({ workflowName: 'leased', runId }))?.status;
}

/** Whether the run's liveness key is live; `undefined` when it was never written. */
export async function runIsLive(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return (await store.getRunOwnership({ runId: runLivenessKey(runId) }))?.live;
}

/** Restarts the run from `replica`: `resolved:<status>`, or the id of the error it threw. */
export async function restartOutcome(replica: { workflow: Built }, runId: string) {
  return (await replica.workflow.createRun({ runId })).restart().then(
    result => ({ id: `resolved:${result.status}` }),
    (error: { id?: string }) => ({ id: error.id }),
  );
}

/** Records every `restart()` of `runId` that got past the liveness check: each claims the restart lease. */
export async function recordRestarts(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  const claim = store.claimRunOwnership.bind(store);
  const restarts: boolean[] = [];
  vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
    const result = await claim(args);
    if (args.runId === restartLeaseKey(runId)) {
      restarts.push(result.acquired);
    }

    return result;
  });

  return restarts;
}

/** Waits `ms`, for the tests that must let a lease TTL pass. */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Starts `run` without waiting for its result. The test reads the outcome from
 * storage, and the replica that started the run may crash or never see it end,
 * so a rejection is logged for the test's output instead of being awaited.
 */
export function startInBackground(run: { start: (args: { inputData: any }) => Promise<unknown> }, inputData: unknown) {
  run.start({ inputData }).catch(error => console.error('A run started in the background rejected', error));
}

/** A workflow registered as `leased` with steps `before` and `after` around a sleep of `ms`. */
export const sleepingFor = (ms: number) => (report: Report) =>
  createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
    .then(work('before', report))
    .sleep(ms)
    .then(work('after', report))
    .commit() as unknown as Built;

/** Waits until the `leased` run, or the nested run of its `child` step, is in a sleep, and returns that run's id. */
export async function sleepingRunId(storage: Store, runId: string): Promise<string> {
  const store = (await storage.getStore('workflows'))!;
  let sleeping = '';
  await vi.waitFor(async () => {
    const parent = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId });
    const nestedRunId: string | undefined = (parent?.context as any)?.child?.metadata?.nestedRunId;
    const snapshot = nestedRunId
      ? await store.loadWorkflowSnapshot({ workflowName: 'child', runId: nestedRunId })
      : parent;
    const results = Object.values(snapshot?.context ?? {}) as { status?: string }[];
    expect(results.some(result => result?.status === 'waiting')).toBe(true);
    sleeping = nestedRunId ?? runId;
  });

  return sleeping;
}

/** Whether `key` is the wake lease key of an occurrence of the sleep at `[1]` of `runId`. */
export const isSleepKeyOf = (key: string, runId: string) =>
  key.startsWith(stepOccurrenceKey(runId, [1])) && /:sleep\d+$/.test(key);

/**
 * The statuses of the sleeps among `results`, a run's step results. Sleeps are found by the
 * `sleep_` prefix of their generated id: each replica builds its own workflow, so the id differs
 * per replica, and a sleep stored twice under two ids shows up as two entries.
 */
export const sleepStatuses = (results: Record<string, unknown>) =>
  Object.entries(results)
    .filter(([id]) => id.startsWith('sleep_'))
    .map(([, result]) => (result as { status?: string }).status);

/** The statuses of the sleeps of the stored `leased` run (see {@link sleepStatuses}). */
export async function storedSleeps(storage: Store, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  return sleepStatuses((await store.loadWorkflowSnapshot({ workflowName: 'leased', runId }))?.context ?? {});
}

/** Records each step a replica runs and when, and each `workflow.step.run` of `workflowId` at `[2]`. */
export function observe(workflowId: string) {
  const executions: string[] = [];
  const at: Record<string, number> = {};
  const continuations: string[] = [];
  const reporter =
    (replica: string): Report =>
    async label => {
      executions.push(`${replica}:${label}`);
      at[`${replica}:${label}`] = Date.now();
    };
  const pubsub = (replica: string) =>
    interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (isStepRunAt(event, [2]) && (event.data as { workflowId?: string }).workflowId === workflowId) {
        continuations.push(replica);
      }

      return undefined;
    });

  return { executions, at, continuations, reporter, pubsub };
}
