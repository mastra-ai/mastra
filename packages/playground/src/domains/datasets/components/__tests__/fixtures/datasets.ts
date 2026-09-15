import type { DatasetRecord, MastraClient } from '@mastra/client-js';

type ListDatasetsResponse = Awaited<ReturnType<MastraClient['listDatasets']>>;

export function buildDataset(overrides: Partial<DatasetRecord> = {}): DatasetRecord {
  return {
    id: 'dataset-1',
    name: 'Dataset 1',
    version: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

export function buildListDatasetsResponse(datasets: DatasetRecord[] = [buildDataset()]): ListDatasetsResponse {
  return {
    datasets,
    pagination: { page: 0, perPage: 100, total: datasets.length, hasMore: false },
  };
}
