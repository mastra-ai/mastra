// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createEmailAddressInputSchema = z.object({
  user_id: z.string(),
  email_address: z.string(),
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

export const createEmailAddressOutputSchema = ResourceSchema;

export function createEmailAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_email_address',
    description: 'Create a Clerk email address.',
    inputSchema: createEmailAddressInputSchema,
    outputSchema: createEmailAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createEmailAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Email-Addresses#operation/CreateEmailAddress
        endpoint: '/v1/email_addresses',
        data: {
          user_id: input.user_id,
          email_address: input.email_address,
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
