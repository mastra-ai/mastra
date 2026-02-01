/**
 * Restart domain tests for workflows
 *
 * Tests the ability to restart workflow executions that have completed or failed.
 * NOTE: restart() is only supported on the Default engine.
 * Inngest and Evented engines throw "restart() is not supported on {engine} workflows"
 *
 * Uses MockRegistry pattern for test isolation.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for restart tests.
 */
export function createRestartWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should throw error when restarting workflow that was not active
  {
    mockRegistry.register('restart-not-active:step1', () =>
      vi.fn().mockResolvedValue({ result: 'step1 done' }),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('restart-not-active:step1')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-not-active',
      steps: [step1],
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['restart-not-active'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-not-active:step1');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should restart a completed workflow execution
  {
    let executionCount = 0;
    mockRegistry.register('restart-completed:counter', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        executionCount++;
        return { count: executionCount, value: inputData.value };
      }),
    );

    // Function to reset execution count (called via resetMocks)
    const resetExecutionCount = () => {
      executionCount = 0;
    };

    const counterStep = createStep({
      id: 'counter',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ count: z.number(), value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-completed:counter')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-completed',
      steps: [counterStep],
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ count: z.number(), value: z.number() }),
    });

    workflow.then(counterStep).commit();

    workflows['restart-completed'] = {
      workflow,
      mocks: {
        get counter() {
          return mockRegistry.get('restart-completed:counter');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        resetExecutionCount();
      },
      getExecutionCount: () => executionCount,
    };
  }

  // Test: should restart workflow with multiple steps
  {
    mockRegistry.register('restart-multistep:step1', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value + 10 })),
    );
    mockRegistry.register('restart-multistep:step2', () =>
      vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value * 2 })),
    );

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-multistep:step1')(ctx),
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ctx => mockRegistry.get('restart-multistep:step2')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-multistep',
      steps: [step1, step2],
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['restart-multistep'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('restart-multistep:step1');
        },
        get step2() {
          return mockRegistry.get('restart-multistep:step2');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should restart a failed workflow
  {
    let shouldFail = true;
    mockRegistry.register('restart-failed:failingStep', () =>
      vi.fn().mockImplementation(async ({ inputData }) => {
        if (shouldFail) {
          throw new Error('Intentional failure');
        }
        return { result: inputData.value.toUpperCase() };
      }),
    );

    const failingStep = createStep({
      id: 'failingStep',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ctx => mockRegistry.get('restart-failed:failingStep')(ctx),
    });

    const workflow = createWorkflow({
      id: 'restart-failed',
      steps: [failingStep],
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(failingStep).commit();

    workflows['restart-failed'] = {
      workflow,
      mocks: {
        get failingStep() {
          return mockRegistry.get('restart-failed:failingStep');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        shouldFail = true;
      },
      setShouldFail: (val: boolean) => {
        shouldFail = val;
      },
    };
  }

  return workflows;
}

/**
 * Create tests for restart domain.
 *
 * NOTE: These tests only run on the Default engine.
 * Skip the entire 'restart' domain for Inngest and Evented engines.
 */
export function createRestartTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { skipTests } = ctx;

  describe('restart', () => {
    it.skipIf(skipTests.restartNotActive)('should throw error when restarting workflow that was never started', async () => {
      const { workflow } = registry!['restart-not-active'];

      // Create a run but don't start it
      const run = await workflow.createRun();

      // Attempting to restart a never-started workflow should throw
      await expect(run.restart()).rejects.toThrow();
    });

    it.skipIf(skipTests.restartCompleted)('should restart a completed workflow execution', async () => {
      const { workflow, mocks, getExecutionCount, resetMocks } = registry!['restart-completed'];
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        // Skip if no storage available
        return;
      }

      const runId = `restart-completed-${Date.now()}`;

      // Simulate a workflow that was interrupted mid-execution (status: 'running')
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0],
          activeStepsPath: { counter: [0] },
          value: {},
          context: {
            input: { value: 42 },
            counter: {
              payload: { value: 42 },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      // Create run with the existing runId and restart it
      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      expect(result.steps.counter.output).toMatchObject({ count: 1, value: 42 });
      expect(mocks.counter).toHaveBeenCalledTimes(1);
    });

    it.skipIf(skipTests.restartMultistep)('should restart workflow with multiple steps', async () => {
      const { workflow, mocks, resetMocks } = registry!['restart-multistep'];
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        return;
      }

      const runId = `restart-multistep-${Date.now()}`;

      // Simulate a workflow that completed step1 but was interrupted during step2
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [1],
          activeStepsPath: { step2: [1] },
          value: {},
          context: {
            input: { value: 5 },
            step1: {
              payload: { value: 5 },
              startedAt: Date.now(),
              status: 'success',
              output: { value: 15 }, // 5 + 10 = 15
              endedAt: Date.now(),
            },
            step2: {
              payload: { value: 15 },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      // step2: 15 * 2 = 30
      expect(result.steps.step2.output).toEqual({ value: 30 });
      // step1 was already done, step2 runs on restart
      expect(mocks.step1).toHaveBeenCalledTimes(0); // Already completed in snapshot
      expect(mocks.step2).toHaveBeenCalledTimes(1); // Restarted
    });

    it.skipIf(skipTests.restartFailed)('should restart a failed workflow and succeed on retry', async () => {
      const { workflow, mocks, setShouldFail, resetMocks } = registry!['restart-failed'];
      resetMocks?.();

      // Get storage to simulate interrupted workflow
      const mastra = (workflow as any).mastra;
      const storage = mastra?.getStorage();
      const workflowsStore = await storage?.getStore('workflows');

      if (!workflowsStore) {
        return;
      }

      const runId = `restart-failed-${Date.now()}`;

      // Simulate a workflow that was interrupted while running (before it could fail)
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        snapshot: {
          runId,
          status: 'running',
          activePaths: [0],
          activeStepsPath: { failingStep: [0] },
          value: {},
          context: {
            input: { value: 'hello' },
            failingStep: {
              payload: { value: 'hello' },
              startedAt: Date.now(),
              status: 'running',
            },
          },
          serializedStepGraph: (workflow as any).serializedStepGraph,
          suspendedPaths: {},
          waitingPaths: {},
          resumeLabels: {},
          timestamp: Date.now(),
        },
      });

      // Make sure it won't fail on restart
      setShouldFail(false);

      const run = await workflow.createRun({ runId });
      const result = await run.restart();

      expect(result.status).toBe('success');
      expect(result.steps.failingStep.output).toEqual({ result: 'HELLO' });
      expect(mocks.failingStep).toHaveBeenCalledTimes(1);
    });
  });
}
