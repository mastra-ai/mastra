import type { RouteResponse } from '@mastra/client-js';

export const successfulPurgeDatasetItemResponse = {
  success: true,
} satisfies RouteResponse<'DELETE /datasets/:datasetId/items/:itemId/purge'>;

export const successfulDeleteExperimentResponse = {
  success: true,
} satisfies RouteResponse<'DELETE /experiments/:experimentId'>;
