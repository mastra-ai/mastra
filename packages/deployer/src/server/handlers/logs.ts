import type { Mastra } from '@mastra/core';
import type { LogLevel } from '@mastra/core/logger';
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
    const { transportId, fromDate, toDate, logLevel, page, perPage } = c.req.query();
    const filters = c.req.queries('filters');

    const logs = await getOriginalLogsHandler({
      mastra,
      transportId,
      params: {
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        logLevel: logLevel ? (logLevel as LogLevel) : undefined,
        filters,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      },
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
    const { transportId, fromDate, toDate, logLevel, page, perPage } = c.req.query();
    const filters = c.req.queries('filters');

    const logs = await getOriginalLogsByRunIdHandler({
      mastra,
      runId,
      transportId,
      params: {
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        logLevel: logLevel ? (logLevel as LogLevel) : undefined,
        filters,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      },
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
