import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import {
  LIST_AGENT_BUILDER_ACTIONS_ROUTE,
  GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE,
  START_ASYNC_AGENT_BUILDER_ACTION_ROUTE,
  GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE,
  CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE,
  START_AGENT_BUILDER_ACTION_RUN_ROUTE,
  RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE,
  RESUME_AGENT_BUILDER_ACTION_ROUTE,
  LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE,
  GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE,
  CANCEL_AGENT_BUILDER_ACTION_RUN_ROUTE,
  STREAM_AGENT_BUILDER_ACTION_ROUTE,
  STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE,
  STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE,
  OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE,
  OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE,
  OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE,
  RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE,
} from './agent-builder';
import { createTestServerContext } from './test-utils';

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
  return getWorkflowInfo(workflow);
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

  describe('LIST_AGENT_BUILDER_ACTIONS_ROUTE', () => {
    it('should get all agent builder actions successfully', async () => {
      const result = await LIST_AGENT_BUILDER_ACTIONS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual({
        'merge-template': serializeWorkflow(mockWorkflow),
        'workflow-builder': serializeWorkflow(reusableWorkflow),
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Listing agent builder actions');
    });
  });

  describe('GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when actionId is invalid', async () => {
      // Mock isAgentBuilderWorkflow to return false for invalid actions
      vi.spyOn(WorkflowRegistry, 'isAgentBuilderWorkflow').mockReturnValue(false);

      await expect(
        GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
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
        GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should get action by ID successfully', async () => {
      const result = await GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
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

  describe('START_ASYNC_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        START_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        START_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'non-existent',
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should start action run successfully when runId is not passed', async () => {
      const result = await START_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        inputData: {},
      } as any);

      expect(result.steps['test-step'].status).toEqual('success');
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting agent builder action asynchronously',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });

    it('should start action run successfully when runId is passed', async () => {
      const result = await START_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        runId: 'test-run',
        inputData: {},
      } as any);

      expect(result.steps['test-step'].status).toEqual('success');
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should get action run successfully', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should get action run execution result successfully', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });

      const result = await GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toEqual({
        activeStepsPath: {},
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
        serializedStepGraph: mockWorkflow.serializedStepGraph,
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should create action run successfully', async () => {
      const result = await CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        runId: 'test-run',
      });

      expect(result).toEqual({ runId: 'test-run' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
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

  describe('START_AGENT_BUILDER_ACTION_RUN_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        START_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        START_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should start action run successfully', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await START_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        runId: 'test-run',
        inputData: { test: 'data' },
      } as any);

      expect(result).toEqual({ message: 'Workflow run started' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          step: 'test-step',
          resumeData: {},
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          step: 'test-step',
          resumeData: {},
          runId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should handle workflow registry correctly on resume', async () => {
      await expect(
        RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: 'non-existent',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('RESUME_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        RESUME_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          step: 'test-step',
          resumeData: {},
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should resume action run successfully', async () => {
      const run = await reusableWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({
        inputData: {},
      });

      const result = await RESUME_AGENT_BUILDER_ACTION_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'workflow-builder',
        runId: 'test-run',
        step: 'test-step',
        resumeData: { test: 'data' },
      } as any);

      expect(result).toEqual({ message: 'Workflow run resumed' });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should get action runs successfully (empty)', async () => {
      const result = await LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        page: 0,
      });

      expect(result).toEqual({
        runs: [],
        total: 0,
      });
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });

    it('should get action runs successfully (not empty)', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });
      await run.start({ inputData: {} });

      const result = await LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        actionId: 'merge-template',
        page: 0,
      });

      expect(result.total).toEqual(1);
      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });

  describe('CANCEL_AGENT_BUILDER_ACTION_RUN_ROUTE', () => {
    it('should handle workflow registry correctly on cancel', async () => {
      await expect(
        CANCEL_AGENT_BUILDER_ACTION_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: 'non-existent',
        }),
      ).rejects.toThrow();

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
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

  describe('STREAM_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should handle workflow registry correctly on stream', async () => {
      await expect(
        STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          inputData: {},
          runId: undefined,
        } as any),
      ).rejects.toThrow(); // Will throw because streaming is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
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

  describe('STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should handle workflow registry correctly on streamVNext', async () => {
      await expect(
        STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          inputData: {},
          runId: undefined,
        } as any),
      ).rejects.toThrow(); // Will throw because streaming is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Streaming agent builder action (v2)',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should handle workflow registry correctly on streamLegacy', async () => {
      await expect(
        STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          inputData: {},
          runId: undefined,
        } as any),
      ).rejects.toThrow(); // Will throw because streaming is complex to mock

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Streaming agent builder action (legacy)',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: undefined as any,
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to observe workflow stream' }));
    });

    it('should handle workflow registry correctly on observeStreamLegacy', async () => {
      await expect(
        OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(); // Will throw because run doesn't exist

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Observing agent builder action stream (legacy)',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to observe workflow stream' }));
    });

    it('should handle workflow registry correctly on observeStream', async () => {
      await expect(
        OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(); // Will throw because run doesn't exist

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Observing agent builder action stream',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          actionId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to observe workflow stream' }));
    });

    it('should throw error when action is not found', async () => {
      await expect(
        OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should handle workflow registry correctly on observeStreamVNext', async () => {
      await expect(
        OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'merge-template',
          runId: 'non-existent',
        }),
      ).rejects.toThrow(); // Will throw because run doesn't exist

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Observing agent builder action stream (v2)',
        expect.objectContaining({
          actionId: 'merge-template',
        }),
      );
    });
  });

  describe('RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE', () => {
    it('should throw error when actionId is not provided', async () => {
      await expect(
        RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          step: 'test-step',
          resumeData: {},
          actionId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'workflow-builder',
          step: 'test-step',
          resumeData: {},
          runId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should handle workflow registry correctly on resumeStream', async () => {
      await expect(
        RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: 'workflow-builder',
          runId: 'non-existent',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(); // Will throw because run doesn't exist

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Resuming agent builder action stream',
        expect.objectContaining({
          actionId: 'workflow-builder',
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
        GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: errorMastra }),
          actionId: 'merge-template', // Use an action that exists in workflowMap
        }),
      ).rejects.toThrow('Workflow not found');

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting agent builder action by ID',
        expect.objectContaining({
          error: expect.anything(),
        }),
      );
    });

    it('should still register and cleanup workflows even when actionId is not provided', async () => {
      await expect(
        GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          actionId: undefined as any,
        }),
      ).rejects.toThrow();

      expect(WorkflowRegistry.registerTemporaryWorkflows).toHaveBeenCalledWith(
        {
          'merge-template': expect.anything(),
          'workflow-builder': expect.anything(),
        },
        mockMastra,
      );
      expect(WorkflowRegistry.cleanup).toHaveBeenCalled();
    });
  });
});
