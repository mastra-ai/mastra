import { ReadableStream, TransformStream } from 'node:stream/web';
import type { RequestContext } from '@mastra/core/di';
import type { WorkflowInfo, ChunkType, StreamEvent, WorkflowStateField } from '@mastra/core/workflows';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { streamResponseSchema } from '../schemas/agents';
import { optionalRunIdSchema, runIdSchema } from '../schemas/common';
import {
  createWorkflowRunBodySchema,
  createWorkflowRunResponseSchema,
  listWorkflowRunsQuerySchema,
  listWorkflowsResponseSchema,
  restartBodySchema,
  timeTravelBodySchema,
  resumeBodySchema,
  startAsyncWorkflowBodySchema,
  streamWorkflowBodySchema,
  workflowControlResponseSchema,
  workflowExecutionResultSchema,
  workflowIdPathParams,
  workflowInfoSchema,
  workflowRunPathParams,
  workflowRunsResponseSchema,
  workflowRunResultQuerySchema,
  workflowRunResultSchema,
} from '../schemas/workflows';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';
import { getEffectiveResourceId, validateRunOwnership } from './utils';

export interface WorkflowContext extends Context {
  workflowId?: string;
  runId?: string;
  requestContext?: RequestContext;
}

async function listWorkflowsFromSystem({ mastra, workflowId }: WorkflowContext) {
  const logger = mastra.getLogger();

  if (!workflowId) {
    throw new HTTPException(400, { message: 'Workflow ID is required' });
  }

  let workflow;

  // First check registry for temporary workflows
  workflow = WorkflowRegistry.getWorkflow(workflowId);

  if (!workflow) {
    try {
      workflow = mastra.getWorkflowById(workflowId);
    } catch (error) {
      logger.debug('Error getting workflow, searching agents for workflow', error);
    }
  }

  if (!workflow) {
    logger.debug('Workflow not found, searching agents for workflow', { workflowId });
    const agents = mastra.listAgents();

    if (Object.keys(agents || {}).length) {
      for (const [_, agent] of Object.entries(agents)) {
        try {
          const workflows = await agent.listWorkflows();

          if (workflows[workflowId]) {
            workflow = workflows[workflowId];
            break;
          }
          break;
        } catch (error) {
          logger.debug('Error getting workflow from agent', error);
        }
      }
    }
  }

  if (!workflow) {
    throw new HTTPException(404, { message: 'Workflow not found' });
  }

  return { workflow };
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_WORKFLOWS_ROUTE = createRoute({
  method: 'GET',
  path: '/workflows',
  responseType: 'json',
  queryParamSchema: z.object({
    partial: z.string().optional(),
  }),
  responseSchema: listWorkflowsResponseSchema,
  summary: 'List all workflows',
  description: 'Returns a list of all available workflows in the system',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, partial }) => {
    try {
      const workflows = mastra.listWorkflows({ serialized: false });
      const isPartial = partial === 'true';
      const _workflows = Object.entries(workflows).reduce<Record<string, WorkflowInfo>>((acc, [key, workflow]) => {
        acc[key] = getWorkflowInfo(workflow, isPartial);
        return acc;
      }, {});
      return _workflows;
    } catch (error) {
      return handleError(error, 'Error getting workflows');
    }
  },
});

export const GET_WORKFLOW_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/workflows/:workflowId',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  responseSchema: workflowInfoSchema,
  summary: 'Get workflow by ID',
  description: 'Returns details for a specific workflow',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }
      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });
      return getWorkflowInfo(workflow);
    } catch (error) {
      return handleError(error, 'Error getting workflow');
    }
  },
});

