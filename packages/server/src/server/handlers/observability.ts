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
  // Logs
  logsFilterSchema,
  logsOrderBySchema,
  listLogsResponseSchema,
  // Scores (observability)
  scoresFilterSchema,
  scoresOrderBySchema,
  listScoresResponseSchema as obsListScoresResponseSchema,
  createScoreBodySchema,
  createScoreResponseSchema,
  // Feedback
  feedbackFilterSchema,
  feedbackOrderBySchema,
  listFeedbackResponseSchema,
  createFeedbackBodySchema,
  createFeedbackResponseSchema,
  // Metrics OLAP
  getMetricAggregateArgsSchema,
  getMetricAggregateResponseSchema,
  getMetricBreakdownArgsSchema,
  getMetricBreakdownResponseSchema,
  getMetricTimeSeriesArgsSchema,
  getMetricTimeSeriesResponseSchema,
  getMetricPercentilesArgsSchema,
  getMetricPercentilesResponseSchema,
  // Discovery
  getMetricNamesArgsSchema,
  getMetricNamesResponseSchema,
  getMetricLabelKeysArgsSchema,
  getMetricLabelKeysResponseSchema,
  getMetricLabelValuesArgsSchema,
  getMetricLabelValuesResponseSchema,
  getEntityTypesResponseSchema,
  getEntityNamesArgsSchema,
  getEntityNamesResponseSchema,
  getServiceNamesResponseSchema,
  getEnvironmentsResponseSchema,
  getTagsArgsSchema,
  getTagsResponseSchema,
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

/** Retrieves MastraStorage or throws 500 if unavailable. */
function getStorage(mastra: Mastra): MastraStorage {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

/** Retrieves the observability storage domain or throws 500 if unavailable. */
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
      return handleError(error, 'Error getting scores by span');
    }
  },
});

// ============================================================================
// Logs Routes
// ============================================================================

/** Route: GET /observability/logs - paginated log listing with filtering and sorting. */
export const LIST_LOGS_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/logs',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    logsFilterSchema.extend(paginationArgsSchema.shape).extend(logsOrderBySchema.shape).partial(),
  ),
  responseSchema: listLogsResponseSchema,
  summary: 'List logs',
  description: 'Returns a paginated list of logs with optional filtering and sorting',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const filters = pickParams(logsFilterSchema, params);
      const pagination = pickParams(paginationArgsSchema, params);
      const orderBy = pickParams(logsOrderBySchema, params);

      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.listLogs({ filters, pagination, orderBy });
    } catch (error) {
      return handleError(error, 'Error listing logs');
    }
  },
});

// ============================================================================
// Scores Routes
// ============================================================================

/** Route: GET /observability/scores - paginated score listing with filtering and sorting. */
export const LIST_SCORES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/scores',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    scoresFilterSchema.extend(paginationArgsSchema.shape).extend(scoresOrderBySchema.shape).partial(),
  ),
  responseSchema: obsListScoresResponseSchema,
  summary: 'List scores',
  description: 'Returns a paginated list of scores with optional filtering and sorting',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const filters = pickParams(scoresFilterSchema, params);
      const pagination = pickParams(paginationArgsSchema, params);
      const orderBy = pickParams(scoresOrderBySchema, params);

      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.listScores({ filters, pagination, orderBy });
    } catch (error) {
      return handleError(error, 'Error listing scores');
    }
  },
});

/** Route: POST /observability/scores - create a single score record. */
export const CREATE_SCORE_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/scores',
  responseType: 'json',
  bodySchema: createScoreBodySchema,
  responseSchema: createScoreResponseSchema,
  summary: 'Create a score',
  description: 'Creates a single score record in the observability store',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, score }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      await observabilityStore.createScore({ score: { ...score, timestamp: new Date() } });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error creating score');
    }
  },
});

// ============================================================================
// Feedback Routes
// ============================================================================

/** Route: GET /observability/feedback - paginated feedback listing with filtering and sorting. */
export const LIST_FEEDBACK_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/feedback',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    feedbackFilterSchema.extend(paginationArgsSchema.shape).extend(feedbackOrderBySchema.shape).partial(),
  ),
  responseSchema: listFeedbackResponseSchema,
  summary: 'List feedback',
  description: 'Returns a paginated list of feedback with optional filtering and sorting',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const filters = pickParams(feedbackFilterSchema, params);
      const pagination = pickParams(paginationArgsSchema, params);
      const orderBy = pickParams(feedbackOrderBySchema, params);

      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.listFeedback({ filters, pagination, orderBy });
    } catch (error) {
      return handleError(error, 'Error listing feedback');
    }
  },
});

/** Route: POST /observability/feedback - create a single feedback record. */
export const CREATE_FEEDBACK_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/feedback',
  responseType: 'json',
  bodySchema: createFeedbackBodySchema,
  responseSchema: createFeedbackResponseSchema,
  summary: 'Create feedback',
  description: 'Creates a single feedback record in the observability store',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, feedback }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      await observabilityStore.createFeedback({ feedback: { ...feedback, timestamp: new Date() } });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error creating feedback');
    }
  },
});

// ============================================================================
// Metrics Routes
// ============================================================================

/** Route: POST /observability/metrics/aggregate - aggregated metric with optional comparison. */
export const GET_METRIC_AGGREGATE_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/metrics/aggregate',
  responseType: 'json',
  bodySchema: getMetricAggregateArgsSchema,
  responseSchema: getMetricAggregateResponseSchema,
  summary: 'Get metric aggregate',
  description: 'Returns an aggregated metric value with optional period-over-period comparison',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricAggregateArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricAggregate(args);
    } catch (error) {
      return handleError(error, 'Error getting metric aggregate');
    }
  },
});

