import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import type {
  MastraCompositeStore,
  ObservabilityStorage,
  ScoresStorage,
  TraceQueryIssue,
  TrustedTraceQueryScalarPredicate,
  TrustedThreadPredicate,
  TrustedTraceQueryPredicate,
} from '@mastra/core/storage';
import * as coreStorage from '@mastra/core/storage';
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
const OBSERVABILITY_TRACE_QUERY_STORAGE_FEATURE = 'trace-query';
const OBSERVABILITY_TRACE_AGGREGATE_STORAGE_FEATURE = 'trace-aggregate';
const OBSERVABILITY_SPAN_QUERY_STORAGE_FEATURE = 'span-query';
const OBSERVABILITY_SPAN_AGGREGATE_STORAGE_FEATURE = 'span-aggregate';
const SPAN_QUERY_CONTEXT_FIELDS = new Set([
  'traceId',
  'spanId',
  'parentSpanId',
  'threadId',
  'resourceId',
  'requestId',
  'serviceName',
  'experimentId',
  'environment',
  'executionSource',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
]);
const OBSERVABILITY_TRACE_QUERY_ROOT_DURATION_STORAGE_FEATURE = 'trace-query-root-duration';
const OBSERVABILITY_TRACE_QUERY_CONTEXT_IDS_STORAGE_FEATURE = 'trace-query-context-ids';
const TRACE_QUERY_CONTEXT_ID_FIELDS = new Set(['runId', 'sessionId', 'userId', 'organizationId']);
// Timing fields, keyed to the storage features that add their predicates and their sort.
const TRACE_QUERY_TIMING_FIELDS = {
  timeToFirstChunkMs: {
    label: 'Time to first chunk',
    feature: 'trace-query-time-to-first-chunk',
    sortFeature: 'trace-query-time-to-first-chunk-sort',
  },
  timeToFirstTokenMs: {
    label: 'Time to first token',
    feature: 'trace-query-time-to-first-token',
    sortFeature: 'trace-query-time-to-first-token-sort',
  },
} as const;
type TraceQueryTimingField = keyof typeof TRACE_QUERY_TIMING_FIELDS;
const TRACE_QUERY_TIMING_FIELD_NAMES = Object.keys(TRACE_QUERY_TIMING_FIELDS) as TraceQueryTimingField[];
const timingField = (field: string) => TRACE_QUERY_TIMING_FIELDS[field as TraceQueryTimingField];
const OBSERVABILITY_TRACE_QUERY_ROOT_SPAN_FIELDS_STORAGE_FEATURE = 'trace-query-root-span-fields';
const OBSERVABILITY_TRACE_QUERY_ROOT_ENTITY_ID_STORAGE_FEATURE = 'trace-query-root-entity-id';
// Trace-scope fields read from the root span, keyed by the storage feature that added their SQL.
const TRACE_QUERY_ROOT_SPAN_FIELD_FEATURES = new Map([
  ['name', OBSERVABILITY_TRACE_QUERY_ROOT_SPAN_FIELDS_STORAGE_FEATURE],
  ['spanType', OBSERVABILITY_TRACE_QUERY_ROOT_SPAN_FIELDS_STORAGE_FEATURE],
  ['entityId', OBSERVABILITY_TRACE_QUERY_ROOT_ENTITY_ID_STORAGE_FEATURE],
]);
const OBSERVABILITY_TRACE_QUERY_DISCOVERY_STORAGE_FEATURE = 'trace-query-discovery';
const OBSERVABILITY_THREAD_QUERY_STORAGE_FEATURE = 'thread-query';
const OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_STORAGE_FEATURE = 'trace-query-tenant-scope';
const OBSERVABILITY_FEEDBACK_STORAGE_FEATURE = 'feedback';
export const OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_CORE_FEATURE = 'observability-trace-query-tenant-scope';
export const OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_UPGRADE_MESSAGE =
  'Trusted tenant scope requires a newer @mastra/core with trace-query tenant scope support. Please upgrade.';

