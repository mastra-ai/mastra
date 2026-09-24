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
    threadQuery: true,
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
  },
};
