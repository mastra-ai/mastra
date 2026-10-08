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
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
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

describe('foreach checkpoint write budget', () => {
  it.each([100, 200])('bounds accumulated snapshot bytes for %i caller-supplied items', async count => {
    const budget = 32 * 1024;
    const charge = step('charge', async ({ inputData }) => ({ charged: inputData, receipt: 'x'.repeat(512) }));
    const workflow = createWorkflow({
      id: 'foreach-budget',
      inputSchema: anySchema,
      outputSchema: anySchema,
      options: { maxForeachCheckpointBytes: budget },
    })
      .foreach(charge.step, { concurrency: 1 })
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { workflow } });
    const store = (await storage.getStore('workflows'))!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    let checkpointBytes = 0;
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.snapshot.status === 'running' && args.snapshot.context.charge?.status === 'running') {
        checkpointBytes += Buffer.byteLength(JSON.stringify(args.snapshot), 'utf8');
      }
      return persist(args);
    });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: Array.from({ length: count }, (_, i) => i) });

    expect(checkpointBytes).toBeLessThanOrEqual(budget);
    expect(checkpointBytes).toBeGreaterThan(0);
    expect(result.status).toBe('failed');
    expect((result as any).error.message).toContain('maxForeachCheckpointBytes');
    expect(charge.fn.mock.calls.length).toBeLessThan(count);
    const saved = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(saved?.status).toBe('failed');
    const finished = saved!.context.charge.suspendPayload.__workflow_meta.foreachOutput;
    for (const [{ inputData }] of charge.fn.mock.calls) {
      expect(finished[inputData]).toMatchObject({ status: 'success', output: { charged: inputData } });
    }

    // A trusted operator can raise the budget and retry without charging finished items again.
    workflow.executionEngine.options.maxForeachCheckpointBytes = 64 * 1024 * 1024;
    const restarted = await run.timeTravel({ step: 'charge' });
    expect(restarted.status, String((restarted as any).error?.message)).toBe('success');
    expect(charge.fn.mock.calls.map(([{ inputData }]) => inputData)).toEqual(
      Array.from({ length: count }, (_, i) => i),
    );
  });
});

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

/**
 * Starts `build()` with a store that serializes every snapshot when the write is called (like a
 * real store) and lets `intercept` delay or fail a write. Returns what the store ended up holding.
 */
