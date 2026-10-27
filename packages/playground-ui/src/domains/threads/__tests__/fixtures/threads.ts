import type { GetObservabilityCapabilitiesResponse, MastraClient, QueryTraceThreadsResult } from '@mastra/client-js';
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

type ThreadRow = QueryTraceThreadsResult['threads'][number];

function makeThread(
  overrides: Partial<ThreadRow> & Pick<ThreadRow, 'threadId' | 'firstTraceId' | 'lastTraceId'>,
): ThreadRow {
  return {
    organizationId: 'org-1',
    resourceId: null,
    userId: null,
    entityType: 'agent',
    entityId: 'weather-agent',
    entityName: 'Weather Agent',
    entityVersionId: null,
    runId: null,
    sessionId: null,
    requestId: null,
    serviceName: null,
    experimentId: null,
    environment: null,
    executionSource: null,
    status: 'success',
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: '2026-10-21T08:05:00.000Z',
    timeToFirstChunkMs: null,
    inputPreview: null,
    outputPreview: null,
    errorPreview: null,
    traceCount: 2,
    ...overrides,
  };
}

/** One page of thread rows, as `POST /observability/threads/query` returns it. */
export const threadRowsPage: QueryTraceThreadsResult = {
  threads: [
    makeThread({ threadId: 'thread-1', firstTraceId: 'trace-1a', lastTraceId: 'trace-1b' }),
    makeThread({
      threadId: 'thread-2',
      firstTraceId: 'trace-2a',
      lastTraceId: 'trace-2b',
      entityId: 'support-agent',
      entityName: 'Support Agent',
    }),
  ],
  page: { next: null },
};

export const emptyThreadRows: QueryTraceThreadsResult = { threads: [], page: { next: null } };

/** Store that cannot return thread rows, so only Traces (and Spans) are offered. */
export const noThreadRowsCapabilities: GetObservabilityCapabilitiesResponse = {
  ...threadQueryCapabilities,
  capabilities: { ...threadQueryCapabilities.capabilities, threadQueryRows: false },
};
