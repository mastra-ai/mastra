import type { Mastra } from '@mastra/core';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { handleError } from './error';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

/**
 * Handler for POST /api/servers/:serverId/mcp
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
      httpPath: `/api/servers/${serverId}/mcp`,
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
  const sseConnectionPath = `/api/servers/${serverId}/sse`;
  const sseMessagePath = `/api/servers/${serverId}/messages`;

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
