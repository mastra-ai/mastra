import type { MCPServerBase as MastraMCPServerImplementation, ServerInfo } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { HTTPException } from '../http-exception';
import {
  mcpServerDetailPathParams,
  listMcpServersQuerySchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
} from '../schemas/mcp';
import type { RuntimeContext } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';

// ============================================================================
// Standalone Handlers (for direct Hono Context usage)
// ============================================================================

/**
 * Handler for MCP server HTTP protocol messages
 * Works with raw Hono Context and Node.js req/res
 */
export async function getMcpServerMessageHandler(c: Context): Promise<Response> {
  const serverId = c.req.param('serverId');
  const mastra = c.get('mastra');
  const requestUrl = c.req.url;

  const server = mastra.getMCPServerById(serverId);

  const { req, res } = toReqRes(c.req.raw);

  if (!server) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `MCP server '${serverId}' not found` }));
    return await toFetchResponse(res);
  }

  try {
    await server.startHTTP({
      url: new URL(requestUrl),
      httpPath: `/api/mcp/${serverId}/mcp`,
      req,
      res,
    });

    return await toFetchResponse(res);
  } catch {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        }),
      );
    }
    return await toFetchResponse(res);
  }
}

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

// Note: The MCP message handler uses raw Node.js req/res and doesn't fit
// the standard createRoute pattern. It should be registered directly with
// the server adapter's router.
