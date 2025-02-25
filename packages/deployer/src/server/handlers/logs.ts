import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';

export async function getLogsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const transportId = c.req.query('transportId');

    if (!transportId) {
      throw new HTTPException(400, { message: 'transportId is required' });
    }

    const logs = await mastra.getLogs(transportId);
    return c.json(logs);
  } catch (error) {
    return handleError(error, 'Error getting logs');
  }
}

export async function getLogsByRunIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');
    const transportId = c.req.query('transportId');

    if (!transportId) {
      throw new HTTPException(400, { message: 'transportId is required' });
    }

    const logs = await mastra.getLogsByRunId({ runId, transportId });
    return c.json(logs);
  } catch (error) {
    return handleError(error, 'Error getting logs by run ID');
  }
}

export async function getLogTransports(c: Context) {
  console.log('here');
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const transports = logger.transports;
    return c.json({
      transports: Object.keys(transports),
    });
  } catch (e) {
    return handleError(e, 'Error getting log Transports ');
  }
}
