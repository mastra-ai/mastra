/**
 * Shared cases for evented runs whose events arrive late or twice (#28712): a
 * step end held in the broker, a duplicate end of the run, a nested run's
 * success delivered twice, a restart that read the run before it moved on.
 * Run them against each storage.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../../events/types';
import type { MastraStorage } from '../../../storage';
import { runLivenessKey } from '../leases';
import {
  copyEvent,
  deferred,
  samePath,
  startInBackground,
  uniqueRunId,
  useLateDeliveryReplicas,
} from './late-delivery-replicas';
import type { Intercept } from './late-delivery-replicas';
import { Num, work } from './lease-replicas';
import type { Report } from './lease-replicas';
import { createStep, createWorkflow } from '..';

/**
 * A broker queue the test drains by hand. Events `holds` picks are kept from
 * the start; once `holdAll()` is called every `workflows` event is. `drain`
 * hands the kept events to a replica one at a time, including the events their
 * handling publishes, so the test knows when the replica is done with them.
 */
function heldQueue(holds: (event: Event) => boolean) {
  const queue: Event[] = [];
  const firstHeld = deferred<void>();
  let all = false;
  const intercept: Intercept = event => {
    if (!all && !holds(event)) {
      return undefined;
    }

    queue.push(copyEvent(event));
    firstHeld.resolve();
    return 'drop';
  };

  async function drain(replica: { mastra: { handleWorkflowEvent: (event: Event) => Promise<unknown> } }) {
    while (queue.length > 0) {
      expect(await replica.mastra.handleWorkflowEvent(queue.shift()!)).toEqual({ ok: true });
    }
  }

  return {
    intercept,
    queue,
    firstHeld: firstHeld.promise,
    holdAll: () => {
      all = true;
    },
    drain,
  };
}

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database (see {@link useLateDeliveryReplicas}).
 */
export function describeLateDeliveryCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('evented runs whose events arrive late or twice (#28712)', () => {
    const { startReplica, storedRun } = useLateDeliveryReplicas({ getStorage, connect });

    /** Waits until the run's liveness lapsed, so `restart()` takes it over. */
    async function waitUntilOrphaned(runId: string) {
      const store = (await getStorage().getStore('workflows'))!;
      await expect
        .poll(async () => (await store.getRunOwnership({ runId: runLivenessKey(runId) }))?.live, { timeout: 5_000 })
        .toBe(false);
    }

    /** The `workflows-finish` events the replicas published for `runId`: one per end of the run. */
    const finishesOf = (runId: string, ...replicas: { finished: Event[] }[]) =>
      replicas.flatMap(replica => replica.finished).filter(event => event.runId === runId);

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

    it('runs the step after a foreach once when two items finish together', async () => {
      const executions: string[] = [];
      const started = { count: 0, both: deferred<void>() };
      const release = deferred<void>();
      const workflow = createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() })
        .foreach(
          createStep({
            id: 'item',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              if (++started.count === 2) {
                started.both.resolve();
              }

              await release.promise;
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
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      const result = run.start({ inputData: [{ n: 1 }, { n: 2 }] });
      await started.both.promise;

      release.resolve();

      expect((await result).status).toBe('success');
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions.sort()).toEqual(['after', 'item:1', 'item:2']);
      expect(a.published.filter(event => event.type === 'workflow.step.run' && samePath(event, [1]))).toHaveLength(1);
    }, 20_000);
  });
}
