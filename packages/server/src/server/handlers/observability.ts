import { createRequire } from 'node:module';
import type { Mastra } from '@mastra/core';
import { listScoresResponseSchema } from '@mastra/core/evals';
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
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import {
  NEW_OBSERVABILITY_UPGRADE_MESSAGE,
  getObservabilityStore,
  getStorage,
  isNewObservabilityAvailable,
} from './observability-shared';

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

// ============================================================================
// New Observability Routes Loader (guarded import)
// ============================================================================

const require = createRequire(import.meta.url);

const upgradeResponseSchema = z.object({ message: z.string() });

function createUpgradeRoute<TMethod extends ServerRoute['method'], TPath extends string>(config: {
  method: TMethod;
  path: TPath;
  summary: string;
  description: string;
  requiresPermission?: ServerRoute['requiresPermission'];
}) {
  return createRoute({
    method: config.method,
    path: config.path,
    responseType: 'json',
    responseSchema: upgradeResponseSchema,
    summary: config.summary,
    description: config.description,
    tags: ['Observability'],
    requiresAuth: true,
    requiresPermission: config.requiresPermission,
    handler: async () => {
      throw new HTTPException(501, { message: NEW_OBSERVABILITY_UPGRADE_MESSAGE });
    },
  });
}

function buildUpgradeObservabilityExports() {
  const LIST_LOGS_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/logs',
    summary: 'List logs',
    description: 'Returns a paginated list of logs with optional filtering and sorting',
  });

  const LIST_SCORES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/scores',
    summary: 'List scores',
    description: 'Returns a paginated list of scores with optional filtering and sorting',
  });

  const CREATE_SCORE_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/scores',
    summary: 'Create a score',
    description: 'Creates a single score record in the observability store',
  });

  const LIST_FEEDBACK_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/feedback',
    summary: 'List feedback',
    description: 'Returns a paginated list of feedback with optional filtering and sorting',
  });

  const CREATE_FEEDBACK_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/feedback',
    summary: 'Create feedback',
    description: 'Creates a single feedback record in the observability store',
  });

  const GET_METRIC_AGGREGATE_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/metrics/aggregate',
    summary: 'Get metric aggregate',
    description: 'Returns an aggregated metric value with optional period-over-period comparison',
    requiresPermission: 'observability:read',
  });

  const GET_METRIC_BREAKDOWN_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/metrics/breakdown',
    summary: 'Get metric breakdown',
    description: 'Returns metric values grouped by specified dimensions',
    requiresPermission: 'observability:read',
  });

  const GET_METRIC_TIME_SERIES_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/metrics/timeseries',
    summary: 'Get metric time series',
    description: 'Returns metric values bucketed by time interval with optional grouping',
    requiresPermission: 'observability:read',
  });

  const GET_METRIC_PERCENTILES_ROUTE = createUpgradeRoute({
    method: 'POST',
    path: '/observability/metrics/percentiles',
    summary: 'Get metric percentiles',
    description: 'Returns percentile values for a metric bucketed by time interval',
    requiresPermission: 'observability:read',
  });

  const GET_METRIC_NAMES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/metric-names',
    summary: 'Get metric names',
    description: 'Returns distinct metric names with optional prefix filtering',
  });

  const GET_METRIC_LABEL_KEYS_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/metric-label-keys',
    summary: 'Get metric label keys',
    description: 'Returns distinct label keys for a given metric',
  });

  const GET_METRIC_LABEL_VALUES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/metric-label-values',
    summary: 'Get label values',
    description: 'Returns distinct values for a given metric label key',
  });

  const GET_ENTITY_TYPES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/entity-types',
    summary: 'Get entity types',
    description: 'Returns distinct entity types from observability data',
  });

  const GET_ENTITY_NAMES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/entity-names',
    summary: 'Get entity names',
    description: 'Returns distinct entity names with optional type filtering',
  });

  const GET_SERVICE_NAMES_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/service-names',
    summary: 'Get service names',
    description: 'Returns distinct service names from observability data',
  });

  const GET_ENVIRONMENTS_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/environments',
    summary: 'Get environments',
    description: 'Returns distinct environments from observability data',
  });

  const GET_TAGS_ROUTE = createUpgradeRoute({
    method: 'GET',
    path: '/observability/discovery/tags',
    summary: 'Get tags',
    description: 'Returns distinct tags with optional entity type filtering',
  });

  const NEW_OBSERVABILITY_ROUTES = [
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

  return {
    LIST_LOGS_ROUTE,
    LIST_SCORES_ROUTE,
    CREATE_SCORE_ROUTE,
    LIST_FEEDBACK_ROUTE,
    CREATE_FEEDBACK_ROUTE,
    GET_METRIC_AGGREGATE_ROUTE,
    GET_METRIC_BREAKDOWN_ROUTE,
    GET_METRIC_TIME_SERIES_ROUTE,
    GET_METRIC_PERCENTILES_ROUTE,
    GET_METRIC_NAMES_ROUTE,
    GET_METRIC_LABEL_KEYS_ROUTE,
    GET_METRIC_LABEL_VALUES_ROUTE,
    GET_ENTITY_TYPES_ROUTE,
    GET_ENTITY_NAMES_ROUTE,
    GET_SERVICE_NAMES_ROUTE,
    GET_ENVIRONMENTS_ROUTE,
    GET_TAGS_ROUTE,
    NEW_OBSERVABILITY_ROUTES,
  } as const;
}

