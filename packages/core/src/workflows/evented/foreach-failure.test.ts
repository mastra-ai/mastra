import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// Issue #26390: a failed .foreach() iteration must fail the run on the evented engine.
describe('evented foreach with a failing iteration', () => {
  const item = z.object({ n: z.number() });

  function build(id: string, concurrency: number, nested: boolean) {
    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ n: 1 }, { n: 2 }, { n: 3 }],
    });
    let boom: any = createStep({
      id: 'boom',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: async ({ inputData }) => {
        if (inputData.n === 2) throw new Error('child failed');
        return inputData;
      },
    });
    if (nested) {
      boom = createWorkflow({ id: `${id}-child`, inputSchema: item, outputSchema: item })
        .then(boom)
        .commit();
    }
    return createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.array(item) })
      .then(list)
      .foreach(boom, { concurrency })
      .commit();
  }

  for (const nested of [false, true]) {
    for (const concurrency of [1, 2, 3]) {
      it(`fails the run (${nested ? 'nested workflow' : 'step'} body, concurrency ${concurrency})`, async () => {
        const id = `foreach-fail-${nested ? 'nested' : 'step'}-${concurrency}`;
        const workflow = build(id, concurrency, nested);
        const mastra = new Mastra({
          workflows: { [id]: workflow },
          storage: new MockStore(),
          pubsub: new EventEmitterPubSub(),
          logger: false,
        });
        await mastra.startWorkers();
        try {
          const run = await workflow.createRun();
          const result = await Promise.race([
            run.start({ inputData: {} }),
            new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 3000)),
          ]);
          expect(result).not.toBe('HANG');
          expect((result as any).status).toBe('failed');
          expect((result as any).error?.message).toBe('child failed');

          // Siblings that finish after the failure must not advance or re-end the run.
          await new Promise(resolve => setTimeout(resolve, 200));
          const stored = await (await mastra.getStorage()!.getStore('workflows'))!.loadWorkflowSnapshot({
            workflowName: id,
            runId: run.runId,
          });
          expect(stored?.status).toBe('failed');
          const foreachResult = (stored?.context as any)[nested ? `${id}-child` : 'boom'];
          expect(foreachResult.status).toBe('failed');
          expect(foreachResult.output[0]).toEqual({ n: 1 });
          expect(foreachResult.output[1]).toBeNull();
        } finally {
          await mastra.stopWorkers();
        }
      });
    }
  }
});
