import type {
  CompareExperimentsResponse,
  DatasetExperimentResult,
  DatasetItem,
  MastraClient,
  RouteResponse,
} from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';
import type { ExperimentUsage } from '@mastra/react/hooks/experiments';
import type { ScoresByItemId } from '../../build-comparison-rows';

export const DATASET_ID = 'dataset-1';
export const BASELINE_ID = 'exp-baseline';
export const CONTENDER_ID = 'exp-contender';
export const CHALLENGER_ID = 'exp-challenger';

/**
 * Comparison payload covering the three interesting shapes:
 * - `item-a`: present in both experiments, scored by both scorers
 * - `item-b`: present in both, contender errored (no output)
 * - `item-c`: only present in the baseline (dataset version drift)
 */
export const comparisonResponse: CompareExperimentsResponse = {
  baselineId: BASELINE_ID,
  items: [
    {
      itemId: 'item-a',
      input: { question: 'What is the capital of France?' },
      groundTruth: { answer: 'Paris' },
      results: {
        [BASELINE_ID]: { output: { answer: 'Paris' }, scores: { accuracy: 0.5, relevancy: 0.9 } },
        [CONTENDER_ID]: { output: { answer: 'Paris, France' }, scores: { accuracy: 0.9, relevancy: 0.9 } },
      },
    },
    {
      itemId: 'item-b',
      input: { question: 'Who wrote Dune?' },
      groundTruth: { answer: 'Frank Herbert' },
      results: {
        [BASELINE_ID]: { output: { answer: 'Frank Herbert' }, scores: { accuracy: 1 } },
        [CONTENDER_ID]: { output: null, scores: { accuracy: null } },
      },
    },
    {
      itemId: 'item-c',
      input: { question: 'Newest item' },
      groundTruth: { answer: '42' },
      results: {
        [BASELINE_ID]: { output: { answer: '42' }, scores: { accuracy: 0.7 } },
        [CONTENDER_ID]: null,
      },
    },
  ],
};

const makeResult = (overrides: Partial<DatasetExperimentResult> & Pick<DatasetExperimentResult, 'id' | 'itemId'>) =>
  ({
    experimentId: BASELINE_ID,
    itemDatasetVersion: 1,
    input: {},
    output: null,
    groundTruth: null,
    metadata: null,
    error: null,
    startedAt: '2026-08-01T10:00:00.000Z',
    completedAt: '2026-08-01T10:00:05.000Z',
    retryCount: 0,
    traceId: `trace-${overrides.id}`,
    status: 'complete',
    tags: null,
    comment: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }) satisfies DatasetExperimentResult;

export const baselineResults: DatasetExperimentResult[] = [
  makeResult({
    id: 'res-baseline-a',
    itemId: 'item-a',
    output: { answer: 'Paris' },
    metadata: { model: 'model-a', temperature: 0 },
    comment: 'Baseline answer is too terse',
  }),
  makeResult({
    id: 'res-baseline-b',
    itemId: 'item-b',
    output: { answer: 'Frank Herbert' },
  }),
  makeResult({
    id: 'res-baseline-c',
    itemId: 'item-c',
    output: { answer: '42' },
  }),
];

export const contenderResults: DatasetExperimentResult[] = [
  makeResult({
    id: 'res-contender-a',
    experimentId: CONTENDER_ID,
    itemId: 'item-a',
    output: { answer: 'Paris, France' },
  }),
  makeResult({
    id: 'res-contender-b',
    experimentId: CONTENDER_ID,
    itemId: 'item-b',
    output: null,
    error: { message: 'Agent run failed: rate limited', stack: 'Error: rate limited\n    at run()' },
  }),
];

/** Per-experiment usage: totals plus per-item usage keyed by trace id. `item-b`'s contender trace has no token metrics (it errored). */
export const baselineUsage: ExperimentUsage = {
  summary: { inputTokens: 210, outputTokens: 40, estimatedCost: 0.0025, costUnit: 'usd' },
  traces: {
    'trace-res-baseline-a': { inputTokens: 120, outputTokens: 30, estimatedCost: 0.0015, costUnit: 'usd' },
    'trace-res-baseline-b': { inputTokens: 90, outputTokens: 10, estimatedCost: 0.001, costUnit: 'usd' },
  },
};

export const contenderUsage: ExperimentUsage = {
  summary: { inputTokens: 200, outputTokens: 60, estimatedCost: 0.004, costUnit: 'usd' },
  traces: {
    'trace-res-contender-a': { inputTokens: 200, outputTokens: 60, estimatedCost: 0.004, costUnit: 'usd' },
  },
};

type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';

/** `POST /api/observability/metrics/breakdown` per experiment, grouped by trace id and metric name. */
export const usageBreakdownByExperimentId: Record<string, MetricBreakdownResponse> = {
  [BASELINE_ID]: {
    groups: [
      {
        dimensions: { traceId: 'trace-res-baseline-a', name: INPUT },
        value: 120,
        estimatedCost: 0.001,
        costUnit: 'usd',
      },
      {
        dimensions: { traceId: 'trace-res-baseline-a', name: OUTPUT },
        value: 30,
        estimatedCost: 0.0005,
        costUnit: 'usd',
      },
    ],
  },
  [CONTENDER_ID]: {
    groups: [
      {
        dimensions: { traceId: 'trace-res-contender-a', name: INPUT },
        value: 200,
        estimatedCost: 0.003,
        costUnit: 'usd',
      },
    ],
  },
};