export const LIST_WORKFLOW_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/workflows/:workflowId/runs',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: listWorkflowRunsQuerySchema,
  responseSchema: workflowRunsResponseSchema,
  summary: 'List workflow runs',
  description: 'Returns a paginated list of execution runs for the specified workflow',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({
    mastra,
    workflowId,
    fromDate,
    toDate,
    page,
    perPage,
    limit,
    offset,
    resourceId,
    status,
    requestContext,
  }) => {
    try {
      // Use effective resourceId (context key takes precedence over client-provided value)
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      // Support both page/perPage and limit/offset for backwards compatibility
      // If page/perPage provided, use directly; otherwise convert from limit/offset
      let finalPage = page;
      let finalPerPage = perPage;

      if (finalPerPage === undefined && limit !== undefined) {
        finalPerPage = limit;
      }
      if (finalPage === undefined && offset !== undefined && finalPerPage !== undefined && finalPerPage > 0) {
        finalPage = Math.floor(offset / finalPerPage);
      }

      if (
        finalPerPage !== undefined &&
        (typeof finalPerPage !== 'number' || !Number.isInteger(finalPerPage) || finalPerPage <= 0)
      ) {
        throw new HTTPException(400, { message: 'perPage must be a positive integer' });
      }
      if (finalPage !== undefined && (!Number.isInteger(finalPage) || finalPage < 0)) {
        throw new HTTPException(400, { message: 'page must be a non-negative integer' });
      }
      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });
      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }
      const workflowRuns = (await workflow.listWorkflowRuns({
        fromDate: fromDate ? (typeof fromDate === 'string' ? new Date(fromDate) : fromDate) : undefined,
        toDate: toDate ? (typeof toDate === 'string' ? new Date(toDate) : toDate) : undefined,
        perPage: finalPerPage,
        page: finalPage,
        resourceId: effectiveResourceId,
        status,
      })) || {
        runs: [],
        total: 0,
      };
      return workflowRuns;
    } catch (error) {
      return handleError(error, 'Error getting workflow runs');
    }
  },
});

export const GET_WORKFLOW_RUN_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/workflows/:workflowId/runs/:runId',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  queryParamSchema: workflowRunResultQuerySchema,
  responseSchema: workflowRunResultSchema,
  summary: 'Get workflow run by ID',
  description:
    'Returns a workflow run with metadata and processed execution state. Use the fields query parameter to reduce payload size by requesting only specific fields (e.g., ?fields=status,result,metadata)',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, fields, withNestedWorkflows, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      // Parse fields parameter (comma-separated string)
      const fieldList = fields ? (fields.split(',').map((f: string) => f.trim()) as WorkflowStateField[]) : undefined;

      const run = await workflow.getWorkflowRunById(runId, {
        withNestedWorkflows: withNestedWorkflows !== 'false', // Default to true unless explicitly 'false'
        fields: fieldList,
      });

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      return run;
    } catch (error) {
      return handleError(error, 'Error getting workflow run');
    }
  },
});

export const DELETE_WORKFLOW_RUN_BY_ID_ROUTE = createRoute({
  method: 'DELETE',
  path: '/workflows/:workflowId/runs/:runId',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Delete workflow run by ID',
  description: 'Deletes a specific workflow run by ID',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      // Validate ownership before deletion
      const run = await workflow.getWorkflowRunById(runId);
      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }
      await validateRunOwnership(run, effectiveResourceId);

      await workflow.deleteWorkflowRunById(runId);

      return { message: 'Workflow run deleted' };
    } catch (error) {
      return handleError(error, 'Error deleting workflow run');
    }
  },
});

export const CREATE_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/create-run',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: createWorkflowRunBodySchema,
  responseSchema: createWorkflowRunResponseSchema,
  summary: 'Create workflow run',
  description: 'Creates a new workflow execution instance with an optional custom run ID',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, resourceId, disableScorers, requestContext }) => {
    try {
      // Use effective resourceId (context key takes precedence over client-provided value)
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.createRun({ runId, resourceId: effectiveResourceId, disableScorers });

      return { runId: run.runId };
    } catch (error) {
      return handleError(error, 'Error creating workflow run');
    }
  },
});

export const STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/stream',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamWorkflowBodySchema,
  summary: 'Stream workflow execution',
  description: 'Executes a workflow and streams the results in real-time',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, resourceId, requestContext, ...params }) => {
    try {
      // Use effective resourceId (context key takes precedence over client-provided value)
      const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to stream workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }
      const serverCache = mastra.getServerCache();

      const run = await workflow.createRun({ runId, resourceId: effectiveResourceId });
      const result = run.stream(params);
      return result.fullStream.pipeThrough(
        new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            if (serverCache) {
              const cacheKey = runId;
              serverCache.listPush(cacheKey, chunk).catch(() => {});
            }
            controller.enqueue(chunk);
          },
        }),
      );
    } catch (error) {
      return handleError(error, 'Error streaming workflow');
    }
  },
});

