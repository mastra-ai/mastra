import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// Issue #27246: while iterations are in flight, the stored foreach step must be `running`.
describe('evented foreach stored status while iterations run', () => {
  const item = z.object({ n: z.number() });

  function build(id: string, concurrency: number, nested: boolean, gates: Map<number, Promise<void>>) {
    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ n: 1 }, { n: 2 }, { n: 3 }],
    });
    let slow: any = createStep({
      id: 'slow',
      inputSchema: item,
      outputSchema: item,
      execute: async ({ inputData }) => {
        await gates.get(inputData.n);
        return inputData;
      },
    });
    if (nested) {
      slow = createWorkflow({ id: `${id}-child`, inputSchema: item, outputSchema: item })
        .then(slow)
        .commit();
    }
    const collect = createStep({
      id: 'collect',
      inputSchema: z.array(item),
      outputSchema: z.object({ total: z.number(), count: z.number() }),
      execute: async ({ inputData }) => ({
        total: inputData.reduce((sum, r) => sum + r.n, 0),
        count: inputData.length,
      }),
    });
    return createWorkflow({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({ total: z.number(), count: z.number() }),
    })
      .then(list)
      .foreach(slow, { concurrency })
      .then(collect)
      .commit();
  }

  async function waitFor<T>(read: () => Promise<T>, done: (v: T) => boolean): Promise<T> {
    const deadline = Date.now() + 3000;
    for (;;) {
      const value = await read();
      if (done(value)) return value;
      if (Date.now() > deadline) throw new Error('timed out waiting for snapshot condition');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  for (const nested of [false, true]) {
    for (const concurrency of [1, 2]) {
      it(`is running until every iteration ends (${nested ? 'nested workflow' : 'step'} body, concurrency ${concurrency})`, async () => {
        const id = `foreach-running-${nested ? 'nested' : 'step'}-${concurrency}`;
        const releases = new Map<number, () => void>();
        const gates = new Map<number, Promise<void>>();
        for (const n of [1, 2, 3]) gates.set(n, new Promise<void>(resolve => releases.set(n, resolve)));

        const workflow = build(id, concurrency, nested, gates);
        const mastra = new Mastra({
          workflows: { [id]: workflow },
          storage: new MockStore(),
          pubsub: new EventEmitterPubSub(),
          logger: false,
        });
        await mastra.startWorkers();
        try {
          const store = (await mastra.getStorage()!.getStore('workflows'))!;
          const run = await workflow.createRun();
          const stepId = nested ? `${id}-child` : 'slow';
          const readStep = async () =>
            ((await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.context as any)?.[stepId];

          const resultPromise = run.start({ inputData: {} });

          const first = await waitFor(readStep, s => !!s);
          expect(first.status).toBe('running');
          expect(first.endedAt).toBeUndefined();
          expect(first.output).toContain(null);
          const startedAt = first.startedAt;
          expect(startedAt).toBeTypeOf('number');

          releases.get(1)!();
          const afterOne = await waitFor(readStep, s => s?.output?.[0] != null);
          expect(afterOne.status).toBe('running');
          expect(afterOne.endedAt).toBeUndefined();
          expect(afterOne.startedAt).toBe(startedAt);

          releases.get(2)!();
          releases.get(3)!();
          const result = await Promise.race([
            resultPromise,
            new Promise<'HANG'>(resolve => setTimeout(() => resolve('HANG'), 3000)),
          ]);
          expect(result).not.toBe('HANG');
          expect((result as any).status).toBe('success');
          expect((result as any).result).toEqual({ total: 6, count: 3 });

          const final = await readStep();
          expect(final.status).toBe('success');
          expect(final.output).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
          expect(final.startedAt).toBe(startedAt);
          expect(final.endedAt).toBeTypeOf('number');
          expect(final.endedAt).toBeGreaterThanOrEqual(startedAt);
        } finally {
          for (const release of releases.values()) release();
          await mastra.stopWorkers();
        }
      });
    }
  }
});
