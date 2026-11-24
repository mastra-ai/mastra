import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { init } from './index';

async function setup() {
  const inngest = new Inngest({ id: 'mastra-test' });
  const { createWorkflow, createStep } = init(inngest);

  const double = createStep({
    id: 'double',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ n: z.number() }),
    execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
  });
  const workflow = createWorkflow({
    id: 'inngest-foreach-tt',
    inputSchema: z.array(z.object({ n: z.number() })),
    outputSchema: z.array(z.object({ n: z.number() })),
  })
    .foreach(double)
    .commit();

  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { 'inngest-foreach-tt': workflow as any },
  });
  workflow.__registerMastra(mastra);

  const run = await workflow.createRun();
  vi.spyOn(run as any, 'getRunOutput').mockResolvedValue({ output: { result: { status: 'success' } } });
  const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-tt'] } as any);
  return { run, sendSpy };
}

describe('@mastra/inngest timeTravel into foreach step (hermetic)', () => {
  it('accepts array inputData and sends it to the engine', async () => {
    const { run, sendSpy } = await setup();

    await run.timeTravel({ step: 'double', inputData: [{ n: 1 }, { n: 2 }] });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((sendSpy.mock.calls[0]![0] as any).data)).toContain('[{"n":1},{"n":2}]');
  });

  it('rejects invalid elements', async () => {
    const { run, sendSpy } = await setup();

    await expect(run.timeTravel({ step: 'double', inputData: [{ n: 'x' }] as any })).rejects.toThrow(
      /Invalid inputData/,
    );
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('rejects non-array input', async () => {
    const { run } = await setup();

    await expect(run.timeTravel({ step: 'double', inputData: { n: 1 } as any })).rejects.toThrow(
      /Expected an array for foreach step/,
    );
  });
});
