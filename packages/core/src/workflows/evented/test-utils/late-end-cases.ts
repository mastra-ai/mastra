/**
 * Shared cases for the end of evented runs whose events arrive late or twice
 * (#28712): a duplicate end of the run, a nested run's end delivered twice, a
 * late event for a run whose end deleted its snapshot. Run them against each
 * storage.
 */
import { describe, expect, it } from 'vitest';
import type { Event } from '../../../events/types';
import type { MastraStorage } from '../../../storage';
import { stepOccurrenceKey } from '../leases';
import { abandonLease } from './abandon-lease';
import {
  copyEvent,
  finishesOf,
  heldQueue,
  samePath,
  startInBackground,
  uniqueRunId,
  useLateDeliveryReplicas,
} from './late-delivery-replicas';
import { Num, work } from './lease-replicas';
import { createStep, createWorkflow } from '..';

/** The `workflow.end` events of the nested runs `published` holds, in the order they ended. */
const childEnds = (published: Event[], parentRunId: string) =>
  published.filter(event => event.type === 'workflow.end' && event.runId !== parentRunId);

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database (see {@link useLateDeliveryReplicas}).
 */
export function describeLateEndCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('ends of evented runs whose events arrive late or twice (#28712)', () => {
    const { startReplica, storedRun, redeliver } = useLateDeliveryReplicas({ getStorage, connect });

    /**
     * A two-step run on replica A whose last step end A's broker holds back.
     * With `fails`, the last step throws and the run has no retries left. With
     * `keepsSnapshot: false`, the run's end deletes its snapshot.
     */
    async function holdLastStepEnd({ fails = false, keepsSnapshot = true } = {}) {
      const executions: string[] = [];
      const workflow = createWorkflow({
        id: 'finished',
        inputSchema: Num,
        outputSchema: Num,
        ...(keepsSnapshot ? {} : { options: { shouldPersistSnapshot: () => false } }),
      })
        .then(work('first', async id => void executions.push(id)))
        .then(
          work('second', async id => {
            executions.push(id);
            if (fails) {
              throw new Error('the last step fails');
            }
          }),
        )
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

    it('fails the run once when a redelivery of its failed last step fails it before the step end arrives', async () => {
      const { executions, fromA, a, run, lastStep } = await holdLastStepEnd({ fails: true });

      // As above, with the last step's final failure saved instead of a success.
      await abandonLease(getStorage(), stepOccurrenceKey(run.runId, [1]));
      const fromB = heldQueue(() => true);
      const b = await startReplica(a.workflow, fromB.intercept);
      expect(await redeliver(b, lastStep)).toEqual({ ok: true });
      await fromB.drain(b);
      fromA.holdAll();
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect((await storedRun(run.runId))?.status).toBe('failed');
      expect(finishesOf(run.runId, a, b).map(event => event.type)).toEqual(['workflow.fail']);
    }, 20_000);

    it('fails the run once when the step end of its failed last step arrives twice', async () => {
      const { executions, fromA, a, run } = await holdLastStepEnd({ fails: true });

      fromA.holdAll();
      fromA.queue.push(copyEvent(fromA.queue[0]!));
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect((await storedRun(run.runId))?.status).toBe('failed');
      expect(finishesOf(run.runId, a).map(event => event.type)).toEqual(['workflow.fail']);
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

    it('ends the run once when the last step end arrives twice and the end deleted the snapshot', async () => {
      const { executions, fromA, a, run } = await holdLastStepEnd({ keepsSnapshot: false });

      fromA.holdAll();
      fromA.queue.push(copyEvent(fromA.queue[0]!));
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect(await storedRun(run.runId)).toBeNull();
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

    it('ends a time travel to the last step when the workflow saves no running snapshots', async () => {
      const executions: string[] = [];
      const workflow = createWorkflow({
        id: 'finished',
        inputSchema: Num,
        outputSchema: Num,
        options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
      })
        .then(work('first', async id => void executions.push(id)))
        .then(work('second', async id => void executions.push(id)))
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');

      const travelled = run.timeTravel({ step: 'second', inputData: { n: 2 } });
      const outcome = await Promise.race([
        travelled.then(result => result.status),
        new Promise(resolve => setTimeout(() => resolve('still waiting'), 5_000)),
      ]);
      expect(outcome).toBe('success');
      expect(executions).toEqual(['first', 'second', 'second']);
    }, 20_000);

    // An outcome check: with the nested step last, the top-level end check alone also keeps the
    // second hand-off from ending the parent again.
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
  });
}
