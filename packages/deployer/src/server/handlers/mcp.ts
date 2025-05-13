import type { Mastra } from '@mastra/core';
import type { MCPServerBase, ServerInfo, ServerDetailInfo } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { handleError } from './error';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra') as Mastra;

/**
 * Handler for POST /api/mcp/:serverId/mcp
 */
export const getMcpServerMessageHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const { req, res } = toReqRes(c.req.raw);
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }

  try {
    await server.startHTTP({
      url: new URL(c.req.url),
      httpPath: `/api/mcp/${serverId}/mcp`,
      req,
      res,
      options: {
        sessionIdGenerator: undefined,
      },
    });

    const toFetchRes = await toFetchResponse(res);
    return toFetchRes;
  } catch (error: any) {
    return handleError(error, 'Error sending MCP message');
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
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }

  const requestUrl = new URL(c.req.url);

  // Define the paths that MCPServer's startSSE method will compare against.
  // These paths correspond to the routes we will define in server/index.ts.
  const sseConnectionPath = `/api/mcp/${serverId}/sse`;
  const sseMessagePath = `/api/mcp/${serverId}/messages`;

  try {
    // MCPServer.startSSE will use requestUrl.pathname to differentiate
    // between an SSE connection request and a message posting request.
    return await server.startHonoSSE({
      url: requestUrl,
      ssePath: sseConnectionPath,
      messagePath: sseMessagePath,
      context: c,
    });
  } catch (error: any) {
    c.get('logger')?.error({ err: error, serverId, path: requestUrl.pathname }, 'Error in MCP SSE route handler');
    return handleError(error, 'Error handling MCP SSE request');
  }
};

/**
 * Handler for GET /api/mcp/v0/servers - List MCP Servers (Registry Style)
 */
export const listMcpRegistryServersHandler = async (c: Context) => {
  const mastra = getMastra(c);
  if (!mastra || typeof mastra.getMCPServers !== 'function') {
    c.get('logger')?.error('Mastra instance or getMCPServers method not available in listMcpRegistryServersHandler');
    return c.json({ error: 'Mastra instance or getMCPServers method not available' }, 500);
  }

  const mcpServersMap = mastra.getMCPServers();
  if (!mcpServersMap) {
    c.get('logger')?.warn('getMCPServers returned undefined or null in listMcpRegistryServersHandler');
    return c.json({ servers: [], next: null, total_count: 0 });
  }

  const allServersArray: MCPServerBase[] = Array.from(
    mcpServersMap instanceof Map ? mcpServersMap.values() : Object.values(mcpServersMap),
  );

  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const paginatedServers = allServersArray.slice(offset, offset + limit);
  const serverInfos: ServerInfo[] = paginatedServers.map(server => server.getServerInfo());

  const total_count = allServersArray.length;
  let next: string | null = null;
  if (offset + limit < total_count) {
    const nextOffset = offset + limit;
    const currentUrl = new URL(c.req.url);
    currentUrl.searchParams.set('offset', nextOffset.toString());
    currentUrl.searchParams.set('limit', limit.toString());
    next = currentUrl.toString();
  }

  return c.json({
    servers: serverInfos,
    next,
    total_count,
  });
};

/**
 * Handler for GET /api/mcp/v0/servers/:id - Get MCP Server Details (Registry Style)
 */
export const getMcpRegistryServerDetailHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('id');
  const requestedVersion = c.req.query('version'); // Get the requested version from query

  if (!mastra || typeof mastra.getMCPServer !== 'function') {
    c.get('logger')?.error('Mastra instance or getMCPServer method not available in getMcpRegistryServerDetailHandler');
    return c.json({ error: 'Mastra instance or getMCPServer method not available' }, 500);
  }

  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server with ID '${serverId}' not found` }, 404);
  }

  const serverDetailInfo: ServerDetailInfo = server.getServerDetail();

  // If a specific version was requested, check if it matches the server's actual version
  if (requestedVersion && serverDetailInfo.version_detail.version !== requestedVersion) {
    c
      .get('logger')
      ?.info(
        `MCP server with ID '${serverId}' found, but version '${serverDetailInfo.version_detail.version}' does not match requested version '${requestedVersion}'.`,
      );
    return c.json(
      {
        error: `MCP server with ID '${serverId}' found, but not version '${requestedVersion}'. Available version is '${serverDetailInfo.version_detail.version}'.`,
      },
      404, // Return 404 as the specific version is not found
    );
  }

  return c.json(serverDetailInfo);
};
