// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDynamicTemplateInputSchema = z.object({
  template_id: z
    .string()
    .describe('The ID of the dynamic template to delete. Example: "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'),
});

export const deleteDynamicTemplateOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteDynamicTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_dynamic_template',
    description: 'Delete a dynamic template and all of its versions.',
    inputSchema: deleteDynamicTemplateInputSchema,
    outputSchema: deleteDynamicTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDynamicTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.sendgrid.com/api-reference/transactional-templates/delete-a-template
      await platformProxy.delete({
        endpoint: `/v3/templates/${encodeURIComponent(input.template_id)}`,
        retries: 10,
      });

      return {
        success: true,
      };
    },
  });
}