export function supportsTraceQueryDiscoveryCore() {
  return (
    coreStorage.getTraceQueryFieldsArgsSchema !== undefined &&
    coreStorage.getTraceQueryFieldsResponseSchema !== undefined &&
    coreStorage.getTraceQueryValuesArgsSchema !== undefined &&
    coreStorage.getTraceQueryValuesResponseSchema !== undefined &&
    typeof coreStorage.planTraceQueryObservedFields === 'function' &&
    typeof coreStorage.planTraceQueryValues === 'function' &&
    typeof coreStorage.getTraceQueryCanonicalFieldDescriptors === 'function' &&
    typeof coreStorage.TraceQueryResourceLimitError === 'function'
  );
}

export function supportsTraceAggregateCore() {
  return (
    coreStorage.traceAggregateRequestSchema !== undefined &&
    coreStorage.traceAggregateResponseSchema !== undefined &&
    typeof coreStorage.planTraceAggregate === 'function'
  );
}

export function supportsSpanAggregateCore() {
  return (
    coreStorage.spanAggregateRequestSchema !== undefined &&
    coreStorage.spanAggregateResponseSchema !== undefined &&
    typeof coreStorage.planSpanAggregate === 'function'
  );
}

export function supportsSpanQueryCore() {
  return (
    coreStorage.spanQueryRequestSchema !== undefined &&
    coreStorage.spanQueryResponseSchema !== undefined &&
    typeof coreStorage.planSpanQuery === 'function'
  );
}

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
    // server failure — matching the other 501s in this file.
    throw new HTTPException(501, { message: 'Observability storage domain is not available' });
  }
  return observability;
}

/** Retrieves the scores storage domain or throws 501 if unavailable. */
export async function getScoresStore(mastra: Mastra): Promise<ScoresStorage> {
  const storage = getStorage(mastra);
  const scores = await storage.getStore('scores');
  if (!scores) {
    throw new HTTPException(501, { message: 'Scores storage domain is not available' });
  }
  return scores;
}

export function assertObservabilityTraceQuerySupported(observabilityStore: ObservabilityStorage) {
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_QUERY_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'Advanced trace queries are not supported by the configured observability store',
  });
}

export function supportsObservabilityTraceAggregate(observabilityStore: ObservabilityStorage) {
  return getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_AGGREGATE_STORAGE_FEATURE) === true;
}

export function assertObservabilityTraceAggregateSupported(observabilityStore: ObservabilityStorage) {
  if (supportsObservabilityTraceAggregate(observabilityStore)) return;

  throw new HTTPException(501, {
    message: 'Trace aggregation is not supported by the configured observability store',
  });
}

export function assertObservabilitySpanAggregateSupported(observabilityStore: ObservabilityStorage) {
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_SPAN_AGGREGATE_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'Span aggregation is not supported by the configured observability store',
  });
}

export function assertObservabilitySpanQuerySupported(observabilityStore: ObservabilityStorage) {
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_SPAN_QUERY_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'Span queries are not supported by the configured observability store',
  });
}

export function assertObservabilitySpanQueryFieldsSupported(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryScalarPredicate | undefined,
) {
  if (!predicate || getFeatures(observabilityStore)?.includes('span-query-context-fields')) return;
  if (predicate.type === 'boolean') {
    for (const arg of predicate.args) assertObservabilitySpanQueryFieldsSupported(observabilityStore, arg);
  } else if (predicate.type === 'not') {
    assertObservabilitySpanQueryFieldsSupported(observabilityStore, predicate.arg);
  } else if (SPAN_QUERY_CONTEXT_FIELDS.has(predicate.field)) {
    throw new coreStorage.TraceQueryValidationError([
      {
        code: 'field_not_allowed',
        path: ['where'],
        message: `Filtering by ${predicate.field} requires an updated storage adapter with span query context-field support.`,
      },
    ]);
  }
}

