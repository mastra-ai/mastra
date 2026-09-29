// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPhoneNumberInputSchema = z.object({
  user_id: z.string(),
  phone_number: z.string(),
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

export const createPhoneNumberOutputSchema = ResourceSchema;

export function createPhoneNumberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_phone_number',
    description: 'Create a Clerk phone number.',
    inputSchema: createPhoneNumberInputSchema,
    outputSchema: createPhoneNumberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPhoneNumberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Phone-Numbers#operation/CreatePhoneNumber
        endpoint: '/v1/phone_numbers',
        data: {
          user_id: input.user_id,
          phone_number: input.phone_number,
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
