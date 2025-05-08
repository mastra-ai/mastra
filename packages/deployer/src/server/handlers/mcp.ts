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
export const handleMcpServerSseRoutes = async (c: Context) => {
  const mastra = getMastra(c);
  const serverId = c.req.param('serverId');
  const server = mastra.getMCPServer(serverId);

  if (!server) {
    return c.json({ error: `MCP server '${serverId}' not found` }, 404);
  }

  const { req, res } = toReqRes(c.req.raw);
  const requestUrl = new URL(c.req.url);

  // Define the paths that MCPServer's startSSE method will compare against.
  // These paths correspond to the routes we will define in server/index.ts.
  const sseConnectionPath = `/api/servers/${serverId}/sse`;
  const sseMessagePath = `/api/servers/${serverId}/messages`;

  try {
    // MCPServer.startSSE will use requestUrl.pathname to differentiate
    // between an SSE connection request and a message posting request.
    await server.startSSE({
      url: requestUrl,
      ssePath: sseConnectionPath,
      messagePath: sseMessagePath,
      req,
      res,
    });

    // MCPServer.startSSE is expected to handle the response (send headers, write data, end response).
    // We use toFetchResponse to convert the Node.js response back to a Fetch API Response
    // that Hono can work with, similar to the streamable HTTP handler.
    if (res.writableEnded || res.headersSent) {
      return toFetchResponse(res);
    }

    // This case should ideally not be reached if server.startSSE behaves as expected.
    c
      .get('logger')
      ?.warn(
        { serverId, path: requestUrl.pathname },
        'MCP SSE handler: MCPServer.startSSE did not seem to handle the response.',
      );
    return c.text('Internal Server Error: MCP SSE request not fully processed by server component', 500);
  } catch (error: any) {
    c.get('logger')?.error({ err: error, serverId, path: requestUrl.pathname }, 'Error in MCP SSE route handler');
    // If the response hasn't been started, use the standard error handler.
    if (!res.headersSent && !res.writableEnded) {
      return handleError(error, 'Error handling MCP SSE request');
    }
    // If response headers were already sent or the response was ended,
    // it's too late to send a new HTTP error response. The error is logged.
    // The client might experience a broken connection.
  }
};
