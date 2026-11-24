// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTemplateVersionInputSchema = z.object({
  template_id: z.string().describe('The ID of the template. Example: d-e6adcea686a0410aa1f6d05879bf935d'),
  version_id: z.string().describe('The ID of the version to delete. Example: a7212169-c965-4808-b0ee-f9728250515d'),
});

export const deleteTemplateVersionOutputSchema = z.object({
  success: z.literal(true),
});

export function deleteTemplateVersionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_template_version',
    description: 'Delete a template version.',
    inputSchema: deleteTemplateVersionInputSchema,
    outputSchema: deleteTemplateVersionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTemplateVersionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/templates-versions/delete-template-version
        endpoint: `/v3/templates/${encodeURIComponent(input.template_id)}/versions/${encodeURIComponent(input.version_id)}`,
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'unexpected_status',
          message: `Expected 204 No Content, got ${response.status}`,
        });
      }

      return { success: true };
    },
  });
}
