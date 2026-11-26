// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createAgentInputSchema = z.object({
  name: z.string().optional(),
  conversation_config: z.object({}).passthrough(),
  tags: z.array(z.string()).optional(),
  platform_settings: z.object({}).passthrough().optional(),
  workflow: z.object({}).passthrough().optional(),
});

export const createAgentOutputSchema = z.object({
  agent_id: z.string(),
});

export function createAgentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_create_agent',
    description: 'Create a Conversational AI agent.',
    inputSchema: createAgentInputSchema,
    outputSchema: createAgentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAgentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
        endpoint: '/v1/convai/agents/create',
        data: {
          name: input.name,
          conversation_config: input.conversation_config,
          tags: input.tags,
          platform_settings: input.platform_settings,
          workflow: input.workflow,
        },
        retries: 3,
      });

      const output = createAgentOutputSchema.parse(response.data);
      return output;
    },
  });
}
