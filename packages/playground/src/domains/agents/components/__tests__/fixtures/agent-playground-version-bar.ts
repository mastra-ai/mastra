import type { ListAgentVersionsResponse } from '@mastra/client-js';

export const emptyAgentVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 50,
  hasMore: false,
};
