// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDevResourceInputSchema = z.object({
  file_key: z
    .string()
    .describe('The Figma file key to delete the dev resource from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  dev_resource_id: z.string().describe('The ID of the dev resource to delete. Example: "1234567890"'),
});

export const deleteDevResourceOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteDevResourceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_delete_dev_resource',
    description: 'Delete a dev resource in Figma',
    inputSchema: deleteDevResourceInputSchema,
    outputSchema: deleteDevResourceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDevResourceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { file_key, dev_resource_id } = input;

      // https://developers.figma.com/docs/rest-api/dev-resources-endpoints/
      await platformProxy.delete({
        endpoint: `/v1/files/${encodeURIComponent(file_key)}/dev_resources/${encodeURIComponent(dev_resource_id)}`,
        retries: 1,
      });

      return { success: true };
    },
  });
}
