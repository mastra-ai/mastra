import type {
  AggregateSpansResponse,
  GetObservabilityCapabilitiesResponse,
  MastraClient,
  QuerySpansResult,
} from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import type { SpanSelection } from '../../components/span-detail-panel';

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

export const spanQueryCoreOnlyCapabilities: GetObservabilityCapabilitiesResponse = {
  ...spanQueryCapabilities,
  capabilities: { ...spanQueryCapabilities.capabilities, spanQueryContextFields: false },
};

export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { entityNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };

export const spanTimeRange = { from: '2026-10-15T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' };

export const statusAndTraceTokens: TraceFilterToken[] = [
  { fieldId: 'status', value: 'error' },
  { fieldId: 'traceId', value: 'trace-a' },
];

export const spanTypeGroup: TraceFilterGroup = {
  id: 'group-1',
  logic: 'or',
  nodes: [
    { id: 'spanType-1', fieldId: 'spanType', value: 'agent_run' },
    { id: 'spanType-2', fieldId: 'spanType', value: 'tool_call' },
  ],
};

/** Three spans in list order, as a host's spans table would hand them to the detail panel. */
export const firstListedSpan: SpanSelection = { traceId: 'trace-1', spanId: 'span-1' };
export const middleListedSpan: SpanSelection = { traceId: 'trace-1', spanId: 'span-2' };
export const lastListedSpan: SpanSelection = { traceId: 'trace-2', spanId: 'span-3' };

export const listedSpans: SpanSelection[] = [firstListedSpan, middleListedSpan, lastListedSpan];

const detailSpan = {
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  parentSpanId: null,
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
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'agent run: weather',
      sessionId: 'session-weather-42',
    },
  },
  'span-2': {
    span: {
      ...detailSpan,
      traceId: 'trace-1',
      spanId: 'span-2',
      name: 'tool: get-weather',
      spanType: SpanType.TOOL_CALL,
      parentSpanId: 'span-1',
    },
  },
  'span-3': {
    span: {
      ...detailSpan,
      traceId: 'trace-2',
      spanId: 'span-3',
      name: 'workflow run: onboarding',
      spanType: SpanType.WORKFLOW_RUN,
    },
  },
};

type SpanRow = QuerySpansResult['spans'][number];

export function makeSpan(overrides: Partial<SpanRow> & Pick<SpanRow, 'traceId' | 'spanId' | 'name'>): SpanRow {
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

/** One page of span rows, as `POST /observability/spans/query` returns it. */
export const spanRowsPage: QuerySpansResult = {
  spans: [
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'agent run: weather',
      model: 'gpt-5.6',
      provider: 'openai',
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
  page: { next: null },
};

export const emptySpanRows: QuerySpansResult = { spans: [], page: { next: null } };

/** A span that ended after the list loaded, newer than every listed span. */
export const endedSpan = makeSpan({
  traceId: 'trace-9',
  spanId: 'span-9',
  name: 'agent run: fresh',
  startedAt: '2026-10-21T09:00:00.000Z',
  endedAt: '2026-10-21T09:00:02.000Z',
});

/** A head poll (`endedAt desc`) that brings the ended span back with a span the list already shows. */
export const spanHeadPage: QuerySpansResult = { spans: [endedSpan, spanRowsPage.spans[0]], page: { next: null } };

/** A full head page whose spans all ended after `endedAfter`, so spans may be missing between polls. */
export function fullSpanHeadPage(limit: number, endedAfter: string): QuerySpansResult {
  const base = Date.parse(endedAfter);
  return {
    spans: Array.from({ length: limit }, (_, index) => {
      const endedAt = new Date(base + (limit - index) * 1000).toISOString();
      return makeSpan({
        traceId: `trace-burst-${index}`,
        spanId: `span-burst-${index}`,
        name: `burst ${index}`,
        startedAt: endedAt,
        endedAt,
      });
    }),
    page: { next: 'burst-cursor' },
  };
}

/** A store that answers `aggregateSpans()` next to the span query API. */
export const spanAggregateCapabilities: GetObservabilityCapabilitiesResponse = {
  ...spanQueryCapabilities,
  capabilities: { ...spanQueryCapabilities.capabilities, spanAggregate: true },
};

const HOUR = 60 * 60 * 1000;

const hourBefore = (timeRange: { to: string }, hoursAgo: number) =>
  new Date((Math.floor(Date.parse(timeRange.to) / HOUR) - hoursAgo) * HOUR).toISOString();

/** Two hourly buckets near the end of the window: 12 spans (2 failed), then 9 spans (1 failed). */
export function spanCountsAggregate(timeRange: { to: string }): AggregateSpansResponse {
  return {
    rows: [
      { bucket: hourBefore(timeRange, 3), measures: { count: 12, errorCount: 2 } },
      { bucket: hourBefore(timeRange, 2), measures: { count: 9, errorCount: 1 } },
    ],
    truncated: false,
  };
}

export const spanAggregateError = { error: 'Span aggregation failed' };
