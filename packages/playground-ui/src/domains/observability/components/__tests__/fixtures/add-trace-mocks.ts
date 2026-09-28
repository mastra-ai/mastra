import type { DatasetItem, DatasetRecord } from '@mastra/client-js';
import type { Trajectory } from '@mastra/core/evals';

type Pagination = { total: number; page: number; perPage: number; hasMore: boolean };

const pagination: Pagination = { total: 1, page: 0, perPage: 100, hasMore: false };

export const datasetsList: { datasets: DatasetRecord[]; pagination: Pagination } = {
  datasets: [
    {
      id: 'dataset-1',
      name: 'Dataset 1',
      description: null,
      metadata: null,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  pagination,
};

export const datasetItem: DatasetItem = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  input: { city: 'Seattle' },
  toolMocks: [{ toolName: 'existing', args: { a: 1 }, output: { ok: true } }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const datasetItemsList: { items: DatasetItem[]; pagination: Pagination } = {
  items: [datasetItem],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

export const trajectoryWithToolCalls: Trajectory = {
  steps: [
    {
      stepType: 'tool_call',
      name: "tool: 'getWeather'",
      toolArgs: { city: 'Seattle' },
      toolResult: { temp: 52 },
    },
  ],
};

export const trajectoryWithoutToolCalls: Trajectory = {
  steps: [{ stepType: 'model_generation', name: 'gen' }],
};
