import type { GetObservabilityCapabilitiesResponse, MastraClient } from '@mastra/client-js';

export const unsupportedStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityLibSQL',
  capabilities: { metrics: false, logs: false, traceQueryDiscovery: false },
};

export const supportedStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityInMemory',
  capabilities: { metrics: true, logs: true, traceQueryDiscovery: false },
};

export const aggregate: Awaited<ReturnType<MastraClient['getMetricAggregate']>> = { value: 0 };
export const breakdown: Awaited<ReturnType<MastraClient['getMetricBreakdown']>> = { groups: [] };
export const timeSeries: Awaited<ReturnType<MastraClient['getMetricTimeSeries']>> = { series: [] };
export const percentiles: Awaited<ReturnType<MastraClient['getMetricPercentiles']>> = { series: [] };
export const emptyTags: Awaited<ReturnType<MastraClient['getTags']>> = { tags: [] };
export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { names: [] };
export const emptyServiceNames: Awaited<ReturnType<MastraClient['getServiceNames']>> = { serviceNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };
