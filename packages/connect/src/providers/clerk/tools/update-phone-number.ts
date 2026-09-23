// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePhoneNumberInputSchema = z.object({
  phone_number_id: z.string(),
  verified: z.boolean().optional(),
  primary: z.boolean().optional(),
  reserved_for_second_factor: z.boolean().optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    phone_number: z.string(),
    reserved_for_second_factor: z.boolean().optional(),
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

export const updatePhoneNumberOutputSchema = ResourceSchema;

export function updatePhoneNumberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_phone_number',
    description: 'Update a Clerk phone number.',
    inputSchema: updatePhoneNumberInputSchema,
    outputSchema: updatePhoneNumberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePhoneNumberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Phone-Numbers#operation/UpdatePhoneNumber
        endpoint: `/v1/phone_numbers/${encodeURIComponent(input.phone_number_id)}`,
        data: {
          ...(input.verified !== undefined && { verified: input.verified }),
          ...(input.primary !== undefined && { primary: input.primary }),
          ...(input.reserved_for_second_factor !== undefined && {
            reserved_for_second_factor: input.reserved_for_second_factor,
          }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
