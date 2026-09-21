// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createSendAsAliasInputSchema = z.object({
  sendAsEmail: z
    .string()
    .email()
    .describe(
      'The email address to appear in the "From:" header for mail sent using this alias. Example: "alias@example.com"',
    ),
  displayName: z
    .string()
    .optional()
    .describe('A name that appears in the "From:" header for mail sent using this alias. Example: "John Doe"'),
  replyToAddress: z
    .string()
    .email()
    .optional()
    .describe('An optional email address to use for the reply-to header. Example: "replies@example.com"'),
  signature: z.string().optional().describe('An optional HTML signature for the alias'),
  isDefault: z.boolean().optional().describe('Whether this alias is the default for the user'),
  treatAsAlias: z
    .boolean()
    .optional()
    .describe("Whether Gmail should treat this address as an alias of the user's primary email address"),
});

const ProviderSendAsSchema = z.object({
  sendAsEmail: z.string(),
  displayName: z.string().optional(),
  replyToAddress: z.string().optional(),
  signature: z.string().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  treatAsAlias: z.boolean().optional(),
  verificationStatus: z.string().optional(),
});

export const createSendAsAliasOutputSchema = z.object({
  sendAsEmail: z.string(),
  displayName: z.string().optional(),
  replyToAddress: z.string().optional(),
  signature: z.string().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  treatAsAlias: z.boolean().optional(),
  verificationStatus: z.string().optional(),
});

export function createSendAsAliasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_create_send_as_alias',
    description: 'Create a custom send-as alias for the mailbox',
    inputSchema: createSendAsAliasInputSchema,
    outputSchema: createSendAsAliasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSendAsAliasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/create
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/sendAs`,
        data: {
          sendAsEmail: input.sendAsEmail,
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.replyToAddress !== undefined && { replyToAddress: input.replyToAddress }),
          ...(input.signature !== undefined && { signature: input.signature }),
          ...(input.isDefault === true && { isDefault: true }),
          ...(input.treatAsAlias !== undefined && { treatAsAlias: input.treatAsAlias }),
        },
        retries: 1,
      });

      const providerSendAs = ProviderSendAsSchema.parse(response.data);

      return {
        sendAsEmail: providerSendAs.sendAsEmail,
        ...(providerSendAs.displayName !== undefined && { displayName: providerSendAs.displayName }),
        ...(providerSendAs.replyToAddress !== undefined && { replyToAddress: providerSendAs.replyToAddress }),
        ...(providerSendAs.signature !== undefined && { signature: providerSendAs.signature }),
        ...(providerSendAs.isDefault !== undefined && { isDefault: providerSendAs.isDefault }),
        ...(providerSendAs.isPrimary !== undefined && { isPrimary: providerSendAs.isPrimary }),
        ...(providerSendAs.treatAsAlias !== undefined && { treatAsAlias: providerSendAs.treatAsAlias }),
        ...(providerSendAs.verificationStatus !== undefined && {
          verificationStatus: providerSendAs.verificationStatus,
        }),
      };
    },
  });
}
