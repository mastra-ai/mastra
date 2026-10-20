import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// Issue #27246: while a foreach is still running, the evented engine stored the step as
// 'success' (with endedAt) and exposed unfinished iterations as null output slots.
// The default engine reports such a step as 'running' with no output.
describe('evented foreach step status while iterations run (#27246)', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  for (const concurrency of [1, 2]) {
    it(`keeps the foreach step running until every iteration finishes (concurrency ${concurrency})`, async () => {
      const item = z.object({ n: z.number() });
      const release: Record<number, () => void> = {};
      const started = new Set<number>();

      const list = createStep({
        id: 'list',
        inputSchema: z.object({}),
        outputSchema: z.array(item),
        execute: async () => [{ n: 1 }, { n: 2 }, { n: 3 }],
      });
      const slow = createStep({
        id: 'slow',
        inputSchema: item,
        outputSchema: item,
        execute: async ({ inputData }) => {
          started.add(inputData.n);
          await new Promise<void>(resolve => (release[inputData.n] = resolve));
          return inputData;
        },
      });

      const workflowId = `foreach-running-status-${concurrency}`;
      const workflow = createWorkflow({ id: workflowId, inputSchema: z.object({}), outputSchema: z.array(item) })
        .then(list)
        .foreach(slow, { concurrency })
        .commit();

      mastra = new Mastra({
        workflows: { [workflowId]: workflow },
        storage: new MockStore(),
        pubsub: new EventEmitterPubSub(),
        logger: false,
      });
      await mastra.startWorkers();
      const store = (await mastra.getStorage()!.getStore('workflows'))!;

      const run = await workflow.createRun();
      const resultPromise = run.start({ inputData: {} });

      const storedStep = async () => {
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
        return (snapshot?.context as Record<string, any> | undefined)?.slow;
      };

      const expectRunning = async () => {
        const raw = await storedStep();
        expect(raw?.status).toBe('running');
        expect(raw?.startedAt).toBeTypeOf('number');
        expect(raw?.endedAt).toBeUndefined();

        const state = await workflow.getWorkflowRunById(run.runId);
        expect(state?.steps.slow?.status).toBe('running');
        expect(state?.steps.slow?.output).toBeUndefined();
        return raw.startedAt as number;
      };

      await vi.waitFor(() => expect(started.size).toBe(concurrency), { timeout: 5000 });
      await vi.waitFor(async () => expect((await storedStep())?.output).toBeDefined(), { timeout: 5000 });
      const startedAt = await expectRunning();

      for (const n of [1, 2]) {
        release[n]!();
        await vi.waitFor(async () => expect((await storedStep())?.output?.[n - 1]).toEqual({ n }), { timeout: 5000 });
        expect(await expectRunning()).toBe(startedAt);
        await vi.waitFor(() => expect(started.has(n + 1)).toBe(true), { timeout: 5000 });
      }

      release[3]!();
      const result = await resultPromise;
      expect(result.status).toBe('success');

      const finalStep = await storedStep();
      expect(finalStep?.status).toBe('success');
      expect(finalStep?.output).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(finalStep?.startedAt).toBe(startedAt);
      expect(finalStep?.endedAt).toBeTypeOf('number');

      const state = await workflow.getWorkflowRunById(run.runId);
      expect(state?.steps.slow?.status).toBe('success');
      expect(state?.steps.slow?.output).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });
  }
});
