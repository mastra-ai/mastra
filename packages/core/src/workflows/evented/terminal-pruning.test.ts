import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '.';

describe('evented terminal snapshot pruning', () => {
  it('returns the successful result when best-effort terminal cleanup cannot be saved', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    expect(store.supportsWorkflowStepGuards()).toBe(false);
    let failedWrites = 0;
    const persist = store.persistWorkflowSnapshot.bind(store);
    const interrupted = vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.snapshot.status === 'success') {
        failedWrites++;
        throw new Error('Terminal cleanup storage unavailable');
      }
      return persist(args);
    });
    const schema = z.object({ n: z.number() });
    const calls: number[] = [];
    const workflow = createWorkflow({
      id: 'best-effort-terminal-prune',
      inputSchema: schema,
      outputSchema: schema,
      options: { pruneSnapshot: ({ snapshot }) => snapshot },
    })
      .then(
        createStep({
          id: 'finish',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => {
            calls.push(inputData.n);
            return { n: inputData.n + 1 };
          },
        }),
      )
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow },
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { n: 0 } });
      expect(result).toMatchObject({ status: 'success', result: { n: 1 } });
      expect(failedWrites).toBe(1);
      expect(calls).toEqual([0]);
      expect(await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId })).toMatchObject({
        status: 'success',
        context: { finish: { status: 'success', output: { n: 1 } } },
      });
    } finally {
      interrupted.mockRestore();
      await mastra.stopWorkers();
    }
  });
});
