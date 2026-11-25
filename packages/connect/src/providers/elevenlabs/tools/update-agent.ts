// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateAgentInputSchema = z.object({
  agent_id: z.string().describe('The ID of the agent to update. Example: "agent_8301kvx0de7afd18wvh6xcq9nwqc"'),
  name: z.string().nullable().optional().describe('A name to make the agent easier to find'),
  tags: z.array(z.string()).nullable().optional().describe('Tags to help classify and filter the agent'),
  conversation_config: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .describe('Conversation configuration for an agent'),
  platform_settings: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .describe('Platform settings for the agent'),
  workflow: z.record(z.string(), z.unknown()).nullable().optional().describe('Workflow for the agent'),
  version_description: z
    .string()
    .nullable()
    .optional()
    .describe('Description for this version when publishing changes'),
});

const MetadataSchema = z.object({
  created_at_unix_secs: z.number().optional(),
  updated_at_unix_secs: z.number().optional(),
});

export const updateAgentOutputSchema = z.object({
  agent_id: z.string(),
  name: z.string().optional(),
  conversation_config: z.record(z.string(), z.unknown()).optional(),
  metadata: MetadataSchema.optional(),
  platform_settings: z.record(z.string(), z.unknown()).optional(),
  phone_numbers: z.array(z.record(z.string(), z.unknown())).optional(),
  whatsapp_accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  workflow: z.record(z.string(), z.unknown()).optional(),
  access_info: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string()).optional(),
  version_id: z.string().nullable().optional(),
  branch_id: z.string().nullable().optional(),
  main_branch_id: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  agent_id: z.string().optional(),
  name: z.string().optional(),
  conversation_config: z.record(z.string(), z.unknown()).optional(),
  metadata: MetadataSchema.optional(),
  platform_settings: z.record(z.string(), z.unknown()).optional(),
  phone_numbers: z.array(z.record(z.string(), z.unknown())).optional(),
  whatsapp_accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  workflow: z.record(z.string(), z.unknown()).optional(),
  access_info: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string()).optional(),
  version_id: z.string().nullable().optional(),
  branch_id: z.string().nullable().optional(),
  main_branch_id: z.string().nullable().optional(),
});

export function updateAgentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_update_agent',
    description: 'Update a Conversational AI agent',
    inputSchema: updateAgentInputSchema,
    outputSchema: updateAgentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAgentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://elevenlabs.io/docs/api-reference/agents/update
        endpoint: `/v1/convai/agents/${encodeURIComponent(input.agent_id)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.conversation_config !== undefined && { conversation_config: input.conversation_config }),
          ...(input.platform_settings !== undefined && { platform_settings: input.platform_settings }),
          ...(input.workflow !== undefined && { workflow: input.workflow }),
          ...(input.version_description !== undefined && { version_description: input.version_description }),
        },
        retries: 1,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      if (!providerData.agent_id) {
        throw new platformProxy.ActionError({
          type: 'missing_id',
          message: 'Provider response did not include an agent_id',
        });
      }

      return {
        agent_id: providerData.agent_id,
        ...(providerData.name !== undefined && { name: providerData.name }),
        ...(providerData.conversation_config !== undefined && {
          conversation_config: providerData.conversation_config,
        }),
        ...(providerData.metadata !== undefined && { metadata: providerData.metadata }),
        ...(providerData.platform_settings !== undefined && { platform_settings: providerData.platform_settings }),
        ...(providerData.phone_numbers !== undefined && { phone_numbers: providerData.phone_numbers }),
        ...(providerData.whatsapp_accounts !== undefined && { whatsapp_accounts: providerData.whatsapp_accounts }),
        ...(providerData.workflow !== undefined && { workflow: providerData.workflow }),
        ...(providerData.access_info !== undefined && { access_info: providerData.access_info }),
        ...(providerData.tags !== undefined && { tags: providerData.tags }),
        ...(providerData.version_id !== undefined && { version_id: providerData.version_id }),
        ...(providerData.branch_id !== undefined && { branch_id: providerData.branch_id }),
        ...(providerData.main_branch_id !== undefined && { main_branch_id: providerData.main_branch_id }),
      };
    },
  });
}
