import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';

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
    traceQueryContextIds: true,
    traceQueryTimeToFirstChunk: true,
    traceQueryRootSpanFields: true,
    traceQueryTimeToFirstChunkSort: true,
    traceAggregate: true,
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
    traceQueryContextIds: false,
    traceQueryTimeToFirstChunk: false,
    traceQueryRootSpanFields: false,
    traceQueryTimeToFirstChunkSort: false,
    traceAggregate: false,
    threadQuery: false,
    spanQuery: false,
  },
};

/** Store runs trace queries but does not declare `trace-aggregate`. */
export const noTraceAggregateCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    ...traceQueryCapabilities.capabilities,
    traceAggregate: false,
  },
};

/** Response from a server released before the `traceAggregate` key existed. */
export const preAggregateCapabilities = {
  observabilityStorageType: 'ObservabilityStorageClickhouseVNext',
  capabilities: Object.fromEntries(
    Object.entries(traceQueryCapabilities.capabilities).filter(([key]) => key !== 'traceAggregate'),
  ),
};

/** Store declares `trace-query` but not `trace-query-root-duration`. */
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
