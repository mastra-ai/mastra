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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import { FOREACH_CHECKPOINT_INTERVAL_MS } from './handlers/control-flow';
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
const settle = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

async function crashAndRestart(build: (crash?: Crash) => Built, inputData: unknown, crashAfterMs?: number) {
  const storage = new MockStore();
  let crashSnapshot: WorkflowRunState | undefined;
  let latest: WorkflowRunState | undefined;
  const crash: Crash = async () => {
    await settle(crashAfterMs);
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
      // Crash once the checkpoint interval has passed, so every finished item has been checkpointed.
      const { original, restarted, stored, fns } = await crashAndRestart(
        foreachBuild(concurrency),
        [0, 1, 2, 3, 4],
        FOREACH_CHECKPOINT_INTERVAL_MS + 200,
      );

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

  it('re-runs items that finished within the last checkpoint interval before the crash', async () => {
    // Item 0 is checkpointed at once; item 1 waits for the next interval, and the crash comes first.
    const { restarted, fns } = await crashAndRestart(foreachBuild(1), [0, 1, 2, 3, 4]);

    expect(fns.item.mock.calls.map(call => call[0].inputData).sort()).toEqual([1, 2, 3, 4]);
    expect(restarted.status).toBe('success');
  });

  it('keeps foreach snapshot writes linear in the number of items', async () => {
    const storage = new MockStore();
    const payload = 'x'.repeat(1000);
    const item = step('item', async ({ inputData }) => ({ i: inputData, payload }));
    const workflow = createWorkflow({ id: 'foreach-write-volume', inputSchema: anySchema, outputSchema: anySchema })
      .foreach(item.step, { concurrency: 1 })
      .commit();
    new Mastra({ logger: false, storage, workflows: { wf: workflow } });
    const store = (await storage.getStore('workflows'))!;
    let bytes = 0;
    const persist = store.persistWorkflowSnapshot.bind(store);
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      bytes += JSON.stringify(args.snapshot).length;
      return persist(args);
    });

    const items = 200;
    const result = await (await workflow.createRun()).start({ inputData: Array.from({ length: items }, (_, i) => i) });

    expect(result.status).toBe('success');
    // Rewriting every finished output on each item would be ~items^2 / 2 * 1000 bytes (~20 MB).
    expect(bytes).toBeLessThan(10 * items * payload.length);
  });

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('foreach item-end checkpoints', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function setup(concurrency: number) {
      const storage = new MockStore();
      const item = step('item', async ({ inputData }) => ({ doubled: inputData * 2 }));
      const workflow = createWorkflow({ id: 'foreach-checkpoints', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(item.step, { concurrency })
        .commit();
      new Mastra({ logger: false, storage, workflows: { wf: workflow } });
      const store = (await storage.getStore('workflows'))!;
      return { workflow, store };
    }

    it('never lets an older checkpoint overwrite one with more finished items', async () => {
      const { workflow, store } = await setup(3);

      // Storage that applies each write when it resolves, and resolves later writes first,
      // the way concurrent upserts on a pooled connection can land.
      const persist = store.persistWorkflowSnapshot.bind(store);
      const applied: WorkflowRunState[] = [];
      let calls = 0;
      vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
        const snapshot = JSON.parse(JSON.stringify(args.snapshot));
        await sleep(Math.max(0, 40 - 10 * calls++));
        applied.push(snapshot);
        return persist({ ...args, snapshot });
      });
      // Stretch the window between an item finishing and its progress being recorded,
      // and between a sibling starting and its item-start write.
      const publish = EventEmitterPubSub.prototype.publish;
      vi.spyOn(EventEmitterPubSub.prototype, 'publish').mockImplementation(async function (
        this: EventEmitterPubSub,
        topic,
        event: any,
        options,
      ) {
        const payload = event?.data?.payload;
        if (event?.data?.type === 'workflow-step-progress' && payload?.currentIndex === 0) await sleep(40);
        return publish.call(this, topic, event, options);
      });
      const onStart = DefaultExecutionEngine.prototype.onStepExecutionStart;
      vi.spyOn(DefaultExecutionEngine.prototype, 'onStepExecutionStart').mockImplementation(
        async function (this: DefaultExecutionEngine, params) {
          if (params.executionContext.foreachIndex === 2) await sleep(20);
          return onStart.call(this, params);
        },
      );

      const result = await (await workflow.createRun()).start({ inputData: [0, 1, 2, 3] });
      expect(result.status).toBe('success');

      const recorded = new Set<string>();
      for (const snapshot of applied) {
        const foreach = snapshot.context.item;
        if (snapshot.status !== 'running' || foreach?.status !== 'running') continue;
        const keys = Object.keys((foreach.metadata?.foreachProgress as object | undefined) ?? {});
        expect(keys, 'a later checkpoint dropped finished items').toEqual(expect.arrayContaining([...recorded]));
        keys.forEach(key => recorded.add(key));
      }
      expect(recorded.size).toBeGreaterThan(0);
    });

    it('never lets a sibling arm start write overwrite a finished parallel arm', async () => {
      const storage = new MockStore();
      const fast = step('fast', async () => ({ fast: 1 }));
      const slow = step('slow', async () => {
        await sleep(100);
        return { slow: 2 };
      });
      const workflow = createWorkflow({ id: 'parallel-checkpoints', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([fast.step, slow.step])
        .commit();
      new Mastra({ logger: false, storage, workflows: { wf: workflow } });
      const store = (await storage.getStore('workflows'))!;

      // Storage that is slow to apply the slow arm's start write. That write carries a copy of the
      // results taken before the fast arm finished, so without ordering it lands after the fast
      // arm's end write and erases it.
      const persist = store.persistWorkflowSnapshot.bind(store);
      const applied: WorkflowRunState[] = [];
      vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
        const snapshot = JSON.parse(JSON.stringify(args.snapshot));
        if (snapshot.context.slow?.status === 'running' && snapshot.context.fast?.status !== 'success') await sleep(60);
        applied.push(snapshot);
        return persist({ ...args, snapshot });
      });

      const result = await (await workflow.createRun()).start({ inputData: {} });
      expect(result.status).toBe('success');

      let fastRecorded = false;
      for (const snapshot of applied) {
        if (snapshot.status !== 'running') continue;
        const finished = snapshot.context.fast?.status === 'success';
        if (fastRecorded) expect(finished, 'a later write dropped the finished arm').toBe(true);
        fastRecorded ||= finished;
      }
      expect(fastRecorded).toBe(true);
    });

    it('waits for every checkpoint write and clears the active path when one fails', async () => {
      const { workflow } = await setup(2);
      const errorChildSpan = vi.spyOn(DefaultExecutionEngine.prototype, 'errorChildSpan');

      let pending = 0;
      let foreachContext: { activeStepsPath: Record<string, number[]> } | undefined;
      let itemEndWrites = 0;
      const persistStepUpdate = DefaultExecutionEngine.prototype.persistStepUpdate;
      vi.spyOn(DefaultExecutionEngine.prototype, 'persistStepUpdate').mockImplementation(
        async function (this: DefaultExecutionEngine, params) {
          if (!params.phase?.startsWith('foreach-item-end.')) return persistStepUpdate.call(this, params);
          foreachContext = params.executionContext;
          const n = itemEndWrites++;
          pending++;
          try {
            // The first checkpoint fails at once while any later one is still being written.
            await sleep(n === 0 ? 0 : 100);
            if (n === 0) throw new Error('checkpoint write failed');
            return await persistStepUpdate.call(this, params);
          } finally {
            pending--;
          }
        },
      );

      await expect((await workflow.createRun()).start({ inputData: [0, 1, 2, 3] })).rejects.toThrow(
        'checkpoint write failed',
      );

      expect(pending, 'the foreach returned with a checkpoint write still in flight').toBe(0);
      expect(foreachContext!.activeStepsPath).not.toHaveProperty('item');
      expect(errorChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: expect.stringContaining('.foreach.') }),
      );
    });
  });

  describe('per-run queue for foreach snapshot writes', () => {
    // Every foreach item-start and item-end write of a run goes through one queue; these
    // pin that suspend/resume and nested foreach still finish rather than wait on it.
    it('suspends and resumes items inside a foreach while sibling items finish', async () => {
      const storage = new MockStore();
      const item = createStep({
        id: 'item',
        inputSchema: anySchema,
        outputSchema: anySchema,
        resumeSchema: anySchema,
        execute: async ({ inputData, resumeData, suspend }) => {
          if (inputData % 2 === 1 && !resumeData) return suspend({ waiting: inputData });
          return { value: inputData, approved: resumeData?.ok ?? null };
        },
      });
      const workflow = createWorkflow({ id: 'foreach-queue-suspend', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(item, { concurrency: 3 })
        .commit();
      new Mastra({ logger: false, storage, workflows: { wf: workflow } });

      const run = await workflow.createRun();
      const first = await run.start({ inputData: [0, 1, 2, 3, 4] });
      expect(first.status).toBe('suspended');

      let result: any = first;
      for (const forEachIndex of [1, 3]) {
        result = await run.resume({ step: 'item', forEachIndex, resumeData: { ok: true } });
      }

      expect(result.status).toBe('success');
      expect(result.result).toEqual([
        { value: 0, approved: null },
        { value: 1, approved: true },
        { value: 2, approved: null },
        { value: 3, approved: true },
        { value: 4, approved: null },
      ]);
    });

    it('resumes suspended items with their suspend payload after a process restart', async () => {
      const storage = new MockStore();
      const seen: Record<number, unknown> = {};
      const build = () => {
        const item = createStep({
          id: 'item',
          inputSchema: anySchema,
          outputSchema: anySchema,
          resumeSchema: anySchema,
          suspendSchema: anySchema,
          execute: async ({ inputData, resumeData, suspendData, suspend }) => {
            if (inputData % 2 === 1 && !resumeData) return suspend({ waiting: inputData });
            if (resumeData) seen[inputData] = suspendData;
            return { value: inputData, approved: resumeData?.ok ?? null };
          },
        });
        const workflow = createWorkflow({
          id: 'foreach-restart-suspend',
          inputSchema: anySchema,
          outputSchema: anySchema,
        })
          .foreach(item, { concurrency: 3 })
          .commit();
        new Mastra({ logger: false, storage, workflows: { wf: workflow } });
        return workflow;
      };

      const firstProcess = await build().createRun();
      expect((await firstProcess.start({ inputData: [0, 1, 2, 3, 4] })).status).toBe('suspended');

      // A fresh workflow and Mastra instance only see what was persisted.
      const run = await build().createRun({ runId: firstProcess.runId });
      let result: any;
      for (const forEachIndex of [3, 1]) {
        result = await run.resume({ step: 'item', forEachIndex, resumeData: { ok: true } });
      }

      expect(seen).toEqual({ 1: { waiting: 1 }, 3: { waiting: 3 } });
      expect(result.status).toBe('success');
      expect(result.result).toEqual([
        { value: 0, approved: null },
        { value: 1, approved: true },
        { value: 2, approved: null },
        { value: 3, approved: true },
        { value: 4, approved: null },
      ]);
    });

    it('runs a foreach whose items are nested workflows with their own foreach', async () => {
      const storage = new MockStore();
      const inner = step('inner', async ({ inputData }) => {
        await sleep(5);
        return inputData * 2;
      });
      const nested = createWorkflow({ id: 'nested-foreach', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(inner.step, { concurrency: 2 })
        .commit();
      const workflow = createWorkflow({ id: 'outer-foreach', inputSchema: anySchema, outputSchema: anySchema })
        .foreach(nested, { concurrency: 3 })
        .commit();
      new Mastra({ logger: false, storage, workflows: { wf: workflow } });

      const result: any = await (
        await workflow.createRun()
      ).start({
        inputData: [[1, 2, 3], [4, 5], [6, 7, 8, 9], [10]],
      });

      expect(result.status).toBe('success');
      expect(result.result).toEqual([[2, 4, 6], [8, 10], [12, 14, 16, 18], [20]]);
      expect(inner.fn).toHaveBeenCalledTimes(10);
    });
  });
});
