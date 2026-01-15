import {
  LIST_INTEGRATIONS_ROUTE,
  GET_INTEGRATION_ROUTE,
  CREATE_INTEGRATION_ROUTE,
  UPDATE_INTEGRATION_ROUTE,
  DELETE_INTEGRATION_ROUTE,
  GET_PROVIDERS_ROUTE,
  LIST_PROVIDER_TOOLKITS_ROUTE,
  LIST_PROVIDER_TOOLS_ROUTE,
  REFRESH_INTEGRATION_TOOLS_ROUTE,
  VALIDATE_MCP_ROUTE,
  DELETE_CACHED_TOOL_ROUTE,
} from '../../handlers/integrations';
import type { ServerRoute } from '.';

/**
 * Routes for dynamic tool integration management.
 * These routes provide API access to configure external tool providers (Composio, Arcade.dev, MCP)
 * and manage cached tool definitions from those providers.
 */
export const INTEGRATIONS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Provider Discovery & Proxy Routes
  // IMPORTANT: These must come BEFORE parameterized routes like /:integrationId
  // to prevent "providers" from being matched as an integrationId
  // ============================================================================
  GET_PROVIDERS_ROUTE,
  VALIDATE_MCP_ROUTE, // MCP validation route (before :provider routes)
  LIST_PROVIDER_TOOLKITS_ROUTE,
  LIST_PROVIDER_TOOLS_ROUTE,

  // ============================================================================
  // Integration CRUD Routes
  // ============================================================================
  LIST_INTEGRATIONS_ROUTE,
  GET_INTEGRATION_ROUTE,
  CREATE_INTEGRATION_ROUTE,
  UPDATE_INTEGRATION_ROUTE,
  DELETE_INTEGRATION_ROUTE,

  // ============================================================================
  // Tool Management Routes
  // ============================================================================
  REFRESH_INTEGRATION_TOOLS_ROUTE,
  DELETE_CACHED_TOOL_ROUTE,
];
