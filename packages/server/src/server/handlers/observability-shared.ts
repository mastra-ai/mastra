import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import type { MastraCompositeStore, ObservabilityStorage } from '@mastra/core/storage';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';
import { wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import {
  deltaCursorSchema,
  deltaLimitSchema,
  listModeSchema,
  paginationArgsSchema,
} from './observability-list-query-schemas';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';
export const OBSERVABILITY_DELTA_POLLING_UPGRADE_MESSAGE =
  'Delta polling requires a newer @mastra/core with observability delta polling support. Please upgrade.';

export const OBSERVABILITY_LIST_ENDPOINTS = {
  traces: 'traces',
  branches: 'branches',
  logs: 'logs',
  metrics: 'metrics',
  scores: 'scores',
  feedback: 'feedback',
} as const;

export type ObservabilityListEndpoint =
  (typeof OBSERVABILITY_LIST_ENDPOINTS)[keyof typeof OBSERVABILITY_LIST_ENDPOINTS];
const OBSERVABILITY_DELTA_POLLING_STORAGE_FEATURE = 'delta-polling';

function getFeatures(observabilityStore: ObservabilityStorage): readonly string[] | undefined {
  const candidate = observabilityStore as ObservabilityStorage & {
    getFeatures?: () => readonly string[] | undefined;
  };
  return candidate.getFeatures?.();
}

/** Retrieves MastraCompositeStore or throws 500 if unavailable. */
export function getStorage(mastra: Mastra): MastraCompositeStore {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

/** Retrieves the observability storage domain or throws 501 if unavailable. */
export async function getObservabilityStore(mastra: Mastra): Promise<ObservabilityStorage> {
  const storage = getStorage(mastra);
  const observability = await storage.getStore('observability');
  if (!observability) {
    // 501, not 500: a missing or explicitly disabled observability domain
    // (e.g. `domains: { observability: false }`) is a capability gap, not a
    // server failure. Matches the 501s used for other capability gaps (see
    // assertObservabilityDeltaSupported below); Studio treats 501 as
    // non-retryable and stops polling.
    throw new HTTPException(501, { message: 'Observability storage domain is not available' });
  }
  return observability;
}

export function assertObservabilityDeltaSupported(
  observabilityStore: ObservabilityStorage,
  endpoint: ObservabilityListEndpoint,
) {
  if (!coreFeatures.has(OBSERVABILITY_DELTA_POLLING_FEATURE)) {
    throw new HTTPException(501, {
      message: `${OBSERVABILITY_DELTA_POLLING_UPGRADE_MESSAGE} (endpoint: ${endpoint})`,
    });
  }

  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_DELTA_POLLING_STORAGE_FEATURE)) {
    return;
  }

  throw new HTTPException(501, {
    message: `Delta polling is not supported by the configured observability store for ${endpoint}`,
  });
}

export interface RouteDetails {
  method: ServerRoute['method'];
  path: `/${string}`;
  summary: string;
  description: string;
  requiresPermission?: ServerRoute['requiresPermission'];
}

