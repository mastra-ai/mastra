import type { GetObservabilityCapabilitiesResponse, GetTraceQueryFieldsResponse } from '@mastra/client-js';

export const allCapabilities: GetObservabilityCapabilitiesResponse = {
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
    traceQueryTimeToFirstChunk: true,
    traceQueryTimeToFirstChunkSort: true,
    traceQueryDiscovery: true,
    traceQueryTenantScope: true,
    threadQuery: true,
    threadQueryRows: true,
    spanQuery: true,
    feedback: true,
  },
};

export const noTraceQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  ...allCapabilities,
  capabilities: { ...allCapabilities.capabilities, traceQuery: false },
};

export const noSpanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  ...allCapabilities,
  capabilities: { ...allCapabilities.capabilities, spanQuery: false },
};

/** A store that runs trace queries but does not record when the root streamed its first chunk. */
export const noTimeToFirstChunkCapabilities: GetObservabilityCapabilitiesResponse = {
  ...allCapabilities,
  capabilities: {
    ...allCapabilities.capabilities,
    traceQueryTimeToFirstChunk: false,
    traceQueryTimeToFirstChunkSort: false,
  },
};

const observedField = (path: string, occurrences: number): GetTraceQueryFieldsResponse['observedFields'][number] => ({
  path,
  valueKind: 'string',
  operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
  valueSuggestions: true,
  occurrences,
});

/** Nested paths share a top-level key, so the menu should offer `region` once. */
export const nestedMetadataFields: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    observedField('metadata.tenant', 12),
    observedField('metadata.region.zone', 8),
    observedField('metadata.region.country', 5),
  ],
  observedFieldsTruncated: false,
};

export const discoveryUnsupportedError = {
  code: 'TRACE_QUERY_DISCOVERY_UNSUPPORTED',
  error: 'This store does not support trace query discovery.',
};
