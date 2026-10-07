import type {
  GetObservabilityCapabilitiesResponse,
  QueryTraceThreadsResult,
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

export const noThreadQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    threadQuery: false,
  },
};

export const traceThreadsPage: QueryTraceThreadsResult = {
  threads: [{ threadId: 'thread-chef' }],
  page: { next: null },
};

/** The two turns of `thread-chef`, oldest first, as the thread panel loads them. */
export const chefThreadTraces: TraceQueryKeysetTraceResponse = {
  traces: [
    {
      ...traceQueryPage.traces[0]!,
      traceId: 'trace-chef-1',
      rootSpanId: 'span-chef-1',
      entityName: 'Chef Agent',
      entityType: 'agent',
      threadId: 'thread-chef',
      inputPreview: 'I have eggs and spinach',
      startedAt: '2026-09-15T12:00:00.000Z',
      endedAt: '2026-09-15T12:00:05.000Z',
    },
    {
      ...traceQueryPage.traces[0]!,
      traceId: 'trace-chef-2',
      rootSpanId: 'span-chef-2',
      entityName: 'Chef Agent',
      entityType: 'agent',
      threadId: 'thread-chef',
      inputPreview: 'Make it vegetarian',
      startedAt: '2026-09-15T12:01:00.000Z',
      endedAt: '2026-09-15T12:01:10.000Z',
    },
  ],
  page: { next: null },
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
