// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFilterInputSchema = z.object({
  id: z.string().describe('The ID of the filter to delete. Example: "ABC123"'),
});

export const deleteFilterOutputSchema = z.null();

export function deleteFilterTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_filter',
    description: 'Delete a mailbox filter by filter ID',
    inputSchema: deleteFilterInputSchema,
    outputSchema: deleteFilterOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFilterOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.filters/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/settings/filters/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      return null;
    },
  });
}
