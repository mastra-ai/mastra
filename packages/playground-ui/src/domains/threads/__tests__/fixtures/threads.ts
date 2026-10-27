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

/** The window the thread lists below are queried over. */
export const threadTimeRange = { from: '2026-10-15T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' };

/** `thread-1` after a third trace landed on it: same start, later end, one more trace. */
export const continuedThread = makeThread({
  threadId: 'thread-1',
  firstTraceId: 'trace-1a',
  lastTraceId: 'trace-1c',
  endedAt: '2026-10-21T09:00:05.000Z',
  traceCount: 3,
});

/** A thread that started after the list loaded. */
export const startedThread = makeThread({
  threadId: 'thread-3',
  firstTraceId: 'trace-3a',
  lastTraceId: 'trace-3a',
  startedAt: '2026-10-21T09:00:00.000Z',
  endedAt: '2026-10-21T09:00:02.000Z',
  traceCount: 1,
});

/** A head poll (newest `endedAt` first): one continued thread and one new thread. */
export const threadHeadPage: QueryTraceThreadsResult = {
  threads: [continuedThread, startedThread],
  page: { next: null },
};

/** A full head page where every thread ended after `endedAfter`, so the poll may have missed some. */
export function fullThreadHeadPage(limit: number, endedAfter: string): QueryTraceThreadsResult {
  const base = Date.parse(endedAfter);
  return {
    threads: Array.from({ length: limit }, (_, index) => {
      const endedAt = new Date(base + (limit - index) * 1000).toISOString();
      return makeThread({
        threadId: `thread-burst-${index}`,
        firstTraceId: `trace-burst-${index}`,
        lastTraceId: `trace-burst-${index}`,
        startedAt: endedAt,
        endedAt,
      });
    }),
    page: { next: 'burst-cursor' },
  };
}

/** Store that cannot return thread rows, so only Traces (and Spans) are offered. */
export const noThreadRowsCapabilities: GetObservabilityCapabilitiesResponse = {
  ...threadQueryCapabilities,
  capabilities: { ...threadQueryCapabilities.capabilities, threadQueryRows: false },
};
