import type { RouteResponse } from '@mastra/client-js';

export const batchInsertResponse: RouteResponse<'POST /datasets/:datasetId/items/batch'> = {
  items: [],
  count: 3,
};