/** Raw score rows as `GET /api/scores/run/:experimentId` returns them (`entityId` = dataset item id). */
const makeScoreRow = (runId: string, entityId: string, scorerId: string, score: number, reason: string | null) => ({
  id: `score-${runId}-${entityId}-${scorerId}`,
  runId,
  entityId,
  entityType: 'DATASET_ITEM',
  scorerId,
  scorer: { name: scorerId },
  score,
  reason,
  source: 'TEST',
  createdAt: '2026-08-01T10:00:05.000Z',
  updatedAt: '2026-08-01T10:00:05.000Z',
});

export const baselineScoreRows = [
  makeScoreRow(BASELINE_ID, 'item-a', 'accuracy', 0.5, 'Missing the country'),
  makeScoreRow(BASELINE_ID, 'item-a', 'relevancy', 0.9, null),
  makeScoreRow(BASELINE_ID, 'item-b', 'accuracy', 1, 'Exact match'),
  makeScoreRow(BASELINE_ID, 'item-c', 'accuracy', 0.7, null),
];

export const contenderScoreRows = [
  makeScoreRow(CONTENDER_ID, 'item-a', 'accuracy', 0.9, 'Complete answer'),
  makeScoreRow(CONTENDER_ID, 'item-a', 'relevancy', 0.9, null),
];

/** Scorer runs, grouped by dataset item id like `useScoresByExperimentId` returns them. */
export const baselineScores: ScoresByItemId = {
  'item-a': [
    { scorerId: 'accuracy', reason: 'Missing the country', label: 'partial' },
    { scorerId: 'relevancy', reason: null },
  ],
  'item-b': [{ scorerId: 'accuracy', reason: 'Exact match', label: 'exact' }],
  'item-c': [{ scorerId: 'accuracy', reason: null, label: 'partial' }],
};

export const contenderScores: ScoresByItemId = {
  'item-a': [
    { scorerId: 'accuracy', reason: 'Complete answer', label: 'exact' },
    { scorerId: 'relevancy', reason: null },
  ],
};

/**
 * Three-way payload: the two-way one plus a second contender (`CHALLENGER_ID`) that ran
 * `item-a` and `item-b` but not `item-c`.
 */
export const threeWayComparisonResponse: CompareExperimentsResponse = {
  baselineId: BASELINE_ID,
  items: comparisonResponse.items.map(item => ({
    ...item,
    results: {
      ...item.results,
      [CHALLENGER_ID]:
        item.itemId === 'item-a'
          ? { output: { answer: 'Paris' }, scores: { accuracy: 0.6, relevancy: 0.8 } }
          : item.itemId === 'item-b'
            ? { output: { answer: 'Frank Herbert' }, scores: { accuracy: 1 } }
            : null,
    },
  })),
};

/** Dataset items behind the compared rows, as served by `GET /datasets/:datasetId/items/:itemId`. */
export const datasetItemsById: Record<string, DatasetItem> = Object.fromEntries(
  comparisonResponse.items.map(item => [
    item.itemId,
    {
      id: item.itemId,
      datasetId: DATASET_ID,
      datasetVersion: 2,
      input: item.input,
      groundTruth: item.groundTruth,
      metadata: { source: 'trivia-set' },
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
  ]),
);

export const challengerResults: DatasetExperimentResult[] = [
  makeResult({
    id: 'res-challenger-a',
    experimentId: CHALLENGER_ID,
    itemId: 'item-a',
    output: { answer: 'Paris' },
    comment: 'Challenger matches the baseline',
  }),
  makeResult({
    id: 'res-challenger-b',
    experimentId: CHALLENGER_ID,
    itemId: 'item-b',
    output: { answer: 'Frank Herbert' },
  }),
];

export const challengerScoreRows = [
  makeScoreRow(CHALLENGER_ID, 'item-a', 'accuracy', 0.6, 'Close enough'),
  makeScoreRow(CHALLENGER_ID, 'item-a', 'relevancy', 0.8, null),
  makeScoreRow(CHALLENGER_ID, 'item-b', 'accuracy', 1, 'Exact match'),
];

export const challengerScores: ScoresByItemId = {
  'item-a': [
    { scorerId: 'accuracy', reason: 'Close enough' },
    { scorerId: 'relevancy', reason: null },
  ],
  'item-b': [{ scorerId: 'accuracy', reason: 'Exact match' }],
};

type GetTraceResponse = Awaited<ReturnType<MastraClient['getTrace']>>;

/** Trace of the contender's run of `item-a`, opened from its comparison cell. */
export const CONTENDER_TRACE_ID = 'trace-res-contender-a';
export const contenderTraceSpans: GetTraceResponse = {
  traceId: CONTENDER_TRACE_ID,
  spans: [
    {
      traceId: CONTENDER_TRACE_ID,
      spanId: 'span-contender-root',
      name: 'Contender agent run',
      parentSpanId: null,
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: new Date('2026-08-01T10:00:00.000Z'),
      endedAt: new Date('2026-08-01T10:00:05.000Z'),
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      updatedAt: null,
      status: TraceStatus.SUCCESS,
    },
  ],
};

/** The contender's trace has no feedback yet. */
export const contenderTraceFeedback: RouteResponse<'GET /observability/feedback'> = {
  feedback: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};
