import {
  // Metrics list
  metricsFilterSchema,
  metricsOrderBySchema,
  listMetricsResponseSchema,
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
  scoreRecordSchema,
  getScoreAggregateArgsSchema,
  getScoreAggregateResponseSchema,
  getScoreBreakdownArgsSchema,
  getScoreBreakdownResponseSchema,
  getScoreTimeSeriesArgsSchema,
  getScoreTimeSeriesResponseSchema,
  getScorePercentilesArgsSchema,
  getScorePercentilesResponseSchema,
  // Feedback
  feedbackFilterSchema,
  feedbackOrderBySchema,
  listFeedbackResponseSchema,
  createFeedbackBodySchema,
  createFeedbackResponseSchema,
  getFeedbackAggregateArgsSchema,
  getFeedbackAggregateResponseSchema,
  getFeedbackBreakdownArgsSchema,
  getFeedbackBreakdownResponseSchema,
  getFeedbackTimeSeriesArgsSchema,
  getFeedbackTimeSeriesResponseSchema,
  getFeedbackPercentilesArgsSchema,
  getFeedbackPercentilesResponseSchema,
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
} from '@internal/core/storage';
import { coreFeatures } from '@mastra/core/features';
import { generateSignalId } from '@mastra/core/observability';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import type { InferParams, ServerContext, ServerRouteHandler } from '../server-adapter/routes';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { paginationArgsSchema } from './observability-list-query-schemas';
import {
  assertObservabilityDeltaSupported,
  createObservabilityListQuerySchema,
  getObservabilityStore,
  NEW_ROUTE_DEFS,
  OBSERVABILITY_LIST_ENDPOINTS,
} from './observability-shared';
import type { RouteDetails } from './observability-shared';

function createNewRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
>(
  def: RouteDetails,
  config: {
    pathParamSchema?: TPathSchema;
    queryParamSchema?: TQuerySchema;
    bodySchema?: TBodySchema;
    responseSchema?: TResponseSchema;
    handler: ServerRouteHandler<InferParams<TPathSchema, TQuerySchema, TBodySchema>>;
  },
) {
  const { handler, ...schemas } = config;
  return createRoute({
    ...def,
    ...schemas,
    responseType: 'json' as const,
    tags: ['Observability'],
    requiresAuth: true,
    handler: (async (params: InferParams<TPathSchema, TQuerySchema, TBodySchema> & ServerContext) => {
      try {
        if (!coreFeatures.has('observability:v1.13.2')) {
          throw new HTTPException(501, {
            message: 'New observability endpoints require @mastra/core >= 1.13.2, please upgrade.',
          });
        }

        return await handler(params);
      } catch (error) {
        return handleError(error, `Error calling: '${def.summary.toLocaleLowerCase()}'`);
      }
    }) as ServerRouteHandler<
      InferParams<TPathSchema, TQuerySchema, TBodySchema>,
      TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
      'json'
    >,
  });
}

// ============================================================================
// Log Routes
// ============================================================================

export const LIST_LOGS = createNewRoute(NEW_ROUTE_DEFS.LIST_LOGS, {
  queryParamSchema: createObservabilityListQuerySchema(logsFilterSchema, logsOrderBySchema),
  responseSchema: listLogsResponseSchema,
  handler: async ({ mastra, mode, after, limit, ...params }) => {
    const filters = pickParams(logsFilterSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);

    if (mode === 'delta') {
      assertObservabilityDeltaSupported(observabilityStore, OBSERVABILITY_LIST_ENDPOINTS.logs);
      return await observabilityStore.listLogs({
        mode,
        filters,
        after: typeof after === 'string' ? after : undefined,
        limit,
      });
    }

    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(logsOrderBySchema, params);
    return await observabilityStore.listLogs(
      mode === 'page' ? { mode, filters, pagination, orderBy } : { filters, pagination, orderBy },
    );
  },
});

// ============================================================================
// Score Routes
// ============================================================================

