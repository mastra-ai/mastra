/**
 * Regression for https://github.com/mastra-ai/mastra/issues/24615
 *
 * After an entry completes, the default engine persists an `entry-end` snapshot that
 * still points `activePaths` at the completed entry. If the process dies before the
 * next entry's `start` write, `run.restart()` must continue from the next entry
 * instead of re-executing the completed one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

type SnapshotPredicate = (snapshot: WorkflowRunState) => boolean;

/**
 * Runs `build()` against fresh storage, simulating a process crash on the first
 * snapshot write matching `crashWhen`, then restarts the run on a new Mastra
 * instance backed by the same storage.
 */
async function crashAndRestart({
  build,
  inputData,
  crashWhen,
  beforeRestart,
}: {
  build: () => any;
  inputData: unknown;
  crashWhen: SnapshotPredicate;
  beforeRestart?: (snapshot: WorkflowRunState) => void;
}) {
  const storage = new MockStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
  let crashed = false;
  workflowsStore.persistWorkflowSnapshot = async args => {
    // A dead process persists nothing further, even if the engine catches the error.
    if (crashed) throw new Error('process died');
    if (crashWhen(args.snapshot)) {
      crashed = true;
      throw new Error('process died');
    }
    // Clone like a real database would, so later in-memory mutations of the engine's
    // execution context cannot leak into the stored snapshot.
    return originalPersist({ ...args, snapshot: JSON.parse(JSON.stringify(args.snapshot)) });
  };

  const workflow = build();
  new Mastra({ logger: false, storage, workflows: { workflow } });
  const runId = 'restart-completed-boundary-run';
  const run = await workflow.createRun({ runId });
  await run.start({ inputData }).catch(() => undefined);
  expect(crashed).toBe(true);

  workflowsStore.persistWorkflowSnapshot = originalPersist;

  const snapshot = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
  expect(snapshot.status).toBe('running');
  beforeRestart?.(snapshot);

  const restartedWorkflow = build();
  new Mastra({ logger: false, storage, workflows: { workflow: restartedWorkflow } });
  const restartedRun = await restartedWorkflow.createRun({ runId });
  const result = await restartedRun.restart();

  const finalSnapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
  return { result, finalSnapshot };
}

const hasStep =
  (stepId: string): SnapshotPredicate =>
  snapshot =>
    !!snapshot.context?.[stepId];

