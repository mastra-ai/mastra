// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteThreadInputSchema = z.object({
  id: z.string().describe('The ID of the thread to delete. Example: "123abc456def789"'),
});

export const deleteThreadOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export function deleteThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_thread',
    description: 'Permanently delete a Gmail thread and its messages.',
    inputSchema: deleteThreadInputSchema,
    outputSchema: deleteThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(input.id)}`,
        retries: 10,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
