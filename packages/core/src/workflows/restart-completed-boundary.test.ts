/**
 * Regression for https://github.com/mastra-ai/mastra/issues/24615
 *
 * The default engine checkpoints each top-level entry when it starts and again
 * when it finishes. The finish checkpoint records the entry's result but still
 * points at that entry; the pointer only moves when the next entry starts. A
 * crash between the two left `restart()` re-running a step whose result was
 * already saved — for a parallel block, branch, loop, or foreach, every arm,
 * iteration, or item of it.
 *
 * These tests run each workflow once, keep the real checkpoint written right
 * after the entry under test finished, and restart from it in a fresh process.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { pruneAgentLoopSnapshot } from '../loop/workflows/prune-snapshot';
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

type Built = { workflow: any; fns: Record<string, ReturnType<typeof vi.fn>> };

/** Collects deep copies of every snapshot the workflow persists for itself (not nested runs). */
async function captureCheckpoints(
  storage: InstanceType<typeof MockStore>,
  workflowId: string,
): Promise<WorkflowRunState[]> {
  const checkpoints: WorkflowRunState[] = [];
  const store = (await storage.getStore('workflows'))!;
  const persist = store.persistWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
    if (args.workflowName === workflowId) checkpoints.push(JSON.parse(JSON.stringify(args.snapshot)));
    return persist(args);
  });
  return checkpoints;
}

/** The checkpoint written after top-level entry `index` finished and before the next one started. */
function finishedCheckpoint(checkpoints: WorkflowRunState[], index: number): WorkflowRunState {
  const checkpoint = checkpoints.findLast(
    s =>
      s.status === 'running' &&
      s.activePaths.length === 1 &&
      s.activePaths[0] === index &&
      Object.keys(s.activeStepsPath ?? {}).length === 0,
  );
  expect(checkpoint, `no finished checkpoint for entry ${index}`).toBeDefined();
  return checkpoint!;
}

/**
 * Runs the workflow to completion, picks a checkpoint from that run, then
 * restores it into fresh storage with a freshly built workflow and restarts.
 */
async function restartFrom(
  build: () => Built,
  inputData: unknown,
  pickCheckpoint: (checkpoints: WorkflowRunState[]) => WorkflowRunState,
) {
  const first = build();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { wf: first.workflow } });
  const checkpoints = await captureCheckpoints(storage, first.workflow.id);
  const run = await first.workflow.createRun();
  const original = await run.start({ inputData });
  expect(original.status).toBe('success');

  return restartFromSnapshot(build, run.runId, pickCheckpoint(checkpoints), original);
}

async function restartFromSnapshot(build: () => Built, runId: string, snapshot: WorkflowRunState, original?: any) {
  const second = build();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { wf: second.workflow } });
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({ workflowName: second.workflow.id, runId, snapshot });

  const run = await second.workflow.createRun({ runId });
  const restarted = await run.restart();
  const stored = await store.loadWorkflowSnapshot({ workflowName: second.workflow.id, runId });
  return { original, restarted, stored, fns: second.fns };
}

function sequential(): Built {
  const a = step('a', async ({ inputData }) => ({ a: inputData.n + 1 }));
  const b = step('b', async ({ inputData }) => ({ b: inputData.a * 10 }));
  const c = step('c', async ({ inputData }) => ({ c: inputData.b + 1 }));
  const workflow = createWorkflow({ id: 'restart-sequential', inputSchema: anySchema, outputSchema: anySchema })
    .then(a.step)
    .then(b.step)
    .then(c.step)
    .commit();
  return { workflow, fns: { a: a.fn, b: b.fn, c: c.fn } };
}

