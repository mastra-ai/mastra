import type { DatasetItem } from '@mastra/client-js';

export const baseItem: DatasetItem = {
  id: 'item-1',
  datasetId: 'ds-1',
  datasetVersion: 1,
  input: { q: 'weather in Seattle?' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const itemWithMocks: DatasetItem = {
  ...baseItem,
  toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
};

export const itemWithScorers: DatasetItem = {
  ...baseItem,
  scorerIds: ['quality'],
};

export const itemWithEmptyScorers: DatasetItem = {
  ...baseItem,
  scorerIds: [],
};