function usesRootDuration(predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined): boolean {
  if (!predicate) return false;
  if (predicate.type === 'boolean') return predicate.args.some(usesRootDuration);
  if (predicate.type === 'not') return usesRootDuration(predicate.arg);
  if (predicate.type === 'relation') {
    return predicate.collection === 'traces' && usesRootDuration(predicate.predicate);
  }
  return predicate.field === 'durationMs';
}

export function supportsObservabilityTraceQueryRootDuration(observabilityStore: ObservabilityStorage) {
  return getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_QUERY_ROOT_DURATION_STORAGE_FEATURE) === true;
}

export function assertObservabilityTraceQueryRootDurationSupported(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
) {
  if (!usesRootDuration(predicate) || supportsObservabilityTraceQueryRootDuration(observabilityStore)) return;

  throw new HTTPException(501, {
    message: 'Root duration predicates are not supported by the configured observability store',
  });
}

/** Whether any scalar predicate, at any depth and inside any relation, names one of `fields`. */
function usesField(
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
  fields: ReadonlySet<string>,
): boolean {
  if (!predicate) return false;
  if (predicate.type === 'boolean') return predicate.args.some(arg => usesField(arg, fields));
  if (predicate.type === 'not') return usesField(predicate.arg, fields);
  if (predicate.type === 'relation') return usesField(predicate.predicate, fields);
  return fields.has(predicate.field);
}

export function supportsObservabilityTraceQueryContextIds(observabilityStore: ObservabilityStorage) {
  return getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_QUERY_CONTEXT_IDS_STORAGE_FEATURE) === true;
}

export function isTraceQueryContextIdField(path: string): boolean {
  return TRACE_QUERY_CONTEXT_ID_FIELDS.has(path);
}

export function assertObservabilityTraceQueryContextIdsSupported(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
) {
  if (
    !usesField(predicate, TRACE_QUERY_CONTEXT_ID_FIELDS) ||
    supportsObservabilityTraceQueryContextIds(observabilityStore)
  ) {
    return;
  }

  throw new HTTPException(501, {
    message: 'Context identifier predicates are not supported by the configured observability store',
  });
}

/** Whether the store can filter on `field`; true for any field that is not a timing field. */
export function supportsObservabilityTraceQueryTimingField(observabilityStore: ObservabilityStorage, field: string) {
  const timing = timingField(field);
  return !timing || getFeatures(observabilityStore)?.includes(timing.feature) === true;
}

/** Covers trace, thread and span query predicates, including `spans` and `traces` relations. */
export function assertObservabilityTraceQueryTimingFieldsSupported(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
  fields: readonly TraceQueryTimingField[] = TRACE_QUERY_TIMING_FIELD_NAMES,
) {
  for (const field of fields) {
    if (
      !usesField(predicate, new Set([field])) ||
      supportsObservabilityTraceQueryTimingField(observabilityStore, field)
    )
      continue;
    throw new HTTPException(501, {
      message: `${TRACE_QUERY_TIMING_FIELDS[field].label} predicates are not supported by the configured observability store`,
    });
  }
}

/** @deprecated Use `supportsObservabilityTraceQueryTimingField(observabilityStore, 'timeToFirstChunkMs')`. */
export function supportsObservabilityTraceQueryTimeToFirstChunk(observabilityStore: ObservabilityStorage) {
  return supportsObservabilityTraceQueryTimingField(observabilityStore, 'timeToFirstChunkMs');
}

/** @deprecated Use `assertObservabilityTraceQueryTimingFieldsSupported`. */
export function assertObservabilityTraceQueryTimeToFirstChunkSupported(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
) {
  assertObservabilityTraceQueryTimingFieldsSupported(observabilityStore, predicate, ['timeToFirstChunkMs']);
}

