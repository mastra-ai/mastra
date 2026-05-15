import type { IMastraEditor } from '@mastra/core/editor';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { UnknownIntegrationError } from '@mastra/core/tool-integration';
import type { ToolIntegration } from '@mastra/core/tool-integration';
import { MASTRA_USER_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  authorizeToolIntegrationBodySchema,
  authorizeToolIntegrationResponseSchema,
  authStatusToolIntegrationResponseSchema,
  connectionStatusToolIntegrationBodySchema,
  connectionStatusToolIntegrationResponseSchema,
  listConnectionsQuerySchema,
  listConnectionsResponseSchema,
  listToolIntegrationsResponseSchema,
  listToolIntegrationToolsQuerySchema,
  listToolIntegrationToolsResponseSchema,
  listToolServicesResponseSchema,
  toolIntegrationAuthStatusPathParams,
  toolIntegrationHealthResponseSchema,
  toolIntegrationIdPathParams,
} from '../schemas/tool-integrations';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Helpers
// ============================================================================

function requireEditor(editor: IMastraEditor | undefined): IMastraEditor {
  if (!editor) {
    throw new HTTPException(500, { message: 'Editor is not configured' });
  }
  return editor;
}

function resolveIntegration(editor: IMastraEditor, integrationId: string): ToolIntegration {
  try {
    return editor.getToolIntegrationOrThrow(integrationId);
  } catch (error) {
    if (error instanceof UnknownIntegrationError) {
      throw new HTTPException(404, { message: error.message });
    }
    throw error;
  }
}

/**
 * Resolve the connection owner (Composio `userId` bucket) from the caller's
 * `RequestContext`. Mirrors the runtime fan-out fallback to `'default'` when
 * no auth context is present so OSS deployments still work.
 */
function resolveOwnerId(requestContext: RequestContext | undefined): string {
  const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
  if (typeof resourceId === 'string' && resourceId.length > 0) {
    return resourceId;
  }

  const user = requestContext?.get(MASTRA_USER_KEY);
  if (user && typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  return 'default';
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /tool-integrations - List all registered tool integrations
 */
export const LIST_TOOL_INTEGRATIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations',
  responseType: 'json',
  responseSchema: listToolIntegrationsResponseSchema,
  summary: 'List tool integrations',
  description: 'Returns all registered tool integrations with their capabilities',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integrations = editor.getToolIntegrations();
      return {
        integrations: integrations.map(integration => ({
          id: integration.id,
          displayName: integration.displayName,
          capabilities: integration.capabilities,
        })),
      };
    } catch (error) {
      return handleError(error, 'Error listing tool integrations');
    }
  },
});

/**
 * GET /tool-integrations/:integrationId/tool-services - List tool services for an integration
 */
export const LIST_TOOL_SERVICES_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations/:integrationId/tool-services',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  responseSchema: listToolServicesResponseSchema,
  summary: 'List tool services',
  description: 'Returns the tool services exposed by a specific integration',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      return await integration.listToolServices();
    } catch (error) {
      return handleError(error, 'Error listing tool services');
    }
  },
});

/**
 * GET /tool-integrations/:integrationId/tools - List tools for an integration
 */
export const LIST_TOOL_INTEGRATION_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations/:integrationId/tools',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  queryParamSchema: listToolIntegrationToolsQuerySchema,
  responseSchema: listToolIntegrationToolsResponseSchema,
  summary: 'List tools for an integration',
  description: 'Returns the tools available from an integration, with optional filtering and pagination',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId, toolService, search, page, perPage }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      const opts: { toolService?: string; search?: string; page?: number; perPage?: number } = {};
      if (toolService !== undefined) opts.toolService = toolService;
      if (search !== undefined) opts.search = search;
      if (page !== undefined) opts.page = page;
      if (perPage !== undefined) opts.perPage = perPage;
      return await integration.listTools(Object.keys(opts).length > 0 ? opts : undefined);
    } catch (error) {
      return handleError(error, 'Error listing tool integration tools');
    }
  },
});

