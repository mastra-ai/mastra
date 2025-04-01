import type { Mastra } from '@mastra/core';
import {
  getLogsHandler as getOriginalLogsHandler,
  getLogsByRunIdHandler as getOriginalLogsByRunIdHandler,
  getLogTransports as getOriginalLogTransportsHandler,
} from '@mastra/server/handlers/logs';
import type { Context } from 'hono';

import { handleError } from './error';

export async function getLogsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const transportId = c.req.query('transportId');

    const logs = await getOriginalLogsHandler({
      mastra,
      transportId,
    });

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

    const logs = await getOriginalLogsByRunIdHandler({
      mastra,
      runId,
      transportId,
    });

    return c.json(logs);
  } catch (error) {
    return handleError(error, 'Error getting logs by run ID');
  }
}

export async function getLogTransports(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const result = await getOriginalLogTransportsHandler({
      mastra,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting log Transports');
  }
}
