/**
 * Shared cases for evented step deliveries that reach a worker after their
 * step occurrence finished (#28712): a broker redelivery, or a message that
 * sat in a backlog while `restart()` ran the step. Run them against each
 * storage: stores with workflow step guards (Postgres) arbitrate some of these
 * deliveries through the guards instead.
 *
 * Replicas are separate Mastra instances, each with its own pubsub, sharing
 * one store the way pods share one database.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { getEntryWorkflow } from '../../step-entry';
import type { StepFlowEntry } from '../../types';
import type { Workflow } from '../../workflow';
import { WorkflowEventProcessor } from '../workflow-event-processor';
import { createStep, createWorkflow } from '..';

type Built = { id: string; createRun: (options?: { runId?: string }) => Promise<any> };

const Num = z.object({ n: z.number() });
type Report = (label: string) => Promise<void>;

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
 * Workflow shapes. `block` is the occurrence replica A holds while the late
 * deliveries arrive, and `finished` are the execution paths of occurrences
 * that finished by then. For the loop they are its first two iterations.
 * `saved` tells from the stored step results that those occurrences saved
 * their results: a delivery that arrives before the save runs the step again.
 */
type Context = Record<string, any>;
const foreachOutput = (context: Context) => context.item?.suspendPayload?.__workflow_meta?.foreachOutput ?? [];
const shapes = {
  step: {
    input: { n: 0 } as unknown,
    build: (report: Report) =>
      createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
        .then(work('first', report))
        .then(work('second', report))
        .commit(),
    labels: ['first', 'second'],
    block: 'second',
    finished: [[0]],
    saved: (context: Context) => context.first?.status === 'success',
  },
  parallel: {
    input: { n: 0 } as unknown,
    build: (report: Report) =>
      createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
        .parallel([work('a', report), work('b', report)])
        .commit(),
    labels: ['a', 'b'],
    block: 'b',
    finished: [[0, 0]],
    saved: (context: Context) => context.a?.status === 'success',
  },
  foreach: {
    input: [{ n: 1 }, { n: 2 }, { n: 3 }] as unknown,
    build: (report: Report) =>
      createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() })
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
          { concurrency: 1 },
        )
        .commit(),
    labels: ['item:1', 'item:2', 'item:3'],
    block: 'item:3',
    finished: [
      [0, 0],
      [0, 1],
    ],
    saved: (context: Context) => [0, 1].every(index => foreachOutput(context)[index]?.status === 'success'),
  },
  loop: {
    input: { n: 0 } as unknown,
    build: (report: Report) =>
      createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
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
    block: 'body:3',
    finished: [[0], [0]],
    // The third iteration's start replaces the body's record, so the first two ended.
    saved: (context: Context) => (context.body?.metadata?.iterationCount ?? 0) >= 2,
  },
  nested: {
    input: { n: 0 } as unknown,
    build: (report: Report) =>
      createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
        .then(
          createWorkflow({ id: 'finished-child', inputSchema: Num, outputSchema: Num })
            .then(work('inner', report))
            .commit(),
        )
        .then(work('after', report))
        .commit(),
    labels: ['inner', 'after'],
    block: 'after',
    finished: [[0]],
    saved: (context: Context) => context['finished-child']?.status === 'success',
  },
};

/** A foreach that runs up to three of its items at once, so their dispatches and ends interleave. */
const concurrentForeach = (report: Report) =>
  createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() }).foreach(
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
  );

/** A promise and the functions that settle it; `Promise.withResolvers` is newer than the library target. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

/** The attempt number of a delivery whose earlier deliveries used up the processor's delivery budget. */
const EXHAUSTED_ATTEMPT =
  (WorkflowEventProcessor as unknown as { MAX_DELIVERY_ATTEMPTS: number }).MAX_DELIVERY_ATTEMPTS + 1;

/**
 * A copy of `event` as a broker would store it. The start of a nested run
 * carries its parent's step graph, whose functions a broker cannot store.
 */
function copyEvent(event: Event): Event {
  try {
    return structuredClone(event);
  } catch {
    return JSON.parse(JSON.stringify(event));
  }
}

/** Whether `event` carries the execution path `path`. */
const samePath = (event: Event, path: number[]) =>
  JSON.stringify((event.data as { executionPath?: number[] }).executionPath) === JSON.stringify(path);

/**
 * What happens to a `workflows` event a replica publishes: `'drop'` loses it,
 * as when the publishing process stops first, and a promise keeps it in the
 * broker's queue until it resolves, while the publisher goes on.
 */
type Intercept = (event: Event) => 'drop' | Promise<void> | undefined;

/** Wraps a pubsub so the `workflows` events it publishes are recorded and pass through `intercept`. */
function recordWorkflowEvents(inner: PubSub, intercept: Intercept = () => undefined) {
  const published: Event[] = [];
  const pubsub = new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic === 'workflows') {
            const picked = intercept(event);
            if (picked === 'drop') {
              return;
            }

            published.push(copyEvent(event));

            // The publisher goes on while the broker holds the event, so a failed delivery
            // later has no caller left to reject: log it for the test's output instead.
            if (picked) {
              picked
                .then(() => target.publish(topic, event, options))
                .catch(error => console.error('A held workflow event could not be published', error));
              return;
            }
          }

          return target.publish(topic, event, options);
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { pubsub, published };
}

/**
 * What happens after a replica saved a step result: a promise holds the
 * replica's handler there until it resolves, as when the process stops right
 * after the write. The write itself is already in the store.
 */
type AfterWrite = (write: { stepId: string; result: { status?: string } }) => Promise<void> | undefined;

