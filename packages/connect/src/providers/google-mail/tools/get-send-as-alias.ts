// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSendAsAliasInputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe('The user\'s email address. Use "me" to indicate the authenticated user. Example: "me"'),
  sendAsEmail: z.string().describe('The send-as alias to be retrieved. Example: "alias@example.com"'),
});

const ProviderSendAsSchema = z.object({
  sendAsEmail: z.string(),
  displayName: z.string().optional(),
  replyToAddress: z.string().optional(),
  signature: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  treatAsAlias: z.boolean().optional(),
  smtpMsa: z
    .object({
      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      securityMode: z.enum(['securityModeUnspecified', 'none', 'ssl', 'starttls']).or(z.string()).optional(),
    })
    .optional(),
  verificationStatus: z.enum(['verificationStatusUnspecified', 'accepted', 'pending']).or(z.string()).optional(),
});

export const getSendAsAliasOutputSchema = z.object({
  sendAsEmail: z.string(),
  displayName: z.string().optional(),
  replyToAddress: z.string().optional(),
  signature: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  treatAsAlias: z.boolean().optional(),
  smtpMsa: z
    .object({
      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      securityMode: z.enum(['securityModeUnspecified', 'none', 'ssl', 'starttls']).or(z.string()).optional(),
    })
    .optional(),
  verificationStatus: z.enum(['verificationStatusUnspecified', 'accepted', 'pending']).or(z.string()).optional(),
});

export function getSendAsAliasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_send_as_alias',
    description: 'Retrieve a configured send-as alias',
    inputSchema: getSendAsAliasInputSchema,
    outputSchema: getSendAsAliasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSendAsAliasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/get
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/sendAs/${encodeURIComponent(input.sendAsEmail)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Send-as alias not found',
          sendAsEmail: input.sendAsEmail,
          userId,
        });
      }

      const providerSendAs = ProviderSendAsSchema.parse(response.data);

      return {
        sendAsEmail: providerSendAs.sendAsEmail,
        ...(providerSendAs.displayName !== undefined && { displayName: providerSendAs.displayName }),
        ...(providerSendAs.replyToAddress !== undefined && { replyToAddress: providerSendAs.replyToAddress }),
        ...(providerSendAs.signature !== undefined && { signature: providerSendAs.signature }),
        ...(providerSendAs.isPrimary !== undefined && { isPrimary: providerSendAs.isPrimary }),
        ...(providerSendAs.isDefault !== undefined && { isDefault: providerSendAs.isDefault }),
        ...(providerSendAs.treatAsAlias !== undefined && { treatAsAlias: providerSendAs.treatAsAlias }),
        ...(providerSendAs.smtpMsa !== undefined && { smtpMsa: providerSendAs.smtpMsa }),
        ...(providerSendAs.verificationStatus !== undefined && {
          verificationStatus: providerSendAs.verificationStatus,
        }),
      };
    },
  });
}
