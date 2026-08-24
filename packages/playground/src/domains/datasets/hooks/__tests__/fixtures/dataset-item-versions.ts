import type { DatasetItemVersionResponse } from '@mastra/client-js';

export const makeDatasetItemVersion = (
  overrides: Partial<DatasetItemVersionResponse> = {},
): DatasetItemVersionResponse => ({
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 3,
  input: { question: 'What is Mastra?' },
  groundTruth: { answer: 'A framework' },
  expectedTrajectory: undefined,
  toolMocks: [],
  scorerIds: ['scorer-1'],
  metadata: { source: 'import' },
  validTo: null,
  isDeleted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

/** Newest first, the order the history endpoint returns. */
export const itemHistory = (versions: DatasetItemVersionResponse[]) => ({ history: versions });
