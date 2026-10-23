import type {
  GetObservabilityCapabilitiesResponse,
  MastraClient,
  McpServerListResponse,
  QueryTraceThreadsResult,
  TraceQueryKeysetTraceResponse,
} from '@mastra/client-js';
import type { ListScoresResponse } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ThreadRow = QueryTraceThreadsResult['threads'][number];

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

/** A store that lists thread ids but cannot return thread rows (no `thread-query-rows` feature). */
export const noThreadRowsCapabilities: GetObservabilityCapabilitiesResponse = {
  ...threadQueryCapabilities,
  capabilities: { ...threadQueryCapabilities.capabilities, threadQueryRows: false },
};

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
    model: null,
    provider: null,
    ...overrides,
  };
}

export const THREADS_PAGE_TWO_CURSOR = 'thread-cursor-page-two';

export const threadsFirstPage: QueryTraceThreadsResult = {
  threads: [
    makeThread({ threadId: 'thread-1', firstTraceId: 'trace-1a', lastTraceId: 'trace-1b' }),
    makeThread({
      threadId: 'thread-2',
      firstTraceId: 'trace-2a',
      lastTraceId: 'trace-2b',
      entityId: 'support-agent',
      entityName: 'Support Agent',
      traceCount: 4,
    }),
  ],
  page: { next: THREADS_PAGE_TWO_CURSOR },
};

export const threadsLastPage: QueryTraceThreadsResult = {
  threads: [
    makeThread({
      threadId: 'thread-3',
      firstTraceId: 'trace-3a',
      lastTraceId: 'trace-3a',
      entityType: 'workflow_run',
      entityId: 'onboarding',
      entityName: 'Onboarding Workflow',
      traceCount: 1,
      status: 'error',
    }),
  ],
  page: { next: null },
};

export const emptyThreads: QueryTraceThreadsResult = { threads: [], page: { next: null } };

/** The full-thread drawer's trace query, answered with no turns so it settles on its empty state. */
export const emptyThreadTraces: TraceQueryKeysetTraceResponse = { traces: [], page: { next: null } };

export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { names: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

const SUPPORT_TURN_TRACE_ID = 'thread-2-trace-1';
const SUPPORT_TURN_SPAN_ID = 'thread-2-span-1';

/** The one turn of thread-2, as the full-thread drawer's trace query returns it. */
export const supportThreadTurns: TraceQueryKeysetTraceResponse = {
  traces: [
    {
      traceId: SUPPORT_TURN_TRACE_ID,
      rootSpanId: SUPPORT_TURN_SPAN_ID,
      name: 'Support agent run',
      startedAt: '2026-10-21T08:00:00.000Z',
      endedAt: '2026-10-21T08:00:01.000Z',
      createdAt: '2026-10-21T08:00:00.000Z',
      status: 'success',
      entityId: 'support-agent',
      entityName: 'Support Agent',
      entityType: 'agent',
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
      threadId: 'thread-2',
      resourceId: null,
      environment: null,
    },
  ],
  page: { next: null },
};

export const supportTurnSpans: GetTraceResponse = {
  traceId: SUPPORT_TURN_TRACE_ID,
  spans: [
    {
      traceId: SUPPORT_TURN_TRACE_ID,
      spanId: SUPPORT_TURN_SPAN_ID,
      parentSpanId: null,
      name: 'Support agent run',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      threadId: 'thread-2',
      input: { messages: [{ role: 'user', content: 'reset my password' }] },
      output: { text: 'Done' },
      startedAt: new Date('2026-10-21T08:00:00.000Z'),
      endedAt: new Date('2026-10-21T08:00:01.000Z'),
      createdAt: new Date('2026-10-21T08:00:00.000Z'),
      updatedAt: null,
      status: TraceStatus.SUCCESS,
    },
  ],
};

export const supportTurnScores: ListScoresResponse = {
  scores: [
    {
      id: 'score-1',
      scorerId: 'helpfulness-scorer',
      entityId: 'support-agent',
      runId: 'run-1',
      output: { text: 'Done' },
      score: 0.8,
      scorer: { id: 'helpfulness-scorer', name: 'Helpfulness' },
      source: 'LIVE',
      entity: { id: 'support-agent' },
      traceId: SUPPORT_TURN_TRACE_ID,
      spanId: SUPPORT_TURN_SPAN_ID,
      createdAt: new Date('2026-10-21T08:00:02.000Z'),
      updatedAt: null,
    },
  ],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

/** The turn's messages resolve tool names against the MCP servers; there are none here. */
export const emptyMcpServers: McpServerListResponse = { servers: [], next: null, total_count: 0 };
