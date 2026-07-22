import type { DatasetItem } from '@mastra/client-js';

export const baseItem = {
  id: 'item-1',
  datasetId: 'ds-1',
  datasetVersion: 1,
  input: { q: 'weather in Seattle?' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies DatasetItem;

export const itemWithMocks = {
  ...baseItem,
  toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
} satisfies DatasetItem;

export const itemWithTimeout = {
  ...baseItem,
  timeout: 15_000,
} satisfies DatasetItem;
