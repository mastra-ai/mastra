// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSendAsAliasesInputSchema = z.object({});

const ProviderSendAsSchema = z.object({
  displayName: z.string().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  replyToAddress: z.string().optional(),
  sendAsEmail: z.string().optional(),
  signature: z.string().optional(),
  treatAsAlias: z.boolean().optional(),
  verificationStatus: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  sendAs: z.array(ProviderSendAsSchema).optional(),
});

const SendAsAliasSchema = z.object({
  displayName: z.string().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  replyToAddress: z.string().optional(),
  sendAsEmail: z.string().optional(),
  signature: z.string().optional(),
  treatAsAlias: z.boolean().optional(),
  verificationStatus: z.string().optional(),
});

export const listSendAsAliasesOutputSchema = z.object({
  sendAsAliases: z.array(SendAsAliasSchema),
});

export function listSendAsAliasesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_send_as_aliases',
    description: 'List send-as aliases available for the mailbox.',
    inputSchema: listSendAsAliasesInputSchema,
    outputSchema: listSendAsAliasesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSendAsAliasesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/list
      const response = await platformProxy.get({
        endpoint: '/gmail/v1/users/me/settings/sendAs',
        retries: 3,
      });

      const parsed = ProviderListResponseSchema.parse(response.data);

      const sendAsAliases =
        parsed.sendAs?.map(alias => ({
          ...(alias.displayName !== undefined && {
            displayName: alias.displayName,
          }),
          ...(alias.isDefault !== undefined && { isDefault: alias.isDefault }),
          ...(alias.isPrimary !== undefined && { isPrimary: alias.isPrimary }),
          ...(alias.replyToAddress !== undefined && {
            replyToAddress: alias.replyToAddress,
          }),
          ...(alias.sendAsEmail !== undefined && { sendAsEmail: alias.sendAsEmail }),
          ...(alias.signature !== undefined && { signature: alias.signature }),
          ...(alias.treatAsAlias !== undefined && { treatAsAlias: alias.treatAsAlias }),
          ...(alias.verificationStatus !== undefined && {
            verificationStatus: alias.verificationStatus,
          }),
        })) ?? [];

      return { sendAsAliases };
    },
  });
}
