import type { Mastra } from '@mastra/core';
import type { MastraCompositeStore, ObservabilityStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';

export const NEW_OBSERVABILITY_UPGRADE_MESSAGE = 'New observability endpoints require @mastra/core >= 1.13.2';

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
