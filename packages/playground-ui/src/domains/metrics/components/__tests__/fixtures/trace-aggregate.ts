import type { AggregateTracesResponse, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';

const baseCapabilities: GetObservabilityCapabilitiesResponse = {
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

/** A server that answers `aggregateTraces()`, including root span fields. */
export const traceAggregateCapabilities: GetObservabilityCapabilitiesResponse = {
  ...baseCapabilities,
  capabilities: { ...baseCapabilities.capabilities, traceAggregate: true, traceQueryRootSpanFields: true },
};

/** A server from before trace aggregation: no `traceAggregate` capability at all. */
export const olderServerCapabilities: GetObservabilityCapabilitiesResponse = baseCapabilities;

export const emptyTraceAggregateFixture: AggregateTracesResponse = { rows: [], truncated: false };

export const traceAggregateErrorFixture = { error: 'Trace aggregation failed' };
