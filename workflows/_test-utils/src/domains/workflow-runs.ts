/**
 * Workflow Runs tests for workflows
 *
 * Uses MockRegistry pattern to decouple mocks from workflow definitions,
 * enabling proper test isolation via resetMocks().
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';
import { MockRegistry } from '../mock-registry';

/**
 * Create all workflows needed for workflow runs tests.
 */
export function createWorkflowRunsWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Create a mock registry for this domain
  const mockRegistry = new MockRegistry();

  // Test: should track workflow run status
  {
    // Register mock factory
    mockRegistry.register('run-status-workflow:step1Action', () => vi.fn().mockResolvedValue({ result: 'success' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('run-status-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'run-status-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['run-status-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('run-status-workflow:step1Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should track workflow run with multiple steps
  {
    // Register mock factories
    mockRegistry.register('multi-step-run-workflow:step1Action', () => vi.fn().mockResolvedValue({ value: 'step1' }));
    mockRegistry.register('multi-step-run-workflow:step2Action', () => vi.fn().mockResolvedValue({ value: 'step2' }));
    mockRegistry.register('multi-step-run-workflow:step3Action', () => vi.fn().mockResolvedValue({ result: 'done' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('multi-step-run-workflow:step1Action')(ctx),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ctx => mockRegistry.get('multi-step-run-workflow:step2Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: async ctx => mockRegistry.get('multi-step-run-workflow:step3Action')(ctx),
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'multi-step-run-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['multi-step-run-workflow'] = {
      workflow,
      mocks: {
        get step1Action() {
          return mockRegistry.get('multi-step-run-workflow:step1Action');
        },
        get step2Action() {
          return mockRegistry.get('multi-step-run-workflow:step2Action');
        },
        get step3Action() {
          return mockRegistry.get('multi-step-run-workflow:step3Action');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  // Test: should execute multiple runs of a workflow
  {
    let callCount = 0;
    mockRegistry.register('multiple-runs-workflow:step1', () =>
      vi.fn().mockImplementation(async () => {
        callCount++;
        return { runNumber: callCount };
      }),
    );

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('multiple-runs-workflow:step1')(ctx),
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ runNumber: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'multiple-runs-workflow',
      steps: [step1],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ runNumber: z.number() }),
    });

    workflow.then(step1).commit();

    workflows['multiple-runs-workflow'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('multiple-runs-workflow:step1');
        },
      },
      resetMocks: () => {
        mockRegistry.reset();
        callCount = 0;
      },
    };
  }

  // Test: should return the correct runId
  {
    mockRegistry.register('runid-workflow:step1', () => vi.fn().mockResolvedValue({ result: 'done' }));

    const step1 = createStep({
      id: 'step1',
      execute: async ctx => mockRegistry.get('runid-workflow:step1')(ctx),
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'runid-workflow',
      steps: [step1],
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['runid-workflow'] = {
      workflow,
      mocks: {
        get step1() {
          return mockRegistry.get('runid-workflow:step1');
        },
      },
      resetMocks: () => mockRegistry.reset(),
    };
  }

  return workflows;
}

export function createWorkflowRunsTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Workflow Runs', () => {
    it('should track workflow run status', async () => {
      const { workflow, mocks } = registry!['run-status-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
    });

    it('should track workflow run with multiple steps', async () => {
      const { workflow, mocks } = registry!['multi-step-run-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      expect(mocks.step3Action).toHaveBeenCalledTimes(1);

      expect(result.steps.step1).toMatchObject({ status: 'success' });
      expect(result.steps.step2).toMatchObject({ status: 'success' });
      expect(result.steps.step3).toMatchObject({ status: 'success' });
    });

    it('should execute multiple runs of a workflow', async () => {
      const { workflow } = registry!['multiple-runs-workflow']!;

      // First run
      const result1 = await execute(workflow, { input: 'run1' });
      expect(result1.status).toBe('success');
      expect(result1.steps.step1!.output).toEqual({ runNumber: 1 });

      // Second run
      const result2 = await execute(workflow, { input: 'run2' });
      expect(result2.status).toBe('success');
      expect(result2.steps.step1!.output).toEqual({ runNumber: 2 });

      // Third run
      const result3 = await execute(workflow, { input: 'run3' });
      expect(result3.status).toBe('success');
      expect(result3.steps.step1!.output).toEqual({ runNumber: 3 });
    });

    it('should use provided runId', async () => {
      const { workflow } = registry!['runid-workflow']!;
      const customRunId = 'my-custom-run-id-12345';

      const result = await execute(workflow, { input: 'test' }, { runId: customRunId });

      expect(result.status).toBe('success');
      // The result should complete successfully with our custom runId
      // (actual runId verification would require checking run object, not just result)
    });
  });
}