export const LIST_SCORES = createNewRoute(NEW_ROUTE_DEFS.LIST_SCORES, {
  queryParamSchema: createObservabilityListQuerySchema(scoresFilterSchema, scoresOrderBySchema),
  responseSchema: obsListScoresResponseSchema,
  handler: async ({ mastra, mode, after, limit, ...params }) => {
    const filters = pickParams(scoresFilterSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);

    if (mode === 'delta') {
      assertObservabilityDeltaSupported(observabilityStore, OBSERVABILITY_LIST_ENDPOINTS.scores);
      return await observabilityStore.listScores({
        mode,
        filters,
        after: typeof after === 'string' ? after : undefined,
        limit,
      });
    }

    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(scoresOrderBySchema, params);
    return await observabilityStore.listScores(
      mode === 'page' ? { mode, filters, pagination, orderBy } : { filters, pagination, orderBy },
    );
  },
});

export const CREATE_SCORE = createNewRoute(NEW_ROUTE_DEFS.CREATE_SCORE, {
  bodySchema: createScoreBodySchema,
  responseSchema: createScoreResponseSchema,
  handler: async ({ mastra, score }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    await observabilityStore.createScore({
      score: { ...score, scoreId: score.scoreId ?? generateSignalId(), timestamp: new Date() },
    });
    return { success: true };
  },
});

export const GET_SCORE = createNewRoute(NEW_ROUTE_DEFS.GET_SCORE, {
  pathParamSchema: z.object({ scoreId: z.string() }),
  responseSchema: z.object({ score: scoreRecordSchema.nullable() }),
  handler: async ({ mastra, scoreId }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    const score = await observabilityStore.getScoreById(scoreId);
    return { score: score ?? null };
  },
});

export const GET_SCORE_AGGREGATE = createNewRoute(NEW_ROUTE_DEFS.GET_SCORE_AGGREGATE, {
  bodySchema: getScoreAggregateArgsSchema,
  responseSchema: getScoreAggregateResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getScoreAggregateArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getScoreAggregate(args);
  },
});

export const GET_SCORE_BREAKDOWN = createNewRoute(NEW_ROUTE_DEFS.GET_SCORE_BREAKDOWN, {
  bodySchema: getScoreBreakdownArgsSchema,
  responseSchema: getScoreBreakdownResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getScoreBreakdownArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getScoreBreakdown(args);
  },
});

export const GET_SCORE_TIME_SERIES = createNewRoute(NEW_ROUTE_DEFS.GET_SCORE_TIME_SERIES, {
  bodySchema: getScoreTimeSeriesArgsSchema,
  responseSchema: getScoreTimeSeriesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getScoreTimeSeriesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getScoreTimeSeries(args);
  },
});

export const GET_SCORE_PERCENTILES = createNewRoute(NEW_ROUTE_DEFS.GET_SCORE_PERCENTILES, {
  bodySchema: getScorePercentilesArgsSchema,
  responseSchema: getScorePercentilesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getScorePercentilesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getScorePercentiles(args);
  },
});

// ============================================================================
// Feedback Routes
// ============================================================================

export const LIST_FEEDBACK = createNewRoute(NEW_ROUTE_DEFS.LIST_FEEDBACK, {
  queryParamSchema: createObservabilityListQuerySchema(feedbackFilterSchema, feedbackOrderBySchema),
  responseSchema: listFeedbackResponseSchema,
  handler: async ({ mastra, mode, after, limit, ...params }) => {
    const filters = pickParams(feedbackFilterSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);

    if (mode === 'delta') {
      assertObservabilityDeltaSupported(observabilityStore, OBSERVABILITY_LIST_ENDPOINTS.feedback);
      return await observabilityStore.listFeedback({
        mode,
        filters,
        after: typeof after === 'string' ? after : undefined,
        limit,
      });
    }

    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(feedbackOrderBySchema, params);
    return await observabilityStore.listFeedback(
      mode === 'page' ? { mode, filters, pagination, orderBy } : { filters, pagination, orderBy },
    );
  },
});

