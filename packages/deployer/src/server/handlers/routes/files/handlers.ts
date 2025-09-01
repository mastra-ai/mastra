import type { Mastra } from '@mastra/core';
import { getFileContentTypeHandler as getOriginalFileContentTypeHandler } from '@mastra/server/handlers/files';
import type { Context } from 'hono';

// Helper function to get the Mastra instance from the context
const getMastra = (c: Context): Mastra => c.get('mastra');

/**
 * Handler for Streamable HTTP requests (POST, GET, DELETE) to /api/mcp/:serverId/mcp
 */
export const getFileContentTypeHandler = async (c: Context) => {
  const mastra = getMastra(c);

  const body = await c.req.json();
  const contentType = await getOriginalFileContentTypeHandler({ body, mastra });

  return c.json({ contentType });
};
