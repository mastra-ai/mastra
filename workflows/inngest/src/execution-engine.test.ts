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

function createNestedResumeFixture(
  suspendedPaths: Record<string, number[]>,
  options: {
    /**
     * Shape of the parent's step result for the nested workflow:
     * - 'legacy': intact suspendPayload, as loaded from the snapshot on the first resume pass.
     * - 'stripped': what core actually persists after re-entering the step
     *   (omitPriorCompletionFields drops suspendPayload before the nested branch runs).
     */
    stepResultShape?: 'legacy' | 'stripped';
    /** foreach iteration index on the execution context. */
    foreachIndex?: number;
    /** 'fresh' calls executeWorkflowStep without resume data. */
    mode?: 'resume' | 'fresh';
    /** Overrides the mocked step.invoke implementation. */
    invokeImpl?: (id: string, opts: any) => Promise<any>;
    /** Registers a spy logger on the engine via __registerMastra. */
    withLoggerSpy?: boolean;
  } = {},
) {
  const { stepResultShape = 'legacy', foreachIndex, mode = 'resume', invokeImpl, withLoggerSpy } = options;
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
  const parentRunId = 'parent-run';
  const nestedStepResults = Object.fromEntries(
    Object.keys(suspendedPaths).map(stepId => [stepId, { status: 'suspended', payload: { value: 'before-suspend' } }]),
  );
  const loadWorkflowSnapshot = vi.fn().mockResolvedValue({
    value: { count: 1 },
    context: nestedStepResults,
    suspendedPaths,
  });
  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const mastra = {
    getStorage: () => ({
      getStore: async () => ({ loadWorkflowSnapshot }),
    }),
    ...(withLoggerSpy ? { getLogger: () => logger } : {}),
  } as unknown as Mastra;
  const invoke = vi.fn(
    invokeImpl ??
      (async (_id: string, opts: any) => ({
        result: { status: 'success', result: { value: 'resumed' }, state: { count: 2 } },
        runId: opts?.data?.runId ?? nestedRunId,
      })),
  );
  const inngestStep = {
    invoke,
    run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
  };
  const engine = new InngestExecutionEngine(mastra, inngestStep as any, 0, {} as any);
  if (withLoggerSpy) {
    engine.__registerMastra(mastra);
  }
  const resumePayload = { approved: true };
  const parentStepResult =
    stepResultShape === 'stripped'
      ? ({ status: 'running', payload: { value: 'start' }, resumePayload, resumedAt: Date.now() } as any)
      : ({ status: 'suspended', suspendPayload: { __workflow_meta: { runId: nestedRunId } } } as any);
  const execute = () =>
    engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: { [nestedWorkflow.id]: parentStepResult },
      executionContext: {
        workflowId: 'parent-workflow',
        runId: parentRunId,
        executionPath: [0],
        suspendedPaths: {},
        state: {},
        ...(foreachIndex !== undefined ? { foreachIndex } : {}),
      } as any,
      ...(mode === 'resume' ? { resume: { steps: [nestedWorkflow.id], resumePayload } } : {}),
      prevOutput: {},
      inputData: { value: 'start' },
      pubsub: { publish: vi.fn().mockResolvedValue(undefined) } as any,
      startedAt: Date.now(),
    });

  return {
    execute,
    engine,
    invoke,
    loadWorkflowSnapshot,
    logger,
    nestedRunId,
    parentRunId,
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

  it('replays the memoized invoke on the delivery pass when the child is no longer suspended', async () => {
    // step.invoke parks the parent until the child finishes, so Inngest re-executes
    // the resume block to deliver the memoized result — by which point the child has
    // no suspended paths left. That pass must replay, not fail.
    const fixture = createNestedResumeFixture({});
    const { execute, invoke } = fixture;

    const result = await execute();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data).not.toHaveProperty('resume');
    expect(invoke.mock.calls[0]?.[1].data).toHaveProperty('initialState');
    expect(result).toMatchObject({ status: 'success', output: { value: 'resumed' } });
  });

  it('does not guess a resume target with multiple suspended children', async () => {
    const { execute, invoke } = createNestedResumeFixture({ 'first-child': [1, 0], 'second-child': [1, 1] });

    const result = await execute();

    expect(invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'failed',
      error: expect.objectContaining({
        message:
          'Multiple suspended steps found: [first-child], [second-child]. Please specify which step to resume using the "step" parameter.',
      }),
    });
  });

  it('derives the parent run id when core stripped suspendPayload on re-entry', async () => {
    const fixture = createNestedResumeFixture({ 'suspended-child-step': [1, 0] }, { stepResultShape: 'stripped' });
    const { execute, invoke, loadWorkflowSnapshot, parentRunId, nestedWorkflow, resumePayload, suspendedStep } =
      fixture;

    const result = await execute();

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: nestedWorkflow.id,
      runId: parentRunId,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data.resume).toEqual({
      runId: parentRunId,
      steps: [suspendedStep.id],
      resumePayload,
      resumePath: [1, 0],
    });
    expect(result).toMatchObject({ status: 'success', output: { value: 'resumed' } });
  });

  it('replays the memoized invoke when the stripped snapshot has no suspended child left', async () => {
    // The exact pass-2 combination from #23182: suspendPayload stripped AND the
    // child already finished. The derived run id finds the (completed) child
    // snapshot, and the memoized invoke delivers its result.
    const fixture = createNestedResumeFixture({}, { stepResultShape: 'stripped' });
    const { execute, invoke, loadWorkflowSnapshot, parentRunId, nestedWorkflow } = fixture;

    const result = await execute();

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: nestedWorkflow.id,
      runId: parentRunId,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data).not.toHaveProperty('resume');
    expect(result).toMatchObject({ status: 'success', output: { value: 'resumed' } });
  });

  it('derives a per-iteration run id for foreach iterations', async () => {
    const resumeFixture = createNestedResumeFixture(
      { 'suspended-child-step': [1, 0] },
      { stepResultShape: 'stripped', foreachIndex: 2 },
    );
    await resumeFixture.execute();
    expect(resumeFixture.loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: resumeFixture.nestedWorkflow.id,
      runId: `${resumeFixture.parentRunId}-foreach-2`,
    });
    expect(resumeFixture.invoke.mock.calls[0]?.[1].data.runId).toBe(`${resumeFixture.parentRunId}-foreach-2`);

    const freshFixture = createNestedResumeFixture({}, { mode: 'fresh', foreachIndex: 2 });
    await freshFixture.execute();
    expect(freshFixture.invoke).toHaveBeenCalledTimes(1);
    expect(freshFixture.invoke.mock.calls[0]?.[1].data.runId).toBe(`${freshFixture.parentRunId}-foreach-2`);
  });

  it('invokes a fresh nested run under the parent run id', async () => {
    const fixture = createNestedResumeFixture({}, { mode: 'fresh' });
    const { execute, invoke, parentRunId } = fixture;

    const result = await execute();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data.runId).toBe(parentRunId);
    expect(invoke.mock.calls[0]?.[1].data).toHaveProperty('initialState');
    expect(invoke.mock.calls[0]?.[1].data).not.toHaveProperty('resume');
    expect(result).toMatchObject({ status: 'success', output: { value: 'resumed' } });
  });

  it('logs the underlying error before flattening it into a failed result', async () => {
    const fixture = createNestedResumeFixture(
      { 'suspended-child-step': [1, 0] },
      {
        stepResultShape: 'stripped',
        withLoggerSpy: true,
        invokeImpl: async () => {
          throw new Error('child blew up');
        },
      },
    );
    const { execute, logger } = fixture;

    const result = await execute();

    expect(result).toMatchObject({ status: 'failed' });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toContain('child blew up');
  });
});
