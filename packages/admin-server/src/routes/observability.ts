import type { AdminServerContext, AdminServerRoute } from '../types';
import { projectIdParamSchema, traceIdParamSchema } from '../schemas/common';
import {
  traceResponseSchema,
  traceWithSpansResponseSchema,
  logEntryResponseSchema,
  aggregatedMetricResponseSchema,
  scoreResponseSchema,
  queryTracesQuerySchema,
  queryLogsQuerySchema,
  queryMetricsQuerySchema,
  queryScoresQuerySchema,
} from '../schemas/observability';

/**
 * GET /projects/:projectId/traces - Query traces.
 */
export const QUERY_TRACES_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/traces',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: queryTracesQuerySchema,
  summary: 'Query traces',
  description: 'Query traces for a project with optional filters',
  tags: ['Observability'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, page, limit, startTime, endTime, name, status, minDurationMs, maxDurationMs } =
      params as AdminServerContext & {
        projectId: string;
        page?: number;
        limit?: number;
        startTime?: string;
        endTime?: string;
        name?: string;
        status?: string;
        minDurationMs?: number;
        maxDurationMs?: number;
      };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const queryProvider = admin.getObservabilityQueryProvider();
    if (!queryProvider) {
      return {
        data: [],
        total: 0,
        page: page ?? 1,
        perPage: limit ?? 20,
        hasMore: false,
      };
    }

    const pageNum = page ?? 1;
    const perPage = limit ?? 20;

    // Call listTraces with filter and pagination
    // The provider may return { traces, total } or { traces, pagination: { total } }
    const result = await queryProvider.listTraces(
      {
        projectId,
        status: status as 'ok' | 'error' | 'unset' | undefined,
        timeRange:
          startTime || endTime
            ? {
                start: startTime ? new Date(startTime) : new Date(0),
                end: endTime ? new Date(endTime) : new Date(),
              }
            : undefined,
        minDurationMs,
        maxDurationMs,
      },
      {
        limit: perPage,
        offset: (pageNum - 1) * perPage,
      },
    );

    // Handle both interface styles
    const total =
      'total' in result ? result.total : ((result as { pagination?: { total: number } }).pagination?.total ?? 0);

    return {
      data: result.traces,
      total,
      page: pageNum,
      perPage,
      hasMore: pageNum * perPage < total,
    };
  },
};

/**
 * GET /traces/:traceId - Get trace details with spans.
 */
export const GET_TRACE_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/traces/:traceId',
  responseType: 'json',
  pathParamSchema: traceIdParamSchema,
  responseSchema: traceWithSpansResponseSchema,
  summary: 'Get trace',
  description: 'Get trace details with all spans',
  tags: ['Observability'],
  handler: async params => {
    const { admin } = params;
    const { traceId } = params as AdminServerContext & { traceId: string };

    const queryProvider = admin.getObservabilityQueryProvider();
    if (!queryProvider) {
      throw new Error('Trace not found');
    }

    const trace = await queryProvider.getTrace(traceId);
    if (!trace) {
      throw new Error('Trace not found');
    }

    const spans = await queryProvider.getTraceSpans(traceId);

    return {
      ...trace,
      spans,
    };
  },
};

/**
 * GET /projects/:projectId/logs - Query logs.
 */
export const QUERY_LOGS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/logs',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: queryLogsQuerySchema,
  summary: 'Query logs',
  description: 'Query logs for a project with optional filters',
  tags: ['Observability'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, page, limit, startTime, endTime, level, search, traceId } = params as AdminServerContext & {
      projectId: string;
      page?: number;
      limit?: number;
      startTime?: string;
      endTime?: string;
      level?: string;
      search?: string;
      traceId?: string;
    };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const queryProvider = admin.getObservabilityQueryProvider();
    if (!queryProvider) {
      return {
        data: [],
        total: 0,
        page: page ?? 1,
        perPage: limit ?? 20,
        hasMore: false,
      };
    }

    const pageNum = page ?? 1;
    const perPage = limit ?? 20;

    const result = await queryProvider.listLogs(
      {
        projectId,
        traceId,
        level: level as 'debug' | 'info' | 'warn' | 'error' | undefined,
        messageContains: search,
        timeRange:
          startTime || endTime
            ? {
                start: startTime ? new Date(startTime) : new Date(0),
                end: endTime ? new Date(endTime) : new Date(),
              }
            : undefined,
      },
      {
        limit: perPage,
        offset: (pageNum - 1) * perPage,
      },
    );

    // Handle both interface styles
    const total =
      'total' in result ? result.total : ((result as { pagination?: { total: number } }).pagination?.total ?? 0);

    return {
      data: result.logs,
      total,
      page: pageNum,
      perPage,
      hasMore: pageNum * perPage < total,
    };
  },
};

