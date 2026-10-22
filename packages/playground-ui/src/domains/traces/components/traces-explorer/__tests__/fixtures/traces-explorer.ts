import type {
  GetObservabilityCapabilitiesResponse,
  GetScoresScorers_Response,
  GetTraceQueryFieldsResponse,
  MastraClient,
  TraceQueryKeysetTraceResponse,
  TraceQueryResponse,
} from '@mastra/client-js';
import type { ListScoresResponse } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;
type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

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
    spanQuery: true,
    feedback: true,
  },
};

export const noRootDurationCapabilities: GetObservabilityCapabilitiesResponse = {
  ...traceQueryCapabilities,
  capabilities: { ...traceQueryCapabilities.capabilities, traceQueryRootDuration: false },
};

export const noSpanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  ...traceQueryCapabilities,
  capabilities: { ...traceQueryCapabilities.capabilities, spanQuery: false },
};

export const noDeltaPollingCapabilities: GetObservabilityCapabilitiesResponse = {
  ...traceQueryCapabilities,
  capabilities: { ...traceQueryCapabilities.capabilities, deltaPolling: false },
};

export const emptyTraceQueryFields: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [],
  observedFieldsTruncated: false,
};

const weatherTrace: TraceQueryKeysetTraceResponse['traces'][number] = {
  traceId: 'trace-weather',
  rootSpanId: 'span-weather',
  name: 'weather-agent',
  createdAt: '2026-09-15T12:00:00.000Z',
  startedAt: '2026-09-15T12:00:00.000Z',
  endedAt: '2026-09-15T12:00:01.000Z',
  status: 'success',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  entityType: 'agent',
  environment: null,
  parentSpanId: null,
  metadata: null,
  inputPreview: 'What is the weather in Paris?',
  threadId: null,
  resourceId: null,
};

export const twoTracesPage: TraceQueryKeysetTraceResponse = {
  traces: [
    weatherTrace,
    {
      ...weatherTrace,
      traceId: 'trace-booking',
      rootSpanId: 'span-booking',
      startedAt: '2026-09-15T11:00:00.000Z',
      createdAt: '2026-09-15T11:00:00.000Z',
      inputPreview: 'Book a table for two',
    },
  ],
  page: { next: null },
};

export const emptyTracesPage: TraceQueryKeysetTraceResponse = { traces: [], page: { next: null } };

/** A delta poll with nothing new since the cursor. */
export const idleDeltaBatch: Extract<TraceQueryResponse, { delta: unknown }> = {
  traces: [],
  delta: { limit: 100, hasMore: false },
  deltaCursor: 'delta-cursor-idle',
};

export const emptyLightTraces: Awaited<ReturnType<MastraClient['listTracesLight']>> = {
  spans: [],
  pagination: { total: 0, page: 0, perPage: 25, hasMore: false },
};

export const weatherTraceSpans: GetTraceResponse = {
  traceId: 'trace-weather',
  spans: [
    {
      traceId: 'trace-weather',
      spanId: 'span-weather',
      parentSpanId: null,
      name: 'weather-agent',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: new Date('2026-09-15T12:00:00.000Z'),
      endedAt: new Date('2026-09-15T12:00:01.000Z'),
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      updatedAt: null,
      status: TraceStatus.SUCCESS,
    },
  ],
};

export const weatherRootSpan: GetSpanResponse = { span: weatherTraceSpans.spans[0] };

export const weatherTraceUsage: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { traceId: 'trace-weather', name: 'mastra_model_total_input_tokens' },
      value: 1234,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
  ],
};

export const emptyScores: ListScoresResponse = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

export const emptyFeedback: ListFeedbackResponse = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

export const emptyScorers: GetScoresScorers_Response = {};
export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { entityNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };
export const emptyDatasets: Awaited<ReturnType<MastraClient['listDatasets']>> = {
  datasets: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};