export const RESUME_STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/resume-stream',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Resume workflow stream',
  description: 'Resumes a suspended workflow execution and continues streaming results',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to resume workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const serverCache = mastra.getServerCache();

      const stream = _run.resumeStream(params).fullStream.pipeThrough(
        new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            if (serverCache) {
              const cacheKey = runId;
              serverCache.listPush(cacheKey, chunk).catch(() => {});
            }

            controller.enqueue(chunk);
          },
        }),
      );

      return stream;
    } catch (error) {
      return handleError(error, 'Error resuming workflow');
    }
  },
});

export const START_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/start-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: startAsyncWorkflowBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Start workflow asynchronously',
  description: 'Starts a workflow execution asynchronously without streaming results',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, ...params }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const _run = await workflow.createRun({ runId });
      const result = await _run.start(params);
      return result;
    } catch (error) {
      return handleError(error, 'Error starting async workflow');
    }
  },
});

export const START_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/start',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: startAsyncWorkflowBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Start specific workflow run',
  description: 'Starts execution of a specific workflow run by ID',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to start run' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      void _run.start({
        ...params,
      });

      return { message: 'Workflow run started' };
    } catch (e) {
      return handleError(e, 'Error starting workflow run');
    }
  },
});

export const OBSERVE_STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/observe',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  responseSchema: streamResponseSchema,
  summary: 'Observe workflow stream',
  description: 'Observes and streams updates from an already running workflow execution',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to observe workflow stream' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const serverCache = mastra.getServerCache();
      if (!serverCache) {
        throw new HTTPException(500, { message: 'Server cache not found' });
      }

      // Get cached chunks first
      const cachedRunChunks = await serverCache.listFromTo(runId, 0);

      // Create a readable stream that first emits cached chunks, then the live stream
      const combinedStream = new ReadableStream<ChunkType>({
        start(controller) {
          // First, emit all cached chunks
          const emitCachedChunks = async () => {
            for (const chunk of cachedRunChunks) {
              controller.enqueue(chunk as ChunkType);
            }
          };

          // Then, pipe the live stream
          const liveStream = _run.observeStream();
          const reader = liveStream.getReader();

          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  break;
                }
                controller.enqueue(value);
              }
            } catch (error) {
              controller.error(error);
            } finally {
              reader.releaseLock();
            }
          };

          // Start with cached chunks, then live stream
          void emitCachedChunks()
            .then(() => {
              void pump();
            })
            .catch(error => {
              controller.error(error);
            });
        },
      });

      return combinedStream;
    } catch (error) {
      return handleError(error, 'Error observing workflow stream');
    }
  },
});

export const RESUME_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/resume-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Resume workflow asynchronously',
  description: 'Resumes a suspended workflow execution asynchronously without streaming',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to resume workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const result = await _run.resume(params);

      return result;
    } catch (error) {
      return handleError(error, 'Error resuming workflow step');
    }
  },
});

export const RESUME_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/resume',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Resume workflow',
  description: 'Resumes a suspended workflow execution from a specific step',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to resume workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

      void _run.resume(params);

      return { message: 'Workflow run resumed' };
    } catch (error) {
      return handleError(error, 'Error resuming workflow');
    }
  },
});

export const RESTART_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/restart-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: restartBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Restart workflow asynchronously',
  description: 'Restarts an active workflow execution asynchronously',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to restart workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const result = await _run.restart(params);

      return result;
    } catch (error) {
      return handleError(error, 'Error restarting workflow');
    }
  },
});

export const RESTART_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/restart',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: restartBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Restart workflow',
  description: 'Restarts an active workflow execution',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to restart workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

      void _run.restart(params);

      return { message: 'Workflow run restarted' };
    } catch (error) {
      return handleError(error, 'Error restarting workflow');
    }
  },
});

export const RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ASYNC_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/restart-all-active-workflow-runs-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Restart all active workflow runs asynchronously',
  description: 'Restarts all active workflow runs asynchronously',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      await workflow.restartAllActiveWorkflowRuns();

      return { message: 'All active workflow runs restarted' };
    } catch (error) {
      return handleError(error, 'Error restarting workflow');
    }
  },
});

