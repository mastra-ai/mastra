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
} from '../../handlers/integrations';
import type { ServerRoute } from '.';

/**
 * Routes for dynamic tool integration management.
 * These routes provide API access to configure external tool providers (Composio, Arcade.dev)
 * and manage cached tool definitions from those providers.
 */
export const INTEGRATIONS_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // Integration CRUD Routes
  // ============================================================================
  LIST_INTEGRATIONS_ROUTE,
  GET_INTEGRATION_ROUTE,
  CREATE_INTEGRATION_ROUTE,
  UPDATE_INTEGRATION_ROUTE,
  DELETE_INTEGRATION_ROUTE,

  // ============================================================================
  // Provider Discovery & Proxy Routes
  // ============================================================================
  GET_PROVIDERS_ROUTE,
  LIST_PROVIDER_TOOLKITS_ROUTE,
  LIST_PROVIDER_TOOLS_ROUTE,

  // ============================================================================
  // Tool Refresh Routes
  // ============================================================================
  REFRESH_INTEGRATION_TOOLS_ROUTE,
];
