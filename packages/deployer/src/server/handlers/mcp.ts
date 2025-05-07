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
