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
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { MastraStorage } from '../../../storage';
import { runLivenessKey, stepOccurrenceKey } from '../leases';
import {
  copyEvent,
  deferred,
  EXHAUSTED_ATTEMPT,
  samePath,
  startInBackground,
  stepEventsOf,
  uniqueRunId,
  useLateDeliveryReplicas,
} from './late-delivery-replicas';
import { Num, work } from './lease-replicas';
import type { Report } from './lease-replicas';
import { createStep, createWorkflow } from '..';

/**
 * Workflow shapes. `block` is the occurrence replica A holds while the late
 * deliveries arrive, and `finished` are the execution paths of occurrences
 * that finished by then. For the loop they are its first two iterations.
 * `saved` tells from the stored step results that those occurrences saved
 * their results: a step's end is handled after its lease is released, and a
 * delivery that arrives before that runs the step again.
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

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database (see {@link useLateDeliveryReplicas}).
 */
export function describeFinishedOccurrenceCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('evented step deliveries that arrive after the step finished (#28712)', () => {
    const { startReplica, crash, storedRun, redeliver } = useLateDeliveryReplicas({ getStorage, connect });

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

    /**
     * Runs `first` on replica A, which saves its result and stops before the
     * second step's message goes out. Returns the first step's message, whose
     * ack A never sent.
     */
    async function crashAfterSavingFirst() {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const a = await startReplica(build('A'), event =>
        event.type === 'workflow.step.run' && samePath(event, [1]) ? 'drop' : undefined,
      );
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await expect.poll(async () => (await storedRun(run.runId))?.context.first?.status).toBe('success');
      // With the id a broker keeps, so on a store with step guards the redelivery is the event that
      // stamped the saved result.
      const original = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [0]))!;
      expect(original.id).toBeTruthy();
      await crash(a, [runLivenessKey(run.runId)]);
      return { executions, build, run, original };
    }

    it('continues a run whose worker stopped after saving a step result, without running the step again', async () => {
      const { executions, build, run, original } = await crashAfterSavingFirst();

      const b = await startReplica(build('B'));
      expect(await redeliver(b, original)).toEqual({ ok: true });

      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions).toEqual(['A:first', 'B:second']);
    }, 20_000);

    it("continues a run whose worker stopped after saving a step result once another worker's lease on the step expires", async () => {
      const { executions, build, run, original } = await crashAfterSavingFirst();
      const b = await startReplica(build('B'));
      // Another worker took the first step's lease to continue the run, and stopped too. The
      // redelivery has to wait for that lease to expire instead of being dropped, so the lease
      // must still be live when the redelivery arrives.
      const store = (await getStorage().getStore('workflows'))!;
      const key = stepOccurrenceKey(run.runId, [0]);
      const { record } = await store.claimRunOwnership({
        runId: key,
        ownerId: 'stopped-worker',
        leaseMs: 300,
        force: true,
      });
      expect((await store.getRunOwnership({ runId: key }))?.live).toBe(true);

      expect(await redeliver(b, original)).toEqual({ ok: true });

      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions).toEqual(['A:first', 'B:second']);
      // B continued the run under the step's lease, which it took over from the stopped worker.
      const lease = await store.getRunOwnership({ runId: key });
      expect(lease?.ownerId).not.toBe('stopped-worker');
      expect(lease?.generation).toBeGreaterThan(record!.generation);
    }, 20_000);

    it("continues a run whose worker stopped after saving a step result when the step's redelivery used up its attempts", async () => {
      const { executions, build, run, original } = await crashAfterSavingFirst();

      const b = await startReplica(build('B'));
      expect(
        await b.mastra.handleWorkflowEvent({ ...copyEvent(original), deliveryAttempt: EXHAUSTED_ATTEMPT }),
      ).toEqual({ ok: true });

      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions).toEqual(['A:first', 'B:second']);
    }, 20_000);

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

    /** Runs `first` then `second` to success on replica A and returns the run and A's step messages. */
    async function finishTwoSteps() {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      const a = await startReplica(build('A'));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      const first = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [0]))!;
      expect(first.id).toBeTruthy();
      return { executions, build, run, first };
    }

    it('drops a finished step redelivered while another worker holds its lease, without waiting for it', async () => {
      const { executions, build, run, first } = await finishTwoSteps();
      // Another worker holds the first step's lease, for longer than this test may wait.
      const store = (await getStorage().getStore('workflows'))!;
      await store.claimRunOwnership({
        runId: stepOccurrenceKey(run.runId, [0]),
        ownerId: 'other-worker',
        leaseMs: 60_000,
        force: true,
      });
      const b = await startReplica(build('B'));

      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        redeliver(b, first),
        new Promise(resolve => (timer = setTimeout(() => resolve('still waiting'), 5_000))),
      ]).finally(() => clearTimeout(timer));

      expect(outcome).toEqual({ ok: true });
      expect(executions).toEqual(['A:first', 'A:second']);
      expect(stepEventsOf(b.published, run.runId)).toEqual([]);
    }, 20_000);

    it('drops a finished step whose redelivery exhausted its attempts, leaving the run successful', async () => {
      const { executions, build, run, first } = await finishTwoSteps();
      const b = await startReplica(build('B'));

      expect(await b.mastra.handleWorkflowEvent({ ...copyEvent(first), deliveryAttempt: EXHAUSTED_ATTEMPT })).toEqual({
        ok: true,
      });

      expect(executions).toEqual(['A:first', 'A:second']);
      expect(b.published.filter(event => event.runId === run.runId).map(event => event.type)).toEqual([]);
      expect((await storedRun(run.runId))?.status).toBe('success');
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
        expect(await b.mastra.handleWorkflowEvent({ ...copyEvent(first), deliveryAttempt: EXHAUSTED_ATTEMPT })).toEqual(
          {
            ok: true,
          },
        );

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
      const { executions, run } = await finishTwoSteps();

      const travelled = await run.timeTravel({ step: 'first', inputData: { n: 2 } });

      expect(travelled.status).toBe('success');
      expect(executions).toEqual(['A:first', 'A:second', 'A:first', 'A:second']);
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
              if (++attempts < 3) {
                throw new Error('transient');
              }

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
