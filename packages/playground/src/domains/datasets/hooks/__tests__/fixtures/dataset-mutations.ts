import type { RouteResponse } from '@mastra/client-js';

export const successfulPurgeDatasetItemResponse = {
  success: true,
} satisfies RouteResponse<'DELETE /datasets/:datasetId/items/:itemId/purge'>;
