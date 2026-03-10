/**
 * Storage persistence tests for workflows
 *
 * Tests workflow storage operations like listWorkflowRuns, getWorkflowRunById,
 * deleteWorkflowRunById, and shouldPersistSnapshot options.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for storage tests.
 */
export function createStorageWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should get workflow runs from storage
  {
    const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
    const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'storage-list-runs-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['storage-list-runs-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
    };
  }

  // Test: should get and delete workflow run by id from storage
  {
    const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
    const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'storage-get-delete-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['storage-get-delete-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
    };
  }

  // Test: should persist resourceId when creating workflow runs
  {
    const stepAction = vi.fn().mockResolvedValue({ result: 'success' });

    const step1 = createStep({
      id: 'step1',
      execute: stepAction,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'storage-resourceid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['storage-resourceid-workflow'] = {
      workflow,
      mocks: { stepAction },
    };
  }

  // Test: should return only requested fields when fields option is specified
  {
    const stepAction = vi.fn().mockResolvedValue({ value: 'result1' });

    const step1 = createStep({
      id: 'step1',
      execute: stepAction,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'storage-fields-filter-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['storage-fields-filter-workflow'] = {
      workflow,
      mocks: { stepAction },
    };
  }

  // Test: should exclude nested workflow steps when withNestedWorkflows is false
  {
    const innerStepAction = vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value + 1 }));
    const outerStepAction = vi.fn().mockImplementation(async ({ inputData }) => ({ value: inputData.value * 2 }));

    const innerStep = createStep({
      id: 'inner-step',
      execute: innerStepAction,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'storage-nested-inner-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(innerStep)
      .commit();

    const outerStep = createStep({
      id: 'outer-step',
      execute: outerStepAction,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const parentWorkflow = createWorkflow({
      id: 'storage-nested-parent-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    parentWorkflow.then(nestedWorkflow).then(outerStep).commit();

    workflows['storage-nested-parent-workflow'] = {
      workflow: parentWorkflow,
      nestedWorkflow,
      mocks: { innerStepAction, outerStepAction },
    };
  }

  // Test: should preserve resourceId when resuming a suspended workflow
  {
    const suspendingStepAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return suspend({});
      }
      return { resumed: true, data: resumeData };
    });

    const finalStepAction = vi.fn().mockResolvedValue({ completed: true });

    const suspendingStep = createStep({
      id: 'suspendingStep',
      execute: suspendingStepAction,
      inputSchema: z.object({}),
      outputSchema: z.object({ resumed: z.boolean(), data: z.any() }),
      resumeSchema: z.object({ message: z.string() }),
    });

    const finalStep = createStep({
      id: 'finalStep',
      execute: finalStepAction,
      inputSchema: z.object({ resumed: z.boolean(), data: z.any() }),
      outputSchema: z.object({ completed: z.boolean() }),
    });

    const workflow = createWorkflow({
      id: 'storage-resourceid-resume-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.then(suspendingStep).then(finalStep).commit();

    workflows['storage-resourceid-resume-workflow'] = {
      workflow,
      mocks: { suspendingStepAction, finalStepAction },
    };
  }

  // Test: should use shouldPersistSnapshot option
  {
    const step1Action = vi.fn().mockResolvedValue({ result: 'success1' });
    const step2Action = vi.fn().mockResolvedValue({ result: 'success2' });
    const resumeStepAction = vi.fn().mockImplementation(async ({ resumeData, suspend }: any) => {
      if (!resumeData) {
        return suspend({});
      }
      return { completed: true };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    const resumeStep = createStep({
      id: 'resume-step',
      execute: resumeStepAction,
      inputSchema: z.object({}),
      outputSchema: z.object({ completed: z.boolean() }),
      resumeSchema: z.object({ resume: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'storage-shouldpersist-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ completed: z.boolean() }),
      options: { shouldPersistSnapshot: ({ workflowStatus }: any) => workflowStatus === 'suspended' },
    });
    workflow.then(step1).then(step2).then(resumeStep).commit();

    workflows['storage-shouldpersist-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, resumeStepAction },
    };
  }

  return workflows;
}

export function createStorageTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Storage Persistence', () => {
    it.skipIf(skipTests.storageListRuns)('should get workflow runs from storage', async () => {
      const { workflow } = registry!['storage-list-runs-workflow']!;

      // Generate unique run IDs
      const runId1 = `storage-test-${Date.now()}-1`;
      const runId2 = `storage-test-${Date.now()}-2`;

      // Execute two workflow runs
      await execute(workflow, {}, { runId: runId1 });
      await execute(workflow, {}, { runId: runId2 });

      // List workflow runs
      const { runs, total } = await (workflow as any).listWorkflowRuns();

      expect(total).toBeGreaterThanOrEqual(2);
      expect(runs.length).toBeGreaterThanOrEqual(2);

      // Find our runs in the list
      const run1 = runs.find((r: any) => r.runId === runId1);
      const run2 = runs.find((r: any) => r.runId === runId2);

      expect(run1).toBeDefined();
      expect(run2).toBeDefined();
      expect(run1?.workflowName).toBe('storage-list-runs-workflow');
      expect(run2?.workflowName).toBe('storage-list-runs-workflow');
    });

    it.skipIf(skipTests.storageGetDelete)('should get and delete workflow run by id from storage', async () => {
      const { workflow } = registry!['storage-get-delete-workflow']!;

      const runId = `storage-delete-test-${Date.now()}`;

      // Execute workflow
      await execute(workflow, {}, { runId });

      // Get by ID
      const workflowRun = await (workflow as any).getWorkflowRunById(runId);
      expect(workflowRun).toBeDefined();
      expect(workflowRun?.runId).toBe(runId);
      expect(workflowRun?.workflowName).toBe('storage-get-delete-workflow');
      expect(workflowRun?.status).toBe('success');
      expect(workflowRun?.steps).toBeDefined();

      // Delete by ID
      await (workflow as any).deleteWorkflowRunById(runId);

      // Verify deleted
      const deleted = await (workflow as any).getWorkflowRunById(runId);
      expect(deleted).toBeNull();
    });

    it.skipIf(skipTests.storageResourceId)('should persist resourceId when creating workflow runs', async () => {
      const { workflow } = registry!['storage-resourceid-workflow']!;

      const runId = `storage-resourceid-test-${Date.now()}`;
      const resourceId = 'user-123';

      // Execute with resourceId
      await execute(workflow, {}, { runId, resourceId });

      // Verify resourceId is persisted
      const { runs } = await (workflow as any).listWorkflowRuns();
      const ourRun = runs.find((r: any) => r.runId === runId);

      expect(ourRun).toBeDefined();
      expect(ourRun?.resourceId).toBe(resourceId);

      // Also verify via getWorkflowRunById
      const runById = await (workflow as any).getWorkflowRunById(runId);
      expect(runById?.resourceId).toBe(resourceId);
    });

    it.skipIf(skipTests.storageResourceIdResume || !ctx.resume)(
      'should preserve resourceId when resuming a suspended workflow',
      async () => {
        const { workflow } = registry!['storage-resourceid-resume-workflow']!;

        const runId = `storage-resourceid-resume-test-${Date.now()}`;
        const resourceId = 'user-789';

        // Execute with resourceId - should suspend
        const initialResult = await execute(workflow, {}, { runId, resourceId });
        expect(initialResult.status).toBe('suspended');

        // Verify resourceId before resume
        const runBeforeResume = await (workflow as any).getWorkflowRunById(runId);
        expect(runBeforeResume?.resourceId).toBe(resourceId);

        // Resume the workflow
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'suspendingStep',
          resumeData: { message: 'resumed with data' },
        });
        expect(resumeResult.status).toBe('success');

        // After resume, resourceId should be preserved in storage
        const runAfterResume = await (workflow as any).getWorkflowRunById(runId);
        expect(runAfterResume?.resourceId).toBe(resourceId);

        const { runs } = await (workflow as any).listWorkflowRuns({ resourceId });
        expect(runs).toHaveLength(1);
        expect(runs[0]?.resourceId).toBe(resourceId);
      },
    );

    it.skipIf(skipTests.storageFieldsFilter)(
      'should return only requested fields when fields option is specified',
      async () => {
        const { workflow } = registry!['storage-fields-filter-workflow']!;

        const runId = `storage-fields-filter-test-${Date.now()}`;

        // Execute workflow
        await execute(workflow, {}, { runId });

        // Request only status field
        const statusOnly = await (workflow as any).getWorkflowRunById(runId, { fields: ['status'] });
        expect(statusOnly?.status).toBe('success');
        expect(statusOnly?.steps).toBeUndefined(); // steps not requested
        expect(statusOnly?.result).toBeUndefined();

        // Request status and steps
        const withSteps = await (workflow as any).getWorkflowRunById(runId, { fields: ['status', 'steps'] });
        expect(withSteps?.status).toBe('success');
        expect(withSteps?.steps).toMatchObject({
          step1: { status: 'success', output: { value: 'result1' } },
        });
        expect(withSteps?.result).toBeUndefined();

        // Request all fields (no fields option)
        const allFields = await (workflow as any).getWorkflowRunById(runId);
        expect(allFields?.status).toBe('success');
        expect(allFields?.steps).toBeDefined();
        expect(allFields?.result).toBeDefined();
        expect(allFields?.runId).toBe(runId);
        expect(allFields?.workflowName).toBe('storage-fields-filter-workflow');
      },
    );

    it.skipIf(skipTests.storageWithNestedWorkflows)(
      'should exclude nested workflow steps when withNestedWorkflows is false',
      async () => {
        const { workflow } = registry!['storage-nested-parent-workflow']!;

        const runId = `storage-nested-test-${Date.now()}`;

        // Execute workflow
        await execute(workflow, { value: 1 }, { runId });

        // With nested workflows (default) - should include nested step keys
        const withNested = await (workflow as any).getWorkflowRunById(runId);
        expect(withNested?.status).toBe('success');
        expect(withNested?.steps).toHaveProperty('storage-nested-inner-workflow');
        expect(withNested?.steps).toHaveProperty('storage-nested-inner-workflow.inner-step');
        expect(withNested?.steps).toHaveProperty('outer-step');

        // Without nested workflows - should only include top-level steps
        const withoutNested = await (workflow as any).getWorkflowRunById(runId, {
          withNestedWorkflows: false,
        });
        expect(withoutNested?.status).toBe('success');
        expect(withoutNested?.steps).toHaveProperty('storage-nested-inner-workflow');
        expect(withoutNested?.steps).not.toHaveProperty('storage-nested-inner-workflow.inner-step');
        expect(withoutNested?.steps).toHaveProperty('outer-step');
      },
    );

    it.skipIf(skipTests.storageShouldPersistSnapshot || !ctx.resume)(
      'should use shouldPersistSnapshot option',
      async () => {
        const { workflow } = registry!['storage-shouldpersist-workflow']!;
        const runId = `persist-test-${Date.now()}`;

        // Execute - should suspend at resume-step
        const result = await execute(workflow, {}, { runId });
        expect(result.status).toBe('suspended');

        // Only suspended state should be persisted (per shouldPersistSnapshot)
        const { runs, total } = await (workflow as any).listWorkflowRuns();
        expect(total).toBe(1);
        expect(runs).toHaveLength(1);

        // Resume
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume-step',
          resumeData: { resume: 'resume' },
        });
        expect(resumeResult.status).toBe('success');

        // After resume, snapshot should still be the suspended one (success is not persisted)
        const { runs: afterRuns, total: afterTotal } = await (workflow as any).listWorkflowRuns();
        expect(afterTotal).toBe(1);
        expect(afterRuns).toHaveLength(1);
        expect((afterRuns[0]?.snapshot as any)?.status).toBe('suspended');
      },
    );
  });
}
