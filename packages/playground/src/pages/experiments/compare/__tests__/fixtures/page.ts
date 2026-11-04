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
/** More experiments of `dataset-1`, to compare up to ten at once and overflow that cap. */
export const moreSameDataset: DatasetExperiment[] = [
  'exp-d',
  'exp-e',
  'exp-f',
  'exp-g',
  'exp-h',
  'exp-i',
  'exp-j',
  'exp-k',
  'exp-l',
].map(id => ({
  ...experiments[3],
  id,
  datasetId: 'dataset-1',
}));
export const emptyComparison: CompareExperimentsResponse = { baselineId: 'exp-a', items: [] };
export const emptyResults: ListDatasetExperimentResultsResponse = {
  results: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};
export const emptyScores: ListScoresResponse = {
  scores: [],
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
};

/** One item that every requested experiment ran, so the comparison table renders its columns. */
export const comparisonOf = (experimentIds: string[], baselineId: string): CompareExperimentsResponse => ({
  baselineId,
  items: [
    {
      itemId: 'item-1',
      input: { prompt: 'hello' },
      groundTruth: null,
      results: Object.fromEntries(experimentIds.map(id => [id, { output: `output of ${id}`, scores: {} }])),
    },
  ],
});
