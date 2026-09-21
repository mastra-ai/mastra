// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDraftInputSchema = z.object({
  id: z.string().describe('The ID of the draft to delete. Example: "r-1234567890abcdef"'),
});

export const deleteDraftOutputSchema = z.object({
  success: z.boolean().describe('Whether the draft was successfully deleted'),
});

export function deleteDraftTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_draft',
    description: 'Delete an existing draft by draft ID',
    inputSchema: deleteDraftInputSchema,
    outputSchema: deleteDraftOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDraftOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/drafts/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
