import type { GetObservabilityCapabilitiesResponse, ListScoresResponseNew, MastraClient } from '@mastra/client-js';

export const unsupportedStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityLibSQL',
  capabilities: { metrics: false, logs: false, traceQueryDiscovery: false },
};

export const supportedStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityInMemory',
  capabilities: { metrics: true, logs: true, traceQueryDiscovery: false },
};

export const traceAggregateOnlyStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageClickhouseVNext',
  capabilities: { metrics: true, logs: true, traceQueryDiscovery: true, traceAggregate: true },
};

export const aggregateStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageClickhouseVNext',
  capabilities: { metrics: true, logs: true, traceQueryDiscovery: true, traceAggregate: true, spanAggregate: true },
};

export const emptyTraceAggregate: Awaited<ReturnType<MastraClient['aggregateTraces']>> = { rows: [], truncated: false };

export const aggregate: Awaited<ReturnType<MastraClient['getMetricAggregate']>> = { value: 0 };
export const breakdown: Awaited<ReturnType<MastraClient['getMetricBreakdown']>> = { rows: [], truncated: false };
export const timeSeries: Awaited<ReturnType<MastraClient['getMetricTimeSeries']>> = { series: [] };
export const percentiles: Awaited<ReturnType<MastraClient['getMetricPercentiles']>> = { series: [] };
export const emptyTags: Awaited<ReturnType<MastraClient['getTags']>> = { tags: [] };
export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { names: [] };
export const emptyServiceNames: Awaited<ReturnType<MastraClient['getServiceNames']>> = { serviceNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };

export const emptyScores: ListScoresResponseNew = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};

export const environments: Awaited<ReturnType<MastraClient['getEnvironments']>> = {
  environments: ['production', 'staging'],
};
export const tags: Awaited<ReturnType<MastraClient['getTags']>> = { tags: ['beta', 'support'] };

/** Runs of one agent that only ever runs nested in other agents' traces. */
export const nestedAgentRuns: Awaited<ReturnType<MastraClient['aggregateSpans']>> = {
  rows: [
    {
      dimensions: { entityName: 'Explore Subagent' },
      measures: { count: 120, errorCount: 2, errorRate: 2 / 120, 'duration.p95': 900 },
    },
  ],
  truncated: false,
};
