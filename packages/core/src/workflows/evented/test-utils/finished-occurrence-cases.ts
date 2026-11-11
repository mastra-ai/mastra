/**
 * Shared cases for evented step deliveries that reach a worker after their
 * step occurrence finished (#28712): a broker redelivery, or a message that
 * sat in a backlog while `restart()` ran the step. Run them against each
 * storage: stores with workflow step guards (Postgres) arbitrate some of these
 * deliveries through the guards instead.
 *
 * Replicas are separate Mastra instances, each with its own pubsub, sharing
 * one store the way pods share one database. The test file sets a short lease
 * TTL before core loads.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import { runLivenessKey, stepOccurrenceKey } from '../step-lease';
import { abandonLease } from './abandon-lease';
import { createStep, createWorkflow } from '..';

const Num = z.object({ n: z.number() });
type Report = (label: string) => Promise<void>;
type Built = { id: string; createRun: (options?: { runId?: string }) => Promise<any> };

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
 */
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
  },
};

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
            if (picked === 'drop') return;
            published.push(structuredClone(event));
            if (picked) return void picked.then(() => target.publish(topic, event, options));
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
 */
export function describeFinishedOccurrenceCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('evented step deliveries that arrive after the step finished (#28712)', () => {
    const replicas: Mastra[] = [];
    afterEach(async () => {
      await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
    });

    /** Starts a replica running `workflow`, recording the `workflows` events it publishes. */
    async function startReplica<W extends Built>(workflow: W, intercept?: Intercept) {
      const { pubsub, published } = recordWorkflowEvents(new EventEmitterPubSub(), intercept);
      const mastra = new Mastra({
        logger: false,
        storage: await connect(),
        pubsub,
        workflows: { finished: workflow as any },
      });
      await mastra.startWorkers();
      replicas.push(mastra);
      return { mastra, published, workflow };
    }

    /** A replica crashing: it stops renewing anything, and the leases it held lapse. */
    async function crash(replica: { mastra: Mastra }, keys: string[]) {
      await replica.mastra.shutdown({ drainTimeout: 0 });
      await abandonLease(getStorage(), ...keys);
    }

    async function storedRun(runId: string) {
      const store = (await getStorage().getStore('workflows'))!;
      return store.loadWorkflowSnapshot({ workflowName: 'finished', runId });
    }

    /** Hands `event` to `replica` the way a broker redelivers a message whose ack was lost. */
    const redeliver = (replica: { mastra: Mastra }, event: Event) =>
      replica.mastra.handleWorkflowEvent({ ...structuredClone(event), deliveryAttempt: 2 });

    it('does not run a step again when its original message arrives after a restart ran it', async () => {
      const executions: string[] = [];
      const hung = Promise.withResolvers<void>();
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(
            work('second', async id => {
              executions.push(`${replica}:${id}`);
              if (replica !== 'A') return;
              hung.resolve();
              await new Promise<never>(() => {});
            }),
          )
          .then(work('third', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const a = await startReplica(build('A'));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      void run.start({ inputData: { n: 1 } });
      await hung.promise;
      const original = a.published.find(event => event.type === 'workflow.step.run' && samePath(event, [1]))!;

      // A crashes in the second step, and B recovers the run.
      await crash(a, [stepOccurrenceKey(run.runId, [1]), runLivenessKey(run.runId)]);
      const b = await startReplica(build('B'));
      expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('success');

      // The broker then redelivers A's unacknowledged message for the second step.
      const before = b.published.length;
      expect(await redeliver(b, original)).toEqual({ ok: true });

      expect(executions).toEqual(['A:first', 'A:second', 'B:second', 'B:third']);
      expect(stepEventsOf(b.published.slice(before), run.runId)).toEqual([]);
      expect((await storedRun(run.runId))?.status).toBe('success');
    }, 20_000);

    it('does not run a step again when a restart read the run just before the step saved its result', async () => {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      // The first step finished on A, but its step end sits in the broker's queue for longer than a lease TTL.
      const stepEndQueued = Promise.withResolvers<void>();
      const deliverStepEnd = Promise.withResolvers<void>();
      const a = await startReplica(build('A'), event => {
        if (event.type !== 'workflow.step.end' || !samePath(event, [0])) return undefined;
        stepEndQueued.resolve();
        return deliverStepEnd.promise;
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      void run.start({ inputData: { n: 1 } });
      await stepEndQueued.promise;
      const store = (await getStorage().getStore('workflows'))!;
      await expect
        .poll(async () => (await store.getRunOwnership({ runId: runLivenessKey(run.runId) }))?.live, { timeout: 5_000 })
        .toBe(false);

      // B's restart reads the first step as running. Its message for that step is held back in turn.
      const restartMessage = Promise.withResolvers<Event>();
      const b = await startReplica(build('B'), event => {
        if (event.type !== 'workflow.step.run' || !samePath(event, [0]) || !event.data.restart) return undefined;
        restartMessage.resolve(structuredClone(event));
        return 'drop';
      });
      void (await b.workflow.createRun({ runId: run.runId })).restart().catch(() => {});
      const held = await restartMessage.promise;

      // A's step end is delivered and A finishes the run before B's message arrives.
      deliverStepEnd.resolve();
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      const before = b.published.length;
      expect(await b.mastra.handleWorkflowEvent(held)).toEqual({ ok: true });

      expect(executions).toEqual(['A:first', 'A:second']);
      expect(stepEventsOf(b.published.slice(before), run.runId)).toEqual([]);
    }, 20_000);

    it('continues a run whose worker stopped after saving a step result, without running the step again', async () => {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      // A stops right after saving the first step's result, before the second step's message goes out.
      const a = await startReplica(build('A'), event =>
        event.type === 'workflow.step.run' && samePath(event, [1]) ? 'drop' : undefined,
      );
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      void run.start({ inputData: { n: 1 } });
      await expect.poll(async () => (await storedRun(run.runId))?.context.first?.status).toBe('success');
      const original = a.published.find(event => event.type === 'workflow.step.run' && samePath(event, [0]))!;
      await crash(a, [runLivenessKey(run.runId)]);

      // The broker redelivers the first step's message, whose ack A never sent.
      const b = await startReplica(build('B'));
      expect(await redeliver(b, original)).toEqual({ ok: true });

      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions).toEqual(['A:first', 'B:second']);
    }, 20_000);

    it.each(Object.keys(shapes) as (keyof typeof shapes)[])(
      '%s: a finished step redelivered while the run goes on, or after it ended, does not run again',
      async name => {
        const shape = shapes[name];
        const executions: string[] = [];
        const blocked = Promise.withResolvers<void>();
        const gate = Promise.withResolvers<void>();
        const reporter =
          (replica: string): Report =>
          async label => {
            executions.push(`${replica}:${label}`);
            if (replica !== 'A' || label !== shape.block) return;
            blocked.resolve();
            await gate.promise;
          };
        const a = await startReplica(shape.build(reporter('A')));
        const b = await startReplica(shape.build(reporter('B')));
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        const result = run.start({ inputData: shape.input as any });
        await blocked.promise;

        const stepRuns = a.published.filter(event => event.type === 'workflow.step.run');
        // The nth listing of a path is the nth message published for it (a loop's iterations share one path).
        const finished = shape.finished.map((path, i) => {
          const nth = shape.finished.slice(0, i).filter(p => JSON.stringify(p) === JSON.stringify(path)).length;
          return stepRuns.filter(event => samePath(event, path))[nth]!;
        });
        for (const event of finished) expect(await redeliver(b, event)).toEqual({ ok: true });
        expect(executions.filter(e => e.startsWith('B:'))).toEqual([]);

        gate.resolve();
        expect((await result).status).toBe('success');
        for (const event of finished) expect(await redeliver(b, event)).toEqual({ ok: true });

        expect(executions.sort()).toEqual(shape.labels.map(label => `A:${label}`).sort());
        expect(stepEventsOf(b.published, run.runId)).toEqual([]);
      },
      20_000,
    );

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

    it('runs every retry of a failing step', async () => {
      let attempts = 0;
      const workflow = createWorkflow({
        id: 'finished',
        inputSchema: Num,
        outputSchema: Num,
        retryConfig: { attempts: 2 },
      })
        .then(
          createStep({
            id: 'flaky',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              if (++attempts < 3) throw new Error('transient');
              return inputData;
            },
          }),
        )
        .commit();
      const a = await startReplica(workflow);

      expect((await (await a.workflow.createRun({ runId: uniqueRunId() })).start({ inputData: { n: 1 } })).status).toBe(
        'success',
      );
      expect(attempts).toBe(3);
    }, 20_000);
  });
}
