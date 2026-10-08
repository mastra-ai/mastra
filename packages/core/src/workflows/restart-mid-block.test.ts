/**
 * Regression for https://github.com/mastra-ai/mastra/issues/26214
 *
 * #24615 covered a crash after a whole entry was saved. These tests cover a
 * crash while a `.parallel()` or `.foreach()` block is still running: arms and
 * items that already finished must not run again on `restart()`.
 *
 * Each test starts a real run, blocks one arm or item forever, copies the
 * checkpoint the engine had saved at that moment (the simulated crash), and
 * restarts from it in fresh storage with a freshly built workflow.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

const anySchema = z.any();

type Fn = (params: { inputData: any }) => Promise<any>;

function step(id: string, execute: Fn) {
  const fn = vi.fn(execute);
  return { fn, step: createStep({ id, inputSchema: anySchema, outputSchema: anySchema, execute: fn }) };
}

const never = () => new Promise<never>(() => {});
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * Runs `build()` once and returns the last checkpoint the engine saved after
 * `blocked()` reported that the blocked step was reached. The first run is left
 * hanging, like a process that was killed.
 */
async function crashedCheckpoint(build: () => any, inputData: unknown, blocked: () => boolean) {
  const first = build();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const store = (await storage.getStore('workflows'))!;
  const checkpoints: WorkflowRunState[] = [];
  const persist = store.persistWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    if (args.workflowName === first.workflow.id) checkpoints.push(JSON.parse(JSON.stringify(args.snapshot)));
    return persist(args);
  });
  const run = await first.workflow.createRun();
  void run.start({ inputData }).catch(() => {});
  await vi.waitFor(() => expect(blocked()).toBe(true));
  await settle();
  return { runId: run.runId, snapshot: checkpoints.at(-1)!, checkpoints };
}

async function restartFrom(build: () => any, runId: string, snapshot: WorkflowRunState) {
  const second = build();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { wf: second.workflow } });
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({ workflowName: second.workflow.id, runId, snapshot });
  const run = await second.workflow.createRun({ runId });
  const restarted = await run.restart();
  return { restarted, fns: second.fns };
}

