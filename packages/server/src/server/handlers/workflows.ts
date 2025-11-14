import { ReadableStream, TransformStream } from 'node:stream/web';
import { RequestContext } from '@mastra/core/di';
import type { TracingOptions } from '@mastra/core/observability';
import type { WorkflowRuns } from '@mastra/core/storage';
import type { Workflow, WorkflowInfo, ChunkType, StreamEvent, WorkflowState } from '@mastra/core/workflows';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { ServerRoute } from '../server-adapter/routes';
import {
  createWorkflowRunResponseSchema,
  listWorkflowRunsQuerySchema,
  listWorkflowsResponseSchema,
  resumeBodySchema,
  startAsyncWorkflowBodySchema,
  streamWorkflowBodySchema,
  workflowControlResponseSchema,
  workflowExecutionResultSchema,
  workflowIdPathParams,
  workflowInfoSchema,
  workflowRunPathParams,
  workflowRunResponseSchema,
  workflowRunsResponseSchema,
} from '../schemas/workflows';
import { optionalRunIdSchema, runIdSchema } from '../schemas/common';

export interface WorkflowContext extends Context {
  workflowId?: string;
  runId?: string;
}

export async function listWorkflowsHandler({ mastra }: WorkflowContext) {
  try {
    const workflows = mastra.listWorkflows({ serialized: false });
    const _workflows = Object.entries(workflows).reduce<Record<string, WorkflowInfo>>((acc, [key, workflow]) => {
      acc[key] = getWorkflowInfo(workflow);
      return acc;
    }, {});
    return _workflows;
  } catch (error) {
    return handleError(error, 'Error getting workflows');
  }
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

export async function getWorkflowByIdHandler({ mastra, workflowId }: WorkflowContext): Promise<WorkflowInfo> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    return getWorkflowInfo(workflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}

export async function getWorkflowRunByIdHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<ReturnType<Workflow['getWorkflowRunById']>> {
  try {
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

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    return run;
  } catch (error) {
    return handleError(error, 'Error getting workflow run');
  }
}

export async function getWorkflowRunExecutionResultHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>): Promise<WorkflowState> {
  try {
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

    const executionResult = await workflow.getWorkflowRunExecutionResult(runId);

    if (!executionResult) {
      throw new HTTPException(404, { message: 'Workflow run execution result not found' });
    }

    return executionResult;
  } catch (error) {
    return handleError(error, 'Error getting workflow run execution result');
  }
}

export async function createWorkflowRunHandler({
  mastra,
  workflowId,
  runId: prevRunId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const run = await workflow.createRun({ runId: prevRunId });

    return { runId: run.runId };
  } catch (error) {
    return handleError(error, 'Error creating workflow run');
  }
}

export async function startAsyncWorkflowHandler({
  mastra,
  requestContext,
  workflowId,
  runId,
  inputData,
  tracingOptions,
  workflowRequestContext,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const _run = await workflow.createRun({ runId });
    const result = await _run.start({
      inputData,
      requestContext: finalRequestContext,
      tracingOptions,
    });
    return result;
  } catch (error) {
    return handleError(error, 'Error starting async workflow');
  }
}

