// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSendAsAliasInputSchema = z.object({
  sendAsEmail: z
    .string()
    .describe(
      'The email address that appears in the "From:" header for mail sent using this alias. Example: "alias@example.com"',
    ),
  userId: z.string().optional().describe('The user ID. Use "me" for the authenticated user. Defaults to "me".'),
  displayName: z
    .string()
    .optional()
    .describe('A name that appears in the "From:" header instead of the actual email address. Example: "John Doe"'),
  replyToAddress: z
    .string()
    .optional()
    .describe('An optional email address to use for replies. Example: "replies@example.com"'),
  signature: z
    .string()
    .optional()
    .describe('An optional HTML signature that is included in messages composed with this alias.'),
  treatAsAlias: z.boolean().optional().describe('Whether Gmail should treat this alias as an alias.'),
  isDefault: z.boolean().optional().describe('Whether this alias is the default alias.'),
});

const SmtpMsaSchema = z
  .object({
    host: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    securityMode: z.enum(['none', 'ssl', 'starttls']).or(z.string()).optional(),
  })
  .passthrough()
  .optional();

const ProviderSendAsSchema = z
  .object({
    sendAsEmail: z.string().optional(),
    displayName: z.string().nullable().optional(),
    replyToAddress: z.string().nullable().optional(),
    signature: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    treatAsAlias: z.boolean().optional(),
    verificationStatus: z.string().optional(),
    smtpMsa: SmtpMsaSchema,
  })
  .passthrough();

export const updateSendAsAliasOutputSchema = z.object({
  sendAsEmail: z.string().describe('The email address of the alias.'),
  displayName: z.string().optional().describe('The display name for this alias.'),
  replyToAddress: z.string().optional().describe('The reply-to address for this alias.'),
  signature: z.string().optional().describe('The HTML signature for this alias.'),
  isPrimary: z.boolean().optional().describe('Whether this is the primary alias.'),
  isDefault: z.boolean().optional().describe('Whether this is the default alias.'),
  treatAsAlias: z.boolean().optional().describe('Whether Gmail treats this as an alias.'),
  verificationStatus: z.string().optional().describe('The verification status of this alias.'),
});

export function updateSendAsAliasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_send_as_alias',
    description: 'Update send-as alias settings such as display name or reply-to.',
    inputSchema: updateSendAsAliasInputSchema,
    outputSchema: updateSendAsAliasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSendAsAliasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';
      const body: Record<string, unknown> = {};

      if (input.displayName !== undefined) {
        body['displayName'] = input.displayName;
      }
      if (input.replyToAddress !== undefined) {
        body['replyToAddress'] = input.replyToAddress;
      }
      if (input.signature !== undefined) {
        body['signature'] = input.signature;
      }
      if (input.treatAsAlias !== undefined) {
        body['treatAsAlias'] = input.treatAsAlias;
      }
      if (input.isDefault === true) {
        body['isDefault'] = true;
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/patch
      const response = await platformProxy.patch({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/sendAs/${encodeURIComponent(input.sendAsEmail)}`,
        data: body,
        retries: 3,
      });

      const providerData = ProviderSendAsSchema.parse(response.data);

      return {
        sendAsEmail: providerData.sendAsEmail || input.sendAsEmail,
        ...(providerData.displayName != null && { displayName: providerData.displayName }),
        ...(providerData.replyToAddress != null && { replyToAddress: providerData.replyToAddress }),
        ...(providerData.signature != null && { signature: providerData.signature }),
        ...(providerData.isPrimary !== undefined && { isPrimary: providerData.isPrimary }),
        ...(providerData.isDefault !== undefined && { isDefault: providerData.isDefault }),
        ...(providerData.treatAsAlias !== undefined && { treatAsAlias: providerData.treatAsAlias }),
        ...(providerData.verificationStatus !== undefined && { verificationStatus: providerData.verificationStatus }),
      };
    },
  });
}
