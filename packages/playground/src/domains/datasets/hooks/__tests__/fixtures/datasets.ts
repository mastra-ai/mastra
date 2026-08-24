import type { DatasetRecord, MastraClient } from '@mastra/client-js';

/** The exact page shape `client.listDatasets()` resolves to. */
export type DatasetsPage = Awaited<ReturnType<MastraClient['listDatasets']>>;

export const makeDataset = (overrides: Partial<DatasetRecord> = {}): DatasetRecord => ({
  id: 'dataset-1',
  name: 'Support questions',
  description: 'Golden set for the support agent',
  metadata: null,
  tags: ['support'],
  targetType: 'agent',
  targetIds: ['agent-1'],
  scorerIds: ['scorer-1'],
  version: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

export const makeDatasetsPage = (
  datasets: DatasetRecord[],
  pagination: Partial<DatasetsPage['pagination']> = {},
): DatasetsPage => ({
  datasets,
  pagination: {
    total: datasets.length,
    page: 1,
    perPage: 50,
    hasMore: false,
    ...pagination,
  },
});
