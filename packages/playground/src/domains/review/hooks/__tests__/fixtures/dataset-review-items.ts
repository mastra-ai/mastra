import type { DatasetExperiment, DatasetExperimentResult } from '@mastra/client-js';
import type { PaginationInfo } from '@mastra/core/storage';

export const DATASET_ID = 'ds-1';
export const EXPERIMENT_ID = 'exp-1';
export const RESULT_ID = 'result-1';

const pagination: PaginationInfo = {
  total: 1,
  page: 0,
  perPage: 100,
  hasMore: false,
};

const experiment: DatasetExperiment = {
  id: EXPERIMENT_ID,
  datasetId: DATASET_ID,
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  startedAt: '2026-07-21T00:00:00.000Z',
  completedAt: '2026-07-21T00:01:00.000Z',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:01:00.000Z',
};

export const experimentsResponse: { experiments: DatasetExperiment[]; pagination: PaginationInfo } = {
  experiments: [experiment],
  pagination,
};

export const needsReviewResultWithComment: DatasetExperimentResult = {
  id: RESULT_ID,
  experimentId: EXPERIMENT_ID,
  itemId: 'item-1',
  itemDatasetVersion: 1,
  input: { q: 'hello' },
  output: { a: 'world' },
  groundTruth: null,
  error: null,
  startedAt: '2026-07-21T00:00:10.000Z',
  completedAt: '2026-07-21T00:00:20.000Z',
  retryCount: 0,
  traceId: null,
  status: 'needs-review',
  tags: ['hallucination'],
  comment: 'The agent ignored the second question',
  scores: [],
  createdAt: '2026-07-21T00:00:20.000Z',
};

export const resultsResponse: { results: DatasetExperimentResult[]; pagination: PaginationInfo } = {
  results: [needsReviewResultWithComment],
  pagination,
};

export const updatedResultResponse = (comment: string | null): DatasetExperimentResult => ({
  ...needsReviewResultWithComment,
  comment,
});