export async function startWorkflowRunHandler({
  mastra,
  requestContext,
  workflowId,
  runId,
  inputData,
  tracingOptions,
  workflowRequestContext,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
  try {
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

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
    void _run.start({
      inputData,
      requestContext: finalRequestContext,
      tracingOptions,
    });

    return { message: 'Workflow run started' };
  } catch (e) {
    return handleError(e, 'Error starting workflow run');
  }
}

export async function streamWorkflowHandler({
  mastra,
  requestContext,
  workflowId,
  runId,
  inputData,
  tracingOptions,
  workflowRequestContext,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
  return streamVNextWorkflowHandler({
    mastra,
    workflowId,
    runId,
    inputData,
    requestContext,
    tracingOptions,
    workflowRequestContext,
  });
}

export async function streamLegacyWorkflowHandler({
  mastra,
  requestContext,
  workflowId,
  runId,
  inputData,
  tracingOptions,
  workflowRequestContext,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
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

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const serverCache = mastra.getServerCache();

    const run = await workflow.createRun({ runId });
    const result = run.streamLegacy({
      inputData,
      requestContext: finalRequestContext,
      onChunk: async chunk => {
        if (serverCache) {
          const cacheKey = runId;
          await serverCache.listPush(cacheKey, chunk);
        }
      },
      tracingOptions,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error executing workflow');
  }
}

export async function observeStreamLegacyWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
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
}

export async function observeStreamWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  return observeStreamVNextWorkflowHandler({ mastra, workflowId, runId });
}

export async function streamVNextWorkflowHandler({
  mastra,
  requestContext,
  workflowId,
  runId,
  inputData,
  closeOnSuspend,
  tracingOptions,
  workflowRequestContext,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'> & {
  inputData?: unknown;
  requestContext?: RequestContext;
  closeOnSuspend?: boolean;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
  try {
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

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const serverCache = mastra.getServerCache();

    const run = await workflow.createRun({ runId });
    const result = run.stream({
      inputData,
      requestContext: finalRequestContext,
      closeOnSuspend,
      tracingOptions,
    });
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
}

export async function observeStreamVNextWorkflowHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
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
}

export async function resumeAsyncWorkflowHandler({
  mastra,
  workflowId,
  runId,
  step,
  resumeData,
  requestContext,
  tracingOptions,
  workflowRequestContext,
}: WorkflowContext & {
  step: string | string[];
  resumeData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
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

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
    const result = await _run.resume({
      step,
      resumeData,
      requestContext: finalRequestContext,
      tracingOptions,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error resuming workflow step');
  }
}

export async function resumeWorkflowHandler({
  mastra,
  workflowId,
  runId,
  step,
  resumeData,
  requestContext,
  tracingOptions,
  workflowRequestContext,
}: WorkflowContext & {
  step: string | string[];
  resumeData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
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

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

    void _run.resume({
      step,
      resumeData,
      requestContext: finalRequestContext,
      tracingOptions,
    });

    return { message: 'Workflow run resumed' };
  } catch (error) {
    return handleError(error, 'Error resuming workflow');
  }
}

export async function resumeStreamWorkflowHandler({
  mastra,
  workflowId,
  runId,
  step,
  resumeData,
  requestContext,
  tracingOptions,
  workflowRequestContext,
}: WorkflowContext & {
  step: string | string[];
  resumeData?: unknown;
  requestContext?: RequestContext;
  tracingOptions?: TracingOptions;
  workflowRequestContext?: Record<string, unknown>;
}) {
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

    const run = await workflow.getWorkflowRunById(runId);

    if (!run) {
      throw new HTTPException(404, { message: 'Workflow run not found' });
    }

    // Merge Context's requestContext with body's workflowRequestContext
    const finalRequestContext = new RequestContext<Record<string, unknown>>([
      ...Array.from(requestContext?.entries() ?? []),
      ...Array.from(Object.entries(workflowRequestContext ?? {})),
    ]);

    const _run = await workflow.createRun({ runId, resourceId: run.resourceId });
    const serverCache = mastra.getServerCache();

    const stream = _run
      .resumeStream({
        step,
        resumeData,
        requestContext: finalRequestContext,
        tracingOptions,
      })
      .fullStream.pipeThrough(
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
}

export async function listWorkflowRunsHandler({
  mastra,
  workflowId,
  fromDate,
  toDate,
  perPage,
  page,
  resourceId,
}: WorkflowContext & {
  fromDate?: Date;
  toDate?: Date;
  perPage?: number | false;
  page?: number;
  resourceId?: string;
}): Promise<WorkflowRuns> {
  try {
    if (!workflowId) {
      throw new HTTPException(400, { message: 'Workflow ID is required' });
    }

    // Validate pagination parameters
    if (perPage !== undefined && perPage !== false && (!Number.isInteger(perPage) || perPage <= 0)) {
      throw new HTTPException(400, { message: 'perPage must be a positive integer or false' });
    }
    if (page !== undefined && (!Number.isInteger(page) || page < 0)) {
      throw new HTTPException(400, { message: 'page must be a non-negative integer' });
    }

    const { workflow } = await listWorkflowsFromSystem({ mastra, workflowId });

    if (!workflow) {
      throw new HTTPException(404, { message: 'Workflow not found' });
    }

    const workflowRuns = (await workflow.listWorkflowRuns({ fromDate, toDate, perPage, page, resourceId })) || {
      runs: [],
      total: 0,
    };
    return workflowRuns;
  } catch (error) {
    return handleError(error, 'Error getting workflow runs');
  }
}

export async function cancelWorkflowRunHandler({
  mastra,
  workflowId,
  runId,
}: Pick<WorkflowContext, 'mastra' | 'workflowId' | 'runId'>) {
  try {
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

    const _run = await workflow.createRun({ runId, resourceId: run.resourceId });

    await _run.cancel();

    return { message: 'Workflow run cancelled' };
  } catch (error) {
    return handleError(error, 'Error canceling workflow run');
  }
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_WORKFLOWS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflows',
  responseType: 'json',
  responseSchema: listWorkflowsResponseSchema,
  summary: 'List all workflows',
  description: 'Returns a list of all available workflows in the system',
  tags: ['Workflows'],
  handler: async ctx => await listWorkflowsHandler(ctx),
});

export const GET_WORKFLOW_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflows/:workflowId',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  responseSchema: workflowInfoSchema,
  summary: 'Get workflow by ID',
  description: 'Returns details for a specific workflow',
  tags: ['Workflows'],
  handler: async ctx => await getWorkflowByIdHandler(ctx),
});

export const LIST_WORKFLOW_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflows/:workflowId/runs',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: listWorkflowRunsQuerySchema,
  responseSchema: workflowRunsResponseSchema,
  summary: 'List workflow runs',
  description: 'Returns a paginated list of execution runs for the specified workflow',
  tags: ['Workflows'],
  handler: async ctx => await listWorkflowRunsHandler(ctx),
});

export const GET_WORKFLOW_RUN_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflows/:workflowId/runs/:runId',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  responseSchema: workflowRunResponseSchema,
  summary: 'Get workflow run by ID',
  description: 'Returns details for a specific workflow run',
  tags: ['Workflows'],
  handler: async ctx => await getWorkflowRunByIdHandler(ctx),
});

