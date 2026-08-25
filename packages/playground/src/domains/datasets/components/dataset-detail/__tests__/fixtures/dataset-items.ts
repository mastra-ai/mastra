import type { DatasetItem, DatasetRecord } from '@mastra/client-js';

export const DATASET_ID = 'ds-1';

const now = '2026-01-01T00:00:00.000Z';

export const dataset: DatasetRecord = {
  id: DATASET_ID,
  name: 'My dataset',
  description: null,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const baseItem: DatasetItem = {
  id: 'item-a',
  datasetId: DATASET_ID,
  datasetVersion: 1,
  input: { q: 'alpha' },
  createdAt: now,
  updatedAt: now,
};

export const items: DatasetItem[] = [
  baseItem,
  { ...baseItem, id: 'item-b', input: { q: 'beta' } },
  { ...baseItem, id: 'item-c', input: { q: 'gamma' } },
];