describe('restart after a crash inside a parallel block', () => {
  const buildParallel =
    (blockedArm: 'p1' | 'p2', callsInFirstRun: string[] = []) =>
    () => {
      const start = step('start', async ({ inputData }) => ({ n: inputData.n }));
      const p1 = step('p1', async ({ inputData }) => {
        callsInFirstRun.push('p1');
        return blockedArm === 'p1' && !restarted ? never() : { p1: inputData.n + 1 };
      });
      const p2 = step('p2', async ({ inputData }) => {
        callsInFirstRun.push('p2');
        return blockedArm === 'p2' && !restarted ? never() : { p2: inputData.n + 2 };
      });
      const join = step('join', async ({ inputData }) => ({ sum: inputData.p1.p1 + inputData.p2.p2 }));
      const workflow = createWorkflow({ id: `parallel-${blockedArm}`, inputSchema: anySchema, outputSchema: anySchema })
        .then(start.step)
        .parallel([p1.step, p2.step])
        .then(join.step)
        .commit();
      return { workflow, fns: { start: start.fn, p1: p1.fn, p2: p2.fn, join: join.fn } };
    };
  let restarted = false;

  it.each(['p2', 'p1'] as const)('does not re-run the finished arm when %s was still running', async blockedArm => {
    restarted = false;
    const calls: string[] = [];
    const { runId, snapshot } = await crashedCheckpoint(
      buildParallel(blockedArm, calls),
      { n: 1 },
      () => calls.includes('p1') && calls.includes('p2'),
    );
    const finishedArm = blockedArm === 'p1' ? 'p2' : 'p1';
    expect(snapshot.context[finishedArm]?.status).toBe('success');
    expect(snapshot.context[blockedArm]?.status).toBe('running');

    restarted = true;
    const { restarted: result, fns } = await restartFrom(buildParallel(blockedArm), runId, snapshot);

    expect(fns[finishedArm]).not.toHaveBeenCalled();
    expect(fns[blockedArm]).toHaveBeenCalledTimes(1);
    expect(fns.join).toHaveBeenCalledTimes(1);
    expect(fns.join.mock.calls[0]![0].inputData).toEqual({ p1: { p1: 2 }, p2: { p2: 3 } });
    expect(result.status).toBe('success');
  });

  it('keeps every finished arm when two arms finish and a third is still running', async () => {
    let restartedRun = false;
    const calls: string[] = [];
    const build = () => {
      const arms = ['a', 'b', 'c'].map(id =>
        step(id, async () => {
          calls.push(id);
          return id === 'c' && !restartedRun ? never() : { [id]: true };
        }),
      );
      const workflow = createWorkflow({ id: 'parallel-three', inputSchema: anySchema, outputSchema: anySchema })
        .parallel(arms.map(a => a.step) as any)
        .commit();
      return { workflow, fns: Object.fromEntries(arms.map(a => [a.step.id, a.fn])) };
    };
    const { runId, snapshot } = await crashedCheckpoint(build, {}, () => calls.length === 3);
    expect(snapshot.context.a?.status).toBe('success');
    expect(snapshot.context.b?.status).toBe('success');
    expect(Object.keys(snapshot.activeStepsPath)).toEqual(['c']);

    restartedRun = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);
    expect(fns.a).not.toHaveBeenCalled();
    expect(fns.b).not.toHaveBeenCalled();
    expect(fns.c).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ a: { a: true }, b: { b: true }, c: { c: true } });
  });

  it('saves arm checkpoints in order when an earlier write is slow', async () => {
    const calls: string[] = [];
    const build = () => {
      const delays: Record<string, number> = { a: 0, b: 20, c: 0 };
      const arms = ['a', 'b', 'c'].map(id =>
        step(id, async () => {
          calls.push(id);
          if (id === 'c') return never();
          await new Promise(resolve => setTimeout(resolve, delays[id]));
          return { [id]: true };
        }),
      );
      const workflow = createWorkflow({ id: 'parallel-slow-write', inputSchema: anySchema, outputSchema: anySchema })
        .parallel(arms.map(a => a.step) as any)
        .commit();
      return { workflow, fns: {} };
    };
    const first = build();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    let slowed = false;
    let lastSaved: WorkflowRunState | undefined;
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      // Serialize at call time like a real store, so a late write carries older state.
      const snapshot = JSON.parse(JSON.stringify(args.snapshot)) as WorkflowRunState;
      // Slow down the first write that records arm a as finished.
      if (!slowed && snapshot.context.a?.status === 'success' && snapshot.context.b?.status !== 'success') {
        slowed = true;
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      await persist({ ...args, snapshot });
      lastSaved = snapshot;
    });
    const run = await first.workflow.createRun();
    void run.start({ inputData: {} }).catch(() => {});
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(slowed).toBe(true);
    expect(lastSaved!.context.a?.status).toBe('success');
    expect(lastSaved!.context.b?.status).toBe('success');
  });

  it('re-runs arms that an older snapshot only has as running', async () => {
    const build = () => {
      const p1 = step('p1', async () => ({ p1: 1 }));
      const p2 = step('p2', async () => ({ p2: 2 }));
      const workflow = createWorkflow({ id: 'parallel-old', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([p1.step, p2.step])
        .commit();
      return { workflow, fns: { p1: p1.fn, p2: p2.fn } };
    };
    const startedAt = Date.now();
    const runId = 'parallel-old-run';
    const { restarted: result, fns } = await restartFrom(build, runId, {
      runId,
      status: 'running',
      activePaths: [0],
      activeStepsPath: { p2: [0, 1] },
      value: {},
      context: {
        input: {},
        p1: { status: 'running', payload: {}, startedAt },
        p2: { status: 'running', payload: {}, startedAt },
      } as any,
      serializedStepGraph: build().workflow.serializedStepGraph,
      suspendedPaths: {},
      waitingPaths: {},
      resumeLabels: {},
      timestamp: startedAt,
    });
    expect(fns.p1).toHaveBeenCalledTimes(1);
    expect(fns.p2).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });

  it('does not re-run a finished nested workflow arm', async () => {
    let restartedRun = false;
    const calls: string[] = [];
    const build = () => {
      const inner = step('inner', async ({ inputData }) => {
        calls.push('inner');
        return { inner: inputData.n };
      });
      const nested = createWorkflow({ id: 'nested', inputSchema: anySchema, outputSchema: anySchema })
        .then(inner.step)
        .commit();
      const slow = step('slow', async () => {
        calls.push('slow');
        return restartedRun ? { slow: true } : never();
      });
      const workflow = createWorkflow({ id: 'parallel-nested', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([nested as any, slow.step])
        .commit();
      return { workflow, fns: { inner: inner.fn, slow: slow.fn } };
    };
    const { runId, snapshot } = await crashedCheckpoint(build, { n: 7 }, () => calls.includes('slow'));
    expect(snapshot.context.nested?.status).toBe('success');

    restartedRun = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);
    expect(fns.inner).not.toHaveBeenCalled();
    expect(fns.slow).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });
});

describe('restart after a crash inside a foreach block', () => {
  const buildForeach =
    (opts: { concurrency?: number; blockFrom: number }, state: { restarted: boolean; ran: number[] }) => () => {
      const list = step('list', async () => [0, 1, 2, 3, 4]);
      const charge = step('charge', async ({ inputData }) => {
        state.ran.push(inputData);
        if (!state.restarted && inputData >= opts.blockFrom) return never();
        return inputData === 3 ? undefined : { charged: inputData };
      });
      const workflow = createWorkflow({ id: 'foreach-restart', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: opts.concurrency ?? 1 })
        .commit();
      return { workflow, fns: { list: list.fn, charge: charge.fn } };
    };

  it('continues from the first unfinished item and keeps earlier results', async () => {
    const state = { restarted: false, ran: [] as number[] };
    const build = buildForeach({ blockFrom: 2 }, state);
    const { runId, snapshot } = await crashedCheckpoint(build, {}, () => state.ran.includes(2));

    state.restarted = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);

    expect(fns.charge.mock.calls.map(c => c[0].inputData)).toEqual([2, 3, 4]);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual([{ charged: 0 }, { charged: 1 }, { charged: 2 }, undefined, { charged: 4 }]);
  });

  it('skips finished items under concurrency when they finished out of order', async () => {
    const state = { restarted: false, ran: [] as number[] };
    // items 0 and 3 stay in flight, 1 and 2 finish
    const build = () => {
      const list = step('list', async () => [0, 1, 2, 3, 4]);
      const charge = step('charge', async ({ inputData }) => {
        state.ran.push(inputData);
        if (!state.restarted && (inputData === 0 || inputData === 3)) return never();
        return { charged: inputData };
      });
      const workflow = createWorkflow({ id: 'foreach-concurrent', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: 4 })
        .commit();
      return { workflow, fns: { list: list.fn, charge: charge.fn } };
    };
    const { runId, snapshot } = await crashedCheckpoint(build, {}, () => state.ran.length === 5);

    state.restarted = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);

    expect(fns.charge.mock.calls.map(c => c[0].inputData).sort()).toEqual([0, 3]);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual([0, 1, 2, 3, 4].map(n => ({ charged: n })));
  });

  it('does not re-run a finished item whose step is a nested workflow', async () => {
    const state = { restarted: false, ran: [] as number[] };
    const build = () => {
      const list = step('list', async () => [0, 1, 2]);
      const inner = step('inner', async ({ inputData }) => {
        state.ran.push(inputData);
        if (!state.restarted && inputData === 1) return never();
        return { charged: inputData };
      });
      const nested = createWorkflow({ id: 'nested-charge', inputSchema: anySchema, outputSchema: anySchema })
        .then(inner.step)
        .commit();
      const workflow = createWorkflow({ id: 'foreach-nested', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(nested as any, { concurrency: 1 })
        .commit();
      return { workflow, fns: { inner: inner.fn } };
    };
    const { runId, snapshot } = await crashedCheckpoint(build, {}, () => state.ran.includes(1));

    state.restarted = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);

    // Restarting the item that was in flight is a separate, existing limitation for nested
    // workflow items (their run is not active in the new process), so only check item 0.
    expect(fns.inner.mock.calls.map(c => c[0].inputData)).not.toContain(0);
    expect(result.steps['nested-charge'].suspendPayload.__workflow_meta.foreachOutput[0].output).toEqual({
      charged: 0,
    });
  });

  it('does not use a checkpoint left by an earlier run of the same foreach when it runs again', async () => {
    const ran: number[] = [];
    const list = step('list', async () => [0, 1]);
    const charge = step('charge', async ({ inputData }) => {
      ran.push(inputData);
      return { charged: inputData };
    });
    const workflow = createWorkflow({ id: 'foreach-twice', inputSchema: anySchema, outputSchema: anySchema })
      .then(list.step)
      .foreach(charge.step)
      .then(list.step)
      .foreach(charge.step)
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { wf: workflow } });
    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('success');
    expect(ran).toEqual([0, 1, 0, 1]);
  });
});
