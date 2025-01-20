import { Context } from 'hono';

import { handleError } from './error';

export async function getLogsHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const logs = await mastra.getLogs();
    return c.json(logs);
  } catch (error) {
    return handleError(error, 'Error getting logs');
  }
}

export async function getLogsByRunIdHandler(c: Context) {
  try {
    const mastra = c.get('mastra');
    const runId = c.req.param('runId');
    const logs = await mastra.getLogsByRunId(runId);
    return c.json(logs);
  } catch (error) {
    return handleError(error, 'Error getting logs by run ID');
  }
}
