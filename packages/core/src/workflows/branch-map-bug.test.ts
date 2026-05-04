import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from './workflow';

vi.mock('crypto', () => {
  return {
    randomUUID: vi.fn(() => 'mock-uuid-1'),
  };
});

describe('Branch with Map Bug - Issue #10407', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    let counter = 0;
    (randomUUID as vi.Mock).mockImplementation(() => {
      return `mock-uuid-${++counter}`;
    });
  });

  it('should pass inputData to nested workflow with map inside branch', async () => {
    const commonInputSchema = z.object({
      value: z.number(),
    });

    const commonOutputSchema = z.object({
      result: z.string(),
    });

    const workflowAInputSchema = z.object({
      numberValue: z.number(),
    });

    const workflowAStep1 = createStep({
      id: 'workflow-a-step-1',
      description: 'First step in workflow A',
      inputSchema: workflowAInputSchema,
      outputSchema: commonOutputSchema,
      execute: async ({ inputData }) => {
        return {
          result: `Processed value: ${inputData.numberValue}`,
        };
      },
    });

    const workflowAWithMap = createWorkflow({
      id: 'workflow-a-with-map',
      inputSchema: commonInputSchema,
      outputSchema: commonOutputSchema,
    })
      .map(async ({ inputData }) => {
        // This inputData should NOT be undefined
        expect(inputData).toBeDefined();
        expect(inputData.value).toBe(15);

        // Transform from commonInputSchema to workflowAInputSchema
        return {
          numberValue: inputData.value,
        } satisfies z.infer<typeof workflowAInputSchema>;
      })
      .then(workflowAStep1)
      .commit();

    const mainWorkflowWithMapBug = createWorkflow({
      id: 'main-workflow-with-map-bug',
      inputSchema: commonInputSchema,
      outputSchema: commonOutputSchema,
    })
      .branch([[async ({ inputData }) => inputData.value > 10, workflowAWithMap]])
      .commit();

    const run = await mainWorkflowWithMapBug.createRun();
    const result = await run.start({
      inputData: { value: 15 }, // Should trigger workflowA
    });

    expect(result.status).toBe('success');
    const workflowAResult = result.steps['workflow-a-with-map'];
    if (workflowAResult.status === 'success') {
      expect(workflowAResult.output.result).toBe('Processed value: 15');
    }
  });

  it('should include nested workflow steps in getWorkflowRunById for branch sub-workflows', async () => {
    const schema = z.object({ route: z.string(), value: z.string() });

    const stepA = createStep({
      id: 'step-a',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });

    const stepB = createStep({
      id: 'step-b',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });

    const branchAlpha = createWorkflow({
      id: 'branch-alpha',
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(stepA)
      .then(stepB)
      .commit();

    const preStep = createStep({
      id: 'pre-step',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });

    const mainWorkflow = createWorkflow({
      id: 'branched-workflow',
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(preStep)
      .branch([[async ({ inputData }) => inputData.route === 'alpha', branchAlpha]])
      .commit();

    const storage = new MockStore();
    new Mastra({
      workflows: { branchedWorkflow: mainWorkflow },
      storage,
      logger: false,
    });

    const run = await mainWorkflow.createRun();
    await run.start({ inputData: { route: 'alpha', value: 'hello' } });

    const polled = await mainWorkflow.getWorkflowRunById(run.runId, {
      withNestedWorkflows: true,
      fields: ['steps'],
    });

    const stepKeys = Object.keys(polled?.steps ?? {});
    expect(stepKeys).toContain('pre-step');
    expect(stepKeys).toContain('branch-alpha');
    expect(stepKeys).toContain('branch-alpha.step-a');
    expect(stepKeys).toContain('branch-alpha.step-b');
  });
});
