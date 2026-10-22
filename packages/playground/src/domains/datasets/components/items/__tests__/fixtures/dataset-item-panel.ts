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

export const itemWithEmptyToolMocks: DatasetItem = {
  ...baseItem,
  toolMocks: [],
};

export const itemWithScorers: DatasetItem = {
  ...baseItem,
  scorerIds: ['quality'],
};

export const itemWithTextPayload: DatasetItem = {
  ...baseItem,
  input: 'What is the weather in Seattle?',
  groundTruth: 'It is rainy.',
};

export const itemWithPreviousTextInput: DatasetItem = {
  ...baseItem,
  input: 'What was the weather in Seattle?',
};

export const itemWithEmptyStringGroundTruth: DatasetItem = {
  ...baseItem,
  groundTruth: '',
};

export const itemWithEmptyObjectGroundTruth: DatasetItem = {
  ...baseItem,
  groundTruth: {},
};

export const itemWithUuid: DatasetItem = {
  ...baseItem,
  id: '0bbd9730-e38f-43d8-bc35-67cf97c0c971',
};
