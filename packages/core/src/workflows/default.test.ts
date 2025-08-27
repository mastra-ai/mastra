import { randomUUID } from 'crypto';
import type { Span } from '@opentelemetry/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { DefaultExecutionEngine } from './default';
import type { Emitter, StepResult } from './types';

describe('DefaultExecutionEngine.executeConditional error handling', () => {
  let engine: DefaultExecutionEngine;
  let emitter: Emitter;
  let runtimeContext: RuntimeContext;
  let abortController: AbortController;

  beforeEach(() => {
    engine = new DefaultExecutionEngine({ mastra: undefined });
    emitter = {
      emit: async (_event: string, _data: any) => {},
      on: (_event: string, _callback: (data: any) => void) => {},
      off: (_event: string, _callback: (data: any) => void) => {},
      once: (_event: string, _callback: (data: any) => void) => {},
    };
    runtimeContext = new RuntimeContext();
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
      prevStep: null as any,
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
        executionSpan: {} as Span,
      },
      emitter,
      abortController,
      runtimeContext,
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

    // Verify that the original stack trace is preserved
    expect(wrappedError.stack).toContain(regularError.stack?.split('\n')[1] || '');
  });
});