export const CREATE_FEEDBACK = createNewRoute(NEW_ROUTE_DEFS.CREATE_FEEDBACK, {
  bodySchema: createFeedbackBodySchema,
  responseSchema: createFeedbackResponseSchema,
  handler: async ({ mastra, feedback }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    await observabilityStore.createFeedback({
      feedback: { ...feedback, feedbackId: feedback.feedbackId ?? generateSignalId(), timestamp: new Date() },
    });
    return { success: true };
  },
});

export const GET_FEEDBACK_AGGREGATE = createNewRoute(NEW_ROUTE_DEFS.GET_FEEDBACK_AGGREGATE, {
  bodySchema: getFeedbackAggregateArgsSchema,
  responseSchema: getFeedbackAggregateResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getFeedbackAggregateArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getFeedbackAggregate(args);
  },
});

export const GET_FEEDBACK_BREAKDOWN = createNewRoute(NEW_ROUTE_DEFS.GET_FEEDBACK_BREAKDOWN, {
  bodySchema: getFeedbackBreakdownArgsSchema,
  responseSchema: getFeedbackBreakdownResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getFeedbackBreakdownArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getFeedbackBreakdown(args);
  },
});

export const GET_FEEDBACK_TIME_SERIES = createNewRoute(NEW_ROUTE_DEFS.GET_FEEDBACK_TIME_SERIES, {
  bodySchema: getFeedbackTimeSeriesArgsSchema,
  responseSchema: getFeedbackTimeSeriesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getFeedbackTimeSeriesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getFeedbackTimeSeries(args);
  },
});

export const GET_FEEDBACK_PERCENTILES = createNewRoute(NEW_ROUTE_DEFS.GET_FEEDBACK_PERCENTILES, {
  bodySchema: getFeedbackPercentilesArgsSchema,
  responseSchema: getFeedbackPercentilesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getFeedbackPercentilesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getFeedbackPercentiles(args);
  },
});

// ============================================================================
// Metrics Routes
// ============================================================================

export const LIST_METRICS = createNewRoute(NEW_ROUTE_DEFS.LIST_METRICS, {
  queryParamSchema: createObservabilityListQuerySchema(metricsFilterSchema, metricsOrderBySchema),
  responseSchema: listMetricsResponseSchema,
  handler: async ({ mastra, mode, after, limit, ...params }) => {
    const filters = pickParams(metricsFilterSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);

    if (mode === 'delta') {
      assertObservabilityDeltaSupported(observabilityStore, OBSERVABILITY_LIST_ENDPOINTS.metrics);
      return await observabilityStore.listMetrics({
        mode,
        filters,
        after: typeof after === 'string' ? after : undefined,
        limit,
      });
    }

    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(metricsOrderBySchema, params);
    return await observabilityStore.listMetrics(
      mode === 'page' ? { mode, filters, pagination, orderBy } : { filters, pagination, orderBy },
    );
  },
});

export const GET_METRIC_AGGREGATE = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_AGGREGATE, {
  bodySchema: getMetricAggregateArgsSchema,
  responseSchema: getMetricAggregateResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getMetricAggregateArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricAggregate(args);
  },
});

export const GET_METRIC_BREAKDOWN = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_BREAKDOWN, {
  bodySchema: getMetricBreakdownArgsSchema,
  responseSchema: getMetricBreakdownResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getMetricBreakdownArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricBreakdown(args);
  },
});

export const GET_METRIC_TIME_SERIES = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_TIME_SERIES, {
  bodySchema: getMetricTimeSeriesArgsSchema,
  responseSchema: getMetricTimeSeriesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getMetricTimeSeriesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricTimeSeries(args);
  },
});

export const GET_METRIC_PERCENTILES = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_PERCENTILES, {
  bodySchema: getMetricPercentilesArgsSchema,
  responseSchema: getMetricPercentilesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = pickParams(getMetricPercentilesArgsSchema, params);
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricPercentiles(args);
  },
});

// ============================================================================
// Discovery Routes
// ============================================================================

export const GET_METRIC_NAMES = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_NAMES, {
  queryParamSchema: wrapSchemaForQueryParams(getMetricNamesArgsSchema.partial()),
  responseSchema: getMetricNamesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = getMetricNamesArgsSchema.parse(pickParams(getMetricNamesArgsSchema, params));
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricNames(args);
  },
});

