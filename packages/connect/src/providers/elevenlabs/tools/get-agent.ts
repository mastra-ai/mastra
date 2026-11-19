// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getAgentInputSchema = z.object({
  agent_id: z
    .string()
    .describe('The ID of an agent. This is returned on agent creation. Example: "agent_8301kvx0de7afd18wvh6xcq9nwqc"'),
  version_id: z.string().optional().describe('The ID of the agent version to use'),
  branch_id: z.string().optional().describe('The ID of the branch to use'),
});

export const getAgentOutputSchema = z
  .object({
    agent_id: z.string(),
    name: z.string().optional(),
    conversation_config: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    platform_settings: z.record(z.string(), z.unknown()).optional(),
    secrets: z.array(z.record(z.string(), z.unknown())).optional(),
    access_info: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export function getAgentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_agent',
    description: 'Retrieve a Conversational AI agent',
    inputSchema: getAgentInputSchema,
    outputSchema: getAgentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAgentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://elevenlabs.io/docs/api-reference/agents/get
        endpoint: `/v1/convai/agents/${encodeURIComponent(input.agent_id)}`,
        params: {
          ...(input.version_id !== undefined && { version_id: input.version_id }),
          ...(input.branch_id !== undefined && { branch_id: input.branch_id }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Agent not found',
          agent_id: input.agent_id,
        });
      }

      const providerResponse = getAgentOutputSchema.parse(response.data);
      return providerResponse;
    },
  });
}
