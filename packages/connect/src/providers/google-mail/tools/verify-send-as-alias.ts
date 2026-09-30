// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const verifySendAsAliasOutputSchema = z.void();

export const verifySendAsAliasInputSchema = z.object({
  sendAsEmail: z.string().describe('The send-as alias email address to verify. Example: "api+test@nango.dev"'),
  userId: z.string().optional().describe('The user ID. Defaults to "me" for the authenticated user.'),
});

export function verifySendAsAliasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_verify_send_as_alias',
    description: 'Trigger verification for a custom send-as alias',
    inputSchema: verifySendAsAliasInputSchema,
    outputSchema: verifySendAsAliasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof verifySendAsAliasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/verify
      await platformProxy.post({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/sendAs/${encodeURIComponent(input.sendAsEmail)}/verify`,
        retries: 3,
      });
    },
  });
}
