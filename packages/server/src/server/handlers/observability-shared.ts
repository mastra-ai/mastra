import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import { ObservabilityStorage, ScoresStorage } from '@mastra/core/storage';
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

/** Retrieves the scores storage domain, or undefined if not configured. Does not throw. */
async function tryGetScoresStore(mastra: Mastra): Promise<ScoresStorage | undefined> {
  const storage = mastra.getStorage();
  if (!storage) return undefined;
  return storage.getStore('scores');
}

/**
 * Returns true when the concrete observability store overrides the named
 * method (i.e. its prototype entry differs from the base class entry).
 *
 * The base class throws NOT_IMPLEMENTED for every method; subclasses override
 * only what they implement, so a prototype-level override is the canonical
 * signal that the adapter actually supports the operation.
 *
 * `getStructure` and `getTraceLight` are aliases -- the base class
 * implementations delegate to each other -- so overriding either is treated
 * as supporting both.
 */
function isStorageMethodSupported(
  store: ObservabilityStorage | undefined,
  method: keyof ObservabilityStorage,
): boolean {
  if (!store) return false;
  const basePrototype = ObservabilityStorage.prototype as unknown as Record<string, unknown>;
  const concrete = (store as unknown as Record<string, unknown>)[method as string];
  const overridden = typeof concrete === 'function' && concrete !== basePrototype[method as string];
  if (overridden) return true;
  if (method === 'getStructure') return isStorageMethodSupported(store, 'getTraceLight');
  if (method === 'getTraceLight') {
    const altConcrete = (store as unknown as Record<string, unknown>).getStructure;
    return typeof altConcrete === 'function' && altConcrete !== basePrototype.getStructure;
  }
  return false;
}

/**
 * Returns true when the concrete scores store overrides the named method.
 * Mirrors {@link isStorageMethodSupported} but for the scores domain.
 *
 * `listScoresBySpan` is the only non-abstract method on ScoresStorage with a
 * throwing default; the other methods are abstract and therefore always
 * implemented by any concrete subclass.
 */
function isScoresMethodSupported(store: ScoresStorage | undefined, method: keyof ScoresStorage): boolean {
  if (!store) return false;
  const basePrototype = ScoresStorage.prototype as unknown as Record<string, unknown>;
  const concrete = (store as unknown as Record<string, unknown>)[method as string];
  return typeof concrete === 'function' && concrete !== basePrototype[method as string];
}

/**
 * Feature flag set exported by @mastra/observability. The server package does
 * not depend on @mastra/observability directly, so this is resolved lazily
 * via dynamic import. Missing exports (older versions) are treated as an
 * empty set.
 */
let cachedObservabilityFeatures: ReadonlySet<string> | undefined;
let observabilityFeaturesLoaded = false;
async function loadObservabilityFeatures(): Promise<ReadonlySet<string>> {
  if (observabilityFeaturesLoaded) return cachedObservabilityFeatures ?? new Set();
  try {
    const mod: { observabilityFeatures?: ReadonlySet<string> } = await import(
      /* @vite-ignore */ '@mastra/observability'
    );
    cachedObservabilityFeatures = mod.observabilityFeatures;
  } catch {
    cachedObservabilityFeatures = undefined;
  }
  observabilityFeaturesLoaded = true;
  return cachedObservabilityFeatures ?? new Set();
}

/**
 * Requirements that gate whether an observability HTTP endpoint is callable
 * for the current configuration.
 *
 * - `observabilityStorageMethod`: the method on the observability storage
 *   domain that the route ultimately invokes. The route is unsupported when
 *   the connected adapter has not overridden this method.
 * - `scoresStorageMethod`: same idea, but for the scores storage domain
 *   (only used by the legacy /traces/:traceId/:spanId/scores route).
 * - `coreFeature`: a feature flag from `@mastra/core/features` that must be
 *   present. The new observability endpoints all require
 *   `observability:v1.13.2`; legacy trace routes have no core gate.
 * - `observabilityFeature`: a feature flag from `@mastra/observability`'s
 *   `observabilityFeatures`. None of the current routes require one; this
 *   field is here so future endpoints that depend on a specific span shape
 *   (e.g. `model-inference-span`) can opt in without a contract change.
 */
export interface ObservabilityEndpointRequirements {
  observabilityStorageMethod?: keyof ObservabilityStorage;
  scoresStorageMethod?: keyof ScoresStorage;
  coreFeature?: string;
  observabilityFeature?: string;
}

/** Identifier for an observability endpoint exposed by the server. */
export interface ObservabilityEndpoint {
  method: ServerRoute['method'];
  path: string;
}

const NEW_CORE_FEATURE = 'observability:v1.13.2';

/**
 * Single source of truth that maps every observability HTTP endpoint to the
 * dependencies that make it callable. Kept in sync by hand with the route
 * definitions in this file (NEW_ROUTE_DEFS) and in ./observability.ts
 * (legacy routes); the `observability.test.ts` suite asserts coverage.
 */
