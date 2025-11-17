import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { listLogsQuerySchema, listLogsResponseSchema, listLogTransportsResponseSchema } from '../schemas/logs';
import { runIdSchema } from '../schemas/common';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { ServerRoute } from '../server-adapter/routes';
import { handleError } from './error';
import { validateBody } from './utils';

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_LOG_TRANSPORTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/logs/transports',
  responseType: 'json',
  responseSchema: listLogTransportsResponseSchema,
  summary: 'List log transports',
  description: 'Returns a list of all available log transports',
  tags: ['Logs'],
  handler: async ({ mastra }) => {
    try {
      const logger = mastra.getLogger();
      const transports = logger.getTransports();

      return {
        transports: transports ? [...transports.keys()] : [],
      };
    } catch (error) {
      return handleError(error, 'Error getting log Transports');
    }
  },
});

export const LIST_LOGS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/logs',
  responseType: 'json',
  queryParamSchema: listLogsQuerySchema,
  responseSchema: listLogsResponseSchema,
  summary: 'List logs',
  description:
    'Returns logs from a specific transport with optional filtering by date range, log level, and custom filters',
  tags: ['Logs'],
  handler: async ({ mastra, ...params }) => {
    try {
      const { transportId, fromDate, toDate, logLevel, filters: _filters, page, perPage } = params as any;

      validateBody({ transportId });

      // Parse filter query parameter if present
      const filters = _filters
        ? Object.fromEntries(
            (Array.isArray(_filters) ? _filters : [_filters]).map((attr: string) => {
              const [key, value] = attr.split(':');
              return [key, value];
            }),
          )
        : undefined;

      const options = Object.fromEntries(
        Object.entries({
          fromDate,
          toDate,
          logLevel,
          filters,
          page: page ? Number(page) : undefined,
          perPage: perPage ? Number(perPage) : undefined,
        }).filter(([_, v]) => v !== undefined),
      );

      const logs = await mastra.listLogs(transportId!, options);
      return logs;
    } catch (error) {
      return handleError(error, 'Error getting logs');
    }
  },
});

export const LIST_LOGS_BY_RUN_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/logs/:runId',
  responseType: 'json',
  pathParamSchema: runIdSchema,
  queryParamSchema: listLogsQuerySchema,
  responseSchema: listLogsResponseSchema,
  summary: 'List logs by run ID',
  description: 'Returns all logs for a specific execution run from a transport',
  tags: ['Logs'],
  handler: async ({ mastra, runId, ...params }) => {
    try {
      const { transportId, fromDate, toDate, logLevel, filters: _filters, page, perPage } = params as any;

      validateBody({ runId, transportId });

      // Parse filter query parameter if present
      const filters = _filters
        ? Object.fromEntries(
            (Array.isArray(_filters) ? _filters : [_filters]).map((attr: string) => {
              const [key, value] = attr.split(':');
              return [key, value];
            }),
          )
        : undefined;

      const options = Object.fromEntries(
        Object.entries({
          runId: runId!,
          transportId: transportId!,
          fromDate,
          toDate,
          logLevel,
          filters,
          page: page ? Number(page) : undefined,
          perPage: perPage ? Number(perPage) : undefined,
        }).filter(([_, v]) => v !== undefined),
      ) as {
        runId: string;
        transportId: string;
        fromDate?: Date;
        toDate?: Date;
        logLevel?: LogLevel;
        filters?: Record<string, any>;
        page?: number;
        perPage?: number;
      };

      const logs = await mastra.listLogsByRunId(options);
      return logs;
    } catch (error) {
      return handleError(error, 'Error getting logs by run ID');
    }
  },
});
