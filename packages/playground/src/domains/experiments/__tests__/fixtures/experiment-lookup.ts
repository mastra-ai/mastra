import type { MastraClient } from '@mastra/client-js';

import { experiment } from './experiment-item-route';

type GetExperimentResponse = Awaited<ReturnType<MastraClient['getExperiment']>>;
type ListExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;

export const namedExperiment: GetExperimentResponse = {
  ...experiment,
  id: 'exp-named-0001',
  name: 'Nightly regression',
};

export const unnamedExperiment: GetExperimentResponse = {
  ...experiment,
  id: 'abcdef1234567890',
  name: undefined,
};

// The first page of the cross-dataset list holds only newer experiments, never the one being opened.
export const newerExperimentsPage: ListExperimentsResponse = {
  experiments: Array.from({ length: 10 }, (_, i) => ({ ...experiment, id: `exp-newer-${i}` })),
  pagination: { total: 11, page: 0, perPage: 10, hasMore: true },
};
