// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getEmailAddressInputSchema = z.object({ email_address_id: z.string() });

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

export const getEmailAddressOutputSchema = ResourceSchema;

export function getEmailAddressTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_email_address',
    description: 'Get a Clerk email address.',
    inputSchema: getEmailAddressInputSchema,
    outputSchema: getEmailAddressOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEmailAddressOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Email-Addresses#operation/GetEmailAddress
        endpoint: `/v1/email_addresses/${encodeURIComponent(input.email_address_id)}`,
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
