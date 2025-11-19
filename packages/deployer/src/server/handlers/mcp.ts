import type { Mastra } from '@mastra/core/mastra';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

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
