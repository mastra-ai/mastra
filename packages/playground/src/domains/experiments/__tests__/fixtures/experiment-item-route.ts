import type {
  DatasetExperiment,
  DatasetExperimentResult,
  GetAgentResponse,
  GetScorerResponse,
  GetWorkflowResponse,
  ListScoresResponse,
} from '@mastra/client-js';
import type { PaginationInfo } from '@mastra/core/storage';

export const DATASET_ID = 'ds-1';
export const EXPERIMENT_ID = 'exp-1';

export const noAgents: Record<string, GetAgentResponse> = {};
export const noWorkflows: Record<string, GetWorkflowResponse> = {};
export const noScorers: Record<string, GetScorerResponse> = {};

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
  traceId: null,
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