const OBSERVABILITY_ENDPOINT_REQUIREMENTS: ReadonlyArray<ObservabilityEndpoint & ObservabilityEndpointRequirements> = [
  // Legacy trace routes
  { method: 'GET', path: '/observability/traces', observabilityStorageMethod: 'listTraces' },
  { method: 'GET', path: '/observability/traces/light', observabilityStorageMethod: 'listTracesLight' },
  { method: 'GET', path: '/observability/branches', observabilityStorageMethod: 'listBranches' },
  { method: 'GET', path: '/observability/traces/:traceId', observabilityStorageMethod: 'getTrace' },
  { method: 'GET', path: '/observability/traces/:traceId/light', observabilityStorageMethod: 'getTraceLight' },
  {
    method: 'GET',
    path: '/observability/traces/:traceId/branches/:spanId',
    observabilityStorageMethod: 'getBranch',
  },
  { method: 'GET', path: '/observability/traces/:traceId/spans/:spanId', observabilityStorageMethod: 'getSpan' },
  {
    method: 'GET',
    path: '/observability/traces/:traceId/trajectory',
    observabilityStorageMethod: 'getTrace',
  },
  { method: 'POST', path: '/observability/traces/score', observabilityStorageMethod: 'getTrace' },
  {
    method: 'GET',
    path: '/observability/traces/:traceId/:spanId/scores',
    scoresStorageMethod: 'listScoresBySpan',
  },

  // New endpoints (require core feature flag)
  { method: 'GET', path: '/observability/logs', observabilityStorageMethod: 'listLogs', coreFeature: NEW_CORE_FEATURE },
  {
    method: 'GET',
    path: '/observability/scores',
    observabilityStorageMethod: 'listScores',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/scores',
    observabilityStorageMethod: 'createScore',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/scores/:scoreId',
    observabilityStorageMethod: 'getScoreById',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/scores/aggregate',
    observabilityStorageMethod: 'getScoreAggregate',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/scores/breakdown',
    observabilityStorageMethod: 'getScoreBreakdown',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/scores/timeseries',
    observabilityStorageMethod: 'getScoreTimeSeries',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/scores/percentiles',
    observabilityStorageMethod: 'getScorePercentiles',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/feedback',
    observabilityStorageMethod: 'listFeedback',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/feedback',
    observabilityStorageMethod: 'createFeedback',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/feedback/aggregate',
    observabilityStorageMethod: 'getFeedbackAggregate',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/feedback/breakdown',
    observabilityStorageMethod: 'getFeedbackBreakdown',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/feedback/timeseries',
    observabilityStorageMethod: 'getFeedbackTimeSeries',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/feedback/percentiles',
    observabilityStorageMethod: 'getFeedbackPercentiles',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/metrics/aggregate',
    observabilityStorageMethod: 'getMetricAggregate',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/metrics/breakdown',
    observabilityStorageMethod: 'getMetricBreakdown',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/metrics/timeseries',
    observabilityStorageMethod: 'getMetricTimeSeries',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'POST',
    path: '/observability/metrics/percentiles',
    observabilityStorageMethod: 'getMetricPercentiles',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/metric-names',
    observabilityStorageMethod: 'getMetricNames',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/metric-label-keys',
    observabilityStorageMethod: 'getMetricLabelKeys',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/metric-label-values',
    observabilityStorageMethod: 'getMetricLabelValues',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/entity-types',
    observabilityStorageMethod: 'getEntityTypes',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/entity-names',
    observabilityStorageMethod: 'getEntityNames',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/service-names',
    observabilityStorageMethod: 'getServiceNames',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/environments',
    observabilityStorageMethod: 'getEnvironments',
    coreFeature: NEW_CORE_FEATURE,
  },
  {
    method: 'GET',
    path: '/observability/discovery/tags',
    observabilityStorageMethod: 'getTags',
    coreFeature: NEW_CORE_FEATURE,
  },
];

/**
 * Computes the subset of observability HTTP endpoints that are callable for
 * the current Mastra configuration. An endpoint is supported when ALL of its
 * gates pass:
 *   - the required `@mastra/core` feature flag is present (if any);
 *   - the required `@mastra/observability` feature flag is present (if any);
 *   - the connected observability/scores storage adapter implements the
 *     underlying method (if any).
 *
 * The `/observability/capabilities` route itself is not included in the
 * response -- callers reach it before they know what's supported, so listing
 * it would be redundant.
 */
export async function getSupportedObservabilityEndpoints(mastra: Mastra): Promise<ObservabilityEndpoint[]> {
  const observabilityStore = await tryGetObservabilityStore(mastra);
  const scoresStore = await tryGetScoresStore(mastra);
  const observabilityFeatures = await loadObservabilityFeatures();

  const supported: ObservabilityEndpoint[] = [];
  for (const route of OBSERVABILITY_ENDPOINT_REQUIREMENTS) {
    if (route.coreFeature && !coreFeatures.has(route.coreFeature)) continue;
    if (route.observabilityFeature && !observabilityFeatures.has(route.observabilityFeature)) continue;
    if (
      route.observabilityStorageMethod &&
      !isStorageMethodSupported(observabilityStore, route.observabilityStorageMethod)
    )
      continue;
    if (route.scoresStorageMethod && !isScoresMethodSupported(scoresStore, route.scoresStorageMethod)) continue;
    supported.push({ method: route.method, path: route.path });
  }
  return supported;
}

/**
 * Test-only export of the full requirements table so the test suite can
 * assert that every registered observability route is represented.
 */
export const OBSERVABILITY_ENDPOINT_REQUIREMENTS_FOR_TESTS = OBSERVABILITY_ENDPOINT_REQUIREMENTS;

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
      'Returns the list of observability endpoints supported by the current server configuration (installed core features, installed observability features, and the connected observability storage provider).',
  },
} as const satisfies Record<string, RouteDetails>;

export type NewRoutesKey = keyof typeof NEW_ROUTE_DEFS;
export type NewRoutesDefinitions = (typeof NEW_ROUTE_DEFS)[NewRoutesKey];
