/**
 * Shared cases for evented runs that a resume or a time travel re-enters (COR-1620). Run them on
 * each store with workflow step guards (Postgres, libSQL), once per storage version.
 *
 * The step guards keep arbitrating every step of such a run: a step delivered twice saves one
 * result and the steps after it run once, a repeated resume or time travel event keeps the run's
 * progress, and a resumed or time-travelled run still finishes through retries, loops, nested
 * workflows and the other entry types.
 */
import { randomUUID } from 'node:crypto';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent/agent';
import { DurableStepIds } from '../../../agent/durable/constants';
import { createEventedAgent } from '../../../agent/durable/create-evented-agent';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowOptions } from '../..';
import { createStep, createWorkflow as createEventedWorkflow } from '..';
import { drainHandlers, redeliverAndDrain, settleDeliveries } from './redelivery-contract';
import { RedeliveryDriver } from './redelivery-driver';

const Num = z.object({ n: z.number() });
const Approval = z.object({ ok: z.boolean() });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

type Host = { driver: RedeliveryDriver; warn: MockInstance };

export function describeResumeOccurrenceCases({
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
  describe('evented resume and time travel occurrences (COR-1620)', () => {
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
    let live: { mastra: Mastra; driver: RedeliveryDriver } | undefined;
    afterEach(async () => {
      const host = live;
      live = undefined;
      if (!host) return;
      try {
        await host.mastra.stopWorkers();
      } finally {
        host.driver.dispose();
      }
    });

    async function withHost(
      workflows: Record<string, any>,
      body: (host: Host) => Promise<void>,
      agents?: Record<string, any>,
    ) {
      const driver = new RedeliveryDriver();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows, agents });
      live = { mastra, driver };
      const warn = vi.spyOn(mastra.getLogger(), 'warn');
      try {
        await mastra.startWorkers();
        await body({ driver, warn });
      } finally {
        warn.mockRestore();
        live = undefined;
        try {
          await mastra.stopWorkers();
        } finally {
          driver.dispose();
        }
      }
    }

    /** The step ends published for a step since event index `from`. */
    const stepEndsSince = (driver: RedeliveryDriver, from: number, runId: string, workflowId: string, path: number[]) =>
      driver.events
        .slice(from)
        .filter(
          event =>
            event.type === 'workflow.step.end' &&
            event.runId === runId &&
            event.data.workflowId === workflowId &&
            JSON.stringify(event.data.executionPath) === JSON.stringify(path),
        );

    /**
     * Waits until both copies of a step delivered twice since event index `from` have ended and
     * the second one's completion was handled: refused, or continued from the saved result.
     */
    async function settleSecondCompletion(
      driver: RedeliveryDriver,
      from: number,
      runId: string,
      workflowId: string,
      path: number[],
    ) {
      const ends = () => stepEndsSince(driver, from, runId, workflowId, path);
      await expect.poll(() => ends().length, { timeout: 10_000 }).toBe(2);
      await settleDeliveries([ends()[1]!]);
    }

    async function storedSteps(workflowId: string, runId: string) {
      const store = (await storage.getStore('workflows'))!;
      return (await store.loadWorkflowSnapshot({ workflowName: workflowId, runId }))?.context as
        | Record<string, any>
        | undefined;
    }

    /** The step events a phase published for a step, newest last. */
    const stepRunsSince = (driver: RedeliveryDriver, from: number, runId: string, path: string) =>
      driver.stepRuns({ spec: path, runId }).filter(event => driver.events.indexOf(event) >= from);

    /**
     * gate -> after -> next. `gate` suspends until it is resumed (or time travelled into with
     * resume data). Each step can be held inside its body on its first execution after `arm()`.
     */
    function linearWorkflow({
      onExecute,
      options,
    }: {
      onExecute?: (id: 'gate' | 'after' | 'next', call: number, runId: string) => Promise<void>;
      options?: WorkflowOptions<any>;
    } = {}) {
      const calls = { gate: 0, after: 0, next: 0 };
      const held = { gate: deferred(), after: deferred(), next: deferred() };
      const entered = { gate: deferred(), after: deferred(), next: deferred() };
      const armed = { gate: false, after: false, next: false };
      const hold = async (id: keyof typeof calls, runId: string) => {
        calls[id]++;
        await onExecute?.(id, calls[id], runId);
        if (!armed[id]) return;
        armed[id] = false;
        entered[id].resolve();
        await held[id].promise;
      };
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend, runId }) => {
          if (!resumeData) return suspend({ reason: 'approval' });
          await hold('gate', runId);
          return inputData;
        },
      });
      const after = createStep({
        id: 'after',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData, runId }) => {
          await hold('after', runId);
          return { n: inputData.n + 1 };
        },
      });
      const next = createStep({
        id: 'next',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData, runId }) => {
          await hold('next', runId);
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `resume-linear-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        ...(options ? { options } : {}),
      })
        .then(gate)
        .then(after)
        .then(next)
        .commit();
      const arm = (...ids: (keyof typeof calls)[]) => ids.forEach(id => (armed[id] = true));
      const releaseAll = () => Object.values(held).forEach(d => d.resolve());
      return { workflow, calls, held, entered, arm, releaseAll };
    }

    /** first -> after -> next, each holdable like `linearWorkflow`. Used for time travel into a finished step. */
    function plainWorkflow() {
      const calls = { first: 0, after: 0, next: 0 };
      const held = { first: deferred(), after: deferred(), next: deferred() };
      const entered = { first: deferred(), after: deferred(), next: deferred() };
      const armed = { first: false, after: false, next: false };
      const step = (id: keyof typeof calls) =>
        createStep({
          id,
          inputSchema: Num,
          outputSchema: Num,
          execute: async ({ inputData }) => {
            calls[id]++;
            if (armed[id]) {
              armed[id] = false;
              entered[id].resolve();
              await held[id].promise;
            }
            return { n: inputData.n + 1 };
          },
        });
      const workflow = createWorkflow({ id: `travel-plain-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(step('first'))
        .then(step('after'))
        .then(step('next'))
        .commit();
      const arm = (...ids: (keyof typeof calls)[]) => ids.forEach(id => (armed[id] = true));
      const releaseAll = () => Object.values(held).forEach(d => d.resolve());
      return { workflow, calls, held, entered, arm, releaseAll };
    }

    // T1. A duplicate of a step after a resume runs its body again (one save wins under the guard).
    // Without the guards both copies continued the run, so the step after it ran twice.
    it('runs the step after a resumed step once when that step is delivered twice', async () => {
      const wf = linearWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver, warn }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
          wf.arm('after', 'next');
          const from = driver.events.length;
          const result = run.resume({ step: 'gate', resumeData: { ok: true } });
          await wf.entered.after.promise;
          const afterRun = stepRunsSince(driver, from, run.runId, '1')[0]!;
          await driver.redeliverEvent(afterRun);
          await wf.entered.next.promise;
          wf.held.after.resolve();
          await settleSecondCompletion(driver, from, run.runId, wf.workflow.id, [1]);
          wf.held.next.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ gate: 1, after: 2, next: 1 });
          // The slower copy's completion is refused by the guard and logged.
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('stale'),
            expect.objectContaining({ runId: run.runId, executionPath: [1], storedStartedBy: afterRun.id }),
          );
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    // T2. The resumed step's own event delivered twice while it runs: without the guards both
    // copies continued the run, so the step after it ran twice.
    it('runs the step after a resume once when the resumed step is delivered twice', async () => {
      // What the duplicate's claim left stored, read inside its body.
      let claimedByDuplicate: unknown;
      const wf = linearWorkflow({
        onExecute: async (id, call, runId) => {
          if (id === 'gate' && call === 2) claimedByDuplicate = (await storedSteps(wf.workflow.id, runId))?.gate;
        },
      });
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
          wf.arm('gate', 'after');
          const from = driver.events.length;
          const result = run.resume({ step: 'gate', resumeData: { ok: true } });
          await wf.entered.gate.promise;
          const gateRun = stepRunsSince(driver, from, run.runId, '0')[0]!;
          await driver.redeliverEvent(gateRun);
          await wf.entered.after.promise;
          // The duplicate claimed the running step again; the resume artifacts stay with it.
          expect(claimedByDuplicate).toMatchObject({
            status: 'running',
            suspendPayload: { reason: 'approval' },
            resumePayload: { ok: true },
          });
          wf.held.gate.resolve();
          await settleSecondCompletion(driver, from, run.runId, wf.workflow.id, [0]);
          wf.held.after.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ gate: 2, after: 1, next: 1 });
          expect((await storedSteps(wf.workflow.id, run.runId))?.gate).toMatchObject({
            status: 'success',
            metadata: { startedBy: gateRun.id },
          });
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    // T3. A resume event delivered again rewrote the run's snapshot from its own data: on storage
    // v1 that set the resumed step back to suspended and dropped the steps after it, and on both
    // versions the resumed step and the steps after it ran again. A workflow that declines running
    // snapshots stores nothing on resume on storage v1, so the run does not record the event it
    // applied there: the resumed step's guard refuses the repeated step event before the step runs,
    // and logs it. Storage v2 always stores the run, so there the start handler ignores the event.
    it.each([
      { name: 'stores running snapshots', declinesRunning: false },
      { name: 'declines running snapshots', declinesRunning: true },
    ])(
      'keeps the progress of a resumed run when the resume event is delivered again ($name)',
      async ({ declinesRunning }) => {
        const wf = linearWorkflow(
          declinesRunning
            ? { options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' } }
            : {},
        );
        await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver, warn }) => {
          try {
            const run = await wf.workflow.createRun();
            expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
            wf.arm('next');
            const result = run.resume({ step: 'gate', resumeData: { ok: true } });
            await wf.entered.next.promise;
            const before = await storedSteps(wf.workflow.id, run.runId);
            expect(before).toMatchObject({ gate: { status: 'success' }, after: { status: 'success' } });
            const trigger = driver.events.find(
              event =>
                event.type === 'workflow.resume' &&
                event.runId === run.runId &&
                event.data.workflowId === wf.workflow.id,
            )!;
            await driver.redeliverEvent(trigger);
            const after = await storedSteps(wf.workflow.id, run.runId);
            expect(after?.gate).toEqual(before?.gate);
            expect(after?.after).toEqual(before?.after);
            wf.held.next.resolve();
            expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
            await drainHandlers();
            expect(wf.calls).toEqual({ gate: 1, after: 1, next: 1 });
            if (declinesRunning && storageVersion === 1) {
              expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('stale'),
                expect.objectContaining({ runId: run.runId, executionPath: [0] }),
              );
            }
          } finally {
            wf.releaseAll();
          }
        });
      },
      20_000,
    );

    // A resume event delivered again before its first step event was handled finds the resumed step
    // as it left it, so it publishes that step event again, and the step's guard lets one of the
    // two run it.
    it('runs a resumed step once when the resume event is delivered again before the step starts', async () => {
      const wf = linearWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        const publish = driver.pubsub.publish.bind(driver.pubsub);
        const firstStepEvent = deferred();
        let releaseFirst: (() => Promise<void>) | undefined;
        let runId = '';
        const interceptor = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
          if (
            !releaseFirst &&
            event.type === 'workflow.step.run' &&
            event.runId === runId &&
            event.data.resumeSteps?.length &&
            event.data.executionPath?.[0] === 0
          ) {
            releaseFirst = () => publish(topic, event, options);
            firstStepEvent.resolve();
            return;
          }
          return publish(topic, event, options);
        });
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
          runId = run.runId;
          const from = driver.events.length;
          const result = run.resume({ step: 'gate', resumeData: { ok: true } });
          await firstStepEvent.promise;
          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.resume' && event.runId === run.runId)!;
          await driver.redeliverEvent(trigger);
          // The repeated resume published the step event again.
          expect(stepRunsSince(driver, from, run.runId, '0')).toHaveLength(1);
          await releaseFirst!();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(stepRunsSince(driver, from, run.runId, '0')).toHaveLength(2);
          expect(wf.calls).toEqual({ gate: 1, after: 1, next: 1 });
        } finally {
          interceptor.mockRestore();
          await releaseFirst?.();
        }
      });
    }, 20_000);

    // A step after a resume delivered again after it finished, while the run is still in the next
    // step. The workflow declines running snapshots, so the finished-step check cannot tell and
    // only the guard decides. With the event's own ID the guard refuses it on both storage
    // versions. Under a new ID, storage v1 refuses it too, because the event expected no occurrence
    // of the step; storage v2 reads the expected occurrence from the stored step, so it runs the
    // step again (COR-1666). The next step still runs once there: its guard refuses the second start.
    it.each(['same-id', 'publish'] as const)(
      'refuses a late duplicate of a step after a resume (%s)',
      async mode => {
        const wf = linearWorkflow({
          options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
        });
        await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
          try {
            const run = await wf.workflow.createRun();
            expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
            wf.arm('next');
            const result = run.resume({ step: 'gate', resumeData: { ok: true } });
            await wf.entered.next.promise;
            await redeliverAndDrain(driver, { spec: `${wf.workflow.id}@1`, runId: run.runId }, mode);
            wf.held.next.resolve();
            expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
            await drainHandlers();
            const rerunsOnV2 = mode === 'publish' && storageVersion === 2;
            expect(wf.calls).toEqual({ gate: 1, after: rerunsOnV2 ? 2 : 1, next: 1 });
          } finally {
            wf.releaseAll();
          }
        });
      },
      20_000,
    );

    // T4 (T1 after a time travel). Time travel carries its flag on every later step, so without the
    // guards nothing told the two copies of a duplicated step apart and the step after it ran twice.
    it('runs the step after a time-travelled step once when that step is delivered twice', async () => {
      const wf = plainWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 3 } });
          wf.arm('after', 'next');
          const from = driver.events.length;
          const result = run.timeTravel({ step: 'first', inputData: { n: 10 } });
          await wf.entered.after.promise;
          const afterRun = stepRunsSince(driver, from, run.runId, '1')[0]!;
          await driver.redeliverEvent(afterRun);
          await wf.entered.next.promise;
          wf.held.after.resolve();
          await settleSecondCompletion(driver, from, run.runId, wf.workflow.id, [1]);
          wf.held.next.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 13 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ first: 2, after: 3, next: 2 });
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    // T4 (T2 after a time travel into a suspended step).
    it('runs the step after a time travel into a suspended step once when that step is delivered twice', async () => {
      const wf = linearWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
          wf.arm('gate', 'after');
          const from = driver.events.length;
          const result = run.timeTravel({ step: 'gate', resumeData: { ok: true } });
          await wf.entered.gate.promise;
          const gateRun = stepRunsSince(driver, from, run.runId, '0')[0]!;
          await driver.redeliverEvent(gateRun);
          await wf.entered.after.promise;
          wf.held.gate.resolve();
          await settleSecondCompletion(driver, from, run.runId, wf.workflow.id, [0]);
          wf.held.after.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ gate: 2, after: 1, next: 1 });
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    // T4 (T3 after a time travel). The repeated time travel event reset the run's step results and
    // ran the time-travelled steps again.
    it('keeps the progress of a time-travelled run when the time travel event is delivered again', async () => {
      const wf = plainWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success' });
          wf.arm('next');
          const from = driver.events.length;
          const result = run.timeTravel({ step: 'first', inputData: { n: 10 } });
          await wf.entered.next.promise;
          const before = await storedSteps(wf.workflow.id, run.runId);
          expect(before).toMatchObject({ first: { status: 'success' }, after: { status: 'success' } });
          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.start' && event.runId === run.runId && event.data.timeTravel)!;
          await driver.redeliverEvent(trigger);
          const after = await storedSteps(wf.workflow.id, run.runId);
          expect(after?.first).toEqual(before?.first);
          expect(after?.after).toEqual(before?.after);
          wf.held.next.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 13 } });
          await drainHandlers();
          expect(wf.calls).toEqual({ first: 2, after: 2, next: 2 });
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    /**
     * gate suspends; once resumed its first attempt fails and the retry succeeds. `suspendData`
     * records what each resumed attempt received of the data it suspended with.
     */
    function retryingGateWorkflow() {
      const attempts: string[] = [];
      const suspendData: unknown[] = [];
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        suspendSchema: z.object({ question: z.string() }),
        execute: async ({ inputData, resumeData, suspend, suspendData: received }) => {
          if (!resumeData) return suspend({ question: 'approve?' });
          suspendData.push(received);
          attempts.push(attempts.length === 0 ? 'failed' : 'succeeded');
          if (attempts.length === 1) throw new Error('Transient failure');
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `resume-retry-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        retryConfig: { attempts: 1, delay: 0 },
      })
        .then(gate)
        .commit();
      return { workflow, attempts, suspendData };
    }

    // Storage v1 hands every attempt the suspended record, so each one sees its suspend data. On
    // storage v2 the retry loads the step from the stored run, where it is the failed attempt, so
    // the retry sees none; that was already so on main.
    const suspendDataPerAttempt =
      storageVersion === 1
        ? [{ question: 'approve?' }, { question: 'approve?' }]
        : [{ question: 'approve?' }, undefined];

    // T5. Guards a hang: a retry of a resumed step must claim the step again, or its completion is
    // refused and the run stays running. The retry also keeps the step's suspend data.
    it('finishes a resumed step that fails once and is retried', async () => {
      const { workflow, attempts, suspendData } = retryingGateWorkflow();
      await withHost({ [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 1 },
        });
        expect(attempts).toEqual(['failed', 'succeeded']);
        expect(suspendData).toEqual(suspendDataPerAttempt);
      });
    }, 20_000);

    // T6. The same for a time travel into a suspended step.
    it('finishes a time travel into a suspended step that fails once and is retried', async () => {
      const { workflow, attempts, suspendData } = retryingGateWorkflow();
      await withHost({ [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.timeTravel({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 1 },
        });
        expect(attempts).toEqual(['failed', 'succeeded']);
        expect(suspendData).toEqual(suspendDataPerAttempt);
      });
    }, 20_000);

    // T7. The nested body of a time-travelled loop must complete under the occurrence that started
    // it, or the next iteration's start is refused and the run hangs. Time travel to the loop starts
    // a fresh child; that form hangs on main on storage v2 and passes on main on v1. Time travel to
    // the step inside the body time-travels the child too; that form passes on main on both, and
    // hangs once time travel is guarded without the nested loop hand-back passing its occurrence.
    it.each(['loop', 'nested step'] as const)(
      'runs further iterations of a loop over a nested workflow after a time travel to the %s',
      async target => {
        const seen: number[] = [];
        const inc = createStep({
          id: 'inc',
          inputSchema: Num,
          outputSchema: Num,
          execute: async ({ inputData }) => {
            seen.push(inputData.n);
            return { n: inputData.n + 1 };
          },
        });
        const body = createWorkflow({ id: `travel-loop-body-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(inc)
          .commit();
        const outer = createWorkflow({ id: `travel-loop-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .dountil(body, async ({ inputData }) => inputData.n >= 2)
          .commit();
        await withHost({ [body.id]: body, [outer.id]: outer }, async () => {
          const run = await outer.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 2 } });
          const step = target === 'loop' ? body.id : [body.id, 'inc'];
          expect(await run.timeTravel({ step, inputData: { n: 0 } })).toMatchObject({
            status: 'success',
            result: { n: 2 },
          });
          expect(seen).toEqual([0, 1, 0, 1]);
        });
      },
      20_000,
    );

    // T8. A nested run started after a parent resume inherits the resume. On main its steps were not
    // guarded, so it needed no stored run. Once they are, a child that declines snapshots needs one,
    // or its first guarded step fails the run as `missing`. Storage v2 always stores a running run,
    // so there the case passes whatever the guards do.
    it('finishes a nested workflow that declines snapshots and starts after a parent resume', async () => {
      const inner = createStep({
        id: 'inner',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
      });
      const child = createWorkflow({
        id: `declining-child-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        options: { shouldPersistSnapshot: () => false },
      })
        .then(inner)
        .commit();
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend({})),
      });
      const parent = createWorkflow({ id: `declining-parent-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(gate)
        .then(child)
        .commit();
      await withHost({ [child.id]: child, [parent.id]: parent }, async () => {
        const run = await parent.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 1 },
        });
        // The run stored for the child's guards goes once the child ends, as the child declined it.
        const childRunId = (await storedSteps(parent.id, run.runId))?.[child.id]?.metadata?.nestedRunId;
        expect(childRunId).toEqual(expect.any(String));
        const store = (await storage.getStore('workflows'))!;
        await expect.poll(() => store.loadWorkflowSnapshot({ workflowName: child.id, runId: childRunId })).toBeNull();
      });
    }, 20_000);

    // The same nested run, suspending instead of finishing. It only inherited its parent's resume,
    // so its run, stored only for the guards, goes when it suspends without storing the suspension.
    it('removes the stored run of a declining nested workflow that suspends after a parent resume', async () => {
      const pause = createStep({
        id: 'pause',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ suspend }) => suspend({}),
      });
      const child = createWorkflow({
        id: `declining-paused-child-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
        options: { shouldPersistSnapshot: () => false },
      })
        .then(pause)
        .commit();
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend({})),
      });
      const parent = createWorkflow({
        id: `declining-paused-parent-${randomUUID()}`,
        inputSchema: Num,
        outputSchema: Num,
      })
        .then(gate)
        .then(child)
        .commit();
      await withHost({ [child.id]: child, [parent.id]: parent }, async () => {
        const run = await parent.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'gate', resumeData: { ok: true } })).toMatchObject({ status: 'suspended' });
        await drainHandlers();
        const childRunId = (await storedSteps(parent.id, run.runId))?.[child.id]?.metadata?.nestedRunId;
        expect(childRunId).toEqual(expect.any(String));
        const store = (await storage.getStore('workflows'))!;
        expect(await store.loadWorkflowSnapshot({ workflowName: child.id, runId: childRunId })).toBeNull();
      });
    }, 20_000);

    // T9. A resumed run still finishes through the other entry types once its steps are guarded.
    it('finishes a resumed run through a loop, a nested workflow, a parallel, a branch and a sleep', async () => {
      const add = (id: string) =>
        createStep({
          id,
          inputSchema: Num,
          outputSchema: Num,
          execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
        });
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend({})),
      });
      const child = createWorkflow({ id: `mixed-child-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(add('child-add'))
        .commit();
      const workflow = createWorkflow({ id: `mixed-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(gate)
        .dountil(add('loop-add'), async ({ inputData }) => inputData.n >= 2)
        .then(child)
        .parallel([add('left'), add('right')])
        .map(async ({ inputData }) => ({ n: inputData.left!.n + inputData.right!.n }))
        .branch([
          [async ({ inputData }) => inputData.n > 100, add('big')],
          [async ({ inputData }) => inputData.n <= 100, add('small')],
        ])
        .map(async ({ inputData }) => ({ n: (inputData.big ?? inputData.small)!.n }))
        .sleep(10)
        .then(add('last'))
        .commit();
      await withHost({ [child.id]: child, [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        // loop 0 -> 2, child 3, parallel 4 + 4, branch 9, last 10
        expect(await run.resume({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 10 },
        });
      });
    }, 20_000);

    // A resume event delivered again after the step it resumed suspended again, but before the run
    // stored the new suspension, must not run the step again with the old resume data. On storage
    // v2 the event carries no step results, so the occurrence it expected has to be kept with the
    // run when it is first applied.
    it('does not resume a step again with the old data when its resume event is delivered after it suspended again', async () => {
      const rounds: number[] = [];
      const ask = createStep({
        id: 'ask',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ round: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (resumeData) rounds.push(resumeData.round);
          if ((resumeData?.round ?? 0) < 2) return suspend({});
          return inputData;
        },
      });
      const workflow = createWorkflow({ id: `resuspend-replay-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(ask)
        .commit();
      await withHost({ [workflow.id]: workflow }, async ({ driver }) => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        // Hold the run's header at `running` while the resumed step suspends again.
        const store = (await storage.getStore('workflows'))!;
        const method = storageVersion === 1 ? 'updateWorkflowState' : 'updateWorkflowRunHeader';
        const update = (store[method] as (args: any) => Promise<any>).bind(store);
        const reached = deferred();
        const release = deferred();
        const held = vi.spyOn(store, method).mockImplementation(async (args: any) => {
          if (args.workflowName === workflow.id && args.opts?.status === 'suspended') {
            reached.resolve();
            await release.promise;
          }
          return update(args);
        });
        try {
          const from = driver.events.length;
          const resumed = run.resume({ step: 'ask', resumeData: { round: 1 } });
          await reached.promise;
          expect((await storedSteps(workflow.id, run.runId))?.ask).toMatchObject({ status: 'suspended' });
          const trigger = driver.events
            .slice(from)
            .find(event => event.type === 'workflow.resume' && event.runId === run.runId)!;
          await driver.redeliverEvent(trigger);
          await settleDeliveries(stepRunsSince(driver, from, run.runId, '0'));
          release.resolve();
          expect(await resumed).toMatchObject({ status: 'suspended' });
        } finally {
          release.resolve();
          held.mockRestore();
        }
        await drainHandlers();
        expect(rounds).toEqual([1]);
      });
    }, 20_000);

    // A run that declines running snapshots is stored for the guards only while it runs, and that
    // row is removed when it suspends without storing the suspension. A suspension it does store
    // must survive, including when the caller resumes the run as soon as it hears of the
    // suspension, before the suspend handler finished.
    it.each(['as delivered', 'the caller resumes before the suspend handler finishes'] as const)(
      'resumes a run that declines running snapshots each time it suspends again (%s)',
      async order => {
        const forced = order !== 'as delivered';
        const rounds: number[] = [];
        // In the forced order the first resumed attempt waits inside the step, with the run running,
        // until the first suspension's handler finished.
        const resumedEntered = deferred();
        const suspendHandled = deferred();
        const ask = createStep({
          id: 'ask',
          inputSchema: Num,
          outputSchema: Num,
          resumeSchema: z.object({ round: z.number() }),
          execute: async ({ inputData, resumeData, suspend }) => {
            if (resumeData) rounds.push(resumeData.round);
            if (forced && resumeData?.round === 1) {
              resumedEntered.resolve();
              await suspendHandled.promise;
            }
            if ((resumeData?.round ?? 0) < 2) return suspend({});
            return { n: inputData.n + 1 };
          },
        });
        const workflow = createWorkflow({
          id: `declining-resuspend-${randomUUID()}`,
          inputSchema: Num,
          outputSchema: Num,
          options: { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
        })
          .then(ask)
          .commit();
        await withHost({ [workflow.id]: workflow }, async ({ driver }) => {
          // The first suspension's finish notice reaches the caller, and its handler goes on only
          // once the caller's resume is inside the step.
          const publish = driver.pubsub.publish.bind(driver.pubsub);
          let holdFinish = forced;
          const interceptor = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
            await publish(topic, event, options);
            if (holdFinish && topic === 'workflows-finish' && event.type === 'workflow.suspend') {
              holdFinish = false;
              await resumedEntered.promise;
            }
          });
          try {
            const run = await workflow.createRun();
            expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
            const firstResume = run.resume({ step: 'ask', resumeData: { round: 1 } });
            if (forced) {
              await resumedEntered.promise;
              const suspension = driver.events.find(
                event => event.type === 'workflow.suspend' && event.runId === run.runId,
              )!;
              await settleDeliveries([suspension]);
              suspendHandled.resolve();
            }
            expect(await firstResume).toMatchObject({ status: 'suspended' });
            expect(await run.resume({ step: 'ask', resumeData: { round: 2 } })).toMatchObject({
              status: 'success',
              result: { n: 1 },
            });
            expect(rounds).toEqual([1, 2]);
          } finally {
            suspendHandled.resolve();
            resumedEntered.resolve();
            interceptor.mockRestore();
          }
        });
      },
      20_000,
    );

    it('resumes a resumed step again after it suspends again', async () => {
      const rounds: number[] = [];
      const ask = createStep({
        id: 'ask',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: z.object({ round: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (resumeData) rounds.push(resumeData.round);
          if ((resumeData?.round ?? 0) < 2) return suspend({});
          return { n: inputData.n + resumeData!.round };
        },
      });
      const workflow = createWorkflow({ id: `resuspend-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(ask)
        .then(
          createStep({
            id: 'done',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
          }),
        )
        .commit();
      await withHost({ [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'ask', resumeData: { round: 1 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'ask', resumeData: { round: 2 } })).toMatchObject({
          status: 'success',
          result: { n: 3 },
        });
        expect(rounds).toEqual([1, 2]);
      });
    }, 20_000);

    it('resumes a step inside a nested workflow by its path', async () => {
      const innerAsk = createStep({
        id: 'inner-ask',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => (resumeData ? { n: inputData.n + 1 } : suspend({})),
      });
      const child = createWorkflow({ id: `path-child-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(innerAsk)
        .then(
          createStep({
            id: 'inner-after',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
          }),
        )
        .commit();
      const parent = createWorkflow({ id: `path-parent-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
        .then(child)
        .then(
          createStep({
            id: 'outer-after',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
          }),
        )
        .commit();
      await withHost({ [child.id]: child, [parent.id]: parent }, async () => {
        const run = await parent.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: [child.id, 'inner-ask'], resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 3 },
        });
      });
    }, 20_000);

    // Resuming the child run directly leaves the parent's nested step as the suspension stored it.
    // The child's hand-back then completes that step under its stored occurrence, so the record
    // must read as running again or the guard keeps the suspension and the parent never continues.
    // A child that declines running snapshots writes no run of its own on resume; on storage v2 it
    // always does. When the worker stops after the child's own write and before the parent's, the
    // redelivered resume finds itself applied and must still move the parent's step.
    it.each([
      { name: 'stores running snapshots', declinesRunning: false, stopsBeforeParentWrite: false },
      { name: 'declines running snapshots', declinesRunning: true, stopsBeforeParentWrite: false },
      {
        name: 'stores running snapshots and its worker stops before the write to the parent',
        declinesRunning: false,
        stopsBeforeParentWrite: true,
      },
    ])(
      'continues the parent after its nested child is resumed directly when the child $name',
      async ({ declinesRunning, stopsBeforeParentWrite }) => {
        const innerAsk = createStep({
          id: 'inner-ask',
          inputSchema: Num,
          outputSchema: Num,
          resumeSchema: Approval,
          execute: async ({ inputData, resumeData, suspend }) => (resumeData ? { n: inputData.n + 1 } : suspend({})),
        });
        const child = createWorkflow({
          id: `direct-child-${randomUUID()}`,
          inputSchema: Num,
          outputSchema: Num,
          options: declinesRunning
            ? { shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' }
            : {},
        })
          .then(innerAsk)
          .commit();
        const parent = createWorkflow({ id: `direct-parent-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
          .then(child)
          .then(
            createStep({
              id: 'outer-after',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
            }),
          )
          .commit();
        await withHost({ [child.id]: child, [parent.id]: parent }, async () => {
          const run = await parent.createRun();
          const suspended = await run.start({ inputData: { n: 0 } });
          expect(suspended).toMatchObject({ status: 'suspended' });
          const childRunId = (await storedSteps(parent.id, run.runId))?.[child.id]?.suspendPayload?.__workflow_meta
            ?.runId as string;
          expect(childRunId).toEqual(expect.any(String));
          // The child's first write to the parent's step fails once, as if its worker stopped there.
          let stopWorker = stopsBeforeParentWrite;
          const store = (await storage.getStore('workflows'))!;
          const method = storageVersion === 1 ? 'updateWorkflowResults' : 'appendWorkflowRunEntries';
          const write = (store[method] as (args: any) => Promise<any>).bind(store);
          const stopped = vi.spyOn(store, method).mockImplementation(async (args: any) => {
            if (stopWorker && args.workflowName === parent.id && (args.stepId === child.id || args.steps?.[child.id])) {
              stopWorker = false;
              throw new Error('Worker stopped before writing the parent step');
            }
            return write(args);
          });
          try {
            const childRun = await child.createRun({ runId: childRunId });
            expect(await childRun.resume({ step: 'inner-ask', resumeData: { ok: true } })).toMatchObject({
              status: 'success',
            });
          } finally {
            stopped.mockRestore();
          }
          expect(stopWorker).toBe(false);
          await expect
            .poll(async () => (await parent.getWorkflowRunById(run.runId))?.status, { timeout: 10_000 })
            .toBe('success');
          expect((await storedSteps(parent.id, run.runId))?.['outer-after']).toMatchObject({
            status: 'success',
            output: { n: 2 },
          });
        });
      },
      20_000,
    );

    // T10. An evented agent resumed after a tool approval. With one step allowed the agent's loop
    // ends in the resumed iteration, so its finishing step still carries the resume. Delivered
    // twice while its output processor runs, both copies continued the run without the guards, and
    // the step after it ran twice. Under the guards the slower copy is refused once the next step
    // started. When it completes first it continues from the saved result and publishes the next
    // step again, and that step runs for whichever start comes first (the order Postgres hit in
    // CI). Either way the next step ends once and the run ends once.
    it.each(['as delivered', 'the slower copy completes first'] as const)(
      'runs the step after an evented agent finishes once when its finishing step is delivered twice after a tool approval (%s)',
      async order => {
        const model = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        }) as unknown as LanguageModelV2;
        const lookup = createTool({
          id: 'lookup',
          description: 'Look something up',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ found: true }),
        });
        const entered = deferred();
        const held = deferred();
        let processed = 0;
        const holdOutput = {
          id: 'hold-output',
          processOutputResult: async ({ messages }: { messages: any[] }) => {
            if (++processed === 1) {
              entered.resolve();
              await held.promise;
            }
            return messages;
          },
        };
        const agent = createEventedAgent({
          agent: new Agent({
            id: 'approval-agent',
            name: 'approval-agent',
            instructions: 'Use lookup.',
            model,
            tools: { lookup },
            outputProcessors: [holdOutput],
          }),
          storageVersion,
        });
        let interceptor: MockInstance | undefined;
        const drain = async (stream: ReadableStream<unknown>) => {
          const reader = stream.getReader();
          while (!(await reader.read()).done) {
            // consume
          }
        };
        await withHost(
          {},
          async ({ driver }) => {
            try {
              const started = await agent.stream('Look it up', { requireToolApproval: true, maxSteps: 1 });
              // The suspended run's stream stays open; the approval request is what the caller waits for.
              const first = (started.fullStream as ReadableStream<{ type?: string }>).getReader();
              for (let chunk = await first.read(); !chunk.done; chunk = await first.read()) {
                if (chunk.value?.type === 'tool-call-approval') break;
              }
              await first.cancel();
              const from = driver.events.length;
              const resumed = await agent.resume(started.runId, { approved: true });
              const finished = drain(resumed.fullStream as ReadableStream<unknown>);
              await entered.promise;
              const finishing = driver.events
                .filter(
                  event =>
                    event.type === 'workflow.step.run' &&
                    event.runId === started.runId &&
                    event.data.workflowId === DurableStepIds.AGENTIC_LOOP,
                )
                .at(-1)!;
              expect(finishing.data.resumeSteps?.length).toBeGreaterThan(0);
              const afterPath = [finishing.data.executionPath[0] + 1];
              // The faster copy's next step event waits until the slower copy's completion was handled.
              const publish = driver.pubsub.publish.bind(driver.pubsub);
              let heldNext: (() => Promise<void>) | undefined;
              interceptor = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
                if (
                  order === 'the slower copy completes first' &&
                  !heldNext &&
                  event.type === 'workflow.step.run' &&
                  event.runId === started.runId &&
                  event.data.workflowId === DurableStepIds.AGENTIC_LOOP &&
                  event.data.executionPath?.[0] === afterPath[0]
                ) {
                  heldNext = () => publish(topic, event, options);
                  return;
                }
                return publish(topic, event, options);
              });
              await driver.redeliverEvent(finishing);
              held.resolve();
              await settleSecondCompletion(
                driver,
                from,
                started.runId,
                DurableStepIds.AGENTIC_LOOP,
                finishing.data.executionPath,
              );
              await heldNext?.();
              await finished;
              await drainHandlers();
              expect(processed).toBe(2);
              expect(stepEndsSince(driver, from, started.runId, DurableStepIds.AGENTIC_LOOP, afterPath)).toHaveLength(
                1,
              );
              // The agent's run ends once.
              expect(
                driver.events
                  .slice(from)
                  .filter(
                    event =>
                      event.type === 'workflow.end' &&
                      event.runId === started.runId &&
                      event.data.workflowId === DurableStepIds.AGENTIC_LOOP,
                  ),
              ).toHaveLength(1);
            } finally {
              held.resolve();
              interceptor?.mockRestore();
            }
          },
          { 'approval-agent': agent },
        );
      },
      30_000,
    );
  });
}
