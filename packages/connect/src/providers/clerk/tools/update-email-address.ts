// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateEmailAddressInputSchema = z.object({
  email_address_id: z.string(),
  verified: z.boolean().optional(),
  primary: z.boolean().optional(),
  notify_primary_email_address_changed: z.boolean().optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    email_address: z.string(),
    verification: z
      .object({ status: z.string().optional(), strategy: z.string().optional() })
      .passthrough()
      .nullable()
      .optional(),
    linked_to: z.array(z.object({ id: z.string(), type: z.string() }).passthrough()).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const updateEmailAddressOutputSchema = ResourceSchema;

export function updateEmailAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_email_address',
    description: 'Update a Clerk email address.',
    inputSchema: updateEmailAddressInputSchema,
    outputSchema: updateEmailAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEmailAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Email-Addresses#operation/UpdateEmailAddress
        endpoint: `/v1/email_addresses/${encodeURIComponent(input.email_address_id)}`,
        data: {
          ...(input.verified !== undefined && { verified: input.verified }),
          ...(input.primary !== undefined && { primary: input.primary }),
          ...(input.notify_primary_email_address_changed !== undefined && {
            notify_primary_email_address_changed: input.notify_primary_email_address_changed,
          }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
