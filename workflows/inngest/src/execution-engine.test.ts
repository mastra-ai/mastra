import { MastraNonRetryableError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import { Inngest, NonRetriableError } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InngestExecutionEngine } from './execution-engine';
import { init } from './index';

function createEngine() {
  const inngestStep = {
    run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
  };

  return new InngestExecutionEngine(undefined as any, inngestStep as any, 0, {} as any);
}

describe('InngestExecutionEngine.executeStepWithRetry', () => {
  it('does not retry MastraNonRetryableError failures', async () => {
    const engine = createEngine();
    let calls = 0;

    const result = await engine.executeStepWithRetry(
      'workflow.test.step.fatal',
      async () => {
        calls++;
        throw new MastraNonRetryableError('permanent failure');
      },
      { retries: 3, delay: 0, workflowId: 'test-workflow', runId: 'test-run' },
    );

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.nonRetryable).toBe(true);
    }
  });

  it('does not retry Inngest NonRetriableError failures', async () => {
    const engine = createEngine();
    let calls = 0;

    const result = await engine.executeStepWithRetry(
      'workflow.test.step.fatal',
      async () => {
        calls++;
        throw new NonRetriableError('permanent failure');
      },
      { retries: 3, delay: 0, workflowId: 'test-workflow', runId: 'test-run' },
    );

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.nonRetryable).toBe(true);
    }
  });

  it('does not retry when a wrapped error carries a NonRetriableError cause', async () => {
    const engine = createEngine();
    let calls = 0;

    const result = await engine.executeStepWithRetry(
      'workflow.test.step.fatal',
      async () => {
        calls++;
        throw new Error('wrapped failure', { cause: new NonRetriableError('permanent failure') });
      },
      { retries: 3, delay: 0, workflowId: 'test-workflow', runId: 'test-run' },
    );

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.nonRetryable).toBe(true);
    }
  });

  it('retries transient errors until retry attempts are exhausted', async () => {
    const engine = createEngine();
    let calls = 0;

    const result = await engine.executeStepWithRetry(
      'workflow.test.step.transient',
      async () => {
        calls++;
        throw new Error('transient failure');
      },
      { retries: 3, delay: 0, workflowId: 'test-workflow', runId: 'test-run' },
    );

    expect(calls).toBe(4);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.nonRetryable).toBeUndefined();
    }
  });

  it('surfaces the correct retryCount on each retry attempt', async () => {
    const engine = createEngine();
    const seenRetryCounts: number[] = [];

    await engine.executeStepWithRetry(
      'workflow.test-wf.step.my-step',
      async () => {
        seenRetryCounts.push(engine.getOrGenerateRetryCount('my-step'));
        throw new Error('transient failure');
      },
      { retries: 3, delay: 0, workflowId: 'test-wf', runId: 'test-run' },
    );

    expect(seenRetryCounts).toEqual([0, 1, 2, 3]);
  });

  it('surfaces correct retryCount when workflowId contains ".step."', async () => {
    const engine = createEngine();
    const seenRetryCounts: number[] = [];

    await engine.executeStepWithRetry(
      'workflow.my.step.workflow.step.my-step',
      async () => {
        seenRetryCounts.push(engine.getOrGenerateRetryCount('my-step'));
        throw new Error('transient failure');
      },
      { retries: 2, delay: 0, workflowId: 'my.step.workflow', runId: 'test-run' },
    );

    expect(seenRetryCounts).toEqual([0, 1, 2]);
  });

  it('isolates retryCount across concurrent .foreach() iterations', async () => {
    const engine = createEngine();
    const seenByIteration: Record<string, number[]> = { a: [], b: [] };

    await Promise.all([
      engine.executeStepWithRetry(
        'workflow.wf.step.shared-step',
        async () => {
          seenByIteration['a']!.push(engine.getOrGenerateRetryCount('shared-step'));
          throw new Error('transient');
        },
        { retries: 2, delay: 0, workflowId: 'wf', runId: 'run-a' },
      ),
      engine.executeStepWithRetry(
        'workflow.wf.step.shared-step',
        async () => {
          seenByIteration['b']!.push(engine.getOrGenerateRetryCount('shared-step'));
          throw new Error('transient');
        },
        { retries: 2, delay: 0, workflowId: 'wf', runId: 'run-b' },
      ),
    ]);

    expect(seenByIteration['a']).toEqual([0, 1, 2]);
    expect(seenByIteration['b']).toEqual([0, 1, 2]);
  });
});