describe('restart after a checkpoint that shows the entry finished (issue #24615)', () => {
  it('does not re-run a finished plain step', async () => {
    const { original, restarted, fns } = await restartFrom(sequential, { n: 1 }, cps => finishedCheckpoint(cps, 0));

    expect(fns.a).not.toHaveBeenCalled();
    expect(fns.b).toHaveBeenCalledTimes(1);
    expect(fns.b.mock.calls[0]![0].inputData).toEqual({ a: 2 });
    expect(fns.c).toHaveBeenCalledTimes(1);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('does not re-run a finished parallel block', async () => {
    const build = (): Built => {
      const start = step('start', async ({ inputData }) => ({ n: inputData.n }));
      const p1 = step('p1', async ({ inputData }) => ({ p1: inputData.n + 1 }));
      const p2 = step('p2', async ({ inputData }) => ({ p2: inputData.n + 2 }));
      const join = step('join', async ({ inputData }) => ({ sum: inputData.p1.p1 + inputData.p2.p2 }));
      const workflow = createWorkflow({ id: 'restart-parallel', inputSchema: anySchema, outputSchema: anySchema })
        .then(start.step)
        .parallel([p1.step, p2.step])
        .then(join.step)
        .commit();
      return { workflow, fns: { start: start.fn, p1: p1.fn, p2: p2.fn, join: join.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { n: 1 }, cps => finishedCheckpoint(cps, 1));

    expect(fns.start).not.toHaveBeenCalled();
    expect(fns.p1).not.toHaveBeenCalled();
    expect(fns.p2).not.toHaveBeenCalled();
    expect(fns.join).toHaveBeenCalledTimes(1);
    expect(fns.join.mock.calls[0]![0].inputData).toEqual({ p1: { p1: 2 }, p2: { p2: 3 } });
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('does not re-run a finished branch', async () => {
    const build = (): Built => {
      const start = step('start', async ({ inputData }) => ({ n: inputData.n }));
      const taken = step('taken', async ({ inputData }) => ({ taken: inputData.n * 2 }));
      const skipped = step('skipped', async () => ({ skipped: true }));
      const after = step('after', async ({ inputData }) => ({ after: inputData.taken.taken }));
      const workflow = createWorkflow({ id: 'restart-branch', inputSchema: anySchema, outputSchema: anySchema })
        .then(start.step)
        .branch([
          [async () => true, taken.step],
          [async () => false, skipped.step],
        ])
        .then(after.step)
        .commit();
      return { workflow, fns: { start: start.fn, taken: taken.fn, skipped: skipped.fn, after: after.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { n: 3 }, cps => finishedCheckpoint(cps, 1));

    expect(fns.taken).not.toHaveBeenCalled();
    expect(fns.skipped).not.toHaveBeenCalled();
    expect(fns.after).toHaveBeenCalledTimes(1);
    expect(fns.after.mock.calls[0]![0].inputData).toEqual({ taken: { taken: 6 } });
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('does not re-run a finished loop', async () => {
    const build = (): Built => {
      const counter = step('counter', async ({ inputData }) => ({ count: inputData.count + 1 }));
      const after = step('after', async ({ inputData }) => ({ final: inputData.count }));
      const workflow = createWorkflow({ id: 'restart-loop', inputSchema: anySchema, outputSchema: anySchema })
        .dountil(counter.step, async ({ inputData }) => inputData.count >= 3)
        .then(after.step)
        .commit();
      return { workflow, fns: { counter: counter.fn, after: after.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { count: 0 }, cps => finishedCheckpoint(cps, 0));

    expect(fns.counter).not.toHaveBeenCalled();
    expect(fns.after).toHaveBeenCalledTimes(1);
    expect(fns.after.mock.calls[0]![0].inputData).toEqual({ count: 3 });
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('does not re-run a finished foreach', async () => {
    const build = (): Built => {
      const list = step('list', async ({ inputData }) => inputData.items);
      const item = step('item', async ({ inputData }) => ({ doubled: inputData * 2 }));
      const collect = step('collect', async ({ inputData }) => ({ total: inputData.length }));
      const workflow = createWorkflow({ id: 'restart-foreach', inputSchema: anySchema, outputSchema: anySchema })
        .then(list.step)
        .foreach(item.step, { concurrency: 2 })
        .then(collect.step)
        .commit();
      return { workflow, fns: { list: list.fn, item: item.fn, collect: collect.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { items: [1, 2, 3] }, cps =>
      finishedCheckpoint(cps, 1),
    );

    expect(fns.item).not.toHaveBeenCalled();
    expect(fns.collect).toHaveBeenCalledTimes(1);
    expect(fns.collect.mock.calls[0]![0].inputData).toEqual([{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }]);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('does not re-run a finished nested workflow', async () => {
    const build = (): Built => {
      const inner = step('inner', async ({ inputData }) => ({ inner: inputData.n + 1 }));
      const after = step('after', async ({ inputData }) => ({ after: inputData.inner * 2 }));
      const nested = createWorkflow({ id: 'restart-nested-inner', inputSchema: anySchema, outputSchema: anySchema })
        .then(inner.step)
        .commit();
      const workflow = createWorkflow({ id: 'restart-nested', inputSchema: anySchema, outputSchema: anySchema })
        .then(nested)
        .then(after.step)
        .commit();
      return { workflow, fns: { inner: inner.fn, after: after.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { n: 1 }, cps => finishedCheckpoint(cps, 0));

    expect(fns.inner).not.toHaveBeenCalled();
    expect(fns.after).toHaveBeenCalledTimes(1);
    expect(fns.after.mock.calls[0]![0].inputData).toEqual({ inner: 2 });
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });

  it('finishes with the saved output when the last entry had already finished', async () => {
    const onFinish = vi.fn();
    const build = (): Built => {
      const a = step('a', async ({ inputData }) => ({ a: inputData.n + 1 }));
      const b = step('b', async ({ inputData }) => ({ b: inputData.a * 10 }));
      const workflow = createWorkflow({
        id: 'restart-all-done',
        inputSchema: anySchema,
        outputSchema: anySchema,
        options: { onFinish },
      })
        .then(a.step)
        .then(b.step)
        .commit();
      return { workflow, fns: { a: a.fn, b: b.fn } };
    };

    const { original, restarted, stored, fns } = await restartFrom(build, { n: 1 }, cps => {
      onFinish.mockClear();
      return finishedCheckpoint(cps, 1);
    });

    expect(fns.a).not.toHaveBeenCalled();
    expect(fns.b).not.toHaveBeenCalled();
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual({ b: 20 });
    expect(restarted.result).toEqual(original.result);
    expect(stored?.status).toBe('success');
    expect(stored?.result).toEqual({ b: 20 });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ status: 'success', result: { b: 20 } });
  });

  it('returns only the branches that ran when the last entry is a finished branch', async () => {
    const build = (): Built => {
      const start = step('start', async ({ inputData }) => ({ n: inputData.n }));
      const taken = step('taken', async ({ inputData }) => ({ taken: inputData.n * 2 }));
      const skipped = step('skipped', async () => ({ skipped: true }));
      const workflow = createWorkflow({
        id: 'restart-all-done-branch',
        inputSchema: anySchema,
        outputSchema: anySchema,
      })
        .then(start.step)
        .branch([
          [async () => true, taken.step],
          [async () => false, skipped.step],
        ])
        .commit();
      return { workflow, fns: { start: start.fn, taken: taken.fn, skipped: skipped.fn } };
    };

    const { original, restarted, fns } = await restartFrom(build, { n: 3 }, cps => finishedCheckpoint(cps, 1));

    expect(fns.taken).not.toHaveBeenCalled();
    expect(fns.skipped).not.toHaveBeenCalled();
    expect(original.result).toStrictEqual({ taken: { taken: 6 } });
    expect(restarted.status).toBe('success');
    expect(restarted.result).toStrictEqual(original.result);
  });

  describe('keeps re-running the entry when the checkpoint does not show it finished', () => {
    it('re-runs a step that was mid-run', async () => {
      const { restarted, fns } = await restartFrom(sequential, { n: 1 }, cps => {
        const checkpoint = cps.findLast(s => s.status === 'running' && s.activeStepsPath?.b);
        expect(checkpoint).toBeDefined();
        return checkpoint!;
      });

      expect(fns.a).not.toHaveBeenCalled();
      expect(fns.b).toHaveBeenCalledTimes(1);
      expect(fns.b.mock.calls[0]![0].inputData).toEqual({ a: 2 });
      expect(fns.c).toHaveBeenCalledTimes(1);
      expect(restarted.status).toBe('success');
    });

    it('re-runs the unfinished branch when the crash was inside a parallel block', async () => {
      const build = (): Built => {
        const start = step('start', async ({ inputData }) => ({ n: inputData.n }));
        const p1 = step('p1', async ({ inputData }) => ({ p1: inputData.n + 1 }));
        const p2 = step('p2', async ({ inputData }) => ({ p2: inputData.n + 2 }));
        const join = step('join', async ({ inputData }) => ({ sum: inputData.p1.p1 + inputData.p2.p2 }));
        const workflow = createWorkflow({ id: 'restart-parallel-mid', inputSchema: anySchema, outputSchema: anySchema })
          .then(start.step)
          .parallel([p1.step, p2.step])
          .then(join.step)
          .commit();
        return { workflow, fns: { start: start.fn, p1: p1.fn, p2: p2.fn, join: join.fn } };
      };
      const runId = 'restart-parallel-mid-run';
      const startedAt = Date.now();

      // p1 finished; p2 was still running when the process died.
      const { restarted, fns } = await restartFromSnapshot(build, runId, {
        runId,
        status: 'running',
        activePaths: [1],
        activeStepsPath: { p2: [1, 1] },
        value: {},
        context: {
          input: { n: 1 },
          start: { status: 'success', payload: { n: 1 }, output: { n: 1 }, startedAt, endedAt: startedAt },
          p1: { status: 'success', payload: { n: 1 }, output: { p1: 2 }, startedAt, endedAt: startedAt },
          p2: { status: 'running', payload: { n: 1 }, startedAt },
        } as any,
        serializedStepGraph: build().workflow.serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      });

      expect(fns.start).not.toHaveBeenCalled();
      expect(fns.p1).not.toHaveBeenCalled();
      expect(fns.p2).toHaveBeenCalledTimes(1);
      expect(fns.join).toHaveBeenCalledTimes(1);
      expect(fns.join.mock.calls[0]![0].inputData).toEqual({ p1: { p1: 2 }, p2: { p2: 3 } });
      expect(restarted.status).toBe('success');
    });

    it('re-runs a step whose saved result is a failure', async () => {
      const runId = 'restart-failed-step-run';
      const startedAt = Date.now();

      const { restarted, fns } = await restartFromSnapshot(sequential, runId, {
        runId,
        status: 'running',
        activePaths: [0],
        activeStepsPath: {},
        value: {},
        context: {
          input: { n: 1 },
          a: { status: 'failed', payload: { n: 1 }, error: 'boom', startedAt, endedAt: startedAt },
        } as any,
        serializedStepGraph: sequential().workflow.serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      });

      expect(fns.a).toHaveBeenCalledTimes(1);
      expect(fns.b).toHaveBeenCalledTimes(1);
      expect(fns.c).toHaveBeenCalledTimes(1);
      expect(restarted.status).toBe('success');
      expect(restarted.result).toEqual({ c: 21 });
    });
  });

  it('feeds the next step the full conversation of a finished step in an agent-loop workflow', async () => {
    const conversation = {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    };
    const build = (): Built => {
      const prepare = vi.fn(async () => ({ iteration: 1, messageListState: conversation, accumulatedSteps: ['s1'] }));
      // Mirrors MessageStateManager.deserializeAll: crashes when its input lost
      // `messageListState` to pruning (the #22636 crash).
      const callModel = step('llm-execution', async ({ inputData }) => ({
        text: `saw ${inputData.messageListState.messages.length} messages`,
      }));
      const workflow = createWorkflow({
        id: 'restart-agent-loop',
        inputSchema: anySchema,
        outputSchema: anySchema,
        options: { pruneSnapshot: pruneAgentLoopSnapshot, validateInputs: false },
      })
        .map(async () => prepare(), { id: 'map-to-llm-input' })
        .then(callModel.step)
        .commit();
      return { workflow, fns: { prepare, callModel: callModel.fn } };
    };

    let checkpoint: WorkflowRunState | undefined;
    const { original, restarted, fns } = await restartFrom(build, { prompt: 'hi' }, cps => {
      checkpoint = finishedCheckpoint(cps, 0);
      return checkpoint;
    });

    // The pruned checkpoint still carries the conversation the next step reads.
    expect((checkpoint!.context as any)['map-to-llm-input'].output.messageListState).toEqual(conversation);

    expect(fns.prepare).not.toHaveBeenCalled();
    expect(fns.callModel).toHaveBeenCalledTimes(1);
    expect(fns.callModel.mock.calls[0]![0].inputData.messageListState).toEqual(conversation);
    expect(restarted.status).toBe('success');
    expect(restarted.result).toEqual(original.result);
  });
});
