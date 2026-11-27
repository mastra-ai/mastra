/**
 * Shared cases for evented runs restarted while they still run (COR-1620). Run them on each store
 * with workflow step guards (Postgres, libSQL), once per storage version.
 *
 * A restart takes the run over: it claims each step it restarts before publishing anything, so
 * the worker that started the step can no longer save it, a step that saved its result before the
 * claim keeps it, and each step after the restart point runs once.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import type { WorkflowOptions } from '../..';
import { createStep, createWorkflow as createEventedWorkflow } from '..';
import { drainHandlers, settleDeliveries } from './redelivery-contract';
import { RedeliveryDriver } from './redelivery-driver';

const Num = z.object({ n: z.number() });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

type Host = { driver: RedeliveryDriver; warn: MockInstance };

/** Steps that count their executions and can be held inside their body at a given execution. */
function holdableSteps() {
  const calls: Record<string, number> = {};
  const holds = new Map<
    string,
    { at: number; entered: ReturnType<typeof deferred>; released: ReturnType<typeof deferred> }
  >();
  /** Holds `id`'s `at`-th execution (by default its next one) inside its body. */
  const holdAt = (id: string, at = (calls[id] ?? 0) + 1) => {
    const hold = { at, entered: deferred(), released: deferred() };
    holds.set(id, hold);
    return { entered: hold.entered.promise, release: hold.released.resolve };
  };
  const step = (id: string) =>
    createStep({
      id,
      inputSchema: Num,
      outputSchema: Num,
      execute: async ({ inputData }) => {
        const call = (calls[id] = (calls[id] ?? 0) + 1);
        const hold = holds.get(id);
        if (hold?.at === call) {
          hold.entered.resolve();
          await hold.released.promise;
        }
        return { n: inputData.n + 1 };
      },
    });
  const releaseAll = () => holds.forEach(hold => hold.released.resolve());
  return { calls, step, holdAt, releaseAll };
}

