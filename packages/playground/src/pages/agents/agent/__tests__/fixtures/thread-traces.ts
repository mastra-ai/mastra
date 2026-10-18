import type { MastraClient } from '@mastra/client-js';

type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;

export const emptyThreadTracesList: ListTracesLightResponse = {
  spans: [],
  pagination: { total: 0, page: 0, perPage: 25, hasMore: false },
};
