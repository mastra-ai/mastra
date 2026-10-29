import { describe, expect, it, vi } from 'vitest';
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

// Iterations that fail after the run already failed must not replace the first error or end the run again.
describe('evented foreach with several failing iterations', () => {
  const item = z.object({ n: z.number() });

  async function setup(id: string, execute: (n: number, runFailed: Promise<void>) => Promise<{ n: number }>) {
    let markRunFailed!: () => void;
    const runFailed = new Promise<void>(resolve => (markRunFailed = resolve));
    const pubsub = new EventEmitterPubSub();
    const failEvents: unknown[] = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event) => {
      await publish(topic, event);
      if (topic === 'workflows' && event.type === 'workflow.fail') {
        failEvents.push(event);
        markRunFailed();
      }
    };

    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ n: 1 }, { n: 2 }],
    });
    const boom = createStep({
      id: 'boom',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: ({ inputData }) => execute(inputData.n, runFailed),
    });
    const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.array(item) })
      .then(list)
      .foreach(boom, { concurrency: 2 })
      .commit();
    const mastra = new Mastra({ workflows: { [id]: workflow }, storage: new MockStore(), pubsub, logger: false });
    await mastra.startWorkers();
    const run = await workflow.createRun();
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
    const loadForeach = async () =>
      ((await workflowsStore.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.context as any)?.boom;
    // Resolves once every iteration, including the one finishing after the run failed, has been recorded.
    // Two items keep a single late step end; concurrent late ends race on foreachOutput (separate issue).
    const allIterationsRecorded = (statuses: string[]) =>
      vi.waitFor(async () => {
        const recorded = (await loadForeach())?.suspendPayload?.__workflow_meta?.foreachOutput?.map(
          (r: any) => r?.status,
        );
        expect(recorded).toEqual(statuses);
      });
    return { mastra, run, failEvents, loadForeach, allIterationsRecorded };
  }

  it('keeps the first failure when a sibling fails after the run failed', async () => {
    const { mastra, run, failEvents, loadForeach, allIterationsRecorded } = await setup(
      'foreach-two-failures',
      async (n, runFailed) => {
        if (n === 1) throw new Error('first failure');
        await runFailed;
        throw new Error('second failure');
      },
    );
    try {
      const result: any = await run.start({ inputData: {} });
      expect(result.status).toBe('failed');
      expect(result.error?.message).toBe('first failure');

      await allIterationsRecorded(['failed', 'failed']);
      const foreach = await loadForeach();
      expect(foreach.status, 'stored foreach status after the late siblings finished').toBe('failed');
      expect(foreach.error?.message, 'stored foreach error after a second iteration failed').toBe('first failure');
      expect(failEvents, 'workflow.fail events for one failed run').toHaveLength(1);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('fails a time-travel replay exactly once when a previously failed iteration fails again', async () => {
    let iteration2Runs = 0;
    const { mastra, run, failEvents, allIterationsRecorded } = await setup(
      'foreach-time-travel-refail',
      async (n, runFailed) => {
        if (n === 1) throw new Error('always fails');
        if (n === 2 && ++iteration2Runs === 1) {
          await runFailed;
          throw new Error('fails once');
        }
        return { n };
      },
    );
    try {
      expect(((await run.start({ inputData: {} })) as any).status).toBe('failed');
      await allIterationsRecorded(['failed', 'failed']);

      failEvents.length = 0;
      const replay: any = await run.timeTravel({ step: 'boom' });
      expect(replay.status).toBe('failed');
      expect(replay.error?.message).toBe('always fails');
      expect(failEvents, 'workflow.fail events for one failed replay').toHaveLength(1);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
