import { Mastra } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { MockStore } from '@mastra/core/storage';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { LegacyStep as Step, LegacyWorkflow as Workflow } from '@mastra/core/workflows/legacy';
import { stringify } from 'superjson';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getLegacyWorkflowsHandler,
  getLegacyWorkflowByIdHandler,
  startAsyncLegacyWorkflowHandler,
  getLegacyWorkflowRunHandler,
  createLegacyWorkflowRunHandler,
  startLegacyWorkflowRunHandler,
  resumeAsyncLegacyWorkflowHandler,
  resumeLegacyWorkflowHandler,
  getLegacyWorkflowRunsHandler,
} from './legacyWorkflows';

function createMockWorkflow(name: string) {
  const stepA = new Step({
    id: 'test-step',
    execute: vi.fn(),
  });

  const workflow = new Workflow({
    name,
    steps: [stepA],
  })
    .step(stepA)
    .commit();

  workflow.getWorkflowRuns = vi.fn();
  return workflow;
}
function createReusableMockWorkflow(name: string) {
  const stepA = new Step({
    id: 'test-step',
    execute: async ({ suspend }) => {
      console.log('???');
      console.log('suspend', { suspend });
      await suspend({ test: 'data' });
      console.log('carry on');
    },
  });
  const stepB = new Step({
    id: 'test-step2',
    execute: vi.fn(),
  });

  return new Workflow({
    name,
    steps: [stepA, stepB],
  })
    .step(stepA)
    .then(stepB)
    .commit();
}

function serializeWorkflow(workflow: Workflow) {
  return {
    name: workflow.name,
    stepGraph: workflow.stepGraph,
    stepSubscriberGraph: workflow.stepSubscriberGraph,
    serializedStepGraph: workflow.serializedStepGraph,
    serializedStepSubscriberGraph: workflow.serializedStepSubscriberGraph,
    triggerSchema: workflow.triggerSchema,
    steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      acc[key] = {
        id: step.id,
        description: step.description,
        inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
        outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
      };
      return acc;
    }, {}),
  };
}