/** Wraps a replica's store so its step result writes go through `afterWrite`. */
function withAfterWrite(storage: MastraStorage, afterWrite: AfterWrite): MastraStorage {
  return new Proxy(storage, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop !== 'getStore') {
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return async (...args: Parameters<MastraStorage['getStore']>) => {
        const store = await target.getStore(...args);
        if (args[0] !== 'workflows' || !store) {
          return store;
        }

        const workflows = store as WorkflowsStorage;
        return new Proxy(workflows, {
          get(domain, key) {
            const method = Reflect.get(domain, key, domain);
            if (key !== 'updateWorkflowResults') {
              return typeof method === 'function' ? method.bind(domain) : method;
            }

            return async (write: Parameters<WorkflowsStorage['updateWorkflowResults']>[0]) => {
              const results = await workflows.updateWorkflowResults(write);
              await afterWrite(write);
              return results;
            };
          },
        });
      };
    },
  });
}

/**
 * Starts `run` without waiting for its result. The test reads the outcome from
 * storage, and the replica that started the run may crash or never see it end,
 * so a rejection is logged for the test's output instead of being awaited.
 */
function startInBackground(run: { start: (args: { inputData: any }) => Promise<unknown> }, inputData: unknown) {
  run.start({ inputData }).catch(error => console.error('A run started in the background rejected', error));
}

/**
 * A run ID no other test in the store used. Tests share one store, and the
 * test setup makes `randomUUID()` repeat from test to test.
 */
const uniqueRunId = () => `${expect.getState().currentTestName?.replace(/\W+/g, '-')}-${Date.now()}`;

/** Step events a replica published for `runId`: any of them means it ran or continued a step. */
const stepEventsOf = (published: Event[], runId: string) =>
  published
    .filter(
      event => event.runId === runId && (event.type === 'workflow.step.run' || event.type === 'workflow.step.end'),
    )
    .map(event => `${event.type}@${JSON.stringify((event.data as { executionPath?: number[] }).executionPath)}`);

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database: a replica that shuts down closes its
 * store. It defaults to `getStorage`, for stores that close harmlessly.
 * `stepGuards` tells whether the store has workflow step guards, which tell
 * some late deliveries apart that other stores can't.
 */
