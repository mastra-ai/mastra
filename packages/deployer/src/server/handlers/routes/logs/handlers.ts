import type { LogLevel } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import {
  listLogsHandler as getOriginalListLogsHandler,
  listLogsByRunIdHandler as getOriginalListLogsByRunIdHandler,
  listLogTransports as getOriginalListLogTransportsHandler,
} from '@mastra/server/handlers/logs';
import type { Context } from 'hono';

import { handleError } from '../../error';

export async function listLogsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const { transportId, fromDate, toDate, logLevel, page, perPage } = c.req.query();
    const filters = c.req.queries('filters');

    const logs = await getOriginalListLogsHandler({
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

export async function listLogsByRunIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');
    const { transportId, fromDate, toDate, logLevel, page, perPage } = c.req.query();
    const filters = c.req.queries('filters');

    const logs = await getOriginalListLogsByRunIdHandler({
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

export async function listLogTransports(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');

    const result = await getOriginalListLogTransportsHandler({
      mastra,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting log Transports');
  }
}
