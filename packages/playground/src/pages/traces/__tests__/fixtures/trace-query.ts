import type {
  AggregateTracesResponse,
  GetObservabilityCapabilitiesResponse,
  GetTraceQueryFieldsResponse,
  GetTraceQueryValuesResponse,
  TraceQueryKeysetTraceResponse,
} from '@mastra/client-js';

export const emptyTraceQueryFields: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [],
  observedFieldsTruncated: false,
};

export const traceQueryFieldsWithRegion: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    {
      path: 'metadata.region',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 12,
    },
  ],
  observedFieldsTruncated: false,
};

/** Nested paths collapse to their top-level key for the columns picker. */
export const traceQueryFieldsWithNestedTenant: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    {
      path: 'metadata.tenant.id',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 3,
    },
    {
      path: 'metadata.tenant.name',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 3,
    },
  ],
  observedFieldsTruncated: false,
};

export const traceQueryRegionValues: GetTraceQueryValuesResponse = {
  values: [
    { value: 'eu-west', count: 8 },
    { value: 'us-east', count: 4 },
  ],
  valuesTruncated: false,
};

export const traceQuerySpanModelValues: GetTraceQueryValuesResponse = {
  values: [
    { value: 'gpt-4o', count: 20 },
    { value: 'claude-sonnet-4', count: 5 },
  ],
  valuesTruncated: false,
};

export const traceQueryPage: TraceQueryKeysetTraceResponse = {
  traces: [
    {
      traceId: 'trace-a',
      rootSpanId: 'span-a',
      name: 'Studio preview agent',
      createdAt: '2026-09-15T12:00:00.000Z',
      startedAt: '2026-09-15T12:00:00.000Z',
      endedAt: '2026-09-15T12:00:01.000Z',
      status: 'success',
      entityId: null,
      entityName: null,
      entityType: null,
      environment: null,
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
      threadId: null,
      resourceId: null,
    },
  ],
  page: { next: null },
};

export const traceQueryPageWithThreadAndEnvironment: Awaited<ReturnType<MastraClient['queryTraces']>> = {
  traces: [
    {
      ...traceQueryPage.traces[0]!,
      traceId: 'trace-env',
      rootSpanId: 'span-env',
      environment: 'production',
      threadId: 'thread-42',
    },
  ],
  page: { next: null },
};

export const traceQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    metrics: true,
    logs: true,
    discovery: {
      entityTypes: true,
      entityNames: true,
      serviceNames: true,
      environments: true,
      tags: true,
      metrics: true,
    },
    deltaPolling: true,
    traceQuery: true,
    traceQueryRootDuration: true,
    traceQueryDiscovery: true,
    traceQueryTenantScope: true,
    threadQuery: true,
    spanQuery: true,
    feedback: true,
  },
};

export const noFeedbackCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    feedback: false,
  },
};

export const legacyTraceCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageLibSQL',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    traceQuery: false,
    traceQueryRootDuration: false,
    traceQueryDiscovery: false,
    traceQueryTenantScope: false,
    threadQuery: false,
    spanQuery: false,
    feedback: false,
  },
};

/** Store runs trace queries but cannot filter on the root span duration. */
export const noRootDurationCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    traceQueryRootDuration: false,
  },
};

/** Store declares `trace-query` but not `trace-query-discovery` (or the core lacks the discovery planners). */
export const traceQueryWithoutDiscoveryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    traceQueryDiscovery: false,
  },
};

/** Canonical trace-scope descriptors as returned by `/traces/query/fields` (subset). */
export const traceQueryFieldsWithTags: GetTraceQueryFieldsResponse = {
  canonicalFields: [
    {
      path: 'tags',
      valueKind: 'array',
      operators: ['includes', 'notIncludes', 'exists', 'notExists'],
      valueSuggestions: true,
    },
  ],
  observedFields: [],
  observedFieldsTruncated: false,
};

export const traceQueryTagValues: GetTraceQueryValuesResponse = {
  values: [
    { value: 'manual-review', count: 3 },
    { value: 'production', count: 7 },
  ],
  valuesTruncated: false,
};

export const traceAggregateCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    traceAggregate: true,
  },
};

/** The server can group by status and entity name only. */
export const traceQueryFieldsWithAggregate: GetTraceQueryFieldsResponse = {
  ...emptyTraceQueryFields,
  aggregate: {
    dimensions: [
      { path: 'entityName', valueKind: 'string' },
      { path: 'status', valueKind: 'string' },
    ],
    measures: [{ name: 'count', kind: 'count', unit: 'count', approximate: false }],
  },
};

const groupedTrace = (traceId: string, entityName: string, status: 'success' | 'error') => ({
  ...traceQueryPage.traces[0]!,
  traceId,
  rootSpanId: `span-${traceId}`,
  name: entityName,
  entityName,
  entityType: 'agent',
  status,
});

/** One selection seen two ways: as the trace list and grouped by agent, so counts can be checked against the list. */
export const groupedTraceQueryPage: TraceQueryKeysetTraceResponse = {
  traces: [
    groupedTrace('trace-1', 'support-agent', 'success'),
    groupedTrace('trace-2', 'support-agent', 'error'),
    groupedTrace('trace-3', 'support-agent', 'success'),
    groupedTrace('trace-4', 'billing-agent', 'success'),
  ],
  page: { next: null },
};

export function aggregateByEntityName(page: TraceQueryKeysetTraceResponse): AggregateTracesResponse {
  const groups = new Map<string, { count: number; errors: number }>();
  for (const trace of page.traces) {
    const key = trace.entityName ?? '';
    const group = groups.get(key) ?? { count: 0, errors: 0 };
    group.count += 1;
    if (trace.status === 'error') group.errors += 1;
    groups.set(key, group);
  }
  return {
    rows: [...groups].map(([entityName, { count, errors }]) => ({
      dimensions: { entityName },
      measures: {
        count,
        errorRate: errors / count,
        'duration.p50': 1000,
        'duration.p95': 1000,
        'tokens.input.sum': null,
        'tokens.output.sum': null,
        'cost.sum': null,
      },
      cost: { coverage: null, unit: null },
    })),
    truncated: false,
  };
}
