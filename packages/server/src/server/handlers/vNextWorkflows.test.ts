import { Mastra } from '@mastra/core';
import { createStep, createWorkflow } from '@mastra/core/workflows/vNext';
import type { NewWorkflow } from '@mastra/core/workflows/vNext';
import { stringify } from 'superjson';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import zodToJsonSchema from 'zod-to-json-schema';
import { HTTPException } from '../http-exception';
import {
  getVNextWorkflowsHandler,
  getVNextWorkflowByIdHandler,
  startAsyncVNextWorkflowHandler,
  getVNextWorkflowRunHandler,
  createVNextWorkflowRunHandler,
  startVNextWorkflowRunHandler,
  resumeAsyncVNextWorkflowHandler,
  resumeVNextWorkflowHandler,
  getVNextWorkflowRunsHandler,
} from './vNextWorkflows';

vi.mock('zod', () => {
  return {
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
    steps: [stepA, stepB],
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  })
    .then(stepA)
    .then(stepB)
    .commit();
}

function serializeWorkflow(workflow: NewWorkflow) {
  return {
    name: workflow.id,
    steps: workflow.steps,
    inputSchema: workflow.inputSchema ? stringify(zodToJsonSchema(workflow.inputSchema)) : undefined,
    outputSchema: workflow.outputSchema ? stringify(zodToJsonSchema(workflow.outputSchema)) : undefined,
    stepGraph: workflow.stepGraph,
  };
}

describe('vNext Workflow Handlers', () => {
  let mockMastra: Mastra;
  let mockWorkflow: NewWorkflow;
  let reusableWorkflow: NewWorkflow;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkflow = createMockWorkflow('test-workflow');
    reusableWorkflow = createReusableMockWorkflow('reusable-workflow');
    mockMastra = new Mastra({
      logger: false,
      vnext_workflows: { 'test-workflow': mockWorkflow, 'reusable-workflow': reusableWorkflow },
    });
  });

  describe('getVNextWorkflowsHandler', () => {
    it('should get all workflows successfully', async () => {
      const result = await getVNextWorkflowsHandler({ mastra: mockMastra });
      expect(result).toEqual({
        'test-workflow': serializeWorkflow(mockWorkflow),
        'reusable-workflow': serializeWorkflow(reusableWorkflow),
      });
    });
  });

  describe('getVNextWorkflowByIdHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getVNextWorkflowByIdHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should throw error when vnext workflow is not found', async () => {
      await expect(getVNextWorkflowByIdHandler({ mastra: mockMastra, workflowId: 'non-existent' })).rejects.toThrow(
        new HTTPException(404, { message: 'Workflow with ID non-existent not found' }),
      );
    });

    it('should get vnext workflow by ID successfully', async () => {
      const result = await getVNextWorkflowByIdHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
    });
  });

  describe('startAsyncVNextWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startAsyncVNextWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when vnext workflow is not found', async () => {
      await expect(
        startAsyncVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should start vnext workflow run successfully when runId is not passed', async () => {
      const result = await startAsyncVNextWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
    });

    it('should start vnext workflow run successfully when runId is passed', async () => {
      const result = await startAsyncVNextWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
    });
  });

  describe('getVNextWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        getVNextWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when vnext workflow is not found', async () => {
      await expect(
        getVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should throw error when vnext workflow run is not found', async () => {
      await expect(
        getVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should get vnext workflow run successfully', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await getVNextWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
    });
  });

  describe('createVNextWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        createVNextWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when vnext workflow is not found', async () => {
      await expect(
        createVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow with ID non-existent not found' }));
    });

    it('should create vnext workflow run successfully', async () => {
      const result = await createVNextWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toEqual({ runId: 'test-run' });
    });
  });

  describe('startVNextWorkflowRunHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        startVNextWorkflowRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        startVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should throw error when vnext workflow run is not found', async () => {
      await expect(
        startVNextWorkflowRunHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should start vnext workflow run successfully', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await startVNextWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: { test: 'data' },
      });

      expect(result).toEqual({ message: 'Workflow run started' });
    });
  });

  describe('resumeAsyncVNextWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeAsyncVNextWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeAsyncVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when vnext workflow run is not found', async () => {
      await expect(
        resumeAsyncVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });
  });

  describe('resumeVNextWorkflowHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        resumeVNextWorkflowHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when vnext workflow run is not found', async () => {
      await expect(
        resumeVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should throw error when step is not provided', async () => {
      await expect(
        resumeVNextWorkflowHandler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'test-run',
          body: { step: '', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'step required to resume workflow' }));
    });

    it('should resume vnext workflow run successfully', async () => {
      const run = reusableWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({
        inputData: {},
      });

      const result = await resumeVNextWorkflowHandler({
        mastra: mockMastra,
        workflowId: reusableWorkflow.name,
        runId: 'test-run',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      expect(result).toEqual({ message: 'Workflow run resumed' });
    });
  });

  describe('getVNextWorkflowRunsHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(getVNextWorkflowRunsHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should get workflow runs successfully (empty)', async () => {
      const result = await getVNextWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
    });

    it('should get workflow runs successfully (not empty)', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });
      const result = await getVNextWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result.total).toEqual(1);
    });
  });
});
