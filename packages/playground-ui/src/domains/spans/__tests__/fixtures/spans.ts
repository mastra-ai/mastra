import type { GetObservabilityCapabilitiesResponse, MastraClient } from '@mastra/client-js';
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
