import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from '../../error';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import type { StepFlowEntry, StepResult } from '../types';
import { createStep } from '../workflow';
import { StepExecutor } from './step-executor';

interface SleepFnContext {
  workflowId: string;
  runId: string;
  mastra: Mastra;
  requestContext: RequestContext;
  inputData: any;
  retryCount: number;
  resumeData: any;
  getInitData: () => any;
  getStepResult: (step: { id?: string }) => any;
  suspend: (suspendPayload: any) => Promise<any>;
  bail: (result: any) => void;
  abort: () => void;
  writer: any;
  engine: Record<string, unknown>;
  abortSignal: AbortSignal;
  tracingContext: Record<string, unknown>;
  [key: string]: any; // For EMITTER_SYMBOL
}

describe('StepExecutor', () => {
  let stepExecutor: StepExecutor;
  let mastra: Mastra;
  let capturedContexts: SleepFnContext[];
  let requestContext: RequestContext;

  beforeEach(() => {
    mastra = new Mastra();
    stepExecutor = new StepExecutor({ mastra });
    capturedContexts = [];
    requestContext = new RequestContext();
  });

  it('should return step.duration directly when provided', async () => {
    // Arrange: Create sleep step with explicit duration and spy on fn
    const duration = 1000;
    const fnSpy = vi.fn().mockReturnValue(5000);
    const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      duration,
      fn: fnSpy,
    };

    // Act: Call resolveSleep with step containing duration
    const result = await stepExecutor.resolveSleep({
      workflowId: 'test-workflow',
      step,
      runId: 'test-run',
      requestContext,
      stepResults: {},
      emitter: {
        runtime: new EventEmitterPubSub(),
        events: new EventEmitterPubSub(),
      },
    });

    // Assert: Verify return value and fn was not called
    expect(result).toBe(duration);
    expect(fnSpy).not.toHaveBeenCalled();
  });

  it('should return 0 when step.fn is not provided or null', async () => {
    // Arrange: Create base sleep step parameters
    const baseParams = {
      workflowId: 'test-workflow',
      runId: 'test-run',
      requestContext,
      stepResults: {},
      emitter: {
        runtime: new EventEmitterPubSub(),
        events: new EventEmitterPubSub(),
      },
    };

    // Test undefined fn case
    const undefinedStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
    };

    // Test null fn case
    const nullStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      fn: null as any,
    };

    // Act & Assert: Verify both undefined and null fn return 0
    const undefinedResult = await stepExecutor.resolveSleep({
      ...baseParams,
      step: undefinedStep,
    });
    expect(undefinedResult).toBe(0);

    const nullResult = await stepExecutor.resolveSleep({
      ...baseParams,
      step: nullStep,
    });
    expect(nullResult).toBe(0);
  });

  it('should pass correct parameters to step.fn and return its value', async () => {
    // Arrange: Set up test data and capture fn
    const EXPECTED_DURATION = 5000;
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const inputData = { key: 'value' };
    const resumeData = { state: 'resumed' };
    const retryCount = 2;
    const requestContext = new RequestContext();

    const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
      id: 'sleep-1',
      type: 'sleep',
      fn: context => {
        capturedContexts.push(context);
        return EXPECTED_DURATION;
      },
    };

    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: {
        status: 'success',
        output: { initData: 'test' },
      },
      'previous-step': {
        status: 'success',
        output: { prevStepData: 'test' },
      },
    };

    const emitter = {
      runtime: new EventEmitterPubSub(),
      events: new EventEmitterPubSub(),
    };

    // Act: Call resolveSleep with test parameters
    const result = await stepExecutor.resolveSleep({
      workflowId,
      step,
      runId,
      input: inputData,
      resumeData,
      stepResults,
      emitter,
      requestContext,
      retryCount,
    });

    // Assert: Verify context passed to fn and return value
    expect(capturedContexts.length).toBe(1);
    const capturedContext = capturedContexts[0];

    expect(capturedContext.workflowId).toBe(workflowId);
    expect(capturedContext.runId).toBe(runId);
    expect(capturedContext.mastra).toBe(mastra);
    expect(capturedContext.requestContext).toBe(requestContext);
    expect(capturedContext.inputData).toBe(inputData);
    expect(capturedContext.retryCount).toBe(retryCount);
    expect(capturedContext.resumeData).toBe(resumeData);

    // Verify helper functions work correctly
    expect(capturedContext.getInitData()).toEqual(stepResults.input);
    expect(capturedContext.getStepResult({ id: 'previous-step' })).toEqual({ prevStepData: 'test' });
    expect(capturedContext.getStepResult({})).toBeNull();

    // Verify return value
    expect(result).toBe(EXPECTED_DURATION);
  });

  it('should return 0 when step.fn throws an error', async () => {
    // Arrange: Create a step object with fn that throws an error
    const throwingStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      fn: () => {
        throw new Error('Test error');
      },
    };

    const params = {
      workflowId: 'test-workflow',
      step: throwingStep,
      runId: 'test-run',
      stepResults: {},
      emitter: {
        runtime: new EventEmitterPubSub(),
        events: new EventEmitterPubSub(),
      },
      requestContext,
    };

    // Act & Assert: Call resolveSleep and verify it returns 0
    const result = await stepExecutor.resolveSleep(params);
    expect(result).toBe(0);
  });

  it('should save only error message without stack trace when step fails', async () => {
    const errorMessage = 'Test error: step execution failed.';
    const failingStep = createStep({
      id: 'failing-step',
      execute: vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const emitter = new EventEmitterPubSub();

    const result = await stepExecutor.execute({
      workflowId: 'test-workflow',
      step: failingStep,
      runId: 'test-run',
      input: {},
      stepResults: {},
      state: {},
      emitter: emitter as any,
      requestContext,
    });

    expect(result.status).toBe('failed');
    const failedResult = result as Extract<typeof result, { status: 'failed' }>;
    expect(failedResult.error).toBe('Error: ' + errorMessage);
    expect(String(failedResult.error)).not.toContain('at Object.execute');
    expect(String(failedResult.error)).not.toContain('at ');
    expect(String(failedResult.error)).not.toContain('\n');
  });

  it('should save MastraError message without stack trace when step fails', async () => {
    const errorMessage = 'Test MastraError: step execution failed.';
    const failingStep = createStep({
      id: 'failing-step',
      execute: vi.fn().mockImplementation(() => {
        throw new MastraError({
          id: 'VALIDATION_ERROR',
          domain: 'MASTRA_WORKFLOW',
          category: 'USER',
          text: errorMessage,
          details: { field: 'test' },
        });
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const emitter = new EventEmitterPubSub();

    const result = await stepExecutor.execute({
      workflowId: 'test-workflow',
      step: failingStep,
      runId: 'test-run',
      input: {},
      stepResults: {},
      state: {},
      emitter: emitter as any,
      requestContext,
    });

    expect(result.status).toBe('failed');
    const failedResult = result as Extract<typeof result, { status: 'failed' }>;
    expect(failedResult.error).toBe('Error: ' + errorMessage);
    expect(String(failedResult.error)).not.toContain('at Object.execute');
    expect(String(failedResult.error)).not.toContain('at ');
    expect(String(failedResult.error)).not.toContain('\n');
  });
});
