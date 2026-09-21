// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAutoForwardingSettingsInputSchema = z.object({
  userId: z.string().optional().describe('User ID. Use "me" for the currently authenticated user. Example: "me"'),
});

const ProviderAutoForwardingSchema = z.object({
  enabled: z.boolean().optional(),
  emailAddress: z.string().optional(),
  disposition: z.string().optional(),
});

export const getAutoForwardingSettingsOutputSchema = z.object({
  enabled: z.boolean().optional(),
  emailAddress: z.string().optional(),
  disposition: z.string().optional(),
});

export function getAutoForwardingSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_auto_forwarding_settings',
    description: 'Retrieve the mailbox auto-forwarding configuration.',
    inputSchema: getAutoForwardingSettingsInputSchema,
    outputSchema: getAutoForwardingSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAutoForwardingSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/getAutoForwarding
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/autoForwarding`,
        retries: 3,
      });

      const providerData = ProviderAutoForwardingSchema.parse(response.data);

      return {
        ...(providerData.enabled !== undefined && { enabled: providerData.enabled }),
        ...(providerData.emailAddress !== undefined && { emailAddress: providerData.emailAddress }),
        ...(providerData.disposition !== undefined && { disposition: providerData.disposition }),
      };
    },
  });
}