describe('workflow restart at a completed entry boundary (issue #24615)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('continues with the next step instead of re-running a completed step', async () => {
    const step1Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value + 1 }));
    const step2Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value * 10 }));
    const schema = z.object({ value: z.number() });

    const build = () => {
      const step1 = createStep({ id: 'step1', inputSchema: schema, outputSchema: schema, execute: step1Execute });
      const step2 = createStep({ id: 'step2', inputSchema: schema, outputSchema: schema, execute: step2Execute });
      return createWorkflow({ id: 'sequential-boundary', inputSchema: schema, outputSchema: schema })
        .then(step1)
        .then(step2)
        .commit();
    };

    const { result, finalSnapshot } = await crashAndRestart({
      build,
      inputData: { value: 1 },
      crashWhen: hasStep('step2'),
      beforeRestart: snapshot => {
        expect(snapshot.activePaths).toEqual([0]);
        expect(snapshot.activeStepsPath).toEqual({});
        expect((snapshot.context as any).step1.status).toBe('success');
      },
    });

    expect(step1Execute).toHaveBeenCalledTimes(1);
    expect(step2Execute).toHaveBeenCalledTimes(1);
    expect(step2Execute.mock.calls[0]![0].inputData).toEqual({ value: 2 });
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 20 });
    expect(finalSnapshot?.status).toBe('success');
  });

  it('finishes the run without re-running anything when the last entry already completed', async () => {
    const step1Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value + 1 }));
    const step2Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value * 10 }));
    const schema = z.object({ value: z.number() });

    const build = () => {
      const step1 = createStep({ id: 'step1', inputSchema: schema, outputSchema: schema, execute: step1Execute });
      const step2 = createStep({ id: 'step2', inputSchema: schema, outputSchema: schema, execute: step2Execute });
      return createWorkflow({ id: 'last-entry-boundary', inputSchema: schema, outputSchema: schema })
        .then(step1)
        .then(step2)
        .commit();
    };

    const { result, finalSnapshot } = await crashAndRestart({
      build,
      inputData: { value: 1 },
      crashWhen: snapshot => snapshot.status === 'success',
      beforeRestart: snapshot => {
        expect(snapshot.activePaths).toEqual([1]);
        expect((snapshot.context as any).step2.status).toBe('success');
      },
    });

    expect(step1Execute).toHaveBeenCalledTimes(1);
    expect(step2Execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 20 });
    expect(finalSnapshot?.status).toBe('success');
    expect(finalSnapshot?.result).toEqual({ value: 20 });
  });

  it('does not re-run completed parallel branches', async () => {
    const aExecute = vi.fn(async () => ({ a: 1 }));
    const bExecute = vi.fn(async () => ({ b: 2 }));
    const cExecute = vi.fn(async ({ inputData }: any) => ({ merged: inputData }));

    const build = () => {
      const a = createStep({ id: 'a', inputSchema: z.any(), outputSchema: z.any(), execute: aExecute });
      const b = createStep({ id: 'b', inputSchema: z.any(), outputSchema: z.any(), execute: bExecute });
      const c = createStep({ id: 'c', inputSchema: z.any(), outputSchema: z.any(), execute: cExecute });
      return createWorkflow({ id: 'parallel-boundary', inputSchema: z.any(), outputSchema: z.any() })
        .parallel([a, b])
        .then(c)
        .commit();
    };

    const { result } = await crashAndRestart({ build, inputData: {}, crashWhen: hasStep('c') });

    expect(aExecute).toHaveBeenCalledTimes(1);
    expect(bExecute).toHaveBeenCalledTimes(1);
    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ merged: { a: { a: 1 }, b: { b: 2 } } });
  });

  it('does not re-run a completed conditional branch', async () => {
    const aExecute = vi.fn(async () => ({ a: 1 }));
    const bExecute = vi.fn(async () => ({ b: 2 }));
    const cExecute = vi.fn(async ({ inputData }: any) => ({ merged: inputData }));

    const build = () => {
      const a = createStep({ id: 'a', inputSchema: z.any(), outputSchema: z.any(), execute: aExecute });
      const b = createStep({ id: 'b', inputSchema: z.any(), outputSchema: z.any(), execute: bExecute });
      const c = createStep({ id: 'c', inputSchema: z.any(), outputSchema: z.any(), execute: cExecute });
      return createWorkflow({ id: 'conditional-boundary', inputSchema: z.any(), outputSchema: z.any() })
        .branch([
          [async () => true, a],
          [async () => false, b],
        ])
        .then(c)
        .commit();
    };

    const { result } = await crashAndRestart({ build, inputData: {}, crashWhen: hasStep('c') });

    expect(aExecute).toHaveBeenCalledTimes(1);
    expect(bExecute).not.toHaveBeenCalled();
    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result.merged.a).toEqual({ a: 1 });
  });

  it('does not re-run a completed loop', async () => {
    const schema = z.object({ value: z.number() });
    const incExecute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value + 1 }));
    const cExecute = vi.fn(async ({ inputData }: any) => inputData);

    const build = () => {
      const inc = createStep({ id: 'inc', inputSchema: schema, outputSchema: schema, execute: incExecute });
      const c = createStep({ id: 'c', inputSchema: schema, outputSchema: schema, execute: cExecute });
      return createWorkflow({ id: 'loop-boundary', inputSchema: schema, outputSchema: schema })
        .dountil(inc, async ({ inputData }) => inputData.value >= 3)
        .then(c)
        .commit();
    };

    const { result } = await crashAndRestart({ build, inputData: { value: 0 }, crashWhen: hasStep('c') });

    expect(incExecute).toHaveBeenCalledTimes(3);
    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(cExecute.mock.calls[0]![0].inputData).toEqual({ value: 3 });
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 3 });
  });

  it('does not re-run a completed foreach', async () => {
    const itemExecute = vi.fn(async ({ inputData }: any) => inputData * 2);
    const cExecute = vi.fn(async ({ inputData }: any) => ({ items: inputData }));

    const build = () => {
      const item = createStep({ id: 'item', inputSchema: z.number(), outputSchema: z.number(), execute: itemExecute });
      const c = createStep({ id: 'c', inputSchema: z.array(z.number()), outputSchema: z.any(), execute: cExecute });
      return createWorkflow({ id: 'foreach-boundary', inputSchema: z.array(z.number()), outputSchema: z.any() })
        .foreach(item)
        .then(c)
        .commit();
    };

    const { result } = await crashAndRestart({ build, inputData: [1, 2, 3], crashWhen: hasStep('c') });

    expect(itemExecute).toHaveBeenCalledTimes(3);
    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ items: [2, 4, 6] });
  });

  it('finishes the remaining iterations when the process died partway through a loop', async () => {
    const schema = z.object({ value: z.number() });
    const incExecute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value + 1 }));
    const cExecute = vi.fn(async ({ inputData }: any) => inputData);

    const build = () => {
      const inc = createStep({ id: 'inc', inputSchema: schema, outputSchema: schema, execute: incExecute });
      const c = createStep({ id: 'c', inputSchema: schema, outputSchema: schema, execute: cExecute });
      return createWorkflow({ id: 'loop-mid-iteration', inputSchema: schema, outputSchema: schema })
        .dountil(inc, async ({ inputData }) => inputData.value >= 3)
        .then(c)
        .commit();
    };

    // Die on the second iteration's `start` write, after the first iteration succeeded.
    const { result } = await crashAndRestart({
      build,
      inputData: { value: 0 },
      crashWhen: snapshot => (snapshot.context as any)?.inc?.payload?.value === 1,
      beforeRestart: snapshot => {
        expect(snapshot.activeStepsPath).toHaveProperty('inc');
        expect((snapshot.context as any).inc.status).toBe('running');
      },
    });

    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(cExecute.mock.calls[0]![0].inputData).toEqual({ value: 3 });
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 3 });
  });

  it('finishes the remaining items when the process died partway through a foreach', async () => {
    const itemExecute = vi.fn(async ({ inputData }: any) => inputData * 2);
    const cExecute = vi.fn(async ({ inputData }: any) => ({ items: inputData }));

    const build = () => {
      const item = createStep({ id: 'item', inputSchema: z.number(), outputSchema: z.number(), execute: itemExecute });
      const c = createStep({ id: 'c', inputSchema: z.array(z.number()), outputSchema: z.any(), execute: cExecute });
      return createWorkflow({ id: 'foreach-mid-item', inputSchema: z.array(z.number()), outputSchema: z.any() })
        .foreach(item, { concurrency: 2 })
        .then(c)
        .commit();
    };

    // Die on the third item's `start` write, after earlier items succeeded.
    const { result } = await crashAndRestart({
      build,
      inputData: [1, 2, 3],
      crashWhen: snapshot => (snapshot.context as any)?.item?.payload === 3,
      beforeRestart: snapshot => {
        expect((snapshot.context as any).item.status).not.toBe('success');
      },
    });

    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(cExecute.mock.calls[0]![0].inputData).toEqual([2, 4, 6]);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ items: [2, 4, 6] });
  });

  it('only persists a completed loop or foreach result with no active steps once the entry finished', async () => {
    const schema = z.object({ value: z.number() });
    const storage = new MockStore();
    const workflowsStore = (await storage.getStore('workflows'))!;
    const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
    const snapshots: WorkflowRunState[] = [];
    workflowsStore.persistWorkflowSnapshot = async args => {
      snapshots.push(JSON.parse(JSON.stringify(args.snapshot)));
      return originalPersist(args);
    };

    const inc = createStep({
      id: 'inc',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
    });
    const item = createStep({
      id: 'item',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({ id: 'boundary-shape', inputSchema: schema, outputSchema: z.any() })
      .dountil(inc, async ({ inputData }) => inputData.value >= 3)
      .map(async () => [1, 2, 3, 4])
      .foreach(item, { concurrency: 2 })
      .commit();
    new Mastra({ logger: false, storage, workflows: { workflow } });

    const result = await (await workflow.createRun()).start({ inputData: { value: 0 } });
    expect(result.status).toBe('success');

    const looksCompleted = (stepId: string) => (snapshot: WorkflowRunState) =>
      snapshot.status === 'running' &&
      Object.keys(snapshot.activeStepsPath ?? {}).length === 0 &&
      (snapshot.context as any)?.[stepId]?.status === 'success';

    // Each looks-completed snapshot must be written after the entry finished: the loop at
    // index 0 after its last iteration, the foreach at index 2 after its last item.
    const loopBoundaries = snapshots.filter(looksCompleted('inc')).filter(s => s.activePaths[0] === 0);
    expect(loopBoundaries.map(s => (s.context as any).inc.output)).toEqual([{ value: 3 }]);
    const foreachBoundaries = snapshots.filter(looksCompleted('item'));
    expect(foreachBoundaries.map(s => (s.context as any).item.output)).toEqual([[1, 2, 3, 4]]);
  });

  it('does not sleep again after a completed sleep', async () => {
    const schema = z.object({ value: z.number() });
    const cExecute = vi.fn(async ({ inputData }: any) => inputData);

    const build = () => {
      const c = createStep({ id: 'c', inputSchema: schema, outputSchema: schema, execute: cExecute });
      return (
        createWorkflow({ id: 'sleep-boundary', inputSchema: schema, outputSchema: schema })
          // Generated sleep ids differ between processes; a stable id lets restart match the entry.
          .sleep(10, { id: 'pause' })
          .then(c)
          .commit()
      );
    };

    const sleepSpy = vi.spyOn(DefaultExecutionEngine.prototype, 'executeSleep');
    const { result } = await crashAndRestart({ build, inputData: { value: 7 }, crashWhen: hasStep('c') });

    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(cExecute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 7 });
  });

  it('still re-runs a step that was in progress when the process died', async () => {
    const step1Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value + 1 }));
    const step2Execute = vi.fn(async ({ inputData }: any) => ({ value: inputData.value * 10 }));
    const schema = z.object({ value: z.number() });

    const build = () => {
      const step1 = createStep({ id: 'step1', inputSchema: schema, outputSchema: schema, execute: step1Execute });
      const step2 = createStep({ id: 'step2', inputSchema: schema, outputSchema: schema, execute: step2Execute });
      return createWorkflow({ id: 'in-progress-step', inputSchema: schema, outputSchema: schema })
        .then(step1)
        .then(step2)
        .commit();
    };

    // Crash on step2's completion write, so the last durable snapshot is step2's `start` write.
    const { result } = await crashAndRestart({
      build,
      inputData: { value: 1 },
      crashWhen: snapshot => (snapshot.context as any)?.step2?.status === 'success',
      beforeRestart: snapshot => {
        expect(snapshot.activePaths).toEqual([1]);
        expect(snapshot.activeStepsPath).toHaveProperty('step2');
      },
    });

    expect(step1Execute).toHaveBeenCalledTimes(1);
    expect(step2Execute).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ value: 20 });
  });
});
