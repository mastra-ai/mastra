import type { Mastra } from '@mastra/core';
import { extractTrajectoryFromTrace, listScoresResponseSchema } from '@mastra/core/evals';
import { scoreTraces } from '@mastra/core/evals/scoreTraces';
import type { ScoresStorage } from '@mastra/core/storage';
import {
  tracesFilterSchema,
  tracesOrderBySchema,
  paginationArgsSchema,
  spanIdsSchema,
  listTracesResponseSchema,
  scoreTracesRequestSchema,
  scoreTracesResponseSchema,
  getTraceArgsSchema,
  getTraceResponseSchema,
  dateRangeSchema,
} from '@mastra/core/storage';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { getObservabilityStore, getStorage } from './observability-shared';

export * from './observability-new-endpoints';

// ============================================================================
// Legacy Parameter Support (backward compatibility with main branch API)
// ============================================================================

/**
 * Legacy query parameters from the old API (main branch).
 * These are accepted for backward compatibility and transformed to new format.
 */
const legacyQueryParamsSchema = z.object({
  // Old: dateRange was in pagination, now it's startedAt in filters
  dateRange: dateRangeSchema.optional(),
  // Old: name matched span names like "agent run: 'myAgent'"
  name: z.string().optional(),
  // entityType needs preprocessing to handle legacy 'workflow' value
  entityType: z.preprocess(val => (val === 'workflow' ? 'workflow_run' : val), z.string().optional()),
});

/**
 * Transforms legacy query parameters to the new format.
 * - dateRange -> startedAt (if startedAt not already set)
 * - name="agent run: 'x'" -> entityId='x', entityType='agent'
 * - name="workflow run: 'x'" -> entityId='x', entityType='workflow_run'
 * - entityType='workflow' -> entityType='workflow_run' (enum value fix)
 */
function transformLegacyParams(params: Record<string, unknown>): Record<string, unknown> {
  const result = { ...params };

  // Transform old entityType='workflow' -> 'workflow_run' to support direct handler usage in tests
  if (result.entityType === 'workflow') {
    result.entityType = 'workflow_run';
  }

  // Transform old dateRange -> new startedAt
  if (params.dateRange && !params.startedAt) {
    result.startedAt = params.dateRange;
    delete result.dateRange;
  }

  // Transform old name -> entityId + entityType
  // Old format: name matched span names like "agent run: 'myAgent'" or "workflow run: 'myWorkflow'"
  if (typeof params.name === 'string' && !params.entityId) {
    const agentMatch = params.name.match(/^agent run: '([^']+)'$/);
    const workflowMatch = params.name.match(/^workflow run: '([^']+)'$/);

    if (agentMatch) {
      result.entityId = agentMatch[1];
      result.entityType = 'agent';
    } else if (workflowMatch) {
      result.entityId = workflowMatch[1];
      result.entityType = 'workflow_run';
    }
    delete result.name;
  }

  return result;
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

async function getScoresStore(mastra: Mastra): Promise<ScoresStorage> {
  const storage = getStorage(mastra);
  const scores = await storage.getStore('scores');
  if (!scores) {
    throw new HTTPException(500, { message: 'Scores storage domain is not available' });
  }
  return scores;
}

/** Route: GET /observability/traces - paginated trace listing with filtering and sorting. */
export const LIST_TRACES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/traces',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    tracesFilterSchema
      .extend(paginationArgsSchema.shape)
      .extend(tracesOrderBySchema.shape)
      .extend(legacyQueryParamsSchema.shape) // Accept legacy params for backward compatibility
      .partial(),
  ),
  responseSchema: listTracesResponseSchema,
  summary: 'List traces',
  description: 'Returns a paginated list of traces with optional filtering and sorting',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      // Transform legacy params to new format before processing
      const transformedParams = transformLegacyParams(params);

      const filters = pickParams(tracesFilterSchema, transformedParams);
      const pagination = pickParams(paginationArgsSchema, transformedParams);
      const orderBy = pickParams(tracesOrderBySchema, transformedParams);

      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.listTraces({ filters, pagination, orderBy });
    } catch (error) {
      return handleError(error, 'Error listing traces');
    }
  },
});

