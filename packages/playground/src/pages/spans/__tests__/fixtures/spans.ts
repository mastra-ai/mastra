import type {
  GetObservabilityCapabilitiesResponse,
  MastraClient,
  QuerySpansResult,
  QueryTraceThreadsResult,
} from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type SpanRow = QuerySpansResult['spans'][number];

export const spanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
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
    spanQueryContextFields: true,
    feedback: true,
  },
};

/** Span queries without the identity/context fields (no `span-query-context-fields` feature). */
export const spanQueryCoreOnlyCapabilities: GetObservabilityCapabilitiesResponse = {
  ...spanQueryCapabilities,
  capabilities: { ...spanQueryCapabilities.capabilities, spanQueryContextFields: false },
};

/** Store that also returns thread rows, so Studio can offer the threads view. */
export const spanAndThreadRowsCapabilities: GetObservabilityCapabilitiesResponse = {
  ...spanQueryCapabilities,
  capabilities: { ...spanQueryCapabilities.capabilities, threadQueryRows: true },
};

export const noSpanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageLibSQL',
  capabilities: {
    ...spanQueryCapabilities.capabilities,
    traceQuery: false,
    traceQueryRootDuration: false,
    traceQueryDiscovery: false,
    traceQueryTenantScope: false,
    threadQuery: false,
    spanQuery: false,
    spanQueryContextFields: false,
  },
};

function makeSpan(overrides: Partial<SpanRow> & Pick<SpanRow, 'traceId' | 'spanId' | 'name'>): SpanRow {
  return {
    organizationId: null,
    resourceId: null,
    parentSpanId: null,
    spanType: 'agent_run',
    status: 'success',
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: '2026-10-21T08:00:01.000Z',
    durationMs: 1000,
    entityType: 'agent',
    entityId: 'weather-agent',
    entityName: 'Weather Agent',
    entityVersionId: null,
    parentEntityType: null,
    parentEntityId: null,
    parentEntityName: null,
    parentEntityVersionId: null,
    rootEntityType: null,
    rootEntityId: null,
    rootEntityName: null,
    rootEntityVersionId: null,
    threadId: null,
    runId: null,
    sessionId: null,
    userId: null,
    requestId: null,
    serviceName: null,
    experimentId: null,
    environment: null,
    executionSource: null,
    model: null,
    provider: null,
    inputPreview: null,
    outputPreview: null,
    errorPreview: null,
    ...overrides,
  };
}

export const SPANS_PAGE_TWO_CURSOR = 'cursor-page-two';

export const spansFirstPage: QuerySpansResult = {
  spans: [
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'agent run: weather',
      entityName: 'Weather Agent',
    }),
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-2',
      parentSpanId: 'span-1',
      name: 'tool: get-weather',
      spanType: 'tool_call',
      entityType: 'tool',
      entityId: 'get-weather',
      entityName: 'Get Weather Tool',
    }),
  ],
  page: { next: SPANS_PAGE_TWO_CURSOR },
};

export const spansLastPage: QuerySpansResult = {
  spans: [
    makeSpan({
      traceId: 'trace-2',
      spanId: 'span-3',
      name: 'workflow run: onboarding',
      spanType: 'workflow_run',
      entityType: 'workflow_run',
      entityId: 'onboarding',
      entityName: 'Onboarding Workflow',
    }),
  ],
  page: { next: null },
};

export const emptySpans: QuerySpansResult = { spans: [], page: { next: null } };

const detailSpan = {
  traceId: 'trace-1',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-10-21T08:00:00.000Z'),
  endedAt: new Date('2026-10-21T08:00:01.000Z'),
  createdAt: new Date('2026-10-21T08:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

/** Full span records served by `GET /observability/traces/:traceId/spans/:spanId`, keyed by span id. */
export const spanDetailById: Record<string, Awaited<ReturnType<MastraClient['getSpan']>>> = {
  'span-1': {
    span: {
      ...detailSpan,
      spanId: 'span-1',
      name: 'agent run: weather',
      parentSpanId: null,
      sessionId: 'session-weather-42',
    },
  },
  'span-2': {
    span: {
      ...detailSpan,
      spanId: 'span-2',
      name: 'tool: get-weather',
      spanType: SpanType.TOOL_CALL,
      parentSpanId: 'span-1',
      error: { message: 'Weather API timed out' },
      status: TraceStatus.ERROR,
    },
  },
};

export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { entityNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };

/** Thread list returned after switching from Spans to Threads. */
export const emptyThreads: QueryTraceThreadsResult = { threads: [], page: { next: null } };
