import { runIdSchema } from '../schemas/common';
import { listLogsQuerySchema, listLogsResponseSchema, listLogTransportsResponseSchema } from '../schemas/logs';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { parseFilters, validateBody } from './utils';

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_LOG_TRANSPORTS_ROUTE = createRoute({
  method: 'GET',
  path: '/logs/transports',
  responseType: 'json',
  responseSchema: listLogTransportsResponseSchema,
  summary: 'List log transports',
  description: 'Returns a list of all available log transports',
  tags: ['Logs'],
  requiresAuth: true,
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
  path: '/logs',
  responseType: 'json',
  queryParamSchema: listLogsQuerySchema,
  responseSchema: listLogsResponseSchema,
  summary: 'List logs',
  description:
    'Returns logs from a specific transport with optional filtering by date range, log level, and custom filters',
  tags: ['Logs'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const { transportId, fromDate, toDate, logLevel, filters: _filters, page, perPage } = params;

      validateBody({ transportId });

      // Parse filter query parameter if present
      const filters = parseFilters(_filters);

      const logs = await mastra.listLogs(transportId!, {
        fromDate,
        toDate,
        logLevel,
        filters,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      });
      return logs;
    } catch (error) {
      return handleError(error, 'Error getting logs');
    }
  },
});

export const LIST_LOGS_BY_RUN_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/logs/:runId',
  responseType: 'json',
  pathParamSchema: runIdSchema,
  queryParamSchema: listLogsQuerySchema,
  responseSchema: listLogsResponseSchema,
  summary: 'List logs by run ID',
  description: 'Returns all logs for a specific execution run from a transport',
  tags: ['Logs'],
  requiresAuth: true,
  handler: async ({ mastra, runId, ...params }) => {
    try {
      const { transportId, fromDate, toDate, logLevel, filters: _filters, page, perPage } = params;

      validateBody({ runId, transportId });

      // Parse filter query parameter if present
      const filters = parseFilters(_filters);

      const logs = await mastra.listLogsByRunId({
        runId: runId!,
        transportId: transportId!,
        fromDate,
        toDate,
        logLevel,
        filters,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      });
      return logs;
    } catch (error) {
      return handleError(error, 'Error getting logs by run ID');
    }
  },
});
