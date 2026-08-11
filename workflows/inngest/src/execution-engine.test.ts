import { MastraNonRetryableError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
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

  return new InngestExecutionEngine(undefined as any, inngestStep as any, 0, {});
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
  const run = vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn());
  const inngestStep = {
    invoke,
    run,
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
  };
  const engine = new InngestExecutionEngine(mastra, inngestStep as any, 0, {});
  const resumePayload = { approved: true };
  const operationId = 'workflow.parent-workflow.step.nested-resume-workflow.path.[0].iteration.2.resume.1';
  const execute = () =>
    engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: {
        [nestedWorkflow.id]: {
          status: 'suspended',
          suspendPayload: { __workflow_meta: { runId: nestedRunId } },
        },
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
      operationId,
    });

  return {
    execute,
    invoke,
    loadWorkflowSnapshot,
    nestedRunId,
    nestedStepResults,
    nestedWorkflow,
    operationId,
    resumePayload,
    run,
    suspendedStep,
  };
}

describe('InngestExecutionEngine.executeWorkflowStep', () => {
  it('propagates a loop-scoped operation ID to nested invoke and result persistence', async () => {
    const inngest = new Inngest({ id: 'nested-operation-id-test' });
    const { createWorkflow, createStep } = init(inngest);
    const nestedStep = createStep({
      id: 'nested-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const nestedWorkflow = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [nestedStep],
    })
      .then(nestedStep)
      .commit();
    const invoke = vi.fn().mockResolvedValue({
      result: { status: 'success', result: { value: 'done' }, state: {} },
      runId: 'nested-run',
    });
    const run = vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn());
    const engine = new InngestExecutionEngine(
      undefined as any,
      { invoke, run, sleep: vi.fn(), sleepUntil: vi.fn() } as any,
      0,
      {},
    );

    const result = await engine.executeStep({
      workflowId: 'parent-workflow',
      runId: 'parent-run',
      step: nestedWorkflow as any,
      stepResults: {},
      executionContext: {
        workflowId: 'parent-workflow',
        runId: 'parent-run',
        executionPath: [0],
        stepExecutionPath: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        retryConfig: { attempts: 0, delay: 0 },
        state: {},
      },
      prevOutput: { value: 'start' },
      pubsub: { publish: vi.fn().mockResolvedValue(undefined) } as any,
      abortController: new AbortController(),
      requestContext: new RequestContext(),
      serializedStepGraph: [],
      iterationCount: 2,
      tracingContext: {},
    });

    const operationId = 'workflow.parent-workflow.step.nested-workflow.path.[0].iteration.2';
    expect(result.result).toMatchObject({ status: 'success', output: { value: 'done' } });
    expect(invoke).toHaveBeenCalledWith(operationId, expect.any(Object));
    expect(run).toHaveBeenCalledWith(`${operationId}.nestedwf-results`, expect.any(Function));
  });

  it('restores the suspended child path when resuming with only the nested workflow id', async () => {
    const fixture = createNestedResumeFixture({ 'suspended-child-step': [1, 0] });
    const {
      execute,
      invoke,
      loadWorkflowSnapshot,
      nestedRunId,
      nestedStepResults,
      nestedWorkflow,
      resumePayload,
      suspendedStep,
    } = fixture;

    await execute();

    expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
      workflowName: nestedWorkflow.id,
      runId: nestedRunId,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[1].data.resume).toEqual({
      runId: nestedRunId,
      steps: [suspendedStep.id],
      stepResults: nestedStepResults,
      resumePayload,
      resumePath: [1, 0],
    });
  });

  it('uses the scoped operation ID for nested invoke and result persistence', async () => {
    const { execute, invoke, operationId, run } = createNestedResumeFixture({ 'suspended-child-step': [1, 0] });

    await execute();

    expect(invoke).toHaveBeenCalledWith(operationId, expect.any(Object));
    expect(run).toHaveBeenCalledWith(`${operationId}.nestedwf-results`, expect.any(Function));
  });

  it.each([
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
