import {
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
  MCP_HTTP_TRANSPORT_ROUTE,
  MCP_SSE_TRANSPORT_ROUTE,
  MCP_SSE_MESSAGES_ROUTE,
} from '../../handlers/mcp';
import type { ServerRoute } from '.';

/**
 * MCP Routes
 *
 * Registry routes provide access to the MCP server registry and tools.
 * Transport routes handle the MCP protocol communication (HTTP and SSE).
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

  // ============================================================================
  // MCP Transport Routes (handled by adapters)
  // ============================================================================
  MCP_HTTP_TRANSPORT_ROUTE,
  MCP_SSE_TRANSPORT_ROUTE,
  MCP_SSE_MESSAGES_ROUTE,
];
