// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getImapSettingsInputSchema = z.object({
  userId: z.string().optional().describe('User ID. Example: "me"'),
});

const ProviderImapSettingsSchema = z.object({
  autoExpunge: z.boolean().optional(),
  enabled: z.boolean().optional(),
  expungeBehavior: z
    .enum(['expungeBehaviorUnspecified', 'archive', 'trash', 'deleteForever'])
    .or(z.string())
    .optional(),
  maxFolderSize: z
    .union([z.literal(0), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)])
    .optional(),
});

export const getImapSettingsOutputSchema = z.object({
  autoExpunge: z.boolean().optional(),
  enabled: z.boolean().optional(),
  expungeBehavior: z
    .enum(['expungeBehaviorUnspecified', 'archive', 'trash', 'deleteForever'])
    .or(z.string())
    .optional(),
  maxFolderSize: z
    .union([z.literal(0), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)])
    .optional(),
});

export function getImapSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_imap_settings',
    description: 'Retrieve IMAP settings for the mailbox',
    inputSchema: getImapSettingsInputSchema,
    outputSchema: getImapSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getImapSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/getImap
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/imap`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'IMAP settings not found',
        });
      }

      const providerSettings = ProviderImapSettingsSchema.parse(response.data);

      return {
        ...(providerSettings.autoExpunge !== undefined && { autoExpunge: providerSettings.autoExpunge }),
        ...(providerSettings.enabled !== undefined && { enabled: providerSettings.enabled }),
        ...(providerSettings.expungeBehavior !== undefined && { expungeBehavior: providerSettings.expungeBehavior }),
        ...(providerSettings.maxFolderSize !== undefined && { maxFolderSize: providerSettings.maxFolderSize }),
      };
    },
  });
}
