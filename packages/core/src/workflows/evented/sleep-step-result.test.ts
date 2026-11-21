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
      const { workflow, mastra, chargeInputs } = await setup(until, 200);
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
        await new Promise(resolve => setTimeout(resolve, 300));

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