export const GET_METRIC_LABEL_KEYS = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_LABEL_KEYS, {
  queryParamSchema: wrapSchemaForQueryParams(getMetricLabelKeysArgsSchema),
  responseSchema: getMetricLabelKeysResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = getMetricLabelKeysArgsSchema.parse(pickParams(getMetricLabelKeysArgsSchema, params));
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricLabelKeys(args);
  },
});

export const GET_METRIC_LABEL_VALUES = createNewRoute(NEW_ROUTE_DEFS.GET_METRIC_LABEL_VALUES, {
  queryParamSchema: wrapSchemaForQueryParams(getMetricLabelValuesArgsSchema),
  responseSchema: getMetricLabelValuesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = getMetricLabelValuesArgsSchema.parse(pickParams(getMetricLabelValuesArgsSchema, params));
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getMetricLabelValues(args);
  },
});

export const GET_ENTITY_TYPES = createNewRoute(NEW_ROUTE_DEFS.GET_ENTITY_TYPES, {
  responseSchema: getEntityTypesResponseSchema,
  handler: async ({ mastra }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getEntityTypes({});
  },
});

export const GET_ENTITY_NAMES = createNewRoute(NEW_ROUTE_DEFS.GET_ENTITY_NAMES, {
  queryParamSchema: wrapSchemaForQueryParams(getEntityNamesArgsSchema.partial()),
  responseSchema: getEntityNamesResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = getEntityNamesArgsSchema.parse(pickParams(getEntityNamesArgsSchema, params));
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getEntityNames(args);
  },
});

export const GET_SERVICE_NAMES = createNewRoute(NEW_ROUTE_DEFS.GET_SERVICE_NAMES, {
  responseSchema: getServiceNamesResponseSchema,
  handler: async ({ mastra }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getServiceNames({});
  },
});

export const GET_ENVIRONMENTS = createNewRoute(NEW_ROUTE_DEFS.GET_ENVIRONMENTS, {
  responseSchema: getEnvironmentsResponseSchema,
  handler: async ({ mastra }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.getEnvironments({});
  },
});

export const GET_TAGS = createNewRoute(NEW_ROUTE_DEFS.GET_TAGS, {
  queryParamSchema: wrapSchemaForQueryParams(getTagsArgsSchema.partial()),
  responseSchema: getTagsResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const args = getTagsArgsSchema.parse(pickParams(getTagsArgsSchema, params));
    const observabilityStore = await getObservabilityStore(mastra);
    try {
      return await observabilityStore.getTags(args);
    } catch (error) {
      // Some storage providers (e.g. LibSQL) don't support tag discovery
      if (error instanceof Error && error.message.includes('does not support tag discovery')) {
        return { tags: [] };
      }
      throw error;
    }
  },
});

export const NEW_ROUTES = {
  LIST_LOGS,
  LIST_SCORES,
  CREATE_SCORE,
  GET_SCORE,
  GET_SCORE_AGGREGATE,
  GET_SCORE_BREAKDOWN,
  GET_SCORE_TIME_SERIES,
  GET_SCORE_PERCENTILES,
  LIST_FEEDBACK,
  CREATE_FEEDBACK,
  GET_FEEDBACK_AGGREGATE,
  GET_FEEDBACK_BREAKDOWN,
  GET_FEEDBACK_TIME_SERIES,
  GET_FEEDBACK_PERCENTILES,
  LIST_METRICS,
  GET_METRIC_AGGREGATE,
  GET_METRIC_BREAKDOWN,
  GET_METRIC_TIME_SERIES,
  GET_METRIC_PERCENTILES,
  GET_METRIC_NAMES,
  GET_METRIC_LABEL_KEYS,
  GET_METRIC_LABEL_VALUES,
  GET_ENTITY_TYPES,
  GET_ENTITY_NAMES,
  GET_SERVICE_NAMES,
  GET_ENVIRONMENTS,
  GET_TAGS,
};
