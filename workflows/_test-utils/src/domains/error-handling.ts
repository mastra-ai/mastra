/**
 * Error Handling tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from '@mastra/core/error';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for error handling tests.
 */
export function createErrorHandlingWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should handle step execution errors
  {
    // Register mock factories
    mockRegistry.register('error-step-execution:failingAction', () =>
      vi.fn().mockImplementation(() => {
        throw new Error('Step execution failed');
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-step-execution:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-step-execution',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(step1).commit();

    workflows['error-step-execution'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-step-execution:failingAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle variable resolution errors
  {
    // Register mock factories
    mockRegistry.register('error-variable-resolution:step1Action', () =>
      vi.fn().mockResolvedValue({ data: 'success' }),
    );
    mockRegistry.register('error-variable-resolution:step2Action', () => vi.fn());

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-variable-resolution:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ data: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('error-variable-resolution:step2Action')(ctx),
      inputSchema: z.object({ data: z.string() }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-variable-resolution',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow
      .then(step1)
      .map({
        data: { step: step1, path: 'data' },
      })
      .then(step2)
      .commit();

    workflows['error-variable-resolution'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('error-variable-resolution:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('error-variable-resolution:step2Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle step execution errors within parallel branches
  {
    // Register mock factories
    mockRegistry.register('error-parallel-branches:failingAction', () =>
      vi.fn().mockRejectedValue(new Error('Step execution failed')),
    );
    mockRegistry.register('error-parallel-branches:successAction', () => vi.fn().mockResolvedValue({}));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-parallel-branches:successAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('error-parallel-branches:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('error-parallel-branches:successAction')(ctx),
      inputSchema: z.object({
        step1: z.object({}),
        step2: z.object({}),
      }),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-parallel-branches',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.parallel([step1, step2]).then(step3).commit();

    workflows['error-parallel-branches'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-parallel-branches:failingAction');
        },
        get successAction() {
          return mockRegistry.get('error-parallel-branches:successAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should preserve custom error properties when step throws error with extra fields
  {
    // Register mock factories
    mockRegistry.register('error-custom-properties:failingAction', () =>
      vi.fn().mockImplementation(() => {
        const customError = new Error('API rate limit exceeded');
        (customError as any).statusCode = 429;
        (customError as any).responseHeaders = { 'retry-after': '60' };
        (customError as any).isRetryable = true;
        throw customError;
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-custom-properties:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-custom-properties',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(step1).commit();

    workflows['error-custom-properties'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-custom-properties:failingAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should propagate step error to workflow-level error
  {
    // Register mock factories
    mockRegistry.register('error-propagation-workflow:failingAction', () =>
      vi.fn().mockImplementation(() => {
        const testError = new Error('Step failed with details');
        (testError as any).code = 'STEP_FAILURE';
        (testError as any).details = { reason: 'test failure' };
        throw testError;
      }),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async ctx => mockRegistry.get('error-propagation-workflow:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-propagation-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-propagation-workflow'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-propagation-workflow:failingAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should handle step execution errors within nested workflows
  {
    // Register mock factories
    mockRegistry.register('error-nested:failingAction', () =>
      vi.fn().mockImplementation(() => {
        throw new Error('Step execution failed');
      }),
    );
    mockRegistry.register('error-nested:successAction', () => vi.fn().mockResolvedValue({}));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('error-nested:successAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('error-nested:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('error-nested:successAction')(ctx),
      inputSchema: z.object({
        step1: z.object({}),
        step2: z.object({}),
      }),
      outputSchema: z.object({}),
    });

    const innerWorkflow = createWorkflow({
      id: 'error-nested-inner-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    innerWorkflow.parallel([step1, step2]).then(step3).commit();

    const mainWorkflow = createWorkflow({
      id: 'error-nested-main-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(innerWorkflow)
      .commit();

    workflows['error-nested-main-workflow'] = {
      workflow: mainWorkflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-nested:failingAction');
        },
        get successAction() {
          return mockRegistry.get('error-nested:successAction');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should preserve error.cause chain in result.error
  {
    // Register mock factories
    mockRegistry.register('error-cause-chain-workflow:failingAction', () =>
      vi.fn().mockImplementation(() => {
        const rootCause = new Error('Network connection refused');
        const intermediateCause = new Error('HTTP request failed', { cause: rootCause });
        const topLevelError = new Error('API call failed', { cause: intermediateCause });
        (topLevelError as any).statusCode = 500;
        (topLevelError as any).isRetryable = true;
        throw topLevelError;
      }),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async ctx => mockRegistry.get('error-cause-chain-workflow:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-cause-chain-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-cause-chain-workflow'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-cause-chain-workflow:failingAction');
        },
      },
      // Store expected values for assertions
      topLevelMessage: 'API call failed',
      intermediateMessage: 'HTTP request failed',
      rootCauseMessage: 'Network connection refused',
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should load serialized error from storage via getWorkflowRunById
  {
    const errorMessage = 'Test error for storage round-trip';

    // Register mock factories
    mockRegistry.register('error-storage-roundtrip:failingAction', () =>
      vi.fn().mockImplementation(() => {
        const error = new Error(errorMessage);
        (error as any).statusCode = 500;
        (error as any).errorCode = 'INTERNAL_ERROR';
        throw error;
      }),
    );

    const failingStep = createStep({
      id: 'failing-step',
      execute: async (ctx: any) => mockRegistry.get('error-storage-roundtrip:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-storage-roundtrip',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-storage-roundtrip'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-storage-roundtrip:failingAction');
        },
      },
      errorMessage,
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should persist error message without stack trace in snapshot
  {
    const errorMessage = 'Test error: step execution failed.';

    // Register mock factories
    mockRegistry.register('error-persist-without-stack:failingAction', () =>
      vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      }),
    );

    const failingStep = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('error-persist-without-stack:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-persist-without-stack',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-persist-without-stack'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-persist-without-stack:failingAction');
        },
      },
      errorMessage,
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should persist MastraError message without stack trace in snapshot
  {
    const errorMessage = 'Step execution failed.';

    // Register mock factories
    mockRegistry.register('error-persist-mastra-error:failingAction', () =>
      vi.fn().mockImplementation(() => {
        throw new MastraError({
          id: 'VALIDATION_ERROR',
          domain: 'MASTRA_WORKFLOW',
          category: 'USER',
          text: errorMessage,
          details: { field: 'test' },
        });
      }),
    );

    const failingStep = createStep({
      id: 'step1',
      execute: async (ctx: any) => mockRegistry.get('error-persist-mastra-error:failingAction')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const workflow = createWorkflow({
      id: 'error-persist-mastra-error',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(failingStep).commit();

    workflows['error-persist-mastra-error'] = {
      workflow,
      mocks: {
        get failingAction() {
          return mockRegistry.get('error-persist-mastra-error:failingAction');
        },
      },
      errorMessage,
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

/**
 * Create tests for error handling.
 */
export function createErrorHandlingTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Error Handling', () => {
    it.skipIf(skipTests.errorMessageFormat)('should handle step execution errors', async () => {
      const { workflow } = registry!['error-step-execution']!;
      const result = await execute(workflow, {});

      expect(result.status).toBe('failed');

      if (result.status === 'failed') {
        expect(result.error).toBeDefined();
        expect((result.error as any).message).toMatch(/Step execution failed/);
      }

      expect(result.steps?.input).toEqual({});
      const step1Result = result.steps?.step1;
      expect(step1Result).toBeDefined();
      expect(step1Result).toMatchObject({
        status: 'failed',
        payload: {},
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect((step1Result as any)?.error).toBeInstanceOf(Error);
      expect(((step1Result as any)?.error as Error).message).toMatch(/Step execution failed/);
    });

    it.skipIf(skipTests.variableResolutionErrors)('should handle variable resolution errors', async () => {
      const { workflow } = registry!['error-variable-resolution']!;
      const result = await execute(workflow, {});

      expect(result).toMatchObject({
        steps: {
          step1: {
            status: 'success',
            output: {
              data: 'success',
            },
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            payload: {
              data: 'success',
            },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });
    });

    it.skipIf(skipTests.parallelBranchErrors)(
      'should handle step execution errors within parallel branches',
      async () => {
        const { workflow } = registry!['error-parallel-branches']!;
        const result = await execute(workflow, {});

        expect(result.steps).toMatchObject({
          step1: {
            status: 'success',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'failed',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });
        expect((result.steps?.step2 as any)?.error).toBeInstanceOf(Error);
        expect(((result.steps?.step2 as any)?.error as Error).message).toMatch(/Step execution failed/);
      },
    );

    it.skipIf(skipTests.errorIdentity)(
      'should preserve custom error properties when step throws error with extra fields',
      async () => {
        const entry = registry!['error-custom-properties']!;
        const { workflow } = entry;
        const result = await execute(workflow, {});

        expect(result.status).toBe('failed');

        const step1Result = result.steps?.step1;
        expect(step1Result).toBeDefined();
        expect(step1Result?.status).toBe('failed');

        if (step1Result?.status === 'failed') {
          expect(step1Result.error).toBeInstanceOf(Error);
          expect((step1Result.error as any).statusCode).toBe(429);
          expect((step1Result.error as any).responseHeaders).toEqual({ 'retry-after': '60' });
          expect((step1Result.error as any).isRetryable).toBe(true);
        }
      },
    );

    it.skipIf(skipTests.errorIdentity)('should propagate step error to workflow-level error', async () => {
      const entry = registry!['error-propagation-workflow']!;
      const { workflow } = entry;
      const result = await execute(workflow, {});

      expect(result.status).toBe('failed');

      const stepResult = result.steps?.['failing-step'];
      expect(stepResult?.status).toBe('failed');
      if (stepResult?.status === 'failed') {
        expect(stepResult.error).toBeInstanceOf(Error);
      }
    });

    it.skipIf(skipTests.nestedWorkflowErrors)(
      'should handle step execution errors within nested workflows',
      async () => {
        const { workflow } = registry!['error-nested-main-workflow']!;
        const result = await execute(workflow, {});

        expect(result.steps).toMatchObject({
          'error-nested-inner-workflow': {
            status: 'failed',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        });
        expect((result.steps?.['error-nested-inner-workflow'] as any)?.error).toBeInstanceOf(Error);
        expect(((result.steps?.['error-nested-inner-workflow'] as any)?.error as Error).message).toMatch(
          /Step execution failed/,
        );
      },
    );

    it.skipIf(skipTests.errorCauseChain)('should preserve error.cause chain in result.error', async () => {
      const entry = registry!['error-cause-chain-workflow']!;
      const { workflow, topLevelMessage, intermediateMessage, rootCauseMessage } = entry;
      const result = await execute(workflow, {});

      expect(result.status).toBe('failed');

      const stepResult = result.steps?.['failing-step'];
      expect(stepResult?.status).toBe('failed');

      if (stepResult?.status === 'failed') {
        expect(stepResult.error).toBeInstanceOf(Error);
        expect((stepResult.error as Error).message).toBe(topLevelMessage);
        expect((stepResult.error as any).statusCode).toBe(500);
        expect((stepResult.error as any).isRetryable).toBe(true);

        expect((stepResult.error as any).cause).toBeDefined();
        expect((stepResult.error as any).cause.message).toBe(intermediateMessage);
        expect((stepResult.error as any).cause.cause).toBeDefined();
        expect((stepResult.error as any).cause.cause.message).toBe(rootCauseMessage);
      }
    });

    // NOTE: This test requires storage to be properly configured and the execution engine
    // to persist snapshots during execution. The test verifies that errors are properly
    // serialized to storage and can be retrieved with their custom properties intact.
    it.skipIf(skipTests.errorStorageRoundtrip ?? true)(
      'should load serialized error from storage via getWorkflowRunById',
      async () => {
        const entry = registry!['error-storage-roundtrip']!;
        const { workflow, errorMessage } = entry;

        // Use a unique runId so we can retrieve it from storage
        const runId = `test-storage-roundtrip-${Date.now()}`;
        const result = await execute(workflow, {}, { runId });

        expect(result.status).toBe('failed');

        // Load the workflow run from storage using the workflow's getWorkflowRunById
        // This returns a processed WorkflowState, not raw snapshot
        const workflowRun = await workflow.getWorkflowRunById(runId);

        expect(workflowRun).toBeDefined();
        expect(workflowRun?.status).toBe('failed');

        // The error in storage should be in the steps record
        const storedStepResult = workflowRun?.steps?.['failing-step'];
        expect(storedStepResult).toBeDefined();
        expect(storedStepResult?.status).toBe('failed');

        // Verify the stored error contains the serialized properties
        const storedError = (storedStepResult as any)?.error;
        expect(storedError).toBeDefined();

        // The stored error should have message and custom properties
        expect(storedError.message).toBe(errorMessage);
        expect(storedError.name).toBe('Error');
        expect(storedError.statusCode).toBe(500);
        expect(storedError.errorCode).toBe('INTERNAL_ERROR');

        // Stack should NOT be in the serialized output (per serializeStack: false)
        expect(storedError.stack).toBeUndefined();
      },
    );

    // These tests require storage access to spy on persistWorkflowSnapshot
    // Skip if getStorage is not available
    it.skipIf(skipTests.errorPersistWithoutStack ?? true)(
      'should persist error message without stack trace in snapshot',
      async () => {
        const { getStorage } = ctx;
        if (!getStorage) {
          return; // Skip if no storage access
        }

        const storage = getStorage();
        if (!storage) {
          return; // Skip if storage not available
        }

        const workflowsStore = await storage.getStore('workflows');
        if (!workflowsStore) {
          return; // Skip if workflows store not available
        }

        const persistSpy = vi.spyOn(workflowsStore, 'persistWorkflowSnapshot');

        const entry = registry!['error-persist-without-stack']!;
        const { workflow, errorMessage } = entry;

        const runId = `test-error-persist-${Date.now()}`;
        const result = await execute(workflow, {}, { runId });

        expect(result.status).toBe('failed');
        expect(persistSpy).toHaveBeenCalled();

        // Find the last persist call with failed status
        const persistCalls = persistSpy.mock.calls;
        const failedCall = persistCalls.find((call: any) => call[0]?.snapshot?.status === 'failed');

        expect(failedCall).toBeDefined();
        const snapshot = failedCall?.[0]?.snapshot;

        expect(snapshot).toBeDefined();
        expect(snapshot!.status).toBe('failed');

        const step1Result = snapshot!.context?.step1;
        expect(step1Result).toBeDefined();
        expect(step1Result?.status).toBe('failed');

        const failedStepResult = step1Result as any;
        expect(failedStepResult.error).toBeDefined();

        // Verify the error message is preserved
        expect(failedStepResult.error.message).toBe(errorMessage);

        // Verify stack is not in JSON output (it may still be on the instance)
        const serialized = JSON.stringify(failedStepResult.error);
        expect(serialized).not.toContain('"stack"');

        persistSpy.mockRestore();
      },
    );

    it.skipIf(skipTests.errorPersistMastraError ?? true)(
      'should persist MastraError message without stack trace in snapshot',
      async () => {
        const { getStorage } = ctx;
        if (!getStorage) {
          return; // Skip if no storage access
        }

        const storage = getStorage();
        if (!storage) {
          return; // Skip if storage not available
        }

        const workflowsStore = await storage.getStore('workflows');
        if (!workflowsStore) {
          return; // Skip if workflows store not available
        }

        const persistSpy = vi.spyOn(workflowsStore, 'persistWorkflowSnapshot');

        const entry = registry!['error-persist-mastra-error']!;
        const { workflow, errorMessage } = entry;

        const runId = `test-mastra-error-persist-${Date.now()}`;
        const result = await execute(workflow, {}, { runId });

        expect(result.status).toBe('failed');
        expect(persistSpy).toHaveBeenCalled();

        // Find the last persist call with failed status
        const persistCalls = persistSpy.mock.calls;
        const failedCall = persistCalls.find((call: any) => call[0]?.snapshot?.status === 'failed');

        expect(failedCall).toBeDefined();
        const snapshot = failedCall?.[0]?.snapshot;

        expect(snapshot).toBeDefined();
        expect(snapshot!.status).toBe('failed');

        const step1Result = snapshot!.context?.step1;
        expect(step1Result).toBeDefined();
        expect(step1Result?.status).toBe('failed');

        const failedStepResult = step1Result as any;
        expect(failedStepResult.error).toBeDefined();

        // Verify the error message is preserved
        expect(failedStepResult.error.message).toBe(errorMessage);

        // Verify stack is not in JSON output
        const serialized = JSON.stringify(failedStepResult.error);
        expect(serialized).not.toContain('"stack"');

        persistSpy.mockRestore();
      },
    );

    // NOTE: This test is opt-in (skipped by default) because the execution engine's
    // logger is not automatically updated when the Mastra logger is set via __registerPrimitives.
    it.skipIf(skipTests.errorLogger ?? true)('should log step execution errors via the Mastra logger', async () => {
      const { createWorkflow: createWf, createStep: createSt } = ctx;

      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        trackException: vi.fn(),
        child: vi.fn().mockReturnThis(),
        level: 'debug',
      };

      const failingStep = createSt({
        id: 'failing-step',
        execute: async () => {
          throw new Error('Step error for logger test');
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const workflow = createWf({
        id: 'test-logger-step-error-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [failingStep],
      });
      workflow.then(failingStep).commit();

      const storage = new MockStore();
      const mastra = new Mastra({
        workflows: { 'test-logger-step-error-workflow': workflow },
        storage,
        logger: mockLogger as any,
      });

      const run = await mastra.getWorkflow('test-logger-step-error-workflow').createRun();
      await run.start({ inputData: {} });

      // Step execution errors should be logged via the Mastra logger
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCalls = mockLogger.error.mock.calls;
      const hasStepErrorLog = errorCalls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('failing-step'),
      );
      expect(hasStepErrorLog).toBe(true);
    });

    it.skipIf(skipTests.errorEmptyResult)('should return empty result when mastra is not initialized', async () => {
      const { createWorkflow: createWf } = ctx;

      const workflow = createWf({
        id: 'test-empty-result',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });

      const result = await workflow.listWorkflowRuns();
      expect(result).toEqual({ runs: [], total: 0 });
    });
  });
}
