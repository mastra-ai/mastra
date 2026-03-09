import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { PubSub } from '../events';
import { EventEmitterPubSub } from '../events/event-emitter';
import { DefaultExecutionEngine } from './default';
import type { FormattedWorkflowResult, StepResult } from './types';
import { compactWorkflowResult } from './utils';

class TestableExecutionEngine extends DefaultExecutionEngine {
  async fmtReturnValuePublic(
    pubsub: PubSub,
    stepResults: Record<string, StepResult<any, any, any, any>>,
    lastOutput: StepResult<any, any, any, any>,
    error?: Error | unknown,
    stepExecutionPath?: string[],
  ) {
    return this.fmtReturnValue<FormattedWorkflowResult>(pubsub, stepResults, lastOutput, error, stepExecutionPath);
  }
}

describe('DefaultExecutionEngine.executeConditional error handling', () => {
  let engine: DefaultExecutionEngine;
  let pubsub: PubSub;
  let requestContext: RequestContext;
  let abortController: AbortController;

  beforeEach(() => {
    engine = new DefaultExecutionEngine({ mastra: undefined });
    pubsub = new EventEmitterPubSub();
    requestContext = new RequestContext();
    abortController = new AbortController();
  });

  async function runConditional({
    conditions,
    workflowId,
    runId,
  }: {
    conditions: any[];
    workflowId: string;
    runId: string;
  }) {
    const entry = {
      type: 'conditional' as const,
      steps: [
        {
          type: 'step' as const,
          step: {
            id: 'step1',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async () => ({ result: 'step1-output' }),
          },
        },
        {
          type: 'step' as const,
          step: {
            id: 'step2',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async () => ({ result: 'step2-output' }),
          },
        },
      ],
      conditions,
    };

    return await engine.executeConditional({
      workflowId,
      runId,
      entry,
      prevOutput: null,
      serializedStepGraph: [],
      stepResults: {} as Record<string, StepResult<any, any, any, any>>,
      executionContext: {
        workflowId,
        runId,
        executionPath: [],
        suspendedPaths: {} as Record<string, number[]>,
        retryConfig: {
          attempts: 3,
          delay: 1000,
        },
        activeStepsPath: {},
        resumeLabels: {},
        state: {},
      },
      pubsub,
      abortController,
      requestContext,
      tracingContext: {},
    });
  }

  it('should handle MastraError during condition evaluation and continue workflow', async () => {
    // Arrange: Set up conditions array with one throwing MastraError and one valid
    const mastraError = new MastraError({
      id: 'TEST_ERROR',
      domain: ErrorDomain.MASTRA_WORKFLOW,
      category: ErrorCategory.USER,
    });

    let truthyIndexes: number[] = [];
    const conditions = [
      async () => {
        throw mastraError;
      },
      async () => {
        truthyIndexes.push(1);
        return true;
      },
    ];

    // Act: Execute conditional with the conditions
    const result = await runConditional({
      conditions,
      workflowId: 'test-workflow',
      runId: randomUUID(),
    });

    // Assert: Verify error handling, truthyIndexes, and workflow continuation
    expect(result.status).toBe('success');
    expect(truthyIndexes).toEqual([1]); // Only second condition was truthy
    expect(Object.keys((result as any).output || {})).toHaveLength(1);
  });

  it('should wrap non-MastraError and handle condition evaluation failure', async () => {
    // Arrange: Set up conditions array with one throwing regular Error and one valid
    const regularError = new Error('Test regular error');
    const workflowId = 'test-workflow';
    const runId = randomUUID();

    // Mock the logger to capture trackException calls
    const mockTrackException = vi.fn();
    const mockError = vi.fn();
    (engine as any).logger = {
      trackException: mockTrackException,
      error: mockError,
    };

    let truthyIndexes: number[] = [];

    const conditions = [
      async () => {
        throw regularError; // This will be caught and wrapped internally, returning null
      },
      async () => {
        truthyIndexes.push(1);
        return true;
      },
    ];

    // Act: Execute conditional with the conditions
    const result = await runConditional({
      conditions,
      workflowId,
      runId,
    });

    // Assert: Verify error handling and workflow continuation
    expect(result.status).toBe('success');
    expect(truthyIndexes).toEqual([1]); // Only second condition was truthy
    expect(Object.keys((result as any).output || {})).toHaveLength(1);

    // Verify that trackException was called with the wrapped error
    expect(mockTrackException).toHaveBeenCalledTimes(1);
    const wrappedError = mockTrackException.mock.calls[0][0];

    // Verify the wrapped error properties
    expect(wrappedError).toBeInstanceOf(MastraError);
    expect(wrappedError.id).toBe('WORKFLOW_CONDITION_EVALUATION_FAILED');
    expect(wrappedError.domain).toBe(ErrorDomain.MASTRA_WORKFLOW);
    expect(wrappedError.category).toBe(ErrorCategory.USER);
    expect(wrappedError.details).toEqual({ workflowId, runId });

    // Verify that the original error is preserved as the cause
    expect(wrappedError.cause).toBe(regularError);
  });
});

