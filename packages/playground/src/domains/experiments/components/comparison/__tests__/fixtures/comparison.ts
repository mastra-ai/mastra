import type { CompareExperimentsResponse, DatasetExperimentResult } from '@mastra/client-js';
import type { ScoresByItemId } from '../../build-comparison-rows';

export const DATASET_ID = 'dataset-1';
export const BASELINE_ID = 'exp-baseline';
export const CONTENDER_ID = 'exp-contender';

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
    traceId: null,
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
    { scorerId: 'accuracy', reason: 'Missing the country' },
    { scorerId: 'relevancy', reason: null },
  ],
  'item-b': [{ scorerId: 'accuracy', reason: 'Exact match' }],
  'item-c': [{ scorerId: 'accuracy', reason: null }],
};

export const contenderScores: ScoresByItemId = {
  'item-a': [
    { scorerId: 'accuracy', reason: 'Complete answer' },
    { scorerId: 'relevancy', reason: null },
  ],
};
