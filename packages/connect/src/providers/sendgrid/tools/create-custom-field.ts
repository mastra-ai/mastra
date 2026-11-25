// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCustomFieldInputSchema = z.object({
  name: z.string().describe('Name of the custom field. Example: "plan_tier"'),
  field_type: z.enum(['Text', 'Number', 'Date']).describe('Type of the custom field.'),
});

const ProviderFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  field_type: z.string(),
});

export const createCustomFieldOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  field_type: z.string(),
});

export function createCustomFieldTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_create_custom_field',
    description: 'Create a custom contact field definition.',
    inputSchema: createCustomFieldInputSchema,
    outputSchema: createCustomFieldOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCustomFieldOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/custom-fields/create-custom-field
        endpoint: '/v3/marketing/field_definitions',
        data: {
          name: input.name,
          field_type: input.field_type,
        },
        retries: 3,
      });

      const providerField = ProviderFieldSchema.parse(response.data);

      return {
        id: providerField.id,
        name: providerField.name,
        field_type: providerField.field_type,
      };
    },
  });
}