export const NEW_ROUTE_DEFS = {
  LIST_METRICS: {
    method: 'GET',
    path: '/observability/metrics',
    summary: 'List metrics',
    description: 'Returns a paginated list of metrics with optional filtering and sorting',
  },

  LIST_LOGS: {
    method: 'GET',
    path: '/observability/logs',
    summary: 'List logs',
    description: 'Returns a paginated list of logs with optional filtering and sorting',
  },

  LIST_SCORES: {
    method: 'GET',
    path: '/observability/scores',
    summary: 'List scores',
    description: 'Returns a paginated list of scores with optional filtering and sorting',
  },

  CREATE_SCORE: {
    method: 'POST',
    path: '/observability/scores',
    summary: 'Create a score',
    description: 'Creates a single score record in the observability store',
  },

  GET_SCORE: {
    method: 'GET',
    path: '/observability/scores/:scoreId',
    summary: 'Get score',
    description: 'Returns a single score by scoreId',
  },

  GET_SCORE_AGGREGATE: {
    method: 'POST',
    path: '/observability/scores/aggregate',
    summary: 'Get score aggregate',
    description: 'Returns an aggregated score value with optional period-over-period comparison',
    requiresPermission: 'observability:read',
  },

  GET_SCORE_BREAKDOWN: {
    method: 'POST',
    path: '/observability/scores/breakdown',
    summary: 'Get score breakdown',
    description: 'Returns score values grouped by specified dimensions',
    requiresPermission: 'observability:read',
  },

  GET_SCORE_TIME_SERIES: {
    method: 'POST',
    path: '/observability/scores/timeseries',
    summary: 'Get score time series',
    description: 'Returns score values bucketed by time interval with optional grouping',
    requiresPermission: 'observability:read',
  },

  GET_SCORE_PERCENTILES: {
    method: 'POST',
    path: '/observability/scores/percentiles',
    summary: 'Get score percentiles',
    description: 'Returns percentile values for a score bucketed by time interval',
    requiresPermission: 'observability:read',
  },

  LIST_FEEDBACK: {
    method: 'GET',
    path: '/observability/feedback',
    summary: 'List feedback',
    description: 'Returns a paginated list of feedback with optional filtering and sorting',
  },

  CREATE_FEEDBACK: {
    method: 'POST',
    path: '/observability/feedback',
    summary: 'Create feedback',
    description: 'Creates a single feedback record in the observability store',
  },

  GET_FEEDBACK_AGGREGATE: {
    method: 'POST',
    path: '/observability/feedback/aggregate',
    summary: 'Get feedback aggregate',
    description: 'Returns an aggregated numeric feedback value with optional period-over-period comparison',
    requiresPermission: 'observability:read',
  },

  GET_FEEDBACK_BREAKDOWN: {
    method: 'POST',
    path: '/observability/feedback/breakdown',
    summary: 'Get feedback breakdown',
    description: 'Returns numeric feedback values grouped by specified dimensions',
    requiresPermission: 'observability:read',
  },

  GET_FEEDBACK_TIME_SERIES: {
    method: 'POST',
    path: '/observability/feedback/timeseries',
    summary: 'Get feedback time series',
    description: 'Returns numeric feedback values bucketed by time interval with optional grouping',
    requiresPermission: 'observability:read',
  },

  GET_FEEDBACK_PERCENTILES: {
    method: 'POST',
    path: '/observability/feedback/percentiles',
    summary: 'Get feedback percentiles',
    description: 'Returns percentile values for numeric feedback bucketed by time interval',
    requiresPermission: 'observability:read',
  },

  GET_METRIC_AGGREGATE: {
    method: 'POST',
    path: '/observability/metrics/aggregate',
    summary: 'Get metric aggregate',
    description: 'Returns an aggregated metric value with optional period-over-period comparison',
    requiresPermission: 'observability:read',
  },

  GET_METRIC_BREAKDOWN: {
    method: 'POST',
    path: '/observability/metrics/breakdown',
    summary: 'Get metric breakdown',
    description: 'Returns metric values grouped by specified dimensions',
    requiresPermission: 'observability:read',
  },

  GET_METRIC_TIME_SERIES: {
    method: 'POST',
    path: '/observability/metrics/timeseries',
    summary: 'Get metric time series',
    description: 'Returns metric values bucketed by time interval with optional grouping',
    requiresPermission: 'observability:read',
  },

  GET_METRIC_PERCENTILES: {
    method: 'POST',
    path: '/observability/metrics/percentiles',
    summary: 'Get metric percentiles',
    description: 'Returns percentile values for a metric bucketed by time interval',
    requiresPermission: 'observability:read',
  },

  GET_METRIC_NAMES: {
    method: 'GET',
    path: '/observability/discovery/metric-names',
    summary: 'Get metric names',
    description: 'Returns distinct metric names with optional prefix filtering',
  },

  GET_METRIC_LABEL_KEYS: {
    method: 'GET',
    path: '/observability/discovery/metric-label-keys',
    summary: 'Get metric label keys',
    description: 'Returns distinct label keys for a given metric',
  },

  GET_METRIC_LABEL_VALUES: {
    method: 'GET',
    path: '/observability/discovery/metric-label-values',
    summary: 'Get label values',
    description: 'Returns distinct values for a given metric label key',
  },

  GET_ENTITY_TYPES: {
    method: 'GET',
    path: '/observability/discovery/entity-types',
    summary: 'Get entity types',
    description: 'Returns distinct entity types from observability data',
  },

  GET_ENTITY_NAMES: {
    method: 'GET',
    path: '/observability/discovery/entity-names',
    summary: 'Get entity names',
    description: 'Returns distinct entity names with optional type filtering',
  },

  GET_SERVICE_NAMES: {
    method: 'GET',
    path: '/observability/discovery/service-names',
    summary: 'Get service names',
    description: 'Returns distinct service names from observability data',
  },

  GET_ENVIRONMENTS: {
    method: 'GET',
    path: '/observability/discovery/environments',
    summary: 'Get environments',
    description: 'Returns distinct environments from observability data',
  },

  GET_TAGS: {
    method: 'GET',
    path: '/observability/discovery/tags',
    summary: 'Get tags',
    description: 'Returns distinct tags with optional entity type filtering',
  },
} as const satisfies Record<string, RouteDetails>;

