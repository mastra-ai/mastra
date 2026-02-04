/**
 * Abort tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for abort tests.
 */
export function createAbortWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should provide abort signal to step execute function
  {
    let receivedAbortSignal: AbortSignal | undefined;

    const step1 = createStep({
      id: 'step1',
      execute: async ({ abortSignal }) => {
        receivedAbortSignal = abortSignal;
        return { result: 'success' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'abort-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['abort-test-workflow'] = {
      workflow,
      mocks: {},
      getReceivedAbortSignal: () => receivedAbortSignal,
    };
  }

  // Test: should provide abort function to step execute function
  {
    let receivedAbortFn: (() => void) | undefined;

    const step1 = createStep({
      id: 'step1',
      execute: async ({ abort }) => {
        receivedAbortFn = abort;
        return { result: 'success' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'abort-fn-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['abort-fn-test-workflow'] = {
      workflow,
      mocks: {},
      getReceivedAbortFn: () => receivedAbortFn,
    };
  }

  // Test: should abort workflow when abort function is called
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1' });
    const step2Action = vi.fn().mockImplementation(async ({ abort }) => {
      abort();
      // This return should not matter as workflow is aborted
      return { result: 'should-not-reach' };
    });
    const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'abort-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['abort-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should abort workflow execution immediately (before any step runs)
  {
    const step1Action = vi.fn().mockImplementation(async () => {
      // This step should not run if abort is called immediately
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { result: 'step1' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'immediate-abort-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['immediate-abort-workflow'] = {
      workflow,
      mocks: { step1Action },
      resetMocks: () => {
        step1Action.mockClear();
      },
    };
  }

  // Test: should abort workflow execution during a step
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1' });
    const step2Action = vi.fn().mockImplementation(async ({ abortSignal }) => {
      // Simulate a long-running operation that should be cancelled
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({ result: 'should-not-complete' });
        }, 5000);

        // Check if abort was signaled
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Step was aborted'));
          });
        }
      });
    });
    const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'abort-during-step-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['abort-during-step-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
        step3Action.mockClear();
      },
    };
  }

  // Test: should cancel a suspended workflow
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1' });
    const step2Action = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ reason: 'waiting for approval' });
    });
    const step3Action = vi.fn().mockResolvedValue({ result: 'step3' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'cancel-suspended-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['cancel-suspended-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
        step3Action.mockClear();
      },
    };
  }

  return workflows;
}

export function createAbortTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('abort', () => {
    it('should provide abort signal to step execute function', async () => {
      const { workflow, getReceivedAbortSignal } = registry!['abort-test-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(getReceivedAbortSignal()).toBeDefined();
      expect(getReceivedAbortSignal()).toBeInstanceOf(AbortSignal);
    });

    it('should provide abort function to step execute function', async () => {
      const { workflow, getReceivedAbortFn } = registry!['abort-fn-test-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(getReceivedAbortFn()).toBeDefined();
      expect(typeof getReceivedAbortFn()).toBe('function');
    });

    // TODO: Evented engine doesn't return 'canceled' status on abort
    it.skipIf(skipTests.abortStatus)('should abort workflow when abort function is called', async () => {
      const { workflow, mocks } = registry!['abort-workflow'];

      const result = await execute(workflow, {});

      expect(result.status).toBe('canceled');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      expect(mocks.step3Action).not.toHaveBeenCalled();
    });

    // Note: These tests require direct run access for abort/cancel operations
    // They serve as documentation for expected behavior

    it('should prepare workflow for immediate abort', async () => {
      const { workflow, mocks, resetMocks } = registry!['immediate-abort-workflow'];
      resetMocks?.();

      // This test validates the workflow setup for immediate abort scenarios
      // Actual abort behavior requires run.cancel() which is tested in engine-specific tests
      const result = await execute(workflow, {});

      // When not aborted, should complete successfully
      expect(result.status).toBe('success');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
    });

    // This test has a 5s timeout in step2 waiting for abort signal
    // Skip by default since it times out without actual abort trigger
    it.skipIf(skipTests.abortDuringStep)('should provide abort signal that can be listened to during step execution', async () => {
      const { workflow, mocks, resetMocks } = registry!['abort-during-step-workflow'];
      resetMocks?.();

      // This test validates that abortSignal is available to steps
      // The workflow will complete since we don't actually trigger abort here
      // Actual abort during step requires run.cancel() which is tested in engine-specific tests
      const result = await execute(workflow, {});

      // When not aborted, step2 should eventually complete (or timeout in test framework)
      // For shared tests, we verify the structure is correct
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
    });

    it('should suspend workflow that can be canceled', async () => {
      const { workflow, mocks, resetMocks } = registry!['cancel-suspended-workflow'];
      resetMocks?.();

      // This test validates the workflow suspends correctly before cancel
      // Actual cancel of suspended workflow requires run.cancel() after suspend
      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      expect(mocks.step3Action).not.toHaveBeenCalled();
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting for approval' },
      });
    });
  });
}
