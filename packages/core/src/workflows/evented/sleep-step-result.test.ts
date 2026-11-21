import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

// See https://github.com/mastra-ai/mastra/issues/30008.
const engines = [
  { name: 'evented', createStep: createEventedStep, createWorkflow: createEventedWorkflow },
  { name: 'default', createStep: createDefaultStep, createWorkflow: createDefaultWorkflow },
] as const;

const order = { customer: 'c1', order: 42 };
const schema = z.object({ customer: z.string(), order: z.number() });

describe.each(engines)('a finished sleep on the $name engine', ({ name, createStep: makeStep, createWorkflow }) => {
  const createStep = makeStep as (...args: any[]) => any;
  async function setup(until: boolean) {
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
      id: `sleep-result-${name}-${until ? 'until' : 'sleep'}`,
      inputSchema: schema,
      outputSchema: schema,
    }).then(prepare);
    const workflow = (until ? base.sleepUntil(new Date(Date.now() + 1)) : base.sleep(1)).then(charge).commit();

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
    const { workflow, storage, mastra, chargeInputs } = await setup(until);
    try {
      const run = await workflow.createRun();
      const first = await run.start({ inputData: order });
      expect(first.status).toBe('failed');

      const sleepId = Object.keys(first.steps).find(id => id.startsWith('sleep'))!;
      expect(first.steps[sleepId]).toMatchObject({ status: 'success', output: order, endedAt: expect.any(Number) });

      const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(snapshot?.context[sleepId]).toMatchObject({ status: 'success', output: order });

      const retried = await run.timeTravel({ step: 'charge' });
      expect(retried.status).toBe('success');
      expect(chargeInputs).toEqual([order, order]);
      expect(retried.status === 'success' && retried.result).toEqual(order);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
