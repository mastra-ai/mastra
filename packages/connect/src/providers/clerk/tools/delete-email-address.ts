// AUTO-GENERATED from NangoHQ/integration-templates @ 23df553a789b — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteEmailAddressInputSchema = z.object({ email_address_id: z.string().min(1) });

export const deleteEmailAddressOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteEmailAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_email_address',
    description: 'Delete a Clerk email address.',
    inputSchema: deleteEmailAddressInputSchema,
    outputSchema: deleteEmailAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteEmailAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Email-Addresses#operation/DeleteEmailAddress
        endpoint: `/v1/email_addresses/${encodeURIComponent(input.email_address_id)}`,
        retries: 3,
      });
      return { id: input.email_address_id, success: true };
    },
  });
}