/** Route: POST /observability/metrics/breakdown - metric values grouped by dimensions. */
export const GET_METRIC_BREAKDOWN_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/metrics/breakdown',
  responseType: 'json',
  bodySchema: getMetricBreakdownArgsSchema,
  responseSchema: getMetricBreakdownResponseSchema,
  summary: 'Get metric breakdown',
  description: 'Returns metric values grouped by specified dimensions',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricBreakdownArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricBreakdown(args);
    } catch (error) {
      return handleError(error, 'Error getting metric breakdown');
    }
  },
});

/** Route: POST /observability/metrics/timeseries - metric values bucketed by time interval. */
export const GET_METRIC_TIME_SERIES_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/metrics/timeseries',
  responseType: 'json',
  bodySchema: getMetricTimeSeriesArgsSchema,
  responseSchema: getMetricTimeSeriesResponseSchema,
  summary: 'Get metric time series',
  description: 'Returns metric values bucketed by time interval with optional grouping',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricTimeSeriesArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricTimeSeries(args);
    } catch (error) {
      return handleError(error, 'Error getting metric time series');
    }
  },
});

/** Route: POST /observability/metrics/percentiles - percentile values bucketed by time interval. */
export const GET_METRIC_PERCENTILES_ROUTE = createRoute({
  method: 'POST',
  path: '/observability/metrics/percentiles',
  responseType: 'json',
  bodySchema: getMetricPercentilesArgsSchema,
  responseSchema: getMetricPercentilesResponseSchema,
  summary: 'Get metric percentiles',
  description: 'Returns percentile values for a metric bucketed by time interval',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricPercentilesArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricPercentiles(args);
    } catch (error) {
      return handleError(error, 'Error getting metric percentiles');
    }
  },
});

// ============================================================================
// Discovery Routes
// ============================================================================

/** Route: GET /observability/discovery/metric-names - distinct metric names. */
export const GET_METRIC_NAMES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/metric-names',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(getMetricNamesArgsSchema.partial()),
  responseSchema: getMetricNamesResponseSchema,
  summary: 'Get metric names',
  description: 'Returns distinct metric names with optional prefix filtering',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricNamesArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricNames(args);
    } catch (error) {
      return handleError(error, 'Error getting metric names');
    }
  },
});

/** Route: GET /observability/discovery/metric-label-keys - distinct label keys for a metric. */
export const GET_METRIC_LABEL_KEYS_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/metric-label-keys',
  responseType: 'json',
  queryParamSchema: z.object({ metricName: z.string() }),
  responseSchema: getMetricLabelKeysResponseSchema,
  summary: 'Get metric label keys',
  description: 'Returns distinct label keys for a given metric',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricLabelKeysArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricLabelKeys(args);
    } catch (error) {
      return handleError(error, 'Error getting metric label keys');
    }
  },
});

/** Route: GET /observability/discovery/metric-label-values - distinct values for a label key. */
export const GET_METRIC_LABEL_VALUES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/metric-label-values',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(getMetricLabelValuesArgsSchema),
  responseSchema: getMetricLabelValuesResponseSchema,
  summary: 'Get label values',
  description: 'Returns distinct values for a given metric label key',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getMetricLabelValuesArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getMetricLabelValues(args);
    } catch (error) {
      return handleError(error, 'Error getting label values');
    }
  },
});

/** Route: GET /observability/discovery/entity-types - distinct entity types. */
export const GET_ENTITY_TYPES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/entity-types',
  responseType: 'json',
  responseSchema: getEntityTypesResponseSchema,
  summary: 'Get entity types',
  description: 'Returns distinct entity types from observability data',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getEntityTypes({});
    } catch (error) {
      return handleError(error, 'Error getting entity types');
    }
  },
});

/** Route: GET /observability/discovery/entity-names - distinct entity names. */
export const GET_ENTITY_NAMES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/entity-names',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(getEntityNamesArgsSchema.partial()),
  responseSchema: getEntityNamesResponseSchema,
  summary: 'Get entity names',
  description: 'Returns distinct entity names with optional type filtering',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getEntityNamesArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getEntityNames(args);
    } catch (error) {
      return handleError(error, 'Error getting entity names');
    }
  },
});

/** Route: GET /observability/discovery/service-names - distinct service names. */
export const GET_SERVICE_NAMES_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/service-names',
  responseType: 'json',
  responseSchema: getServiceNamesResponseSchema,
  summary: 'Get service names',
  description: 'Returns distinct service names from observability data',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getServiceNames({});
    } catch (error) {
      return handleError(error, 'Error getting service names');
    }
  },
});

/** Route: GET /observability/discovery/environments - distinct environments. */
export const GET_ENVIRONMENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/environments',
  responseType: 'json',
  responseSchema: getEnvironmentsResponseSchema,
  summary: 'Get environments',
  description: 'Returns distinct environments from observability data',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getEnvironments({});
    } catch (error) {
      return handleError(error, 'Error getting environments');
    }
  },
});

/** Route: GET /observability/discovery/tags - distinct tags with optional filtering. */
export const GET_TAGS_ROUTE = createRoute({
  method: 'GET',
  path: '/observability/discovery/tags',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(getTagsArgsSchema.partial()),
  responseSchema: getTagsResponseSchema,
  summary: 'Get tags',
  description: 'Returns distinct tags with optional entity type filtering',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    try {
      const args = pickParams(getTagsArgsSchema, params);
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getTags(args);
    } catch (error) {
      return handleError(error, 'Error getting tags');
    }
  },
});
