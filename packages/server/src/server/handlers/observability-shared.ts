import type { Mastra } from '@mastra/core';
import { ObservabilityStorage } from '@mastra/core/storage';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';

export const NEW_OBSERVABILITY_UPGRADE_MESSAGE =
  'New observability endpoints require a newer @mastra/core. Please upgrade.';

/** Retrieves MastraCompositeStore or throws 500 if unavailable. */
export function getStorage(mastra: Mastra): MastraCompositeStore {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

/** Retrieves the observability storage domain or throws 500 if unavailable. */
export async function getObservabilityStore(mastra: Mastra): Promise<ObservabilityStorage> {
  const storage = getStorage(mastra);
  const observability = await storage.getStore('observability');
  if (!observability) {
    throw new HTTPException(500, { message: 'Observability storage domain is not available' });
  }
  return observability;
}

/** Retrieves the observability storage domain, or undefined if not configured. Does not throw. */
export async function tryGetObservabilityStore(mastra: Mastra): Promise<ObservabilityStorage | undefined> {
  const storage = mastra.getStorage();
  if (!storage) return undefined;
  return storage.getStore('observability');
}

/**
 * Methods on ObservabilityStorage whose default base-class implementation throws
 * NOT_IMPLEMENTED. A storage adapter "supports" a method when its prototype
 * entry differs from the base class entry (i.e. the subclass overrode it).
 *
 * Note: `getStructure` and `getTraceLight` are aliases that delegate to each
 * other; overriding either one provides both. `getBranch` has a default
 * implementation that works when the underlying methods it delegates to are
 * implemented, so it's reported separately based on its direct override status.
 */
const OBSERVABILITY_METHOD_NAMES = [
  // Tracing - reads
  'listTraces',
  'listTracesLight',
  'listBranches',
  'getTrace',
  'getStructure',
  'getTraceLight',
  'getSpan',
  'getSpans',
  'getRootSpan',
  'getBranch',
  // Tracing - writes
  'createSpan',
  'updateSpan',
  'batchCreateSpans',
  'batchUpdateSpans',
  'batchDeleteTraces',
  // Logs
  'listLogs',
  'batchCreateLogs',
  // Metrics
  'listMetrics',
  'batchCreateMetrics',
  'getMetricAggregate',
  'getMetricBreakdown',
  'getMetricTimeSeries',
  'getMetricPercentiles',
  // Scores
  'listScores',
  'createScore',
  'batchCreateScores',
  'getScoreById',
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
  // Feedback
  'listFeedback',
  'createFeedback',
  'batchCreateFeedback',
  'getFeedbackAggregate',
  'getFeedbackBreakdown',
  'getFeedbackTimeSeries',
  'getFeedbackPercentiles',
  // Discovery
  'getMetricNames',
  'getMetricLabelKeys',
  'getMetricLabelValues',
  'getEntityTypes',
  'getEntityNames',
  'getServiceNames',
  'getEnvironments',
  'getTags',
] as const satisfies ReadonlyArray<keyof ObservabilityStorage>;

export type ObservabilityFeatureName = (typeof OBSERVABILITY_METHOD_NAMES)[number];
export type ObservabilityFeatureMap = Record<ObservabilityFeatureName, boolean>;

/**
 * Detects which observability features the connected store supports by
 * comparing method references against the base ObservabilityStorage prototype.
 *
 * The base class provides default `throw NOT_IMPLEMENTED` stubs for every
 * method; subclasses override only what they support. When `store` is
 * undefined (no observability storage configured), every feature reports as
 * unsupported.
 */
export function detectObservabilityFeatures(store: ObservabilityStorage | undefined): ObservabilityFeatureMap {
  const basePrototype = ObservabilityStorage.prototype as unknown as Record<string, unknown>;
  const features = {} as ObservabilityFeatureMap;
  for (const method of OBSERVABILITY_METHOD_NAMES) {
    if (!store) {
      features[method] = false;
      continue;
    }
    const concrete = (store as unknown as Record<string, unknown>)[method];
    features[method] = typeof concrete === 'function' && concrete !== basePrototype[method];
  }
  // getStructure and getTraceLight delegate to each other in the base class:
  // overriding either provides the capability for both.
  if (features.getStructure || features.getTraceLight) {
    features.getStructure = true;
    features.getTraceLight = true;
  }
  return features;
}

export interface RouteDetails {
  method: ServerRoute['method'];
  path: `/${string}`;
  summary: string;
  description: string;
  requiresPermission?: ServerRoute['requiresPermission'];
}

export const NEW_ROUTE_DEFS = {
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

  GET_CAPABILITIES: {
    method: 'GET',
    path: '/observability/capabilities',
    summary: 'Get observability capabilities',
    description:
      'Returns the observability features supported by the connected storage provider so clients can hide or disable unsupported UI affordances',
  },
} as const satisfies Record<string, RouteDetails>;

export type NewRoutesKey = keyof typeof NEW_ROUTE_DEFS;
export type NewRoutesDefinitions = (typeof NEW_ROUTE_DEFS)[NewRoutesKey];
