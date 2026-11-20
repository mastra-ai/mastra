// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteHistoryItemInputSchema = z.object({
  history_item_id: z.string().describe('ID of the history item to delete. Example: "JveLb9l9aA9OP7eF6zYH"'),
});

const ProviderResponseSchema = z.object({
  status: z.string(),
});

export const deleteHistoryItemOutputSchema = z.object({
  status: z.string(),
});

export function deleteHistoryItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_history_item',
    description: 'Delete a history item.',
    inputSchema: deleteHistoryItemInputSchema,
    outputSchema: deleteHistoryItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteHistoryItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://elevenlabs.io/docs/api-reference/history/delete
        endpoint: `/v1/history/${encodeURIComponent(input.history_item_id)}`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        status: providerResponse.status,
      };
    },
  });
}
