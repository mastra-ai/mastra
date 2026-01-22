import type { Mastra } from '@mastra/core';
import { listScoresResponseSchema } from '@mastra/core/evals';
import { scoreTraces } from '@mastra/core/evals/scoreTraces';
import type { MastraStorage, ScoresStorage, ObservabilityStorage } from '@mastra/core/storage';
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
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

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

  // Transform old entityType='workflow' -> 'workflow_run' (the Zod validation would have already transformed this)
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

function getStorage(mastra: Mastra): MastraStorage {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

async function getObservabilityStore(mastra: Mastra): Promise<ObservabilityStorage> {
  const storage = getStorage(mastra);
  const observability = await storage.getStore('observability');
  if (!observability) {
    throw new HTTPException(500, { message: 'Observability storage domain is not available' });
  }
  return observability;
}

async function getScoresStore(mastra: Mastra): Promise<ScoresStorage> {
  const storage = getStorage(mastra);
  const scores = await storage.getStore('scores');
  if (!scores) {
    throw new HTTPException(500, { message: 'Scores storage domain is not available' });
  }
  return scores;
}

export const LIST_TRACES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    tracesFilterSchema
      .merge(paginationArgsSchema)
      .merge(tracesOrderBySchema)
      .merge(legacyQueryParamsSchema) // Accept legacy params for backward compatibility
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
      handleError(error, 'Error listing traces');
    }
  },
});

export const GET_TRACE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces/:traceId',
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
      handleError(error, 'Error getting trace');
    }
  },
});

export const SCORE_TRACES_ROUTE = createRoute({
  method: 'POST',
  path: '/api/observability/traces/score',
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
      handleError(error, 'Error processing trace scoring');
    }
  },
});

export const LIST_SCORES_BY_SPAN_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces/:traceId/:spanId/scores',
  responseType: 'json',
  pathParamSchema: spanIdsSchema,
  queryParamSchema: paginationArgsSchema,
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
      handleError(error, 'Error getting scores by span');
    }
  },
});
