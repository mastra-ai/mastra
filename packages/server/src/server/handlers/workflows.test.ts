import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Workflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod/v4';
import { MASTRA_RESOURCE_ID_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { checkRouteFGA } from '../server-adapter';
import { WORKFLOWS_ROUTES } from '../server-adapter/routes/workflows';
import { getWorkflowInfo } from '../utils';
import { createTestServerContext } from './test-utils';
import {
  LIST_WORKFLOWS_ROUTE,
  LIST_WORKFLOW_RUN_COUNTS_ROUTE,
  __setWorkflowRunCountsNow,
  GET_WORKFLOW_BY_ID_ROUTE,
  START_ASYNC_WORKFLOW_ROUTE,
  GET_WORKFLOW_RUN_BY_ID_ROUTE,
  DELETE_WORKFLOW_RUN_BY_ID_ROUTE,
  CREATE_WORKFLOW_RUN_ROUTE,
  START_WORKFLOW_RUN_ROUTE,
  RESUME_ASYNC_WORKFLOW_ROUTE,
  RESUME_WORKFLOW_ROUTE,
  RESUME_STREAM_WORKFLOW_ROUTE,
  OBSERVE_STREAM_WORKFLOW_ROUTE,
  CANCEL_WORKFLOW_RUN_ROUTE,
  LIST_WORKFLOW_RUNS_ROUTE,
  STREAM_WORKFLOW_ROUTE,
} from './workflows';

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

  describe('LIST_WORKFLOWS_ROUTE', () => {
    it('should get all workflows successfully', async () => {
      const result = await LIST_WORKFLOWS_ROUTE.handler({ ...createTestServerContext({ mastra: mockMastra }) });
      expect(result).toEqual({
        'test-workflow': serializeWorkflow(mockWorkflow),
        'reusable-workflow': serializeWorkflow(reusableWorkflow),
      });
    });

    it('should return workflows with partial data when partial=true query param is provided', async () => {
      const stepWithSchemas = createStep({
        id: 'step-with-schemas',
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          output: z.string(),
        }),
        resumeSchema: z.object({
          resumeData: z.string(),
        }),
        suspendSchema: z.object({
          suspendData: z.string(),
        }),
        execute: vi.fn<any>().mockResolvedValue({ output: 'test' }),
      });

      const workflowWithSchemas = createWorkflow({
        id: 'workflow-with-schemas',
        description: 'A workflow with schemas',
        inputSchema: z.object({
          workflowInput: z.string(),
        }),
        outputSchema: z.object({
          workflowOutput: z.string(),
        }),
        steps: [stepWithSchemas],
      })
        .then(stepWithSchemas)
        .commit();

      const mastraWithSchemas = new Mastra({
        logger: false,
        workflows: { 'workflow-with-schemas': workflowWithSchemas },
        storage: new MockStore(),
      });

      const result = await LIST_WORKFLOWS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithSchemas }),
        partial: 'true',
      });

      const workflow = result['workflow-with-schemas'];
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('workflow-with-schemas');
      expect(workflow.description).toBe('A workflow with schemas');

      // When partial=true, root-level schemas should be pruned
      expect(workflow.inputSchema).toBeUndefined();
      expect(workflow.outputSchema).toBeUndefined();
      expect(workflow.stateSchema).toBeUndefined();

      // Steps should not be returned, only stepCount
      expect(workflow.steps).toEqual({});
      expect(workflow.allSteps).toEqual({});
      expect(workflow.stepCount).toBe(1);
      expect(typeof workflow.stepCount).toBe('number');
    });

    it('should return workflows with full schemas when partial param is not provided', async () => {
      const stepWithSchemas = createStep({
        id: 'step-with-schemas',
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          output: z.string(),
        }),
        stateSchema: z.object({
          state: z.string(),
        }),
        execute: vi.fn<any>().mockResolvedValue({ output: 'test' }) as any,
      });

      const workflowWithSchemas = createWorkflow({
        id: 'workflow-with-schemas',
        description: 'A workflow with schemas',
        inputSchema: z.object({
          workflowInput: z.string(),
        }),
        outputSchema: z.object({
          workflowOutput: z.string(),
        }),
        stateSchema: z.object({
          state: z.string(),
        }),
        steps: [stepWithSchemas],
      })
        .then(stepWithSchemas)
        .commit();

      const mastraWithSchemas = new Mastra({
        logger: false,
        workflows: { 'workflow-with-schemas': workflowWithSchemas },
        storage: new MockStore(),
      });

      const result = await LIST_WORKFLOWS_ROUTE.handler({
        ...createTestServerContext({ mastra: mastraWithSchemas }),
        // No partial parameter provided
      });

      const workflow = result['workflow-with-schemas'];
      expect(workflow).toBeDefined();

      // When partial is not provided, schemas should be included
      expect(workflow.inputSchema).toBeDefined();
      expect(workflow.outputSchema).toBeDefined();
      expect(workflow.stateSchema).toBeDefined();
      expect(typeof workflow.inputSchema).toBe('string');
      expect(typeof workflow.outputSchema).toBe('string');
      expect(typeof workflow.stateSchema).toBe('string');

      // Step-level schemas should also be included
      const step = workflow.steps['step-with-schemas'];
      expect(step.inputSchema).toBeDefined();
      expect(step.outputSchema).toBeDefined();
      expect(step.stateSchema).toBeDefined();
      expect(typeof step.inputSchema).toBe('string');
      expect(typeof step.outputSchema).toBe('string');
      expect(typeof step.stateSchema).toBe('string');

      // Steps object should be present, not stepCount
      expect(workflow.steps).toBeDefined();
      expect(workflow.allSteps).toBeDefined();
      expect(workflow.stepCount).toBeUndefined();
    });

    it('should return no workflows when FGA is configured and no user is present', async () => {
      const filterAccessible = vi.fn();
      vi.spyOn(mockMastra, 'getServer').mockReturnValue({ fga: { filterAccessible } } as any);

      const result = await LIST_WORKFLOWS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual({});
      expect(filterAccessible).not.toHaveBeenCalled();
    });
  });

  describe('LIST_WORKFLOW_RUN_COUNTS_ROUTE', () => {
    let fakeNow: number;

    beforeEach(() => {
      // Deterministic clock: the cache is WeakMap-keyed per Mastra instance
      // (isolated by the fresh mockMastra each test), and TTL is tested by
      // advancing this value instead of waiting on the wall clock.
      fakeNow = 1_000_000;
      __setWorkflowRunCountsNow(() => fakeNow);
    });

    afterEach(() => {
      __setWorkflowRunCountsNow();
    });

    const persistRun = async (
      mastra: Mastra,
      workflowName: string,
      runId: string,
      status: string,
      resourceId?: string,
    ) => {
      const store = await mastra.getStorage()!.getStore('workflows');
      await store!.persistWorkflowSnapshot({
        workflowName,
        runId,
        resourceId,
        snapshot: { status, resourceId } as any,
      });
    };

    it('counts running and suspended runs grouped by registry key', async () => {
      await persistRun(mockMastra, 'test-workflow', 'run-1', 'running');
      await persistRun(mockMastra, 'test-workflow', 'run-2', 'running');
      await persistRun(mockMastra, 'test-workflow', 'run-3', 'suspended');
      await persistRun(mockMastra, 'test-workflow', 'run-4', 'success');

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);

      expect(result).toEqual({
        'test-workflow': { running: 2, suspended: 1 },
        'reusable-workflow': { running: 0, suspended: 0 },
      });
    });

    it('maps run rows to the registry key when it differs from the workflow id', async () => {
      const camelMastra = new Mastra({
        logger: false,
        workflows: { testWorkflowKey: createMockWorkflow('kebab-flow-id') },
        storage: new MockStore(),
      });
      await persistRun(camelMastra, 'kebab-flow-id', 'run-1', 'suspended');

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: camelMastra }),
      } as any);

      expect(result).toEqual({ testWorkflowKey: { running: 0, suspended: 1 } });
    });

    it('ignores run rows whose workflow is not registered', async () => {
      await persistRun(mockMastra, 'ghost-flow', 'run-1', 'running');

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);

      expect(result).toEqual({
        'test-workflow': { running: 0, suspended: 0 },
        'reusable-workflow': { running: 0, suspended: 0 },
      });
    });

    it('returns zero counts when storage is not configured', async () => {
      const storagelessMastra = new Mastra({
        logger: false,
        workflows: { 'test-workflow': createMockWorkflow('test-workflow') },
      });

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: storagelessMastra }),
      } as any);

      expect(result).toEqual({ 'test-workflow': { running: 0, suspended: 0 } });
    });

    it('serves cached counts within the TTL window and refreshes after expiry', async () => {
      await persistRun(mockMastra, 'test-workflow', 'run-1', 'running');

      const first = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);
      expect(first['test-workflow'].running).toEqual(1);

      await persistRun(mockMastra, 'test-workflow', 'run-2', 'running');

      // Within the TTL the cached map is served, so the new run is invisible.
      fakeNow += 4_000;
      const second = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);
      expect(second['test-workflow'].running).toEqual(1);

      // Past the TTL the counts must refresh — an infinite cache is a regression.
      fakeNow += 2_000;
      const third = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);
      expect(third['test-workflow'].running).toEqual(2);
    });

    it('scopes counts to the reserved request-context resource id and bypasses the cache', async () => {
      await persistRun(mockMastra, 'test-workflow', 'run-a', 'running', 'tenant-a');
      await persistRun(mockMastra, 'test-workflow', 'run-b', 'running', 'tenant-b');
      await persistRun(mockMastra, 'test-workflow', 'run-c', 'suspended', 'tenant-b');

      const scopedContext = new RequestContext();
      scopedContext.set(MASTRA_RESOURCE_ID_KEY, 'tenant-a');

      const scoped = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        requestContext: scopedContext,
      } as any);
      expect(scoped['test-workflow']).toEqual({ running: 1, suspended: 0 });

      // Unscoped request right after: must not be served the scoped map, and
      // the scoped request must not have been served a cached unscoped map.
      const unscoped = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);
      expect(unscoped['test-workflow']).toEqual({ running: 2, suspended: 1 });
    });

    it('returns an empty map when FGA is configured and no user is present, without touching storage', async () => {
      const filterAccessible = vi.fn();
      vi.spyOn(mockMastra, 'getServer').mockReturnValue({ fga: { filterAccessible } } as any);
      const getStorage = vi.spyOn(mockMastra, 'getStorage');

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);

      expect(result).toEqual({});
      expect(filterAccessible).not.toHaveBeenCalled();
      expect(getStorage).not.toHaveBeenCalled();
    });

    it('filters counts to FGA-accessible workflows for the requesting user', async () => {
      await persistRun(mockMastra, 'test-workflow', 'run-1', 'running');
      await persistRun(mockMastra, 'reusable-workflow', 'run-2', 'suspended');

      const filterAccessible = vi.fn().mockResolvedValue([{ id: 'test-workflow' }]);
      vi.spyOn(mockMastra, 'getServer').mockReturnValue({ fga: { filterAccessible } } as any);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        requestContext,
      } as any);

      expect(result).toEqual({ 'test-workflow': { running: 1, suspended: 0 } });
      expect(filterAccessible).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.arrayContaining([{ id: 'test-workflow' }, { id: 'reusable-workflow' }]),
        'workflow',
        'workflows:read',
      );
    });

    it('does not serve or fill the shared cache for FGA-filtered requests', async () => {
      await persistRun(mockMastra, 'test-workflow', 'run-1', 'running');

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      const filterAccessible = vi.fn().mockResolvedValue([{ id: 'test-workflow' }]);
      const getServerSpy = vi.spyOn(mockMastra, 'getServer').mockReturnValue({ fga: { filterAccessible } } as any);

      const fgaResult = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        requestContext,
      } as any);
      expect(fgaResult).toEqual({ 'test-workflow': { running: 1, suspended: 0 } });

      // FGA off again: the filtered map must not come back from the cache.
      getServerSpy.mockReturnValue({} as any);
      const openResult = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);
      expect(openResult['reusable-workflow']).toEqual({ running: 0, suspended: 0 });
    });

    it('counts a genuinely suspended run produced by a real execution', async () => {
      const run = await reusableWorkflow.createRun({ runId: 'suspend-run' });
      await run.start({ inputData: {} });

      const result = await LIST_WORKFLOW_RUN_COUNTS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      } as any);

      expect(result['reusable-workflow'].suspended).toEqual(1);
    });

    it('registers the static run-counts path before the parameterized workflow route', () => {
      const paths = WORKFLOWS_ROUTES.map(route => `${route.method} ${route.path}`);
      const countsIndex = paths.indexOf('GET /workflows/run-counts');
      const paramIndex = paths.indexOf('GET /workflows/:workflowId');

      expect(countsIndex).toBeGreaterThan(-1);
      expect(paramIndex).toBeGreaterThan(-1);
      // Routes register sequentially; the param route would capture
      // "run-counts" as a workflowId if it came first.
      expect(countsIndex).toBeLessThan(paramIndex);
    });
  });

  describe('GET_WORKFLOW_BY_ID_ROUTE', () => {
    it('should declare FGA for workflow reads', async () => {
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      const check = vi.fn().mockResolvedValue(true);
      vi.spyOn(mockMastra, 'getServer').mockReturnValue({ fga: { check } } as any);

      const result = await checkRouteFGA(mockMastra, GET_WORKFLOW_BY_ID_ROUTE as any, requestContext as any, {
        workflowId: 'test-workflow',
      });

      expect(result).toBeNull();
      expect(check).toHaveBeenCalledWith(
        { id: 'user-1' },
        {
          resource: { type: 'workflow', id: 'test-workflow' },
          permission: 'workflows:read',
          context: { resourceId: 'test-workflow', requestContext },
        },
      );
    });

    it('should throw error when workflowId is not provided', async () => {
      await expect(
        GET_WORKFLOW_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: undefined as any,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        GET_WORKFLOW_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'non-existent',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should get workflow by ID successfully', async () => {
      const result = await GET_WORKFLOW_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
      });

      expect(result).toEqual(serializeWorkflow(mockWorkflow));
    });
  });

  describe('START_ASYNC_WORKFLOW_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        START_ASYNC_WORKFLOW_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        START_ASYNC_WORKFLOW_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'non-existent',
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should start workflow run successfully when runId is not passed', async () => {
      const result = await START_ASYNC_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
        inputData: {},
        tracingOptions,
      } as any);

      expect(result.steps['test-step'].status).toEqual('success');
    });

    it('should start workflow run successfully when runId is passed', async () => {
      const result = await START_ASYNC_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: {},
        tracingOptions,
      } as any);

      expect(result.steps['test-step'].status).toEqual('success');
    });
  });

  describe('GET_WORKFLOW_RUN_BY_ID_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
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

      const result = await GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toBeDefined();
    });
  });

  describe('DELETE_WORKFLOW_RUN_BY_ID_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        DELETE_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        DELETE_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Run ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        DELETE_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'non-existent',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should delete workflow run successfully', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(result).toBeDefined();

      const deleteResponse = await DELETE_WORKFLOW_RUN_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
        runId: 'test-run',
      });

      expect(deleteResponse).toEqual({ message: 'Workflow run deleted' });

      await expect(
        GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
          runId: 'test-run',
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });
  });

  describe('CREATE_WORKFLOW_RUN_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        CREATE_WORKFLOW_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when workflow is not found', async () => {
      await expect(
        CREATE_WORKFLOW_RUN_ROUTE.handler({
          mastra: mockMastra,
          workflowId: 'non-existent',
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow not found' }));
    });

    it('should create workflow run successfully', async () => {
      const result = await CREATE_WORKFLOW_RUN_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
      } as any);

      expect(result).toEqual({ runId: 'test-run' });
    });

    it('should create workflow run with resourceId', async () => {
      const resourceId = 'user-create-test';

      const result = await CREATE_WORKFLOW_RUN_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-with-resource-create',
        resourceId,
      } as any);

      expect(result).toEqual({ runId: 'test-run-with-resource-create' });

      // Verify resourceId is stored
      const run = await mockWorkflow.getWorkflowRunById('test-run-with-resource-create');
      expect(run?.resourceId).toBe(resourceId);
    });
  });

  describe('START_WORKFLOW_RUN_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        START_WORKFLOW_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        START_WORKFLOW_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to start run' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        START_WORKFLOW_RUN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
          runId: 'non-existent',
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should start workflow run successfully', async () => {
      const run = await mockWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({ inputData: {} });

      const result = await START_WORKFLOW_RUN_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run',
        inputData: { test: 'data' },
        tracingOptions,
      } as any);

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

      await START_WORKFLOW_RUN_ROUTE.handler({
        mastra: freshMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-start-resource',
        inputData: { test: 'data' },
      } as any);

      // Wait for the workflow to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify resourceId is preserved in storage after start completes
      const runAfter = await freshWorkflow.getWorkflowRunById('test-run-start-resource');
      expect(runAfter?.resourceId).toBe(resourceId);
    });
  });

  describe('RESUME_ASYNC_WORKFLOW_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        RESUME_ASYNC_WORKFLOW_ROUTE.handler({
          mastra: mockMastra,
          runId: 'test-run',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        RESUME_ASYNC_WORKFLOW_ROUTE.handler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        RESUME_ASYNC_WORKFLOW_ROUTE.handler({
          mastra: mockMastra,
          workflowId: 'test-workflow',
          runId: 'non-existent',
          step: 'test-step',
          resumeData: {},
        } as any),
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

      const result = await RESUME_ASYNC_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: reusableWorkflow.name,
        runId: 'test-run-async-resume',
        step: 'test-step',
        resumeData: { test: 'data' },
      } as any);

      // The workflow should have resumed
      expect(result).toBeDefined();

      // Wait for any storage updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // resourceId should be preserved after resume
      const runAfterResume = await reusableWorkflow.getWorkflowRunById('test-run-async-resume');
      expect(runAfterResume?.resourceId).toBe(resourceId);
    });
  });

  describe('RESUME_WORKFLOW_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        RESUME_WORKFLOW_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          runId: 'test-run',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should throw error when runId is not provided', async () => {
      await expect(
        RESUME_WORKFLOW_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'runId required to resume workflow' }));
    });

    it('should throw error when workflow run is not found', async () => {
      await expect(
        RESUME_WORKFLOW_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: 'test-workflow',
          runId: 'non-existent',
          step: 'test-step',
          resumeData: {},
        } as any),
      ).rejects.toThrow(new HTTPException(404, { message: 'Workflow run not found' }));
    });

    it('should resume workflow run successfully', async () => {
      const run = await reusableWorkflow.createRun({
        runId: 'test-run',
      });

      await run.start({
        inputData: {},
      });

      const result = await RESUME_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: reusableWorkflow.name,
        runId: 'test-run',
        step: 'test-step',
        resumeData: { test: 'data' },
        tracingOptions,
      } as any);

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

      await RESUME_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: freshMastra }),
        workflowId: 'reusable-workflow',
        runId: 'test-run-with-resource',
        step: 'test-step',
        resumeData: { test: 'data' },
      } as any);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // resourceId should be preserved after resume
      const runAfterResume = await freshWorkflow.getWorkflowRunById('test-run-with-resource');
      expect(runAfterResume?.resourceId).toBe(resourceId);
    });
  });

  describe('RESUME_STREAM_WORKFLOW_ROUTE', () => {
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

      const stream = await RESUME_STREAM_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: freshMastra }),
        workflowId: 'reusable-workflow',
        runId: 'test-run-stream-resume',
        step: 'test-step',
        resumeData: { test: 'data' },
      } as any);

      expect(stream).toBeDefined();

      // Wait for stream operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // resourceId should be preserved after resume
      const runAfterResume = await freshWorkflow.getWorkflowRunById('test-run-stream-resume');
      expect(runAfterResume?.resourceId).toBe(resourceId);
    });
  });

  describe('LIST_WORKFLOW_RUNS_ROUTE', () => {
    it('should throw error when workflowId is not provided', async () => {
      await expect(
        LIST_WORKFLOW_RUNS_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          workflowId: undefined,
        } as any),
      ).rejects.toThrow(new HTTPException(400, { message: 'Workflow ID is required' }));
    });

    it('should get workflow runs successfully (empty)', async () => {
      const result = await LIST_WORKFLOW_RUNS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
      } as any);

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
      const result = await LIST_WORKFLOW_RUNS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'test-workflow',
      } as any);

      expect(result.total).toEqual(1);
    });
  });

  describe('OBSERVE_STREAM_WORKFLOW_ROUTE', () => {
    it('should preserve resourceId when observing stream after server restart', async () => {
      const resourceId = 'user-observe-test';

      // Create run with resourceId
      const run = await mockWorkflow.createRun({
        runId: 'test-run-observe-resource',
        resourceId,
      });
      await run.start({ inputData: {} });

      const runBefore = await mockWorkflow.getWorkflowRunById('test-run-observe-resource');
      expect(runBefore?.resourceId).toBe(resourceId);

      // Simulate server restart
      const freshWorkflow = createMockWorkflow('test-workflow');
      const freshMastra = new Mastra({
        logger: false,
        workflows: { 'test-workflow': freshWorkflow },
        storage: mockMastra.getStorage(),
      });

      const stream = await OBSERVE_STREAM_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: freshMastra }),
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

  describe('CANCEL_WORKFLOW_RUN_ROUTE', () => {
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

      const result = await CANCEL_WORKFLOW_RUN_ROUTE.handler({
        ...createTestServerContext({ mastra: freshMastra }),
        workflowId: 'test-workflow',
        runId: 'test-run-cancel-resource',
      });
      expect(result).toEqual({ message: 'Workflow run cancelled' });

      // Verify resourceId is preserved
      const runAfter = await freshWorkflow.getWorkflowRunById('test-run-cancel-resource');
      expect(runAfter?.resourceId).toBe(resourceId);
    });
  });

  describe('STREAM_WORKFLOW_ROUTE', () => {
    it('should stream workflow with resourceId', async () => {
      const resourceId = 'user-stream-test';

      // Stream the workflow with resourceId - creates the run and sets resourceId
      await STREAM_WORKFLOW_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-stream-resource',
        resourceId,
        inputData: {},
      } as any);

      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify resourceId is stored
      const storedRun = await mockWorkflow.getWorkflowRunById('test-run-stream-resource');
      expect(storedRun?.resourceId).toBe(resourceId);
    });
  });

  describe('requestContext passthrough', () => {
    it('STREAM_WORKFLOW_ROUTE should pass requestContext to run.stream()', async () => {
      const requestContext = createTestServerContext({ mastra: mockMastra }).requestContext;
      requestContext.set('custom-key', 'stream-workflow-value');

      // Create a run first to spy on it
      const run = await mockWorkflow.createRun({ runId: 'test-run-rc-stream' });

      // Spy on the stream method to capture options
      let capturedOptions: any;
      const originalStream = run.stream.bind(run);
      vi.spyOn(run, 'stream').mockImplementation((options: any) => {
        capturedOptions = options;
        return originalStream(options);
      });

      // Also spy on workflow.createRun to return our spied run
      vi.spyOn(mockWorkflow, 'createRun').mockResolvedValue(run);

      await STREAM_WORKFLOW_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-rc-stream',
        requestContext,
        inputData: {},
      } as any);

      // Verify requestContext was passed through
      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('stream-workflow-value');
    });

    it('START_ASYNC_WORKFLOW_ROUTE should pass requestContext to run.start()', async () => {
      const requestContext = createTestServerContext({ mastra: mockMastra }).requestContext;
      requestContext.set('custom-key', 'start-async-value');

      // Create a run first to spy on it
      const run = await mockWorkflow.createRun({ runId: 'test-run-rc-start' });

      // Spy on the start method to capture options
      let capturedOptions: any;
      const originalStart = run.start.bind(run);
      vi.spyOn(run, 'start').mockImplementation((options: any) => {
        capturedOptions = options;
        return originalStart(options);
      });

      // Also spy on workflow.createRun to return our spied run
      vi.spyOn(mockWorkflow, 'createRun').mockResolvedValue(run);

      await START_ASYNC_WORKFLOW_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'test-workflow',
        runId: 'test-run-rc-start',
        requestContext,
        inputData: {},
      } as any);

      // Verify requestContext was passed through
      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('start-async-value');
    });

    it('RESUME_ASYNC_WORKFLOW_ROUTE should pass requestContext to run.resume()', async () => {
      const requestContext = createTestServerContext({ mastra: mockMastra }).requestContext;
      requestContext.set('custom-key', 'resume-async-value');

      // Create and start a run that will suspend
      const run = await reusableWorkflow.createRun({ runId: 'test-run-rc-resume' });
      await run.start({ inputData: {} });

      // Wait for it to suspend
      await new Promise(resolve => setTimeout(resolve, 100));

      // Spy on the resume method to capture options
      let capturedOptions: any;
      const originalResume = run.resume.bind(run);
      vi.spyOn(run, 'resume').mockImplementation((options: any) => {
        capturedOptions = options;
        return originalResume(options);
      });

      // Spy on workflow.createRun to return our spied run
      vi.spyOn(reusableWorkflow, 'createRun').mockResolvedValue(run);

      await RESUME_ASYNC_WORKFLOW_ROUTE.handler({
        mastra: mockMastra,
        workflowId: 'reusable-workflow',
        runId: 'test-run-rc-resume',
        requestContext,
        step: 'test-step',
        resumeData: {},
      } as any);

      // Verify requestContext was passed through
      expect(capturedOptions.requestContext).toBeDefined();
      expect(capturedOptions.requestContext.get('custom-key')).toBe('resume-async-value');
    });

    it('RESUME_ASYNC_WORKFLOW_ROUTE should pass forEachIndex to run.resume()', async () => {
      // Create and start a run that will suspend
      const run = await reusableWorkflow.createRun({ runId: 'test-run-foreach-index' });
      await run.start({ inputData: {} });

      // Wait for it to suspend
      await new Promise(resolve => setTimeout(resolve, 100));

      // Spy on the resume method to capture options
      let capturedOptions: any;
      const originalResume = run.resume.bind(run);
      vi.spyOn(run, 'resume').mockImplementation((options: any) => {
        capturedOptions = options;
        return originalResume(options);
      });

      vi.spyOn(reusableWorkflow, 'createRun').mockResolvedValue(run);

      await RESUME_ASYNC_WORKFLOW_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        workflowId: 'reusable-workflow',
        runId: 'test-run-foreach-index',
        step: 'test-step',
        resumeData: {},
        forEachIndex: 2,
      } as any);

      expect(capturedOptions.forEachIndex).toBe(2);
    });
  });
});
