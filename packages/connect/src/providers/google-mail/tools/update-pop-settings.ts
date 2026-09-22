// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const AccessWindowSchema = z.enum(['accessWindowUnspecified', 'disabled', 'allMail', 'fromNowOn']);

const DispositionSchema = z.enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead']);

const PopSettingsSchema = z.object({
  accessWindow: AccessWindowSchema.optional().describe(
    'The range of messages which are accessible via POP. Example: "allMail"',
  ),
  disposition: DispositionSchema.optional().describe(
    'The action that will be executed on a message after it has been fetched via POP. Example: "leaveInInbox"',
  ),
});

export const updatePopSettingsInputSchema = PopSettingsSchema;

export const updatePopSettingsOutputSchema = z.object({
  accessWindow: z.string().optional(),
  disposition: z.string().optional(),
});

export function updatePopSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_pop_settings',
    description: 'Update POP access settings for the mailbox',
    inputSchema: updatePopSettingsInputSchema,
    outputSchema: updatePopSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePopSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/updatePop
      const response = await platformProxy.put({
        endpoint: '/gmail/v1/users/me/settings/pop',
        data: {
          ...(input.accessWindow !== undefined && {
            accessWindow: input.accessWindow,
          }),
          ...(input.disposition !== undefined && {
            disposition: input.disposition,
          }),
        },
        retries: 3,
      });

      const ProviderResponseSchema = z.object({
        accessWindow: z.string().optional(),
        disposition: z.string().optional(),
      });

      const validatedSettings = ProviderResponseSchema.parse(response.data);

      return {
        ...(validatedSettings.accessWindow !== undefined && {
          accessWindow: validatedSettings.accessWindow,
        }),
        ...(validatedSettings.disposition !== undefined && {
          disposition: validatedSettings.disposition,
        }),
      };
    },
  });
}
