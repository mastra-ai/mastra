import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { PubSub } from '../events';
import { EventEmitterPubSub } from '../events/event-emitter';
import { DefaultExecutionEngine } from './default';
import type { FormattedWorkflowResult, StepResult } from './types';

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

  deserializeRequestContextPublic(obj: Record<string, any>): RequestContext {
    return this.deserializeRequestContext(obj);
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

describe('DefaultExecutionEngine.executeLoop cancellation', () => {
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

  // Reproduces https://github.com/mastra-ai/mastra/issues/15990
  // A long-running dountil loop should stop iterating once the run is
  // cancelled, even when the user's step does not observe abortSignal.
  it('should stop iterating a dountil loop when abortController is aborted between iterations', async () => {
    const workflowId = 'test-workflow';
    const runId = randomUUID();

    let iterations = 0;
    const step = {
      id: 'fetch-user',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: { iteration: number } }) => {
        iterations++;
        // Simulate a step that does NOT observe the abort signal,
        // matching the user's repro (raw setTimeout/fetch).
        // Trigger cancel while the second iteration is in-flight.
        if (iterations === 2) {
          abortController.abort();
        }
        return { iteration: (inputData?.iteration ?? 0) + 1 };
      },
    };

    const entry = {
      type: 'loop' as const,
      step,
      // dountil: stop when iteration >= 1000
      condition: async ({ inputData }: { inputData: { iteration: number } }) => inputData.iteration >= 1000,
      loopType: 'dountil' as const,
    };

    const result = await engine.executeLoop({
      workflowId,
      runId,
      entry,
      prevStep: { type: 'step', step } as any,
      prevOutput: { iteration: 0 },
      stepResults: {} as Record<string, StepResult<any, any, any, any>>,
      serializedStepGraph: [],
      executionContext: {
        workflowId,
        runId,
        executionPath: [0],
        stepExecutionPath: [],
        suspendedPaths: {},
        retryConfig: { attempts: 0, delay: 0 },
        activeStepsPath: {},
        resumeLabels: {},
        state: {},
      },
      pubsub,
      abortController,
      requestContext,
      tracingContext: {},
    });

    // The loop must terminate quickly with 'canceled' rather than running 1000 times.
    expect(result.status).toBe('canceled');
    // Should have stopped at the iteration that triggered cancel,
    // not run the full 1000 iterations.
    expect(iterations).toBeLessThan(10);
  }, 30_000);

  // The condition context exposes `abort()` and the run can also be cancelled
  // externally while the condition is awaiting. If the condition returns a
  // terminal value (e.g. dountil reaching its target) after that, the loop
  // must still surface 'canceled' rather than 'success'.
  it('should surface canceled when abortController is aborted during condition evaluation', async () => {
    const workflowId = 'test-workflow';
    const runId = randomUUID();

    let stepCalls = 0;
    const step = {
      id: 'fetch-user',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: { iteration: number } }) => {
        stepCalls++;
        return { iteration: (inputData?.iteration ?? 0) + 1 };
      },
    };

    const entry = {
      type: 'loop' as const,
      step,
      // Condition aborts the run mid-evaluation, then returns true (dountil
      // terminal value). Pre-fix, the loop exits as 'success'.
      condition: async ({ abort }: { abort: () => void }) => {
        abort();
        return true;
      },
      loopType: 'dountil' as const,
    };

    const result = await engine.executeLoop({
      workflowId,
      runId,
      entry,
      prevStep: { type: 'step', step } as any,
      prevOutput: { iteration: 0 },
      stepResults: {} as Record<string, StepResult<any, any, any, any>>,
      serializedStepGraph: [],
      executionContext: {
        workflowId,
        runId,
        executionPath: [0],
        stepExecutionPath: [],
        suspendedPaths: {},
        retryConfig: { attempts: 0, delay: 0 },
        activeStepsPath: {},
        resumeLabels: {},
        state: {},
      },
      pubsub,
      abortController,
      requestContext,
      tracingContext: {},
    });

    expect(result.status).toBe('canceled');
    expect(stepCalls).toBe(1);
  }, 30_000);
});