async function runWithInterceptedStore(
  build: () => any,
  intercept: (snapshot: WorkflowRunState, index: number) => Promise<void> | void,
) {
  const first = build();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const store = (await storage.getStore('workflows'))!;
  const persist = store.persistWorkflowSnapshot.bind(store);
  const writes: WorkflowRunState[] = [];
  let stored: WorkflowRunState | undefined;
  let index = 0;
  vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    const snapshot = JSON.parse(JSON.stringify(args.snapshot)) as WorkflowRunState;
    writes.push(snapshot);
    await intercept(snapshot, index++);
    await persist({ ...args, snapshot });
    stored = snapshot;
  });
  const run = await first.workflow.createRun();
  const result = run.start({ inputData: {} }).catch(() => undefined);
  return { runId: run.runId, result, writes, stored: () => stored };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('checkpoint writes are ordered with the step start writes', () => {
  it('parallel: a slow start write of one arm cannot revert a finished sibling to running', async () => {
    let releaseA!: () => void;
    const gateA = new Promise<void>(resolve => (releaseA = resolve));
    const calls: string[] = [];
    const build = () => {
      const a = step('a', async () => {
        calls.push('a');
        await gateA;
        return { a: true };
      });
      const b = step('b', async () => {
        calls.push('b');
        return never();
      });
      const workflow = createWorkflow({ id: 'order-parallel', inputSchema: anySchema, outputSchema: anySchema })
        .parallel([a.step, b.step])
        .commit();
      return { workflow, fns: {} };
    };
    // writes: 0 pending, 1 start of a, 2 start of b (delayed), then a's checkpoint
    const { stored } = await runWithInterceptedStore(build, async (_snapshot, index) => {
      if (index === 2) {
        releaseA();
        await sleep(150);
      }
    });
    await vi.waitFor(() => expect(calls).toEqual(['a', 'b']));
    await sleep(400);

    expect(stored()!.context.a?.status).toBe('success');
    expect(stored()!.context.b?.status).toBe('running');
  });

  it('foreach: a slow start write of one item cannot drop a finished sibling', async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>(resolve => (releaseFirst = resolve));
    const started: number[] = [];
    const build = () => {
      const list = step('list', async () => [0, 1]);
      const charge = step('charge', async ({ inputData }) => {
        started.push(inputData);
        if (inputData === 0) {
          await gate;
          return { charged: 0 };
        }
        return never();
      });
      const workflow = createWorkflow({ id: 'order-foreach', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: 2 })
        .commit();
      return { workflow, fns: {} };
    };
    // writes: 0 pending, 1 start of list, 2 end of list, 3 start of item 0, 4 start of item 1 (delayed)
    const { stored, writes } = await runWithInterceptedStore(build, async (snapshot, index) => {
      if (index === 4) {
        expect(snapshot.context.charge?.status).toBe('running');
        releaseFirst();
        await sleep(150);
      }
    });
    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    await sleep(400);

    expect(writes.length).toBeGreaterThan(5);
    const foreachOutput = (stored()!.context.charge as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
    expect(foreachOutput?.[0]?.status).toBe('success');
  });

  it('foreach: a start write prepared before a sibling finished still keeps that sibling', async () => {
    let releaseStartup!: () => void;
    const startupGate = new Promise<void>(resolve => (releaseStartup = resolve));
    const started: number[] = [];
    const state = { restarted: false };
    const build = () => {
      const list = step('list', async () => [0, 1]);
      const charge = step('charge', async ({ inputData }) => {
        started.push(inputData);
        return inputData === 0 || state.restarted ? { charged: inputData } : never();
      });
      const workflow = createWorkflow({ id: 'order-startup', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: 2 })
        .commit();
      return { workflow, fns: { charge: charge.fn } };
    };
    // Hold item 1 in its startup hook, after the step has looked at the shared foreach state.
    const original = DefaultExecutionEngine.prototype.onStepExecutionStart;
    const hook = vi.spyOn(DefaultExecutionEngine.prototype, 'onStepExecutionStart').mockImplementation(async function (
      this: DefaultExecutionEngine,
      params: any,
    ) {
      if (params.executionContext.foreachIndex === 1) await startupGate;
      return original.call(this, params);
    });
    try {
      const { runId, stored, writes } = await runWithInterceptedStore(build, snapshot => {
        const output = (snapshot.context.charge as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
        // item 0 has finished and been saved: let item 1 continue
        if (output?.[0]?.status === 'success') releaseStartup();
      });
      await vi.waitFor(() => expect(started).toEqual([0, 1]));
      await sleep(300);

      const foreachOutput = (stored()!.context.charge as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
      expect(writes.length).toBeGreaterThan(4);
      expect(foreachOutput?.[0]?.status).toBe('success');

      hook.mockRestore();
      state.restarted = true;
      const { restarted: result, fns } = await restartFrom(build, runId, stored()!);

      expect(fns.charge.mock.calls.map(c => c[0].inputData)).toEqual([1]);
      expect(result.status).toBe('success');
      expect((result as any).result).toEqual([{ charged: 0 }, { charged: 1 }]);
    } finally {
      hook.mockRestore();
      releaseStartup();
    }
  });

  it('foreach: a start write made while a sibling success is being reported keeps all finished items', async () => {
    const gate = () => {
      let release!: () => void;
      const promise = new Promise<void>(resolve => (release = resolve));
      return { promise, release };
    };
    const item1Work = gate();
    const item2Startup = gate();
    const item1Progress = gate();
    let item2StartupEntered = false;
    let item1ProgressHeld = false;
    const state = { restarted: false };
    const build = () => {
      const list = step('list', async () => [0, 1, 2]);
      const charge = step('charge', async ({ inputData }) => {
        if (state.restarted) return { charged: inputData };
        if (inputData === 1) await item1Work.promise;
        return inputData === 2 ? never() : { charged: inputData };
      });
      const workflow = createWorkflow({ id: 'order-progress', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: 2 })
        .commit();
      return { workflow, fns: { charge: charge.fn } };
    };
    const originalStart = DefaultExecutionEngine.prototype.onStepExecutionStart;
    const startHook = vi
      .spyOn(DefaultExecutionEngine.prototype, 'onStepExecutionStart')
      .mockImplementation(async function (this: DefaultExecutionEngine, params: any) {
        if (params.executionContext.foreachIndex === 2) {
          item2StartupEntered = true;
          await item2Startup.promise;
        }
        return originalStart.call(this, params);
      });
    const originalPublish = EventEmitterPubSub.prototype.publish;
    const publishHook = vi.spyOn(EventEmitterPubSub.prototype, 'publish').mockImplementation(async function (
      this: EventEmitterPubSub,
      ...args: any[]
    ) {
      const data = args[1]?.data;
      if (data?.type === 'workflow-step-progress' && data.payload.currentIndex === 1) {
        item1ProgressHeld = true;
        await item1Progress.promise;
      }
      return (originalPublish as any).apply(this, args);
    });
    try {
      const { runId, stored } = await runWithInterceptedStore(build, () => {});
      // item 0 is finished and saved once item 2 is picked up; item 1 then finishes but its report is held
      await vi.waitFor(() => expect(item2StartupEntered).toBe(true));
      item1Work.release();
      await vi.waitFor(() => expect(item1ProgressHeld).toBe(true));
      item2Startup.release();
      await sleep(300);
      const snapshot = JSON.parse(JSON.stringify(stored()!)) as WorkflowRunState;
      item1Progress.release();

      const foreachOutput = (snapshot.context.charge as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
      expect(foreachOutput?.[0]?.status).toBe('success');
      expect(foreachOutput?.[1]?.status).toBe('success');

      startHook.mockRestore();
      publishHook.mockRestore();
      state.restarted = true;
      const { restarted: result, fns } = await restartFrom(build, runId, snapshot);
      expect(fns.charge.mock.calls.map(c => c[0].inputData)).toEqual([2]);
      expect(result.status).toBe('success');
    } finally {
      startHook.mockRestore();
      publishHook.mockRestore();
      item1Work.release();
      item2Startup.release();
      item1Progress.release();
    }
  });

  it.each(['failed', 'suspended'] as const)(
    'foreach: a start write made while a %s sibling is being reported keeps the finished items',
    async outcome => {
      const gate = () => {
        let release!: () => void;
        const promise = new Promise<void>(resolve => (release = resolve));
        return { promise, release };
      };
      const item1Work = gate();
      const item2Startup = gate();
      const item1Progress = gate();
      let item2StartupEntered = false;
      let item1ProgressHeld = false;
      const state = { restarted: false };
      const build = () => {
        const list = step('list', async () => [0, 1, 2]);
        const execute = vi.fn(async ({ inputData, suspend }: any) => {
          if (state.restarted) return { charged: inputData };
          if (inputData === 1) {
            await item1Work.promise;
            if (outcome === 'failed') throw new Error('card declined');
            return suspend({ reason: 'needs approval' });
          }
          return inputData === 2 ? never() : { charged: inputData };
        });
        const charge = createStep({ id: 'charge', inputSchema: anySchema, outputSchema: anySchema, execute });
        const workflow = createWorkflow({ id: `order-${outcome}`, inputSchema: anySchema, outputSchema: anySchema })
          .then(list.step)
          .foreach(charge, { concurrency: 2 })
          .commit();
        return { workflow, fns: { charge: execute } };
      };
      const originalStart = DefaultExecutionEngine.prototype.onStepExecutionStart;
      const startHook = vi
        .spyOn(DefaultExecutionEngine.prototype, 'onStepExecutionStart')
        .mockImplementation(async function (this: DefaultExecutionEngine, params: any) {
          if (params.executionContext.foreachIndex === 2) {
            item2StartupEntered = true;
            await item2Startup.promise;
          }
          return originalStart.call(this, params);
        });
      const originalPublish = EventEmitterPubSub.prototype.publish;
      const publishHook = vi.spyOn(EventEmitterPubSub.prototype, 'publish').mockImplementation(async function (
        this: EventEmitterPubSub,
        ...args: any[]
      ) {
        const data = args[1]?.data;
        if (data?.type === 'workflow-step-progress' && data.payload.currentIndex === 1) {
          item1ProgressHeld = true;
          await item1Progress.promise;
        }
        return (originalPublish as any).apply(this, args);
      });
      try {
        const { runId, stored } = await runWithInterceptedStore(build, () => {});
        // item 0 is finished and saved once item 2 is picked up; item 1 then ends but its report is held
        await vi.waitFor(() => expect(item2StartupEntered).toBe(true));
        item1Work.release();
        await vi.waitFor(() => expect(item1ProgressHeld).toBe(true));
        item2Startup.release();
        await sleep(300);
        const snapshot = JSON.parse(JSON.stringify(stored()!)) as WorkflowRunState;
        item1Progress.release();

        const foreachOutput = (snapshot.context.charge as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
        expect(foreachOutput?.[0]?.status).toBe('success');

        startHook.mockRestore();
        publishHook.mockRestore();
        state.restarted = true;
        const { restarted: result, fns } = await restartFrom(build, runId, snapshot);
        expect(fns.charge.mock.calls.map(c => c[0].inputData)).toEqual([1, 2]);
        expect(result.status).toBe('success');
      } finally {
        startHook.mockRestore();
        publishHook.mockRestore();
        item1Work.release();
        item2Startup.release();
        item1Progress.release();
      }
    },
  );

  it.each(['failed', 'suspended'] as const)(
    'foreach: a %s item still ends the block that way when a sibling starts while it is reported',
    async outcome => {
      let releaseItem1!: () => void;
      const item1Work = new Promise<void>(resolve => (releaseItem1 = resolve));
      let releaseProgress!: () => void;
      const item1Progress = new Promise<void>(resolve => (releaseProgress = resolve));
      let resumed = false;
      const execute = vi.fn(async ({ inputData, suspend, resumeData }: any) => {
        if (inputData === 1) {
          if (resumeData) return { charged: 1, approved: resumeData.approved };
          await item1Work;
          if (outcome === 'failed') throw new Error('card declined');
          return suspend({ reason: 'needs approval' });
        }
        return { charged: inputData };
      });
      const charge = createStep({ id: 'charge', inputSchema: anySchema, outputSchema: anySchema, execute });
      const list = step('list', async () => [0, 1, 2]);
      const workflow = createWorkflow({ id: `final-${outcome}`, inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge, { concurrency: 2 })
        .commit();
      new Mastra({ logger: false, storage: new MockStore(), workflows: { wf: workflow } });

      // item 2 is held at startup until item 1 has ended and its report is held
      const originalStart = DefaultExecutionEngine.prototype.onStepExecutionStart;
      const startHook = vi
        .spyOn(DefaultExecutionEngine.prototype, 'onStepExecutionStart')
        .mockImplementation(async function (this: DefaultExecutionEngine, params: any) {
          if (params.executionContext.foreachIndex === 2 && !resumed) {
            releaseItem1();
            await vi.waitFor(() => expect(progressHeld).toBe(true));
            setTimeout(releaseProgress, 50);
          }
          return originalStart.call(this, params);
        });
      let progressHeld = false;
      const originalPublish = EventEmitterPubSub.prototype.publish;
      const publishHook = vi.spyOn(EventEmitterPubSub.prototype, 'publish').mockImplementation(async function (
        this: EventEmitterPubSub,
        ...args: any[]
      ) {
        const data = args[1]?.data;
        if (data?.type === 'workflow-step-progress' && data.payload.currentIndex === 1 && !resumed) {
          progressHeld = true;
          await item1Progress;
        }
        return (originalPublish as any).apply(this, args);
      });
      try {
        const run = await workflow.createRun();
        const result: any = await run.start({ inputData: {} });
        const charged = result.steps.charge;
        const foreachOutput = charged.suspendPayload.__workflow_meta.foreachOutput;
        expect(result.status).toBe(outcome);
        expect(charged.status).toBe(outcome);
        expect(foreachOutput[0].status).toBe('success');
        expect(foreachOutput[1].status).toBe(outcome);
        expect(foreachOutput[2].status).toBe('success');
        if (outcome === 'failed') {
          expect(charged.error.message).toBe('card declined');
          return;
        }
        expect(charged.suspendPayload.reason).toBe('needs approval');
        expect(charged.suspendPayload.__workflow_meta.foreachIndex).toBe(1);
        expect(foreachOutput[1].suspendPayload.reason).toBe('needs approval');

        resumed = true;
        execute.mockClear();
        const resumedResult: any = await run.resume({ step: 'charge', resumeData: { approved: true } });
        expect(execute.mock.calls.map(c => c[0].inputData)).toEqual([1]);
        expect(resumedResult.status).toBe('success');
        expect(resumedResult.result).toEqual([{ charged: 0 }, { charged: 1, approved: true }, { charged: 2 }]);
      } finally {
        startHook.mockRestore();
        publishHook.mockRestore();
        releaseItem1();
        releaseProgress();
      }
    },
  );

  it.each(['dispatch', 'start checkpoint'])(
    'parallel: saves late sibling success after a %s rejection before propagating the failure',
    async failureKind => {
      let releaseA!: () => void;
      const gateA = new Promise<void>(resolve => (releaseA = resolve));
      let sawFailure = false;
      let restarted = false;
      let propagatedError: unknown;
      const failure = new Error('child dispatch or storage unavailable');
      const build = () => {
        const a = step('a', async () => {
          await gateA;
          return { a: true };
        });
        const b = step('b', async () => ({ b: true }));
        const workflow = createWorkflow({ id: 'order-failed', inputSchema: anySchema, outputSchema: anySchema })
          .parallel([a.step, b.step])
          .commit();
        const execute = workflow.executionEngine.executeStep.bind(workflow.executionEngine);
        vi.spyOn(workflow.executionEngine, 'executeStep').mockImplementation(async params => {
          if (!restarted && failureKind === 'dispatch' && params.step.id === 'b') {
            sawFailure = true;
            throw failure;
          }
          return execute(params);
        });
        const parallel = workflow.executionEngine.executeParallel.bind(workflow.executionEngine);
        vi.spyOn(workflow.executionEngine, 'executeParallel').mockImplementation(async params => {
          try {
            return await parallel(params);
          } catch (error) {
            propagatedError = error;
            throw error;
          }
        });
        return { workflow, fns: { a: a.fn, b: b.fn } };
      };
      const { runId, writes, result, stored } = await runWithInterceptedStore(build, async (_snapshot, index) => {
        if (failureKind === 'start checkpoint' && index === 2) {
          sawFailure = true;
          throw failure;
        }
      });
      let returned = false;
      void result.then(() => (returned = true));
      try {
        await vi.waitFor(() => expect(sawFailure).toBe(true));
        await sleep(50);
        expect(returned).toBe(false);
        releaseA();
        await result;
        expect(propagatedError).toBe(failure);
        await sleep(50);
        expect(stored()!.context.a?.status).toBe('success');
        const writesAtFailure = writes.length;
        await sleep(50);
        expect(writes).toHaveLength(writesAtFailure);

        restarted = true;
        const recovery = await restartFrom(build, runId, stored()!);
        expect(recovery.restarted.status).toBe('success');
        expect(recovery.fns.a).not.toHaveBeenCalled();
        expect(recovery.fns.b).toHaveBeenCalledTimes(1);
      } finally {
        releaseA();
      }
    },
  );
});

describe('restart when a foreach item with an undefined output finished before the crash', () => {
  it('keeps the undefined result and continues after it', async () => {
    const state = { restarted: false, ran: [] as number[] };
    const build = () => {
      const list = step('list', async () => [0, 1, 2]);
      const charge = step('charge', async ({ inputData }) => {
        state.ran.push(inputData);
        if (!state.restarted && inputData === 2) return never();
        return inputData === 1 ? undefined : { charged: inputData };
      });
      const workflow = createWorkflow({ id: 'foreach-undefined', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(charge.step, { concurrency: 1 })
        .commit();
      return { workflow, fns: { charge: charge.fn } };
    };
    const { runId, snapshot } = await crashedCheckpoint(build, {}, () => state.ran.includes(2));
    const saved = (snapshot.context.charge as any).suspendPayload.__workflow_meta.foreachOutput;
    expect(saved[1].status).toBe('success');

    state.restarted = true;
    const { restarted: result, fns } = await restartFrom(build, runId, snapshot);

    expect(fns.charge.mock.calls.map(c => c[0].inputData)).toEqual([2]);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual([{ charged: 0 }, undefined, { charged: 2 }]);
  });
});
