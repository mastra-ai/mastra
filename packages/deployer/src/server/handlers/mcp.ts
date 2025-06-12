import type { Mastra } from '@mastra/core';
import type { MCPServerBase, ServerInfo, ServerDetailInfo } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { handleError } from './error';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

/**
 * Handler for Streamable HTTP requests (POST, GET, DELETE) to /api/mcp/:serverId/mcp
 */
export const getMcpServerMessageHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const { req, res } = toReqRes(c.req.raw);
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    // Use Node.js res to send response since we are not returning a Hono response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `MCP server '${serverId}' not found` }));
    return;
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
    } else {
      // If headers were already sent (e.g., during SSE stream), just log the error
      c.get('logger')?.error('Error after headers sent:', error);
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

/**
 * Handler for GET /api/mcp/:serverId/tools - List tools for a specific MCP Server
 */
export const listMcpServerToolsHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');

  if (!mastra || typeof mastra.getMCPServer !== 'function') {
    c.get('logger')?.error('Mastra instance or getMCPServer method not available in listMcpServerToolsHandler');
    return c.json({ error: 'Mastra instance or getMCPServer method not available' }, 500);
  }

  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server with ID '${serverId}' not found` }, 404);
  }

  if (typeof server.getToolListInfo !== 'function') {
    c.get('logger')?.error(`MCPServer with ID '${serverId}' does not support getToolListInfo.`);
    return c.json({ error: `Server '${serverId}' cannot list tools in this way.` }, 501);
  }

  try {
    const toolListInfo = server.getToolListInfo();
    return c.json(toolListInfo);
  } catch (error: any) {
    c.get('logger')?.error(`Error in listMcpServerToolsHandler for serverId '${serverId}':`, { error: error.message });
    return handleError(error, `Error listing tools for MCP server '${serverId}'`);
  }
};

/**
 * Handler for GET /api/mcp/:serverId/tools/:toolId - Get details for a specific tool on an MCP Server
 */
export const getMcpServerToolDetailHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const toolId = c.req.param('toolId');

  if (!mastra || typeof mastra.getMCPServer !== 'function') {
    c.get('logger')?.error('Mastra instance or getMCPServer method not available in getMcpServerToolDetailHandler');
    return c.json({ error: 'Mastra instance or getMCPServer method not available' }, 500);
  }

  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server with ID '${serverId}' not found` }, 404);
  }

  if (typeof server.getToolInfo !== 'function') {
    c.get('logger')?.error(`MCPServer with ID '${serverId}' does not support getToolInfo.`);
    return c.json({ error: `Server '${serverId}' cannot provide tool details in this way.` }, 501);
  }

  try {
    const toolInfo = server.getToolInfo(toolId);
    if (!toolInfo) {
      return c.json({ error: `Tool with ID '${toolId}' not found on MCP server '${serverId}'` }, 404);
    }
    return c.json(toolInfo);
  } catch (error: any) {
    c.get('logger')?.error(`Error in getMcpServerToolDetailHandler for serverId '${serverId}', toolId '${toolId}':`, {
      error: error.message,
    });
    return handleError(error, `Error getting tool '${toolId}' details for MCP server '${serverId}'`);
  }
};

/**
 * Handler for POST /api/mcp/:serverId/tools/:toolId/execute - Execute a tool on an MCP Server
 */
export const executeMcpServerToolHandler = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const toolId = c.req.param('toolId');

  if (!mastra || typeof mastra.getMCPServer !== 'function') {
    c.get('logger')?.error('Mastra instance or getMCPServer method not available in executeMcpServerToolHandler');
    return c.json({ error: 'Mastra instance or getMCPServer method not available' }, 500);
  }

  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server with ID '${serverId}' not found` }, 404);
  }

  if (typeof server.executeTool !== 'function') {
    c.get('logger')?.error(`MCPServer with ID '${serverId}' does not support executeTool.`);
    return c.json({ error: `Server '${serverId}' cannot execute tools in this way.` }, 501);
  }

  try {
    const body = await c.req.json();
    const args = body?.data;
    const runtimeContext = body?.runtimeContext; // Optional

    // The executeTool method in MCPServer is now responsible for arg validation
    const result = await server.executeTool(toolId, args, runtimeContext);
    return c.json({ result }); // Or return result directly if it's already the desired JSON structure
  } catch (error: any) {
    c.get('logger')?.error(`Error executing tool '${toolId}' on server '${serverId}':`, { error: error.message });
    // Handle ZodError specifically for bad requests if thrown from MCPServer.executeTool
    if (error.name === 'ZodError') {
      // Relies on ZodError having a 'name' property
      return c.json({ error: 'Invalid tool arguments', details: error.errors }, 400);
    }
    return handleError(error, `Error executing tool '${toolId}' on MCP server '${serverId}'`);
  }
};