export function describeRestartOccurrenceCases({
  getStorage,
  storageVersion,
}: {
  getStorage: () => MastraStorage;
  storageVersion: 1 | 2;
}) {
  describe('evented restarts of a live run (COR-1620)', () => {
    let storage: MastraStorage;
    beforeAll(() => {
      storage = getStorage();
    });
    const createWorkflow = ((params: Parameters<typeof createEventedWorkflow>[0]) => {
      const options: WorkflowOptions<any> = { ...params.options, storageVersion };
      return createEventedWorkflow({ ...params, options });
    }) as typeof createEventedWorkflow;

    // A case that hangs never reaches its own cleanup; release its host so later cases can run.
    let live: { mastra: Mastra; driver: RedeliveryDriver; release: () => void } | undefined;
    afterEach(async () => {
      const host = live;
      live = undefined;
      if (!host) return;
      host.release();
      try {
        await host.mastra.stopWorkers();
      } finally {
        host.driver.dispose();
      }
    });

    async function withHost(workflows: Record<string, any>, release: () => void, body: (host: Host) => Promise<void>) {
      const driver = new RedeliveryDriver();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows });
      live = { mastra, driver, release };
      const warn = vi.spyOn(mastra.getLogger(), 'warn');
      try {
        await mastra.startWorkers();
        await body({ driver, warn });
      } finally {
        release();
        warn.mockRestore();
        live = undefined;
        try {
          await mastra.stopWorkers();
        } finally {
          driver.dispose();
        }
      }
    }

    async function storedRun(workflowId: string, runId: string) {
      const store = (await storage.getStore('workflows'))!;
      return store.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    }

    /** `restart()` called on a run object of its own, as another caller would. */
    const restartRun = async (workflow: { createRun: (options: { runId: string }) => Promise<any> }, runId: string) =>
      (await workflow.createRun({ runId })).restart();

    /**
     * Keeps the next `count` restart events from reaching the workers, after their callers read the
     * run. `release` hands them on and resolves once the workers handled them.
     */
    function holdRestartEvents(driver: RedeliveryDriver, count = 1) {
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      const held: (() => Promise<void>)[] = [];
      const captured = deferred();
      const spy = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && event.type === 'workflow.start' && event.data?.restart && held.length < count) {
          held.push(() => publish(topic, event, options));
          if (held.length === count) captured.resolve();
          return;
        }
        return publish(topic, event, options);
      });
      return {
        captured: captured.promise,
        release: async (): Promise<Event[]> => {
          spy.mockRestore();
          const from = driver.events.length;
          for (const send of held.splice(0)) await send();
          const sent = driver.events.slice(from).filter(event => event.type === 'workflow.start' && event.data.restart);
          await settleDeliveries(sent);
          return sent;
        },
        restore: () => spy.mockRestore(),
      };
    }

    /**
     * Keeps the `workflows` events `pick` selects from the workers until `release(index)` hands one
     * on, returning it as delivered. `count(n)` waits until `n` were held.
     */
    function holdPublishes(driver: RedeliveryDriver, pick: (event: any) => boolean) {
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      const held: { event: any; send: () => Promise<void> }[] = [];
      let notify = () => {};
      const spy = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && pick(event)) {
          held.push({ event, send: () => publish(topic, event, options) });
          notify();
          return;
        }
        return publish(topic, event, options);
      });
      return {
        held,
        count: async (n: number) => {
          while (held.length < n) await new Promise<void>(resolve => (notify = resolve));
        },
        release: async (index: number): Promise<Event> => {
          const from = driver.events.length;
          await held[index]!.send();
          return driver.events[from]!;
        },
        restore: () => spy.mockRestore(),
      };
    }

    const isStepRun = (event: any, workflowId: string, path: number[]) =>
      event.type === 'workflow.step.run' &&
      event.data?.workflowId === workflowId &&
      JSON.stringify(event.data.executionPath) === JSON.stringify(path);

    const stepRuns = (driver: RedeliveryDriver, runId: string, workflowId: string, path: number[]) =>
      driver.stepRuns({ spec: `${workflowId}@${path.join(',')}`, runId });

    /** a -> b -> c, each holdable. */
    function chain() {
      const steps = holdableSteps();
      const workflow = createWorkflow({ id: `restart-chain-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(steps.step('a'))
        .then(steps.step('b'))
        .then(steps.step('c'))
        .commit();
      return { ...steps, workflow };
    }

    // R1. Without the claim the restart forked the run: the old delivery's save still landed after
    // the restart ran the step again, so the old worker continued the run too and the next step ran
    // twice.
    it('takes a step over from the delivery still inside it when the run is restarted', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver, warn }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;
        const oldDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1])[0]!;

        const restartC = wf.holdAt('c');
        const restarted = restartRun(wf.workflow, run.runId);
        await restartC.entered;
        const restartDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1]).at(-1)!;
        expect(restartDelivery.id).not.toBe(oldDelivery.id);

        // The old delivery's step returns while the restarted run is in c; its save is refused.
        oldB.release();
        // a's, the restart's b and the old b.
        const stepEnds = () => driver.events.filter(e => e.type === 'workflow.step.end' && e.runId === run.runId);
        await expect.poll(() => stepEnds().length).toBeGreaterThanOrEqual(3);
        await settleDeliveries(stepEnds());
        restartC.release();
        expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
        await drainHandlers();
        expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
        expect(wf.calls).toEqual({ a: 1, b: 2, c: 1 });
        expect((await storedRun(wf.workflow.id, run.runId))?.context.b).toMatchObject({
          status: 'success',
          metadata: { startedBy: restartDelivery.id },
        });
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('stale'),
          expect.objectContaining({ runId: run.runId, executionPath: [1], storedStartedBy: restartDelivery.id }),
        );
      });
    }, 20_000);

    // R2. Two restarts that read the run at the same point both forked it, so the restarted step and
    // every step after it ran once per restart. One restart now claims the step; the other finds it
    // claimed and publishes nothing.
    it('runs each step after the restart point once when the run is restarted twice at once', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;

        const restarts = holdRestartEvents(driver, 2);
        const results = Promise.all([restartRun(wf.workflow, run.runId), restartRun(wf.workflow, run.runId)]);
        await restarts.captured;
        await restarts.release();
        expect(await results).toMatchObject([
          { status: 'success', result: { n: 3 } },
          { status: 'success', result: { n: 3 } },
        ]);

        oldB.release();
        await drainHandlers();
        expect(await started).toMatchObject({ status: 'success' });
        expect(wf.calls).toEqual({ a: 1, b: 2, c: 1 });
      });
    }, 20_000);

    // R3. A restart event delivered again rewrote the run from what its caller read: the steps the
    // run finished since went back to running, and they ran again.
    it('keeps the progress of a restarted run when the restart event is delivered again', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;

        const restartC = wf.holdAt('c');
        const from = driver.events.length;
        const restarted = restartRun(wf.workflow, run.runId);
        await restartC.entered;
        const before = (await storedRun(wf.workflow.id, run.runId))?.context;
        expect(before?.b).toMatchObject({ status: 'success' });

        const trigger = driver.events
          .slice(from)
          .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.restart)!;
        await driver.redeliverEvent(trigger);
        const after = (await storedRun(wf.workflow.id, run.runId))?.context;
        expect(after?.b).toEqual(before?.b);
        expect(after?.c).toEqual(before?.c);

        restartC.release();
        expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
        oldB.release();
        await drainHandlers();
        expect(await started).toMatchObject({ status: 'success' });
        expect(wf.calls).toEqual({ a: 1, b: 2, c: 1 });
      });
    }, 20_000);

    /** A parent running `child` (one step, `inner`) and then `after`. */
    function nestedChain() {
      const steps = holdableSteps();
      const child = createWorkflow({ id: `restart-start-child-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(steps.step('inner'))
        .commit();
      const workflow = createWorkflow({
        id: `restart-start-parent-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
      })
        .then(child)
        .then(steps.step('after'))
        .commit();
      return { ...steps, child, workflow, workflows: { [child.id]: child, [workflow.id]: workflow } };
    }

    // A restart took the parent's nested step over while the old occurrence's start of the nested run
    // was still in flight. That start wrote the parent's step back and ran the nested run for the
    // occurrence the restart replaced.
    it('does not run a nested workflow for a parent step a restart took over while its start was in flight', async () => {
      const wf = nestedChain();
      await withHost(wf.workflows, wf.releaseAll, async ({ driver }) => {
        const held = holdPublishes(
          driver,
          event =>
            (event.type === 'workflow.start' && event.data?.workflowId === wf.child.id && !event.data.restart) ||
            (isStepRun(event, wf.workflow.id, [0]) && !!event.data.restart),
        );
        try {
          const run = await wf.workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await held.count(1);
          const restarted = restartRun(wf.workflow, run.runId);
          await held.count(2);

          await held.release(0);
          await drainHandlers();
          // Storage v2: the start's descriptor carries no step results, so it can't tell which
          // occurrence dispatched it. The old occurrence's nested run finishes the step and the run;
          // the restart's delivery then finds the step finished. Each step still runs once.
          expect(wf.calls).toEqual(storageVersion === 1 ? {} : { inner: 1, after: 1 });

          await held.release(1);
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          expect(wf.calls).toEqual({ inner: 1, after: 1 });
        } finally {
          held.restore();
        }
      });
    }, 20_000);

    // Pins what a nested start delivered again after the parent's step finished does: the occurrence
    // that dispatched it already finished the step, so the parent's step keeps its result. The start
    // writes the nested run from its own data, so the nested run's step runs again, and its hand-back
    // continues the parent from the result already saved; the parent's next step still runs once.
    it('keeps the parent step when its nested start is delivered again after the step finished', async () => {
      const wf = nestedChain();
      await withHost(wf.workflows, wf.releaseAll, async ({ driver }) => {
        const next = holdPublishes(driver, event => isStepRun(event, wf.workflow.id, [1]));
        try {
          const run = await wf.workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await next.count(1);
          const before = (await storedRun(wf.workflow.id, run.runId))?.context[wf.child.id];
          expect(before).toMatchObject({ status: 'success' });

          const childStart = driver.events.find(
            event => event.type === 'workflow.start' && event.data.workflowId === wf.child.id,
          )!;
          await driver.redeliverEvent(childStart);
          await next.count(2);
          const kept = (await storedRun(wf.workflow.id, run.runId))?.context[wf.child.id];
          expect(kept).toMatchObject({ status: 'success', metadata: { startedBy: before?.metadata?.startedBy } });

          const after = wf.holdAt('after');
          await next.release(0);
          await after.entered;
          await settleDeliveries([await next.release(1)]);
          after.release();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ inner: 2, after: 1 });
        } finally {
          next.restore();
        }
      });
    }, 20_000);

    // R3 for a restart with nothing to claim: a sleep's record carries no occurrence. Delivered again,
    // the restart event set the run's cursor back to the sleep and slept again.
    it('keeps the progress of a run restarted in a sleep when the restart event is delivered again', async () => {
      const steps = holdableSteps();
      const workflow = createWorkflow({
        id: `restart-sleep-again-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
      })
        .then(steps.step('a'))
        .sleep(10)
        .then(steps.step('after'))
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        // The worker that started the run stops while it sleeps: its timer's next step never goes out.
        const oldWake = holdPublishes(driver, event => isStepRun(event, workflow.id, [2]) && !event.data.restart);
        try {
          const run = await workflow.createRun();
          void run.start({ inputData: { n: 0 } });
          await oldWake.count(1);

          const after = steps.holdAt('after');
          const from = driver.events.length;
          const restarted = restartRun(workflow, run.runId);
          await after.entered;
          expect((await storedRun(workflow.id, run.runId))?.activePaths).toEqual([2]);

          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.restart)!;
          await driver.redeliverEvent(trigger);
          expect((await storedRun(workflow.id, run.runId))?.activePaths).toEqual([2]);
          expect(
            stepRuns(driver, run.runId, workflow.id, [1]).filter(e => driver.events.indexOf(e) >= from),
          ).toHaveLength(1);

          after.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(steps.calls).toEqual({ a: 1, after: 1 });
        } finally {
          oldWake.restore();
        }
      });
    }, 20_000);

    // R3 for a restart before the first step started. Such a restart has no step to claim and
    // writes the run whole; delivered again, it wrote it again from what its caller read, which
    // dropped the results saved since, and the first step ran again.
    it('keeps the progress of a run restarted before its first step when the restart event is delivered again', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        let runId = '';
        const dropped = deferred();
        const publish = driver.pubsub.publish.bind(driver.pubsub);
        // The worker that started the run stops before its first step's event goes out.
        const dropFirstStep = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
          if (event.type === 'workflow.step.run' && event.runId === runId && !event.data.restart) {
            dropped.resolve();
            return;
          }
          return publish(topic, event, options);
        });
        try {
          const run = await wf.workflow.createRun();
          runId = run.runId;
          const started = run.start({ inputData: { n: 0 } });
          await dropped.promise;
          dropFirstStep.mockRestore();

          const restartC = wf.holdAt('c');
          const from = driver.events.length;
          const restarted = restartRun(wf.workflow, run.runId);
          await restartC.entered;
          const before = (await storedRun(wf.workflow.id, run.runId))?.context;
          expect(before).toMatchObject({ a: { status: 'success' }, b: { status: 'success' } });

          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.restart)!;
          expect(trigger.data.restart.isPreFirstStepRestart).toBe(true);
          await driver.redeliverEvent(trigger);
          const after = (await storedRun(wf.workflow.id, run.runId))?.context;
          expect(after?.a).toEqual(before?.a);
          expect(after?.b).toEqual(before?.b);

          restartC.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success' });
          expect(wf.calls).toEqual({ a: 1, b: 1, c: 1 });
        } finally {
          dropFirstStep.mockRestore();
        }
      });
    }, 20_000);

    // R4. A branch that saved its result after the restart's caller read the run, but before the
    // restart applied, was overwritten with the running record the caller read, and ran again.
    it('keeps a branch result saved between the restart read and the restart', async () => {
      const steps = holdableSteps();
      const workflow = createWorkflow({
        id: `restart-parallel-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: z.any(),
      })
        .parallel([steps.step('a'), steps.step('b')])
        .then(
          createStep({
            id: 'c',
            inputSchema: z.any(),
            outputSchema: Num,
            execute: async ({ inputData }) => {
              steps.calls.c = (steps.calls.c ?? 0) + 1;
              return { n: inputData.a.n + inputData.b.n };
            },
          }),
        )
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        const run = await workflow.createRun();
        const oldA = steps.holdAt('a');
        const oldB = steps.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await Promise.all([oldA.entered, oldB.entered]);

        const restart = holdRestartEvents(driver);
        const restarted = restartRun(workflow, run.runId);
        await restart.captured;

        // a saves its result after the restart read the run as running.
        oldA.release();
        const aEnds = () => driver.events.filter(e => e.type === 'workflow.step.end' && e.runId === run.runId);
        await expect.poll(() => aEnds().length).toBe(1);
        await settleDeliveries(aEnds());
        const savedA = (await storedRun(workflow.id, run.runId))?.context.a;
        expect(savedA).toMatchObject({ status: 'success', output: { n: 1 } });

        await restart.release();
        expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
        oldB.release();
        await drainHandlers();
        expect(await started).toMatchObject({ status: 'success' });
        expect(steps.calls).toEqual({ a: 1, b: 2, c: 1 });
        expect((await storedRun(workflow.id, run.runId))?.context.a).toMatchObject({
          status: 'success',
          metadata: { startedBy: savedA?.metadata?.startedBy },
        });
      });
    }, 20_000);

    // R6. A restarted run still finishes once its steps are guarded, whatever entry it is in. The
    // old worker's delivery is held in the entry while the restart runs it again.
    describe('finishes a restarted run', () => {
      it('restarted inside a loop body', async () => {
        const steps = holdableSteps();
        const workflow = createWorkflow({ id: `restart-loop-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .dountil(steps.step('body'), async ({ inputData }) => inputData.n >= 3)
          .then(steps.step('after'))
          .commit();
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async () => {
          const run = await workflow.createRun();
          const oldIteration = steps.holdAt('body', 2);
          const started = run.start({ inputData: { n: 0 } });
          await oldIteration.entered;
          expect(await restartRun(workflow, run.runId)).toMatchObject({ status: 'success', result: { n: 4 } });
          oldIteration.release();
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 4 } });
          // Iterations 1 and 2 on the old worker, 2 and 3 under the restart.
          expect(steps.calls).toEqual({ body: 4, after: 1 });
        });
      }, 20_000);

      it('restarted inside a nested workflow', async () => {
        const steps = holdableSteps();
        const child = createWorkflow({ id: `restart-child-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(steps.step('inner'))
          .commit();
        const workflow = createWorkflow({ id: `restart-nested-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(child)
          .then(steps.step('after'))
          .commit();
        await withHost({ [child.id]: child, [workflow.id]: workflow }, steps.releaseAll, async () => {
          const run = await workflow.createRun();
          const oldInner = steps.holdAt('inner');
          const started = run.start({ inputData: { n: 0 } });
          await oldInner.entered;
          expect(await restartRun(workflow, run.runId)).toMatchObject({ status: 'success', result: { n: 2 } });
          oldInner.release();
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          expect(steps.calls).toEqual({ inner: 2, after: 1 });
        });
      }, 20_000);

      // The restart takes the parent's nested step over, but the old run still drives the same child
      // run. A sleeping child has no step the child's restart can claim, so the old timer's chain can
      // win it. On storage v1 its hand-back carried the occurrence the restart took the parent's step
      // from, the parent's guard refused it, and the parent and the restart's caller waited forever.
      it('restarted while its nested workflow sleeps, and the old run wins the nested workflow', async () => {
        const steps = holdableSteps();
        const child = createWorkflow({
          id: `restart-sleeping-child-${randomUUID()}`,
          inputSchema: Num,
          outputSchema: Num,
        })
          .then(steps.step('a'))
          .sleep(10)
          .then(steps.step('b'))
          .commit();
        const workflow = createWorkflow({
          id: `restart-sleeping-parent-${randomUUID()}`,
          inputSchema: Num,
          outputSchema: Num,
        })
          .then(child)
          .then(steps.step('after'))
          .commit();
        await withHost({ [child.id]: child, [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          // The child's step after its sleep, once per timer.
          const wake = holdPublishes(driver, event => isStepRun(event, child.id, [2]));
          try {
            const run = await workflow.createRun();
            const started = run.start({ inputData: { n: 0 } });
            await wake.count(1);
            const restarted = restartRun(workflow, run.runId);
            await wake.count(2);
            expect(wake.held[0]!.event.data.restart).toBeUndefined();
            expect(wake.held[1]!.event.data.restart).toBeDefined();

            // The old timer's b runs first; the restart's copy finds it running and is refused.
            const oldB = steps.holdAt('b');
            await wake.release(0);
            await oldB.entered;
            await settleDeliveries([await wake.release(1)]);
            oldB.release();

            await expect
              .poll(async () => (await storedRun(workflow.id, run.runId))?.status, { timeout: 5_000 })
              .toBe('success');
            expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
            await drainHandlers();
            expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
            expect(steps.calls).toEqual({ a: 1, b: 1, after: 1 });
          } finally {
            wake.restore();
          }
        });
      }, 20_000);

      it('restarted inside a branch', async () => {
        const steps = holdableSteps();
        const workflow = createWorkflow({ id: `restart-branch-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .branch([
            [async ({ inputData }) => inputData.n === 0, steps.step('yes')],
            [async ({ inputData }) => inputData.n !== 0, steps.step('no')],
          ])
          .map(async ({ inputData }) => ({ n: inputData.yes!.n }))
          .then(steps.step('after'))
          .commit();
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async () => {
          const run = await workflow.createRun();
          const oldYes = steps.holdAt('yes');
          const started = run.start({ inputData: { n: 0 } });
          await oldYes.entered;
          expect(await restartRun(workflow, run.runId)).toMatchObject({ status: 'success', result: { n: 2 } });
          oldYes.release();
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          expect(steps.calls).toEqual({ yes: 2, after: 1 });
        });
      }, 20_000);

      // The old worker's sleep timer stays live and publishes the next step too. The first of the two
      // deliveries claims it, and its guard refuses the other.
      it('restarted while it sleeps', async () => {
        const steps = holdableSteps();
        const workflow = createWorkflow({ id: `restart-sleep-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(steps.step('a'))
          .sleep(500)
          .then(steps.step('after'))
          .commit();
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          const run = await workflow.createRun();
          const firstAfter = steps.holdAt('after');
          const started = run.start({ inputData: { n: 0 } });
          await expect
            .poll(async () => (await storedRun(workflow.id, run.runId))?.activePaths, { timeout: 5_000 })
            .toEqual([1]);
          const restarted = restartRun(workflow, run.runId);
          await firstAfter.entered;
          await expect.poll(() => stepRuns(driver, run.runId, workflow.id, [2]).length, { timeout: 5_000 }).toBe(2);
          await settleDeliveries(stepRuns(driver, run.runId, workflow.id, [2]).slice(1));
          firstAfter.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          expect(steps.calls).toEqual({ a: 1, after: 1 });
        });
      }, 20_000);
    });

    // R7. A run that ended after the restart's caller read it was set back to running from what the
    // caller read, and its step ran again.
    it('does not reopen a run that ended between the restart read and the restart', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;

        const restart = holdRestartEvents(driver);
        // Nothing ends the run again once the restart is refused, so its caller is left waiting.
        void restartRun(wf.workflow, run.runId).catch(() => {});
        await restart.captured;
        oldB.release();
        expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
        await drainHandlers();
        const ended = await storedRun(wf.workflow.id, run.runId);

        const from = driver.events.length;
        await restart.release();
        await drainHandlers();
        expect(driver.events.slice(from).filter(e => e.type === 'workflow.step.run')).toEqual([]);
        expect(await storedRun(wf.workflow.id, run.runId)).toMatchObject({
          status: 'success',
          activePaths: ended?.activePaths,
          context: { b: ended?.context.b, c: ended?.context.c },
        });
        expect(wf.calls).toEqual({ a: 1, b: 1, c: 1 });
      });
    }, 20_000);
  });
}
