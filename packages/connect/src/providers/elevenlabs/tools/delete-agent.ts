// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAgentInputSchema = z.object({
  agent_id: z.string().describe('The ID of the agent to delete. Example: "agent_123"'),
});

export const deleteAgentOutputSchema = z.object({});

export function deleteAgentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_agent',
    description: 'Delete a Conversational AI agent.',
    inputSchema: deleteAgentInputSchema,
    outputSchema: deleteAgentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAgentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://elevenlabs.io/docs/api-reference/agents/delete
      const response = await platformProxy.delete({
        endpoint: `/v1/convai/agents/${encodeURIComponent(input.agent_id)}`,
        retries: 10,
      });

      if (typeof response.data === 'object' && response.data !== null) {
        z.object({}).parse(response.data);
      }

      return {};
    },
  });
}