function rootSpanFieldIssues(
  observabilityStore: ObservabilityStorage,
  predicate: TrustedTraceQueryPredicate | TrustedThreadPredicate | undefined,
): TraceQueryIssue[] {
  if (!predicate) return [];
  if (predicate.type === 'boolean') return predicate.args.flatMap(arg => rootSpanFieldIssues(observabilityStore, arg));
  if (predicate.type === 'not') return rootSpanFieldIssues(observabilityStore, predicate.arg);
  // Only trace-scope root span fields read the root; inside `spans.some` they are long-supported span fields.
  if (predicate.type === 'relation') {
    return predicate.collection === 'traces' ? rootSpanFieldIssues(observabilityStore, predicate.predicate) : [];
  }
  return supportsObservabilityTraceQueryRootSpanField(observabilityStore, predicate.field)
    ? []
    : [rootSpanFieldIssue(['where'], predicate.field)];
}

function rootSpanFieldIssue(path: Array<string | number>, field: string): TraceQueryIssue {
  return {
    code: 'field_not_allowed',
    path,
    message: `Root span ${field} requires an updated storage adapter with trace-query root span field support.`,
  };
}

/**
 * Whether the store can serve `path` at trace scope. Fields that don't read the root span are
 * always supported here; other gates cover them.
 */
export function supportsObservabilityTraceQueryRootSpanField(observabilityStore: ObservabilityStorage, path: string) {
  const feature = TRACE_QUERY_ROOT_SPAN_FIELD_FEATURES.get(path);
  return feature === undefined || getFeatures(observabilityStore)?.includes(feature) === true;
}

/**
 * Stores that predate a trace-scope root span field have no SQL for it and would fail with a
 * 500, so requests that use it are rejected as invalid instead.
 */
export function assertObservabilityTraceQueryRootSpanFieldsSupported(
  observabilityStore: ObservabilityStorage,
  plan: {
    where?: TrustedTraceQueryPredicate | TrustedThreadPredicate;
    dimensions?: readonly string[];
    measures?: ReadonlyArray<{ type: string; field?: string }>;
  },
) {
  const supported = (field: string) => supportsObservabilityTraceQueryRootSpanField(observabilityStore, field);
  const issues = [
    ...rootSpanFieldIssues(observabilityStore, plan.where),
    ...(plan.dimensions ?? []).flatMap((dimension, index) =>
      supported(dimension) ? [] : [rootSpanFieldIssue(['groupBy', index], dimension)],
    ),
    ...(plan.measures ?? []).flatMap((measure, index) =>
      measure.type === 'countDistinct' && measure.field !== undefined && !supported(measure.field)
        ? [rootSpanFieldIssue(['measures', index], measure.field)]
        : [],
    ),
  ];
  if (issues.length > 0) throw new coreStorage.TraceQueryValidationError(issues);
}

export function assertObservabilityTraceQueryRootSpanValuesSupported(
  observabilityStore: ObservabilityStorage,
  plan: { predicateScope: string; path: string },
) {
  if (plan.predicateScope !== 'trace') return;
  if (supportsObservabilityTraceQueryRootSpanField(observabilityStore, plan.path)) return;
  throw new coreStorage.TraceQueryValidationError([rootSpanFieldIssue(['path'], plan.path)]);
}

/** Whether the store can sort by `field`; true for any field that is not a timing field. */
export function supportsObservabilityTraceQueryTimingSort(observabilityStore: ObservabilityStorage, field: string) {
  const timing = timingField(field);
  return !timing || getFeatures(observabilityStore)?.includes(timing.sortFeature) === true;
}

/** Covers the sort of trace and span queries. */
export function assertObservabilityTraceQueryTimingSortSupported(
  observabilityStore: ObservabilityStorage,
  orderBy: { field: string },
) {
  if (supportsObservabilityTraceQueryTimingSort(observabilityStore, orderBy.field)) return;

  throw new HTTPException(501, {
    message: `Sorting by ${timingField(orderBy.field).label.toLowerCase()} is not supported by the configured observability store`,
  });
}

