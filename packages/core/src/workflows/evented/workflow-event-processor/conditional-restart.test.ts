import { describe, expect, it } from 'vitest';
import { processWorkflowConditional } from './parallel';

function makeConditionalStep(ids: string[]) {
  return {
    type: 'conditional' as const,
    steps: ids.map(id => ({ type: 'step' as const, step: { id } })),
    conditions: [],
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

function makePubsub() {
  const published: any[] = [];
  return {
    published,
    pubsub: {
      publish: async (_topic: string, event: any) => {
        published.push(event);
      },
    } as any,
  };
}

describe('processWorkflowConditional restart branch routing', () => {
  it('keeps the restored branch path at the same depth on restart', async () => {
    const { pubsub, published } = makePubsub();
    const step = makeConditionalStep(['A', 'B', 'C']);
    const stepExecutor = { evaluateConditions: async () => [2] } as any;
    const args = makeArgs({
      executionPath: [0, 2],
      restart: { activeStepsPath: { C: [0, 2] }, isParallelOrConditionalRestarted: false },
    });

    await processWorkflowConditional(args, { pubsub, stepExecutor, step });

    const runs = published.filter(event => event.type === 'workflow.step.run');
    expect(runs).toHaveLength(1);
    expect(runs[0].data.executionPath).toEqual([0, 2]);
    expect(args.activeStepsPath.C).toEqual([0, 2]);
  });

  it('appends the branch index during normal execution', async () => {
    const { pubsub, published } = makePubsub();
    const step = makeConditionalStep(['A', 'B', 'C']);
    const stepExecutor = { evaluateConditions: async () => [1] } as any;
    const args = makeArgs();

    await processWorkflowConditional(args, { pubsub, stepExecutor, step });

    const runs = published.filter(event => event.type === 'workflow.step.run');
    expect(runs).toHaveLength(1);
    expect(runs[0].data.executionPath).toEqual([0, 1]);
    expect(args.activeStepsPath.B).toEqual([0, 1]);
  });
});
