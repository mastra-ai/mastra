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

describe('InngestExecutionEngine.executeWorkflowStep', () => {
  it('restores the suspended child path when resuming with only the nested workflow id', async () => {
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
    const nestedStepResults = {
      [suspendedStep.id]: {
        status: 'suspended',
        payload: { value: 'before-suspend' },
      },
    };
    const loadWorkflowSnapshot = vi.fn().mockResolvedValue({
      value: { count: 1 },
      context: nestedStepResults,
      suspendedPaths: { [suspendedStep.id]: [1, 0] },
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
    const engine = new InngestExecutionEngine(mastra, inngestStep as any, 0, {});
    const resumePayload = { approved: true };

    await engine.executeWorkflowStep({
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
    });

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
});
