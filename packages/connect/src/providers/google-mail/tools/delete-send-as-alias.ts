// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSendAsAliasOutputSchema = z.void();

export const deleteSendAsAliasInputSchema = z.object({
  sendAsEmail: z.string().describe('The email address of the send-as alias to delete. Example: "alias@example.com"'),
});

export function deleteSendAsAliasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_send_as_alias',
    description: 'Delete a custom send-as alias from the mailbox.',
    inputSchema: deleteSendAsAliasInputSchema,
    outputSchema: deleteSendAsAliasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSendAsAliasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(input.sendAsEmail)}`,
        retries: 3,
      });
    },
  });
}
