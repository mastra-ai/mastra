import type { DatasetItem } from '@mastra/client-js';

export const createdDatasetItem: DatasetItem = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  input: { city: 'Seattle' },
  toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
  createdAt: '2026-06-16T10:00:00.000Z',
  updatedAt: '2026-06-16T10:00:00.000Z',
};

export const createdDatasetItemWithoutMocks: DatasetItem = {
  ...createdDatasetItem,
  toolMocks: undefined,
};

export const createdDatasetItemWithScorers: DatasetItem = {
  ...createdDatasetItemWithoutMocks,
  scorerIds: ['stored-judge'],
};

export const createdDatasetItemWithEmptyScorers: DatasetItem = {
  ...createdDatasetItemWithoutMocks,
  scorerIds: [],
};
