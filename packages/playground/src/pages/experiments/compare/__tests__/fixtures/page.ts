import type {
  CompareExperimentsResponse,
  DatasetExperiment,
  ListDatasetExperimentResultsResponse,
  ListScoresResponse,
} from '@mastra/client-js';
import { experiments } from '@/domains/experiments/components/__tests__/fixtures/experiments';

export const sameDatasetA: DatasetExperiment = { ...experiments[0], id: 'exp-a', datasetId: 'dataset-1' };
export const sameDatasetB: DatasetExperiment = { ...experiments[1], id: 'exp-b', datasetId: 'dataset-1' };
export const otherDataset: DatasetExperiment = { ...experiments[2], id: 'exp-c', datasetId: 'dataset-2' };
export const emptyComparison: CompareExperimentsResponse = { baselineId: 'exp-a', items: [] };
export const emptyResults: ListDatasetExperimentResultsResponse = {
  results: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};
export const emptyScores: ListScoresResponse = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};