describe('Workflow Handlers', () => {
  let mockMastra: Mastra;
  let mockWorkflow: Workflow;
  let reusableWorkflow: Workflow;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflow = createMockWorkflow('test-workflow');
    reusableWorkflow = createReusableMockWorkflow('reusable-workflow');

    mockMastra = new Mastra({
      logger: false,
      legacy_workflows: { 'test-workflow': mockWorkflow, 'reusable-workflow': reusableWorkflow },
      storage: new MockStore(),
    });
  });

  describe('getLegacyWorkflowsHandler', () => {
    it('should get all workflows successfully', async () => {
      const result = await getLegacyWorkflowsHandler({ mastra: mockMastra });

      expect(result).toEqual({
        'test-workflow': serializeWorkflow(mockWorkflow),
        'reusable-workflow': serializeWorkflow(reusableWorkflow),
      });
    });
  });

  describe('getLegacyWorkflowByIdHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getLegacyWorkflowByIdHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should throw error when workflow is not found', async () => {
      await expect(getLegacyWorkflowByIdHandler({ mastra: mockMastra, workflowId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Workflow with ID non-existent not found' }),
      );
    });

    it('should get workflow by ID successfully', async () => {
      const result = await getLegacyWorkflowByIdHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
    });
  });

  describe('startAsyncLegacyWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should create runId if not provided', async () => {
      vi.spyOn(mockWorkflow, 'createRun').mockReturnValueOnce({
        runId: 'test-run',
        watch: vi.fn(),
        resume: vi.fn(),
        resumeWithEvent: vi.fn(),
        start: vi.fn().mockResolvedValue({ runId: 'test-run' }),
      });

      const result = await startAsyncLegacyWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runtimeContext: new RuntimeContext(),
      });

      expect(result.runId).toEqual('test-run');
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        startAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
          // @ts-expect-error
          body: {},
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        startAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          // @ts-expect-error
          body: {},
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should start workflow run successfully', async () => {
      const mockResult = { success: true };

      (mockWorkflow.steps['test-step'].execute as Mock).mockResolvedValue(mockResult);
      mockWorkflow.createRun({
        runId: 'test-run',
      });

      const result = await startAsyncLegacyWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        // @ts-expect-error
        body: { test: 'data' },
      });

      const stepResult = result.results['test-step'];
      expect(stepResult.status).toEqual('success');
      if (stepResult.status === 'success') {
        expect(stepResult.output).toEqual(mockResult);
      }
    });
  });

  describe('getLegacyWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        getLegacyWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        getLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        getLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should get workflow run successfully', async () => {
      const mockResult = { success: true };
      (mockWorkflow.steps['test-step'].execute as Mock).mockResolvedValue(mockResult);
      mockWorkflow.createRun({
        runId: 'test-run',
      });

      const result = await getLegacyWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
    });
  });

  describe('createLegacyWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        createLegacyWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        createLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should create workflow run successfully', async () => {
      const result = await createLegacyWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toEqual({ runId: 'test-run' });
    });
  });

  describe('startLegacyWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startLegacyWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        startLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        startLegacyWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should start workflow run successfully', async () => {
      const mockResult = { success: true };
      (mockWorkflow.steps['test-step'].execute as Mock).mockResolvedValue(mockResult);
      mockWorkflow.createRun({
        runId: 'test-run',
      });

      const result = await startLegacyWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual({ message: 'Workflow run started' });
    });
  });

  describe('resumeAsyncLegacyWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        resumeAsyncLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    // todo fix
    it.skip('should resume workflow run successfully', async () => {
      const mockResult = { success: true };
      (reusableWorkflow.steps['test-step2'].execute as Mock).mockResolvedValue(mockResult);
      const run = reusableWorkflow.createRun({
        runId: 'test2-run',
      });

      await run.start({
        triggerData: { test: 'data' },
      });

      const result = await resumeAsyncLegacyWorkflowHandler({
        mastra: mockMastra,
        workflowId: reusableWorkflow.name,
        runId: 'test2-run',
        body: { stepId: 'test-step', context: { test: 'data' } },
        runtimeContext: new RuntimeContext(),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('resumeLegacyWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeLegacyWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        resumeLegacyWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { stepId: 'test-step', context: {} },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should resume workflow run successfully', async () => {
      const mockResult = { success: true };
      (reusableWorkflow.steps['test-step2'].execute as Mock).mockResolvedValue(mockResult);
      const run = reusableWorkflow.createRun({
        runId: 'test-run',
      });
      run.start();

      const result = await resumeLegacyWorkflowHandler({
        mastra: mockMastra,
        workflowId: reusableWorkflow.name,
        runId: 'test-run',
        body: { stepId: 'test-step', context: { test: 'data' } },
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual({ message: 'Workflow run resumed' });
    });
  });

  describe('getLegacyWorkflowRunsHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getLegacyWorkflowRunsHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should get workflow runs successfully (empty)', async () => {
      // Mock the workflow's getWorkflowRuns to return empty result
      (mockWorkflow.getWorkflowRuns as Mock).mockResolvedValue({
        runs: [],
        total: 0,
      });

      const result = await getLegacyWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
      expect(mockWorkflow.getWorkflowRuns).toHaveBeenCalled();
    });

    it('should get workflow runs with data', async () => {
      const mockRuns = {
        runs: [
          {
            runId: 'test-run-1',
            status: 'completed',
          },
        ],
        total: 1,
      };
      (mockWorkflow.getWorkflowRuns as Mock).mockResolvedValue(mockRuns);

      const result = await getLegacyWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual(mockRuns);
      expect(mockWorkflow.getWorkflowRuns).toHaveBeenCalled();
    });

    it('should handle errors from workflow', async () => {
      (mockWorkflow.getWorkflowRuns as Mock).mockRejectedValue(new Error('Workflow error'));

      await expect(
        getLegacyWorkflowRunsHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(500, { message: 'Workflow error' }));
    });
  });
});