describe('DefaultExecutionEngine.executeForeach cancellation', () => {
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

  // Cancellation that lands before the next concurrency chunk starts must
  // stop the foreach from dispatching more work. Steps that ignore abortSignal
  // would otherwise let the loop keep iterating.
  it('should return canceled before dispatching the next concurrency chunk', async () => {
    const workflowId = 'test-workflow';
    const runId = randomUUID();

    let callCount = 0;
    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        callCount++;
        // Trigger cancel from inside a step but ignore the abort signal,
        // matching user steps that don't observe abortSignal (e.g. raw fetch).
        if (inputData === 1) {
          abortController.abort();
        }
        return inputData * 2;
      },
    };

    const entry = {
      type: 'foreach' as const,
      step,
      opts: { concurrency: 2 },
    };

    const result = await engine.executeForeach({
      workflowId,
      runId,
      entry,
      prevStep: { type: 'step', step } as any,
      prevOutput: [0, 1, 2, 3],
      stepResults: {} as Record<string, StepResult<any, any, any, any>>,
      serializedStepGraph: [],
      executionContext: {
        workflowId,
        runId,
        executionPath: [0],
        stepExecutionPath: [],
        suspendedPaths: {},
        retryConfig: { attempts: 0, delay: 0 },
        activeStepsPath: {},
        resumeLabels: {},
        state: {},
      },
      pubsub,
      abortController,
      requestContext,
      tracingContext: {},
    });

    expect(result.status).toBe('canceled');
    // Items 2 and 3 (the next chunk) must not have been dispatched.
    expect(callCount).toBe(2);
  }, 30_000);

  // Cancellation can land during the final concurrency chunk. Without the
  // post-loop abort check, the foreach would emit a successful workflow-step
  // result and persist 'success' even though the run was cancelled.
  it('should return canceled when abortController is aborted during the final chunk', async () => {
    const workflowId = 'test-workflow';
    const runId = randomUUID();

    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        // Single-chunk run (concurrency >= length), so this is the final chunk.
        // Step ignores abortSignal — only the post-loop check can catch it.
        if (inputData === 1) {
          abortController.abort();
        }
        return inputData * 2;
      },
    };

    const entry = {
      type: 'foreach' as const,
      step,
      opts: { concurrency: 4 },
    };

    const result = await engine.executeForeach({
      workflowId,
      runId,
      entry,
      prevStep: { type: 'step', step } as any,
      prevOutput: [0, 1],
      stepResults: {} as Record<string, StepResult<any, any, any, any>>,
      serializedStepGraph: [],
      executionContext: {
        workflowId,
        runId,
        executionPath: [0],
        stepExecutionPath: [],
        suspendedPaths: {},
        retryConfig: { attempts: 0, delay: 0 },
        activeStepsPath: {},
        resumeLabels: {},
        state: {},
      },
      pubsub,
      abortController,
      requestContext,
      tracingContext: {},
    });

    expect(result.status).toBe('canceled');
  }, 30_000);
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

describe('DefaultExecutionEngine.deserializeRequestContext', () => {
  it('should return a RequestContext instance with all entries from the plain object', () => {
    const engine = new TestableExecutionEngine({ mastra: undefined });
    const plainObj = { userId: 'user-123', tenantId: 'tenant-456', nested: { flag: true } };

    const result = engine.deserializeRequestContextPublic(plainObj);

    expect(result).toBeInstanceOf(RequestContext);
    expect(result.get('userId')).toBe('user-123');
    expect(result.get('tenantId')).toBe('tenant-456');
    expect(result.get('nested')).toEqual({ flag: true });
    expect(result.size()).toBe(3);
  });

  it('should return an empty RequestContext for an empty object', () => {
    const engine = new TestableExecutionEngine({ mastra: undefined });

    const result = engine.deserializeRequestContextPublic({});

    expect(result).toBeInstanceOf(RequestContext);
    expect(result.size()).toBe(0);
  });
});