/**
 * GET /projects/:projectId/metrics - Query metrics.
 */
export const QUERY_METRICS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/metrics',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: queryMetricsQuerySchema,
  summary: 'Query metrics',
  description: 'Query aggregated metrics for a project',
  tags: ['Observability'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, startTime, endTime, name, aggregation, groupBy, interval } = params as AdminServerContext & {
      projectId: string;
      startTime?: string;
      endTime?: string;
      name?: string;
      aggregation?: string;
      groupBy?: string;
      interval?: string;
    };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const queryProvider = admin.getObservabilityQueryProvider();
    if (!queryProvider) {
      return {
        data: [],
      };
    }

    // If aggregation is requested, use aggregateMetrics
    if (aggregation) {
      const result = await queryProvider.aggregateMetrics(
        {
          projectId,
          name,
          timeRange:
            startTime || endTime
              ? {
                  start: startTime ? new Date(startTime) : new Date(0),
                  end: endTime ? new Date(endTime) : new Date(),
                }
              : undefined,
        },
        groupBy ? groupBy.split(',') : undefined,
      );

      return {
        data: result,
      };
    }

    // Otherwise, list metrics
    const result = await queryProvider.listMetrics(
      {
        projectId,
        name,
        timeRange:
          startTime || endTime
            ? {
                start: startTime ? new Date(startTime) : new Date(0),
                end: endTime ? new Date(endTime) : new Date(),
              }
            : undefined,
      },
      {
        limit: 100,
        offset: 0,
      },
    );

    return {
      data: result.metrics,
    };
  },
};

/**
 * GET /projects/:projectId/scores - Query scores.
 */
export const QUERY_SCORES_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/scores',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: queryScoresQuerySchema,
  summary: 'Query scores',
  description: 'Query evaluation scores for a project',
  tags: ['Observability'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, page, limit, startTime, endTime, name, traceId, minValue, maxValue } =
      params as AdminServerContext & {
        projectId: string;
        page?: number;
        limit?: number;
        startTime?: string;
        endTime?: string;
        name?: string;
        traceId?: string;
        minValue?: number;
        maxValue?: number;
      };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const queryProvider = admin.getObservabilityQueryProvider();
    if (!queryProvider) {
      return {
        data: [],
        total: 0,
        page: page ?? 1,
        perPage: limit ?? 20,
        hasMore: false,
      };
    }

    const pageNum = page ?? 1;
    const perPage = limit ?? 20;

    const result = await queryProvider.listScores(
      {
        projectId,
        traceId,
        name,
        minValue,
        maxValue,
        timeRange:
          startTime || endTime
            ? {
                start: startTime ? new Date(startTime) : new Date(0),
                end: endTime ? new Date(endTime) : new Date(),
              }
            : undefined,
      },
      {
        limit: perPage,
        offset: (pageNum - 1) * perPage,
      },
    );

    // Handle both interface styles
    const total =
      'total' in result ? result.total : ((result as { pagination?: { total: number } }).pagination?.total ?? 0);

    return {
      data: result.scores,
      total,
      page: pageNum,
      perPage,
      hasMore: pageNum * perPage < total,
    };
  },
};

/**
 * All observability routes.
 */
export const OBSERVABILITY_ROUTES: AdminServerRoute[] = [
  QUERY_TRACES_ROUTE,
  GET_TRACE_ROUTE,
  QUERY_LOGS_ROUTE,
  QUERY_METRICS_ROUTE,
  QUERY_SCORES_ROUTE,
];
