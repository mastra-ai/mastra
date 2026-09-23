// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPhoneNumberInputSchema = z.object({ phone_number_id: z.string() });

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

export const getPhoneNumberOutputSchema = ResourceSchema;

export function getPhoneNumberTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_phone_number',
    description: 'Get a Clerk phone number.',
    inputSchema: getPhoneNumberInputSchema,
    outputSchema: getPhoneNumberOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPhoneNumberOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Phone-Numbers#operation/GetPhoneNumber
        endpoint: `/v1/phone_numbers/${encodeURIComponent(input.phone_number_id)}`,
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