export const RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/restart-all-active-workflow-runs',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Restart all active workflow runs',
  description: 'Restarts all active workflow runs',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      void workflow.restartAllActiveWorkflowRuns();

      return { message: 'All active workflow runs restarted' };
    } catch (error) {
      return handleError(error, 'Error restarting workflow');
    }
  },
});

export const TIME_TRAVEL_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/time-travel-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: timeTravelBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Time travel workflow asynchronously',
  description: 'Time travels a workflow run asynchronously without streaming',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to time travel workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const result = await _run.timeTravel(params);

      return result;
    } catch (error) {
      return handleError(error, 'Error time traveling workflow');
    }
  },
});

export const TIME_TRAVEL_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/time-travel',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: timeTravelBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Time travel workflow',
  description: 'Time travels a workflow run, starting from a specific step',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext, ...params }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to time travel workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

      void _run.timeTravel(params);

      return { message: 'Workflow run time travel started' };
    } catch (error) {
      return handleError(error, 'Error time traveling workflow');
    }
  },
});

export const TIME_TRAVEL_STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/time-travel-stream',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: timeTravelBodySchema,
  summary: 'Time travel workflow stream',
  description: 'Time travels a workflow run, starting from a specific step, and streams the results in real-time',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, ...params }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to time travel workflow stream' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }
      const serverCache = mastra.getServerCache();

      const run = await workflow.createRun({ runId });
      const result = run.timeTravelStream(params);
      return result.fullStream.pipeThrough(
        new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            if (serverCache) {
              const cacheKey = runId;
              serverCache.listPush(cacheKey, chunk).catch(() => {});
            }
            controller.enqueue(chunk);
          },
        }),
      );
    } catch (error) {
      return handleError(error, 'Error time traveling workflow stream');
    }
  },
});

export const CANCEL_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/runs/:runId/cancel',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Cancel workflow run',
  description: 'Cancels an in-progress workflow execution',
  tags: ['Workflows'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to cancel workflow run' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

      await _run.cancel();

      return { message: 'Workflow run cancelled' };
    } catch (error) {
      return handleError(error, 'Error canceling workflow run');
    }
  },
});

// Legacy routes (deprecated)
export const STREAM_LEGACY_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/stream-legacy',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamWorkflowBodySchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Stream workflow with legacy format',
  description: 'Legacy endpoint for streaming workflow execution. Use /workflows/:workflowId/stream instead.',
  tags: ['Workflows', 'Legacy'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, ...params }) => {
    try {
      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to resume workflow' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const serverCache = mastra.getServerCache();

      const run = await workflow.createRun({ runId });
      const result = run.streamLegacy({
        ...params,
        onChunk: async chunk => {
          if (serverCache) {
            const cacheKey = runId;
            await serverCache.listPush(cacheKey, chunk);
          }
        },
      });

      return result.stream;
    } catch (error) {
      return handleError(error, 'Error executing workflow');
    }
  },
});

export const OBSERVE_STREAM_LEGACY_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/workflows/:workflowId/observe-stream-legacy',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Observe workflow stream with legacy format',
  description: 'Legacy endpoint for observing workflow stream. Use /workflows/:workflowId/observe instead.',
  tags: ['Workflows', 'Legacy'],
  requiresAuth: true,
  handler: async ({ mastra, workflowId, runId, requestContext }) => {
    try {
      const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);

      if (!workflowId) {
        throw new HTTPException(400, { message: 'Workflow ID is required' });
      }

      if (!runId) {
        throw new HTTPException(400, { message: 'runId required to observe workflow stream' });
      }

      const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

      if (!workflow) {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }

      const run = await workflow.getWorkflowRunById(runId);

      if (!run) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      await validateRunOwnership(run, effectiveResourceId);

      const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
      const serverCache = mastra.getServerCache();
      if (!serverCache) {
        throw new HTTPException(500, { message: 'Server cache not found' });
      }

      const transformStream = new TransformStream<StreamEvent, StreamEvent>();

      const writer = transformStream.writable.getWriter();

      const cachedRunChunks = await serverCache.listFromTo(runId, 0);

      for (const chunk of cachedRunChunks) {
        await writer.write(chunk as any);
      }

      writer.releaseLock();

      const result = _run.observeStreamLegacy();
      return result.stream?.pipeThrough(transformStream);
    } catch (error) {
      return handleError(error, 'Error observing workflow stream');
    }
  },
});
