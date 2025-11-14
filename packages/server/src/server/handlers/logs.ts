import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { listLogsQuerySchema, listLogsResponseSchema, listLogTransportsResponseSchema } from '../schemas/logs';
import { runIdSchema } from '../schemas/common';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { ServerRoute } from '../server-adapter/routes';
import { handleError } from './error';
import { validateBody } from './utils';

type LogsContext = {
  mastra: Mastra;
  transportId?: string;
  runId?: string;
  params?: {
    fromDate?: Date;
    toDate?: Date;
    logLevel?: LogLevel;
    filters?: string | string[];
    page?: number;
    perPage?: number;
  };
};

export async function listLogsHandler({
  mastra,
  transportId,
  params,
}: Pick<LogsContext, 'mastra' | 'transportId' | 'params'>): Promise<{
  logs: BaseLogMessage[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  try {
    validateBody({ transportId });

    const { fromDate, toDate, logLevel, filters: _filters, page, perPage } = params || {};

    // Parse filter query parameter if present
    const filters = _filters
      ? Object.fromEntries(
          (Array.isArray(_filters) ? _filters : [_filters]).map(attr => {
            const [key, value] = attr.split(':');
            return [key, value];
          }),
        )
      : undefined;

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
}

export async function listLogsByRunIdHandler({
  mastra,
  runId,
  transportId,
  params,
}: Pick<LogsContext, 'mastra' | 'runId' | 'transportId' | 'params'>) {
  try {
    validateBody({ runId, transportId });

    const { fromDate, toDate, logLevel, filters: _filters, page, perPage } = params || {};

    // Parse filter query parameter if present
    const filters = _filters
      ? Object.fromEntries(
          (Array.isArray(_filters) ? _filters : [_filters]).map(attr => {
            const [key, value] = attr.split(':');
            return [key, value];
          }),
        )
      : undefined;

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
}

export async function listLogTransports({ mastra }: Pick<LogsContext, 'mastra'>) {
  try {
    const logger = mastra.getLogger();
    const transports = logger.getTransports();

    return {
      transports: transports ? [...transports.keys()] : [],
    };
  } catch (error) {
    return handleError(error, 'Error getting log Transports');
  }
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_LOG_TRANSPORTS_ROUTE: ServerRoute<any, any> = createRoute({
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

export const LIST_LOGS_ROUTE: ServerRoute<any, any> = createRoute({
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

export const LIST_LOGS_BY_RUN_ID_ROUTE: ServerRoute<any, any> = createRoute({
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
