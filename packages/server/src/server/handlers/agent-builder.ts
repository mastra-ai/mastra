import { agentBuilderWorkflows } from '@mastra/agent-builder';
import type { WorkflowInfo } from '@mastra/core/workflows';
import type { z } from 'zod';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import { handleError } from './error';
import * as workflows from './workflows';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { ServerRoute } from '../server-adapter/routes';
import {
  actionIdPathParams,
  actionRunPathParams,
  createWorkflowRunResponseSchema,
  listWorkflowRunsQuerySchema,
  resumeAgentBuilderBodySchema,
  streamAgentBuilderBodySchema,
  startAsyncAgentBuilderBodySchema,
  workflowExecutionResultSchema,
  workflowControlResponseSchema,
  workflowRunResponseSchema,
  workflowRunsResponseSchema,
  workflowInfoSchema,
  listWorkflowsResponseSchema,
  streamLegacyAgentBuilderBodySchema,
} from '../schemas/agent-builder';
import { optionalRunIdSchema, runIdSchema } from '../schemas/common';

interface AgentBuilderContext extends Context {
  actionId?: string;
}

/**
 * Generic wrapper that converts agent-builder handlers to use workflow handlers
 * TWorkflowArgs - The argument type expected by the workflow handler
 * TResult - The return type of the workflow handler
 */
function createAgentBuilderWorkflowHandler<TWorkflowArgs, TResult>(
  workflowHandlerFn: (args: TWorkflowArgs) => Promise<TResult>,
  logMessage: string,
  handlerName?: string,
) {
  const handler = async (builderArgs: TWorkflowArgs & AgentBuilderContext): Promise<TResult> => {
    const { actionId, ...actionArgs } = builderArgs;
    const mastra = (actionArgs as any).mastra;
    const logger = mastra.getLogger();

    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      // Validate actionId if it's provided
      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, {
          message: `Invalid agent-builder action: ${actionId}. Valid actions are: ${Object.keys(agentBuilderWorkflows).join(', ')}`,
        });
      }

      logger.info(logMessage, { actionId, ...actionArgs });

      try {
        const handlerArgs = {
          ...actionArgs,
          workflowId: actionId, // Map actionId to workflowId
        } as TWorkflowArgs;

        const result = await workflowHandlerFn(handlerArgs);
        return result;
      } finally {
        WorkflowRegistry.cleanup();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`${logMessage} failed`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };

  // Set the function name if provided
  if (handlerName) {
    Object.defineProperty(handler, 'name', { value: handlerName, writable: false });
  }

  return handler;
}

// ============================================================================
// Route Definitions (handlers inlined with createRoute using wrapper pattern)
// ============================================================================

export const LIST_AGENT_BUILDER_ACTIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder',
  responseType: 'json',
  responseSchema: listWorkflowsResponseSchema,
  summary: 'List agent-builder actions',
  description: 'Returns a list of all available agent-builder actions',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(async () => {
      try {
        const registryWorkflows = WorkflowRegistry.getAllWorkflows();
        const _workflows = Object.entries(registryWorkflows).reduce<Record<string, WorkflowInfo>>(
          (acc, [key, workflow]) => {
            acc[key] = getWorkflowInfo(workflow);
            return acc;
          },
          {},
        );
        return _workflows as any;
      } catch (error) {
        return handleError(error, 'Error getting agent builder workflows');
      }
    }, 'Getting agent builder actions')(ctx),
});

export const GET_AGENT_BUILDER_ACTION_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder/:actionId',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  responseSchema: workflowInfoSchema,
  summary: 'Get action by ID',
  description: 'Returns details for a specific agent-builder action',
  tags: ['Agent Builder'],
  handler: async ctx =>
    (await createAgentBuilderWorkflowHandler(
      workflows.getWorkflowByIdHandler,
      'Getting agent builder action by ID',
    )(ctx)) as any,
});

export const LIST_AGENT_BUILDER_ACTION_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder/:actionId/runs',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: listWorkflowRunsQuerySchema,
  responseSchema: workflowRunsResponseSchema,
  summary: 'List action runs',
  description: 'Returns a paginated list of execution runs for the specified action',
  tags: ['Agent Builder'],
  handler: async ctx =>
    (await createAgentBuilderWorkflowHandler(
      workflows.listWorkflowRunsHandler,
      'Getting agent builder action runs',
    )(ctx)) as any,
});

export const GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder/:actionId/runs/:runId',
  responseType: 'json',
  pathParamSchema: actionRunPathParams,
  responseSchema: workflowRunResponseSchema,
  summary: 'Get action run by ID',
  description: 'Returns details for a specific action run',
  tags: ['Agent Builder'],
  handler: async ctx =>
    (await createAgentBuilderWorkflowHandler(
      workflows.getWorkflowRunByIdHandler,
      'Getting agent builder action run by ID',
    )(ctx)) as any,
});

