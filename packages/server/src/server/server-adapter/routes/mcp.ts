import {
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
} from '../../handlers/mcp';
import type { ServerRoute } from '.';

/**
 * MCP Registry Routes
 *
 * These routes provide access to the MCP server registry and tools.
 * Transport routes (HTTP/SSE) are handled separately in adapter-specific handlers.
 *
 * Note: Not yet added to SERVER_ROUTES - will be added after testing Phase 1.
 */
export const MCP_ROUTES: ServerRoute<any, any, any>[] = [
  // ============================================================================
  // MCP Server Registry Routes
  // ============================================================================
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,

  // ============================================================================
  // MCP Server Tool Routes
  // ============================================================================
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
];
