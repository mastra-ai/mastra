// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSpacesInputSchema = z.object({
  query: z.string().min(1).describe('Search term to filter Spaces by title. Example: "crypto"'),
  state: z
    .enum(['live', 'scheduled', 'all'])
    .optional()
    .describe('Filter by Space state: live, scheduled, or all. Default: all'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results to return (1-100). Default: 100'),
  cursor: z.string().optional().describe('Pagination cursor from previous response for fetching next page'),
});

const SpaceSchema = z.object({
  id: z.string(),
  state: z.enum(['live', 'scheduled']).or(z.string()),
  title: z.string().optional(),
  created_at: z.string().optional(),
  creator_id: z.string().optional(),
  host_ids: z.array(z.string()).optional(),
  invited_user_ids: z.array(z.string()).optional(),
  speaker_ids: z.array(z.string()).optional(),
  participant_count: z.number().optional(),
  subscriber_count: z.number().optional(),
  is_ticketed: z.boolean().optional(),
  scheduled_start: z.string().optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  lang: z.string().optional(),
  updated_at: z.string().optional(),
  topic_ids: z.array(z.string()).optional(),
});

const ProviderSpaceSchema = z.object({
  id: z.string(),
  state: z.enum(['live', 'scheduled']).or(z.string()),
  title: z.string().optional(),
  created_at: z.string().optional(),
  creator_id: z.string().optional(),
  host_ids: z.array(z.string()).optional(),
  invited_user_ids: z.array(z.string()).optional(),
  speaker_ids: z.array(z.string()).optional(),
  participant_count: z.number().optional(),
  subscriber_count: z.number().optional(),
  is_ticketed: z.boolean().optional(),
  scheduled_start: z.string().optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  lang: z.string().optional(),
  updated_at: z.string().optional(),
  topic_ids: z.array(z.string()).optional(),
});

const ProviderResponseSchema = z.object({
  data: z.array(ProviderSpaceSchema).optional(),
  meta: z
    .object({
      next_token: z.string().optional(),
    })
    .optional(),
});

export const listSpacesOutputSchema = z.object({
  spaces: z.array(SpaceSchema),
  next_cursor: z.string().optional(),
});

export function listSpacesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_list_spaces',
    description: 'List Spaces from Twitter/X matching a search query',
    inputSchema: listSpacesInputSchema,
    outputSchema: listSpacesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSpacesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.x.com/en/docs/twitter-api/spaces/search/api-reference/get-spaces-search
      const response = await platformProxy.get({
        endpoint: '/2/spaces/search',
        params: {
          query: input.query,
          ...(input.state !== undefined && { state: input.state }),
          ...(input.max_results !== undefined && { max_results: String(input.max_results) }),
          ...(input.cursor !== undefined && { next_token: input.cursor }),
          'space.fields':
            'id,state,title,created_at,creator_id,host_ids,invited_user_ids,speaker_ids,participant_count,subscriber_count,is_ticketed,scheduled_start,started_at,ended_at,lang,updated_at,topic_ids',
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.safeParse(response.data);

      if (!providerData.success || !providerData.data.data) {
        return {
          spaces: [],
        };
      }

      const spaces = providerData.data.data.map(space => ({
        id: space.id,
        state: space.state,
        ...(space.title !== undefined && { title: space.title }),
        ...(space.created_at !== undefined && { created_at: space.created_at }),
        ...(space.creator_id !== undefined && { creator_id: space.creator_id }),
        ...(space.host_ids !== undefined && { host_ids: space.host_ids }),
        ...(space.invited_user_ids !== undefined && { invited_user_ids: space.invited_user_ids }),
        ...(space.speaker_ids !== undefined && { speaker_ids: space.speaker_ids }),
        ...(space.participant_count !== undefined && { participant_count: space.participant_count }),
        ...(space.subscriber_count !== undefined && { subscriber_count: space.subscriber_count }),
        ...(space.is_ticketed !== undefined && { is_ticketed: space.is_ticketed }),
        ...(space.scheduled_start !== undefined && { scheduled_start: space.scheduled_start }),
        ...(space.started_at !== undefined && { started_at: space.started_at }),
        ...(space.ended_at !== undefined && { ended_at: space.ended_at }),
        ...(space.lang !== undefined && { lang: space.lang }),
        ...(space.updated_at !== undefined && { updated_at: space.updated_at }),
        ...(space.topic_ids !== undefined && { topic_ids: space.topic_ids }),
      }));

      const nextCursor = providerData.data.meta?.next_token;

      return {
        spaces,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
