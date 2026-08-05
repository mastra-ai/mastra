import { describe, expect, it } from 'vitest';
import { processWorkflowParallel } from './parallel';

function makeParallelStep(ids: string[]) {
  return {
    type: 'parallel' as const,
    steps: ids.map(id => ({ type: 'step' as const, step: { id } })),
  };
}

function makeArgs(overrides: Record<string, any> = {}) {
  return {
    workflowId: 'wf',
    runId: 'run-1',
    executionPath: [0, 2],
    stepResults: {},
    activeStepsPath: {},
    resumeSteps: [],
    prevResult: { status: 'success', output: {} },
    requestContext: {},
    state: {},
    ...overrides,
  } as any;
}

describe('processWorkflowParallel restart branch routing', () => {
  it('re-runs the actually-active branch on restart (uses full-array index, not post-filter index)', async () => {
    const published: any[] = [];
    const pubsub = {
      publish: async (_topic: string, event: any) => {
        published.push(event);
      },
    } as any;

    // Parallel with branches A(0), B(1), C(2). Only C was active when the run
    // was interrupted, so only C should be re-run, with its real index 2.
    const step = makeParallelStep(['A', 'B', 'C']);
    const args = makeArgs({
      executionPath: [0, 2],
      restart: { activeStepsPath: { C: [0, 2] }, isParallelOrConditionalRestarted: false },
    });

    await processWorkflowParallel(args, { pubsub, step });

    const runs = published.filter(e => e.type === 'workflow.step.run');
    expect(runs).toHaveLength(1);
    // The child index (executionPath[1]) must be 2 (branch C), not 0 (branch A).
    expect(runs[0].data.executionPath).toEqual([0, 2]);
  });

  it('re-runs the correct non-prefix subset {B,C} on restart', async () => {
    const published: any[] = [];
    const pubsub = {
      publish: async (_topic: string, event: any) => {
        published.push(event);
      },
    } as any;

    const step = makeParallelStep(['A', 'B', 'C']);
    const args = makeArgs({
      executionPath: [0, 1],
      restart: { activeStepsPath: { B: [0, 1], C: [0, 2] }, isParallelOrConditionalRestarted: false },
    });

    await processWorkflowParallel(args, { pubsub, step });

    const childIndexes = published
      .filter(e => e.type === 'workflow.step.run')
      .map(e => e.data.executionPath[1])
      .sort();

    // B and C are full-array indexes 1 and 2 (not 0 and 1).
    expect(childIndexes).toEqual([1, 2]);
  });
});