/** Route: GET /observability/traces/:traceId - retrieve a single trace with all spans. */
export const GET_TRACE_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/traces/:traceId',
  responseType: 'json',
  pathParamSchema: getTraceArgsSchema,
  responseSchema: getTraceResponseSchema,
  summary: 'Get AI trace by ID',
  description: 'Returns a complete AI trace with all spans by trace ID',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, traceId }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      const trace = await observabilityStore.getTrace({ traceId });

      if (!trace) {
        throw new HTTPException(404, { message: `Trace with ID '${traceId}' not found` });
      }

      return trace;
    } catch (error) {
      return handleError(error, 'Error getting trace');
    }
  },
});

/** Route: GET /observability/traces/:traceId/trajectory - extract trajectory from a trace. */
export const GET_TRACE_TRAJECTORY_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/traces/:traceId/trajectory',
  responseType: 'json',
  pathParamSchema: getTraceArgsSchema,
  responseSchema: z.object({
    steps: z.array(z.unknown()),
    totalDurationMs: z.number().optional(),
    rawOutput: z.unknown().optional(),
    rawWorkflowResult: z.unknown().optional(),
  }),
  summary: 'Extract trajectory from trace',
  description: 'Extracts a structured trajectory (ordered steps) from a trace by analyzing its spans',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, traceId }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      const trace = await observabilityStore.getTrace({ traceId });

      if (!trace) {
        throw new HTTPException(404, { message: `Trace with ID '${traceId}' not found` });
      }

      const trajectory = extractTrajectoryFromTrace(trace.spans);
      return trajectory;
    } catch (error) {
      return handleError(error, 'Error extracting trajectory from trace');
    }
  },
});

/** Route: POST /observability/traces/score - score traces using a specified scorer (fire-and-forget). */
export const SCORE_TRACES_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/traces/score',
  responseType: 'json',
  bodySchema: scoreTracesRequestSchema,
  responseSchema: scoreTracesResponseSchema,
  summary: 'Score traces',
  description: 'Scores one or more traces using a specified scorer (fire-and-forget)',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      // Validate storage exists before starting background task
      getStorage(mastra);

      const { scorerName, targets } = params;

      const scorer = mastra.getScorerById(scorerName);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer '${scorerName}' not found` });
      }

      scoreTraces({
        scorerId: scorer.config.id || scorer.config.name,
        targets,
        mastra,
      }).catch(error => {
        const logger = mastra.getLogger();
        logger?.error(`Background trace scoring failed: ${error.message}`, error);
      });

      return {
        status: 'success',
        message: `Scoring started for ${targets.length} ${targets.length === 1 ? 'trace' : 'traces'}`,
        traceCount: targets.length,
      };
    } catch (error) {
      return handleError(error, 'Error processing trace scoring');
    }
  },
});

export const LIST_SCORES_BY_SPAN_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/traces/:traceId/:spanId/scores',
  responseType: 'json',
  pathParamSchema: spanIdsSchema,
  // List endpoints accept optional query params; use partial() to allow empty queries.
  queryParamSchema: wrapSchemaForQueryParams(paginationArgsSchema.partial()),
  responseSchema: listScoresResponseSchema,
  summary: 'List scores by span',
  description: 'Returns all scores for a specific span within a trace',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const pagination = pickParams(paginationArgsSchema, params);
      const spanIds = pickParams(spanIdsSchema, params);

      const scoresStore = await getScoresStore(mastra);

      return await scoresStore.listScoresBySpan({
        ...spanIds,
        pagination,
      });
    } catch (error) {
      return handleError(error, 'Error getting scores by span');
    }
  },
});
