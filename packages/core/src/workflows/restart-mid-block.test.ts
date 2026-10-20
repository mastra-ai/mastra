/**
 * Regression for https://github.com/mastra-ai/mastra/issues/26214
 *
 * The default engine did not checkpoint parallel arms or foreach items as they
 * finished; it only wrote the block's result once every arm or item was done.
 * A crash inside the block left a checkpoint where finished arms still looked
 * in flight and finished foreach items left no trace, so `restart()` ran them
 * a second time.
 *
 * Each test runs the workflow once and, from inside a still-running step, keeps
 * the latest checkpoint that storage holds at that moment: exactly what a
 * process that died there would leave behind. It then restores that checkpoint
 * into fresh storage with a freshly built workflow and restarts.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

const anySchema = z.any();

/** Called from inside a running step to take the checkpoint a crash at that moment would leave. */
type Crash = () => Promise<void>;

type Built = { workflow: any; fns: Record<string, ReturnType<typeof vi.fn>> };

function step(id: string, execute: (params: { inputData: any }) => Promise<any>) {
  const fn = vi.fn(execute);
  return { fn, step: createStep({ id, inputSchema: anySchema, outputSchema: anySchema, execute: fn }) };
}

/** Lets pending persists settle so the captured checkpoint reflects everything written so far. */
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

async function crashAndRestart(build: (crash?: Crash) => Built, inputData: unknown) {
  const storage = new MockStore();
  let crashSnapshot: WorkflowRunState | undefined;
  let latest: WorkflowRunState | undefined;
  const crash: Crash = async () => {
    await settle();
    crashSnapshot = JSON.parse(JSON.stringify(latest));
  };

  const first = build(crash);
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const store = (await storage.getStore('workflows'))!;
  const persist = store.persistWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    if (args.workflowName === first.workflow.id) latest = JSON.parse(JSON.stringify(args.snapshot));
    return persist(args);
  });

  const run = await first.workflow.createRun();
  const original = await run.start({ inputData });
  expect(original.status).toBe('success');
  expect(crashSnapshot, 'crash point was never reached').toBeDefined();
  expect(crashSnapshot!.status).toBe('running');

  const second = build();
  const freshStorage = new MockStore();
  new Mastra({ logger: false, storage: freshStorage, workflows: { wf: second.workflow } });
  const freshStore = (await freshStorage.getStore('workflows'))!;
  await freshStore.persistWorkflowSnapshot({
    workflowName: second.workflow.id,
    runId: run.runId,
    snapshot: crashSnapshot!,
  });

  const restarted = await (await second.workflow.createRun({ runId: run.runId })).restart();
  const stored = await freshStore.loadWorkflowSnapshot({ workflowName: second.workflow.id, runId: run.runId });
  return { original, restarted, stored, fns: second.fns };
}

describe('restart after a crash inside a parallel or foreach block (issue #26214)', () => {
  it('does not re-run a parallel arm that finished before the crash', async () => {
    const build = (crash?: Crash): Built => {
      let fastDone!: () => void;
      const fastFinished = new Promise<void>(resolve => (fastDone = resolve));
      const fast = step('fast', async ({ inputData }) => {
        setTimeout(() => fastDone(), 0);
        return { fast: inputData.n + 1 };
      });
      const slow = step('slow', async ({ inputData }) => {
        if (crash) {
          await fastFinished;
          await crash();
        }
        return { slow: inputData.n + 2 };
      });
      const join = step('join', async ({ inputData }) => ({ sum: inputData.fast.fast + inputData.slow.slow }));
      const workflow = createWorkflow({ id: 'mid-parallel', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([fast.step, slow.step])
        .then(join.step)
        .commit();
      return { workflow, fns: { fast: fast.fn, slow: slow.fn, join: join.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, { n: 1 });

    expect(fns.fast).not.toHaveBeenCalled();
    expect(fns.slow).toHaveBeenCalledTimes(1);
    expect(fns.join).toHaveBeenCalledTimes(1);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('re-runs only the unfinished arm when finished arms sit on both sides of it', async () => {
    const build = (crash?: Crash): Built => {
      let finished = 0;
      let bothDone!: () => void;
      const othersFinished = new Promise<void>(resolve => (bothDone = resolve));
      const markDone = () =>
        setTimeout(() => {
          if (++finished === 2) bothDone();
        }, 0);
      const first = step('first', async ({ inputData }) => {
        markDone();
        return { first: inputData.n };
      });
      const middle = step('middle', async ({ inputData }) => {
        if (crash) {
          await othersFinished;
          await crash();
        }
        return { middle: inputData.n * 10 };
      });
      const last = step('last', async ({ inputData }) => {
        markDone();
        return { last: inputData.n * 100 };
      });
      const workflow = createWorkflow({ id: 'mid-parallel-3', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([first.step, middle.step, last.step])
        .commit();
      return { workflow, fns: { first: first.fn, middle: middle.fn, last: last.fn } };
    };

    const { original, restarted, fns } = await crashAndRestart(build, { n: 2 });

    expect(fns.first).not.toHaveBeenCalled();
    expect(fns.last).not.toHaveBeenCalled();
    expect(fns.middle).toHaveBeenCalledTimes(1);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  const foreachBuild =
    (concurrency: number) =>
    (crash?: Crash): Built => {
      let finished = 0;
      let twoDone!: () => void;
      const firstTwoFinished = new Promise<void>(resolve => (twoDone = resolve));
      let crashed!: () => void;
      const afterCrash = new Promise<void>(resolve => (crashed = resolve));
      const item = step('item', async ({ inputData }) => {
        if (crash && inputData >= 2) {
          // Items 0 and 1 finish; the process dies while later items are still running.
          await firstTwoFinished;
          if (inputData === 2) {
            await crash();
            crashed();
          }
          await afterCrash;
          return { doubled: inputData * 2 };
        }
        if (crash) {
          setTimeout(() => {
            if (++finished === 2) twoDone();
          }, 0);
        }
        return { doubled: inputData * 2 };
      });
      const total = step('total', async ({ inputData }) => ({
        total: inputData.reduce((sum: number, r: any) => sum + r.doubled, 0),
      }));
      const workflow = createWorkflow({
        id: `mid-foreach-${concurrency}`,
        inputSchema: anySchema,
        outputSchema: anySchema,
      })
        .foreach(item.step, { concurrency })
        .then(total.step)
        .commit();
      return { workflow, fns: { item: item.fn, total: total.fn } };
    };

  it.each([1, 3])(
    'does not re-run foreach items that finished before the crash (concurrency %i)',
    async concurrency => {
      const { original, restarted, stored, fns } = await crashAndRestart(foreachBuild(concurrency), [0, 1, 2, 3, 4]);

      const ranItems = fns.item.mock.calls.map(call => call[0].inputData).sort();
      expect(ranItems).toEqual([2, 3, 4]);
      expect(fns.total).toHaveBeenCalledTimes(1);
      expect(fns.total.mock.calls[0]![0].inputData).toEqual([0, 2, 4, 6, 8].map(doubled => ({ doubled })));
      expect(restarted.status).toBe('success');
      expect(restarted.result).toEqual(original.result);
      expect(restarted.steps.item.output).toEqual(original.steps.item.output);
      // Per-item progress is a crash-recovery record only; it must not survive into results.
      expect(JSON.stringify(restarted)).not.toContain('foreachProgress');
      expect(JSON.stringify(stored)).not.toContain('foreachProgress');
    },
  );
});
