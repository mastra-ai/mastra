import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

function setup() {
  const double = createStep({
    id: 'double',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
    execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
  });
  const plain = createStep({
    id: 'plain',
    inputSchema: z.object({ items: z.array(z.object({ n: z.number() })) }),
    outputSchema: z.array(z.object({ n: z.number() })),
    execute: async ({ inputData }) => inputData.items,
  });
  const workflow = createWorkflow({
    id: 'foreach-tt',
    inputSchema: z.object({ items: z.array(z.object({ n: z.number() })) }),
    outputSchema: z.array(z.object({ n: z.number() })),
  })
    .then(plain)
    .foreach(double)
    .commit();
  new Mastra({ workflows: { workflow }, storage: new MockStore(), logger: false });
  return workflow;
}

describe('timeTravel into foreach step', () => {
  it('accepts array inputData and runs the loop', async () => {
    const run = await setup().createRun();
    const result = await run.timeTravel({ step: 'double', inputData: [{ n: 1 }, { n: 2 }], perStep: true });
    expect(result.status).toBe('paused');
    expect(result.steps.double).toMatchObject({ status: 'success', output: [{ n: 2 }, { n: 4 }] });
  });

  it('rejects invalid elements', async () => {
    const run = await setup().createRun();
    await expect(run.timeTravel({ step: 'double', inputData: [{ n: 'x' }] as any })).rejects.toThrow(
      /Invalid inputData/,
    );
  });

  it('rejects non-array input', async () => {
    const run = await setup().createRun();
    await expect(run.timeTravel({ step: 'double', inputData: { n: 1 } as any })).rejects.toThrow(
      /Expected an array for foreach step/,
    );
  });

  it('still validates non-foreach steps against their schema', async () => {
    const run = await setup().createRun();
    await expect(run.timeTravel({ step: 'plain', inputData: [{ n: 1 }] as any })).rejects.toThrow(/Invalid inputData/);
  });
});
