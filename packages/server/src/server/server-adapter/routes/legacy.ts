/**
 * Legacy routes that are deprecated but still exist in deployer for backward compatibility.
 * These routes should not be used in new code and will be removed in a future version.
 */

import { generateLegacyHandler, streamGenerateLegacyHandler } from '../../handlers/agents';
import { streamLegacyWorkflowHandler, observeStreamLegacyWorkflowHandler } from '../../handlers/workflows';
import {
  streamLegacyAgentBuilderActionHandler,
  observeStreamLegacyAgentBuilderActionHandler,
} from '../../handlers/agent-builder';
import {
  agentIdPathParams,
  agentExecutionBodySchema,
  generateResponseSchema,
  streamResponseSchema,
} from '../../schemas/agents';
import { workflowIdPathParams, streamWorkflowBodySchema, runIdQuerySchema } from '../../schemas/workflows';
import { actionIdPathParams } from '../../schemas/agent-builder';
import { createRoute } from './route-builder';
import type { ServerRoute, ServerRouteHandler } from '.';

export const LEGACY_ROUTES: ServerRoute[] = [
  // ============================================================================
  // Legacy Agent Routes
  // ============================================================================
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: generateLegacyHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/generate-legacy',
    pathParamSchema: agentIdPathParams,
    bodySchema: agentExecutionBodySchema,
    responseSchema: generateResponseSchema,
    summary: '[DEPRECATED] Generate with legacy format',
    description: 'Legacy endpoint for generating agent responses. Use /api/agents/:agentId/generate instead.',
    tags: ['Agents', 'Legacy'],
  }),
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: streamGenerateLegacyHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/stream-legacy',
    pathParamSchema: agentIdPathParams,
    bodySchema: agentExecutionBodySchema,
    responseSchema: streamResponseSchema,
    summary: '[DEPRECATED] Stream with legacy format',
    description: 'Legacy endpoint for streaming agent responses. Use /api/agents/:agentId/stream instead.',
    tags: ['Agents', 'Legacy'],
  }),

  // ============================================================================
  // Legacy Workflow Routes
  // ============================================================================
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: streamLegacyWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/stream-legacy',
    pathParamSchema: workflowIdPathParams,
    queryParamSchema: runIdQuerySchema,
    bodySchema: streamWorkflowBodySchema,
    summary: '[DEPRECATED] Stream workflow with legacy format',
    description:
      'Legacy endpoint for streaming workflow execution. Use /api/workflows/:workflowId/runs/:runId/observe-stream instead.',
    tags: ['Workflows', 'Legacy'],
  }),
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: observeStreamLegacyWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/observe-stream-legacy',
    pathParamSchema: workflowIdPathParams,
    queryParamSchema: runIdQuerySchema,
    bodySchema: streamWorkflowBodySchema,
    summary: '[DEPRECATED] Observe workflow stream with legacy format',
    description:
      'Legacy endpoint for observing workflow stream. Use /api/workflows/:workflowId/runs/:runId/observe-stream instead.',
    tags: ['Workflows', 'Legacy'],
  }),

  // ============================================================================
  // Legacy Agent Builder Routes
  // ============================================================================
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: streamLegacyAgentBuilderActionHandler as unknown as ServerRouteHandler,
    path: '/api/agent-builder/:actionId/stream-legacy',
    pathParamSchema: actionIdPathParams,
    queryParamSchema: runIdQuerySchema,
    bodySchema: streamWorkflowBodySchema,
    summary: '[DEPRECATED] Stream agent-builder action with legacy format',
    description:
      'Legacy endpoint for streaming agent-builder action execution. Use /api/agent-builder/actions/:actionId/runs/:runId/observe-stream instead.',
    tags: ['Agent Builder', 'Legacy'],
  }),
  createRoute({
    method: 'POST',
    responseType: 'stream',
    handler: observeStreamLegacyAgentBuilderActionHandler as unknown as ServerRouteHandler,
    path: '/api/agent-builder/:actionId/observe-stream-legacy',
    pathParamSchema: actionIdPathParams,
    queryParamSchema: runIdQuerySchema,
    bodySchema: streamWorkflowBodySchema,
    summary: '[DEPRECATED] Observe agent-builder action stream with legacy format',
    description:
      'Legacy endpoint for observing agent-builder action stream. Use /api/agent-builder/actions/:actionId/runs/:runId/observe-stream instead.',
    tags: ['Agent Builder', 'Legacy'],
  }),
];
