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

/** Totals with no groupBy: the tokens KPI's current window. */
export const tokenTotalsFixture: AggregateTracesResponse = {
  rows: [{ measures: { 'tokens.input.sum': 9_000, 'tokens.output.sum': 3_000 } }],
  truncated: false,
};

/** The tokens KPI's previous window. */
export const previousTokenTotalsFixture: AggregateTracesResponse = {
  rows: [{ measures: { 'tokens.input.sum': 6_000, 'tokens.output.sum': 2_000 } }],
  truncated: false,
};

/** No usage-bearing traces: token sums are null. */
export const emptyTokenTotalsFixture: AggregateTracesResponse = {
  rows: [{ measures: { 'tokens.input.sum': null, 'tokens.output.sum': null } }],
  truncated: false,
};

export const emptyTraceAggregateFixture: AggregateTracesResponse = { rows: [], truncated: false };

export const traceAggregateErrorFixture = { error: 'Trace aggregation failed' };
