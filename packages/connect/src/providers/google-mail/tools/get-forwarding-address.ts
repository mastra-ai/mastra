// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getForwardingAddressInputSchema = z.object({
  forwardingEmail: z.string().describe('The forwarding email address to retrieve. Example: "user@example.com"'),
});

const ProviderForwardingAddressSchema = z.object({
  forwardingEmail: z.string(),
  verificationStatus: z.enum(['accepted', 'pending', 'confirmationCodeSent']).or(z.string()),
  verificationTime: z.string().optional(),
});

export const getForwardingAddressOutputSchema = z.object({
  forwardingEmail: z.string(),
  verificationStatus: z.enum(['accepted', 'pending', 'confirmationCodeSent']).or(z.string()),
  verificationTime: z.string().optional(),
});

export function getForwardingAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_forwarding_address',
    description: 'Retrieve a forwarding address configured for the mailbox.',
    inputSchema: getForwardingAddressInputSchema,
    outputSchema: getForwardingAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getForwardingAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.forwardingAddresses/get
      // @allowTryCatch - Handle 404 errors with a proper ActionError instead of generic script error
      try {
        const response = await platformProxy.get({
          endpoint: `/gmail/v1/users/me/settings/forwardingAddresses/${encodeURIComponent(input.forwardingEmail)}`,
          retries: 3,
        });

        const providerAddress = ProviderForwardingAddressSchema.parse(response.data);

        return {
          forwardingEmail: providerAddress.forwardingEmail,
          verificationStatus: providerAddress.verificationStatus,
          ...(providerAddress.verificationTime !== undefined && { verificationTime: providerAddress.verificationTime }),
        };
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'Forwarding address not found',
            forwardingEmail: input.forwardingEmail,
          });
        }
        throw error;
      }
    },
  });
}