/**
 * POST /tool-integrations/:integrationId/authorize - Start an OAuth flow
 */
export const AUTHORIZE_TOOL_INTEGRATION_ROUTE = createRoute({
  method: 'POST',
  path: '/tool-integrations/:integrationId/authorize',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  bodySchema: authorizeToolIntegrationBodySchema,
  responseSchema: authorizeToolIntegrationResponseSchema,
  summary: 'Authorize tool integration',
  description: 'Starts an OAuth flow and returns a redirect URL + opaque auth handle',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId, toolService, connectionId, toolName, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      // Fresh connect (no `connectionId`) resolves the caller's owner id from
      // auth context so the new connected account lands in the same bucket the
      // runtime will use at execution time. Re-auth (caller passed an existing
      // `connectionId`) is left untouched so the adapter refreshes in place.
      const bucket = connectionId && connectionId.length > 0 ? connectionId : resolveOwnerId(requestContext);
      return await integration.authorize({ toolService, connectionId: bucket, toolName });
    } catch (error) {
      return handleError(error, 'Error authorizing tool integration');
    }
  },
});

/**
 * GET /tool-integrations/:integrationId/auth-status/:authId - Poll OAuth flow status
 */
export const GET_TOOL_INTEGRATION_AUTH_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations/:integrationId/auth-status/:authId',
  responseType: 'json',
  pathParamSchema: toolIntegrationAuthStatusPathParams,
  responseSchema: authStatusToolIntegrationResponseSchema,
  summary: 'Get tool integration auth status',
  description: 'Polls the OAuth flow status for an outstanding authorize call',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId, authId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      const status = await integration.getAuthStatus(authId);
      return { status };
    } catch (error) {
      return handleError(error, 'Error getting tool integration auth status');
    }
  },
});

/**
 * POST /tool-integrations/:integrationId/connection-status - Batch-check connection liveness
 */
export const TOOL_INTEGRATION_CONNECTION_STATUS_ROUTE = createRoute({
  method: 'POST',
  path: '/tool-integrations/:integrationId/connection-status',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  bodySchema: connectionStatusToolIntegrationBodySchema,
  responseSchema: connectionStatusToolIntegrationResponseSchema,
  summary: 'Get connection status for an integration',
  description: 'Batch-checks whether a set of (connectionId, toolService) tuples are still connected',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId, items }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      const result = await integration.getConnectionStatus({ items });
      return { items: result };
    } catch (error) {
      return handleError(error, 'Error getting connection status');
    }
  },
});

/**
 * GET /tool-integrations/:integrationId/connections - List existing provider connections
 * for the caller, scoped to a tool service.
 *
 * The connection owner is resolved server-side from `RequestContext`
 * (`MASTRA_RESOURCE_ID_KEY`) and falls back to `'default'` when no auth
 * context is present. Clients cannot pass a userId.
 */
export const LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations/:integrationId/connections',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  queryParamSchema: listConnectionsQuerySchema,
  responseSchema: listConnectionsResponseSchema,
  summary: 'List existing connections',
  description:
    'Returns existing provider connections for the caller on a given tool service, so the picker can offer them for pinning without re-running OAuth',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId, toolService, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      const userId = resolveOwnerId(requestContext);
      return await integration.listConnections({ toolService, userId });
    } catch (error) {
      return handleError(error, 'Error listing tool integration connections');
    }
  },
});

/**
 * GET /tool-integrations/:integrationId/health - Integration-level health check
 */
export const GET_TOOL_INTEGRATION_HEALTH_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-integrations/:integrationId/health',
  responseType: 'json',
  pathParamSchema: toolIntegrationIdPathParams,
  responseSchema: toolIntegrationHealthResponseSchema,
  summary: 'Get tool integration health',
  description: 'Returns integration-level health (config, reachability, etc.)',
  tags: ['Tool Integrations'],
  requiresAuth: true,
  handler: async ({ mastra, integrationId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const integration = resolveIntegration(editor, integrationId);
      return await integration.getHealth();
    } catch (error) {
      return handleError(error, 'Error getting tool integration health');
    }
  },
});
