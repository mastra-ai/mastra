// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteForwardingAddressInputSchema = z.object({
  forwardingEmail: z.string().describe('The forwarding email address to delete. Example: "forward@example.com"'),
});

export const deleteForwardingAddressOutputSchema = z.object({
  success: z.boolean().describe('Whether the forwarding address was successfully deleted'),
});

export function deleteForwardingAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_forwarding_address',
    description: 'Delete a forwarding address from Gmail settings.',
    inputSchema: deleteForwardingAddressInputSchema,
    outputSchema: deleteForwardingAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteForwardingAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.forwardingAddresses/delete
      await platformProxy.delete({
        endpoint: `gmail/v1/users/me/settings/forwardingAddresses/${encodeURIComponent(input.forwardingEmail)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
