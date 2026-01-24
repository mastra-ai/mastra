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

    // Observability queries would go through the query provider
    // For now, return an empty result
    return {
      data: [],
      total: 0,
      page: page ?? 1,
      perPage: limit ?? 20,
      hasMore: false,
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
    const { admin, userId } = params;
    const { traceId } = params as AdminServerContext & { traceId: string };
    // Get trace from observability provider
    // For now, throw not found
    throw new Error('Trace not found');
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
    const { projectId, page, limit, startTime, endTime, level, search, traceId } =
      params as AdminServerContext & {
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

    // Log queries would go through the query provider
    // For now, return an empty result
    return {
      data: [],
      total: 0,
      page: page ?? 1,
      perPage: limit ?? 20,
      hasMore: false,
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
    const { projectId, startTime, endTime, name, aggregation, groupBy, interval } =
      params as AdminServerContext & {
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

    // Metric queries would go through the query provider
    // For now, return an empty result
    return {
      data: [],
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

    // Score queries would go through the query provider
    // For now, return an empty result
    return {
      data: [],
      total: 0,
      page: page ?? 1,
      perPage: limit ?? 20,
      hasMore: false,
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
