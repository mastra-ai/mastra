import { describe, expect, it, vi } from 'vitest';
import { InngestExecutionEngine } from './execution-engine';
import { compactNestedWorkflowResult } from './nested-workflow-output';
import { InngestWorkflow } from './workflow';

describe('nested workflow output compaction', () => {
  it('returns one copy of cumulative state after a successful invocation', () => {
    const sentinel = 'ROUND_A_UNIQUE_SENTINEL';
    const result = {
      status: 'success',
      input: { sentinel },
      steps: {
        first: { status: 'success', output: { sentinel } },
        second: { status: 'success', output: { sentinel } },
      },
      result: { sentinel },
      state: { iteration: 1 },
    } as any;

    const compactResult = compactNestedWorkflowResult(result);

    expect(compactResult).toEqual({
      status: 'success',
      result: { sentinel },
      state: { iteration: 1 },
    });
    expect(JSON.stringify(compactResult).split(sentinel)).toHaveLength(2);
  });

  it('retains steps only when they are required to resume a suspended workflow', () => {
    const steps = {
      approval: {
        status: 'suspended',
        payload: { pending: true },
        suspendPayload: { approvalId: 'approval-1' },
      },
    };
    const result = {
      status: 'suspended',
      input: { duplicated: 'input' },
      steps,
      state: { iteration: 2 },
      suspended: [['approval']],
      suspendPayload: { approvalId: 'approval-1' },
    } as any;

    expect(compactNestedWorkflowResult(result)).toEqual({
      status: 'suspended',
      steps,
      state: { iteration: 2 },
    });
  });

  it('retains the error but omits input and steps after a failed invocation', () => {
    const error = new Error('child failed');
    const result = {
      status: 'failed',
      input: { duplicated: 'input' },
      steps: { failed: { status: 'failed', error } },
      state: { iteration: 3 },
      error,
    } as any;

    expect(compactNestedWorkflowResult(result)).toEqual({
      status: 'failed',
      error,
      state: { iteration: 3 },
    });
  });
});

describe('InngestExecutionEngine nested workflow output', () => {
  it('requests compact output and consumes a successful compact result', async () => {
    const invoke = vi.fn().mockResolvedValue({
      result: { status: 'success', result: { answer: 42 }, state: { iteration: 1 } },
      runId: 'child-run',
    });
    const run = vi.fn(async (_id: string, operation: () => Promise<unknown>) => operation());
    const engine = new InngestExecutionEngine({} as any, { invoke, run } as any, 0, {} as any);
    const workflow = createNestedWorkflow('child');
    const executionContext = createExecutionContext();

    const result = await engine.executeWorkflowStep({
      step: workflow,
      stepResults: {},
      executionContext,
      prevOutput: {},
      inputData: { prompt: 'hello' },
      pubsub: { publish: vi.fn() } as any,
      startedAt: 100,
    });

    expect(invoke).toHaveBeenCalledWith(
      'workflow.parent.step.child',
      expect.objectContaining({
        data: expect.objectContaining({
          compactNestedWorkflowResult: true,
          outputOptions: { includeState: true },
        }),
      }),
    );
    expect(executionContext.state).toEqual({ iteration: 1 });
    expect(result).toEqual({
      status: 'success',
      output: { answer: 42 },
      startedAt: 100,
      endedAt: expect.any(Number),
      payload: { prompt: 'hello' },
    });
  });

  it('constructs resume metadata from suspended compact output', async () => {
    const invoke = vi.fn().mockResolvedValue({
      result: {
        status: 'suspended',
        state: { iteration: 1 },
        steps: {
          approval: {
            status: 'suspended',
            payload: { pending: true },
            suspendPayload: { approvalId: 'approval-1' },
          },
        },
      },
      runId: 'child-run',
    });
    const run = vi.fn(async (_id: string, operation: () => Promise<unknown>) => operation());
    const engine = new InngestExecutionEngine({} as any, { invoke, run } as any, 0, {} as any);
    const executionContext = createExecutionContext();

    const result = await engine.executeWorkflowStep({
      step: createNestedWorkflow('child'),
      stepResults: {},
      executionContext,
      prevOutput: {},
      inputData: { prompt: 'hello' },
      pubsub: { publish: vi.fn() } as any,
      startedAt: 100,
    });

    expect(result).toEqual({
      status: 'suspended',
      suspendedAt: expect.any(Number),
      payload: { prompt: 'hello' },
      suspendPayload: {
        approvalId: 'approval-1',
        __workflow_meta: { runId: 'child-run', path: ['approval'] },
      },
      startedAt: 100,
    });
    expect(executionContext.suspendedPaths.child).toEqual([0]);
  });
});

function createNestedWorkflow(id: string): InngestWorkflow {
  const workflow = Object.create(InngestWorkflow.prototype);
  Object.defineProperties(workflow, {
    id: { value: id },
    getFunction: { value: vi.fn().mockReturnValue({ id: `workflow.${id}` }) },
  });
  return workflow;
}

function createExecutionContext() {
  return {
    workflowId: 'parent',
    runId: 'parent-run',
    state: {},
    suspendedPaths: {},
    executionPath: [0],
  } as any;
}
