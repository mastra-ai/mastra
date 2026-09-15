/**
 * Interoperability (Actions) tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool as createToolFromCore } from '@mastra/core/tools';
import { createTextStreamModel } from '../mock-models';
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

  const doubleTool = createTool({
    id: 'double-tool',
    description: 'Doubles a number',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ doubled: z.number() }),
    execute: async ({ value }) => ({ doubled: value * 2 }),
  });

  const writer = new Agent({
    id: 'writer',
    name: 'writer',
    instructions: 'echo',
    model: createTextStreamModel('hello world'),
  });

  // Test: declarative .tool() builder
  {
    const workflow = createWorkflow({
      id: 'declarative-tool',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });
    workflow.tool(doubleTool).commit();
    workflows['declarative-tool'] = { workflow, mocks: {} };
  }

  // Test: declarative .map() then .tool() chaining
  {
    const workflow = createWorkflow({
      id: 'declarative-map-tool',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });
    workflow
      .map(async ({ inputData }) => ({ value: inputData.value + 1 }))
      .tool(doubleTool)
      .commit();
    workflows['declarative-map-tool'] = { workflow, mocks: {} };
  }

  // Test: option B — .then(createStep(tool))
  {
    const workflow = createWorkflow({
      id: 'declarative-tool-option-b',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });
    workflow.then(createStep(doubleTool)).commit();
    workflows['declarative-tool-option-b'] = { workflow, mocks: {} };
  }

  // Test: declarative .tool('id') resolves from the Mastra registry at run time
  {
    const workflow = createWorkflow({
      id: 'declarative-tool-by-id',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });
    workflow.tool('double-tool').commit();
    workflows['declarative-tool-by-id'] = {
      workflow,
      mocks: {},
      mastraTools: { 'double-tool': doubleTool },
    };
  }

  // Test: parallel with tool + agent steps (same prev output satisfies both inputs)
  {
    const workflow = createWorkflow({
      id: 'declarative-parallel',
      inputSchema: z.object({ value: z.number(), prompt: z.string() }),
      outputSchema: z.object({}),
    });
    workflow.parallel([createStep(doubleTool), createStep(writer)]).commit();
    workflows['declarative-parallel'] = { workflow, mocks: {} };
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
      });
      expect(result.steps['random-tool']).toMatchObject({
        status: 'success',
        output: { name: 'step1' },
      });

      const workflowSteps = workflow.steps;

      expect(workflowSteps['random-tool']?.component).toBe('TOOL');
      expect(workflowSteps['random-tool']?.description).toBe('random-tool');
    });

    describe('Declarative .tool()/.map() builders', () => {
      it('should execute a tool via the .tool() builder', async () => {
        const { workflow } = registry!['declarative-tool']!;

        const result = await execute(workflow, { value: 5 });

        expect(result.status).toBe('success');
        expect(result.steps['double-tool']).toMatchObject({
          status: 'success',
          output: { doubled: 10 },
        });
        expect(workflow.steps['double-tool']?.component).toBe('TOOL');
      });

      it('should chain .map() before .tool()', async () => {
        const { workflow } = registry!['declarative-map-tool']!;

        const result = await execute(workflow, { value: 5 });

        expect(result.status).toBe('success');
        expect(result.steps['double-tool']).toMatchObject({
          status: 'success',
          output: { doubled: 12 },
        });
      });

      it('should execute a tool via .then(createStep(tool))', async () => {
        const { workflow } = registry!['declarative-tool-option-b']!;

        const result = await execute(workflow, { value: 5 });

        expect(result.status).toBe('success');
        expect(result.steps['double-tool']).toMatchObject({
          status: 'success',
          output: { doubled: 10 },
        });
      });

      it('should run tool and agent steps in parallel', async () => {
        const { workflow } = registry!['declarative-parallel']!;

        const result = await execute(workflow, { value: 4, prompt: 'hi' });

        expect(result.status).toBe('success');
        expect(result.steps['double-tool']).toMatchObject({
          status: 'success',
          output: { doubled: 8 },
        });
        expect(result.steps['writer']).toMatchObject({
          status: 'success',
          output: { text: 'hello world' },
        });
      });

      it('should resolve a string-id tool from the Mastra registry at execution', async () => {
        const { workflow } = registry!['declarative-tool-by-id']!;

        const result = await execute(workflow, { value: 7 });

        expect(result.status).toBe('success');
        expect(result.steps['double-tool']).toMatchObject({
          status: 'success',
          output: { doubled: 14 },
        });
      });
    });
  });
}
