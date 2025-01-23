import { Context } from 'hono';

import { handleError } from './error';
import { validateBody } from './utils';

export async function executeSyncHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const syncId = c.req.param('syncId');
    const { runId, params: syncParams } = await c.req.json();

    validateBody({ params: syncParams });

    const result = await mastra.sync(syncId, syncParams, runId);
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error executing sync');
  }
}
