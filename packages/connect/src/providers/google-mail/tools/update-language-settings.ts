// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateLanguageSettingsInputSchema = z.object({
  displayLanguage: z
    .string()
    .describe('The language to display the Gmail UI in. Example: "en", "fr", "es", "de". Use "en" for English.'),
});

const ProviderLanguageSettingsSchema = z.object({
  displayLanguage: z.string(),
});

export const updateLanguageSettingsOutputSchema = z.object({
  displayLanguage: z.string(),
});

export function updateLanguageSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_language_settings',
    description: 'Update the mailbox display language',
    inputSchema: updateLanguageSettingsInputSchema,
    outputSchema: updateLanguageSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateLanguageSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/updateLanguage
      const response = await platformProxy.put({
        endpoint: '/gmail/v1/users/me/settings/language',
        data: {
          displayLanguage: input.displayLanguage,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'update_failed',
          message: 'Failed to update language settings',
        });
      }

      const languageSettings = ProviderLanguageSettingsSchema.parse(response.data);

      return {
        displayLanguage: languageSettings.displayLanguage,
      };
    },
  });
}
