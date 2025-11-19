import type { Mastra } from '@mastra/core/mastra';
import type { MCPServerBase as MastraMCPServerImplementation, ServerInfo } from '@mastra/core/mcp';
import type { RuntimeContext, ServerRoute } from '@mastra/server/server-adapter';
import { createRoute } from '@mastra/server/server-adapter';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  mcpServerIdPathParams,
  mcpServerDetailPathParams,
  mcpServerToolPathParams,
  executeToolBodySchema,
  listMcpServersQuerySchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
} from '../schemas/mcp';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

// ============================================================================
// Standalone Handlers (for direct Hono Context usage)
// ============================================================================

/**
 * Handler for Streamable HTTP requests (POST, GET, DELETE) to /api/mcp/:serverId/mcp
 */
export const getMcpServerMessageHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const { req, res } = toReqRes(c.req.raw);
  const server = mastra.getMCPServerById(serverId);

  if (!server) {
    // Use Node.js res to send response since we are not returning a Hono response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `MCP server '${serverId}' not found` }));
    return await toFetchResponse(res);
  }

  try {
    // Let the MCPServer instance handle the request and transport management
    await server.startHTTP({
      url: new URL(c.req.url),
      httpPath: `/api/mcp/${serverId}/mcp`,
      req,
      res,
    });
    return await toFetchResponse(res);
  } catch (error: any) {
    // If headers haven't been sent, send an error response
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null, // Cannot determine original request ID in catch
        }),
      );
      return await toFetchResponse(res);
    } else {
      // If headers were already sent (e.g., during SSE stream), just log the error
      c.get('logger')?.error('Error after headers sent:', error);
      return await toFetchResponse(res);
    }
  }
};

/**
 * Handler for SSE related routes for an MCP server.
 * This function will be called for both establishing the SSE connection (GET)
 * and for posting messages to it (POST).
 */
export const getMcpServerSseHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const server = mastra.getMCPServerById(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }

  const requestUrl = new URL(c.req.url);

  // Define the paths that MCPServer's startSSE method will compare against.
  const sseConnectionPath = `/api/mcp/${serverId}/sse`;
  const sseMessagePath = `/api/mcp/${serverId}/messages`;

  try {
    return await server.startHonoSSE({
      url: requestUrl,
      ssePath: sseConnectionPath,
      messagePath: sseMessagePath,
      context: c,
    });
  } catch (error: any) {
    c.get('logger')?.error({ err: error, serverId, path: requestUrl.pathname }, 'Error in MCP SSE route handler');
    return c.json({ error: 'Error handling MCP SSE request' }, 500);
  }
};

/**
 * Handler for listing MCP registry servers with pagination
 */
export async function listMcpRegistryServersHandler(c: Context): Promise<Response> {
  const mastra = c.get('mastra');

  if (!mastra || typeof mastra.listMCPServers !== 'function') {
    return c.json({ error: 'Mastra instance or listMCPServers method not available' }, 500);
  }

  const servers = mastra.listMCPServers();

  if (!servers) {
    return c.json({ servers: [], total_count: 0, next: null }, 200);
  }

  const serverList = Object.values(servers) as MastraMCPServerImplementation[];
  const totalCount = serverList.length;

  // Get pagination params
  const limitStr = c.req.query('limit');
  const offsetStr = c.req.query('offset');

  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

  // Apply pagination
  let paginatedServers = serverList;
  let nextUrl: string | null = null;

  if (limit !== undefined) {
    paginatedServers = serverList.slice(offset, offset + limit);

    // Calculate next URL if there are more results
    if (offset + limit < totalCount) {
      const url = new URL(c.req.url);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset + limit));
      nextUrl = url.toString();
    }
  }

  // Get server info for each server
  const serverInfoList: ServerInfo[] = paginatedServers.map(server => server.getServerInfo());

  return c.json(
    {
      servers: serverInfoList,
      total_count: totalCount,
      next: nextUrl,
    },
    200,
  );
}

/**
 * Handler for getting MCP server details
 */
export async function getMcpRegistryServerDetailHandler(c: Context): Promise<Response> {
  const serverId = c.req.param('id');
  const mastra = c.get('mastra');

  if (!mastra || typeof mastra.getMCPServerById !== 'function') {
    return c.json({ error: 'Mastra instance or getMCPServerById method not available' }, 500);
  }

  const server = mastra.getMCPServerById(serverId);

  if (!server) {
    return c.json({ error: `MCP server with ID '${serverId}' not found` }, 404);
  }

  const serverDetail = server.getServerDetail();
  return c.json(serverDetail, 200);
}

// ============================================================================
// Route Definitions (createRoute pattern for server adapters)
// ============================================================================

export const LIST_MCP_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/mcp/v0/servers',
  responseType: 'json',
  queryParamSchema: listMcpServersQuerySchema,
  responseSchema: listMcpServersResponseSchema,
  summary: 'List MCP servers',
  description: 'Returns a list of registered MCP servers with pagination support',
  tags: ['MCP'],
  handler: async ({ mastra, limit, offset }: RuntimeContext & { limit?: number; offset?: number }) => {
    if (!mastra || typeof mastra.listMCPServers !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or listMCPServers method not available' });
    }

    const servers = mastra.listMCPServers();

    if (!servers) {
      return { servers: [], total_count: 0, next: null };
    }

    const serverList = Object.values(servers) as MastraMCPServerImplementation[];
    const totalCount = serverList.length;

    const actualOffset = offset ?? 0;

    // Apply pagination
    let paginatedServers = serverList;
    let nextUrl: string | null = null;

    if (limit !== undefined) {
      paginatedServers = serverList.slice(actualOffset, actualOffset + limit);

      // Calculate next URL if there are more results
      if (actualOffset + limit < totalCount) {
        // Note: Full URL construction would need request context
        nextUrl = `/api/mcp/v0/servers?limit=${limit}&offset=${actualOffset + limit}`;
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
  path: '/api/mcp/v0/servers/:id',
  responseType: 'json',
  pathParamSchema: mcpServerDetailPathParams,
  responseSchema: serverDetailSchema,
  summary: 'Get MCP server details',
  description: 'Returns detailed information about a specific MCP server',
  tags: ['MCP'],
  handler: async ({ mastra, id }: RuntimeContext & { id: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const server = mastra.getMCPServerById(id);

    if (!server) {
      throw new HTTPException(404, { message: `MCP server with ID '${id}' not found` });
    }

    return server.getServerDetail();
  },
});

export const LIST_MCP_SERVER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/mcp/:serverId/tools',
  responseType: 'json',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'List MCP server tools',
  description: 'Returns a list of tools available on the specified MCP server',
  tags: ['MCP'],
  handler: async ({ mastra, serverId }: RuntimeContext & { serverId: string }) => {
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
  path: '/api/mcp/:serverId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  summary: 'Get MCP server tool details',
  description: 'Returns detailed information about a specific tool on the MCP server',
  tags: ['MCP'],
  handler: async ({ mastra, serverId, toolId }: RuntimeContext & { serverId: string; toolId: string }) => {
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
  path: '/api/mcp/:serverId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  bodySchema: executeToolBodySchema,
  summary: 'Execute MCP server tool',
  description: 'Executes a tool on the specified MCP server with the provided arguments',
  tags: ['MCP'],
  handler: async ({
    mastra,
    serverId,
    toolId,
    data,
  }: RuntimeContext & { serverId: string; toolId: string; data?: unknown }) => {
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

export const MCP_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
  // Note: getMcpServerMessageHandler and getMcpServerSseHandler are not included here
  // because they require direct access to raw Hono context.
];
