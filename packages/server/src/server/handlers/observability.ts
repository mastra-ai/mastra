import { scoreTraces } from '@mastra/core/evals/scoreTraces';
import { parseTracesQueryParams, type StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  getAITracesPaginatedResponseSchema,
  getAITraceResponseSchema,
  scoreTracesBodySchema,
  scoreTracesResponseSchema,
  listScoresBySpanResponseSchema,
  traceIdPathParams,
  traceSpanPathParams,
  listScoresBySpanQuerySchema,
} from '../schemas/observability';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { handleError } from './error';

export async function listScoresBySpan({
  mastra,
  traceId,
  spanId,
  page,
  perPage,
}: Context & {
  traceId: string;
  spanId: string;
  page: StoragePagination['page'];
  perPage: StoragePagination['perPage'];
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    if (!traceId || !spanId) {
      throw new HTTPException(400, { message: 'Trace ID and span ID are required' });
    }

    return await storage.listScoresBySpan({ traceId, spanId, pagination: { page, perPage } });
  } catch (error) {
    return handleError(error, 'Error getting scores by span');
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/observability/traces
 *
 * Query parameter format (flattened for readability):
 * - Pagination: ?page=0&perPage=20
 * - Simple filters: ?entityType=agent&entityId=abc&status=success
 * - Date range: ?dateRange[start]=2024-01-01T00:00:00Z&dateRange[end]=...
 * - Arrays: ?tags[0]=prod&tags[1]=v2
 * - Nested objects: ?metadata[key1]=val1&metadata[key2]=val2
 * - Booleans: ?hasChildError=true
 */
export const GET_TRACES_PAGINATED_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces',
  responseType: 'json',
  // No queryParamSchema - raw params are parsed with qs.parse + Zod
  // to handle bracket notation for nested objects and arrays
  responseSchema: getAITracesPaginatedResponseSchema,
  summary: 'Get AI traces',
  description:
    'Returns a paginated list of AI execution traces with optional filtering by type, date range, entity, status, tags, and more',
  tags: ['Observability'],
  handler: async ({ mastra, ...queryParams }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not available' });
      }

      // Extract just the query param keys (filter out runtime context)
      const { requestContext, tools, taskStore, abortSignal, ...rawParams } = queryParams as Record<string, unknown>;

      // Parse and validate query params
      const result = parseTracesQueryParams(rawParams as Record<string, string | string[] | undefined>);

      if (!result.success) {
        throw new HTTPException(400, {
          message: 'Validation failed',
          cause: { details: result.errors },
        });
      }

      return storage.getTracesPaginated(result.data);
    } catch (error) {
      handleError(error, 'Error getting traces paginated');
    }
  },
});

export const GET_TRACE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces/:traceId',
  responseType: 'json',
  pathParamSchema: traceIdPathParams,
  responseSchema: getAITraceResponseSchema,
  summary: 'Get AI trace by ID',
  description: 'Returns a complete AI trace with all spans by trace ID',
  tags: ['Observability'],
  handler: async ({ mastra, traceId }) => {
    try {
      if (!traceId) {
        throw new HTTPException(400, { message: 'Trace ID is required' });
      }

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not available' });
      }

      const trace = await storage.getTrace(traceId);

      if (!trace) {
        throw new HTTPException(404, { message: `Trace with ID '${traceId}' not found` });
      }

      return trace;
    } catch (error) {
      handleError(error, 'Error getting trace');
    }
  },
});

export const SCORE_TRACES_ROUTE = createRoute({
  method: 'POST',
  path: '/api/observability/traces/score',
  responseType: 'json',
  bodySchema: scoreTracesBodySchema,
  responseSchema: scoreTracesResponseSchema,
  summary: 'Score traces',
  description: 'Scores one or more traces using a specified scorer (fire-and-forget)',
  tags: ['Observability'],
  handler: async ({ mastra, ...params }) => {
    try {
      const { scorerName, targets } = params;

      if (!scorerName) {
        throw new HTTPException(400, { message: 'Scorer ID is required' });
      }

      if (!targets || targets.length === 0) {
        throw new HTTPException(400, { message: 'At least one target is required' });
      }

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not available' });
      }

      const scorer = mastra.getScorerById(scorerName);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer '${scorerName}' not found` });
      }

      const logger = mastra.getLogger();

      scoreTraces({
        scorerId: scorer.config.id || scorer.config.name,
        targets,
        mastra,
      }).catch(error => {
        logger?.error(`Background trace scoring failed: ${error.message}`, error);
      });

      return {
        status: 'success',
        message: `Scoring started for ${targets.length} ${targets.length === 1 ? 'trace' : 'traces'}`,
        traceCount: targets.length,
      };
    } catch (error) {
      handleError(error, 'Error processing trace scoring');
    }
  },
});

export const LIST_SCORES_BY_SPAN_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces/:traceId/:spanId/scores',
  responseType: 'json',
  pathParamSchema: traceSpanPathParams,
  queryParamSchema: listScoresBySpanQuerySchema,
  responseSchema: listScoresBySpanResponseSchema,
  summary: 'List scores by span',
  description: 'Returns all scores for a specific span within a trace',
  tags: ['Observability'],
  handler: async ({ mastra, traceId, spanId, ...params }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not available' });
      }

      if (!traceId || !spanId) {
        throw new HTTPException(400, { message: 'Trace ID and span ID are required' });
      }

      const { page, perPage } = params;
      return await storage.listScoresBySpan({
        traceId,
        spanId,
        pagination: { page: page ?? 0, perPage: perPage ?? 10 },
      });
    } catch (error) {
      return handleError(error, 'Error getting scores by span');
    }
  },
});
