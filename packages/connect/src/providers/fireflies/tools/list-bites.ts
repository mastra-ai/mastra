// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listBitesInputSchema = z.object({
  mine: z.boolean().optional().describe('Fetch bites owned by the API key owner.'),
  transcript_id: z.string().optional().describe('Filter bites by a specific transcript ID.'),
  my_team: z.boolean().optional().describe("Fetch bites for the API key owner's team."),
  limit: z.number().int().min(1).max(50).optional().describe('Maximum number of bites to fetch. Max 50.'),
  skip: z.number().int().min(0).max(5000).optional().describe('Number of records to skip for pagination.'),
});

const BiteUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  picture: z.string().optional(),
});

const BiteSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  transcript_id: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  user_id: z.string().optional(),
  user: BiteUserSchema.optional(),
  created_at: z.string().optional(),
});

export const listBitesOutputSchema = z.array(BiteSchema);

const ProviderBiteUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  picture: z.string().optional(),
});

const ProviderBiteSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  transcript_id: z.string().nullable().optional(),
  start_time: z.union([z.string(), z.number()]).nullable().optional(),
  end_time: z.union([z.string(), z.number()]).nullable().optional(),
  status: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  user: ProviderBiteUserSchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    bites: z.array(ProviderBiteSchema),
  }),
});

export function listBitesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_list_bites',
    description: 'List soundbite clips with optional filters.',
    inputSchema: listBitesInputSchema,
    outputSchema: listBitesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBitesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.mine === undefined && input.transcript_id === undefined && input.my_team === undefined) {
        throw new platformProxy.ActionError({
          type: 'missing_required_filter',
          message: 'At least one of mine, transcript_id, or my_team must be provided.',
        });
      }

      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/bites
        endpoint: '/graphql',
        data: {
          query: `
                    query Bites($mine: Boolean, $transcript_id: ID, $my_team: Boolean, $limit: Int, $skip: Int) {
                        bites(mine: $mine, transcript_id: $transcript_id, my_team: $my_team, limit: $limit, skip: $skip) {
                            id
                            name
                            transcript_id
                            start_time
                            end_time
                            status
                            summary
                            user_id
                            user {
                                id
                                name
                                first_name
                                last_name
                                picture
                            }
                            created_at
                        }
                    }
                `,
          variables: {
            ...(input.mine !== undefined && { mine: input.mine }),
            ...(input.transcript_id !== undefined && { transcript_id: input.transcript_id }),
            ...(input.my_team !== undefined && { my_team: input.my_team }),
            ...(input.limit !== undefined && { limit: input.limit }),
            ...(input.skip !== undefined && { skip: input.skip }),
          },
        },
        retries: 3,
      });

      const raw = response.data;
      if (!raw || typeof raw !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Fireflies API.',
        });
      }

      const errors = 'errors' in raw ? raw.errors : undefined;
      if (Array.isArray(errors) && errors.length > 0) {
        const firstError = errors[0];
        const errorMessage =
          firstError && typeof firstError === 'object' && 'message' in firstError
            ? String(firstError.message)
            : 'Unknown GraphQL error';
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: errorMessage,
        });
      }

      const parseResult = ProviderResponseSchema.safeParse(raw);
      if (!parseResult.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response shape from Fireflies API.',
          details: parseResult.error.message,
        });
      }

      const providerData = parseResult.data.data.bites;

      return providerData.map(bite => ({
        id: bite.id,
        ...(bite.name != null && { name: bite.name }),
        ...(bite.transcript_id != null && { transcript_id: bite.transcript_id }),
        ...(bite.start_time != null && { start_time: String(bite.start_time) }),
        ...(bite.end_time != null && { end_time: String(bite.end_time) }),
        ...(bite.status != null && { status: bite.status }),
        ...(bite.summary != null && { summary: bite.summary }),
        ...(bite.user_id != null && { user_id: bite.user_id }),
        ...(bite.user != null && {
          user: {
            id: bite.user.id,
            name: bite.user.name,
            ...(bite.user.first_name !== undefined && { first_name: bite.user.first_name }),
            ...(bite.user.last_name !== undefined && { last_name: bite.user.last_name }),
            ...(bite.user.picture !== undefined && { picture: bite.user.picture }),
          },
        }),
        ...(bite.created_at != null && { created_at: bite.created_at }),
      }));
    },
  });
}
