import { MastraNonRetryableError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import { omitPriorCompletionFields } from '@mastra/core/workflows';
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
  opts: {
    /** Parent-side step result for the nested workflow; defaults to one with `suspendPayload` intact. */
    parentStepResult?: Record<string, unknown>;
    /** The only run id the (realistic) store answers for; defaults to the legacy stored child id. */
    knownRunId?: string;
    /** Simulate execution inside a foreach iteration. */
    foreachIndex?: number;
    /** Pass no `resume`, exercising the fresh-run path. */
    withResume?: boolean;
  } = {},
) {
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

  const nestedRunId = opts.knownRunId ?? 'nested-run';
  const nestedStepResults = Object.fromEntries(
    Object.keys(suspendedPaths).map(stepId => [stepId, { status: 'suspended', payload: { value: 'before-suspend' } }]),
  );
  // A realistic store answers only for run ids that actually exist.
  const loadWorkflowSnapshot = vi.fn(async ({ runId }: { runId: string }) =>
    runId === nestedRunId
      ? {
          value: { count: 1 },
          context: nestedStepResults,
          suspendedPaths,
        }
      : undefined,
  );
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
  const parentStepResult = opts.parentStepResult ?? {
    status: 'suspended',
    suspendPayload: { __workflow_meta: { runId: nestedRunId } },
  };
  const execute = () =>
    engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: {
        [nestedWorkflow.id]: parentStepResult as any,
      },
      executionContext: {
        workflowId: 'parent-workflow',
        runId: 'parent-run',
        executionPath: [0],
        suspendedPaths: {},
        state: {},
        ...(opts.foreachIndex !== undefined ? { foreachIndex: opts.foreachIndex } : {}),
      } as any,
      ...(opts.withResume === false ? {} : { resume: { steps: [nestedWorkflow.id], resumePayload } }),
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

  it('replays the memoized invoke when the child is no longer suspended (delivery pass)', async () => {
    // `step.invoke` parks the parent until the child finishes, so Inngest re-executes
    // this block with `resume` still on the event — by which point the child snapshot
    // has no suspended paths. That pass must replay, not throw.
    const { execute, invoke } = createNestedResumeFixture({});

    const result = await execute();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data).not.toHaveProperty('resume');
    expect(invoke.mock.calls[0]?.[1].data).toHaveProperty('initialState');
    expect(result?.status).toBe('success');
  });
});

describe('InngestExecutionEngine.executeWorkflowStep — derivable nested run ids (#23182)', () => {
  /** Exactly what core hands the nested branch after re-entry (handlers/step.ts). */
  function afterCoreReEntry(stepResult: Record<string, unknown>) {
    return {
      ...omitPriorCompletionFields(stepResult),
      status: 'running',
      resumePayload: { approved: true },
      resumedAt: Date.now(),
    };
  }

  const parkedStepResult = {
    status: 'suspended',
    payload: { value: 'before-suspend' },
    suspendPayload: { __workflow_meta: { runId: 'parent-run', path: ['suspended-child-step'] } },
  };

  it('resumes under the parent run id after core strips suspendPayload on re-entry', async () => {
    // Core persists the omitPriorCompletionFields-stripped step result before the
    // nested branch runs, and Inngest re-hydrates the parent from that snapshot —
    // so nothing stored on the step result survives to the resume pass.
    const parentStepResult = afterCoreReEntry(parkedStepResult);
    expect(parentStepResult.suspendPayload).toBeUndefined();

    const { execute, invoke, loadWorkflowSnapshot } = createNestedResumeFixture(
      { 'suspended-child-step': [1, 0] },
      { parentStepResult, knownRunId: 'parent-run' },
    );

    const result = await execute();

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({ workflowName: 'nested-resume-workflow', runId: 'parent-run' });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data.resume).toMatchObject({
      runId: 'parent-run',
      steps: ['suspended-child-step'],
      resumePath: [1, 0],
    });
    expect(result?.status).toBe('success');
  });

  it('starts a fresh nested run under the parent run id', async () => {
    const { execute, invoke } = createNestedResumeFixture({}, { knownRunId: 'parent-run', withResume: false });

    await execute();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data.runId).toBe('parent-run');
    expect(invoke.mock.calls[0]?.[1].data).toHaveProperty('initialState');
  });

  it('keys foreach iterations by index so concurrent iterations do not share a snapshot row', async () => {
    const fresh = createNestedResumeFixture(
      {},
      { knownRunId: 'parent-run-foreach-2', foreachIndex: 2, withResume: false },
    );
    await fresh.execute();
    expect(fresh.invoke.mock.calls[0]?.[1].data.runId).toBe('parent-run-foreach-2');

    // The same derivation applies on a resume whose suspendPayload was stripped.
    const resumed = createNestedResumeFixture(
      { 'suspended-child-step': [1, 0] },
      { parentStepResult: afterCoreReEntry(parkedStepResult), knownRunId: 'parent-run-foreach-2', foreachIndex: 2 },
    );
    const result = await resumed.execute();
    expect(resumed.loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: 'nested-resume-workflow',
      runId: 'parent-run-foreach-2',
    });
    expect(result?.status).toBe('success');
  });
});
