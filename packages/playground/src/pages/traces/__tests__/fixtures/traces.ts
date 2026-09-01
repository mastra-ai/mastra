import type { GetScoresScorers_Response, GetSystemPackagesResponse, MastraClient } from '@mastra/client-js';
import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type ListBranchesResponse = Awaited<ReturnType<MastraClient['listBranches']>>;
type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetBranchResponse = Awaited<ReturnType<MastraClient['getBranch']>>;
type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

const baseSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: true,
};

export const metricsCapableSystemPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: { metrics: true, logs: true },
};

export const metricsUnavailableSystemPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: { metrics: false, logs: true },
};

const trace = {
  traceId: 'trace-a',
  spanId: 'span-a',
  name: 'Studio preview agent',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-07-31T12:00:00.000Z'),
  endedAt: new Date('2026-07-31T12:00:01.000Z'),
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const traceList: ListTracesResponse = {
  spans: [trace],
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
};

export const traceListWithTwoTraces: ListTracesResponse = {
  spans: [trace, { ...trace, traceId: 'trace-b', spanId: 'span-b' }],
  pagination: { total: 2, page: 0, perPage: 25, hasMore: false },
};

export const branchList: ListBranchesResponse = {
  branches: [{ ...trace, parentSpanId: 'root-span' }],
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
};

export const rootBranchList: ListBranchesResponse = {
  branches: [{ ...trace, parentSpanId: null }],
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
};

export const traceUsageBreakdown: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
      value: 100,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
  ],
};

export const traceSpans: GetTraceResponse = {
  traceId: 'trace-a',
  spans: [{ ...trace, parentSpanId: null }],
};

export const rootBranchSpans: GetBranchResponse = {
  traceId: 'trace-a',
  spans: [{ ...trace, parentSpanId: null }],
};

export const subtraceBranchSpans: GetBranchResponse = {
  traceId: 'trace-a',
  spans: [{ ...trace, parentSpanId: 'root-span' }],
};

const baseScore: ScoreRowData = {
  id: 'score-1',
  scorerId: 'relevance-scorer',
  entityId: 'agent-1',
  runId: 'run-1',
  output: { text: 'ok' },
  score: 0.4,
  scorer: { id: 'relevance-scorer', name: 'Relevance' },
  source: 'LIVE',
  entity: { id: 'agent-1' },
  traceId: 'trace-a',
  spanId: 'span-a',
  createdAt: new Date('2026-07-31T12:00:02.000Z'),
  updatedAt: null,
};

export const traceSpanScores: ListScoresResponse = {
  scores: [
    baseScore,
    { ...baseScore, id: 'score-2', score: 0.8, createdAt: new Date('2026-07-31T12:00:03.000Z') },
    {
      ...baseScore,
      id: 'score-3',
      score: 1,
      scorer: { id: 'toxicity-scorer', name: 'Toxicity' },
      createdAt: new Date('2026-07-31T12:00:04.000Z'),
    },
  ],
  pagination: { total: 3, page: 0, perPage: 10, hasMore: false },
};

export const emptyTraceSpanScores: ListScoresResponse = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

export const emptyFeedback: ListFeedbackResponse = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

export const emptyScorers: GetScoresScorers_Response = {};
export const emptyTags: Awaited<ReturnType<MastraClient['getTags']>> = { tags: [] };
export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { entityNames: [] };
export const emptyServiceNames: Awaited<ReturnType<MastraClient['getServiceNames']>> = { serviceNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };
