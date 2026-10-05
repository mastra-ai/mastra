// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListInputSchema = z.object({
  id: z.string().describe('The ID of the List to delete. Example: "1234567890"'),
});

const ProviderDeleteResponseSchema = z.object({
  data: z.object({
    deleted: z.boolean(),
  }),
});

export const deleteListOutputSchema = z.object({
  deleted: z.boolean(),
});

export function deleteListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_delete_list',
    description: 'Delete a List owned by the authenticated user',
    inputSchema: deleteListInputSchema,
    outputSchema: deleteListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/lists/delete-list
      const response = await platformProxy.delete({
        endpoint: `/2/lists/${input.id}`,
        retries: 3,
      });

      const providerResponse = ProviderDeleteResponseSchema.parse(response.data);

      return {
        deleted: providerResponse.data.deleted,
      };
    },
  });
}
