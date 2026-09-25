/**
 * Regression for https://github.com/mastra-ai/mastra/issues/22636 (evented engine).
 *
 * The default engine records "this step is running, with this input" BEFORE
 * executing it (handlers/step.ts persistStepUpdate phase:'start'), so after a
 * crash the snapshot is enough to re-enter the in-flight step. The evented
 * engine only wrote at step END: a crash inside a step left a snapshot with
 * empty `activePaths` / `activeStepsPath` and no running record, so restart
 * died with "Execution path is empty" and the run was permanently stranded.
 *
 * These tests pin the mid-step write in processWorkflowStepRun:
 * 1. While a step is executing, the persisted snapshot carries the running
 *    record (status/payload/startedAt) and routing state (activePaths as the
 *    FULL execution path + activeStepsPath), and the run still completes
 *    normally afterwards.
 * 2. A "killed" host (workers never finish the step) can be recovered by a
 *    fresh host over the same storage via run.restart(): the crashed step
 *    re-enters with its own recorded input and completed steps do not re-run.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const looseObject = z.looseObject({});

type StepExecute = (params: { inputData: any }) => Promise<any>;

function makeWorkflow(id: string, step1Execute: StepExecute, step2Execute: StepExecute) {
  const step1 = createStep({
    id: 'step1',
    execute: step1Execute,
    inputSchema: looseObject,
    outputSchema: looseObject,
  });
  const step2 = createStep({
    id: 'step2',
    execute: step2Execute,
    inputSchema: looseObject,
    outputSchema: looseObject,
  });
  return createWorkflow({
    id,
    inputSchema: looseObject,
    outputSchema: looseObject,
    steps: [step1, step2],
  })
    .then(step1)
    .then(step2)
    .commit();
}

async function makeHost(workflow: ReturnType<typeof makeWorkflow>, storage: InstanceType<typeof MockStore>) {
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  return mastra;
}

describe('evented mid-step recording (issue #22636)', () => {
  it('persists the running step record and routing state before executing the step', async () => {
    const storage = new MockStore();

    let releaseStep2!: () => void;
    const step2Gate = new Promise<void>(resolve => (releaseStep2 = resolve));
    let signalStep2Started!: () => void;
    const step2Started = new Promise<void>(resolve => (signalStep2Started = resolve));

    const step1Output = { seed: 'from-step1' };
    const workflow = makeWorkflow(
      'mid-step-recording-wf',
      async () => step1Output,
      async ({ inputData }) => {
        signalStep2Started();
        await step2Gate;
        return { got: inputData.seed };
      },
    );

    const mastra = await makeHost(workflow, storage);
    try {
      const runId = `mid-step-recording-${Date.now()}`;
      const run = await workflow.createRun({ runId });
      const resultPromise = run.start({ inputData: { value: 'go' } });

      await step2Started;

      // The mid-step write commits BEFORE stepExecutor.execute(), so by the
      // time step2's execute signals, the snapshot must already show it.
      const workflowsStore = await storage.getStore('workflows');
      const snapshot = await workflowsStore!.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
      });

      expect(snapshot).toBeTruthy();
      expect(snapshot!.status).toBe('running');
      // Full execution path — the shape restart routing feeds back as the
      // workflow.start executionPath.
      expect(snapshot!.activePaths).toEqual([1]);
      expect(snapshot!.activeStepsPath).toMatchObject({ step2: [1] });

      const step2Record = (snapshot!.context as any)?.step2;
      expect(step2Record).toBeTruthy();
      expect(step2Record.status).toBe('running');
      expect(step2Record.payload).toEqual(step1Output);
      expect(typeof step2Record.startedAt).toBe('number');

      // The completed predecessor keeps its terminal record.
      expect((snapshot!.context as any)?.step1?.status).toBe('success');

      // The mid-step write must not disturb normal completion.
      releaseStep2();
      const result = await resultPromise;
      expect(result.status).toBe('success');
      expect((result as any).result).toEqual({ got: 'from-step1' });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('recovers a run killed mid-step via restart() on a fresh host over the same storage', async () => {
    const storage = new MockStore();
    const runId = `mid-step-kill-restart-${Date.now()}`;

    // ---- Host A: step2 hangs forever (simulated crash mid-step) ----
    let signalStep2Started!: () => void;
    const step2Started = new Promise<void>(resolve => (signalStep2Started = resolve));

    const step1A = vi.fn(async () => ({ seed: 'from-step1' }));
    const workflowA = makeWorkflow('kill-restart-wf', step1A, async () => {
      signalStep2Started();
      // Never resolves: the "process" dies while this step is in flight.
      await new Promise<never>(() => {});
      return {};
    });

    const mastraA = await makeHost(workflowA, storage);
    const runA = await workflowA.createRun({ runId });
    // Abandoned on purpose — host A is "killed" while step2 is executing.
    runA.start({ inputData: { value: 'go' } }).catch(() => {});
    await step2Started;

    // ---- Host B: fresh instances over the SAME storage ----
    const step1B = vi.fn(async () => ({ seed: 'should-not-run' }));
    const step2B = vi.fn(async ({ inputData }: { inputData: any }) => ({ got: inputData.seed }));
    const workflowB = makeWorkflow('kill-restart-wf', step1B, step2B);

    const mastraB = await makeHost(workflowB, storage);
    try {
      const runB = await workflowB.createRun({ runId });
      const result = await runB.restart();

      expect(result.status).toBe('success');
      expect((result as any).result).toEqual({ got: 'from-step1' });

      // The completed predecessor must not re-execute…
      expect(step1B).toHaveBeenCalledTimes(0);
      // …and the crashed step re-enters with its own recorded input.
      expect(step2B).toHaveBeenCalledTimes(1);
      expect(step2B.mock.calls[0]![0].inputData).toEqual({ seed: 'from-step1' });
    } finally {
      await mastraB.stopWorkers();
      await mastraA.stopWorkers();
    }
  });
});
