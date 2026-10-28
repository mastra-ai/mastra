// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteLabelInputSchema = z.object({
  id: z.string().describe('The ID of the label to delete. Example: "Label_1"'),
});

export const deleteLabelOutputSchema = z.object({
  success: z.boolean().describe('Whether the label was successfully deleted'),
});

export function deleteLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_label',
    description: 'Delete a user-created label',
    inputSchema: deleteLabelInputSchema,
    outputSchema: deleteLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.labels/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/labels/${encodeURIComponent(input.id)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
