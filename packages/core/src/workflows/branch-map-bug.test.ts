import { randomUUID } from 'crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
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

    const run = await mainWorkflowWithMapBug.createRunAsync();
    const result = await run.start({
      inputData: { value: 15 }, // Should trigger workflowA
    });

    expect(result.status).toBe('success');
    const workflowAResult = result.steps['workflow-a-with-map'];
    if (workflowAResult.status === 'success') {
      expect(workflowAResult.output.result).toBe('Processed value: 15');
    }
  });
});
