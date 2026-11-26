// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCustomFieldsInputSchema = z.object({});

const CustomFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  field_type: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const ReservedFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  field_type: z.string(),
});

const ProviderResponseSchema = z.object({
  custom_fields: z.array(CustomFieldSchema).optional(),
  reserved_fields: z.array(ReservedFieldSchema).optional(),
});

export const listCustomFieldsOutputSchema = z.object({
  custom_fields: z.array(CustomFieldSchema),
  reserved_fields: z.array(ReservedFieldSchema),
});

export function listCustomFieldsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_custom_fields',
    description: 'List custom contact field definitions.',
    inputSchema: listCustomFieldsInputSchema,
    outputSchema: listCustomFieldsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCustomFieldsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/custom-fields/list-all-custom-fields
      const response = await platformProxy.get({
        endpoint: '/v3/marketing/field_definitions',
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        custom_fields: providerResponse.custom_fields ?? [],
        reserved_fields: providerResponse.reserved_fields ?? [],
      };
    },
  });
}
