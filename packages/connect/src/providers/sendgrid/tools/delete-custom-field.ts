// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCustomFieldInputSchema = z.object({
  custom_field_id: z.string().describe('The ID of the custom field to delete. Example: "w1_T"'),
});

export const deleteCustomFieldOutputSchema = z.object({
  custom_field_id: z.string(),
});

export function deleteCustomFieldTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_custom_field',
    description: 'Delete a custom contact field definition.',
    inputSchema: deleteCustomFieldInputSchema,
    outputSchema: deleteCustomFieldOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCustomFieldOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/custom-fields/delete-custom-field-definition
        endpoint: `/v3/marketing/field_definitions/${encodeURIComponent(input.custom_field_id)}`,
        retries: 1,
      });

      return {
        custom_field_id: input.custom_field_id,
      };
    },
  });
}
