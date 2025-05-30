import type { Mastra } from '@mastra/core';
import { getAGUIHandler as getOriginalAGUIHandler } from '@mastra/server/handlers/agui';
import type { Context } from 'hono';
import { handleError } from './error';

export async function getAGUIHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const resourceId = c.req.param('resourceId');
  try {
    const result = await getOriginalAGUIHandler({
      req: c.req,
      mastra,
      resourceId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting AGUI');
  }
}
