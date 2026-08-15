import { describe, expect, it } from 'vitest';
import { processWorkflowConditional } from './parallel';

function makeConditionalStep(ids: string[]) {
  return {
    type: 'conditional' as const,
    steps: ids.map(id => ({ type: 'step' as const, step: { id } })),
    conditions: ids.map(() => async () => true),
    serializedConditions: ids.map((_, i) => ({ id: `cond-${i}`, fn: 'true' })),
  };
}

function makeArgs(overrides: Record<string, any> = {}) {
  return {
    workflowId: 'wf',
    runId: 'run-1',
    executionPath: [0],
    stepResults: {},
    activeStepsPath: {},
    resumeSteps: [],
    prevResult: { status: 'success', output: {} },
    requestContext: {},
    state: {},
    ...overrides,
  } as any;
}

function makeStepExecutor(truthyIdxs: number[]) {
  return {
    evaluateConditions: async () => truthyIdxs,
  } as any;
}

describe('processWorkflowConditional restart execution path depth', () => {
  it('keeps the branch path at 2 levels on restart instead of growing a third level', async () => {
    const published: any[] = [];
    const pubsub = {
      publish: async (_topic: string, event: any) => {
        published.push(event);
      },
    } as any;

    // Conditional with branches A(0), B(1), C(2). The run failed inside branch C,
    // so restart restores executionPath = [conditionalIdx, branchIdx] = [0, 2].
    // Re-running C must publish the path [0, 2], not [0, 2, 2].
    const step = makeConditionalStep(['A', 'B', 'C']);
    const args = makeArgs({
      executionPath: [0, 2],
      restart: { activeStepsPath: { C: [0, 2] }, isParallelOrConditionalRestarted: false },
    });

    await processWorkflowConditional(args, { pubsub, stepExecutor: makeStepExecutor([2]), step });

    const runs = published.filter(e => e.type === 'workflow.step.run');
    expect(runs).toHaveLength(1);
    expect(runs[0].data.executionPath).toEqual([0, 2]);
    // activeStepsPath entries must stay at the same depth so aggregation resolves
    // the conditional container via executionPath.slice(0, -1) === [0].
    expect(runs[0].data.activeStepsPath['C']).toEqual([0, 2]);
  });

  it('appends the branch index normally on the first (non-restart) pass', async () => {
    const published: any[] = [];
    const pubsub = {
      publish: async (_topic: string, event: any) => {
        published.push(event);
      },
    } as any;

    const step = makeConditionalStep(['A', 'B', 'C']);
    const args = makeArgs({
      executionPath: [0],
      restart: undefined,
    });

    await processWorkflowConditional(args, { pubsub, stepExecutor: makeStepExecutor([1]), step });

    const runs = published.filter(e => e.type === 'workflow.step.run');
    expect(runs).toHaveLength(1);
    expect(runs[0].data.executionPath).toEqual([0, 1]);
  });
});