export type NewRoutesKey = keyof typeof NEW_ROUTE_DEFS;
export type NewRoutesDefinitions = (typeof NEW_ROUTE_DEFS)[NewRoutesKey];

export function createObservabilityListQuerySchema<
  TFilter extends z.ZodObject<z.ZodRawShape>,
  TOrderBy extends z.ZodObject<z.ZodRawShape>,
>(filterSchema: TFilter, orderBySchema: TOrderBy) {
  const unwrapDefault = (schema: unknown) => {
    const zodSchema = schema as z.ZodTypeAny;
    return zodSchema instanceof z.ZodDefault ? zodSchema.unwrap() : zodSchema;
  };
  const paginationShape = paginationArgsSchema.shape as unknown as Record<string, z.ZodTypeAny>;
  const orderByShape = orderBySchema.shape as unknown as Record<string, z.ZodTypeAny>;

  const pageSchema = unwrapDefault(paginationShape.page);
  const perPageSchema = unwrapDefault(paginationShape.perPage);
  const fieldSchema = orderByShape.field ? unwrapDefault(orderByShape.field) : z.never().optional();
  const directionSchema = orderByShape.direction ? unwrapDefault(orderByShape.direction) : z.never().optional();

  return wrapSchemaForQueryParams(
    z
      .object({
        ...filterSchema.shape,
        page: pageSchema,
        perPage: perPageSchema,
        field: fieldSchema,
        direction: directionSchema,
        mode: listModeSchema.optional(),
        after: deltaCursorSchema.optional(),
        limit: deltaLimitSchema,
      })
      .partial(),
  ).superRefine((value, ctx) => {
    const isDelta = value.mode === 'delta';
    const hasPagination = value.page !== undefined || value.perPage !== undefined;
    const hasOrderBy = value.field !== undefined || value.direction !== undefined;
    const hasAfter = value.after !== undefined;
    const hasLimit = value.limit !== undefined;

    if (isDelta) {
      if (hasPagination) {
        if (value.page !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['page'],
            message: '`page` is not allowed when `mode=delta`',
          });
        }
        if (value.perPage !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['perPage'],
            message: '`perPage` is not allowed when `mode=delta`',
          });
        }
      }
      if (hasOrderBy) {
        if (value.field !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['field'],
            message: '`field` is not allowed when `mode=delta`',
          });
        }
        if (value.direction !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['direction'],
            message: '`direction` is not allowed when `mode=delta`',
          });
        }
      }
      return;
    }

    if (hasAfter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['after'],
        message: '`after` is only allowed when `mode=delta`',
      });
    }
    if (hasLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limit'],
        message: '`limit` is only allowed when `mode=delta`',
      });
    }
  });
}
