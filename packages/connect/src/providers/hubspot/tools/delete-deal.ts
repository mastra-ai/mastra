// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDealInputSchema = z.object({
  dealId: z.string().describe('The ID of the deal to delete. Example: "12345"'),
});

export const deleteDealOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteDealTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_deal',
    description: 'Delete a deal record',
    inputSchema: deleteDealInputSchema,
    outputSchema: deleteDealOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDealOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm/deals
      await platformProxy.delete({
        endpoint: `/crm/v3/objects/deals/${input.dealId}`,
        retries: 3,
      });

      return {
        success: true,
        message: `Deal ${input.dealId} deleted successfully`,
      };
    },
  });
}
