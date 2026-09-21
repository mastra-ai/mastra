// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listForwardingAddressesInputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe(
      'The users email address. The special value me can be used to indicate the authenticated user. Defaults to "me".',
    ),
});

const ProviderForwardingAddressSchema = z.object({
  forwardingEmail: z.string(),
  verificationStatus: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  forwardingAddresses: z.array(ProviderForwardingAddressSchema).optional(),
});

const ForwardingAddressSchema = z.object({
  forwardingEmail: z.string(),
  verificationStatus: z.string().optional(),
});

export const listForwardingAddressesOutputSchema = z.object({
  forwardingAddresses: z.array(ForwardingAddressSchema),
});

export function listForwardingAddressesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_list_forwarding_addresses',
    description: 'List forwarding addresses configured for the mailbox.',
    inputSchema: listForwardingAddressesInputSchema,
    outputSchema: listForwardingAddressesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listForwardingAddressesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userId = input.userId ?? 'me';

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.forwardingAddresses/list
      const response = await platformProxy.get({
        endpoint: `/gmail/v1/users/${encodeURIComponent(userId)}/settings/forwardingAddresses`,
        retries: 3,
      });

      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          forwardingAddresses: [],
        };
      }

      const parsed = ProviderListResponseSchema.parse(response.data);

      return {
        forwardingAddresses: parsed.forwardingAddresses ?? [],
      };
    },
  });
}