/** @deprecated Use `supportsObservabilityTraceQueryTimingSort(observabilityStore, 'timeToFirstChunkMs')`. */
export function supportsObservabilityTraceQueryTimeToFirstChunkSort(observabilityStore: ObservabilityStorage) {
  return supportsObservabilityTraceQueryTimingSort(observabilityStore, 'timeToFirstChunkMs');
}

/** @deprecated Use `assertObservabilityTraceQueryTimingSortSupported`. */
export function assertObservabilityTraceQueryTimeToFirstChunkSortSupported(
  observabilityStore: ObservabilityStorage,
  orderBy: { field: string },
) {
  assertObservabilityTraceQueryTimingSortSupported(observabilityStore, orderBy);
}

export function assertObservabilityTraceQueryDiscoverySupported(observabilityStore: ObservabilityStorage) {
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_QUERY_DISCOVERY_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'Trace query discovery is not supported by the configured observability store',
  });
}

/**
 * A scoped request must never run unscoped: a store that predates tenant scope would
 * silently ignore `plan.scope` and return every tenant's rows, so it is rejected instead.
 * Unscoped requests are unaffected.
 */
export function assertObservabilityTraceQueryTenantScopeSupported(
  observabilityStore: ObservabilityStorage,
  scope: coreStorage.TraceQueryTenantScope | undefined,
) {
  if (scope === undefined) return;
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'The configured observability store cannot enforce the trusted tenant scope',
  });
}

export function assertObservabilityThreadQuerySupported(observabilityStore: ObservabilityStorage) {
  if (getFeatures(observabilityStore)?.includes(OBSERVABILITY_THREAD_QUERY_STORAGE_FEATURE)) return;

  throw new HTTPException(501, {
    message: 'Advanced thread queries are not supported by the configured observability store',
  });
}

/**
 * Returns true when the store's class chain overrides `method` below the class
 * that first declares it (the `ObservabilityStorage` base, whose default
 * throws `*_NOT_IMPLEMENTED`). Walks the store's own prototype chain instead of
 * comparing against this package's `ObservabilityStorage.prototype`, so it
 * works for stores built against older or duplicated `@mastra/core` installs
 * and for stores that predate {@link ObservabilityStorage.getFeatures}.
 */
function implementsObservabilityStorageMethod(observabilityStore: object, method: string): boolean {
  if (Object.prototype.hasOwnProperty.call(observabilityStore, method)) return true;

  let resolvedOwner: object | undefined;
  let declaringBase: object | undefined;
  for (
    let proto: object | null = Object.getPrototypeOf(observabilityStore);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    if (Object.prototype.hasOwnProperty.call(proto, method)) {
      resolvedOwner ??= proto;
      declaringBase = proto;
    }
  }
  return resolvedOwner !== undefined && resolvedOwner !== declaringBase;
}

export type ObservabilityDiscoveryCapabilities = {
  entityTypes: boolean;
  entityNames: boolean;
  serviceNames: boolean;
  environments: boolean;
  tags: boolean;
  metrics: boolean;
};

export type ObservabilityStorageCapabilities = {
  metrics: boolean;
  logs: boolean;
  discovery: ObservabilityDiscoveryCapabilities;
  deltaPolling: boolean;
  traceQuery: boolean;
  traceQueryRootDuration: boolean;
  traceQueryContextIds: boolean;
  traceQueryTimeToFirstChunk: boolean;
  traceQueryRootSpanFields: boolean;
  traceQueryRootEntityId: boolean;
  traceQueryTimeToFirstChunkSort: boolean;
  traceQueryTimeToFirstToken: boolean;
  traceQueryTimeToFirstTokenSort: boolean;
  traceQueryDiscovery: boolean;
  traceQueryTenantScope: boolean;
  traceAggregate: boolean;
  threadQuery: boolean;
  threadQueryRows: boolean;
  spanQuery: boolean;
  spanQueryContextFields: boolean;
  spanAggregate: boolean;
  /** Days of traces the store keeps. Omitted when the store does not report a limit. */
  traceRetentionDays?: number;
  feedback: boolean;
};