export const GET_AGENT_BUILDER_ACTION_RUN_EXECUTION_RESULT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder/:actionId/runs/:runId/execution-result',
  responseType: 'json',
  pathParamSchema: actionRunPathParams,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Get action execution result',
  description: 'Returns the final execution result of a completed action run',
  tags: ['Agent Builder'],
  handler: async ctx =>
    (await createAgentBuilderWorkflowHandler(
      workflows.getWorkflowRunExecutionResultHandler,
      'Getting agent builder action run execution result',
    )(ctx)) as any,
});

export const CREATE_AGENT_BUILDER_ACTION_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/create-run',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  responseSchema: createWorkflowRunResponseSchema,
  summary: 'Create action run',
  description: 'Creates a new action execution instance with an optional custom run ID',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.createWorkflowRunHandler,
      'Creating agent builder action run',
    )(ctx),
});

export const STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/stream',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamLegacyAgentBuilderBodySchema,
  summary: 'Stream action execution',
  description: 'Executes an action and streams the results in real-time',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(workflows.streamWorkflowHandler, 'Streaming agent builder action')(ctx),
});

export const STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/streamVNext',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamAgentBuilderBodySchema,
  summary: 'Stream action execution (v2)',
  description: 'Executes an action using the v2 streaming API and streams the results in real-time',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.streamVNextWorkflowHandler,
      'Streaming agent builder action (v2)',
    )(ctx),
});

export const START_ASYNC_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/start-async',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: startAsyncAgentBuilderBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Start action asynchronously',
  description: 'Starts an action execution asynchronously without streaming results',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.startAsyncWorkflowHandler,
      'Starting agent builder action asynchronously',
    )(ctx),
});

export const START_AGENT_BUILDER_ACTION_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/start',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: startAsyncAgentBuilderBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Start specific action run',
  description: 'Starts execution of a specific action run by ID',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.startWorkflowRunHandler,
      'Starting specific agent builder action run',
    )(ctx),
});

export const OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  summary: 'Observe action stream',
  description: 'Observes and streams updates from an already running action execution',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.observeStreamWorkflowHandler,
      'Observing agent builder action stream',
    )(ctx),
});

export const OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe-streamVNext',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  summary: 'Observe action stream (v2)',
  description: 'Observes and streams updates from an already running action execution using v2 streaming API',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.observeStreamVNextWorkflowHandler,
      'Observing agent builder action stream (v2)',
    )(ctx),
});

export const RESUME_ASYNC_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/resume-async',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeAgentBuilderBodySchema,
  responseSchema: workflowExecutionResultSchema,
  summary: 'Resume action asynchronously',
  description: 'Resumes a suspended action execution asynchronously without streaming',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.resumeAsyncWorkflowHandler,
      'Resuming agent builder action asynchronously',
    )(ctx as any),
});

export const RESUME_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/resume',
  responseType: 'json',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeAgentBuilderBodySchema,
  responseSchema: workflowControlResponseSchema,
  summary: 'Resume action',
  description: 'Resumes a suspended action execution from a specific step',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.resumeWorkflowHandler,
      'Resuming agent builder action',
    )(ctx as any),
});

export const RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/resume-stream',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeAgentBuilderBodySchema,
  summary: 'Resume action stream',
  description: 'Resumes a suspended action execution and continues streaming results',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.resumeStreamWorkflowHandler,
      'Resuming agent builder action stream',
    )(ctx as any),
});

export const CANCEL_AGENT_BUILDER_ACTION_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/runs/:runId/cancel',
  responseType: 'json',
  pathParamSchema: actionRunPathParams,
  responseSchema: workflowControlResponseSchema,
  summary: 'Cancel action run',
  description: 'Cancels an in-progress action execution',
  tags: ['Agent Builder'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.cancelWorkflowRunHandler,
      'Cancelling agent builder action run',
    )(ctx),
});

// Legacy routes (deprecated)
export const STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/stream-legacy',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamLegacyAgentBuilderBodySchema,
  summary: '[DEPRECATED] Stream agent-builder action with legacy format',
  description:
    'Legacy endpoint for streaming agent-builder action execution. Use /api/agent-builder/:actionId/stream instead.',
  tags: ['Agent Builder', 'Legacy'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.streamLegacyWorkflowHandler,
      'Streaming agent builder action (legacy)',
    )(ctx as any),
});

export const OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe-stream-legacy',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  summary: '[DEPRECATED] Observe agent-builder action stream with legacy format',
  description:
    'Legacy endpoint for observing agent-builder action stream. Use /api/agent-builder/:actionId/observe instead.',
  tags: ['Agent Builder', 'Legacy'],
  handler: async ctx =>
    await createAgentBuilderWorkflowHandler(
      workflows.observeStreamLegacyWorkflowHandler,
      'Observing agent builder action stream (legacy)',
    )(ctx as any),
});
