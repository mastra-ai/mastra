import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import { stringify } from 'superjson';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getWorkflowsHandler,
  getWorkflowByIdHandler,
  startAsyncWorkflowHandler,
  getWorkflowRunByIdHandler,
  createWorkflowRunHandler,
  startWorkflowRunHandler,
  resumeAsyncWorkflowHandler,
  resumeWorkflowHandler,
  getWorkflowRunsHandler,
  getWorkflowRunExecutionResultHandler,
} from './workflows';

vi.mock('zod', async importOriginal => {
  const actual: {} = await importOriginal();
  return {
    ...actual,
    object: vi.fn(() => ({
      parse: vi.fn(input => input),
      safeParse: vi.fn(input => ({ success: true, data: input })),
    })),
    string: vi.fn(() => ({
      parse: vi.fn(input => input),
    })),
  };
});

const z = require('zod');

function createMockWorkflow(name: string) {
  const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
  const stepA = createStep({
    id: 'test-step',
    execute,
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  });

  const workflow = createWorkflow({
    id: name,
    description: 'mock test workflow',
    steps: [stepA],
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  })
    .then(stepA)
    .commit();

  // workflow.getWorkflowRuns = vi.fn();
  return workflow;
}
function createReusableMockWorkflow(name: string) {
  const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
  const stepA = createStep({
    id: 'test-step',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    execute: async ({ suspend }) => {
      console.log('???');
      console.log('suspend', { suspend });
      await suspend({ test: 'data' });
      console.log('carry on');
    },
  });
  const stepB = createStep({
    id: 'test-step2',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    execute,
  });

  return createWorkflow({
    id: name,
    description: 'mock reusable test workflow',
    steps: [stepA, stepB],
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  })
    .then(stepA)
    .then(stepB)
    .commit();
}

function serializeWorkflow(workflow: Workflow) {
  return {
    name: workflow.id,
    description: workflow.description,
    steps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      acc[key] = {
        id: step.id,
        description: step.description,
        inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
        outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
        resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
        suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
      };
      return acc;
    }, {}),
    allSteps: Object.entries(workflow.steps).reduce<any>((acc, [key, step]) => {
      acc[key] = {
        id: step.id,
        description: step.description,
        inputSchema: step.inputSchema ? stringify(zodToJsonSchema(step.inputSchema)) : undefined,
        outputSchema: step.outputSchema ? stringify(zodToJsonSchema(step.outputSchema)) : undefined,
        resumeSchema: step.resumeSchema ? stringify(zodToJsonSchema(step.resumeSchema)) : undefined,
        suspendSchema: step.suspendSchema ? stringify(zodToJsonSchema(step.suspendSchema)) : undefined,
        isWorkflow: step.component === 'WORKFLOW',
      };
      return acc;
    }, {}),
    inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
    outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
    stepGraph: workflow.serializedStepGraph,
  };
}

describe('vNext Workflow Handlers', () => {
  let mockMastra: Mastra;
  let mockWorkflow: Workflow;
  let reusableWorkflow: Workflow;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkflow = createMockWorkflow('test-workflow');
    reusableWorkflow = createReusableMockWorkflow('reusable-workflow');
    mockMastra = new Mastra({
      logger: false,
      workflows: { 'test-workflow': mockWorkflow, 'reusable-workflow': reusableWorkflow },
      storage: new MockStore(),
    });
  });

  describe('getWorkflowsHandler', () => {
    it('should get all workflows successfully', async () => {
      const result = await getWorkflowsHandler({ mastra: mockMastra });
      expect(result).toEqual({
        'test-workflow': serializeWorkflow(mockWorkflow),
        'reusable-workflow': serializeWorkflow(reusableWorkflow),
      });
    });
  });

  describe('getWorkflowByIdHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getWorkflowByIdHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should throw error when workflow is not found', async () => {
      await expect(getWorkflowByIdHandler({ mastra: mockMastra, workflowId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Workflow not found' }),
      );
    });

    it('should get workflow by ID successfully', async () => {
      const result = await getWorkflowByIdHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
    });
  });

  describe('startAsyncWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startAsyncWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        startAsyncWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should start workflow run successfully when runId is not passed', async () => {
      const result = await startAsyncWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
    });

    it('should start workflow run successfully when runId is passed', async () => {
      const result = await startAsyncWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
    });
  });

  describe('getWorkflowRunByIdHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        getWorkflowRunByIdHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getWorkflowRunByIdHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        getWorkflowRunByIdHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        getWorkflowRunByIdHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should get workflow run successfully', async () => {
      const run = await mockWorkflow.createRunAsync({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await getWorkflowRunByIdHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getWorkflowRunExecutionResultHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getWorkflowRunExecutionResultHandler({ mastra: mockMastra, runId: 'test-run' })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getWorkflowRunExecutionResultHandler({ mastra: mockMastra, workflowId: 'test-workflow' }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        getWorkflowRunExecutionResultHandler({ mastra: mockMastra, workflowId: 'non-existent', runId: 'test-run' }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        getWorkflowRunExecutionResultHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run execution result not found' }));
    });

    it('should get workflow run execution result successfully', async () => {
      const run = await mockWorkflow.createRunAsync({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });
      const result = await getWorkflowRunExecutionResultHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toEqual({
        error: undefined,
        status: 'success',
        result: { result: 'success' },
        payload: {},
        steps: {
          'test-step': {
            status: 'success',
            output: { result: 'success' },
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            payload: {},
          },
        },
      });
    });
  });

  describe('createWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        createWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        createWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should create workflow run successfully', async () => {
      const result = await createWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toEqual({ runId: 'test-run' });
    });
  });

  describe('startWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        startWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        startWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should start workflow run successfully', async () => {
      const run = await mockWorkflow.createRunAsync({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await startWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: { test: 'data' },
      });

      expect(result).toEqual({ message: 'Workflow run started' });
    });
  });

  describe('resumeAsyncWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeAsyncWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeAsyncWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        resumeAsyncWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });
  });

  describe('resumeWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        resumeWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should throw error when step is not provided', async () => {
      await expect(
        resumeWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'test-run',
          body: { step: '', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'step required to resume workflow' }));
    });

    it('should resume workflow run successfully', async () => {
      const run = await reusableWorkflow.createRunAsync({
        runId: 'test-run',
      });

      await run.start({
        inputData: {},
      });

      const result = await resumeWorkflowHandler({
        mastra: mockMastra,
        workflowId: reusableWorkflow.name,
        runId: 'test-run',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      expect(result).toEqual({ message: 'Workflow run resumed' });
    });
  });

  describe('getWorkflowRunsHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getWorkflowRunsHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should get workflow runs successfully (empty)', async () => {
      const result = await getWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
    });

    it('should get workflow runs successfully (not empty)', async () => {
      const run = await mockWorkflow.createRunAsync({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });
      const result = await getWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result.total).toEqual(1);
    });
  });
});