export const NO_OBSERVABILITY_STORAGE_CAPABILITIES: ObservabilityStorageCapabilities = {
  metrics: false,
  logs: false,
  discovery: {
    entityTypes: false,
    entityNames: false,
    serviceNames: false,
    environments: false,
    tags: false,
    metrics: false,
  },
  deltaPolling: false,
  traceQuery: false,
  traceQueryRootDuration: false,
  traceQueryContextIds: false,
  traceQueryTimeToFirstChunk: false,
  traceQueryRootSpanFields: false,
  traceQueryRootEntityId: false,
  traceQueryTimeToFirstChunkSort: false,
  traceQueryTimeToFirstToken: false,
  traceQueryTimeToFirstTokenSort: false,
  traceQueryDiscovery: false,
  traceQueryTenantScope: false,
  traceAggregate: false,
  threadQuery: false,
  threadQueryRows: false,
  spanQuery: false,
  spanAggregate: false,
  spanQueryContextFields: false,
  feedback: false,
};

/**
 * Resolves which optional observability APIs the configured store can serve.
 *
 * Feature declarations (`getFeatures()`) are optional. When a store declares
 * a feature list, that list is final. Stores without `getFeatures()` predate
 * declarations: metrics, logs and filter discovery are detected by whether the
 * store implements the underlying method, so those packages report accurately
 * without being upgraded. Delta polling and the trace/thread query APIs depend
 * on runtime behavior a method check can't see, so they are only reported for
 * stores that declare them. Feedback is also declaration-only: Studio hides
 * the feedback UI behind this flag, and store versions that implement feedback
 * without declaring it simply don't advertise it until upgraded.
 */