function createNestedResumeFixture(suspendedPaths: Record<string, number[]>) {
  const inngest = new Inngest({ id: 'nested-resume-test' });
  const { createWorkflow, createStep } = init(inngest);
  const suspendedStep = createStep({
    id: 'suspended-child-step',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  const nestedWorkflow = createWorkflow({
    id: 'nested-resume-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    steps: [suspendedStep],
  })
    .then(suspendedStep)
    .commit();

  const nestedRunId = 'nested-run';
  const nestedStepResults = Object.fromEntries(
    Object.keys(suspendedPaths).map(stepId => [stepId, { status: 'suspended', payload: { value: 'before-suspend' } }]),
  );
  const loadWorkflowSnapshot = vi.fn().mockResolvedValue({
    value: { count: 1 },
    context: nestedStepResults,
    suspendedPaths,
  });
  const mastra = {
    getStorage: () => ({
      getStore: async () => ({ loadWorkflowSnapshot }),
    }),
  } as unknown as Mastra;
  const invoke = vi.fn().mockResolvedValue({
    result: { status: 'success', result: { value: 'resumed' }, state: { count: 2 } },
    runId: nestedRunId,
  });
  const inngestStep = {
    invoke,
    run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
  };
  const engine = new InngestExecutionEngine(mastra, inngestStep as any, 0, {} as any);
  const resumePayload = { approved: true };
  const execute = () =>
    engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: {
        [nestedWorkflow.id]: {
          status: 'suspended',
          suspendPayload: { __workflow_meta: { runId: nestedRunId } },
        } as any,
      },
      executionContext: {
        workflowId: 'parent-workflow',
        runId: 'parent-run',
        executionPath: [0],
        suspendedPaths: {},
        state: {},
      } as any,
      resume: { steps: [nestedWorkflow.id], resumePayload },
      prevOutput: {},
      inputData: { value: 'start' },
      pubsub: { publish: vi.fn().mockResolvedValue(undefined) } as any,
      startedAt: Date.now(),
    });

  return {
    execute,
    invoke,
    loadWorkflowSnapshot,
    nestedRunId,
    nestedWorkflow,
    resumePayload,
    suspendedStep,
  };
}

describe('InngestExecutionEngine.executeWorkflowStep', () => {
  it('restores the suspended child path when resuming with only the nested workflow id', async () => {
    const fixture = createNestedResumeFixture({ 'suspended-child-step': [1, 0] });
    const { execute, invoke, loadWorkflowSnapshot, nestedRunId, nestedWorkflow, resumePayload, suspendedStep } =
      fixture;

    await execute();

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: nestedWorkflow.id,
      runId: nestedRunId,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data).not.toHaveProperty('initialState');
    expect(invoke.mock.calls[0]?.[1].data.resume).toEqual({
      runId: nestedRunId,
      steps: [suspendedStep.id],
      resumePayload,
      resumePath: [1, 0],
    });
  });

  it.each<{ name: string; suspendedPaths: Record<string, number[]>; message: string }>([
    {
      name: 'no suspended child',
      suspendedPaths: {},
      message: 'No suspended steps found in nested workflow: nested-resume-workflow',
    },
    {
      name: 'multiple suspended children',
      suspendedPaths: { 'first-child': [1, 0], 'second-child': [1, 1] },
      message:
        'Multiple suspended steps found: [first-child], [second-child]. Please specify which step to resume using the "step" parameter.',
    },
  ])('does not guess a resume target with $name', async ({ suspendedPaths, message }) => {
    const { execute, invoke } = createNestedResumeFixture(suspendedPaths);

    const result = await execute();

    expect(invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({ message }),
    });
  });
});
