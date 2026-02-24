/**
 * Interoperability (Actions) tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createTool as createToolFromCore } from '@mastra/core/tools';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for interoperability tests.
 */
export function createInteroperabilityWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  // Use createTool from context if provided (avoids dual-package hazard), otherwise fall back to core
  const createTool = ctx.createTool ?? createToolFromCore;
  const workflows: WorkflowRegistry = {};

  // Test: should be able to use all action types in a workflow
  {
    const step1Action = vi.fn().mockResolvedValue({ name: 'step1' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ name: z.string() }),
    });

    const toolAction = vi.fn().mockImplementation(async (input, _context) => {
      return { name: input.name };
    });

    const randomTool = createTool({
      id: 'random-tool',
      execute: toolAction as any,
      description: 'random-tool',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'interop-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ name: z.string() }),
    });

    const toolStep = createStep(randomTool);

    workflow.then(step1).then(toolStep).commit();

    workflows['interop-workflow'] = {
      workflow,
      mocks: { step1Action, toolAction },
    };
  }

  return workflows;
}

export function createInteroperabilityTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Interoperability (Actions)', () => {
    it('should be able to use all action types in a workflow', async () => {
      const { workflow, mocks } = registry!['interop-workflow']!;

      const result = await execute(workflow, {});

      expect(mocks.step1Action).toHaveBeenCalled();
      expect(mocks.toolAction).toHaveBeenCalled();
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { name: 'step1' },
        payload: {},
      });
      expect(result.steps['random-tool']).toMatchObject({
        status: 'success',
        output: { name: 'step1' },
        payload: { name: 'step1' },
      });

      const workflowSteps = workflow.steps;

      expect(workflowSteps['random-tool']?.component).toBe('TOOL');
      expect(workflowSteps['random-tool']?.description).toBe('random-tool');
    });
  });
}
