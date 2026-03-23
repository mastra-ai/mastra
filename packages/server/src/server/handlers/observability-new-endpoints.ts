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
} from '@internal/core/storage';
import { coreFeatures } from '@mastra/core/features';
import type { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import type { InferParams, ServerContext, ServerRouteHandler } from '../server-adapter/routes';
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
import { getObservabilityStore, NEW_ROUTE_DEFS } from './observability-shared';
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
      if (!coreFeatures.has('observability:v1.13.2')) {
        throw new HTTPException(501, {
          message: 'New observability endpoints require @mastra/core >= 1.13.3, please upgrade.',
        });
      }

      try {
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
  queryParamSchema: wrapSchemaForQueryParams(
    logsFilterSchema.extend(paginationArgsSchema.shape).extend(logsOrderBySchema.shape).partial(),
  ),
  responseSchema: listLogsResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const filters = pickParams(logsFilterSchema, params);
    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(logsOrderBySchema, params);

    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.listLogs({ filters, pagination, orderBy });
  },
});

// ============================================================================
// Score Routes
// ============================================================================

export const LIST_SCORES = createNewRoute(NEW_ROUTE_DEFS.LIST_SCORES, {
  queryParamSchema: wrapSchemaForQueryParams(
    scoresFilterSchema.extend(paginationArgsSchema.shape).extend(scoresOrderBySchema.shape).partial(),
  ),
  responseSchema: obsListScoresResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const filters = pickParams(scoresFilterSchema, params);
    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(scoresOrderBySchema, params);

    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.listScores({ filters, pagination, orderBy });
  },
});

export const CREATE_SCORE = createNewRoute(NEW_ROUTE_DEFS.CREATE_SCORE, {
  bodySchema: createScoreBodySchema,
  responseSchema: createScoreResponseSchema,
  handler: async ({ mastra, score }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    await observabilityStore.createScore({ score: { ...score, timestamp: new Date() } });
    return { success: true };
  },
});

// ============================================================================
// Feedback Routes
// ============================================================================

export const LIST_FEEDBACK = createNewRoute(NEW_ROUTE_DEFS.LIST_FEEDBACK, {
  queryParamSchema: wrapSchemaForQueryParams(
    feedbackFilterSchema.extend(paginationArgsSchema.shape).extend(feedbackOrderBySchema.shape).partial(),
  ),
  responseSchema: listFeedbackResponseSchema,
  handler: async ({ mastra, ...params }) => {
    const filters = pickParams(feedbackFilterSchema, params);
    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(feedbackOrderBySchema, params);

    const observabilityStore = await getObservabilityStore(mastra);
    return await observabilityStore.listFeedback({ filters, pagination, orderBy });
  },
});

export const CREATE_FEEDBACK = createNewRoute(NEW_ROUTE_DEFS.CREATE_FEEDBACK, {
  bodySchema: createFeedbackBodySchema,
  responseSchema: createFeedbackResponseSchema,
  handler: async ({ mastra, feedback }) => {
    const observabilityStore = await getObservabilityStore(mastra);
    await observabilityStore.createFeedback({ feedback: { ...feedback, timestamp: new Date() } });
    return { success: true };
  },
});

// ============================================================================
// Metrics Routes
// ============================================================================

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
    return await observabilityStore.getTags(args);
  },
});

export const NEW_ROUTES = {
  LIST_LOGS,
  LIST_SCORES,
  CREATE_SCORE,
  LIST_FEEDBACK,
  CREATE_FEEDBACK,
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
