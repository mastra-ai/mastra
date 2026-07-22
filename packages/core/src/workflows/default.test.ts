import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../di';
import { MastraError, MastraNonRetryableError, ErrorDomain, ErrorCategory } from '../error';
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

describe('DefaultExecutionEngine.serializeRequestContext', () => {
  it('should correctly serialize serializable values', () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const ctx = new RequestContext();
    ctx.set('userId', 'user-123');
    ctx.set('feature', 'dark-mode');
    ctx.set('count', 42);

    const result = engine.serializeRequestContext(ctx);

    expect(result).toEqual({
      userId: 'user-123',
      feature: 'dark-mode',
      count: 42,
    });
  });

  it('should skip non-serializable values (functions)', () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const ctx = new RequestContext();
    ctx.set('userId', 'user-123');
    ctx.set('callback', () => {});

    const result = engine.serializeRequestContext(ctx);

    expect(result).toEqual({
      userId: 'user-123',
    });
    expect(result).not.toHaveProperty('callback');
  });

  it('should skip objects with circular references', () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const ctx = new RequestContext();
    ctx.set('userId', 'user-123');

    const circular: Record<string, unknown> = { name: 'circular' };
    circular.self = circular;
    ctx.set('circular', circular);

    const result = engine.serializeRequestContext(ctx);

    expect(result).toEqual({
      userId: 'user-123',
    });
    expect(result).not.toHaveProperty('circular');
  });

  it('should skip non-serializable objects like RPC proxies', () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const ctx = new RequestContext();
    ctx.set('userId', 'user-123');

    const rpcProxy = new Proxy(
      {},
      {
        get(target, prop) {
          if (prop === 'toJSON') {
            throw new TypeError('The RPC receiver does not implement the method "toJSON".');
          }
          return Reflect.get(target, prop);
        },
      },
    );
    ctx.set('rpcProxy', rpcProxy);

    const result = engine.serializeRequestContext(ctx);

    expect(result).toEqual({
      userId: 'user-123',
    });
    expect(result).not.toHaveProperty('rpcProxy');
  });
});

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
    stepResults = {} as Record<string, StepResult<any, any, any, any>>,
    timeTravel,
    executionPath = [],
  }: {
    conditions: any[];
    workflowId: string;
    runId: string;
    stepResults?: Record<string, StepResult<any, any, any, any>>;
    timeTravel?: {
      executionPath: number[];
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      inputData?: any;
    };
    executionPath?: number[];
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

    const result = await engine.executeConditional({
      workflowId,
      runId,
      entry,
      prevOutput: null,
      serializedStepGraph: [],
      stepResults,
      timeTravel: timeTravel as any,
      executionContext: {
        workflowId,
        runId,
        executionPath,
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

    return { result, stepResults };
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
    const { result } = await runConditional({
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
    const { result } = await runConditional({
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

  // Regression coverage for the time-travel conditional reconciliation in
  // packages/core/src/workflows/handlers/control-flow.ts. When a paused run is rehydrated and
  // time-travelled into a conditional, createTimeTravelExecutionParams pre-marks the targeted arm
  // as 'running'. If the condition re-evaluates and selects a different arm, the targeted-but-
  // rejected arm must be rewritten to 'skipped' so the wrong branch is neither rendered as active
  // nor executed on the rehydrated run.
  describe('conditional time-travel reconciliation', () => {
    it("rewrites a targeted-but-non-truthy arm from 'running' to 'skipped' during time travel", async () => {
      const workflowId = 'test-workflow';
      const runId = randomUUID();

      // arm step1 (index 0) is truthy, arm step2 (index 1) is NOT truthy.
      const conditions = [async () => true, async () => false];

      // Mirror createTimeTravelExecutionParams: the targeted arm (step2) is pre-marked 'running'.
      const stepResults: Record<string, StepResult<any, any, any, any>> = {
        step2: {
          status: 'running',
          payload: { from: 'time-travel' },
          startedAt: Date.now(),
        } as unknown as StepResult<any, any, any, any>,
      };

      const { result, stepResults: finalStepResults } = await runConditional({
        conditions,
        workflowId,
        runId,
        stepResults,
        executionPath: [0],
        timeTravel: {
          executionPath: [0],
          steps: ['step2'],
          stepResults: {},
        },
      });

      // The rejected arm is reconciled to 'skipped' with the expected bookkeeping fields.
      expect(finalStepResults.step2.status).toBe('skipped');
      expect(finalStepResults.step2).toHaveProperty('payload');
      expect(finalStepResults.step2).toHaveProperty('startedAt');
      expect(finalStepResults.step2).toHaveProperty('endedAt');

      // The truthy arm (step1) still runs and the conditional succeeds.
      expect(result.status).toBe('success');
      expect(finalStepResults.step2.status).not.toBe('running');
    });

    it("leaves a 'running' arm untouched for normal start/resume (no time travel)", async () => {
      const workflowId = 'test-workflow';
      const runId = randomUUID();

      const conditions = [async () => true, async () => false];

      const stepResults: Record<string, StepResult<any, any, any, any>> = {
        step2: {
          status: 'running',
          payload: {},
          startedAt: Date.now(),
        } as unknown as StepResult<any, any, any, any>,
      };

      const { stepResults: finalStepResults } = await runConditional({
        conditions,
        workflowId,
        runId,
        stepResults,
        // no timeTravel param -> reconciliation must not fire
      });

      expect(finalStepResults.step2.status).toBe('running');
    });
  });
});

describe('DefaultExecutionEngine.executeEntry resume payload handling', () => {
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

  it('should use the suspended step payload when resuming a step with stale previous output', async () => {
    const workflowId = 'resume-payload-repro';
    const runId = randomUUID();
    const resumedStep = {
      id: 'needs-approval',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ resumed: z.boolean(), receivedId: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData }: { inputData: { id: string }; resumeData?: { approved: boolean } }) => {
        return { resumed: resumeData?.approved ?? false, receivedId: inputData.id };
      },
    };
    const producerStep = {
      id: 'producer',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({ stale: true }),
    };
    const stepResults = {
      producer: {
        status: 'success',
        output: { stale: true },
        payload: {},
      },
      'needs-approval': {
        status: 'suspended',
        payload: { id: 'from-suspended-snapshot' },
        suspendPayload: { reason: 'manual-review' },
        suspendedAt: Date.now(),
      },
    } as Record<string, StepResult<any, any, any, any>>;

    const result = await engine.executeEntry({
      workflowId,
      runId,
      entry: { type: 'step', step: resumedStep },
      prevStep: { type: 'step', step: producerStep },
      serializedStepGraph: [],
      stepResults,
      resume: {
        steps: ['needs-approval'],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [],
      },
      executionContext: {
        workflowId,
        runId,
        executionPath: [1],
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

    expect(result.result).toMatchObject({
      status: 'success',
      output: { resumed: true, receivedId: 'from-suspended-snapshot' },
    });
  });

  it('should use a null suspended step payload when resuming a step with stale previous output', async () => {
    const workflowId = 'resume-null-payload-repro';
    const runId = randomUUID();
    const resumedStep = {
      id: 'needs-approval',
      inputSchema: z.null(),
      outputSchema: z.object({ resumed: z.boolean(), receivedNull: z.boolean() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData }: { inputData: null; resumeData?: { approved: boolean } }) => {
        return { resumed: resumeData?.approved ?? false, receivedNull: inputData === null };
      },
    };
    const producerStep = {
      id: 'producer',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({ stale: true }),
    };
    const stepResults = {
      producer: {
        status: 'success',
        output: { stale: true },
        payload: {},
      },
      'needs-approval': {
        status: 'suspended',
        payload: null,
        suspendPayload: { reason: 'manual-review' },
        suspendedAt: Date.now(),
      },
    } as Record<string, StepResult<any, any, any, any>>;

    const result = await engine.executeEntry({
      workflowId,
      runId,
      entry: { type: 'step', step: resumedStep },
      prevStep: { type: 'step', step: producerStep },
      serializedStepGraph: [],
      stepResults,
      resume: {
        steps: ['needs-approval'],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [],
      },
      executionContext: {
        workflowId,
        runId,
        executionPath: [1],
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

    expect(result.result).toMatchObject({
      status: 'success',
      output: { resumed: true, receivedNull: true },
    });
  });

  it('should use the suspended foreach payload when resuming with stale previous output', async () => {
    const workflowId = 'resume-foreach-payload-repro';
    const runId = randomUUID();
    const foreachStep = {
      id: 'process-item',
      inputSchema: z.number(),
      outputSchema: z.number(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData }: { inputData: number }) => inputData + 1,
    };
    const producerStep = {
      id: 'producer',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({ stale: true }),
    };
    const stepResults = {
      producer: {
        status: 'success',
        output: { stale: true },
        payload: {},
      },
      'process-item': {
        status: 'suspended',
        payload: [10, 20],
        suspendPayload: {
          __workflow_meta: {
            foreachIndex: 0,
            foreachOutput: [{ status: 'suspended', suspendPayload: {}, suspendedAt: Date.now() }],
            resumeLabels: {},
          },
        },
        suspendedAt: Date.now(),
      },
    } as Record<string, StepResult<any, any, any, any>>;

    const result = await engine.executeEntry({
      workflowId,
      runId,
      entry: { type: 'foreach', step: foreachStep, opts: { concurrency: 1 } },
      prevStep: { type: 'step', step: producerStep },
      serializedStepGraph: [],
      stepResults,
      resume: {
        steps: ['process-item'],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [],
        forEachIndex: 0,
      },
      executionContext: {
        workflowId,
        runId,
        executionPath: [1],
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

    expect(result.result).toMatchObject({
      status: 'success',
      output: [11, 21],
    });
  });
});

describe('DefaultExecutionEngine.executeLoop resume payload handling', () => {
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

  it('should use a null suspended loop payload when resuming with stale previous output', async () => {
    const workflowId = 'resume-loop-null-payload-repro';
    const runId = randomUUID();
    const step = {
      id: 'loop-step',
      inputSchema: z.null(),
      outputSchema: z.object({ receivedNull: z.boolean() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData }: { inputData: null }) => ({ receivedNull: inputData === null }),
    };
    const stepResults = {
      'loop-step': {
        status: 'suspended',
        payload: null,
        suspendPayload: { reason: 'manual-review' },
        suspendedAt: Date.now(),
      },
    } as Record<string, StepResult<any, any, any, any>>;

    const result = await engine.executeLoop({
      workflowId,
      runId,
      entry: {
        type: 'loop',
        step,
        condition: async () => true,
        loopType: 'dountil',
      },
      prevStep: { type: 'step', step } as any,
      prevOutput: { stale: true },
      stepResults,
      resume: {
        steps: ['loop-step'],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [],
      },
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

    expect(result).toMatchObject({
      status: 'success',
      output: { receivedNull: true },
    });
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

describe('DefaultExecutionEngine.executeForeach concurrency', () => {
  let engine: DefaultExecutionEngine;
  let pubsub: PubSub;
  let requestContext: RequestContext;
  let abortController: AbortController;

  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(res => {
      resolve = res;
    });
    return { promise, resolve };
  };

  const waitFor = async (predicate: () => boolean, timeout = 1000) => {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > timeout) {
        throw new Error('Timed out waiting for foreach test condition');
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };

  const runForeach = async ({
    step,
    prevOutput,
    concurrency,
    workflowId = 'test-workflow',
    runId = randomUUID(),
  }: {
    step: any;
    prevOutput: any[];
    concurrency: number | ((ctx: { inputData: unknown; getInitData: () => unknown }) => number);
    workflowId?: string;
    runId?: string;
  }) =>
    engine.executeForeach({
      workflowId,
      runId,
      entry: {
        type: 'foreach' as const,
        step,
        opts: { concurrency },
      },
      prevStep: { type: 'step', step } as any,
      prevOutput,
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

  beforeEach(() => {
    engine = new DefaultExecutionEngine({ mastra: undefined });
    pubsub = new EventEmitterPubSub();
    requestContext = new RequestContext();
    abortController = new AbortController();
  });

  it('keeps concurrency slots filled and preserves ordered results while progress follows completion order', async () => {
    const runId = randomUUID();
    const firstItemGate = deferred();
    const starts: number[] = [];
    const completed: number[] = [];
    const progressEvents: any[] = [];
    let active = 0;
    let maxActive = 0;

    await pubsub.subscribe(`workflow.events.v2.${runId}`, event => {
      if (event.data.type === 'workflow-step-progress') {
        progressEvents.push(event.data.payload);
      }
    });

    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        starts.push(inputData);
        active++;
        maxActive = Math.max(maxActive, active);
        try {
          if (inputData === 0) {
            await firstItemGate.promise;
          }
          return inputData * 2;
        } finally {
          completed.push(inputData);
          active--;
        }
      },
    };

    const resultPromise = runForeach({ step, prevOutput: [0, 1, 2, 3], concurrency: 2, runId });

    await waitFor(() => starts.includes(2));

    expect(starts.slice(0, 3)).toEqual([0, 1, 2]);
    expect(completed).not.toContain(0);
    expect(maxActive).toBeLessThanOrEqual(2);

    firstItemGate.resolve();
    const result = await resultPromise;

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toEqual([0, 2, 4, 6]);
    }
    expect(maxActive).toBe(2);
    expect(progressEvents.map(event => event.currentIndex)).toEqual([1, 2, 3, 0]);
    expect(progressEvents.map(event => event.iterationOutput)).toEqual([2, 4, 6, 0]);
    expect(progressEvents.map(event => event.iterationStatus)).toEqual(['success', 'success', 'success', 'success']);
  });

  it('stops queued work and returns failed when an iteration fails', async () => {
    const firstItemGate = deferred();
    const starts: number[] = [];
    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        starts.push(inputData);
        if (inputData === 0) {
          await firstItemGate.promise;
          return inputData;
        }
        if (inputData === 1) {
          throw new Error('item failed');
        }
        return inputData;
      },
    };

    const resultPromise = runForeach({ step, prevOutput: [0, 1, 2, 3], concurrency: 2 });

    await waitFor(() => starts.includes(1));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(starts).toEqual([0, 1]);

    firstItemGate.resolve();
    const result = await resultPromise;

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('item failed');
    }
  });

  it('stops queued work and returns suspended when an iteration suspends', async () => {
    const firstItemGate = deferred();
    const starts: number[] = [];
    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      suspendSchema: z.object({ item: z.number() }),
      execute: async ({
        inputData,
        suspend,
      }: {
        inputData: number;
        suspend: (payload: { item: number }) => Promise<void>;
      }) => {
        starts.push(inputData);
        if (inputData === 0) {
          await firstItemGate.promise;
          return inputData;
        }
        if (inputData === 1) {
          await suspend({ item: inputData });
          return inputData;
        }
        return inputData;
      },
    };

    const resultPromise = runForeach({ step, prevOutput: [0, 1, 2, 3], concurrency: 2 });

    await waitFor(() => starts.includes(1));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(starts).toEqual([0, 1]);

    firstItemGate.resolve();
    const result = await resultPromise;

    expect(result.status).toBe('suspended');
    if (result.status === 'suspended') {
      expect(result.suspendPayload?.item).toBe(1);
      expect(result.suspendPayload?.__workflow_meta.foreachIndex).toBe(1);
      expect(result.suspendPayload?.__workflow_meta.foreachOutput[0]).toMatchObject({ status: 'success', output: 0 });
      expect(result.suspendPayload?.__workflow_meta.foreachOutput[1]).toMatchObject({
        status: 'suspended',
        suspendPayload: { item: 1 },
      });
    }
  });

  // Concurrency may be a resolver function evaluated at execution time from the
  // run's input, instead of a static number (used by durable agents to derive
  // tool-call concurrency from serialized run state).
  it('resolves concurrency from a resolver function at execution time', async () => {
    const gate = deferred();
    const starts: number[] = [];
    let active = 0;
    let maxActive = 0;
    const resolverContexts: { inputData: unknown }[] = [];

    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        starts.push(inputData);
        active++;
        maxActive = Math.max(maxActive, active);
        try {
          if (inputData === 0) {
            await gate.promise;
          }
          return inputData * 2;
        } finally {
          active--;
        }
      },
    };

    const resultPromise = runForeach({
      step,
      prevOutput: [0, 1, 2, 3],
      concurrency: ctx => {
        resolverContexts.push({ inputData: ctx.inputData });
        return 2;
      },
    });

    await waitFor(() => starts.includes(2));
    expect(maxActive).toBeLessThanOrEqual(2);

    gate.resolve();
    const result = await resultPromise;

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toEqual([0, 2, 4, 6]);
    }
    expect(maxActive).toBe(2);
    // Resolver is called at execution time with the foreach input.
    expect(resolverContexts).toEqual([{ inputData: [0, 1, 2, 3] }]);
  });

  it('falls back to sequential execution when the resolver returns an invalid value', async () => {
    let maxActive = 0;
    let active = 0;

    const step = {
      id: 'process-item',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: { inputData: number }) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        return inputData;
      },
    };

    const result = await runForeach({
      step,
      prevOutput: [0, 1, 2],
      concurrency: () => Number.NaN,
    });

    expect(result.status).toBe('success');
    expect(maxActive).toBe(1);
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

  describe('oversized payloads (#19373)', () => {
    // Builds a payload whose leaves count how many times they get JSON-serialized,
    // so the tests can assert the dedup comparison does bounded work instead of
    // serializing multi-megabyte step payloads in full on every call.
    function makeCountingPayload(leafCount: number, counter: { count: number }) {
      return {
        parts: Array.from({ length: leafCount }, (_, i) => ({
          toJSON() {
            counter.count++;
            return `leaf-${i}-${'x'.repeat(64)}`;
          },
        })),
      };
    }

    it('should retain (not dedup) an oversized payload even when it structurally matches the previous output', async () => {
      // ~1.4 MB of identical content on both sides — structurally equal, far past any
      // reasonable dedup bound. The optimization exists to shrink small execution-log
      // entries; for oversized values retaining the payload is the safe outcome.
      const bigParts = Array.from({ length: 20_000 }, (_, i) => `part-${i}-${'x'.repeat(64)}`);
      const stepResults: Record<string, StepResult<any, any, any, any>> = {
        input: { parts: bigParts } as any,
        step1: {
          status: 'success',
          output: { value: 2 },
          payload: { parts: [...bigParts] },
          startedAt: 1,
          endedAt: 2,
        },
      };
      const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

      const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

      expect(result.steps.step1.payload).toEqual({ parts: bigParts });
    });

    it('should do bounded serialization work per step instead of stringifying huge payloads in full', async () => {
      const counter = { count: 0 };
      const leafCount = 50_000;
      const stepResults: Record<string, StepResult<any, any, any, any>> = {
        input: makeCountingPayload(leafCount, counter) as any,
        step1: {
          status: 'success',
          output: { value: 2 },
          payload: makeCountingPayload(leafCount, counter),
          startedAt: 1,
          endedAt: 2,
        },
      };
      const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

      await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

      // Unbounded comparison serializes every leaf on both sides (100k+ toJSON calls).
      // A bounded comparison aborts once the size cap is hit, so only a small prefix
      // of each side is ever visited.
      expect(counter.count).toBeLessThan(5_000);
    });

    it('should still dedup small structurally-equal payloads below the bound', async () => {
      const small = { items: ['a', 'b', 'c'], nested: { value: 1 } };
      const stepResults: Record<string, StepResult<any, any, any, any>> = {
        input: JSON.parse(JSON.stringify(small)) as any,
        step1: {
          status: 'success',
          output: { value: 2 },
          payload: JSON.parse(JSON.stringify(small)),
          startedAt: 1,
          endedAt: 2,
        },
      };
      const lastOutput: StepResult<any, any, any, any> = stepResults.step1!;

      const result = await engine.fmtReturnValuePublic(pubsub, stepResults, lastOutput, undefined, ['step1']);

      expect(result.steps.step1.payload).toBeUndefined();
    });
  });
});

describe('DefaultExecutionEngine.deserializeRequestContext', () => {
  it('should produce JSON-safe serialized request context values', () => {
    const engine = new TestableExecutionEngine({ mastra: undefined });
    const requestContext = new RequestContext();
    const circular: any = { name: 'service' };
    circular.self = circular;

    requestContext.set('userId', 'user-123');
    requestContext.set('progressEmitter', () => undefined);
    requestContext.set('service', circular);

    const serialized = engine.serializeRequestContext(requestContext);

    expect(() => JSON.stringify(requestContext.toJSON())).not.toThrow();
    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(serialized).toEqual({ userId: 'user-123' });
  });

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

describe('DefaultExecutionEngine.execute cancellation onFinish contract', () => {
  it('should format returned steps and onFinish steps identically for canceled runs', async () => {
    const pubsub = new EventEmitterPubSub();
    const requestContext = new RequestContext();
    const abortController = new AbortController();

    let onFinishResult: any = null;
    const engine = new DefaultExecutionEngine({
      mastra: undefined,
      options: {
        validateInputs: true,
        shouldPersistSnapshot: () => false,
        onFinish: (result: any) => {
          onFinishResult = result;
        },
      } as any,
    });

    const persistSpy = vi.spyOn(engine as any, 'persistStepUpdate').mockResolvedValue(undefined);

    // Inject metadata during step execution start to test stripping
    vi.spyOn(engine, 'onStepExecutionStart').mockImplementation(async ({ stepInfo }) => {
      stepInfo.metadata = { nestedRunId: 'nested-123', customField: 'keep-me' };
    });

    const step1 = {
      id: 'step1',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: any) => {
        // Trigger cancel during step 1 so step 2 is skipped and engine loop catches cancellation
        abortController.abort();
        // Return a payload matching input to test deduplication
        return {
          ...inputData,
        };
      },
    };

    const step2 = {
      id: 'step2',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => {
        return { data: 'should-not-run' };
      },
    };

    const graph = {
      id: 'test-graph',
      steps: [
        { type: 'step' as const, step: step1 },
        { type: 'step' as const, step: step2 },
      ],
    };

    const inputData = { data: 'test-input' };

    const result = await engine.execute({
      workflowId: 'test-workflow',
      runId: 'test-run',
      graph,
      input: inputData,
      serializedStepGraph: [],
      pubsub,
      requestContext,
      abortController,
      outputOptions: { includeState: true },
    });

    expect(result.status).toBe('canceled');
    expect(result.runId).toBe('test-run');
    expect(result.state).toBeDefined(); // Ensure state exists in output

    // Top-level input is preserved
    expect((result as any).input).toEqual(inputData);

    expect(onFinishResult).toBeDefined();
    expect(onFinishResult?.status).toBe('canceled');

    // The returned steps and onFinish steps should be identically normalized
    expect(result.steps).toEqual(onFinishResult?.steps);

    // Payload deduplication: step1 output matches input, so payload should be removed
    const step1Result = result.steps?.step1 as any;
    expect(step1Result?.payload).toBeUndefined();

    // Ensure raw nestedRunId is omitted from formatted steps, but other metadata is preserved
    expect(step1Result?.metadata?.nestedRunId).toBeUndefined();
    expect(step1Result?.metadata?.customField).toBe('keep-me');

    // Verify raw persistence: persistStepUpdate receives the un-deduplicated payload and raw metadata
    expect(persistSpy).toHaveBeenCalled();
    const persistArgs = persistSpy.mock.calls[0][0] as any;
    expect(persistArgs.stepResults.step1.payload).toEqual(inputData);
    expect(persistArgs.stepResults.step1.metadata?.nestedRunId).toBe('nested-123');
  });
});

describe('DefaultExecutionEngine.executeStepWithRetry', () => {
  it('does not retry when the step throws MastraNonRetryableError', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
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
      expect(result.error.error.message).toBe('permanent failure');
    }
  });

  it('retries transient errors until retry attempts are exhausted', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
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
