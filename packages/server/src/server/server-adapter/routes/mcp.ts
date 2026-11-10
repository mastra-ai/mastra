import {
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
  LIST_MCP_SERVER_RESOURCES_ROUTE,
  READ_MCP_SERVER_RESOURCE_ROUTE,
  LIST_MCP_SERVER_EVENTS_ROUTE,
  POLL_MCP_SERVER_EVENT_ROUTE,
  STREAM_MCP_SERVER_EVENT_ROUTE,
  EMIT_MCP_SERVER_EVENT_ROUTE,
  LIST_MCP_SERVER_TASKS_ROUTE,
  FIND_MCP_SERVER_TASK_ROUTE,
  CANCEL_MCP_SERVER_TASK_ROUTE,
  ANSWER_MCP_SERVER_TASK_ROUTE,
  MCP_HTTP_TRANSPORT_ROUTE,
  MCP_SSE_TRANSPORT_ROUTE,
  MCP_SSE_MESSAGES_ROUTE,
} from '../../handlers/mcp';

/**
 * MCP Routes
 *
 * Registry routes provide access to the MCP server registry and tools.
 * Transport routes handle the MCP protocol communication (HTTP and SSE).
 */
export const MCP_ROUTES = [
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
  // MCP Server Resource Routes
  // ============================================================================
  LIST_MCP_SERVER_RESOURCES_ROUTE,
  READ_MCP_SERVER_RESOURCE_ROUTE,

  // ============================================================================
  // MCP Server Event Routes (experimental; emit is served only under `mastra dev`)
  // ============================================================================
  LIST_MCP_SERVER_EVENTS_ROUTE,
  POLL_MCP_SERVER_EVENT_ROUTE,
  STREAM_MCP_SERVER_EVENT_ROUTE,
  EMIT_MCP_SERVER_EVENT_ROUTE,

  // ============================================================================
  // MCP Server Task Routes (experimental; Studio admin view, unscoped callers only)
  // ============================================================================
  LIST_MCP_SERVER_TASKS_ROUTE,
  FIND_MCP_SERVER_TASK_ROUTE,
  CANCEL_MCP_SERVER_TASK_ROUTE,
  ANSWER_MCP_SERVER_TASK_ROUTE,

  // ============================================================================
  // MCP Transport Routes (handled by adapters)
  // ============================================================================
  MCP_HTTP_TRANSPORT_ROUTE,
  MCP_SSE_TRANSPORT_ROUTE,
  MCP_SSE_MESSAGES_ROUTE,
] as const;
