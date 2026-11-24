import type { DatasetItem } from '@mastra/client-js';

export const datasetItemWithRequestContext: DatasetItem = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  input: { question: 'hi' },
  requestContext: { clinicId: 'clinic-123' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const triggerExperimentResponse = {
  experimentId: 'experiment-1',
  status: 'pending' as const,
  totalItems: 1,
  succeededCount: 0,
  failedCount: 0,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  results: [],
};
