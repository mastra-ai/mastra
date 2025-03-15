import type { Logger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
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
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();

    if ((logger as Logger).transports) {
      const transports = (logger as Logger).transports;
      return c.json({
        transports: Object.keys(transports),
      });
    } else {
      return c.json({
        transports: [],
      });
    }
  } catch (e) {
    return handleError(e, 'Error getting log Transports ');
  }
}
