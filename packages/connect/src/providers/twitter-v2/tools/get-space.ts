// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSpaceInputSchema = z.object({
  space_id: z.string().describe('The unique identifier of the Space to retrieve. Example: "1zqKVXPQhvZJB"'),
});

const ProviderSpaceSchema = z.object({
  id: z.string(),
  state: z.enum(['live', 'scheduled', 'ended']).or(z.string()),
  created_at: z.string().datetime().optional(),
  creator_id: z.string().optional(),
  ended_at: z.string().datetime().optional(),
  host_ids: z.array(z.string()).optional(),
  lang: z.string().optional(),
  is_ticketed: z.boolean().optional(),
  invited_user_ids: z.array(z.string()).optional(),
  participant_count: z.number().int().optional(),
  scheduled_start: z.string().datetime().optional(),
  speaker_ids: z.array(z.string()).optional(),
  started_at: z.string().datetime().optional(),
  subscriber_count: z.number().int().optional(),
  title: z.string().optional(),
  topic_ids: z.array(z.string()).optional(),
  updated_at: z.string().datetime().optional(),
});

export const getSpaceOutputSchema = z.object({
  id: z.string(),
  state: z.enum(['live', 'scheduled', 'ended']).or(z.string()),
  created_at: z.string().datetime().optional(),
  creator_id: z.string().optional(),
  ended_at: z.string().datetime().optional(),
  host_ids: z.array(z.string()).optional(),
  lang: z.string().optional(),
  is_ticketed: z.boolean().optional(),
  invited_user_ids: z.array(z.string()).optional(),
  participant_count: z.number().int().optional(),
  scheduled_start: z.string().datetime().optional(),
  speaker_ids: z.array(z.string()).optional(),
  started_at: z.string().datetime().optional(),
  subscriber_count: z.number().int().optional(),
  title: z.string().optional(),
  topic_ids: z.array(z.string()).optional(),
  updated_at: z.string().datetime().optional(),
});

export function getSpaceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_space',
    description: 'Retrieve a single space from Twitter/X',
    inputSchema: getSpaceInputSchema,
    outputSchema: getSpaceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSpaceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/spaces/get-space-by-id
      const response = await platformProxy.get({
        endpoint: `/2/spaces/${input.space_id}`,
        params: {
          'space.fields':
            'created_at,creator_id,ended_at,host_ids,lang,is_ticketed,invited_user_ids,participant_count,scheduled_start,speaker_ids,started_at,state,subscriber_count,title,topic_ids,updated_at',
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Space not found',
          space_id: input.space_id,
        });
      }

      const providerSpace = ProviderSpaceSchema.parse(response.data.data);

      return {
        id: providerSpace.id,
        state: providerSpace.state,
        ...(providerSpace.created_at !== undefined && { created_at: providerSpace.created_at }),
        ...(providerSpace.creator_id !== undefined && { creator_id: providerSpace.creator_id }),
        ...(providerSpace.ended_at !== undefined && { ended_at: providerSpace.ended_at }),
        ...(providerSpace.host_ids !== undefined && { host_ids: providerSpace.host_ids }),
        ...(providerSpace.lang !== undefined && { lang: providerSpace.lang }),
        ...(providerSpace.is_ticketed !== undefined && { is_ticketed: providerSpace.is_ticketed }),
        ...(providerSpace.invited_user_ids !== undefined && { invited_user_ids: providerSpace.invited_user_ids }),
        ...(providerSpace.participant_count !== undefined && { participant_count: providerSpace.participant_count }),
        ...(providerSpace.scheduled_start !== undefined && { scheduled_start: providerSpace.scheduled_start }),
        ...(providerSpace.speaker_ids !== undefined && { speaker_ids: providerSpace.speaker_ids }),
        ...(providerSpace.started_at !== undefined && { started_at: providerSpace.started_at }),
        ...(providerSpace.subscriber_count !== undefined && { subscriber_count: providerSpace.subscriber_count }),
        ...(providerSpace.title !== undefined && { title: providerSpace.title }),
        ...(providerSpace.topic_ids !== undefined && { topic_ids: providerSpace.topic_ids }),
        ...(providerSpace.updated_at !== undefined && { updated_at: providerSpace.updated_at }),
      };
    },
  });
}
