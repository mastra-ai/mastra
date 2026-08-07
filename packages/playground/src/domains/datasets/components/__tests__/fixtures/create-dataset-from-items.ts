import type { DatasetItem, DatasetRecord } from '@mastra/client-js';

export const sourceItemWithMocks: DatasetItem = {
  id: 'item-1',
  datasetId: 'ds-source',
  datasetVersion: 1,
  input: { q: 'What is the weather in Seattle?' },
  groundTruth: { answer: 'rainy' },
  expectedTrajectory: { steps: [{ name: 'getWeather' }] },
  toolMocks: [
    {
      toolName: 'getWeather',
      args: { city: 'Seattle' },
      output: { temperature: 60, conditions: 'rainy' },
    },
    {
      toolName: 'agent-balanceAgent',
      args: { prompt: 'look up the balance' },
      output: { text: 'balance is $100' },
      matchArgs: 'ignore',
    },
  ],
  requestContext: { tenant: 'acme' },
  metadata: { tag: 'smoke' },
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
};

export const createdDataset: DatasetRecord = {
  id: 'ds-new',
  name: 'Copied Dataset',
  description: null,
  version: 1,
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
};

export const createdItem: DatasetItem = {
  ...sourceItemWithMocks,
  id: 'item-new-1',
  datasetId: 'ds-new',
};
