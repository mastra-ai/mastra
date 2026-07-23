import type { DatasetItem } from '@mastra/client-js';

export const createdDatasetItem = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  input: { city: 'Seattle' },
  toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
  createdAt: '2026-06-16T10:00:00.000Z',
  updatedAt: '2026-06-16T10:00:00.000Z',
} satisfies DatasetItem;

export const createdDatasetItemWithoutMocks = {
  ...createdDatasetItem,
  toolMocks: undefined,
} satisfies DatasetItem;

export const createdDatasetItemWithTimeout = {
  ...createdDatasetItem,
  timeout: 15_000,
} satisfies DatasetItem;