export function describeFinishedOccurrenceCases({
  getStorage,
  connect = getStorage,
  stepGuards = false,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
  stepGuards?: boolean;
}) {
  describe('evented step deliveries that arrive after the step finished (#28712)', () => {
    const replicas: Mastra[] = [];
    afterEach(async () => {
      await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
    });

    /**
     * Starts a replica running `workflow` and the nested workflows its top-level
     * steps call. `published` records the `workflows` events it publishes, and
     * `delivered` the same events as its subscribers receive them, with the id a
     * broker keeps on redelivery.
     */
    async function startReplica<W extends Built>(workflow: W, intercept?: Intercept, afterWrite?: AfterWrite) {
      const { pubsub, published } = recordWorkflowEvents(new EventEmitterPubSub(), intercept);
      const graph = (workflow as unknown as { stepGraph: StepFlowEntry[] }).stepGraph;
      const nested = graph.flatMap(entry => {
        const child =
          entry.type === 'step'
            ? getEntryWorkflow(entry)
            : entry.type === 'loop' && (entry.step as { component?: string }).component === 'WORKFLOW'
              ? (entry.step as unknown as Workflow)
              : null;
        return child ? [[child.id, child] as const] : [];
      });
      const storage = await connect();
      const mastra = new Mastra({
        logger: false,
        storage: afterWrite ? withAfterWrite(storage, afterWrite) : storage,
        pubsub,
        workflows: { finished: workflow, ...Object.fromEntries(nested) } as unknown as Record<string, Workflow>,
      });
      await mastra.startWorkers();
      replicas.push(mastra);

      const delivered: Event[] = [];
      await pubsub.subscribe('workflows', event => {
        delivered.push(copyEvent(event));
      });

      return { mastra, published, delivered, workflow };
    }

    /** A replica crashing: it stops without waiting for the work it has in flight. */
    async function crash(replica: { mastra: Mastra }) {
      await replica.mastra.shutdown({ drainTimeout: 0 });
    }

    /** The stored snapshot of the `finished` workflow's run `runId`. */
    async function storedRun(runId: string) {
      const store = (await getStorage().getStore('workflows'))!;
      return store.loadWorkflowSnapshot({ workflowName: 'finished', runId });
    }

    /** Hands `event` to `replica` the way a broker redelivers a message whose ack was lost. */
    const redeliver = (replica: { mastra: Mastra }, event: Event, deliveryAttempt = 2) =>
      replica.mastra.handleWorkflowEvent({ ...copyEvent(event), deliveryAttempt });

    it('does not run a step again when its original message arrives after a restart ran it', async () => {
      const executions: string[] = [];
      const hung = deferred<void>();
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(
            work('second', async id => {
              executions.push(`${replica}:${id}`);
              if (replica !== 'A') {
                return;
              }

              hung.resolve();
              await new Promise<never>(() => {});
            }),
          )
          .then(work('third', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const a = await startReplica(build('A'));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await hung.promise;
      const original = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [1]))!;
      expect(original.id).toBeTruthy();

      // A crashes in the second step, and B recovers the run.
      await crash(a);
      const b = await startReplica(build('B'));
      expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('success');

      // The broker then redelivers A's unacknowledged message for the second step.
      const before = b.published.length;
      expect(await redeliver(b, original)).toEqual({ ok: true });

      expect(executions).toEqual(['A:first', 'A:second', 'B:second', 'B:third']);
      expect(stepEventsOf(b.published.slice(before), run.runId)).toEqual([]);
      expect((await storedRun(run.runId))?.status).toBe('success');
    }, 20_000);

    /**
     * Runs `build` on replica A until the step at `path` finished and its step
     * end sits in A's broker queue, then restarts the run on
     * replica B, which reads that step as running. B's restart message for the
     * step, the one `isRestartMessage` picks, is held back and returned.
     * `deliverStepEnd` lets A's step end through.
     */
    async function restartWhileStepEndQueued(
      build: (replica: string) => Built,
      path: number[],
      isRestartMessage: (event: Event) => boolean,
    ) {
      const stepEndQueued = deferred<void>();
      const deliverStepEnd = deferred<void>();
      const a = await startReplica(build('A'), event => {
        if (event.type !== 'workflow.step.end' || !samePath(event, path)) {
          return undefined;
        }

        stepEndQueued.resolve();
        return deliverStepEnd.promise;
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await stepEndQueued.promise;

      const restartMessage = deferred<Event>();
      const b = await startReplica(build('B'), event => {
        if (event.type !== 'workflow.step.run' || !samePath(event, path) || !isRestartMessage(event)) {
          return undefined;
        }

        restartMessage.resolve(copyEvent(event));
        return 'drop';
      });
      // B's own pubsub never sees the run end, so the restart only settles if it throws.
      void (await b.workflow.createRun({ runId: run.runId })).restart().catch(restartMessage.reject);
      const held = await restartMessage.promise;
      return { b, run, held, deliverStepEnd: () => deliverStepEnd.resolve() };
    }

    it('does not run a step again when a restart read the run just before the step saved its result', async () => {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const { b, run, held, deliverStepEnd } = await restartWhileStepEndQueued(
        build,
        [0],
        event => !!event.data.restart,
      );

      // A's step end is delivered and A finishes the run before B's message arrives.
      deliverStepEnd();
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      const before = b.published.length;
      expect(await b.mastra.handleWorkflowEvent(held)).toEqual({ ok: true });

      expect(executions).toEqual(['A:first', 'A:second']);
      expect(stepEventsOf(b.published.slice(before), run.runId)).toEqual([]);
    }, 20_000);

    it('does not run a branch again when a restart read it just before it saved its result and the run went on', async () => {
      const executions: string[] = [];
      const dBlocked = deferred<void>();
      const releaseD = deferred<void>();
      const build = (replica: string) => {
        const report: Report = async id => {
          executions.push(`${replica}:${id}`);
          if (id !== 'd') {
            return;
          }

          dBlocked.resolve();
          await releaseD.promise;
        };
        return createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
          .parallel([work('a', report), work('b', report)])
          .then(
            createStep({
              id: 'c',
              inputSchema: z.any(),
              outputSchema: Num,
              execute: async () => {
                await report('c');
                return { n: 1 };
              },
            }),
          )
          .then(work('d', report))
          .commit();
      };
      const { b, run, held, deliverStepEnd } = await restartWhileStepEndQueued(
        build,
        [0, 1],
        event =>
          !!(event.data.restart as { isParallelOrConditionalRestarted?: boolean } | undefined)
            ?.isParallelOrConditionalRestarted,
      );

      // A's step end for b is delivered and the run ends the parallel, runs c and is in d when B's
      // message arrives. B's restart read b as running, so its message for finished branch a leaves
      // ending the parallel to b's step end.
      deliverStepEnd();
      await dBlocked.promise;
      const before = b.published.length;
      expect(await b.mastra.handleWorkflowEvent(held)).toEqual({ ok: true });

      expect(executions.filter(e => e === 'B:a' || e === 'B:b')).toEqual([]);
      expect(stepEventsOf(b.published.slice(before), run.runId)).toEqual([]);
      releaseD.resolve();
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions.map(e => e.slice(2)).sort()).toEqual(['a', 'b', 'c', 'd']);
    }, 20_000);

    // Technical: A saved a's result and stopped before aggregating the entry, with b already
    // suspended. a started after b suspended, so the run's stored active steps name only a. On a
    // parallel the restart then dispatches only a, and its delivery continues from a's saved result
    // and aggregates the entry, which suspends the run. Dropping it would leave nothing to aggregate
    // the entry and the run `running` for good.
    //
    // A conditional restart dispatches every branch whose condition holds, and a delivery for a
    // branch saved as suspended runs it again while the run is `running`, so there b can run once
    // more and suspend again before a's delivery suspends the run. Known issue, outside this case.
    it.each(['parallel', 'conditional'] as const)(
      '%s: suspends a run restarted after one branch finished and the other suspended, then finishes it on resume',
      async kind => {
        const executions: string[] = [];
        const build = (replica: string) => {
          const report: Report = async id => void executions.push(`${replica}:${id}`);
          const a = work('a', report);
          const b = createStep({
            id: 'b',
            inputSchema: Num,
            outputSchema: Num,
            resumeSchema: z.object({ ok: z.boolean() }),
            execute: async ({ inputData, resumeData, suspend }) => {
              await report('b');
              if (!resumeData) {
                await suspend({});
              }
              return inputData;
            },
          });
          const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() });
          const entry =
            kind === 'parallel'
              ? workflow.parallel([a, b])
              : workflow.branch([
                  [async () => true, a],
                  [async () => true, b],
                ]);
          return entry
            .then(
              createStep({
                id: 'c',
                inputSchema: z.any(),
                outputSchema: Num,
                execute: async () => {
                  await report('c');
                  return { n: 1 };
                },
              }),
            )
            .commit();
        };

        // A runs a only once b suspended, and stops right after saving a's result.
        const startA = deferred<void>();
        const aSaved = deferred<void>();
        const a = await startReplica(
          build('A'),
          event =>
            event.type === 'workflow.step.run' && samePath(event, [0, 0]) && !event.data.restart
              ? startA.promise
              : undefined,
          ({ stepId, result }) => {
            if (stepId !== 'a' || result.status !== 'success') {
              return undefined;
            }

            aSaved.resolve();
            return new Promise<never>(() => {});
          },
        );
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        startInBackground(run, { n: 1 });
        await expect.poll(async () => (await storedRun(run.runId))?.context.b?.status).toBe('suspended');
        startA.resolve();
        await aSaved.promise;
        await crash(a);
        expect((await storedRun(run.runId))?.status).toBe('running');

        const b = await startReplica(build('B'));
        void (await b.workflow.createRun({ runId: run.runId }))
          .restart()
          .catch(error => console.error('A restart left running by the test rejected', error));

        await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('suspended');
        expect((await storedRun(run.runId))?.suspendedPaths).toEqual({ b: [0, 1] });
        const withoutKnownRerun = (label: string) => kind !== 'conditional' || label !== 'B:b';
        expect(executions.filter(withoutKnownRerun)).toEqual(['A:b', 'A:a']);

        const before = executions.length;
        const resumed = await (
          await b.workflow.createRun({ runId: run.runId })
        ).resume({
          step: 'b',
          resumeData: { ok: true },
        });
        expect(resumed.status).toBe('success');
        expect(executions.slice(before)).toEqual(['B:b', 'B:c']);
      },
      20_000,
    );

    // Technical: A saved a's failure and stopped before publishing `workflow.fail`, with b still
    // running. A failed branch never reaches the entry's aggregation, so b's completion can't end
    // the run: the restart's delivery for a has to continue from the saved failure and fail it.
    // Dropping it because b was unsettled left the run `running` for good.
    it.each(['parallel', 'conditional'] as const)(
      '%s: fails a run restarted after one branch failed while the other was still running',
      async kind => {
        const executions: string[] = [];
        const bStarted = deferred<void>();
        const build = (replica: string) => {
          const report: Report = async id => void executions.push(`${replica}:${id}`);
          const a = createStep({
            id: 'a',
            inputSchema: Num,
            outputSchema: Num,
            execute: async () => {
              await report('a');
              throw new Error('a broke');
            },
          });
          const b = createStep({
            id: 'b',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              await report('b');
              if (replica === 'A') {
                bStarted.resolve();
                await new Promise<never>(() => {});
              }
              return inputData;
            },
          });
          const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() });
          const entry =
            kind === 'parallel'
              ? workflow.parallel([a, b])
              : workflow.branch([
                  [async () => true, a],
                  [async () => true, b],
                ]);
          return entry
            .then(
              createStep({
                id: 'c',
                inputSchema: z.any(),
                outputSchema: Num,
                execute: async () => {
                  await report('c');
                  return { n: 1 };
                },
              }),
            )
            .commit();
        };

        // A runs a only once b is running, and stops right after saving a's failure.
        const startA = deferred<void>();
        const aSaved = deferred<void>();
        const a = await startReplica(
          build('A'),
          event =>
            event.type === 'workflow.step.run' && samePath(event, [0, 0]) && !event.data.restart
              ? startA.promise
              : undefined,
          ({ stepId, result }) => {
            if (stepId !== 'a' || result.status !== 'failed') {
              return undefined;
            }

            aSaved.resolve();
            return new Promise<never>(() => {});
          },
        );
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        startInBackground(run, { n: 1 });
        await bStarted.promise;
        startA.resolve();
        await aSaved.promise;
        await crash(a);
        expect((await storedRun(run.runId))?.status).toBe('running');

        const b = await startReplica(build('B'));
        void (await b.workflow.createRun({ runId: run.runId }))
          .restart()
          .catch(error => console.error('A restart left running by the test rejected', error));

        await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('failed');
        expect((await storedRun(run.runId))?.error?.message).toBe('a broke');
        // The restart dispatches b again, which A never finished. b runs only if its delivery is
        // handled before a's failure is stored: once the run reads failed, the delivery is dropped
        // and b does not run on the ended run. Step guards don't treat a saved failure as final (a
        // retry may follow it), so there the restart runs a again too and it fails again.
        const guards = (await getStorage().getStore('workflows'))!.supportsWorkflowStepGuards();
        const ran = ['A:b', 'A:a', ...(guards ? ['B:a'] : [])].sort();
        await expect.poll(() => executions.filter(e => e !== 'B:b').sort()).toEqual(ran);
        expect(executions.filter(e => e === 'B:b').length).toBeLessThanOrEqual(1);
        expect((await storedRun(run.runId))?.status).toBe('failed');
      },
      20_000,
    );

    /** The first entries `crashAfterSavingFirst` runs before `second`: a step, or a loop whose last iteration ends it. */
    const firstEntries = {
      step: {
        add: (workflow: ReturnType<typeof createWorkflow>, report: Report) => workflow.then(work('first', report)),
        id: 'first',
        ran: ['first'],
      },
      loop: {
        add: (workflow: ReturnType<typeof createWorkflow>, report: Report) =>
          workflow.dountil(
            createStep({
              id: 'body',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                await report(`body:${inputData.n + 1}`);
                return { n: inputData.n + 1 };
              },
            }),
            async ({ inputData }) => {
              await report(`check:${inputData.n}`);
              return inputData.n >= 2;
            },
          ),
        id: 'body',
        ran: ['body:1', 'check:1', 'body:2', 'check:2'],
      },
    };

    /**
     * Runs the first entry on replica A, which saves its result and stops
     * before the second step's message goes out. Returns the first entry's
     * last message, whose ack A never sent.
     */
    async function crashAfterSavingFirst(first: keyof typeof firstEntries = 'step') {
      const entry = firstEntries[first];
      const executions: string[] = [];
      const build = (replica: string) => {
        const report: Report = async id => void executions.push(`${replica}:${id}`);
        return entry
          .add(createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num }), report)
          .then(work('second', report))
          .commit();
      };
      const secondDropped = deferred<void>();
      const a = await startReplica(build('A'), event => {
        if (event.type !== 'workflow.step.run' || !samePath(event, [1])) {
          return undefined;
        }

        secondDropped.resolve();
        return 'drop';
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 0 });
      await secondDropped.promise;
      await expect.poll(async () => (await storedRun(run.runId))?.context[entry.id]?.status).toBe('success');
      // With the id a broker keeps, so on a store with step guards the redelivery is the event that
      // stamped the saved result.
      const original = a.delivered.filter(event => event.type === 'workflow.step.run' && samePath(event, [0])).at(-1)!;
      expect(original.id).toBeTruthy();
      await crash(a);
      return { executions, build, run, original, ran: entry.ran.map(label => `A:${label}`) };
    }

    it.each([
      { delivery: 'a redelivery', attempt: 2, first: 'step' as const },
      { delivery: 'a redelivery that used up its attempts', attempt: EXHAUSTED_ATTEMPT, first: 'step' as const },
      { delivery: "a redelivery of a loop's last iteration", attempt: 2, first: 'loop' as const },
    ])(
      'continues a run whose worker stopped after saving a step result from $delivery, without running the step again',
      async ({ attempt, first }) => {
        const { executions, build, run, original, ran } = await crashAfterSavingFirst(first);

        const b = await startReplica(build('B'));
        expect(await redeliver(b, original, attempt)).toEqual({ ok: true });

        // The loop's condition already decided to leave it, so it isn't checked again.
        await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
        expect(executions).toEqual([...ran, 'B:second']);
      },
      20_000,
    );

    it.each(Object.keys(shapes) as (keyof typeof shapes)[])(
      '%s: a finished step redelivered while the run goes on, or after it ended, does not run again',
      async name => {
        const shape = shapes[name];
        const executions: string[] = [];
        const blocked = deferred<void>();
        const gate = deferred<void>();
        const reporter =
          (replica: string): Report =>
          async label => {
            executions.push(`${replica}:${label}`);
            if (replica !== 'A' || label !== shape.block) {
              return;
            }

            blocked.resolve();
            await gate.promise;
          };
        const a = await startReplica(shape.build(reporter('A')));
        const b = await startReplica(shape.build(reporter('B')));
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        const result = run.start({ inputData: shape.input as any });
        await blocked.promise;
        await expect.poll(async () => shape.saved((await storedRun(run.runId))?.context ?? {})).toBe(true);

        // Delivered events keep the id a broker redelivers them with.
        const stepRuns = a.delivered.filter(event => event.type === 'workflow.step.run');
        // The nth listing of a path is the nth message published for it (a loop's iterations share one path).
        const finished = shape.finished.map((path, i) => {
          const nth = shape.finished.slice(0, i).filter(p => JSON.stringify(p) === JSON.stringify(path)).length;
          return stepRuns.filter(event => samePath(event, path))[nth]!;
        });
        expect(finished.every(event => event.id)).toBe(true);

        for (const event of finished) {
          expect(await redeliver(b, event)).toEqual({ ok: true });
        }
        expect(executions.filter(e => e.startsWith('B:'))).toEqual([]);

        gate.resolve();
        expect((await result).status).toBe('success');
        for (const event of finished) {
          expect(await redeliver(b, event)).toEqual({ ok: true });
        }

        expect(executions.sort()).toEqual(shape.labels.map(label => `A:${label}`).sort());
        expect(stepEventsOf(b.published, run.runId)).toEqual([]);
      },
      20_000,
    );

    /** The step events `replica` received, and the runs (top-level and nested) they belong to. */
    function stepDeliveries(replica: { delivered: Event[] }) {
      const events = replica.delivered.filter(
        event => event.type === 'workflow.step.end' || event.type === 'workflow.step.run',
      );
      const runs = new Map(events.map(event => [event.runId, (event.data as { workflowId: string }).workflowId]));
      return { events, runs };
    }

    /** The stored status and step records of each run, to compare before and after the late deliveries. */
    async function storedRuns(runs: Map<string, string>) {
      const store = (await getStorage().getStore('workflows'))!;
      const stored: Record<string, unknown> = {};
      for (const [runId, workflowName] of runs) {
        const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
        stored[runId] = { status: snapshot?.status, context: snapshot?.context };
      }
      return stored;
    }

    /**
     * The step event that ended each run: the last one the run received. A worker can stop after
     * saving the end and before publishing it, so a redelivery of that event still has to finish
     * the run (see the next case).
     */
    const endingEvents = (events: Event[]) => new Set([...new Map(events.map(event => [event.runId, event])).values()]);

    const suspending = (id: string, report: Report) =>
      createStep({
        id,
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ ok: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) {
            await suspend({});
            return inputData;
          }
          await report(id);
          return inputData;
        },
      });

    /** Runs that end in success, some after a suspend and a resume. */
    const endedRuns: Record<
      string,
      { build: (report: Report) => Built; input: unknown; resume?: { step: string | string[] } }
    > = {
      ...Object.fromEntries(Object.entries(shapes).map(([name, shape]) => [name, shape])),
      resumed: {
        input: { n: 0 },
        build: report =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
            .then(work('first', report))
            .then(suspending('gate', report))
            .then(work('after', report))
            .then(work('last', report))
            .commit(),
        resume: { step: 'gate' },
      },
      'nested resumed': {
        input: { n: 0 },
        build: report =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
            .then(work('a', report))
            .then(
              createWorkflow({ id: 'finished-child', inputSchema: Num, outputSchema: Num })
                .then(suspending('ask', report))
                .then(work('use', report))
                .commit(),
            )
            .then(work('c', report))
            .commit(),
        resume: { step: ['finished-child', 'ask'] },
      },
      'concurrent foreach': {
        input: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
        build: report => concurrentForeach(report).commit(),
      },
      'concurrent foreach before a step': {
        input: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
        build: report =>
          concurrentForeach(report)
            .then(
              createStep({
                id: 'after',
                inputSchema: z.array(Num),
                outputSchema: z.any(),
                execute: async () => {
                  await report('after');
                  return {};
                },
              }),
            )
            .commit(),
      },
    };

    // A broker reclaims a step end or a foreach's item dispatch from a worker that stopped before
    // acking it, and hands it to another worker after the run ended. A reclaimed message keeps its
    // delivery attempt, so it arrives as a first delivery.
    it.each(Object.keys(endedRuns))(
      '%s: a step end or step dispatch delivered after the run ended does not advance the run',
      async name => {
        const shape = endedRuns[name]!;
        const executions: string[] = [];
        const reporter =
          (replica: string): Report =>
          async label =>
            void executions.push(`${replica}:${label}`);
        const a = await startReplica(shape.build(reporter('A')));
        const b = await startReplica(shape.build(reporter('B')));
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        if (shape.resume) {
          expect((await run.start({ inputData: shape.input as any })).status).toBe('suspended');
          expect((await run.resume({ step: shape.resume.step, resumeData: { ok: true } })).status).toBe('success');
        } else {
          expect((await run.start({ inputData: shape.input as any })).status).toBe('success');
        }

        const { events, runs } = stepDeliveries(a);
        const ending = endingEvents(events);
        const late = events.filter(event => !ending.has(event));
        expect(late.length).toBeGreaterThan(0);
        const before = await storedRuns(runs);
        for (const event of late) {
          expect(await redeliver(b, event, 1)).toEqual({ ok: true });
        }

        expect(executions.filter(e => e.startsWith('B:'))).toEqual([]);
        expect(b.published.map(event => `${event.type}@${JSON.stringify(event.data?.executionPath)}`)).toEqual([]);
        expect(await storedRuns(runs)).toEqual(before);
      },
      20_000,
    );

    it('finishes a run whose worker saved its end and stopped before publishing it, when the last step end is redelivered', async () => {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const endDropped = deferred<void>();
      const a = await startReplica(build('A'), event => {
        if (event.type !== 'workflow.end') {
          return undefined;
        }

        endDropped.resolve();
        return 'drop';
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await endDropped.promise;
      expect((await storedRun(run.runId))?.status).toBe('success');
      const { events } = stepDeliveries(a);
      const last = [...endingEvents(events)][0]!;
      await crash(a);

      const b = await startReplica(build('B'));
      expect(await redeliver(b, last, 1)).toEqual({ ok: true });

      expect(b.published.filter(event => event.type === 'workflow.end')).toHaveLength(1);
      expect(executions).toEqual(['A:first', 'A:second']);
      expect((await storedRun(run.runId))?.status).toBe('success');
    }, 20_000);

    /**
     * Runs whose ending events a broker can deliver again after the run's end was handled: the
     * step end that ended each run, and each nested run's `workflow.end`. `report` hears every step
     * and loop condition that runs.
     */
    const endedAgain: Record<string, (report: Report) => Built> = {
      'a top-level run': report =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
          .then(work('first', report))
          .then(work('second', report))
          .commit(),
      'a nested run in the last step': report =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
          .then(work('a', report))
          .then(
            createWorkflow({ id: 'finished-child', inputSchema: Num, outputSchema: Num })
              .then(work('inner', report))
              .then(work('use', report))
              .commit(),
          )
          .commit(),
      'a nested loop body in the last step': report =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
          .dountil(
            createWorkflow({ id: 'finished-child', inputSchema: Num, outputSchema: Num })
              .then(
                createStep({
                  id: 'body',
                  inputSchema: Num,
                  outputSchema: Num,
                  execute: async ({ inputData }) => {
                    await report(`body:${inputData.n + 1}`);
                    return { n: inputData.n + 1 };
                  },
                }),
              )
              .commit(),
            async ({ inputData }) => {
              await report(`cond:${inputData.n}`);
              return inputData.n >= 2;
            },
          )
          .commit(),
    };

    /** Runs `build` to success on a replica, then hands its ending events to a second replica. */
    async function redeliverEndingEvents(build: (report: Report) => Built) {
      const executions: string[] = [];
      const reporter =
        (replica: string): Report =>
        async label =>
          void executions.push(`${replica}:${label}`);
      const a = await startReplica(build(reporter('A')));
      const b = await startReplica(build(reporter('B')));
      const finishes: Event[] = [];
      await b.mastra.pubsub.subscribe('workflows-finish', event => void finishes.push(event));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 0 } })).status).toBe('success');

      const { events, runs } = stepDeliveries(a);
      const nestedEnds = a.delivered.filter(event => event.type === 'workflow.end' && event.runId !== run.runId);
      const late = [...endingEvents(events), ...nestedEnds];
      const before = await storedRuns(runs);
      for (const event of late) {
        expect(await redeliver(b, event, 1)).toEqual({ ok: true });
      }

      const after = await storedRuns(runs);
      return { executions, b, finishes, before, after };
    }

    // A late copy of the event that ended a run still reaches the run's end handling, since it
    // can't be told from a copy whose worker stopped before publishing the end. It must not run a
    // step or a loop condition again, or change how the run ended.
    it.each(Object.keys(endedAgain))(
      '%s: a late copy of the event that ended it runs no step again',
      async name => {
        const { executions, before, after } = await redeliverEndingEvents(endedAgain[name]!);

        expect(executions.filter(e => e.startsWith('B:'))).toEqual([]);
        const statuses = (stored: Record<string, any>) =>
          Object.fromEntries(Object.entries(stored).map(([runId, { status }]) => [runId, status]));
        expect(statuses(after)).toEqual(statuses(before));
      },
      20_000,
    );

    // Known gap: nothing records that a run's end was handed off, so a late copy of the event that
    // ended a successful run publishes `workflow.end` and `workflows-finish` again. A nested run
    // also hands its success to the parent again: a parent that ended at that nested step ends
    // again too, and a loop parent drops it. Only a top-level run on
    // a store with step guards is told apart: its end marks every guarded record
    // `__continuationStarted`, and the late step end is refused as stale. Fixing the rest needs an
    // "end handed off" marker written by the `workflow.end` handler.
    for (const name of Object.keys(endedAgain)) {
      const knownGap = !(stepGuards && name === 'a top-level run');
      (knownGap ? it.fails : it)(
        `${name}: a late copy of the event that ended it publishes no second end`,
        async () => {
          const { b, finishes } = await redeliverEndingEvents(endedAgain[name]!);

          expect(b.published.filter(event => event.type === 'workflow.end')).toEqual([]);
          expect(finishes).toEqual([]);
        },
        20_000,
      );
    }

    it('keeps a failed run as it is when a parallel sibling finishes after the run failed', async () => {
      // The failing branch waits for its sibling to start: a sibling dispatched after the run
      // failed is dropped and never ends.
      const siblingStarted = deferred<void>();
      const build = () =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
          .parallel([
            createStep({
              id: 'broken',
              inputSchema: Num,
              outputSchema: Num,
              execute: async () => {
                await siblingStarted.promise;
                throw new Error('broken');
              },
            }),
            work('slow', async () => siblingStarted.resolve()),
          ])
          .then(createStep({ id: 'after', inputSchema: z.any(), outputSchema: z.any(), execute: async () => ({}) }))
          .commit();
      const siblingEnd = deferred<Event>();
      const a = await startReplica(build(), event => {
        if (event.type !== 'workflow.step.end' || !samePath(event, [0, 1])) {
          return undefined;
        }

        siblingEnd.resolve(copyEvent(event));
        return 'drop';
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');
      const late = await siblingEnd.promise;
      const runs = new Map([[run.runId, 'finished']]);
      const before = await storedRuns(runs);

      const b = await startReplica(build());
      expect(await redeliver(b, late, 1)).toEqual({ ok: true });

      expect(b.published).toEqual([]);
      expect(await storedRuns(runs)).toEqual(before);
    }, 20_000);

    it('keeps a failed run as it is when concurrent foreach items finish after one item failed the run', async () => {
      // The failing item waits for both siblings to start, and the siblings wait for the run to
      // read failed, so their ends come after the failure.
      const executions: string[] = [];
      const started: number[] = [];
      const siblingsStarted = deferred<void>();
      const release = deferred<void>();
      const build = () =>
        createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() })
          .foreach(
            createStep({
              id: 'item',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                executions.push(`item:${inputData.n}`);
                if (inputData.n === 1) {
                  await siblingsStarted.promise;
                  throw new Error('broken');
                }

                if (started.push(inputData.n) === 2) siblingsStarted.resolve();
                await release.promise;
                return inputData;
              },
            }),
            { concurrency: 3 },
          )
          .then(
            createStep({
              id: 'after',
              inputSchema: z.array(Num),
              outputSchema: z.any(),
              execute: async () => {
                executions.push('after');
                return {};
              },
            }),
          )
          .commit();
      const siblingEnds: Event[] = [];
      const bothEnded = deferred<void>();
      const a = await startReplica(build(), event => {
        if (event.type !== 'workflow.step.end' || !(samePath(event, [0, 1]) || samePath(event, [0, 2]))) {
          return undefined;
        }

        if (siblingEnds.push(copyEvent(event)) === 2) bothEnded.resolve();
        return 'drop';
      });
      const finishes: Event[] = [];
      await a.mastra.pubsub.subscribe('workflows-finish', event => void finishes.push(event));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: [{ n: 1 }, { n: 2 }, { n: 3 }] })).status).toBe('failed');
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('failed');
      release.resolve();
      await bothEnded.promise;
      const runs = new Map([[run.runId, 'finished']]);
      const before = await storedRuns(runs);

      const b = await startReplica(build());
      await b.mastra.pubsub.subscribe('workflows-finish', event => void finishes.push(event));
      for (const event of siblingEnds) {
        expect(await redeliver(b, event, 1)).toEqual({ ok: true });
      }

      expect(b.published).toEqual([]);
      expect(await storedRuns(runs)).toEqual(before);
      const stored = await storedRun(run.runId);
      expect(stored?.status).toBe('failed');
      expect(stored?.error?.message).toBe('broken');
      expect(stored?.context.item?.metadata?.foreachFailedIndex).toBe(0);
      expect(a.published.filter(event => event.runId === run.runId && event.type === 'workflow.fail')).toHaveLength(1);
      expect(finishes.filter(event => event.runId === run.runId)).toHaveLength(1);
      expect(executions.sort()).toEqual(['item:1', 'item:2', 'item:3']);
    }, 20_000);

    it('keeps a finished run successful when a workflow.fail for it arrives late', async () => {
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(work('first', async () => {}))
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      const runs = new Map([[run.runId, 'finished']]);
      const before = await storedRuns(runs);

      const b = await startReplica(workflow);
      const finishes: Event[] = [];
      await b.mastra.pubsub.subscribe('workflows-finish', event => void finishes.push(event));
      const lateFail: Event = {
        id: `late-fail-${run.runId}`,
        type: 'workflow.fail',
        runId: run.runId,
        createdAt: new Date(),
        deliveryAttempt: 1,
        data: {
          workflowId: 'finished',
          runId: run.runId,
          executionPath: [0],
          resumeSteps: [],
          stepResults: {},
          activeStepsPath: {},
          requestContext: {},
          prevResult: { status: 'failed', error: { message: 'late failure' } },
        },
      };
      expect(await b.mastra.handleWorkflowEvent(lateFail)).toEqual({ ok: true });

      expect(finishes).toEqual([]);
      expect(await storedRuns(runs)).toEqual(before);
    }, 20_000);

    it('runs a step used twice in one workflow at both places', async () => {
      const executions: string[] = [];
      const report: Report = async id => void executions.push(id);
      const reused = work('reused', report);
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(reused)
        .then(work('between', report))
        .then(reused)
        .commit();
      const a = await startReplica(workflow);

      expect((await (await a.workflow.createRun({ runId: uniqueRunId() })).start({ inputData: { n: 1 } })).status).toBe(
        'success',
      );
      expect(executions).toEqual(['reused', 'between', 'reused']);
    }, 20_000);

    it.each(['running', 'suspended'] as const)(
      'drops a finished step whose redelivery exhausted its attempts while the next step is %s',
      async state => {
        const executions: string[] = [];
        const blocked = deferred<void>();
        const gate = deferred<void>();
        const build = (replica: string) =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
            .then(work('first', async id => void executions.push(`${replica}:${id}`)))
            .then(
              createStep({
                id: 'second',
                inputSchema: Num,
                outputSchema: Num,
                resumeSchema: z.object({ ok: z.boolean() }),
                execute: async ({ inputData, resumeData, suspend }) => {
                  executions.push(`${replica}:second`);
                  if (state === 'suspended' && !resumeData) {
                    await suspend({});
                    return inputData;
                  }

                  if (state === 'running' && replica === 'A') {
                    blocked.resolve();
                    await gate.promise;
                  }

                  return inputData;
                },
              }),
            )
            .commit();
        const a = await startReplica(build('A'));
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        const result = run.start({ inputData: { n: 1 } });
        if (state === 'running') {
          await blocked.promise;
        } else {
          expect((await result).status).toBe('suspended');
        }

        await expect.poll(async () => (await storedRun(run.runId))?.context.first?.status).toBe('success');
        const first = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [0]))!;
        expect(first.id).toBeTruthy();

        // The first step's original message, with its original id, comes back once more after
        // using up its delivery attempts. On a store with step guards its record carries that id.
        const b = await startReplica(build('B'));
        expect(await redeliver(b, first, EXHAUSTED_ATTEMPT)).toEqual({ ok: true });

        expect(executions.filter(e => e.startsWith('B:'))).toEqual([]);
        expect(b.published.filter(event => event.runId === run.runId).map(event => event.type)).toEqual([]);
        expect((await storedRun(run.runId))?.status).toBe(state);
        if (state === 'running') {
          gate.resolve();
          expect((await result).status).toBe('success');
        }
      },
      20_000,
    );

    it('runs a finished step and the steps after it again on time travel', async () => {
      const executions: string[] = [];
      const report: Report = async id => void executions.push(id);
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(work('first', report))
        .then(work('second', report))
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

      const travelled = await run.timeTravel({ step: 'first', inputData: { n: 2 } });

      expect(travelled.status).toBe('success');
      expect(executions).toEqual(['first', 'second', 'first', 'second']);
    }, 20_000);

    // A workflow that skips running snapshots leaves the stored active path at the step that last
    // saved one, here the step that suspended. The check can't tell from it whether the run went
    // past a finished step, so a late delivery runs the step again instead of leaving the run stuck.
    it('runs a finished step again when the workflow does not save running snapshots', async () => {
      const executions: string[] = [];
      const build = (replica: string) => {
        const reused = work('reused', async id => void executions.push(`${replica}:${id}`));
        return createWorkflow({
          id: 'finished',
          inputSchema: Num,
          outputSchema: Num,
          options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
        })
          .then(reused)
          .then(
            createStep({
              id: 'gate',
              inputSchema: Num,
              outputSchema: Num,
              resumeSchema: z.object({ ok: z.boolean() }),
              execute: async ({ inputData, resumeData, suspend }) => {
                if (!resumeData) {
                  await suspend({});
                }
                return inputData;
              },
            }),
          )
          .then(reused)
          .then(work('last', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      };
      // A stops after the second `reused` saved its result, before `last`'s message goes out.
      const lastDropped = deferred<void>();
      const a = await startReplica(build('A'), event => {
        if (event.type !== 'workflow.step.run' || !samePath(event, [3])) {
          return undefined;
        }

        lastDropped.resolve();
        return 'drop';
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('suspended');
      run.resume({ step: 'gate', resumeData: { ok: true } }).catch((error: unknown) => {
        console.error('A resume left behind by its replica rejected', error);
      });
      await lastDropped.promise;
      const original = a.delivered.filter(event => event.type === 'workflow.step.run' && samePath(event, [2])).at(-1)!;
      expect(original.id).toBeTruthy();
      await crash(a);

      const b = await startReplica(build('B'));
      expect(await redeliver(b, original)).toEqual({ ok: true });

      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions).toEqual(['A:reused', 'A:reused', 'B:reused', 'B:last']);
    }, 20_000);
  });
}
