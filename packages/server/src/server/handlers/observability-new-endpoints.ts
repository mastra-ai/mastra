import {
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
  paginationArgsSchema,
} from '@mastra/core/storage';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { assertNewObservabilityAvailable, getObservabilityStore } from './observability-shared';

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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
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
  requiresPermission: 'observability:read',
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
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
  requiresPermission: 'observability:read',
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
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
  requiresPermission: 'observability:read',
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
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
  requiresPermission: 'observability:read',
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
    try {
      const args = getMetricNamesArgsSchema.parse(pickParams(getMetricNamesArgsSchema, params));
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
  // Required query params; do not use partial().
  queryParamSchema: wrapSchemaForQueryParams(getMetricLabelKeysArgsSchema),
  responseSchema: getMetricLabelKeysResponseSchema,
  summary: 'Get metric label keys',
  description: 'Returns distinct label keys for a given metric',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
    try {
      const args = getMetricLabelKeysArgsSchema.parse(pickParams(getMetricLabelKeysArgsSchema, params));
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
  // Required query params; do not use partial().
  queryParamSchema: wrapSchemaForQueryParams(getMetricLabelValuesArgsSchema),
  responseSchema: getMetricLabelValuesResponseSchema,
  summary: 'Get label values',
  description: 'Returns distinct values for a given metric label key',
  tags: ['Observability'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    assertNewObservabilityAvailable();
    try {
      const args = getMetricLabelValuesArgsSchema.parse(pickParams(getMetricLabelValuesArgsSchema, params));
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
    try {
      const args = getEntityNamesArgsSchema.parse(pickParams(getEntityNamesArgsSchema, params));
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
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
    assertNewObservabilityAvailable();
    try {
      const args = getTagsArgsSchema.parse(pickParams(getTagsArgsSchema, params));
      const observabilityStore = await getObservabilityStore(mastra);
      return await observabilityStore.getTags(args);
    } catch (error) {
      return handleError(error, 'Error getting tags');
    }
  },
});

export const NEW_OBSERVABILITY_ROUTES = [
  // Logs
  LIST_LOGS_ROUTE,
  // Scores (observability storage)
  LIST_SCORES_ROUTE,
  CREATE_SCORE_ROUTE,
  // Feedback
  LIST_FEEDBACK_ROUTE,
  CREATE_FEEDBACK_ROUTE,
  // Metrics
  GET_METRIC_AGGREGATE_ROUTE,
  GET_METRIC_BREAKDOWN_ROUTE,
  GET_METRIC_TIME_SERIES_ROUTE,
  GET_METRIC_PERCENTILES_ROUTE,
  // Discovery
  GET_METRIC_NAMES_ROUTE,
  GET_METRIC_LABEL_KEYS_ROUTE,
  GET_METRIC_LABEL_VALUES_ROUTE,
  GET_ENTITY_TYPES_ROUTE,
  GET_ENTITY_NAMES_ROUTE,
  GET_SERVICE_NAMES_ROUTE,
  GET_ENVIRONMENTS_ROUTE,
  GET_TAGS_ROUTE,
] as const;
