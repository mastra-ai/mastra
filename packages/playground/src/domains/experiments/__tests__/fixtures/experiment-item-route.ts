import type {
  DatasetExperiment,
  DatasetExperimentResult,
  ListScoresResponse,
  MastraClient,
  RouteResponse,
} from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus, type PaginationInfo } from '@mastra/core/storage';

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;
type GetSpanResponse = Awaited<ReturnType<MastraClient['getSpan']>>;

export const DATASET_ID = 'ds-1';
export const EXPERIMENT_ID = 'exp-1';
export const TRACE_ID = 'experiment-trace-1';

const baseSpan = {
  traceId: TRACE_ID,
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-07-21T00:00:10.000Z'),
  endedAt: new Date('2026-07-21T00:00:20.000Z'),
  createdAt: new Date('2026-07-21T00:00:10.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const experimentTraceRootSpan = {
  ...baseSpan,
  spanId: 'experiment-span-root',
  name: 'Experiment agent run',
  parentSpanId: null,
};
export const experimentTraceChildSpan = {
  ...baseSpan,
  spanId: 'experiment-span-child',
  name: 'Experiment tool call',
  spanType: SpanType.TOOL_CALL,
  parentSpanId: experimentTraceRootSpan.spanId,
};
export const experimentTraceSpans: GetTraceResponse = {
  traceId: TRACE_ID,
  spans: [experimentTraceRootSpan, experimentTraceChildSpan],
};
export const experimentSpanDetailById: Record<string, GetSpanResponse> = {
  [experimentTraceRootSpan.spanId]: {
    span: { ...experimentTraceRootSpan, input: { q: 'first question' }, output: { a: 'first answer' } },
  },
  [experimentTraceChildSpan.spanId]: {
    span: { ...experimentTraceChildSpan, input: { query: 'Mastra' }, output: { found: true } },
  },
};

export {
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';

const pagination = (total: number): PaginationInfo => ({
  total,
  page: 0,
  perPage: 100,
  hasMore: false,
});

export const experiment: DatasetExperiment = {
  id: EXPERIMENT_ID,
  datasetId: DATASET_ID,
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  name: 'entity-extraction / model-a',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: null,
  status: 'completed',
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-07-21T00:00:00.000Z',
  completedAt: '2026-07-21T00:01:00.000Z',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:01:00.000Z',
};

export const experimentsResponse: { experiments: DatasetExperiment[]; pagination: PaginationInfo } = {
  experiments: [experiment],
  pagination: pagination(1),
};

const baseResult: DatasetExperimentResult = {
  id: 'res-1',
  experimentId: EXPERIMENT_ID,
  itemId: 'item-1',
  itemDatasetVersion: 1,
  input: { q: 'first question' },
  output: { a: 'first answer' },
  groundTruth: null,
  error: null,
  startedAt: '2026-07-21T00:00:10.000Z',
  completedAt: '2026-07-21T00:00:20.000Z',
  retryCount: 0,
  traceId: TRACE_ID,
  status: null,
  tags: [],
  comment: null,
  scores: [],
  createdAt: '2026-07-21T00:00:20.000Z',
};

/** Three results, itemIds item-1..item-3, result ids res-1..res-3. */
export const results: DatasetExperimentResult[] = [
  baseResult,
  { ...baseResult, id: 'res-2', itemId: 'item-2', input: { q: 'second question' }, output: { a: 'second answer' } },
  {
    ...baseResult,
    id: 'res-3',
    itemId: 'item-3',
    input: { q: 'third question' },
    output: { a: 'third answer' },
    status: 'needs-review',
  },
];

export const resultsResponse: { results: DatasetExperimentResult[]; pagination: PaginationInfo } = {
  results,
  pagination: pagination(results.length),
};

export const emptyScoresResponse: ListScoresResponse = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};

export const experimentTraceFeedback: RouteResponse<'GET /observability/feedback'> = {
  feedback: [
    {
      feedbackId: 'experiment-trace-feedback',
      traceId: TRACE_ID,
      feedbackType: 'comment',
      value: 'Trace feedback for the experiment run',
      timestamp: new Date('2026-07-21T00:00:21.000Z'),
    },
  ],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

export const experimentSpanFeedback: RouteResponse<'GET /observability/feedback'> = {
  feedback: [
    {
      feedbackId: 'experiment-span-feedback',
      traceId: TRACE_ID,
      spanId: experimentTraceChildSpan.spanId,
      feedbackType: 'comment',
      value: 'Child span feedback for the tool call',
      timestamp: new Date('2026-07-21T00:00:22.000Z'),
    },
  ],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

export const experimentTraceScores: ListScoresResponse = {
  scores: [
    {
      id: 'experiment-trace-score',
      scorerId: 'experiment-scorer',
      entityId: 'agent-1',
      runId: 'experiment-run-1',
      output: { reason: 'Relevant answer' },
      score: 0.9,
      scorer: { id: 'experiment-scorer', name: 'Experiment relevance' },
      source: 'LIVE',
      entity: { id: 'agent-1' },
      traceId: TRACE_ID,
      spanId: experimentTraceRootSpan.spanId,
      createdAt: new Date('2026-07-21T00:00:23.000Z'),
      updatedAt: null,
    },
  ],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

export const experimentResultScoresResponse: ListScoresResponse = {
  scores: experimentTraceScores.scores.map(score => ({
    ...score,
    entityId: 'item-1',
    reason: 'Matches the experiment result score',
    scorer: { ...score.scorer, hasJudge: false },
  })),
  pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
};
