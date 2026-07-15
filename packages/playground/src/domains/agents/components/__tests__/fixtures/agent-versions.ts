import type { ListAgentVersionsResponse } from '@mastra/client-js';

export const emptyAgentVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};