function loadNewObservabilityExports(): NewObservabilityExports {
  if (!isNewObservabilityAvailable()) {
    return buildUpgradeObservabilityExports();
  }

  try {
    return require('./observability-new-endpoints') as NewObservabilityExports;
  } catch {
    return buildUpgradeObservabilityExports();
  }
}

type NewObservabilityExports = ReturnType<typeof buildUpgradeObservabilityExports>;
type NewObservabilityRoutes = NewObservabilityExports['NEW_OBSERVABILITY_ROUTES'];

const newObservabilityExports = loadNewObservabilityExports();

export const LIST_LOGS_ROUTE = newObservabilityExports.LIST_LOGS_ROUTE;
export const LIST_SCORES_ROUTE = newObservabilityExports.LIST_SCORES_ROUTE;
export const CREATE_SCORE_ROUTE = newObservabilityExports.CREATE_SCORE_ROUTE;
export const LIST_FEEDBACK_ROUTE = newObservabilityExports.LIST_FEEDBACK_ROUTE;
export const CREATE_FEEDBACK_ROUTE = newObservabilityExports.CREATE_FEEDBACK_ROUTE;
export const GET_METRIC_AGGREGATE_ROUTE = newObservabilityExports.GET_METRIC_AGGREGATE_ROUTE;
export const GET_METRIC_BREAKDOWN_ROUTE = newObservabilityExports.GET_METRIC_BREAKDOWN_ROUTE;
export const GET_METRIC_TIME_SERIES_ROUTE = newObservabilityExports.GET_METRIC_TIME_SERIES_ROUTE;
export const GET_METRIC_PERCENTILES_ROUTE = newObservabilityExports.GET_METRIC_PERCENTILES_ROUTE;
export const GET_METRIC_NAMES_ROUTE = newObservabilityExports.GET_METRIC_NAMES_ROUTE;
export const GET_METRIC_LABEL_KEYS_ROUTE = newObservabilityExports.GET_METRIC_LABEL_KEYS_ROUTE;
export const GET_METRIC_LABEL_VALUES_ROUTE = newObservabilityExports.GET_METRIC_LABEL_VALUES_ROUTE;
export const GET_ENTITY_TYPES_ROUTE = newObservabilityExports.GET_ENTITY_TYPES_ROUTE;
export const GET_ENTITY_NAMES_ROUTE = newObservabilityExports.GET_ENTITY_NAMES_ROUTE;
export const GET_SERVICE_NAMES_ROUTE = newObservabilityExports.GET_SERVICE_NAMES_ROUTE;
export const GET_ENVIRONMENTS_ROUTE = newObservabilityExports.GET_ENVIRONMENTS_ROUTE;
export const GET_TAGS_ROUTE = newObservabilityExports.GET_TAGS_ROUTE;
export const NEW_OBSERVABILITY_ROUTES = newObservabilityExports.NEW_OBSERVABILITY_ROUTES as NewObservabilityRoutes;

const LEGACY_OBSERVABILITY_ROUTES = [
  // Traces
  LIST_TRACES_ROUTE,
  GET_TRACE_ROUTE,
  SCORE_TRACES_ROUTE,
  LIST_SCORES_BY_SPAN_ROUTE,
] as const;

export const OBSERVABILITY_ROUTES = [...LEGACY_OBSERVABILITY_ROUTES, ...NEW_OBSERVABILITY_ROUTES] as const;

export type ObservabilityRoutes = typeof OBSERVABILITY_ROUTES;

export function getObservabilityRoutes(): ObservabilityRoutes {
  return OBSERVABILITY_ROUTES;
}
