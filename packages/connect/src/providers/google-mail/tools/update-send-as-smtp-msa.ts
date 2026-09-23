// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const SmtpMsaInputSchema = z.object({
  host: z.string().describe('The hostname of the SMTP service. Required.'),
  port: z.number().describe('The port of the SMTP service. Required.'),
  username: z
    .string()
    .optional()
    .describe('The username for authentication with the SMTP service. This is a write-only field.'),
  password: z
    .string()
    .optional()
    .describe('The password for authentication with the SMTP service. This is a write-only field.'),
  securityMode: z
    .enum(['securityModeUnspecified', 'none', 'ssl', 'starttls'])
    .describe('The protocol used to secure communication with the SMTP service. Required.'),
});

export const updateSendAsSmtpMsaInputSchema = z.object({
  sendAsEmail: z.string().describe('The send-as alias email to be updated. Example: "alias@example.com"'),
  userId: z
    .string()
    .optional()
    .describe(
      'User\'s email address. The special value "me" can be used to indicate the authenticated user. Defaults to "me".',
    ),
  smtpMsa: SmtpMsaInputSchema.describe('The SMTP MSA settings for the send-as alias.'),
});

const SmtpMsaOutputSchema = z.object({
  host: z.string(),
  port: z.number(),
  securityMode: z.enum(['securityModeUnspecified', 'none', 'ssl', 'starttls']).or(z.string()),
});

const SendAsOutputSchema = z.object({
  sendAsEmail: z.string(),
  displayName: z.string().optional(),
  replyToAddress: z.string().optional(),
  signature: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  treatAsAlias: z.boolean().optional(),
  smtpMsa: SmtpMsaOutputSchema.optional(),
  verificationStatus: z.enum(['verificationStatusUnspecified', 'accepted', 'pending']).or(z.string()).optional(),
});

export const updateSendAsSmtpMsaOutputSchema = z.object({
  sendAs: SendAsOutputSchema,
});

export function updateSendAsSmtpMsaTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_send_as_smtp_msa',
    description: 'Update the SMTP MSA settings for a send-as alias.',
    inputSchema: updateSendAsSmtpMsaInputSchema,
    outputSchema: updateSendAsSmtpMsaOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSendAsSmtpMsaOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId || 'me';
      const encodedSendAsEmail = encodeURIComponent(input.sendAsEmail);

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/patch
      const response = await platformProxy.patch({
        endpoint: `/gmail/v1/users/${userId}/settings/sendAs/${encodedSendAsEmail}`,
        data: {
          smtpMsa: {
            host: input.smtpMsa.host,
            port: input.smtpMsa.port,
            securityMode: input.smtpMsa.securityMode,
            ...(input.smtpMsa.username !== undefined && { username: input.smtpMsa.username }),
            ...(input.smtpMsa.password !== undefined && { password: input.smtpMsa.password }),
          },
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Send-as alias not found or could not be updated',
          sendAsEmail: input.sendAsEmail,
        });
      }

      const providerSendAs = SendAsOutputSchema.parse(response.data);

      return {
        sendAs: providerSendAs,
      };
    },
  });
}
