// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateAutoForwardingSettingsInputSchema = z.object({
  enabled: z.boolean().describe('Whether all incoming mail is automatically forwarded to another address.'),
  email_address: z
    .string()
    .optional()
    .describe(
      'Email address to which all incoming messages are forwarded. This email address must be a verified member of the forwarding addresses.',
    ),
  disposition: z
    .enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'])
    .optional()
    .describe('The state that a message should be left in after it has been forwarded.'),
});

const ProviderAutoForwardingSchema = z.object({
  enabled: z.boolean(),
  emailAddress: z.string().optional(),
  disposition: z
    .enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'])
    .or(z.string())
    .optional(),
});

export const updateAutoForwardingSettingsOutputSchema = z.object({
  enabled: z.boolean(),
  email_address: z.string().optional(),
  disposition: z
    .enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'])
    .or(z.string())
    .optional(),
});

export function updateAutoForwardingSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_auto_forwarding_settings',
    description: 'Update Gmail auto-forwarding behavior and disposition',
    inputSchema: updateAutoForwardingSettingsInputSchema,
    outputSchema: updateAutoForwardingSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAutoForwardingSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.enabled && !input.email_address) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'email_address is required when enabled is true',
        });
      }

      const requestBody: {
        enabled: boolean;
        emailAddress?: string;
        disposition?: string;
      } = {
        enabled: input.enabled,
        ...(input.email_address !== undefined && { emailAddress: input.email_address }),
        ...(input.disposition !== undefined && { disposition: input.disposition }),
      };

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/updateAutoForwarding
      const response = await platformProxy.put({
        endpoint: '/gmail/v1/users/me/settings/autoForwarding',
        data: requestBody,
        retries: 3,
      });

      const providerSettings = ProviderAutoForwardingSchema.parse(response.data);

      return {
        enabled: providerSettings.enabled,
        ...(providerSettings.emailAddress !== undefined && { email_address: providerSettings.emailAddress }),
        ...(providerSettings.disposition !== undefined && { disposition: providerSettings.disposition }),
      };
    },
  });
}
