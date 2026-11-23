import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

// See https://github.com/mastra-ai/mastra/issues/30008.
const engines = [
  { name: 'evented v1', createStep: createEventedStep, createWorkflow: createEventedWorkflow, storageVersion: 1 },
  { name: 'evented v2', createStep: createEventedStep, createWorkflow: createEventedWorkflow, storageVersion: 2 },
  { name: 'default', createStep: createDefaultStep, createWorkflow: createDefaultWorkflow, storageVersion: undefined },
] as const;

const order = { customer: 'c1', order: 42 };
const schema = z.object({ customer: z.string(), order: z.number() });

describe.each(engines)(
  'a finished sleep on the $name engine',
  ({ name, createStep: makeStep, createWorkflow, storageVersion }) => {
    const createStep = makeStep as (...args: any[]) => any;
    async function setup(until: boolean, duration = 1) {
      const chargeInputs: unknown[] = [];
      let chargeFails = true;
      const prepare = createStep({
        id: 'prepare',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }: any) => inputData,
      });
      const charge = createStep({
        id: 'charge',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }: any) => {
          chargeInputs.push(inputData);
          if (chargeFails) {
            chargeFails = false;
            throw new Error('card declined');
          }
          return inputData;
        },
      });
      const base = (createWorkflow as any)({
        id: `sleep-result-${name.replace(' ', '-')}-${until ? 'until' : 'sleep'}-${duration}`,
        inputSchema: schema,
        outputSchema: schema,
        ...(storageVersion ? { options: { storageVersion } } : {}),
      }).then(prepare);
      const workflow = (until ? base.sleepUntil(new Date(Date.now() + duration)) : base.sleep(duration))
        .then(charge)
        .commit();

      const storage = new MockStore();
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub: new EventEmitterPubSub(),
        workflows: { [workflow.id]: workflow },
      });
      await mastra.startWorkers();
      return { workflow, storage, mastra, chargeInputs };
    }

    it.each([false, true])('is recorded as success with its output (sleepUntil: %s)', async until => {
      const { workflow, mastra, chargeInputs } = await setup(until);
      try {
        const run = await workflow.createRun();
        const first = await run.start({ inputData: order });
        expect(first.status).toBe('failed');

        const stored = await workflow.getWorkflowRunById(run.runId);
        const sleepId = Object.keys(stored!.steps!).find(id => id.startsWith('sleep'))!;
        const finished = { status: 'success', output: order, endedAt: expect.any(Number) };
        expect(stored!.steps![sleepId]).toMatchObject(finished);
        // Storage v2 run results leave `steps` to be loaded on demand.
        if (storageVersion !== 2) expect(first.steps[sleepId]).toMatchObject(finished);

        const retried = await run.timeTravel({ step: 'charge' });
        expect(retried.status).toBe('success');
        expect(chargeInputs).toEqual([order, order]);
        expect(retried.status === 'success' && retried.result).toEqual(order);
      } finally {
        await mastra.stopWorkers();
      }
    });

    it.each([false, true])('stays unfinished when the run is canceled mid-sleep (sleepUntil: %s)', async until => {
      const { workflow, mastra, chargeInputs } = await setup(until, 1000);
      try {
        const run = await workflow.createRun();
        const events: string[] = [];
        run.watch((event: any) => events.push(`${event.type}:${event.payload?.id}`));
        const started = run.start({ inputData: order });
        await vi.waitFor(async () => {
          const stored = await workflow.getWorkflowRunById(run.runId);
          expect(Object.values(stored?.steps ?? {}).some((r: any) => r.status === 'waiting')).toBe(true);
        });
        await run.cancel();
        expect((await started).status).toBe('canceled');
        await new Promise(resolve => setTimeout(resolve, 1100));

        const stored = await workflow.getWorkflowRunById(run.runId);
        expect(stored?.status).toBe('canceled');
        const sleepId = Object.keys(stored!.steps!).find(id => id.startsWith('sleep'))!;
        expect((stored!.steps![sleepId] as any).status).not.toBe('success');
        expect(events).not.toContain(`workflow-step-result:${sleepId}`);
        expect(events).not.toContain(`workflow-step-finish:${sleepId}`);
        expect(chargeInputs).toEqual([]);
      } finally {
        await mastra.stopWorkers();
      }
    });
  },
);

// The sleep timer runs outside any event delivery, so nothing retries or
// reports a storage call that rejects inside it.
describe.each([1, 2] as const)('a sleep timer on evented storage v%s', storageVersion => {
  const failures = [
    { call: 'loadHeader', v1: 'loadWorkflowSnapshot', v2: 'loadWorkflowRunHeader' },
    { call: 'writeStepResult', v1: 'updateWorkflowResults', v2: 'appendWorkflowRunEntries' },
  ] as const;

  describe.each(failures)('whose $call rejects', ({ call, v1, v2 }) => {
    it.each([false, true])('fails the run with the storage error (sleepUntil: %s)', async until => {
      const charge = vi.fn(async ({ inputData }: any) => inputData);
      const base = createEventedWorkflow({
        id: `sleep-storage-${storageVersion}-${call}-${until}`,
        inputSchema: schema,
        outputSchema: schema,
        options: { storageVersion },
      } as any).then(
        createEventedStep({
          id: 'prepare',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => inputData,
        }),
      );
      const workflow = (until ? base.sleepUntil(new Date(Date.now() + 300)) : base.sleep(300))
        .then(createEventedStep({ id: 'charge', inputSchema: schema, outputSchema: schema, execute: charge }))
        .commit();

      const storage = new MockStore();
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub: new EventEmitterPubSub(),
        workflows: { [workflow.id]: workflow },
      });
      const store = (await storage.getStore('workflows')) as any;
      const writeMethod = storageVersion === 1 ? 'updateWorkflowResults' : 'appendWorkflowRunEntries';
      const failMethod = storageVersion === 1 ? v1 : v2;
      const originals = { [writeMethod]: store[writeMethod].bind(store), [failMethod]: store[failMethod].bind(store) };
      let timerDue = false;
      let rejected = false;
      const failOnce = () => {
        if (!timerDue || rejected) return;
        rejected = true;
        throw new Error(`storage down: ${call}`);
      };
      // The sleep's `waiting` write lands just before its timer is set; the
      // first matching call after the timer is due is the timer's.
      vi.spyOn(store, writeMethod).mockImplementation(async (args: any) => {
        const [stepId, result] = args.stepId ? [args.stepId, args.result] : (Object.entries(args.steps ?? {})[0] ?? []);
        if (String(stepId).startsWith('sleep') && (result as any)?.status === 'waiting') {
          setTimeout(() => (timerDue = true), 250);
        }
        if (failMethod === writeMethod) failOnce();
        return originals[writeMethod](args);
      });
      if (failMethod !== writeMethod) {
        vi.spyOn(store, failMethod).mockImplementation(async (args: any) => {
          failOnce();
          return originals[failMethod](args);
        });
      }
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        const result = await Promise.race([
          run.start({ inputData: order }),
          new Promise<'stuck'>(resolve => setTimeout(() => resolve('stuck'), 3000)),
        ]);
        expect(rejected).toBe(true);
        expect(unhandled).toEqual([]);
        expect(result).not.toBe('stuck');
        expect((result as any).status).toBe('failed');
        expect(String((result as any).error?.message ?? (result as any).error)).toContain(`storage down: ${call}`);
        const stored = await workflow.getWorkflowRunById(run.runId);
        expect(stored?.status).toBe('failed');
        expect(charge).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', onUnhandled);
        await mastra.stopWorkers();
      }
    });
  });
});