export function getObservabilityStorageCapabilities(
  observabilityStore: ObservabilityStorage,
): ObservabilityStorageCapabilities {
  const declaredFeatures = getFeatures(observabilityStore);
  const features = declaredFeatures ?? [];
  const newApiCore = coreFeatures.has('observability:v1.13.2');
  const declares = (feature: string) => features.includes(feature);
  // Undeclared stores must implement every method behind the feature.
  const supports = (feature: string, methods: readonly string[]) => {
    if (!newApiCore) return false;
    if (!declaredFeatures) {
      return methods.every(method => implementsObservabilityStorageMethod(observabilityStore, method));
    }
    return declares(feature);
  };
  // Stores released before the per-endpoint discovery features existed declare
  // `trace-query` and implement every discovery method, so treat it as implying discovery.
  const supportsDiscovery = (feature: string, methods: readonly string[]) =>
    supports(feature, methods) || (newApiCore && declares(OBSERVABILITY_TRACE_QUERY_STORAGE_FEATURE));
  const traceQuery =
    newApiCore &&
    typeof coreStorage.planTraceQuery === 'function' &&
    declares(OBSERVABILITY_TRACE_QUERY_STORAGE_FEATURE);
  const threadQuery =
    newApiCore &&
    typeof coreStorage.planThreadQuery === 'function' &&
    declares(OBSERVABILITY_THREAD_QUERY_STORAGE_FEATURE);
  const spanQuery = newApiCore && supportsSpanQueryCore() && declares(OBSERVABILITY_SPAN_QUERY_STORAGE_FEATURE);

  return {
    // `listMetrics` is left out: it backs a newer route that metric dashboards don't use,
    // and older stores that implement the OLAP methods predate it.
    metrics: supports('metrics', [
      'getMetricAggregate',
      'getMetricBreakdown',
      'getMetricTimeSeries',
      'getMetricPercentiles',
    ]),
    logs: supports('logs', ['listLogs']),
    discovery: {
      entityTypes: supportsDiscovery('entity-type-discovery', ['getEntityTypes']),
      entityNames: supportsDiscovery('entity-name-discovery', ['getEntityNames']),
      serviceNames: supportsDiscovery('service-name-discovery', ['getServiceNames']),
      environments: supportsDiscovery('environment-discovery', ['getEnvironments']),
      tags: supportsDiscovery('tag-discovery', ['getTags']),
      metrics: supportsDiscovery('metric-discovery', ['getMetricNames', 'getMetricLabelKeys', 'getMetricLabelValues']),
    },
    deltaPolling:
      coreFeatures.has(OBSERVABILITY_DELTA_POLLING_FEATURE) && declares(OBSERVABILITY_DELTA_POLLING_STORAGE_FEATURE),
    traceQuery,
    traceQueryRootDuration:
      (traceQuery || threadQuery) && declares(OBSERVABILITY_TRACE_QUERY_ROOT_DURATION_STORAGE_FEATURE),
    traceQueryContextIds:
      (traceQuery || threadQuery) && declares(OBSERVABILITY_TRACE_QUERY_CONTEXT_IDS_STORAGE_FEATURE),
    traceQueryTimeToFirstChunk:
      (traceQuery || threadQuery || spanQuery) && declares(TRACE_QUERY_TIMING_FIELDS.timeToFirstChunkMs.feature),
    traceQueryRootSpanFields:
      (traceQuery || threadQuery) && declares(OBSERVABILITY_TRACE_QUERY_ROOT_SPAN_FIELDS_STORAGE_FEATURE),
    traceQueryRootEntityId:
      (traceQuery || threadQuery) && declares(OBSERVABILITY_TRACE_QUERY_ROOT_ENTITY_ID_STORAGE_FEATURE),
    traceQueryTimeToFirstChunkSort:
      (traceQuery || spanQuery) && declares(TRACE_QUERY_TIMING_FIELDS.timeToFirstChunkMs.sortFeature),
    traceQueryTimeToFirstToken:
      (traceQuery || threadQuery || spanQuery) && declares(TRACE_QUERY_TIMING_FIELDS.timeToFirstTokenMs.feature),
    traceQueryTimeToFirstTokenSort:
      (traceQuery || spanQuery) && declares(TRACE_QUERY_TIMING_FIELDS.timeToFirstTokenMs.sortFeature),
    traceQueryDiscovery:
      newApiCore && supportsTraceQueryDiscoveryCore() && declares(OBSERVABILITY_TRACE_QUERY_DISCOVERY_STORAGE_FEATURE),
    traceQueryTenantScope:
      (traceQuery || threadQuery) &&
      coreFeatures.has(OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_CORE_FEATURE) &&
      declares(OBSERVABILITY_TRACE_QUERY_TENANT_SCOPE_STORAGE_FEATURE),
    traceAggregate:
      newApiCore && supportsTraceAggregateCore() && declares(OBSERVABILITY_TRACE_AGGREGATE_STORAGE_FEATURE),
    threadQuery,
    threadQueryRows:
      threadQuery && typeof coreStorage.planThreadRowsQuery === 'function' && declares('thread-query-rows'),
    spanQuery,
    spanQueryContextFields: spanQuery && declares('span-query-context-fields'),
    spanAggregate: newApiCore && supportsSpanAggregateCore() && declares(OBSERVABILITY_SPAN_AGGREGATE_STORAGE_FEATURE),
    feedback: newApiCore && declares(OBSERVABILITY_FEEDBACK_STORAGE_FEATURE),
  };
}

/**
 * Matches the `OBSERVABILITY_STORAGE_*_NOT_IMPLEMENTED` MastraError the base
 * observability store throws for every optional method a store doesn't
 * implement. Checked by id (not `instanceof`) so it holds across duplicated
 * `@mastra/core` installs.
 */
