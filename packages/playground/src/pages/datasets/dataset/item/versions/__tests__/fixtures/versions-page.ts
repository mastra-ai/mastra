import type { DatasetItemVersionResponse, DatasetRecord } from '@mastra/client-js';

const now = '2026-01-01T00:00:00.000Z';

export const dataset: DatasetRecord = {
  id: 'ds-1',
  name: 'Weather evals',
  version: 2,
  createdAt: now,
  updatedAt: now,
};

export const history: DatasetItemVersionResponse[] = [
  {
    id: 'item-a',
    datasetId: 'ds-1',
    datasetVersion: 2,
    input: { q: 'newer' },
    groundTruth: null,
    validTo: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-a',
    datasetId: 'ds-1',
    datasetVersion: 1,
    input: { q: 'older' },
    groundTruth: null,
    validTo: 2,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
];
