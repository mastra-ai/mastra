import { describe, expect, it } from 'vitest';
import { processWorkflowLoop } from './loop';
import { runInStorageScope } from './storage-scope';

/**
 * Regression coverage for the evented engine's loop `iterationCount`.
 *
 * The default engine exposes an incrementing `iterationCount` to `dountil`/`dowhile`
 * conditions (see handlers/control-flow.ts + handlers/step.ts). The evented engine
 * must match that: reading `iterationCount` in a loop condition has to see 1, 2, 3...
 * across iterations, and a condition that terminates on it has to actually terminate.
 *
 * The bug this guards against: `processWorkflowLoop` reads the previous count from
 * `stepResults[bodyStepId].metadata.iterationCount`, but the loop-again event never
 * carried that metadata forward, so every iteration re-read 0 and evaluated the
 * condition with `iterationCount === 1` forever (an infinite loop when termination
 * depends on the count).
 */

function makeLoopStep(loopType: 'dountil' | 'dowhile', condition: (n: number) => boolean) {
  return {
    type: 'loop' as const,
    step: { id: 'body' },
    condition,
    loopType,
  } as any;
}

/**
 * Drive `processWorkflowLoop` the way the event processor does: run the body,
 * evaluate the condition, and when it publishes a loop-again (`workflow.step.run`)
 * event, feed that event's `stepResults` back into the next call. The body itself
 * does not merge its result into `stepResults[bodyStepId]` on the loop-again path,
 * so the only thing that can carry the iteration count forward is the event payload.
 */
async function driveLoop(loopType: 'dountil' | 'dowhile', condition: (n: number) => boolean, maxTurns = 25) {
  const seenCounts: number[] = [];
  const published: any[] = [];
  const pubsub = {
    publish: async (_topic: string, event: any) => {
      published.push(event);
    },
  } as any;
  const stepExecutor = {
    evaluateCondition: async ({ iterationCount }: { iterationCount: number }) => {
      seenCounts.push(iterationCount);
      return condition(iterationCount);
    },
  } as any;

  const step = makeLoopStep(loopType, condition);
  const bodyResult = { status: 'success' as const, output: { n: 1 }, startedAt: 1, endedAt: 2, payload: {} };

  let stepResults: Record<string, any> = {};
  let ended = false;

  for (let turn = 0; turn < maxTurns; turn++) {
    published.length = 0;
    await processWorkflowLoop(
      {
        workflowId: 'wf',
        runId: 'run-1',
        executionPath: [0],
        stepResults,
        activeStepsPath: {},
        resumeSteps: [],
        prevResult: bodyResult,
        requestContext: {},
      } as any,
      { pubsub, runStorage: {} as any, stepExecutor, step, stepResult: bodyResult },
    );

    if (published.some(e => e.type === 'workflow.step.end')) {
      ended = true;
      break;
    }

    const runEvt = published.find(e => e.type === 'workflow.step.run');
    // Loop-again: the body would run next, then we re-enter with the event's stepResults.
    stepResults = runEvt.data.stepResults;
  }

  return { seenCounts, ended };
}

describe('evented loop iterationCount', () => {
  it('dountil sees an incrementing count and terminates when the count is reached', async () => {
    // Stop once we have run 3 iterations.
    const { seenCounts, ended } = await driveLoop('dountil', n => n >= 3);

    expect(ended).toBe(true);
    expect(seenCounts).toEqual([1, 2, 3]);
  });

  it('dowhile sees an incrementing count and terminates when the count is reached', async () => {
    // Keep looping while we have run fewer than 3 iterations.
    const { seenCounts, ended } = await driveLoop('dowhile', n => n < 3);

    expect(ended).toBe(true);
    expect(seenCounts).toEqual([1, 2, 3]);
  });

  it('reports the stored count when a completion is replayed instead of advancing it again', async () => {
    const writes: any[] = [];
    const published: any[] = [];
    const pubsub = { publish: async (_topic: string, event: any) => void published.push(event) } as any;
    const step = makeLoopStep('dountil', () => false);
    const bodyResult = { status: 'success' as const, output: { n: 1 }, startedAt: 1, endedAt: 2, payload: {} };
    // The delivery's own result: the earlier attempt stored it with the count of the iteration it ran.
    const stored = { ...bodyResult, metadata: { startedBy: 'evt-1', loopCondition: false, iterationCount: 3 } };

    await runInStorageScope(2, () =>
      processWorkflowLoop(
        {
          workflowId: 'wf',
          runId: 'run-1',
          executionPath: [0],
          stepResults: { body: stored },
          activeStepsPath: {},
          resumeSteps: [],
          prevResult: bodyResult,
          requestContext: {},
        } as any,
        {
          pubsub,
          runStorage: { writeStepResult: async (args: any) => void writes.push(args) } as any,
          stepExecutor: {} as any,
          step,
          stepResult: stored,
          // A guarded store reuses the condition it saved with the completion.
          savedCondition: false,
          replayedIterationCount: 3,
        },
      ),
    );

    const runEvent = published.find(event => event.type === 'workflow.step.run');
    expect(runEvent?.data.stepResults.body.metadata.iterationCount).toBe(3);
    // The stored record keeps the same count, so the next iteration runs as iteration 4.
    expect(writes[0].result.metadata.iterationCount).toBe(3);
  });

  it('stores the body state next to the next input on an unguarded store', async () => {
    const writes: any[] = [];
    const pubsub = { publish: async () => {} } as any;
    const step = makeLoopStep('dountil', () => false);
    const bodyResult = { status: 'success' as const, output: { n: 1 }, startedAt: 1, endedAt: 2, payload: {} };

    await runInStorageScope(2, () =>
      processWorkflowLoop(
        {
          workflowId: 'wf',
          runId: 'run-1',
          executionPath: [0],
          stepResults: {},
          activeStepsPath: {},
          resumeSteps: [],
          prevResult: bodyResult,
          requestContext: {},
          state: { n: 1 },
        } as any,
        {
          pubsub,
          runStorage: { writeStepResult: async (args: any) => void writes.push(args) } as any,
          stepExecutor: { evaluateCondition: async () => false } as any,
          step,
          stepResult: bodyResult,
          // No saved condition means an unguarded store: the write records the next iteration as
          // started rather than the body's committed result.
        },
      ),
    );

    expect(writes[0].result).toMatchObject({ status: 'running', payload: { n: 1 } });
    expect(writes[0].state).toEqual({ n: 1 });
  });
});
