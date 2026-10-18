// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMyselfInputSchema = z.object({});

const ProviderUserSchema = z.object({
  accountId: z.string(),
  accountType: z.string().optional(),
  displayName: z.string(),
  emailAddress: z.string().optional().nullable(),
  avatarUrls: z
    .object({
      '16x16': z.string().optional(),
      '24x24': z.string().optional(),
      '32x32': z.string().optional(),
      '48x48': z.string().optional(),
    })
    .optional(),
  timeZone: z.string().optional(),
  locale: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const getMyselfOutputSchema = z.object({
  account_id: z.string().describe('The account ID of the user. Example: "5b10ac8d82e05b22cc7d4ef5"'),
  account_type: z.string().optional().describe('The type of account. Example: "atlassian"'),
  display_name: z.string().describe('The display name of the user. Example: "John Doe"'),
  email_address: z.string().optional().describe('The email address of the user. Example: "john.doe@example.com"'),
  avatar_urls: z
    .object({
      '16x16': z.string().optional(),
      '24x24': z.string().optional(),
      '32x32': z.string().optional(),
      '48x48': z.string().optional(),
    })
    .optional(),
  time_zone: z.string().optional().describe('The time zone of the user. Example: "Europe/Berlin"'),
  locale: z.string().optional().describe('The locale of the user. Example: "en_US"'),
  active: z.boolean().optional().describe('Whether the user is active. Example: true'),
});

export function getMyselfTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_myself',
    description: 'Retrieve the currently authenticated Jira user.',
    inputSchema: getMyselfInputSchema,
    outputSchema: getMyselfOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMyselfOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId from connection config
      const connection = await platformProxy.getConnection();

      const cloudId = connection.connection_config?.['cloudId'];
      if (!cloudId || typeof cloudId !== 'string') {
        throw new platformProxy.ActionError({
          type: 'invalid_config',
          message: 'Missing cloudId in connection configuration',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/#api-rest-api-3-myself-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/myself`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Could not retrieve current user',
        });
      }

      const user = ProviderUserSchema.parse(response.data);

      return {
        account_id: user.accountId,
        ...(user.accountType !== undefined && { account_type: user.accountType }),
        display_name: user.displayName,
        ...(user.emailAddress != null && { email_address: user.emailAddress }),
        ...(user.avatarUrls !== undefined && { avatar_urls: user.avatarUrls }),
        ...(user.timeZone !== undefined && { time_zone: user.timeZone }),
        ...(user.locale != null && { locale: user.locale }),
        ...(user.active !== undefined && { active: user.active }),
      };
    },
  });
}
