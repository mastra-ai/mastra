import type { DatasetExperiment } from '@mastra/client-js';
import type { PaginationInfo } from '@mastra/core/storage';

import { experiment as baseExperiment } from './experiment-item-route';

export const DATASET_ID = 'ds-1';

/** A `DatasetExperiment` with a nameless, still-running default; override what a test cares about. */
export const makeExperiment = (
  overrides: Pick<DatasetExperiment, 'id'> & Partial<DatasetExperiment>,
): DatasetExperiment => ({
  ...baseExperiment,
  datasetId: DATASET_ID,
  name: null,
  status: 'running',
  completedAt: null,
  ...overrides,
});

export const experimentsResponseOf = (
  experiments: DatasetExperiment[],
): { experiments: DatasetExperiment[]; pagination: PaginationInfo } => ({
  experiments,
  pagination: { total: experiments.length, page: 0, perPage: 100, hasMore: false },
});
