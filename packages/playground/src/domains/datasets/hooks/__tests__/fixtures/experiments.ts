import type { CompareExperimentsResponse, DatasetExperiment, MastraClient } from '@mastra/client-js';

/** The exact page shape `client.listExperiments()` resolves to. */
export type ExperimentsPage = Awaited<ReturnType<MastraClient['listExperiments']>>;

export const makeDatasetExperiment = (overrides: Partial<DatasetExperiment> = {}): DatasetExperiment => ({
  id: 'exp-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: null,
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:01:00.000Z',
  ...overrides,
});

export const makeExperimentsPage = (
  experiments: DatasetExperiment[],
  pagination: Partial<ExperimentsPage['pagination']> = {},
): ExperimentsPage => ({
  experiments,
  pagination: {
    total: experiments.length,
    page: 1,
    perPage: 50,
    hasMore: false,
    ...pagination,
  },
});

export const makeComparison = (overrides: Partial<CompareExperimentsResponse> = {}): CompareExperimentsResponse => ({
  baselineId: 'exp-a',
  items: [
    {
      itemId: 'item-1',
      input: { question: 'What is Mastra?' },
      groundTruth: { answer: 'A framework' },
      results: {
        'exp-a': { output: { answer: 'A framework' }, scores: { accuracy: 1 } },
        'exp-b': { output: { answer: 'No idea' }, scores: { accuracy: 0 } },
      },
    },
  ],
  ...overrides,
});
