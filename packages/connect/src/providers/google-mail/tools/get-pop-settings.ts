// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPopSettingsInputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe(
      "User's email address. The special value 'me' can be used to indicate the authenticated user. Defaults to 'me'.",
    ),
});

const ProviderPopSettingsSchema = z.object({
  accessWindow: z
    .enum(['accessWindowUnspecified', 'disabled', 'fromNowOn', 'allMail'])
    .optional()
    .describe('The range of messages which are accessible via POP.'),
  disposition: z
    .enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'])
    .optional()
    .describe('The action that will be executed on a message after it has been fetched via POP.'),
});

export const getPopSettingsOutputSchema = z.object({
  accessWindow: z
    .enum(['accessWindowUnspecified', 'disabled', 'fromNowOn', 'allMail'])
    .optional()
    .describe('The range of messages which are accessible via POP.'),
  disposition: z
    .enum(['dispositionUnspecified', 'leaveInInbox', 'archive', 'trash', 'markRead'])
    .optional()
    .describe('The action that will be executed on a message after it has been fetched via POP.'),
});

export function getPopSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_pop_settings',
    description: 'Retrieve POP settings for the mailbox.',
    inputSchema: getPopSettingsInputSchema,
    outputSchema: getPopSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPopSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/getPop
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/pop`,
        retries: 3,
      });

      const settings = ProviderPopSettingsSchema.parse(response.data);

      return {
        ...(settings.accessWindow !== undefined && {
          accessWindow: settings.accessWindow,
        }),
        ...(settings.disposition !== undefined && {
          disposition: settings.disposition,
        }),
      };
    },
  });
}
