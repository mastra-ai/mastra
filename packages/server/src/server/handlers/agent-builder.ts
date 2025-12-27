import { agentBuilderWorkflows } from '@mastra/agent-builder';
import { HTTPException } from '../http-exception';
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
  workflowRunsResponseSchema,
  workflowInfoSchema,
  listWorkflowsResponseSchema,
  streamLegacyAgentBuilderBodySchema,
  workflowRunResultSchema,
  workflowRunResultQuerySchema,
} from '../schemas/agent-builder';
import { streamResponseSchema } from '../schemas/agents';
import { optionalRunIdSchema, runIdSchema } from '../schemas/common';
import { createRoute } from '../server-adapter/routes/route-builder';
import { WorkflowRegistry } from '../utils';
import { handleError } from './error';
import * as workflows from './workflows';

// ============================================================================
// Route Definitions (handlers call workflow route handlers with transformed parameters)
// ============================================================================

export const LIST_AGENT_BUILDER_ACTIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder',
  responseType: 'json',
  responseSchema: listWorkflowsResponseSchema,
  summary: 'List agent-builder actions',
  description: 'Returns a list of all available agent-builder actions',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);
      logger.info('Listing agent builder actions');

      // Call workflow list handler
      return await workflows.LIST_WORKFLOWS_ROUTE.handler(ctx);
    } catch (error) {
      logger.error('Error listing agent builder actions', { error });
      return handleError(error, 'Error getting agent builder workflows');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, {
          message: `Invalid agent-builder action: ${actionId}. Valid actions are: ${Object.keys(agentBuilderWorkflows).join(', ')}`,
        });
      }

      logger.info('Getting agent builder action by ID', { actionId });

      return await workflows.GET_WORKFLOW_BY_ID_ROUTE.handler({ ...ctx, workflowId: actionId });
    } catch (error) {
      logger.error('Error getting agent builder action by ID', { error, actionId });
      return handleError(error, 'Error getting agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Listing agent builder action runs', { actionId });

      return await workflows.LIST_WORKFLOW_RUNS_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error listing agent builder action runs', { error, actionId });
      return handleError(error, 'Error getting agent builder action runs');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const GET_AGENT_BUILDER_ACTION_RUN_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agent-builder/:actionId/runs/:runId',
  responseType: 'json',
  pathParamSchema: actionRunPathParams,
  queryParamSchema: workflowRunResultQuerySchema,
  responseSchema: workflowRunResultSchema,
  summary: 'Get action run by ID',
  description:
    'Returns details for a specific action run with metadata and processed execution state. Use the fields query parameter to reduce payload size.',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Getting agent builder action run by ID', { actionId, runId });

      return await workflows.GET_WORKFLOW_RUN_BY_ID_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error getting agent builder action run', { error, actionId, runId });
      return handleError(error, 'Error getting agent builder action run');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Getting agent builder action run execution result', { actionId, runId });

      return await workflows.GET_WORKFLOW_RUN_EXECUTION_RESULT_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error getting execution result', { error, actionId, runId });
      return handleError(error, 'Error getting agent builder action execution result');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Creating agent builder action run', { actionId, runId });

      return await workflows.CREATE_WORKFLOW_RUN_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error creating agent builder action run', { error, actionId });
      return handleError(error, 'Error creating agent builder action run');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/stream',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamAgentBuilderBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream action execution',
  description: 'Executes an action and streams the results in real-time',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Streaming agent builder action', { actionId, runId });

      return await workflows.STREAM_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error streaming agent builder action', { error, actionId });
      return handleError(error, 'Error streaming agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/streamVNext',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamAgentBuilderBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream action execution (v2)',
  description: 'Executes an action using the v2 streaming API and streams the results in real-time',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Streaming agent builder action (v2)', { actionId, runId });

      return await workflows.STREAM_VNEXT_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error streaming agent builder action (v2)', { error, actionId });
      return handleError(error, 'Error streaming agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Starting agent builder action asynchronously', { actionId, runId });

      return await workflows.START_ASYNC_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error starting agent builder action asynchronously', { error, actionId });
      return handleError(error, 'Error starting agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Starting specific agent builder action run', { actionId, runId });

      return await workflows.START_WORKFLOW_RUN_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error starting agent builder action run', { error, actionId });
      return handleError(error, 'Error starting agent builder action run');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const OBSERVE_STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  responseSchema: streamResponseSchema,
  summary: 'Observe action stream',
  description: 'Observes and streams updates from an already running action execution',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Observing agent builder action stream', { actionId, runId });

      return await workflows.OBSERVE_STREAM_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error observing agent builder action stream', { error, actionId });
      return handleError(error, 'Error observing agent builder action stream');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const OBSERVE_STREAM_VNEXT_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe-streamVNext',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  responseSchema: streamResponseSchema,
  summary: 'Observe action stream (v2)',
  description: 'Observes and streams updates from an already running action execution using v2 streaming API',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Observing agent builder action stream (v2)', { actionId, runId });

      return await workflows.OBSERVE_STREAM_VNEXT_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error observing agent builder action stream (v2)', { error, actionId });
      return handleError(error, 'Error observing agent builder action stream');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId, step, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Resuming agent builder action asynchronously', { actionId, runId, step });

      return await workflows.RESUME_ASYNC_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error resuming agent builder action asynchronously', { error, actionId });
      return handleError(error, 'Error resuming agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId, step, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Resuming agent builder action', { actionId, runId, step });

      return await workflows.RESUME_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error resuming agent builder action', { error, actionId });
      return handleError(error, 'Error resuming agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const RESUME_STREAM_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/resume-stream',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: resumeAgentBuilderBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Resume action stream',
  description: 'Resumes a suspended action execution and continues streaming results',
  tags: ['Agent Builder'],
  handler: async ctx => {
    const { mastra, actionId, runId, step, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Resuming agent builder action stream', { actionId, runId, step });

      return await workflows.RESUME_STREAM_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error resuming agent builder action stream', { error, actionId });
      return handleError(error, 'Error resuming agent builder action stream');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
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
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Cancelling agent builder action run', { actionId, runId });

      return await workflows.CANCEL_WORKFLOW_RUN_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error cancelling agent builder action run', { error, actionId });
      return handleError(error, 'Error cancelling agent builder action run');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

// Legacy routes (deprecated)
export const STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/stream-legacy',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  bodySchema: streamLegacyAgentBuilderBodySchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Stream agent-builder action with legacy format',
  description:
    'Legacy endpoint for streaming agent-builder action execution. Use /api/agent-builder/:actionId/stream instead.',
  tags: ['Agent Builder', 'Legacy'],
  handler: async ctx => {
    const { mastra, actionId, runId, requestContext } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Streaming agent builder action (legacy)', { actionId, runId });

      return await workflows.STREAM_LEGACY_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
        requestContext,
      });
    } catch (error) {
      logger.error('Error streaming agent builder action (legacy)', { error, actionId });
      return handleError(error, 'Error streaming agent builder action');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});

export const OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agent-builder/:actionId/observe-stream-legacy',
  responseType: 'stream',
  pathParamSchema: actionIdPathParams,
  queryParamSchema: runIdSchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Observe agent-builder action stream with legacy format',
  description:
    'Legacy endpoint for observing agent-builder action stream. Use /api/agent-builder/:actionId/observe instead.',
  tags: ['Agent Builder', 'Legacy'],
  handler: async ctx => {
    const { mastra, actionId, runId } = ctx;
    const logger = mastra.getLogger();
    try {
      WorkflowRegistry.registerTemporaryWorkflows(agentBuilderWorkflows, mastra);

      if (actionId && !WorkflowRegistry.isAgentBuilderWorkflow(actionId)) {
        throw new HTTPException(400, { message: `Invalid agent-builder action: ${actionId}` });
      }

      logger.info('Observing agent builder action stream (legacy)', { actionId, runId });

      return await workflows.OBSERVE_STREAM_LEGACY_WORKFLOW_ROUTE.handler({
        ...ctx,
        workflowId: actionId,
      });
    } catch (error) {
      logger.error('Error observing agent builder action stream (legacy)', { error, actionId });
      return handleError(error, 'Error observing agent builder action stream');
    } finally {
      WorkflowRegistry.cleanup();
    }
  },
});