describe('DefaultExecutionEngine.fmtReturnValue stepExecutionPath and payload deduplication', () => {
  let engine: TestableExecutionEngine;
  let pubsub: PubSub;

  beforeEach(() => {
    engine = new TestableExecutionEngine({ mastra: undefined });
    pubsub = new EventEmitterPubSub();
  });

  it('should include stepExecutionPath in the result', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: { status: 'success', output: { value: 2 }, payload: { value: 1 }, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(result.stepExecutionPath).toEqual(['step1']);
  });

  it('should remove payload when it matches the previous step output', async () => {
    const sharedData = { value: 1 };
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: sharedData as any,
      step1: { status: 'success', output: { value: 2 }, payload: sharedData, startedAt: 1, endedAt: 2 },
      step2: { status: 'success', output: { value: 3 }, payload: { value: 2 }, startedAt: 3, endedAt: 4 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step2!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1', 'step2']);

    expect(result.steps.step1.payload).toBeUndefined();
    expect(result.steps.step2.payload).toBeUndefined();
  });

  it('should preserve payload when it does not match the previous step output', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: { status: 'success', output: { value: 2 }, payload: { different: true }, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(result.steps.step1.payload).toEqual({ different: true });
  });

  it('should handle structural equality after deserialization', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: {
        status: 'success',
        output: { value: 2 },
        payload: JSON.parse(JSON.stringify({ value: 1 })),
        startedAt: 1,
        endedAt: 2,
      },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(result.steps.step1.payload).toBeUndefined();
  });

  it('should not deduplicate when there is no input in stepResults', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      step1: { status: 'success', output: { value: 2 }, payload: { value: 1 }, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(result.steps.step1.payload).toEqual({ value: 1 });
  });

  it('should not mutate original stepResults', async () => {
    const originalPayload = { value: 1 };
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: { status: 'success', output: { value: 2 }, payload: originalPayload, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(stepResults.step1!.payload).toBe(originalPayload);
  });

  it('should not apply deduplication when stepExecutionPath is not provided', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: { status: 'success', output: { value: 2 }, payload: { value: 1 }, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput);

    expect(result.stepExecutionPath).toBeUndefined();
    expect(result.steps.step1.payload).toEqual({ value: 1 });
  });

  it('should skip steps in path that are not in stepResults', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step2: { status: 'success', output: { value: 3 }, payload: { value: 1 }, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step2!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, [
      'missing_step',
      'step2',
    ]);

    expect(result.steps.step2.payload).toBeUndefined();
  });

  it('should only track previous output from successful steps', async () => {
    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: {
        status: 'failed',
        error: new Error('fail'),
        output: { value: 999 },
        payload: { value: 1 },
        startedAt: 1,
        endedAt: 2,
      },
      step2: { status: 'success', output: { value: 3 }, payload: { value: 1 }, startedAt: 3, endedAt: 4 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step2!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1', 'step2']);

    // step1 payload matches input, should be removed
    expect(result.steps.step1.payload).toBeUndefined();
    // step2 payload matches input (not step1.output since step1 failed), should be removed
    expect(result.steps.step2.payload).toBeUndefined();
  });

  it('should not throw when payload contains non-JSON-serializable values', async () => {
    const circular: any = { value: 1 };
    circular.self = circular;

    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: { value: 1 } as any,
      step1: { status: 'success', output: { value: 2 }, payload: circular, startedAt: 1, endedAt: 2 },
    };
    const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

    const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

    expect(result.steps.step1.payload).toBe(circular);
  });
});

describe('compactWorkflowResult', () => {
  it('should strip steps from a full FormattedWorkflowResult', () => {
    const full: Record<string, unknown> = {
      status: 'success',
      steps: {
        step1: { status: 'success', output: { value: 1 }, payload: { input: true }, startedAt: 1, endedAt: 2 },
        step2: { status: 'success', output: { value: 2 }, payload: { value: 1 }, startedAt: 3, endedAt: 4 },
      },
      input: { input: true },
      result: { value: 2 },
      stepExecutionPath: ['step1', 'step2'],
    };

    const compact = compactWorkflowResult(full);

    expect(compact).toEqual({
      status: 'success',
      result: { value: 2 },
      stepExecutionPath: ['step1', 'step2'],
    });
    expect(compact).not.toHaveProperty('steps');
    expect(compact).not.toHaveProperty('input');
  });

  it('should preserve error and suspended fields when present', () => {
    const full: Record<string, unknown> = {
      status: 'failed',
      steps: { step1: { status: 'failed', error: new Error('boom') } },
      input: {},
      error: { message: 'boom', name: 'Error' },
    };

    const compact = compactWorkflowResult(full);

    expect(compact).toEqual({
      status: 'failed',
      error: { message: 'boom', name: 'Error' },
    });
  });

  it('should preserve suspended fields', () => {
    const full: Record<string, unknown> = {
      status: 'suspended',
      steps: { step1: { status: 'suspended' } },
      input: {},
      suspended: [['step1']],
      suspendPayload: { step1: { data: 'please resume' } },
    };

    const compact = compactWorkflowResult(full);

    expect(compact).toEqual({
      status: 'suspended',
      suspended: [['step1']],
      suspendPayload: { step1: { data: 'please resume' } },
    });
  });

  it('should return non-workflow results as-is', () => {
    const plain = { foo: 'bar', count: 42 };
    const compact = compactWorkflowResult(plain);
    expect(compact).toBe(plain);
  });

  it('should omit result when it is undefined', () => {
    const full: Record<string, unknown> = {
      status: 'success',
      steps: { step1: { status: 'success', output: undefined } },
      input: {},
    };

    const compact = compactWorkflowResult(full);

    expect(compact).toEqual({ status: 'success' });
    expect(compact).not.toHaveProperty('result');
  });

  it('should preserve falsy result values (null, 0, empty string, false)', () => {
    for (const falsyValue of [null, 0, '', false]) {
      const full: Record<string, unknown> = {
        status: 'success',
        steps: { step1: { status: 'success', output: falsyValue } },
        input: {},
        result: falsyValue,
      };

      const compact = compactWorkflowResult(full);

      expect(compact).toHaveProperty('result', falsyValue);
    }
  });
});
