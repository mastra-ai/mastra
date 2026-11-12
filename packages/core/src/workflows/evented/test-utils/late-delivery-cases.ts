/**
 * Shared cases for evented steps whose events arrive late or twice (#28712):
 * a step end held in the broker past a lease TTL, a restart that read the run
 * before it moved on, a restart after a lost retry. Run them against each
 * storage.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraNonRetryableError } from '../../../error';
import type { MastraStorage } from '../../../storage';
import { runEndedKey, runLivenessKey, stepOccurrenceKey } from '../leases';
import {
  copyEvent,
  deferred,
  finishesOf,
  heldQueue,
  samePath,
  startInBackground,
  uniqueRunId,
  useLateDeliveryReplicas,
} from './late-delivery-replicas';
import { Num, work } from './lease-replicas';
import type { Report } from './lease-replicas';
import { createStep, createWorkflow } from '..';

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database (see {@link useLateDeliveryReplicas}).
 * `updatedAtMovesOnEveryWrite` is false for a store whose step result writes
 * leave the run's `updatedAt` alone: a restart there can't tell the run moved.
 */
export function describeLateDeliveryCases({
  getStorage,
  connect = getStorage,
  updatedAtMovesOnEveryWrite = true,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
  updatedAtMovesOnEveryWrite?: boolean;
}) {
  describe('evented runs whose events arrive late or twice (#28712)', () => {
    const { startReplica, crash, storedRun, waitUntilOrphaned } = useLateDeliveryReplicas({ getStorage, connect });

    it('runs each step once when a step end is held past a lease TTL, a restart goes on and the step end arrives twice', async () => {
      const executions: string[] = [];
      const build = (replica: string) =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(`${replica}:${id}`)))
          .then(work('second', async id => void executions.push(`${replica}:${id}`)))
          .commit();
      // The first step finished on A, and its step end sits in the broker's queue past a lease TTL.
      const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [0]));
      const a = await startReplica(build('A'), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await fromA.firstHeld;
      const stepEnd = fromA.queue[0]!;
      await waitUntilOrphaned(run.runId);

      const fromB = heldQueue(() => false);
      const b = await startReplica(build('B'), fromB.intercept);
      expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('success');

      // The broker then delivers A's step end to A, and again to B after a lost ack.
      fromA.holdAll();
      await fromA.drain(a);
      fromB.holdAll();
      fromB.queue.push(copyEvent(stepEnd));
      await fromB.drain(b);

      expect(executions).toEqual(['A:first', 'B:second']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('runs each branch once when the branch step ends are held past a lease TTL and a restart goes on', async () => {
      const executions: string[] = [];
      const build = (replica: string) => {
        const report: Report = async id => void executions.push(`${replica}:${id}`);
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
          .commit();
      };
      // Both branches finished on A, and their step ends sit in the broker's queue past a lease TTL.
      const fromA = heldQueue(
        event => event.type === 'workflow.step.end' && (samePath(event, [0, 0]) || samePath(event, [0, 1])),
      );
      const a = await startReplica(build('A'), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await expect.poll(() => fromA.queue.length).toBe(2);
      await waitUntilOrphaned(run.runId);

      const b = await startReplica(build('B'));
      expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('success');

      fromA.holdAll();
      await fromA.drain(a);

      expect(executions.sort()).toEqual(['A:a', 'A:b', 'B:c']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('ends a run whose last entry is a parallel once when both branch step ends are handled at once', async () => {
      const executions: string[] = [];
      const report: Report = async id => void executions.push(id);
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
        .parallel([work('a', report), work('b', report)])
        .commit();
      const fromA = heldQueue(
        event => event.type === 'workflow.step.end' && (samePath(event, [0, 0]) || samePath(event, [0, 1])),
      );
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await expect.poll(() => fromA.queue.length).toBe(2);

      fromA.holdAll();
      await fromA.drainConcurrently(a);

      expect(executions.sort()).toEqual(['a', 'b']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    it('reports a parallel suspended once when one branch suspends and the other succeeds', async () => {
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
        .parallel([
          createStep({
            id: 'approval',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ suspend }) => suspend({}),
          }),
          work('b', async () => {}),
        ])
        .commit();
      const fromA = heldQueue(
        event => event.type === 'workflow.step.end' && (samePath(event, [0, 0]) || samePath(event, [0, 1])),
      );
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await expect.poll(() => fromA.queue.length).toBe(2);

      // The suspended branch's step end comes first, so the finished branch's step end sees both.
      fromA.queue.sort((left, right) => Number(samePath(right, [0, 0])) - Number(samePath(left, [0, 0])));
      fromA.holdAll();
      await fromA.drain(a);

      expect((await storedRun(run.runId))?.status).toBe('suspended');
      expect(finishesOf(run.runId, a).map(event => event.type)).toEqual(['workflow.suspend']);
    }, 20_000);

    // An outcome check: the second join of a parallel followed by another step is also dropped by
    // the finished-step check and the end check.
    it('runs the step after a parallel once when both branches finish before either step end is handled', async () => {
      const executions: string[] = [];
      const report: Report = async id => void executions.push(id);
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: z.any() })
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
        .commit();
      const fromA = heldQueue(
        event => event.type === 'workflow.step.end' && (samePath(event, [0, 0]) || samePath(event, [0, 1])),
      );
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await expect.poll(() => fromA.queue.length).toBe(2);

      // Each branch saved its result before its step end, so both step ends see both results.
      fromA.holdAll();
      await fromA.drain(a);

      expect(executions.sort()).toEqual(['a', 'b', 'c']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    it('keeps counting the attempts of a failing step across a restart', async () => {
      let attempts = 0;
      const build = () =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 2 } })
          .then(
            createStep({
              id: 'broken',
              inputSchema: Num,
              outputSchema: Num,
              execute: async () => {
                attempts++;
                throw new Error('always fails');
              },
            }),
          )
          .commit();
      // A publishes the first retry and stops before any worker gets it.
      const retryLost = deferred<void>();
      const a = await startReplica(build(), event => {
        if (event.type !== 'workflow.step.run' || !(event.data as { retryCount?: number }).retryCount) {
          return undefined;
        }

        retryLost.resolve();
        return 'drop';
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await retryLost.promise;
      await crash(a, [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]);

      const b = await startReplica(build());
      expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('failed');
      expect(attempts).toBe(3);
    }, 20_000);

    it.each([
      { retries: 2, nonRetryable: false, expected: 3 },
      { retries: 0, nonRetryable: false, expected: 1 },
      { retries: 2, nonRetryable: true, expected: 1 },
    ])(
      'fails the run without another attempt when a restart finds the final failure saved ($retries retries, non-retryable $nonRetryable)',
      async ({ retries, nonRetryable, expected }) => {
        let attempts = 0;
        const build = () =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: retries } })
            .then(
              createStep({
                id: 'broken',
                inputSchema: Num,
                outputSchema: Num,
                execute: async () => {
                  attempts++;
                  throw nonRetryable ? new MastraNonRetryableError('fails for good') : new Error('always fails');
                },
              }),
            )
            .commit();
        // The final failure's step end sits in A's broker queue past a lease TTL.
        const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [0]));
        const a = await startReplica(build(), fromA.intercept);
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        startInBackground(run, { n: 1 });
        await fromA.firstHeld;
        await waitUntilOrphaned(run.runId);

        const b = await startReplica(build());
        expect((await (await b.workflow.createRun({ runId: run.runId })).restart()).status).toBe('failed');
        expect(attempts).toBe(expected);
      },
      20_000,
    );

    it('still runs every attempt of a step that fails before it succeeds', async () => {
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
                throw new Error(`attempt ${attempts} fails`);
              }

              return inputData;
            },
          }),
        )
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });

      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      expect(attempts).toBe(3);
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    it('still runs every iteration of a loop', async () => {
      const iterations: number[] = [];
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .dountil(
          createStep({
            id: 'count',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              iterations.push(inputData.n);
              return { n: inputData.n + 1 };
            },
          }),
          async ({ inputData }) => inputData.n >= 3,
        )
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });

      expect((await run.start({ inputData: { n: 0 } })).status).toBe('success');
      expect(iterations).toEqual([0, 1, 2]);
      expect((await storedRun(run.runId))?.context.count).toMatchObject({ status: 'success', output: { n: 3 } });
    }, 20_000);

    it.skipIf(!updatedAtMovesOnEveryWrite)(
      'keeps the steps a run saved after a restart read it, and runs each once',
      async () => {
        const executions: string[] = [];
        const build = (replica: string) =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
            .then(work('first', async id => void executions.push(`${replica}:${id}`)))
            .then(work('second', async id => void executions.push(`${replica}:${id}`)))
            .then(work('third', async id => void executions.push(`${replica}:${id}`)))
            .commit();
        // The first step's end sits in A's broker queue past a lease TTL, so the run looks stopped.
        const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [0]));
        const a = await startReplica(build('A'), fromA.intercept);
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        startInBackground(run, { n: 1 });
        await fromA.firstHeld;
        await waitUntilOrphaned(run.runId);

        // B's restart reads the run, and its start event is held back in turn.
        const fromB = heldQueue(event => event.type === 'workflow.start' && !!event.data.restart);
        const b = await startReplica(build('B'), fromB.intercept);
        const restarted = deferred<void>();
        // B's start is handled by hand below, so the restart's own wait never settles unless it throws.
        (await b.workflow.createRun({ runId: run.runId })).restart().catch(error => restarted.reject(error));
        await Promise.race([fromB.firstHeld, restarted.promise]);

        // A's step end is delivered: A saves the next steps and ends the run before B's start arrives.
        fromA.holdAll();
        await fromA.drain(a);
        expect((await storedRun(run.runId))?.status).toBe('success');
        fromB.holdAll();
        await fromB.drain(b);

        expect(executions).toEqual(['A:first', 'A:second', 'A:third']);
        expect((await storedRun(run.runId))?.status).toBe('success');
        expect(finishesOf(run.runId, a, b)).toHaveLength(1);
      },
      20_000,
    );

    it.skipIf(!updatedAtMovesOnEveryWrite)(
      'keeps the steps a run saved while the restart start event was being handled',
      async () => {
        const executions: string[] = [];
        const build = (replica: string) =>
          createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
            .then(work('first', async id => void executions.push(`${replica}:${id}`)))
            .then(work('second', async id => void executions.push(`${replica}:${id}`)))
            .commit();
        const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [0]));
        const a = await startReplica(build('A'), fromA.intercept);
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        startInBackground(run, { n: 1 });
        await fromA.firstHeld;
        await waitUntilOrphaned(run.runId);

        // B handles its restart's start event, and A's step end is delivered in the middle of it:
        // after B read the run, before B writes the snapshot it carries.
        const fromB = heldQueue(() => true);
        const b = await startReplica(build('B'), fromB.intercept);
        const store = (await b.mastra.getStorage()!.getStore('workflows'))!;
        const readOwnership = store.getRunOwnership.bind(store);
        let delivered = false;
        const drained = deferred<void>();
        const spy = vi.spyOn(store, 'getRunOwnership').mockImplementation(async args => {
          if (!delivered && args.runId === runEndedKey(run.runId)) {
            delivered = true;
            fromA.holdAll();
            await fromA.drain(a);
            drained.resolve();
          }

          return readOwnership(args);
        });
        try {
          (await b.workflow.createRun({ runId: run.runId }))
            .restart()
            .catch(error => console.error('The restart rejected', error));
          // B handles its start event and everything it publishes from there.
          await fromB.firstHeld;
          await fromB.drain(b);
          await drained.promise;

          expect((await storedRun(run.runId))?.status).toBe('success');
          expect(executions).toEqual(['A:first', 'A:second']);
          expect(finishesOf(run.runId, a, b)).toHaveLength(1);
        } finally {
          spy.mockRestore();
        }
      },
      20_000,
    );

    it('runs the step after a foreach once when two items finish together', async () => {
      const executions: string[] = [];
      const workflow = createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() })
        .foreach(
          createStep({
            id: 'item',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push(`item:${inputData.n}`);
              return inputData;
            },
          }),
          { concurrency: 2 },
        )
        .then(
          createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData }) => {
              executions.push('after');
              return inputData;
            },
          }),
        )
        .commit();
      // Both items finished before either item's step end is handled.
      const fromA = heldQueue(
        event =>
          event.type === 'workflow.step.end' &&
          (event.data.executionPath as number[] | undefined)?.[0] === 0 &&
          (event.data.executionPath as number[]).length === 2,
      );
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, [{ n: 1 }, { n: 2 }]);
      await expect.poll(() => fromA.queue.length).toBe(2);

      fromA.holdAll();
      await fromA.drain(a);

      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(executions.sort()).toEqual(['after', 'item:1', 'item:2']);
    }, 20_000);
  });
}
