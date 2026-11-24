// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDubbingProjectInputSchema = z.object({
  dubbing_id: z.string().describe('ID of the dubbing project to delete. Example: "qHq83s7gp3QoJRaiLh9H"'),
});

const ProviderResponseSchema = z.object({
  status: z.string(),
});

export const deleteDubbingProjectOutputSchema = z.object({
  status: z.string().describe('The status of the deletion.'),
});

export function deleteDubbingProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_dubbing_project',
    description: 'Delete a dubbing project.',
    inputSchema: deleteDubbingProjectInputSchema,
    outputSchema: deleteDubbingProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDubbingProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://elevenlabs.io/docs/api-reference/dubbing/delete
        endpoint: `/v1/dubbing/${encodeURIComponent(input.dubbing_id)}`,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        status: providerResponse.status,
      };
    },
  });
}
