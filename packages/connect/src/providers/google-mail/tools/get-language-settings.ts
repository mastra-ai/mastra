// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getLanguageSettingsInputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe('User\'s email address. The special value "me" can be used to indicate the authenticated user.'),
});

const ProviderLanguageSettingsSchema = z.object({
  displayLanguage: z.string().optional(),
});

export const getLanguageSettingsOutputSchema = z.object({
  displayLanguage: z.string().optional(),
});

export function getLanguageSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_language_settings',
    description: 'Retrieve Gmail language settings for the mailbox.',
    inputSchema: getLanguageSettingsInputSchema,
    outputSchema: getLanguageSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getLanguageSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';

      const response = await platformProxy.get({
        // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/getLanguage
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/language`,
        retries: 3,
      });

      const languageSettings = ProviderLanguageSettingsSchema.parse(response.data);

      return {
        ...(languageSettings.displayLanguage !== undefined && {
          displayLanguage: languageSettings.displayLanguage,
        }),
      };
    },
  });
}
