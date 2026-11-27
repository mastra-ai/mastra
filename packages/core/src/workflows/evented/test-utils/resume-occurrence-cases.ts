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
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import type { WorkflowOptions } from '../..';
import { createStep, createWorkflow as createEventedWorkflow } from '..';
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
}: {
  getStorage: () => MastraStorage;
  storageVersion: 1 | 2;
}) {
  describe('evented resume and time travel occurrences (COR-1620)', () => {
    let storage: MastraStorage;
    beforeAll(() => {
      storage = getStorage();
    });
    const createWorkflow = ((params: Parameters<typeof createEventedWorkflow>[0]) => {
      const options: WorkflowOptions<any> = { ...params.options, storageVersion };
      return createEventedWorkflow({ ...params, options });
    }) as typeof createEventedWorkflow;

    async function withHost(workflows: Record<string, any>, body: (host: Host) => Promise<void>) {
      const driver = new RedeliveryDriver();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows });
      const warn = vi.spyOn(mastra.getLogger(), 'warn');
      try {
        await mastra.startWorkers();
        await body({ driver, warn });
      } finally {
        warn.mockRestore();
        try {
          await mastra.stopWorkers();
        } finally {
          driver.dispose();
        }
      }
    }

    /** Re-delivers a step event with its own id while its first delivery is still inside the step. */
    async function redeliverInBody(driver: RedeliveryDriver, event: Event) {
      const key = `workflow-step-run:${event.runId}:${event.id}`;
      const owner = await driver.pubsub.getLeaseOwner(key);
      if (owner) await driver.pubsub.releaseLease(key, owner);
      await driver.redeliverEvent(event);
    }

    /** Waits until the run publishes nothing for a while, so work a duplicate started has run. */
    async function settle(driver: RedeliveryDriver) {
      let seen = -1;
      for (let i = 0; i < 50 && seen !== driver.events.length; i++) {
        seen = driver.events.length;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
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
    function linearWorkflow() {
      const calls = { gate: 0, after: 0, next: 0 };
      const held = { gate: deferred(), after: deferred(), next: deferred() };
      const entered = { gate: deferred(), after: deferred(), next: deferred() };
      const armed = { gate: false, after: false, next: false };
      const hold = async (id: keyof typeof calls) => {
        calls[id]++;
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
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) return suspend({});
          await hold('gate');
          return inputData;
        },
      });
      const after = createStep({
        id: 'after',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => {
          await hold('after');
          return { n: inputData.n + 1 };
        },
      });
      const next = createStep({
        id: 'next',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => {
          await hold('next');
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({ id: `resume-linear-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
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

    // T2. The resumed step's own event delivered twice while it runs: without the guards both
    // copies continued the run, so the step after it ran twice.
    it('runs the step after a resume once when the resumed step is delivered twice', async () => {
      const wf = linearWorkflow();
      await withHost({ [wf.workflow.id]: wf.workflow }, async ({ driver }) => {
        try {
          const run = await wf.workflow.createRun();
          expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
          wf.arm('gate', 'after');
          const from = driver.events.length;
          const result = run.resume({ step: 'gate', resumeData: { ok: true } });
          await wf.entered.gate.promise;
          const gateRun = stepRunsSince(driver, from, run.runId, '0')[0]!;
          await redeliverInBody(driver, gateRun);
          await wf.entered.after.promise;
          wf.held.gate.resolve();
          await settle(driver);
          wf.held.after.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await settle(driver);
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
          await redeliverInBody(driver, afterRun);
          await wf.entered.next.promise;
          wf.held.after.resolve();
          await settle(driver);
          wf.held.next.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 13 } });
          await settle(driver);
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
          await redeliverInBody(driver, gateRun);
          await wf.entered.after.promise;
          wf.held.gate.resolve();
          await settle(driver);
          wf.held.after.resolve();
          expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
          await settle(driver);
          expect(wf.calls).toEqual({ gate: 2, after: 1, next: 1 });
        } finally {
          wf.releaseAll();
        }
      });
    }, 20_000);

    /** gate suspends; once resumed its first attempt fails and the retry succeeds. */
    function retryingGateWorkflow() {
      const attempts: string[] = [];
      const gate = createStep({
        id: 'gate',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) return suspend({});
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
      return { workflow, attempts };
    }

    // T5. Guards a hang: a retry of a resumed step must claim the step again, or its completion is
    // refused and the run stays running.
    it('finishes a resumed step that fails once and is retried', async () => {
      const { workflow, attempts } = retryingGateWorkflow();
      await withHost({ [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.resume({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 1 },
        });
        expect(attempts).toEqual(['failed', 'succeeded']);
      });
    }, 20_000);

    // T6. The same for a time travel into a suspended step.
    it('finishes a time travel into a suspended step that fails once and is retried', async () => {
      const { workflow, attempts } = retryingGateWorkflow();
      await withHost({ [workflow.id]: workflow }, async () => {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
        expect(await run.timeTravel({ step: 'gate', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
          result: { n: 1 },
        });
        expect(attempts).toEqual(['failed', 'succeeded']);
      });
    }, 20_000);

    // T7. The nested body of a time-travelled loop must complete under the occurrence that started
    // it, or the next iteration's start is refused and the run hangs. Time travel to the loop starts
    // a fresh child (on storage v2 this hung before the guards covered time travel); time travel to
    // the step inside the body time-travels the child too.
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
    it('continues the parent after its nested child is resumed directly', async () => {
      const innerAsk = createStep({
        id: 'inner-ask',
        inputSchema: Num,
        outputSchema: Num,
        resumeSchema: Approval,
        execute: async ({ inputData, resumeData, suspend }) => (resumeData ? { n: inputData.n + 1 } : suspend({})),
      });
      const child = createWorkflow({ id: `direct-child-${randomUUID()}`, inputSchema: Num, outputSchema: Num })
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
        const childRun = await child.createRun({ runId: childRunId });
        expect(await childRun.resume({ step: 'inner-ask', resumeData: { ok: true } })).toMatchObject({
          status: 'success',
        });
        await expect
          .poll(async () => (await parent.getWorkflowRunById(run.runId))?.status, { timeout: 10_000 })
          .toBe('success');
        expect((await storedSteps(parent.id, run.runId))?.['outer-after']).toMatchObject({
          status: 'success',
          output: { n: 2 },
        });
      });
    }, 20_000);
  });
}
