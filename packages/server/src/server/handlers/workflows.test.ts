import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { getWorkflowInfo } from '../utils';
import {
  listWorkflowsHandler,
  getWorkflowByIdHandler,
  startAsyncWorkflowHandler,
  getWorkflowRunByIdHandler,
  createWorkflowRunHandler,
  startWorkflowRunHandler,
  resumeAsyncWorkflowHandler,
  resumeWorkflowHandler,
  resumeStreamWorkflowHandler,
  observeStreamWorkflowHandler,
  cancelWorkflowRunHandler,
  listWorkflowRunsHandler,
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

  return workflow;
}
function createReusableMockWorkflow(name: string) {
  const execute = vi.fn<any>().mockResolvedValue({ result: 'success' });
  const stepA = createStep({
    id: 'test-step',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    execute: async ({ suspend }) => {
      await suspend({ test: 'data' });
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
  return getWorkflowInfo(workflow);
}

describe('vNext Workflow Handlers', () => {
  let mockMastra: Mastra;
  let mockWorkflow: Workflow;
  let reusableWorkflow: Workflow;
  const tracingOptions = { metadata: { test: true } };

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

  describe('listWorkflowsHandler', () => {
    it('should get all workflows successfully', async () => {
      const result = await listWorkflowsHandler({ mastra: mockMastra });
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
        tracingOptions,
      });

      expect(result.steps['test-step'].status).toEqual('success');
    });

    it('should start workflow run successfully when runId is passed', async () => {
      const result = await startAsyncWorkflowHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: {},
        tracingOptions,
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
      const run = await mockWorkflow.createRun({
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
      const run = await mockWorkflow.createRun({
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
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await startWorkflowRunHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: { test: 'data' },
        tracingOptions,
      });

      expect(result).toEqual({ message: 'Workflow run started' });
    });

    it('should preserve resourceId when starting workflow run after server restart', async () => {
      const resourceId = 'user-start-test';

      // Create run with resourceId
      const run = await mockWorkflow.createRun({
        runId: 'test-run-start-resource',
        resourceId,
      });
      await run.start({ inputData: {} });

      const runBefore = await mockWorkflow.getWorkflowRunById('test-run-start-resource');
      expect(runBefore?.resourceId).toBe(resourceId);

      // Simulate server restart
      const freshWorkflow = createMockWorkflow('test-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'test-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      await startWorkflowRunHandler({
        mastra: freshMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-start-resource',
        inputData: { test: 'data' },
      });

      // Wait for the workflow to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify resourceId is preserved in storage after start completes
      const runAfter = await freshWorkflow.getWorkflowRunById('test-run-start-resource');
      expect(runAfter?.resourceId).toBe(resourceId);
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

    it('should preserve resourceId when resuming async workflow after server restart', async () => {
      const resourceId = 'user-async-resume-test';

      // Start a workflow with resourceId and let it suspend (using the shared instance)
      const run = await reusableWorkflow.createRun({
        runId: 'test-run-async-resume',
        resourceId,
      });

      await run.start({ inputData: {} });

      // Verify the run has resourceId before "restart"
      const runBeforeRestart = await reusableWorkflow.getWorkflowRunById('test-run-async-resume');
      expect(runBeforeRestart?.resourceId).toBe(resourceId);

      const result = await resumeAsyncWorkflowHandler({
        mastra: mockMastra,
        workflowId: reusableWorkflow.name,
        runId: 'test-run-async-resume',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      // The workflow should have resumed
      expect(result).toBeDefined();

      // Wait for any storage updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // resourceId should be preserved after resume
      const runAfterResume = await reusableWorkflow.getWorkflowRunById('test-run-async-resume');
      expect(runAfterResume?.resourceId).toBe(resourceId);
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

    it('should resume workflow run successfully', async () => {
      const run = await reusableWorkflow.createRun({
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
        tracingOptions,
      });

      expect(result).toEqual({ message: 'Workflow run resumed' });
    });

    it('should preserve resourceId when resuming workflow run after server restart', async () => {
      const resourceId = 'user-test-123';

      // Start a workflow with resourceId and let it suspend
      const run = await reusableWorkflow.createRun({
        runId: 'test-run-with-resource',
        resourceId,
      });
      await run.start({ inputData: {} });

      const runBeforeRestart = await reusableWorkflow.getWorkflowRunById('test-run-with-resource');
      expect(runBeforeRestart?.resourceId).toBe(resourceId);

      // Simulate server restart with fresh instances (run not in memory)
      const freshWorkflow = createReusableMockWorkflow('reusable-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'reusable-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      await resumeWorkflowHandler({
        mastra: freshMastra,
        workflowId: 'reusable-workflow',
        runId: 'test-run-with-resource',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // resourceId should be preserved after resume
      const runAfterResume = await freshWorkflow.getWorkflowRunById('test-run-with-resource');
      expect(runAfterResume?.resourceId).toBe(resourceId);
    });
  });

  describe('resumeStreamWorkflowHandler', () => {
    it('should preserve resourceId when resume streaming workflow after server restart', async () => {
      const resourceId = 'user-stream-resume-test';

      // Start a workflow with resourceId and let it suspend
      const run = await reusableWorkflow.createRun({
        runId: 'test-run-stream-resume',
        resourceId,
      });
      await run.start({ inputData: {} });

      const runBeforeRestart = await reusableWorkflow.getWorkflowRunById('test-run-stream-resume');
      expect(runBeforeRestart?.resourceId).toBe(resourceId);

      // Simulate server restart with fresh instances
      const freshWorkflow = createReusableMockWorkflow('reusable-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'reusable-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      const stream = await resumeStreamWorkflowHandler({
        mastra: freshMastra,
        workflowId: 'reusable-workflow',
        runId: 'test-run-stream-resume',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      expect(stream).toBeDefined();

      // Wait for stream operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // resourceId should be preserved after resume
      const runAfterResume = await freshWorkflow.getWorkflowRunById('test-run-stream-resume');
      expect(runAfterResume?.resourceId).toBe(resourceId);
    });
  });

  describe('listWorkflowRunsHandler', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(listWorkflowRunsHandler({ mastra: mockMastra })).rejects.toThrow(
        new HTTPException(400, { message: 'Workflow ID is required' }),
      );
    });

    it('should get workflow runs successfully (empty)', async () => {
      const result = await listWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
    });

    it('should get workflow runs successfully (not empty)', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });
      const result = await listWorkflowRunsHandler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
      });

      expect(result.total).toEqual(1);
    });
  });

  describe('observeStreamWorkflowHandler', () => {
    it('should preserve resourceId when observing stream after server restart', async () => {
      const resourceId = 'user-observe-test';

      // Create run with resourceId
      const run = await mockWorkflow.createRun({
        runId: 'test-run-observe-resource',
        resourceId,
      });
      const x = await run.start({ inputData: {} });
      console.log(x);

      const runBefore = await mockWorkflow.getWorkflowRunById('test-run-observe-resource');
      expect(runBefore?.resourceId).toBe(resourceId);

      // Simulate server restart
      const freshWorkflow = createMockWorkflow('test-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'test-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      const stream = await observeStreamWorkflowHandler({
        mastra: freshMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-observe-resource',
      });

      for await (const chunk of stream) {
        console.log({ chunk });
      }
      expect(stream).toBeDefined();

      // Verify resourceId is preserved
      const runAfter = await freshWorkflow.getWorkflowRunById('test-run-observe-resource');
      expect(runAfter?.resourceId).toBe(resourceId);
    });
  });

  describe('cancelWorkflowRunHandler', () => {
    it('should preserve resourceId when cancelling workflow after server restart', async () => {
      const resourceId = 'user-cancel-test';

      // Create run with resourceId
      const run = await mockWorkflow.createRun({
        runId: 'test-run-cancel-resource',
        resourceId,
      });
      await run.start({ inputData: {} });

      const runBefore = await mockWorkflow.getWorkflowRunById('test-run-cancel-resource');
      expect(runBefore?.resourceId).toBe(resourceId);

      // Simulate server restart
      const freshWorkflow = createMockWorkflow('test-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'test-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      const result = await cancelWorkflowRunHandler({
        mastra: freshMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-cancel-resource',
      });
      expect(result).toEqual({ message: 'Workflow run cancelled' });

      // Verify resourceId is preserved
      const runAfter = await freshWorkflow.getWorkflowRunById('test-run-cancel-resource');
      expect(runAfter?.resourceId).toBe(resourceId);
    });
  });
});
