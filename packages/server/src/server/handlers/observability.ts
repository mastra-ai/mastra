import { scoreTraces } from '@mastra/core/evals/scoreTraces';
import type { TracesPaginatedArg, StoragePagination } from '@mastra/core/storage';
import z from 'zod';
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

interface ObservabilityContext extends Context {
  traceId?: string;
  pagination?: TracesPaginatedArg['pagination'];
  filters?: TracesPaginatedArg['filters'];
}

interface ScoreTracesContext extends Context {
  // scorer.id
  scorerName?: string;
  targets?: Array<{
    traceId: string;
    spanId?: string;
  }>;
}

/**
 * Get a complete trace by trace ID
 * Returns all spans in the trace with their parent-child relationships
 */
export async function getTraceHandler({ mastra, traceId }: ObservabilityContext & { traceId: string }) {
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
}

/**
 * Get paginated traces with filtering and pagination
 * Returns only root spans (parent spans) for pagination, not child spans
 */
export async function getTracesPaginatedHandler({ mastra, pagination, filters }: ObservabilityContext) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(500, { message: 'Storage is not available' });
    }

    if (pagination?.page && pagination.page < 0) {
      throw new HTTPException(400, { message: 'Page must be a non-negative integer' });
    }

    if (pagination?.perPage && pagination.perPage < 0) {
      throw new HTTPException(400, { message: 'Per page must be a non-negative integer' });
    }

    if (pagination?.dateRange) {
      const { start, end } = pagination.dateRange;

      if (start && !(start instanceof Date)) {
        throw new HTTPException(400, { message: 'Invalid date format in date range' });
      }

      if (end && !(end instanceof Date)) {
        throw new HTTPException(400, { message: 'Invalid date format in date range' });
      }
    }

    return storage.getTracesPaginated({
      pagination,
      filters,
    });
  } catch (error) {
    handleError(error, 'Error getting traces paginated');
  }
}

/**
 * Score traces using a specified scorer
 * Fire-and-forget approach - returns immediately while scoring runs in background
 */
export async function scoreTracesHandler({ mastra, scorerName, targets }: ScoreTracesContext) {
  try {
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

    // Return immediate response
    return {
      status: 'success',
      message: `Scoring started for ${targets.length} ${targets.length === 1 ? 'trace' : 'traces'}`,
      traceCount: targets.length,
    };
  } catch (error) {
    handleError(error, 'Error processing trace scoring');
  }
}

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
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const GET_TRACES_PAGINATED_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces',
  responseType: 'json',
  queryParamSchema: z.object({
    page: z.coerce.number().optional().default(0),
    perPage: z.coerce.number().optional().default(10),
    spanType: z.string().optional(),
    dateRange: z.string().optional(),
    // Entity filters
    entityId: z.string().optional(),
    entityType: z.string().optional(),
    entityName: z.string().optional(),
    // Status filter (derived: 'error' | 'running' | 'success')
    status: z.string().optional(),
    // Tags filter (comma-separated)
    tags: z.string().optional(),
    // Identity & Tenancy filters
    userId: z.string().optional(),
    organizationId: z.string().optional(),
    resourceId: z.string().optional(),
    // Correlation ID filters
    runId: z.string().optional(),
    sessionId: z.string().optional(),
    threadId: z.string().optional(),
    requestId: z.string().optional(),
    // Deployment context filters
    environment: z.string().optional(),
    source: z.string().optional(),
    serviceName: z.string().optional(),
    deploymentId: z.string().optional(),
    // JSONB filters (JSON strings)
    metadata: z.string().optional(),
    scope: z.string().optional(),
    versionInfo: z.string().optional(),
  }),
  responseSchema: getAITracesPaginatedResponseSchema,
  summary: 'Get AI traces',
  description:
    'Returns a paginated list of AI execution traces with optional filtering by type, date range, entity, status, tags, and more',
  tags: ['Observability'],
  handler: async ({ mastra, ...params }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not available' });
      }

      const {
        page,
        perPage,
        spanType,
        dateRange,
        entityId,
        entityType,
        entityName,
        status,
        tags,
        userId,
        organizationId,
        resourceId,
        runId,
        sessionId,
        threadId,
        requestId,
        environment,
        source,
        serviceName,
        deploymentId,
        metadata,
        scope,
        versionInfo,
      } = params;

      // Parse and convert dateRange to Date objects
      const rawDateRange = dateRange ? JSON.parse(dateRange) : undefined;
      const pagination = {
        page,
        perPage,
        dateRange: rawDateRange
          ? {
              start: rawDateRange.start ? new Date(rawDateRange.start) : undefined,
              end: rawDateRange.end ? new Date(rawDateRange.end) : undefined,
            }
          : undefined,
      };

      // Build filters object
      const filters: Record<string, unknown> = {};

      // Entity filters
      if (spanType) filters.spanType = spanType;
      if (entityId) filters.entityId = entityId;
      if (entityType) filters.entityType = entityType;
      if (entityName) filters.entityName = entityName;
      if (status) filters.status = status;

      // Identity & Tenancy filters
      if (userId) filters.userId = userId;
      if (organizationId) filters.organizationId = organizationId;
      if (resourceId) filters.resourceId = resourceId;

      // Correlation ID filters
      if (runId) filters.runId = runId;
      if (sessionId) filters.sessionId = sessionId;
      if (threadId) filters.threadId = threadId;
      if (requestId) filters.requestId = requestId;

      // Deployment context filters
      if (environment) filters.environment = environment;
      if (source) filters.source = source;
      if (serviceName) filters.serviceName = serviceName;
      if (deploymentId) filters.deploymentId = deploymentId;

      // Tags filter (comma-separated string to array)
      if (tags) filters.tags = tags.split(',').map(t => t.trim());

      // JSONB filters (JSON string to object)
      if (metadata) filters.metadata = JSON.parse(metadata);
      if (scope) filters.scope = JSON.parse(scope);
      if (versionInfo) filters.versionInfo = JSON.parse(versionInfo);

      if (pagination?.page && pagination.page < 0) {
        throw new HTTPException(400, { message: 'Page must be a non-negative integer' });
      }

      if (pagination?.perPage && pagination.perPage < 0) {
        throw new HTTPException(400, { message: 'Per page must be a non-negative integer' });
      }

      if (pagination?.dateRange) {
        const { start, end } = pagination.dateRange;

        if (start && !(start instanceof Date)) {
          throw new HTTPException(400, { message: 'Invalid date format in date range' });
        }

        if (end && !(end instanceof Date)) {
          throw new HTTPException(400, { message: 'Invalid date format in date range' });
        }
      }

      return storage.getTracesPaginated({ pagination, filters });
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
