import type { MastraClient } from '@mastra/client-js';

export const emptyDatasetItems: Awaited<ReturnType<MastraClient['listDatasetItems']>> = {
  items: [],
  pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
};
