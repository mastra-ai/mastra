/**
 * Shared cases for evented runs restarted while they still run (COR-1620). Run them on each store
 * with workflow step guards (Postgres, libSQL), once per storage version.
 *
 * A restart takes the run over: it claims each step it restarts before publishing anything, so
 * the worker that started the step can no longer save it, a step that saved its result before the
 * claim keeps it, and each step after the restart point runs once.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../../di';
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

/** `promise`, or a rejection naming `what` when it has not settled within `ms`. */
function within<T>(promise: Promise<T>, what: string, ms = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Waited ${ms} ms for ${what}`)), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

/** Steps that count their executions and can be held inside their body at a given execution. */
function holdableSteps() {
  const calls: Record<string, number> = {};
  /** The `restartedBy` request context value each step's last execution saw. */
  const restartedBy: Record<string, string | undefined> = {};
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
      execute: async ({ inputData, requestContext }) => {
        const call = (calls[id] = (calls[id] ?? 0) + 1);
        restartedBy[id] = requestContext.get('restartedBy') as string | undefined;
        const hold = holds.get(id);
        if (hold?.at === call) {
          hold.entered.resolve();
          await hold.released.promise;
        }
        return { n: inputData.n + 1 };
      },
    });
  const releaseAll = () => holds.forEach(hold => hold.released.resolve());
  return { calls, restartedBy, step, holdAt, releaseAll };
}

export function describeRestartOccurrenceCases({
  getStorage,
  storageVersion,
  countV1Snapshots,
}: {
  getStorage: () => MastraStorage;
  storageVersion: 1 | 2;
  /**
   * Counts the rows of the store's v1 snapshot table. Omit it when the caller checks the table
   * itself.
   */
  countV1Snapshots?: () => Promise<number>;
}) {
  describe('evented restarts of a live run (COR-1620)', () => {
    let storage: MastraStorage;
    beforeAll(() => {
      storage = getStorage();
    });
    // A v2 run must never fall back to the v1 snapshot table.
    afterAll(async () => {
      if (storageVersion === 2 && countV1Snapshots) expect(await countV1Snapshots()).toBe(0);
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
    const restartRun = async (
      workflow: { createRun: (options: { runId: string }) => Promise<any> },
      runId: string,
      requestContext?: RequestContext,
    ) => (await workflow.createRun({ runId })).restart({ requestContext });

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

    /**
     * Calls `restart()` and holds it after it read the run, before it waits for the run's finish and
     * publishes its event. `proceed` lets it go on.
     */
    async function restartHeldAfterRead(
      workflow: { createRun: (options: { runId: string }) => Promise<any> },
      runId: string,
    ) {
      const run = await workflow.createRun({ runId });
      const engine = run.executionEngine;
      const execute = engine.execute.bind(engine);
      const read = deferred();
      const go = deferred();
      const spy = vi.spyOn(engine, 'execute').mockImplementation(async (params: any) => {
        if (!params.restart) return execute(params);
        spy.mockRestore();
        read.resolve();
        await go.promise;
        return execute(params);
      });
      const restarted: Promise<any> = run.restart();
      await read.promise;
      return { restarted, proceed: go.resolve, restore: () => spy.mockRestore() };
    }

    const isStepRun = (event: any, workflowId: string, path: number[]) =>
      event.type === 'workflow.step.run' &&
      event.data?.workflowId === workflowId &&
      JSON.stringify(event.data.executionPath) === JSON.stringify(path);

    const stepRuns = (driver: RedeliveryDriver, runId: string, workflowId: string, path: number[]) =>
      driver.stepRuns({ spec: `${workflowId}@${path.join(',')}`, runId });

    /** a -> b -> c, each holdable. */
    function chain(options?: WorkflowOptions<any>) {
      const steps = holdableSteps();
      const workflow = createWorkflow({
        id: `restart-chain-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        ...(options ? { options } : {}),
      })
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

    // The restart's worker stops after its claims, before its step event goes out. The broker then
    // delivers the restart event again: its claims find the steps it claimed and take them again, it
    // publishes its step event, and the step runs once under the restart. The old save is refused.
    it('recovers a restart whose worker stopped between its claims and its publish', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        let dropped = 0;
        const lost = holdPublishes(
          driver,
          event => isStepRun(event, wf.workflow.id, [1]) && !!event.data.restart && !dropped++,
        );
        try {
          const run = await wf.workflow.createRun();
          const oldB = wf.holdAt('b');
          const started = run.start({ inputData: { n: 0 } });
          await oldB.entered;
          const oldDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1])[0]!;

          const from = driver.events.length;
          const restarted = restartRun(wf.workflow, run.runId);
          await lost.count(1);
          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.restart)!;
          await settleDeliveries([trigger]);
          expect((await storedRun(wf.workflow.id, run.runId))?.context.b).toMatchObject({
            status: 'running',
            metadata: { startedBy: trigger.id, __restartPending: true },
          });

          const restartC = wf.holdAt('c');
          await driver.redeliverEvent(trigger);
          await restartC.entered;
          const restartDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1]).at(-1)!;
          expect(restartDelivery.id).not.toBe(oldDelivery.id);
          oldB.release();
          await settleDeliveries([oldDelivery]);
          restartC.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
          expect(wf.calls).toEqual({ a: 1, b: 2, c: 1 });
          expect((await storedRun(wf.workflow.id, run.runId))?.context.b).toMatchObject({
            status: 'success',
            metadata: { startedBy: restartDelivery.id },
          });
        } finally {
          lost.restore();
        }
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

    // Two restarts read a parallel block with both branches running, and each claims one branch
    // first: the first restart claims a and is paused before b, the second then claims b. Each
    // publishes its whole dispatch, the guards refuse the branch it lost, and each branch runs once
    // under one restart. The block ends once.
    it('runs each branch once when two restarts split a parallel block', async () => {
      const steps = holdableSteps();
      const workflow = createWorkflow({ id: `restart-split-${randomUUID()}`, inputSchema: Num, outputSchema: z.any() })
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
      const store = (await storage.getStore('workflows'))!;
      const method = storageVersion === 1 ? 'updateWorkflowResults' : 'appendWorkflowRunEntries';
      const write = (store[method] as (args: any) => Promise<any>).bind(store);
      const firstClaim = deferred();
      const resumeFirst = deferred();
      let claims = 0;
      const pause = vi.spyOn(store, method).mockImplementation(async (args: any) => {
        const result = await write(args);
        if (args.startGuard?.takeover && ++claims === 1) {
          firstClaim.resolve();
          await resumeFirst.promise;
        }
        return result;
      });
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        const restarts = holdPublishes(driver, event => event.type === 'workflow.start' && !!event.data?.restart);
        try {
          const run = await workflow.createRun();
          const oldA = steps.holdAt('a');
          const oldB = steps.holdAt('b');
          const started = run.start({ inputData: { n: 0 } });
          await Promise.all([oldA.entered, oldB.entered]);

          const results = Promise.all([restartRun(workflow, run.runId), restartRun(workflow, run.runId)]);
          await restarts.count(2);
          const first = await restarts.release(0);
          await within(firstClaim.promise, 'the first restart to claim a branch');
          expect((await storedRun(workflow.id, run.runId))?.context.a?.metadata).toMatchObject({
            startedBy: first.id,
          });
          const second = await restarts.release(1);
          await settleDeliveries([second]);
          expect((await storedRun(workflow.id, run.runId))?.context.b?.metadata?.startedBy).not.toBe(first.id);
          resumeFirst.resolve();
          await settleDeliveries([first]);

          oldA.release();
          oldB.release();
          expect(await results).toMatchObject([
            { status: 'success', result: { n: 2 } },
            { status: 'success', result: { n: 2 } },
          ]);
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          if (storageVersion === 1) {
            expect(steps.calls).toEqual({ a: 2, b: 2, c: 1 });
          } else {
            // Storage v2: a restart's delivery of a branch it lost reads the other restart's claim (or
            // result) as the occurrence it expects, and can run the branch again (COR-1666). The block
            // still ends once.
            expect(steps.calls.c).toBe(1);
            expect(steps.calls.a).toBeGreaterThanOrEqual(2);
            expect(steps.calls.b).toBeGreaterThanOrEqual(2);
          }
        } finally {
          resumeFirst.resolve();
          restarts.restore();
          pause.mockRestore();
        }
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

          const childRunId = (await storedRun(wf.workflow.id, run.runId))?.context[wf.child.id]?.metadata?.nestedRunId;
          const childBefore = await storedRun(wf.child.id, childRunId);
          await held.release(0);
          await drainHandlers();
          // The refused start wrote nothing to the nested run.
          if (storageVersion === 1) expect(await storedRun(wf.child.id, childRunId)).toEqual(childBefore);
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

    // The restart claims the parent's nested step, and the old run's nested workflow suspends before
    // the restart's delivery of that step runs. The suspension is refused at the claimed step, and
    // the restart's delivery then found the nested run suspended and failed the run as not active.
    // It now hands the suspension up: the run suspends, and a resume finishes it.
    it('suspends a run whose nested workflow suspended after a restart claimed its step', async () => {
      let gateCalls = 0;
      const entered = deferred();
      const release = deferred();
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ ok: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (++gateCalls === 1) {
            entered.resolve();
            await release.promise;
          }
          if (!resumeData) return suspend({ reason: 'approval' });
          return { n: inputData.n + 1 };
        },
      });
      const child = createWorkflow({
        id: `restart-suspending-child-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
      })
        .then(gate)
        .commit();
      const workflow = createWorkflow({
        id: `restart-suspending-parent-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
      })
        .then(child)
        .commit();
      await withHost({ [child.id]: child, [workflow.id]: workflow }, release.resolve, async ({ driver }) => {
        const held = holdPublishes(driver, event => isStepRun(event, workflow.id, [0]) && !!event.data.restart);
        try {
          const run = await workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await entered.promise;
          const restarted = restartRun(workflow, run.runId);
          await held.count(1);
          // The old run's nested workflow suspends while the restart's delivery waits.
          release.resolve();
          const childRunId = (await storedRun(workflow.id, run.runId))?.context[child.id]?.metadata?.nestedRunId;
          await expect.poll(async () => (await storedRun(child.id, childRunId))?.status).toBe('suspended');
          await drainHandlers();

          await settleDeliveries([await held.release(0)]);
          expect(await within(restarted, 'the restart caller to settle')).toMatchObject({ status: 'suspended' });
          expect(await started).toMatchObject({ status: 'suspended' });
          await drainHandlers();
          expect(await storedRun(workflow.id, run.runId)).toMatchObject({
            status: 'suspended',
            context: { [child.id]: { status: 'suspended' } },
          });

          expect(
            await (
              await workflow.createRun({ runId: run.runId })
            ).resume({
              step: [child.id, 'gate'],
              resumeData: { ok: true },
            }),
          ).toMatchObject({ status: 'success', result: { n: 1 } });
          expect(gateCalls).toBe(2);
        } finally {
          held.restore();
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

    // The same restart with nothing to claim, but its worker stops after recording the restart and
    // before its step event goes out. Delivered again, the restart finds the sleep as its caller read
    // it and publishes again; the run finishes once. It used to treat itself as applied and publish
    // nothing, so nothing drove the run.
    it('recovers a restart with nothing to claim whose worker stopped before its publish', async () => {
      const steps = holdableSteps();
      const workflow = createWorkflow({ id: `restart-sleep-lost-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(steps.step('a'))
        .sleep(10)
        .then(steps.step('after'))
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        let restartDispatches = 0;
        const held = holdPublishes(
          driver,
          event =>
            // The old worker stops while it sleeps, and the restart's first dispatch is lost.
            (isStepRun(event, workflow.id, [2]) && !event.data.restart) ||
            (isStepRun(event, workflow.id, [1]) && !!event.data.restart && !restartDispatches++),
        );
        try {
          const run = await workflow.createRun();
          void run.start({ inputData: { n: 0 } });
          await held.count(1);

          const from = driver.events.length;
          const restarted = restartRun(workflow, run.runId);
          await held.count(2);
          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.restart)!;
          await settleDeliveries([trigger]);
          expect((await storedRun(workflow.id, run.runId))?.appliedTriggerEventId).toBe(trigger.id);

          await driver.redeliverEvent(trigger);
          expect(await within(restarted, 'the restarted run to finish')).toMatchObject({
            status: 'success',
            result: { n: 2 },
          });
          await drainHandlers();
          expect(steps.calls).toEqual({ a: 1, after: 1 });
        } finally {
          held.restore();
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

    // The old worker's step event delivered again, with its own ID, after the restart's copy of the
    // step finished. Storage v1 refuses it: it expects no occurrence of the step. Storage v2 reads
    // the restart's result as the occurrence it expects and runs the step again (COR-1666); the next
    // step, which the restart is running, refuses its continuation.
    it('handles the old step event delivered again after the restart ran the step', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;
        const oldDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1])[0]!;

        const restartC = wf.holdAt('c');
        const restarted = restartRun(wf.workflow, run.runId);
        await restartC.entered;
        const restartDelivery = stepRuns(driver, run.runId, wf.workflow.id, [1]).at(-1)!;

        const key = `workflow-step-run:${oldDelivery.runId}:${oldDelivery.id}`;
        const owner = await driver.pubsub.getLeaseOwner(key);
        if (owner) await driver.pubsub.releaseLease(key, owner);
        await driver.redeliverEvent(oldDelivery);
        // On storage v2 the step it ran again saves in its step end.
        await expect
          .poll(async () => (await storedRun(wf.workflow.id, run.runId))?.context.b)
          .toMatchObject({
            status: 'success',
            metadata: { startedBy: storageVersion === 1 ? restartDelivery.id : oldDelivery.id },
          });

        restartC.release();
        oldB.release();
        expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
        await drainHandlers();
        expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
        expect(wf.calls).toEqual({ a: 1, b: storageVersion === 1 ? 2 : 3, c: 1 });
      });
    }, 20_000);

    // #30275 on one worker, on both storage versions: the old worker saved the step's result after
    // the restart read the run and before its claim, then stopped before the next step. The claim
    // keeps the result, the restart leaves the run's header as it is, and it continues from the
    // saved result without running the step again.
    it('continues from a result saved between the restart read and its claim', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const held = holdPublishes(
          driver,
          event =>
            (event.type === 'workflow.step.end' &&
              event.data?.workflowId === wf.workflow.id &&
              JSON.stringify(event.data.executionPath) === '[1]' &&
              !event.data.restart) ||
            (isStepRun(event, wf.workflow.id, [2]) && !event.data.restart) ||
            (event.type === 'workflow.start' && !!event.data?.restart),
        );
        try {
          const run = await wf.workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await held.count(1);
          const restarted = restartRun(wf.workflow, run.runId, new RequestContext([['restartedBy', 'B']]));
          await held.count(2);
          // b's save lands; the old worker stops before c's event goes out.
          await held.release(0);
          await held.count(3);
          expect((await storedRun(wf.workflow.id, run.runId))?.context.b).toMatchObject({ status: 'success' });

          await held.release(1);
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
          expect(wf.calls).toEqual({ a: 1, b: 1, c: 1 });
          // The step after the kept result runs with the request context the restart was given.
          expect(wf.restartedBy.c).toBe('B');
        } finally {
          held.restore();
        }
      });
    }, 20_000);

    // #30901 on one worker, on both storage versions: branch b saved its result after the restart
    // read the run and before its claims, and the run went on into d. Every claim finds a saved
    // result, so the restart leaves the run's header as it is, and its deliveries for the branches
    // find the run past them.
    it('does not run a branch again when its result was saved before the claim and the run went on', async () => {
      const steps = holdableSteps();
      const workflow = createWorkflow({
        id: `restart-went-on-${randomUUID()}`,
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
        .then(steps.step('d'))
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        const held = holdPublishes(
          driver,
          event =>
            (event.type === 'workflow.step.end' &&
              event.data?.workflowId === workflow.id &&
              JSON.stringify(event.data.executionPath) === '[0,1]' &&
              !event.data.restart) ||
            (event.type === 'workflow.start' && !!event.data?.restart),
        );
        try {
          const run = await workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await held.count(1);
          await expect.poll(async () => (await storedRun(workflow.id, run.runId))?.context.a?.status).toBe('success');
          const restarted = restartRun(workflow, run.runId);
          await held.count(2);

          const d = steps.holdAt('d');
          await held.release(0);
          await d.entered;

          const from = driver.events.length;
          await settleDeliveries([await held.release(1)]);
          const branchRuns = () =>
            driver.events
              .slice(from)
              .filter(
                event => event.type === 'workflow.step.run' && event.data.restart?.isParallelOrConditionalRestarted,
              );
          await expect.poll(() => branchRuns().length).toBe(2);
          await settleDeliveries(branchRuns());
          expect(driver.events.slice(from).filter(event => event.type === 'workflow.step.end')).toEqual([]);
          expect(steps.calls).toEqual({ a: 1, b: 1, c: 1, d: 1 });

          d.release();
          expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 3 } });
          await drainHandlers();
          expect(steps.calls).toEqual({ a: 1, b: 1, c: 1, d: 1 });
        } finally {
          held.restore();
        }
      });
    }, 20_000);

    // A parallel block with one branch suspended and the other still running is restarted. The claim
    // leaves the suspended branch as stored, and the restart's delivery runs it again, so it
    // suspends again with the same payload. The running branch is taken over. The run then suspends
    // on the branch, and a resume finishes it.
    it('keeps a suspended branch suspended and takes the running one over when a parallel block is restarted', async () => {
      const steps = holdableSteps();
      const ask = createStep({
        id: 'ask',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ ok: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          steps.calls.ask = (steps.calls.ask ?? 0) + 1;
          if (!resumeData) return suspend({ reason: 'approval' });
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `restart-suspended-branch-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: z.any(),
      })
        .parallel([ask, steps.step('work')])
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
        const run = await workflow.createRun();
        const oldWork = steps.holdAt('work');
        const started = run.start({ inputData: { n: 0 } });
        await oldWork.entered;
        await expect.poll(async () => (await storedRun(workflow.id, run.runId))?.context.ask?.status).toBe('suspended');
        const oldDelivery = stepRuns(driver, run.runId, workflow.id, [0, 1])[0]!;

        const restarted = await restartRun(workflow, run.runId);
        expect(restarted).toMatchObject({ status: 'suspended' });
        const restartDelivery = stepRuns(driver, run.runId, workflow.id, [0, 1]).at(-1)!;
        oldWork.release();
        await settleDeliveries([oldDelivery]);
        await drainHandlers();
        expect(await storedRun(workflow.id, run.runId)).toMatchObject({
          status: 'suspended',
          suspendedPaths: { ask: [0, 0] },
          context: {
            ask: { status: 'suspended', suspendPayload: { reason: 'approval' } },
            work: { status: 'success', metadata: { startedBy: restartDelivery.id } },
          },
        });
        expect(steps.calls).toEqual({ ask: 2, work: 2 });

        expect(
          await (await workflow.createRun({ runId: run.runId })).resume({ step: 'ask', resumeData: { ok: true } }),
        ).toMatchObject({ status: 'success', result: { ask: { n: 1 }, work: { n: 1 } } });
        expect(await started).toMatchObject({ status: 'suspended' });
        expect(steps.calls).toEqual({ ask: 3, work: 2 });
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

    // R6. A restarted run still finishes once its steps are guarded, whatever entry it is in. As in
    // R1, the old worker's copy of the step returns while the restart's copy is still inside it, and
    // its save is refused: the step stays the restart's.
    describe('finishes a restarted run', () => {
      // Storage v2: a step end carries no step results, so the old copy's save is checked against the
      // occurrence stored when it lands, the restart's own while its copy still runs, and is accepted
      // (COR-1666). The restart's copy then continues from that result. A loop body is not affected:
      // it completes under the occurrence its delivery passes on.
      const savedOverRestart = storageVersion === 2;

      /** The step ends published for `workflowId`'s step at `path` since event index `from`. */
      const stepEndsSince = (driver: RedeliveryDriver, from: number, workflowId: string, path: number[]) =>
        driver.events
          .slice(from)
          .filter(
            event =>
              event.type === 'workflow.step.end' &&
              event.data.workflowId === workflowId &&
              JSON.stringify(event.data.executionPath) === JSON.stringify(path),
          );

      it('restarted inside a loop body', async () => {
        const steps = holdableSteps();
        const workflow = createWorkflow({ id: `restart-loop-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .dountil(steps.step('body'), async ({ inputData }) => inputData.n >= 3)
          .then(steps.step('after'))
          .commit();
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          const run = await workflow.createRun();
          const oldIteration = steps.holdAt('body', 2);
          const started = run.start({ inputData: { n: 0 } });
          await oldIteration.entered;
          const oldDelivery = stepRuns(driver, run.runId, workflow.id, [0]).at(-1)!;

          const restartIteration = steps.holdAt('body', 3);
          const restarted = restartRun(workflow, run.runId);
          await restartIteration.entered;
          const restartDelivery = stepRuns(driver, run.runId, workflow.id, [0]).at(-1)!;
          oldIteration.release();
          await settleDeliveries([oldDelivery]);
          expect((await storedRun(workflow.id, run.runId))?.context.body).toMatchObject({
            status: 'running',
            metadata: { startedBy: restartDelivery.id },
          });

          restartIteration.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 4 } });
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
        await withHost({ [child.id]: child, [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          const run = await workflow.createRun();
          const oldInner = steps.holdAt('inner');
          const started = run.start({ inputData: { n: 0 } });
          await oldInner.entered;

          const restartInner = steps.holdAt('inner');
          const from = driver.events.length;
          const restarted = restartRun(workflow, run.runId);
          await restartInner.entered;
          const restartDelivery = driver.stepRuns({ spec: `${child.id}@0` }).at(-1)!;
          oldInner.release();
          await expect.poll(() => stepEndsSince(driver, from, child.id, [0]).length).toBe(1);
          await settleDeliveries(stepEndsSince(driver, from, child.id, [0]));
          const childRunId = (await storedRun(workflow.id, run.runId))?.context[child.id]?.metadata?.nestedRunId;
          expect((await storedRun(child.id, childRunId))?.context.inner).toMatchObject({
            status: savedOverRestart ? 'success' : 'running',
            metadata: { startedBy: restartDelivery.id },
          });

          restartInner.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
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
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          const run = await workflow.createRun();
          const oldYes = steps.holdAt('yes');
          const started = run.start({ inputData: { n: 0 } });
          await oldYes.entered;

          const restartYes = steps.holdAt('yes');
          const from = driver.events.length;
          const restarted = restartRun(workflow, run.runId);
          await restartYes.entered;
          const restartDelivery = stepRuns(driver, run.runId, workflow.id, [0, 0]).at(-1)!;
          oldYes.release();
          await expect.poll(() => stepEndsSince(driver, from, workflow.id, [0, 0]).length).toBe(1);
          await settleDeliveries(stepEndsSince(driver, from, workflow.id, [0, 0]));
          expect((await storedRun(workflow.id, run.runId))?.context.yes).toMatchObject({
            status: savedOverRestart ? 'success' : 'running',
            metadata: { startedBy: restartDelivery.id },
          });

          restartYes.release();
          expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
          expect(steps.calls).toEqual({ yes: 2, after: 1 });
        });
      }, 20_000);

      // The old worker's sleep timer stays live and publishes the next step too. Here the restart's
      // timer fires first, and the old timer's copy of the next step arrives while the restart's runs
      // it: the guard refuses the old copy.
      it('restarted while it sleeps', async () => {
        const steps = holdableSteps();
        const workflow = createWorkflow({ id: `restart-sleep-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(steps.step('a'))
          .sleep(10)
          .then(steps.step('after'))
          .commit();
        await withHost({ [workflow.id]: workflow }, steps.releaseAll, async ({ driver }) => {
          const oldWake = holdPublishes(driver, event => isStepRun(event, workflow.id, [2]) && !event.data.restart);
          try {
            const run = await workflow.createRun();
            const started = run.start({ inputData: { n: 0 } });
            await oldWake.count(1);

            const after = steps.holdAt('after');
            const restarted = restartRun(workflow, run.runId);
            await after.entered;
            const restartDelivery = stepRuns(driver, run.runId, workflow.id, [2]).at(-1)!;
            await settleDeliveries([await oldWake.release(0)]);
            expect((await storedRun(workflow.id, run.runId))?.context.after).toMatchObject({
              status: 'running',
              metadata: { startedBy: restartDelivery.id },
            });

            after.release();
            expect(await restarted).toMatchObject({ status: 'success', result: { n: 2 } });
            await drainHandlers();
            expect(await started).toMatchObject({ status: 'success', result: { n: 2 } });
            expect(steps.calls).toEqual({ a: 1, after: 1 });
          } finally {
            oldWake.restore();
          }
        });
      }, 20_000);
    });

    // R7. A run that ended after the restart's caller read it was set back to running from what the
    // caller read, and its step ran again.
    it('does not reopen a run that ended between the restart read and the restart', async () => {
      let finishes = 0;
      const wf = chain({ onFinish: () => void finishes++ });
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        const run = await wf.workflow.createRun();
        const oldB = wf.holdAt('b');
        const started = run.start({ inputData: { n: 0 } });
        await oldB.entered;

        // The caller reads the run while b runs, and the run ends before the caller waits for its
        // finish. The caller then gets the run's stored result instead of waiting for a finish that
        // already went out.
        const { restarted, proceed } = await restartHeldAfterRead(wf.workflow, run.runId);
        oldB.release();
        expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
        await drainHandlers();
        const ended = await storedRun(wf.workflow.id, run.runId);

        const from = driver.events.length;
        proceed();
        expect(await within(restarted, 'the restart caller to settle')).toMatchObject({
          status: 'success',
          result: { n: 3 },
        });
        await drainHandlers();
        expect(driver.events.slice(from).filter(e => e.type === 'workflow.step.run')).toEqual([]);
        expect(await storedRun(wf.workflow.id, run.runId)).toMatchObject({
          status: 'success',
          activePaths: ended?.activePaths,
          context: { b: ended?.context.b, c: ended?.context.c },
        });
        expect(wf.calls).toEqual({ a: 1, b: 1, c: 1 });
        // The run's onFinish ran when it ended; the declined restart does not run it again.
        expect(finishes).toBe(1);
      });
    }, 20_000);

    // R7 for a run that failed in that window: the caller gets the failure as an Error, as the run's
    // own caller did, and the run's onFinish and onError are not called again.
    it('returns the failure of a run that failed between the restart read and the restart', async () => {
      const callbacks = { finish: 0, error: 0 };
      let fail = false;
      const steps = holdableSteps();
      const breaks = createStep({
        id: 'breaks',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => {
          if (fail) throw new Error('breaks broke');
          return inputData;
        },
      });
      const workflow = createWorkflow({
        id: `restart-failed-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        options: { onFinish: () => void callbacks.finish++, onError: () => void callbacks.error++ },
      })
        .then(steps.step('a'))
        .then(breaks)
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async () => {
        const run = await workflow.createRun();
        const oldA = steps.holdAt('a');
        const started = run.start({ inputData: { n: 0 } });
        await oldA.entered;
        const { restarted, proceed } = await restartHeldAfterRead(workflow, run.runId);
        fail = true;
        oldA.release();
        const failed = (await started) as { status: string; error?: Error };
        expect(failed).toMatchObject({ status: 'failed' });
        await drainHandlers();
        expect(callbacks).toEqual({ finish: 1, error: 1 });

        proceed();
        const result = (await within(restarted, 'the restart caller to settle')) as { status: string; error?: Error };
        expect(result.status).toBe('failed');
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toBe(failed.error?.message);
        await drainHandlers();
        expect(callbacks).toEqual({ finish: 1, error: 1 });
      });
    }, 20_000);

    // A run stored only for the guards stored a suspension, was resumed, and is restarted while a
    // later step runs; that step then suspends without storing its suspension. The suspend handler
    // removed the restarted run's row, which still held the earlier, stored progress.
    it('keeps the row of a restarted run that suspends without storing the suspension', async () => {
      let storeSuspension = true;
      const steps = holdableSteps();
      const gate = (id: string) =>
        createStep({
          id,
          inputSchema: Num,
          outputSchema: Num,
          resumeSchema: z.object({ ok: z.boolean() }),
          execute: async ({ inputData, resumeData, suspend }) =>
            resumeData ? { n: inputData.n + 1 } : suspend({ reason: id }),
        });
      const workflow = createWorkflow({
        id: `restart-keeps-row-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        options: {
          shouldPersistSnapshot: ({ workflowStatus }) =>
            workflowStatus === 'suspended' ? storeSuspension : workflowStatus !== 'running',
        },
      })
        .then(gate('first'))
        .then(steps.step('work'))
        .then(gate('second'))
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect((await storedRun(workflow.id, run.runId))?.guardedOnlySnapshot).toBe(true);

        const oldWork = steps.holdAt('work');
        const resumed = run.resume({ step: 'first', resumeData: { ok: true } });
        await oldWork.entered;
        storeSuspension = false;
        expect(await restartRun(workflow, run.runId)).toMatchObject({ status: 'suspended' });
        oldWork.release();
        expect(await resumed).toMatchObject({ status: 'suspended' });
        // The suspend handler goes on after the callers hear of the suspension.
        await drainHandlers();
        expect(await storedRun(workflow.id, run.runId)).toMatchObject({
          context: { first: { status: 'success' }, work: { status: 'success' } },
        });
      });
    }, 20_000);

    // R7 for a run that suspended in that window: it stays suspended, the caller gets the suspension,
    // and the run is resumed as usual.
    it('leaves a run that suspended between the restart read and the restart suspended', async () => {
      const steps = holdableSteps();
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ ok: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) return suspend({ reason: 'approval' });
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({ id: `restart-suspend-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(steps.step('a'))
        .then(gate)
        .commit();
      await withHost({ [workflow.id]: workflow }, steps.releaseAll, async () => {
        const run = await workflow.createRun();
        // The restart reads the run while it is still in a, which then goes on into the suspension.
        const oldA = steps.holdAt('a');
        const started = run.start({ inputData: { n: 0 } });
        await oldA.entered;
        const { restarted, proceed } = await restartHeldAfterRead(workflow, run.runId);
        oldA.release();
        const suspended = await started;
        expect(suspended).toMatchObject({ status: 'suspended' });
        await drainHandlers();

        proceed();
        // The same suspension the run's own caller got.
        expect(await within(restarted, 'the restart caller to settle')).toMatchObject({
          status: 'suspended',
          suspended: (suspended as { suspended?: unknown }).suspended,
        });
        await drainHandlers();
        expect(await storedRun(workflow.id, run.runId)).toMatchObject({
          status: 'suspended',
          context: { gate: { status: 'suspended', suspendPayload: { reason: 'approval' } } },
        });
        expect(
          await (await workflow.createRun({ runId: run.runId })).resume({ step: 'gate', resumeData: { ok: true } }),
        ).toMatchObject({ status: 'success', result: { n: 2 } });
        expect(steps.calls).toEqual({ a: 1 });
      });
    }, 20_000);

    // A restart past an entry that had finished writes the run whole. When the run ended before that
    // restart applied, it reopened the run and ran the next step again.
    it('does not reopen a run that ended before a restart past a finished step applied', async () => {
      const wf = chain();
      await withHost({ [wf.workflow.id]: wf.workflow }, wf.releaseAll, async ({ driver }) => {
        // a saved its result; its next step's event is held, so the run reads as stopped after a.
        const held = holdPublishes(driver, event => isStepRun(event, wf.workflow.id, [1]) && !event.data.restart);
        try {
          const run = await wf.workflow.createRun();
          const started = run.start({ inputData: { n: 0 } });
          await held.count(1);
          const { restarted, proceed } = await restartHeldAfterRead(wf.workflow, run.runId);

          // The run goes on and ends before the restart applies.
          await held.release(0);
          expect(await started).toMatchObject({ status: 'success', result: { n: 3 } });
          await drainHandlers();

          const from = driver.events.length;
          proceed();
          const restartEvents = () =>
            driver.events.slice(from).filter(event => event.type === 'workflow.start' && event.data.restart);
          await expect.poll(() => restartEvents().length).toBe(1);
          expect(restartEvents()[0]!.data.restart.isPreFirstStepRestart).toBe(false);
          await settleDeliveries(restartEvents());
          expect((await storedRun(wf.workflow.id, run.runId))?.status).toBe('success');
          expect(driver.events.slice(from).filter(e => e.type === 'workflow.step.run')).toEqual([]);
          expect(await within(restarted, 'the restart caller to settle')).toMatchObject({
            status: 'success',
            result: { n: 3 },
          });
          await drainHandlers();
          expect(wf.calls).toEqual({ a: 1, b: 1, c: 1 });
        } finally {
          held.restore();
        }
      });
    }, 20_000);
  });
}
