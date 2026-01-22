import type { MCPServerBase as MastraMCPServerImplementation, ServerInfo } from '@mastra/core/mcp';
import { HTTPException } from '../http-exception';
import {
  mcpServerDetailPathParams,
  mcpServerToolPathParams,
  executeToolBodySchema,
  listMcpServersQuerySchema,
  getMcpServerDetailQuerySchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
  mcpServerIdPathParams,
  listMcpServerToolsResponseSchema,
  mcpToolInfoSchema,
  executeToolResponseSchema,
} from '../schemas/mcp';
import type { ServerContext } from '../server-adapter';
import { createRoute } from '../server-adapter/routes/route-builder';

// ============================================================================
// Route Definitions (createRoute pattern for server adapters)
// ============================================================================

export const LIST_MCP_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers',
  responseType: 'json',
  queryParamSchema: listMcpServersQuerySchema,
  responseSchema: listMcpServersResponseSchema,
  summary: 'List MCP servers',
  description: 'Returns a list of registered MCP servers with pagination support',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    page,
    perPage,
    limit,
    offset,
  }: ServerContext & { page?: number; perPage?: number; limit?: number; offset?: number }) => {
    if (!mastra || typeof mastra.listMCPServers !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or listMCPServers method not available' });
    }

    const servers = mastra.listMCPServers();

    if (!servers) {
      return { servers: [], total_count: 0, next: null };
    }

    const serverList = Object.values(servers) as MastraMCPServerImplementation[];
    const totalCount = serverList.length;

    // Support both page/perPage and limit/offset for backwards compatibility
    // Detect which format user is using - prefer page/perPage if both provided
    const useLegacyFormat =
      (limit !== undefined || offset !== undefined) && page === undefined && perPage === undefined;

    // If perPage provided, use it; otherwise fall back to limit
    const finalPerPage = perPage ?? limit;
    // If page provided, use it; otherwise convert from offset
    let finalPage = page;
    if (finalPage === undefined && offset !== undefined && finalPerPage !== undefined && finalPerPage > 0) {
      finalPage = Math.floor(offset / finalPerPage);
    }

    // Calculate offset from page/perPage
    const actualOffset = finalPage !== undefined && finalPerPage !== undefined ? finalPage * finalPerPage : 0;

    // Apply pagination
    let paginatedServers = serverList;
    let nextUrl: string | null = null;

    if (finalPerPage !== undefined) {
      paginatedServers = serverList.slice(actualOffset, actualOffset + finalPerPage);

      // Calculate next URL if there are more results
      if (actualOffset + finalPerPage < totalCount) {
        const nextPage = (finalPage ?? 0) + 1;
        // Return next URL in same format as request (legacy limit/offset or page/perPage)
        if (useLegacyFormat) {
          const nextOffset = actualOffset + finalPerPage;
          nextUrl = `/api/mcp/v0/servers?limit=${finalPerPage}&offset=${nextOffset}`;
        } else {
          nextUrl = `/api/mcp/v0/servers?perPage=${finalPerPage}&page=${nextPage}`;
        }
      }
    }

    // Get server info for each server
    const serverInfoList: ServerInfo[] = paginatedServers.map(server => server.getServerInfo());

    return {
      servers: serverInfoList,
      total_count: totalCount,
      next: nextUrl,
    };
  },
});

export const GET_MCP_SERVER_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers/:id',
  responseType: 'json',
  pathParamSchema: mcpServerDetailPathParams,
  queryParamSchema: getMcpServerDetailQuerySchema,
  responseSchema: serverDetailSchema,
  summary: 'Get MCP server details',
  description: 'Returns detailed information about a specific MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, id, version }: ServerContext & { id: string; version?: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(id);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server with ID '${id}' not found` });
    }

    const serverDetail = server.getServerDetail();

    // If a specific version was requested, check if it matches
    if (version && serverDetail.version_detail.version !== version) {
      throw new HTTPException(404, {
        message: `MCP server with ID '${id}' found, but not version '${version}'. Available version: ${serverDetail.version_detail.version}`,
      });
    }

    return serverDetail;
  },
});

export const LIST_MCP_SERVER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools',
  responseType: 'json',
  pathParamSchema: mcpServerIdPathParams,
  responseSchema: listMcpServerToolsResponseSchema,
  summary: 'List MCP server tools',
  description: 'Returns a list of tools available on the specified MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server with ID '${serverId}' not found` });
    }

    if (typeof server.getToolListInfo !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot list tools in this way.` });
    }

    return server.getToolListInfo();
  },
});

export const GET_MCP_SERVER_TOOL_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  responseSchema: mcpToolInfoSchema,
  summary: 'Get MCP server tool details',
  description: 'Returns detailed information about a specific tool on the MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId, toolId }: ServerContext & { serverId: string; toolId: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server with ID '${serverId}' not found` });
    }

    if (typeof server.getToolInfo !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot provide tool details in this way.` });
    }

    const toolInfo = server.getToolInfo(toolId);
    if (!toolInfo) {
      throw new HTTPException(404, { message: `Tool with ID '${toolId}' not found on MCP server '${serverId}'` });
    }

    return toolInfo;
  },
});

export const EXECUTE_MCP_SERVER_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute MCP server tool',
  description: 'Executes a tool on the specified MCP server with the provided arguments',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    serverId,
    toolId,
    data,
  }: ServerContext & { serverId: string; toolId: string; data?: unknown }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server with ID '${serverId}' not found` });
    }

    if (typeof server.executeTool !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot execute tools in this way.` });
    }

    const result = await server.executeTool(toolId, data);
    return { result };
  },
});

// ============================================================================
// MCP Transport Routes (Streamable HTTP and SSE)
// ============================================================================

/**
 * MCP HTTP Transport response type.
 * Adapters use this to set up the HTTP transport via MCPServer.startHTTP()
 */
export interface MCPHttpTransportResult {
  server: MastraMCPServerImplementation;
  httpPath: string;
}

/**
 * MCP SSE Transport response type.
 * Adapters use this to set up the SSE transport via MCPServer.startSSE() or startHonoSSE()
 */
export interface MCPSseTransportResult {
  server: MastraMCPServerImplementation;
  ssePath: string;
  messagePath: string;
}

export const MCP_HTTP_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/mcp',
  responseType: 'mcp-http',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP HTTP Transport',
  description: 'Streamable HTTP transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPHttpTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server '${serverId}' not found` });
    }

    return {
      server,
      httpPath: `/api/mcp/${serverId}/mcp`,
    };
  },
});

export const MCP_SSE_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/sse',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Transport',
  description: 'SSE transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPSseTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server '${serverId}' not found` });
    }

    return {
      server,
      ssePath: `/api/mcp/${serverId}/sse`,
      messagePath: `/api/mcp/${serverId}/messages`,
    };
  },
});

export const MCP_SSE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/messages',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Messages',
  description: 'Message endpoint for SSE transport (posts messages to active SSE streams)',
  tags: ['MCP'],
  requiresAuth: true,
  handler: MCP_SSE_TRANSPORT_ROUTE.handler,
});
