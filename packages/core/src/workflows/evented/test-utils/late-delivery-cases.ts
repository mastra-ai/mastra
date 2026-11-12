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
import { runLivenessKey, stepOccurrenceKey } from '../leases';
import { abandonLease } from './abandon-lease';
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
    const { startReplica, storedRun, redeliver } = useLateDeliveryReplicas({ getStorage, connect });

    /** Waits until the run's liveness lapsed, so `restart()` takes it over. */
    async function waitUntilOrphaned(runId: string) {
      const store = (await getStorage().getStore('workflows'))!;
      await expect
        .poll(async () => (await store.getRunOwnership({ runId: runLivenessKey(runId) }))?.live, { timeout: 5_000 })
        .toBe(false);
    }

    /**
     * The `workflows-finish` events the replicas published for `runId`: one per end of the run.
     * The note that a deleted snapshot was cleaned up after the end is left out.
     */
    const finishesOf = (runId: string, ...replicas: { finished: Event[] }[]) =>
      replicas
        .flatMap(replica => replica.finished)
        .filter(event => event.runId === runId && event.type !== 'workflow.finish-cleanup-complete');

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

    /** A two-step run on replica A whose last step end A's broker holds back. */
    async function holdLastStepEnd() {
      const executions: string[] = [];
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(work('first', async id => void executions.push(id)))
        .then(work('second', async id => void executions.push(id)))
        .commit();
      const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [1]));
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await fromA.firstHeld;
      const lastStep = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [1]))!;
      return { executions, fromA, a, run, lastStep };
    }

    it('ends the run once when a redelivery of the last step ends it before the step end arrives', async () => {
      const { executions, fromA, a, run, lastStep } = await holdLastStepEnd();

      // The step lease lapses unreleased, as when the worker stops right after the publish. B gets
      // the redelivery, continues from the saved result and ends the run, then A's step end arrives.
      await abandonLease(getStorage(), stepOccurrenceKey(run.runId, [1]));
      const fromB = heldQueue(() => true);
      const b = await startReplica(a.workflow, fromB.intercept);
      expect(await redeliver(b, lastStep)).toEqual({ ok: true });
      expect(fromB.queue.map(event => event.type)).toEqual(['workflow.end']);
      await fromB.drain(b);
      fromA.holdAll();
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('ends the run once when the last step end arrives twice', async () => {
      const { executions, fromA, a, run } = await holdLastStepEnd();

      fromA.holdAll();
      fromA.queue.push(copyEvent(fromA.queue[0]!));
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    it('still ends the run again when it time travels to its last step (guard)', async () => {
      const executions: string[] = [];
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(work('first', async id => void executions.push(id)))
        .then(work('second', async id => void executions.push(id)))
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

      expect((await run.timeTravel({ step: 'second', inputData: { n: 2 } })).status).toBe('success');
      expect(executions).toEqual(['first', 'second', 'second']);
      await expect.poll(() => finishesOf(run.runId, a).length).toBe(2);
    }, 20_000);

    /** The `workflow.end` events of the nested runs `published` holds, in the order they ended. */
    const childEnds = (published: Event[], parentRunId: string) =>
      published.filter(event => event.type === 'workflow.end' && event.runId !== parentRunId);

    it('continues the parent once when a nested run ends twice', async () => {
      const executions: string[] = [];
      const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .then(work('inner', async id => void executions.push(id)))
        .commit();
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .then(work('first', async id => void executions.push(id)))
        .then(child)
        .commit();
      const fromA = heldQueue(() => false);
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

      fromA.holdAll();
      expect(await redeliver(a, childEnds(a.published, run.runId)[0]!)).toEqual({ ok: true });
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'inner']);
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    it('evaluates a dountil condition once per iteration when a nested iteration ends twice', async () => {
      let checks = 0;
      const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'increment',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
          }),
        )
        .commit();
      const workflow = createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
        .dountil(child, async ({ inputData }) => {
          checks++;
          return inputData.n >= 2;
        })
        .commit();
      const fromA = heldQueue(() => false);
      const a = await startReplica(workflow, fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 2 } });
      expect(checks).toBe(2);

      // The first iteration's end is redelivered after the loop moved on.
      fromA.holdAll();
      expect(await redeliver(a, childEnds(a.published, run.runId)[0]!)).toEqual({ ok: true });
      await fromA.drain(a);

      expect(checks).toBe(2);
      expect(finishesOf(run.runId, a)).toHaveLength(1);
    }, 20_000);

    /** A two-step workflow that keeps no snapshot, so its run's end deletes it. */
    const keepsNoSnapshot = (executions: string[]) =>
      createWorkflow({
        id: 'finished',
        inputSchema: Num,
        outputSchema: Num,
        options: { shouldPersistSnapshot: () => false },
      })
        .then(work('first', async id => void executions.push(id)))
        .then(work('second', async id => void executions.push(id)))
        .commit();

    it('does not run a step again when it arrives late for a run whose end deleted its snapshot', async () => {
      const executions: string[] = [];
      const a = await startReplica(keepsNoSnapshot(executions));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      await expect.poll(async () => await storedRun(run.runId)).toBeNull();
      const lastStep = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [1]))!;

      const fromB = heldQueue(() => true);
      const b = await startReplica(keepsNoSnapshot(executions), fromB.intercept);
      expect(await redeliver(b, lastStep)).toEqual({ ok: true });
      await fromB.drain(b);

      expect(executions).toEqual(['first', 'second']);
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('runs a new run that reuses the run ID of a run whose end deleted its snapshot (guard)', async () => {
      const executions: string[] = [];
      const a = await startReplica(keepsNoSnapshot(executions));
      const runId = uniqueRunId();
      expect((await (await a.workflow.createRun({ runId })).start({ inputData: { n: 1 } })).status).toBe('success');
      await expect.poll(async () => await storedRun(runId)).toBeNull();

      expect((await (await a.workflow.createRun({ runId })).start({ inputData: { n: 2 } })).status).toBe('success');
      expect(executions).toEqual(['first', 'second', 'first', 'second']);
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
