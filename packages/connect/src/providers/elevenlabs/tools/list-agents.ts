// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ResourceAccessInfoSchema = z.object({
  is_creator: z.boolean(),
  creator_name: z.string(),
  creator_email: z.string(),
  role: z.string(),
  anonymous_access_level_override: z.string().nullable().optional(),
  access_source: z.string().nullable().optional(),
});

const AgentSummarySchema = z.object({
  agent_id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  created_at_unix_secs: z.number(),
  access_info: ResourceAccessInfoSchema,
  last_call_time_unix_secs: z.number().nullable().optional(),
  archived: z.boolean().optional(),
});

const GetAgentsPageSchema = z.object({
  agents: z.array(AgentSummarySchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

export const listAgentsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('How many agents to return at maximum. Cannot exceed 100. Defaults to 30.'),
  search: z.string().optional().describe('Search by agent name.'),
  archived: z.boolean().optional().describe('Filter agents by archived status.'),
  show_only_owned_agents: z
    .boolean()
    .optional()
    .describe('If true, omits agents shared with you and returns only agents you own.'),
  sort_direction: z.enum(['asc', 'desc']).optional().describe('Sort direction.'),
  sort_by: z.enum(['name', 'created_at', 'call_count_7d']).optional().describe('Field to sort by.'),
});

export const listAgentsOutputSchema = z.object({
  items: z.array(
    z.object({
      agent_id: z.string(),
      name: z.string(),
      tags: z.array(z.string()),
      created_at_unix_secs: z.number(),
      access_info: z.object({
        is_creator: z.boolean(),
        creator_name: z.string(),
        creator_email: z.string(),
        role: z.string(),
      }),
      last_call_time_unix_secs: z.number().optional(),
      archived: z.boolean().optional(),
    }),
  ),
  next_cursor: z.string().optional(),
});

export function listAgentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_list_agents',
    description: 'List Conversational AI agents.',
    inputSchema: listAgentsInputSchema,
    outputSchema: listAgentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAgentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/agents/list
        endpoint: '/v1/convai/agents',
        params: {
          ...(input.cursor !== undefined && { cursor: input.cursor }),
          ...(input.page_size !== undefined && { page_size: String(input.page_size) }),
          ...(input.search !== undefined && { search: input.search }),
          ...(input.archived !== undefined && { archived: String(input.archived) }),
          ...(input.show_only_owned_agents !== undefined && {
            show_only_owned_agents: String(input.show_only_owned_agents),
          }),
          ...(input.sort_direction !== undefined && { sort_direction: input.sort_direction }),
          ...(input.sort_by !== undefined && { sort_by: input.sort_by }),
        },
        retries: 3,
      });

      const page = GetAgentsPageSchema.parse(response.data);

      return {
        items: page.agents.map(agent => ({
          agent_id: agent.agent_id,
          name: agent.name,
          tags: agent.tags,
          created_at_unix_secs: agent.created_at_unix_secs,
          access_info: {
            is_creator: agent.access_info.is_creator,
            creator_name: agent.access_info.creator_name,
            creator_email: agent.access_info.creator_email,
            role: agent.access_info.role,
          },
          ...(agent.last_call_time_unix_secs != null && { last_call_time_unix_secs: agent.last_call_time_unix_secs }),
          ...(agent.archived !== undefined && { archived: agent.archived }),
        })),
        ...(page.next_cursor != null && { next_cursor: page.next_cursor }),
      };
    },
  });
}
