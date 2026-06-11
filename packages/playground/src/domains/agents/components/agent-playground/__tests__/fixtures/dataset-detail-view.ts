import type { ListAgentVersionsResponse, MastraClient } from '@mastra/client-js';

type ListDatasetItemsResponse = Awaited<ReturnType<MastraClient['listDatasetItems']>>;
type ListDatasetVersionsResponse = Awaited<ReturnType<MastraClient['listDatasetVersions']>>;

export const oneItemResponse: ListDatasetItemsResponse = {
  items: [
    {
      id: 'item-1',
      datasetId: 'dataset-1',
      datasetVersion: 1,
      input: { question: 'Where is my refund?' },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    },
  ],
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
};

export const emptyDatasetVersionsResponse: ListDatasetVersionsResponse = {
  versions: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};

export const emptyAgentVersionsResponse: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 10,
  hasMore: false,
};