function isObservabilityStorageNotImplementedError(error: unknown): boolean {
  const id = error && typeof error === 'object' && 'id' in error ? error.id : undefined;
  return typeof id === 'string' && id.startsWith('OBSERVABILITY_STORAGE_') && id.endsWith('_NOT_IMPLEMENTED');
}

/**
 * Discovery is optional for observability stores. When the configured store
 * doesn't implement a discovery method, answer with an empty result instead of
 * a 500 so filter lookups degrade quietly on stores without discovery support.
 * Clients should check `observabilityStorageCapabilities.discovery` from
 * `GET /system/packages` before calling these routes.
 */
export async function withDiscoveryFallback<T>(run: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isObservabilityStorageNotImplementedError(error)) return empty;
    throw error;
  }
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
  QUERY_TRACES: {
    method: 'POST',
    path: '/observability/traces/query',
    summary: 'Query traces',
    description:
      'Returns completed logical traces or distinct thread groups matching an advanced trace query. Thread grouping remains supported but is deprecated; use queryTraceThreads instead.',
    requiresPermission: 'observability:read',
  },

  AGGREGATE_TRACES: {
    method: 'POST',
    path: '/observability/traces/aggregate',
    summary: 'Aggregate traces',
    description:
      'Returns grouped and optionally time-bucketed measures (counts, durations, error rates) over completed logical traces matching an advanced trace predicate',
    requiresPermission: 'observability:read',
  },

  QUERY_THREADS: {
    method: 'POST',
    path: '/observability/threads/query',
    summary: 'Query threads',
    description:
      'Returns full-history thread rows with activity timestamps, first/last traces, previews and context fields',
    requiresPermission: 'observability:read',
  },

  QUERY_SPANS: {
    method: 'POST',
    path: '/observability/spans/query',
    summary: 'Query spans',
    description: 'Returns completed spans matching a span predicate, one row per span, with cursor pagination',
    requiresPermission: 'observability:read',
  },

  AGGREGATE_SPANS: {
    method: 'POST',
    path: '/observability/spans/aggregate',
    summary: 'Aggregate spans',
    description:
      'Returns grouped and optionally time-bucketed measures (counts, durations, error rates, tokens, cost) over completed spans matching a span predicate',
    requiresPermission: 'observability:read',
  },

  GET_TRACE_QUERY_FIELDS: {
    method: 'POST',
    path: '/observability/traces/query/fields',
    summary: 'Discover trace query fields',
    description: 'Returns canonical query fields and observed top-level string metadata fields',
    requiresPermission: 'observability:read',
  },

  GET_TRACE_QUERY_VALUES: {
    method: 'POST',
    path: '/observability/traces/query/values',
    summary: 'Discover trace query values',
    description: 'Returns bounded string value suggestions and occurrence counts for one eligible query field',
    requiresPermission: 'observability:read',
  },

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

  DELETE_SCORES: {
    method: 'DELETE',
    path: '/observability/scores',
    summary: 'Delete scores',
    description: 'Deletes score records by scoreId, optionally scoped to a tenant',
    requiresPermission: 'observability:delete',
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

  DELETE_FEEDBACK: {
    method: 'DELETE',
    path: '/observability/feedback',
    summary: 'Delete feedback',
    description: 'Deletes feedback records by feedbackId, optionally scoped to a tenant',
    requiresPermission: 'observability:delete',
  },

  UPDATE_FEEDBACK_REVIEW_STATUS: {
    method: 'PATCH',
    path: '/observability/feedback/:feedbackId/review-status',
    summary: 'Update feedback review status',
    description: "Updates a feedback record's review workflow status",
    requiresPermission: 'observability:write',
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
      'Returns which optional observability APIs the configured observability storage supports. Every flag is false when no observability storage is configured.',
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
