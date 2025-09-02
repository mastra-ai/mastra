import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import { stringify } from 'superjson';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { WorkflowRegistry } from '../utils';
import {
  getAgentBuilderActionsHandler,
  getAgentBuilderActionByIdHandler,
  startAsyncAgentBuilderActionHandler,
  getAgentBuilderActionRunByIdHandler,
  createAgentBuilderActionRunHandler,
  startAgentBuilderActionRunHandler,
  resumeAsyncAgentBuilderActionHandler,
  resumeAgentBuilderActionHandler,
  getAgentBuilderActionRunsHandler,
  getAgentBuilderActionRunExecutionResultHandler,
  cancelAgentBuilderActionRunHandler,
  sendAgentBuilderActionRunEventHandler,
  streamAgentBuilderActionHandler,
  streamVNextAgentBuilderActionHandler,
  watchAgentBuilderActionHandler,
} from './agent-builder';

vi.mock('@mastra/agent-builder', () => ({
  agentBuilderWorkflows: {
    'merge-template': vi.fn(),
    'workflow-builder': vi.fn(),
  },
}));

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

describe('Agent Builder Handlers', () => {
  let mockMastra: Mastra;
  let mockWorkflow: Workflow;
  let reusableWorkflow: Workflow;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkflow = createMockWorkflow('merge-template');
    reusableWorkflow = createReusableMockWorkflow('workflow-builder');

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockMastra = new Mastra({
      logger: false,
      workflows: { 'merge-template': mockWorkflow, 'workflow-builder': reusableWorkflow },
      storage: new MockStore(),
    });

    // Mock the getLogger method
    vi.spyOn(mockMastra, 'getLogger').mockReturnValue(mockLogger);

    // Mock WorkflowRegistry methods
    vi.spyOn(WorkflowRegistry, 'registerTemporaryWorkflows').mockImplementation(() => {});
    vi.spyOn(WorkflowRegistry, 'cleanup').mockImplementation(() => {});
    vi.spyOn(WorkflowRegistry, 'isAgentBuilderWorkflow').mockReturnValue(true);
    vi.spyOn(WorkflowRegistry, 'getAllWorkflows').mockReturnValue({
      'merge-template': mockWorkflow,
      'workflow-builder': reusableWorkflow,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAgentBuilderActionsHandler', () => {
    it('should get all agent builder actions successfully', async () => {
      const result = await getAgentBuilderActionsHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
      });

      expect(result).toEqual({
        'merge-template': serializeWorkflow(mockWorkflow),
        'workflow-builder': serializeWorkflow(reusableWorkflow),
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Getting agent builder actions',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });

    it('should work without actionId', async () => {
      const result = await getAgentBuilderActionsHandler({
        mastra: mockMastra,
      });

      expect(result).toEqual({
        'merge-template': serializeWorkflow(mockWorkflow),
        'workflow-builder': serializeWorkflow(reusableWorkflow),
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('getAgentBuilderActionByIdHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        getAgentBuilderActionByIdHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when actionId is invalid', async () => {
      // Mock isAgentBuilderWorkflow to return false for invalid actions
      vi.spyOn(WorkflowRegistry, 'isAgentBuilderWorkflow').mockReturnValue(false);

      await expect(
        getAgentBuilderActionByIdHandler({
          mastra: mockMastra,
          actionId: 'invalid-action',
        }),
      ).rejects.toThrow(
        new HTTPException(400, {
          message: 'Invalid agent-builder action: invalid-action. Valid actions are: merge-template, workflow-builder',
        }),
      );

      // Restore the mock
      vi.spyOn(WorkflowRegistry, 'isAgentBuilderWorkflow').mockReturnValue(true);
    });

    it('should throw error when action is not found', async () => {
      await expect(
        getAgentBuilderActionByIdHandler({
          mastra: mockMastra,
          actionId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should get action by ID successfully', async () => {
      const result = await getAgentBuilderActionByIdHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Getting agent builder action by ID',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('startAsyncAgentBuilderActionHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        startAsyncAgentBuilderActionHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        startAsyncAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should start action run successfully when runId is not passed', async () => {
      const result = await startAsyncAgentBuilderActionHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting async agent builder action',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });

    it('should start action run successfully when runId is passed', async () => {
      const result = await startAsyncAgentBuilderActionHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        runId: 'test-run',
        inputData: {},
      });

      expect(result.steps['test-step'].status).toEqual('success');
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('getAgentBuilderActionRunByIdHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        getAgentBuilderActionRunByIdHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getAgentBuilderActionRunByIdHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        getAgentBuilderActionRunByIdHandler({
          mastra: mockMastra,
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should get action run successfully', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await getAgentBuilderActionRunByIdHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('getAgentBuilderActionRunExecutionResultHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        getAgentBuilderActionRunExecutionResultHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        getAgentBuilderActionRunExecutionResultHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should get action run execution result successfully', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });

      const result = await getAgentBuilderActionRunExecutionResultHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toEqual({
        status: 'success',
        result: { result: 'success' },
        payload: {},
        steps: {
          input: {},
          'test-step': {
            status: 'success',
            output: { result: 'success' },
            endedAt: expect.any(Number),
            startedAt: expect.any(Number),
            payload: {},
          },
        },
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('createAgentBuilderActionRunHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        createAgentBuilderActionRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        createAgentBuilderActionRunHandler({
          mastra: mockMastra,
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should create action run successfully', async () => {
      const result = await createAgentBuilderActionRunHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toEqual({ runId: 'test-run' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating agent builder action run',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('startAgentBuilderActionRunHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        startAgentBuilderActionRunHandler({
          mastra: mockMastra,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        startAgentBuilderActionRunHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should start action run successfully', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await startAgentBuilderActionRunHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
        runId: 'test-run',
        inputData: { test: 'data' },
      });

      expect(result).toEqual({ message: 'Workflow run started' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('resumeAsyncAgentBuilderActionHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        resumeAsyncAgentBuilderActionHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        resumeAsyncAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should handle workflow registry correctly on resume', async () => {
      await expect(
        resumeAsyncAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          runId: 'non-existent',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('resumeAgentBuilderActionHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        resumeAgentBuilderActionHandler({
          mastra: mockMastra,
          runId: 'test-run',
          body: { step: 'test-step', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when step is not provided', async () => {
      await expect(
        resumeAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'workflow-builder',
          runId: 'test-run',
          body: { step: '', resumeData: {} },
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'step required to resume workflow' }));
    });

    it('should resume action run successfully', async () => {
      const run = reusableWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({
        inputData: {},
      });

      const result = await resumeAgentBuilderActionHandler({
        mastra: mockMastra,
        actionId: 'workflow-builder',
        runId: 'test-run',
        body: { step: 'test-step', resumeData: { test: 'data' } },
      });

      expect(result).toEqual({ message: 'Workflow run resumed' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('getAgentBuilderActionRunsHandler', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        getAgentBuilderActionRunsHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should get action runs successfully (empty)', async () => {
      const result = await getAgentBuilderActionRunsHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });

    it('should get action runs successfully (not empty)', async () => {
      const run = mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });

      const result = await getAgentBuilderActionRunsHandler({
        mastra: mockMastra,
        actionId: 'merge-template',
      });

      expect(result.total).toEqual(1);
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('cancelAgentBuilderActionRunHandler', () => {
    it('should handle workflow registry correctly on cancel', async () => {
      await expect(
        cancelAgentBuilderActionRunHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          runId: 'non-existent',
        }),
      ).rejects.toThrow();

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cancelling agent builder action run',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('sendAgentBuilderActionRunEventHandler', () => {
    it('should handle workflow registry correctly on send event', async () => {
      await expect(
        sendAgentBuilderActionRunEventHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          runId: 'non-existent',
          event: 'test',
          data: {},
        }),
      ).rejects.toThrow();

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sending agent builder action run event',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('streamAgentBuilderActionHandler', () => {
    it('should handle workflow registry correctly on stream', async () => {
      await expect(
        streamAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          inputData: {},
        }),
      ).rejects.toThrow(); // Will throw because streaming is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Streaming agent builder action',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('streamVNextAgentBuilderActionHandler', () => {
    it('should handle workflow registry correctly on streamVNext', async () => {
      await expect(
        streamVNextAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          inputData: {},
        }),
      ).rejects.toThrow(); // Will throw because streaming is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Streaming VNext agent builder action',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('watchAgentBuilderActionHandler', () => {
    it('should handle workflow registry correctly on watch', async () => {
      await expect(
        watchAgentBuilderActionHandler({
          mastra: mockMastra,
          actionId: 'merge-template',
          runId: 'test-run',
        }),
      ).rejects.toThrow(); // Will throw because watching is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Watching agent builder action',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('Error handling and cleanup', () => {
    it('should cleanup workflow registry even when handler throws', async () => {
      // Create a mock Mastra that will cause the workflow handler to throw
      const errorMastra = new Mastra({
        logger: false,
        workflows: {}, // Empty workflows to cause "Workflow not found" error
        storage: new MockStore(),
      });
      vi.spyOn(errorMastra, 'getLogger').mockReturnValue(mockLogger);

      await expect(
        getAgentBuilderActionByIdHandler({
          mastra: errorMastra,
          actionId: 'merge-template', // Use an action that exists in workflowMap
        }),
      ).rejects.toThrow('Workflow not found');

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Getting agent builder action by ID failed',
        expect.objectContaining({
          error: 'Workflow not found',
        }),
      );
    });

    it('should still register and cleanup workflows even when actionId is not provided', async () => {
      await expect(
        getAgentBuilderActionByIdHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow();

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        }),
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });
});
