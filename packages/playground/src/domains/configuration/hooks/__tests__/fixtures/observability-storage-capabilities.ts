import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';

export const renamedPostgresWithMetrics: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: '_ObservabilityStoragePostgresVNext',
  capabilities: {
    metrics: true,
    logs: true,
    traceQueryDiscovery: false,
  },
};

export const storageWithoutMetrics: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  capabilities: {
    metrics: false,
    logs: true,
    traceQueryDiscovery: false,
  },
};

export const inMemoryStorage: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityInMemory',
  capabilities: {
    metrics: true,
    logs: true,
    traceQueryDiscovery: false,
  },
};
