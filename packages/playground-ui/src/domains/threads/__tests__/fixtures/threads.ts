import type { GetObservabilityCapabilitiesResponse, MastraClient } from '@mastra/client-js';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';

export const threadQueryCapabilities: GetObservabilityCapabilitiesResponse = {
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
    threadQueryRows: true,
    spanQuery: true,
    spanQueryContextFields: true,
    feedback: true,
  },
};

export const discoveredEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = {
  names: ['weather-agent', 'support-agent'],
};
export const discoveredEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = {
  environments: ['production'],
};

export const statusAndRunTokens: TraceFilterToken[] = [
  { fieldId: 'status', value: 'error' },
  { fieldId: 'runId', value: 'run-a' },
];

export const entityTypeGroup: TraceFilterGroup = {
  id: 'group-1',
  logic: 'or',
  nodes: [
    { id: 'entityType-1', fieldId: 'entityType', value: 'agent' },
    { id: 'entityType-2', fieldId: 'entityType', value: 'workflow_run' },
  ],
};