export const CREATE_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/create-run',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  responseSchema: createWorkflowRunResponseSchema,
  summary: 'Create workflow run',
  description: 'Creates a new workflow execution instance with an optional custom run ID',
  tags: ['Workflows'],
  handler: async ctx => await createWorkflowRunHandler(ctx),
});

export const STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/stream',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamWorkflowBodySchema,
  summary: 'Stream workflow execution',
  description: 'Executes a workflow and streams the results in real-time',
  tags: ['Workflows'],
  handler: async ctx => await streamWorkflowHandler(ctx),
});

export const STREAM_VNEXT_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/streamVNext',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamWorkflowBodySchema,
  summary: 'Stream workflow execution (v2)',
  description: 'Executes a workflow using the v2 streaming API and streams the results in real-time',
  tags: ['Workflows'],
  handler: async ctx => await streamWorkflowHandler(ctx),
});

export const RESUME_STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/resume-stream',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  summary: 'Resume workflow stream',
  description: 'Resumes a suspended workflow execution and continues streaming results',
  tags: ['Workflows'],
  handler: async ctx => await resumeStreamWorkflowHandler(ctx as any),
});

export const GET_WORKFLOW_RUN_EXECUTION_RESULT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflows/:workflowId/runs/:runId/execution-result',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Get workflow execution result',
  description: 'Returns the final execution result of a completed workflow run',
  tags: ['Workflows'],
  handler: async ctx => await getWorkflowRunExecutionResultHandler(ctx),
});

export const START_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/start-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: startAsyncWorkflowBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Start workflow asynchronously',
  description: 'Starts a workflow execution asynchronously without streaming results',
  tags: ['Workflows'],
  handler: async ctx => await startAsyncWorkflowHandler(ctx),
});

export const START_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/start',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: startAsyncWorkflowBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Start specific workflow run',
  description: 'Starts execution of a specific workflow run by ID',
  tags: ['Workflows'],
  handler: async ctx => await startWorkflowRunHandler(ctx),
});

export const OBSERVE_STREAM_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/observe',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  summary: 'Observe workflow stream',
  description: 'Observes and streams updates from an already running workflow execution',
  tags: ['Workflows'],
  handler: async ctx => await observeStreamWorkflowHandler(ctx),
});

export const OBSERVE_STREAM_VNEXT_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/observe-streamVNext',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  summary: 'Observe workflow stream (v2)',
  description: 'Observes and streams updates from an already running workflow execution using v2 streaming API',
  tags: ['Workflows'],
  handler: async ctx => await observeStreamVNextWorkflowHandler(ctx),
});

export const RESUME_ASYNC_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/resume-async',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Resume workflow asynchronously',
  description: 'Resumes a suspended workflow execution asynchronously without streaming',
  tags: ['Workflows'],
  handler: async ctx => await resumeAsyncWorkflowHandler(ctx as any),
});

export const RESUME_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/resume',
  responseType: 'json',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Resume workflow',
  description: 'Resumes a suspended workflow execution from a specific step',
  tags: ['Workflows'],
  handler: async ctx => await resumeWorkflowHandler(ctx as any),
});

export const CANCEL_WORKFLOW_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/runs/:runId/cancel',
  responseType: 'json',
  pathParamSchema: workflowRunPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Cancel workflow run',
  description: 'Cancels an in-progress workflow execution',
  tags: ['Workflows'],
  handler: async ctx => await cancelWorkflowRunHandler(ctx),
});

// Legacy routes (deprecated)
export const STREAM_LEGACY_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/stream-legacy',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamWorkflowBodySchema,
  summary: '[DEPRECATED] Stream workflow with legacy format',
  description: 'Legacy endpoint for streaming workflow execution. Use /api/workflows/:workflowId/stream instead.',
  tags: ['Workflows', 'Legacy'],
  handler: async ctx => await streamLegacyWorkflowHandler(ctx as any),
});

export const OBSERVE_STREAM_LEGACY_WORKFLOW_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflows/:workflowId/observe-stream-legacy',
  responseType: 'stream',
  pathParamSchema: workflowIdPathParams,
  queryParamSchema: runIdSchema,
  summary: '[DEPRECATED] Observe workflow stream with legacy format',
  description: 'Legacy endpoint for observing workflow stream. Use /api/workflows/:workflowId/observe instead.',
  tags: ['Workflows', 'Legacy'],
  handler: async ctx => await observeStreamLegacyWorkflowHandler(ctx as any),
});
