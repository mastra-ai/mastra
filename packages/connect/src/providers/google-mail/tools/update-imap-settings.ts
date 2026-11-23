// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateImapSettingsInputSchema = z.object({
  imap_enabled: z.boolean().optional().describe('Whether IMAP is enabled for the account.'),
  auto_expunge: z.boolean().optional().describe('Whether to automatically expunge messages when they are deleted.'),
  expunge_behavior: z
    .enum(['archive', 'trash', 'deleteForever'])
    .optional()
    .describe('Behavior for expunging messages.'),
  max_folder_size: z
    .union([z.literal(0), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)])
    .optional()
    .describe('Maximum folder size. Allowed values: 0 (unlimited), 1000, 2000, 5000, 10000.'),
});

const ProviderImapSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoExpunge: z.boolean().optional(),
  expungeBehavior: z
    .enum(['expungeBehaviorUnspecified', 'archive', 'trash', 'deleteForever'])
    .or(z.string())
    .optional(),
  maxFolderSize: z
    .union([z.literal(0), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)])
    .optional(),
});

export const updateImapSettingsOutputSchema = z.object({
  imap_enabled: z.boolean().optional(),
  auto_expunge: z.boolean().optional(),
  expunge_behavior: z.enum(['archive', 'trash', 'deleteForever']).or(z.string()).optional(),
  max_folder_size: z
    .union([z.literal(0), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)])
    .optional(),
});

type Output = z.infer<typeof updateImapSettingsOutputSchema>;

export function updateImapSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_imap_settings',
    description: 'Update IMAP enablement and visibility settings.',
    inputSchema: updateImapSettingsInputSchema,
    outputSchema: updateImapSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateImapSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {};

      if (input.imap_enabled !== undefined) {
        requestBody['enabled'] = input.imap_enabled;
      }
      if (input.auto_expunge !== undefined) {
        requestBody['autoExpunge'] = input.auto_expunge;
      }
      if (input.expunge_behavior !== undefined) {
        requestBody['expungeBehavior'] = input.expunge_behavior;
      }
      if (input.max_folder_size !== undefined) {
        requestBody['maxFolderSize'] = input.max_folder_size;
      }

      const response = await platformProxy.put({
        // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/updateImap
        endpoint: '/gmail/v1/users/me/settings/imap',
        data: requestBody,
        retries: 3,
      });

      const providerSettings = ProviderImapSettingsSchema.parse(response.data);

      const output: Output = {};

      if (providerSettings['enabled'] !== undefined) {
        output.imap_enabled = providerSettings['enabled'];
      }
      if (providerSettings['autoExpunge'] !== undefined) {
        output.auto_expunge = providerSettings['autoExpunge'];
      }
      if (providerSettings['expungeBehavior'] !== undefined) {
        const behavior = providerSettings['expungeBehavior'];
        if (behavior === 'archive' || behavior === 'trash' || behavior === 'deleteForever') {
          output.expunge_behavior = behavior;
        }
      }
      if (providerSettings['maxFolderSize'] !== undefined) {
        output.max_folder_size = providerSettings['maxFolderSize'];
      }

      return output;
    },
  });
}
