/**
 * Shared cases for the end of evented runs whose events arrive late or twice
 * (#28712): a duplicate end of the run, a nested run's end delivered twice, a
 * late event for a run whose end deleted its snapshot. Run them against each
 * storage.
 */
import { describe, expect, it } from 'vitest';
import type { Event } from '../../../events/types';
import type { MastraStorage } from '../../../storage';
import { nestedHandOffKey, runLivenessKey, stepOccurrenceKey } from '../leases';
import { abandonLease } from './abandon-lease';
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
    const { startReplica, storedRun, redeliver, waitUntilOrphaned } = useLateDeliveryReplicas({
      getStorage,
      connect,
    });

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

    it('ends the run once when its end is retried on another replica after the publish threw', async () => {
      const executions: string[] = [];
      const build = () =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async id => void executions.push(id)))
          .then(work('second', async id => void executions.push(id)))
          .commit();
      const fromA = heldQueue(event => event.type === 'workflow.step.end' && samePath(event, [1]));
      let rejectEnd = true;
      const a = await startReplica(build(), event => {
        if (event.type === 'workflow.end' && rejectEnd) {
          rejectEnd = false;
          return 'throw';
        }

        return fromA.intercept(event);
      });
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await fromA.firstHeld;
      const stepEnd = fromA.queue.shift()!;

      // A saves the run's end, and the broker rejects its `workflow.end`.
      expect(await a.mastra.handleWorkflowEvent(stepEnd)).toMatchObject({ ok: false });

      // The broker hands the step end to B, which ends the run. A copy of it reaches A afterwards.
      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      expect(await redeliver(b, stepEnd)).toEqual({ ok: true });
      await fromB.drain(b);
      fromA.holdAll();
      expect(await redeliver(a, stepEnd)).toEqual({ ok: true });
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('ends the run once when a restart reads it while its end waits and its final snapshot is declined', async () => {
      const executions: string[] = [];
      const build = () =>
        createWorkflow({
          id: 'finished',
          inputSchema: Num,
          outputSchema: Num,
          options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'success' },
        })
          .then(work('first', async id => void executions.push(id)))
          .then(work('second', async id => void executions.push(id)))
          .commit();
      // The run's `workflow.end` sits in A's broker queue past a lease TTL, the stored run still
      // reads running, and the run looks stopped.
      const fromA = heldQueue(event => event.type === 'workflow.end');
      const a = await startReplica(build(), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 1 });
      await fromA.firstHeld;
      await waitUntilOrphaned(run.runId);

      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      (await b.workflow.createRun({ runId: run.runId }))
        .restart()
        .catch(error => console.error('The restart rejected', error));
      await fromB.firstHeld;
      await fromB.drain(b);
      fromA.holdAll();
      await fromA.drain(a);

      expect(executions).toEqual(['first', 'second']);
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('restarts a time travel of an ended run whose start event never reached a worker', async () => {
      const build = () =>
        createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
          .then(work('first', async () => {}))
          .then(work('second', async () => {}))
          .commit();
      // A's time travel sets the run running, and its start event is lost.
      const a = await startReplica(build(), event =>
        event.type === 'workflow.start' && event.data.timeTravel ? 'drop' : undefined,
      );
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      run
        .timeTravel({ step: 'second', inputData: { n: 2 } })
        .catch(error => console.error('The time travel rejected', error));
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('running');
      await waitUntilOrphaned(run.runId);

      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      (await b.workflow.createRun({ runId: run.runId }))
        .restart()
        .catch(error => console.error('The restart rejected', error));
      await fromB.firstHeld;
      await fromB.drain(b);

      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(finishesOf(run.runId, b)).toHaveLength(1);
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        travelled.then(result => result.status),
        new Promise(resolve => {
          timer = setTimeout(() => resolve('still waiting'), 5_000);
        }),
      ]);
      clearTimeout(timer);
      expect(outcome).toBe('success');
      expect(executions).toEqual(['first', 'second', 'second']);
    }, 20_000);

    it('does not end a time travel when a late event of the earlier execution arrives', async () => {
      const executions: string[] = [];
      const gate = deferred<void>();
      const reached = deferred<void>();
      const build = () =>
        createWorkflow({
          id: 'finished',
          inputSchema: Num,
          outputSchema: Num,
          options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
        })
          .then(
            work('first', async id => {
              executions.push(id);
              // The time travel's run of this step waits until the late event was handled.
              if (executions.filter(entry => entry === id).length === 2) {
                reached.resolve();
                await gate.promise;
              }
            }),
          )
          .then(work('second', async id => void executions.push(id)))
          .commit();
      const a = await startReplica(build());
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      const lastStep = a.delivered.find(event => event.type === 'workflow.step.run' && samePath(event, [1]))!;

      const travelled = run.timeTravel({ step: 'first', inputData: { n: 2 } });
      await reached.promise;
      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      expect(await redeliver(b, lastStep)).toEqual({ ok: true });
      expect(fromB.queue).toEqual([]);
      gate.resolve();

      expect((await travelled).status).toBe('success');
      expect(executions).toEqual(['first', 'second', 'first', 'second']);
      expect(finishesOf(run.runId, a, b)).toHaveLength(2);
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

    /**
     * A parent `dountil` around a nested child that adds one to `n`, until `n`
     * reaches 2. `checks` and `iterations` record each condition evaluation and
     * each child run, by the `n` they saw. `condition` runs before each check.
     */
    function nestedLoop({
      options,
      condition,
    }: { options?: { autoRestartActiveRuns?: boolean }; condition?: (n: number) => Promise<void> } = {}) {
      const checks: number[] = [];
      const iterations: number[] = [];
      const build = () => {
        const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
          .then(
            createStep({
              id: 'increment',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                iterations.push(inputData.n + 1);
                return { n: inputData.n + 1 };
              },
            }),
          )
          .commit();
        return createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num, options })
          .dountil(child, async ({ inputData }) => {
            await condition?.(inputData.n);
            checks.push(inputData.n);
            return inputData.n >= 2;
          })
          .commit();
      };
      return { checks, iterations, build };
    }

    it('takes no hand-off claims for a nested loop whose workflow takes no step leases', async () => {
      const { checks, build } = nestedLoop({ options: { autoRestartActiveRuns: false } });
      const a = await startReplica(build());
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 2 } });
      expect(checks).toEqual([1, 2]);

      const store = (await getStorage().getStore('workflows'))!;
      const children = childEnds(a.published, run.runId).map(event => event.runId);
      expect(children).toHaveLength(2);
      for (const child of children) {
        expect(await store.getRunOwnership({ runId: nestedHandOffKey(run.runId, [0], child) })).toBeNull();
      }
    }, 20_000);

    it('evaluates a dountil condition once when a nested end arrives again while the condition runs past a lease TTL', async () => {
      const slow = deferred<void>();
      const conditionRuns = deferred<void>();
      let evaluations = 0;
      // Only the first evaluation is slow.
      const { checks, build } = nestedLoop({
        condition: async () => {
          if (++evaluations > 1) {
            return;
          }

          conditionRuns.resolve();
          await slow.promise;
        },
      });
      const fromA = heldQueue(() => false);
      const a = await startReplica(build(), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 0 });
      await conditionRuns.promise;

      // The first child's end reaches B while A still evaluates the condition, after a lease TTL.
      await new Promise(resolve => setTimeout(resolve, 3 * Number(process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS)));
      const childEnd = childEnds(a.published, run.runId)[0]!;
      const store = (await getStorage().getStore('workflows'))!;
      const claim = await store.getRunOwnership({ runId: nestedHandOffKey(run.runId, [0], childEnd.runId) });
      expect(claim?.live).toBe(true);
      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      expect(await redeliver(b, childEnd)).toEqual({ ok: true });
      await fromB.drain(b);

      // A's condition returns and A goes on with the loop.
      fromA.holdAll();
      slow.resolve();
      await expect.poll(() => fromA.queue.length).toBeGreaterThan(0);
      await fromA.drain(a);

      expect((await storedRun(run.runId))?.status).toBe('success');
      expect(checks).toEqual([1, 2]);
    }, 20_000);

    it('leaves a nested hand-off in progress to its holder when a restart reaches the finished child', async () => {
      const slow = deferred<void>();
      const conditionRuns = deferred<void>();
      let evaluations = 0;
      // Only the first evaluation is slow.
      const { checks, iterations, build } = nestedLoop({
        condition: async () => {
          if (++evaluations > 1) {
            return;
          }

          conditionRuns.resolve();
          await slow.promise;
        },
      });
      const fromA = heldQueue(() => false);
      const a = await startReplica(build(), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      startInBackground(run, { n: 0 });
      await conditionRuns.promise;

      // A's liveness lapses while it still evaluates the condition, so B's restart is accepted and
      // reaches the finished child.
      await abandonLease(getStorage(), runLivenessKey(run.runId));
      const fromB = heldQueue(() => true);
      const b = await startReplica(build(), fromB.intercept);
      (await b.workflow.createRun({ runId: run.runId }))
        .restart()
        .catch(error => console.error('The restart rejected', error));
      await fromB.firstHeld;
      await fromB.drain(b);

      fromA.holdAll();
      slow.resolve();
      await expect.poll(() => fromA.queue.length).toBeGreaterThan(0);
      await fromA.drain(a);

      expect(checks).toEqual([1, 2]);
      expect(iterations).toEqual([1, 2]);
      expect((await storedRun(run.runId))?.status).toBe('success');
    }, 20_000);

    it('evaluates a dountil condition once per iteration when a restart hands off a nested iteration whose end is held', async () => {
      const { checks, iterations, build } = nestedLoop();
      let parentRunId = '';
      // The first child's end sits in A's broker queue past a lease TTL, so the parent looks stopped.
      const fromA = heldQueue(event => event.type === 'workflow.end' && event.runId !== parentRunId);
      const a = await startReplica(build(), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      parentRunId = run.runId;
      startInBackground(run, { n: 0 });
      await fromA.firstHeld;
      await waitUntilOrphaned(run.runId);

      // B's restart hands the finished child off to the loop, then A's held end arrives.
      const b = await startReplica(build());
      expect(await (await b.workflow.createRun({ runId: run.runId })).restart()).toMatchObject({
        status: 'success',
        result: { n: 2 },
      });
      fromA.holdAll();
      await fromA.drain(a);

      expect(checks).toEqual([1, 2]);
      expect(iterations).toEqual([1, 2]);
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it('evaluates a dountil condition once per iteration when a restart reads the loop before its next nested iteration starts', async () => {
      const { checks, iterations, build } = nestedLoop();
      let parentRunId = '';
      let loopRuns = 0;
      // The loop's second iteration sits in A's broker queue past a lease TTL.
      const fromA = heldQueue(
        event =>
          event.type === 'workflow.step.run' && event.runId === parentRunId && samePath(event, [0]) && ++loopRuns === 2,
      );
      const a = await startReplica(build(), fromA.intercept);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      parentRunId = run.runId;
      startInBackground(run, { n: 0 });
      await fromA.firstHeld;
      await waitUntilOrphaned(run.runId);

      const b = await startReplica(build());
      expect(await (await b.workflow.createRun({ runId: run.runId })).restart()).toMatchObject({
        status: 'success',
        result: { n: 2 },
      });
      fromA.holdAll();
      await fromA.drain(a);

      expect(checks).toEqual([1, 2]);
      expect(iterations).toEqual([1, 2]);
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);

    it.each(['step', 'nested workflow'] as const)(
      'keeps counting the iterations of a loop with a %s body when a restart reads it before its next iteration starts',
      async body => {
        const inputs: number[] = [];
        const build = () => {
          const count = createStep({
            id: 'count',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              inputs.push(inputData.n);
              return { n: inputData.n + 1 };
            },
          });
          const loopBody =
            body === 'step'
              ? count
              : createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num }).then(count).commit();
          return createWorkflow({ id: 'finished', inputSchema: Num, outputSchema: Num })
            .dountil(loopBody, async ({ iterationCount }) => iterationCount >= 3)
            .commit();
        };
        let parentRunId = '';
        let loopRuns = 0;
        // The loop's second iteration sits in A's broker queue past a lease TTL.
        const fromA = heldQueue(
          event =>
            event.type === 'workflow.step.run' &&
            event.runId === parentRunId &&
            samePath(event, [0]) &&
            ++loopRuns === 2,
        );
        const a = await startReplica(build(), fromA.intercept);
        const run = await a.workflow.createRun({ runId: uniqueRunId() });
        parentRunId = run.runId;
        startInBackground(run, { n: 0 });
        await fromA.firstHeld;
        await waitUntilOrphaned(run.runId);

        const b = await startReplica(build());
        expect(await (await b.workflow.createRun({ runId: run.runId })).restart()).toMatchObject({
          status: 'success',
          result: { n: 3 },
        });
        expect(inputs).toEqual([0, 1, 2]);
      },
      20_000,
    );

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

    it('runs no step when the start of a run whose end deleted its snapshot arrives again', async () => {
      const executions: string[] = [];
      const a = await startReplica(keepsNoSnapshot(executions));
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      expect((await run.start({ inputData: { n: 1 } })).status).toBe('success');
      await expect.poll(async () => await storedRun(run.runId)).toBeNull();
      const start = a.delivered.find(event => event.type === 'workflow.start')!;

      const fromB = heldQueue(() => true);
      const b = await startReplica(keepsNoSnapshot(executions), fromB.intercept);
      expect(await redeliver(b, start)).toEqual({ ok: true });
      await fromB.drain(b);

      expect(executions).toEqual(['first', 'second']);
      expect(finishesOf(run.runId, a, b)).toHaveLength(1);
    }, 20_000);
  });
}
