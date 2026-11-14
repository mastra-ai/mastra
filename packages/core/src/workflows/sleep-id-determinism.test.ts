import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createWorkflow } from './create';
import { createStep } from './workflow';

const sleepIdsOf = (wf: { steps: Record<string, unknown> }) =>
  Object.keys(wf.steps).filter(id => id.startsWith('sleep_'));

const buildWorkflow = (charge: (input: unknown) => void = () => {}) => {
  const prepare = createStep({
    id: 'prepare',
    inputSchema: z.object({ customer: z.string() }),
    outputSchema: z.object({ customer: z.string(), order: z.number() }),
    execute: async ({ inputData }) => ({ customer: inputData.customer, order: 7 }),
  });
  const chargeStep = createStep({
    id: 'charge',
    inputSchema: z.object({ customer: z.string(), order: z.number() }),
    outputSchema: z.object({ charged: z.number() }),
    execute: async ({ inputData }) => {
      charge(inputData);
      return { charged: inputData.order };
    },
  });
  return createWorkflow({
    id: 'sleep-determinism-wf',
    inputSchema: z.object({ customer: z.string() }),
    outputSchema: z.object({ charged: z.number() }),
  })
    .then(prepare)
    .sleep(1)
    .sleepUntil(new Date(Date.now() + 1))
    .then(chargeStep)
    .commit();
};

describe('default ids for unnamed sleeps', () => {
  it('are the same in every build, with one ordinal over sleep and sleepUntil', () => {
    const first = sleepIdsOf(buildWorkflow() as any);
    expect(first).toEqual(['sleep_sleep-determinism-wf_0', 'sleep_sleep-determinism-wf_1']);
    expect(sleepIdsOf(buildWorkflow() as any)).toEqual(first);
  });

  it('skip an id an explicit sleep already took', () => {
    const wf = createWorkflow({
      id: 'sleep-collide-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .sleep(1, { id: 'sleep_sleep-collide-wf_1' })
      .sleepUntil(new Date(Date.now() + 1))
      .commit();
    expect(sleepIdsOf(wf as any)).toEqual(['sleep_sleep-collide-wf_1', 'sleep_sleep-collide-wf_2']);
  });

  it('let time travel past a sleep in a rebuilt workflow hand the next step its recorded input', async () => {
    const storage = new InMemoryStore();
    const original = buildWorkflow();
    new Mastra({ logger: false, storage, workflows: { [original.id]: original } });
    const run = await original.createRun();
    const result = await run.start({ inputData: { customer: 'ada' } });
    expect(result.status).toBe('success');

    // A second process builds the workflow again from the same code.
    const charge = vi.fn();
    const rebuilt = buildWorkflow(charge);
    new Mastra({ logger: false, storage, workflows: { [rebuilt.id]: rebuilt } });
    const travelRun = await rebuilt.createRun({ runId: run.runId });
    const travelled = await travelRun.timeTravel({ step: 'charge' });

    expect(travelled.status).toBe('success');
    expect(charge).toHaveBeenCalledWith({ customer: 'ada', order: 7 });
  });
});
