import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { createWorkflow, createStep } from '../workflows/workflow';
import { Mastra } from './index';

/**
 * Type tests for Workflow compatibility with Mastra constructor.
 *
 * Ensures that workflows created via createWorkflow can be passed
 * to the Mastra constructor without type errors.
 */
describe('Mastra workflow type compatibility', () => {
  it('should accept a basic workflow in the workflows config', () => {
    const step = createStep({
      id: 'my-step',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData }) => {
        return { result: inputData.id };
      },
    });

    const myWorkflow = createWorkflow({
      id: 'my-workflow',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    }).then(step);

    // This should compile without error — a workflow created via createWorkflow
    // should be assignable to Mastra's workflows config.
    const mastra = new Mastra({
      workflows: {
        myWorkflow,
      },
    });

    expectTypeOf(mastra).not.toBeNever();
  });

  it('should accept a workflow with request context schema', () => {
    const step = createStep({
      id: 'context-step',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      execute: async ({ inputData }) => {
        return { greeting: `Hello, ${inputData.name}` };
      },
    });

    const myWorkflow = createWorkflow({
      id: 'context-workflow',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      requestContextSchema: z.object({ userId: z.string() }),
    }).then(step);

    const mastra = new Mastra({
      workflows: {
        myWorkflow,
      },
    });

    expectTypeOf(mastra).not.toBeNever();
  });

  it('should accept multiple workflows with different type signatures', () => {
    const stepA = createStep({
      id: 'step-a',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData }) => ({ result: inputData.id }),
    });

    const stepB = createStep({
      id: 'step-b',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      execute: async ({ inputData }) => ({ doubled: inputData.count * 2 }),
    });

    const workflowA = createWorkflow({
      id: 'workflow-a',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    }).then(stepA);

    const workflowB = createWorkflow({
      id: 'workflow-b',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    }).then(stepB);

    const mastra = new Mastra({
      workflows: {
        workflowA,
        workflowB,
      },
    });

    expectTypeOf(mastra).not.toBeNever();
  });

  it('should accept a committed workflow', () => {
    const step = createStep({
      id: 'my-step',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ({ inputData }) => ({ result: inputData.value + 1 }),
    });

    const myWorkflow = createWorkflow({
      id: 'committed-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      workflows: {
        myWorkflow,
      },
    });

    expectTypeOf(mastra).not.toBeNever();
  });
});
