// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  id: z.string().optional().describe('User ID. Omit to return the authenticated user.'),
});

const UserGroupMemberSchema = z.object({
  user_id: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const UserGroupSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  members: z.array(UserGroupMemberSchema).nullable().optional(),
});

const ProviderUserSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  num_transcripts: z.number().nullable().optional(),
  recent_transcript: z.string().nullable().optional(),
  recent_meeting: z.string().nullable().optional(),
  minutes_consumed: z.number().nullable().optional(),
  is_admin: z.boolean().nullable().optional(),
  integrations: z.array(z.string()).nullable().optional(),
  is_calendar_in_sync: z.boolean().nullable().optional(),
  user_groups: z.array(UserGroupSchema).nullable().optional(),
});

export const getUserOutputSchema = z.object({
  user_id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  num_transcripts: z.number().optional(),
  recent_transcript: z.string().optional(),
  recent_meeting: z.string().optional(),
  minutes_consumed: z.number().optional(),
  is_admin: z.boolean().optional(),
  integrations: z.array(z.string()).optional(),
  is_calendar_in_sync: z.boolean().optional(),
  user_groups: z.array(UserGroupSchema).optional(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_get_user',
    description: 'Retrieve a specific user by ID.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query User($userId: String) {
                user(id: $userId) {
                    user_id
                    name
                    email
                    num_transcripts
                    recent_transcript
                    recent_meeting
                    minutes_consumed
                    is_admin
                    integrations
                    is_calendar_in_sync
                    user_groups {
                        id
                        name
                        handle
                        members {
                            user_id
                            first_name
                            last_name
                            email
                        }
                    }
                }
            }
        `;

      const config: PlatformProxyRequest = {
        // https://docs.fireflies.ai/graphql-api/query/user
        endpoint: '/graphql',
        data: {
          query,
          variables: {
            ...(input.id !== undefined && { userId: input.id }),
          },
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const parsed = z
        .object({
          data: z
            .object({
              user: ProviderUserSchema.nullable(),
            })
            .nullable()
            .optional(),
          errors: z.array(z.object({ message: z.string() })).optional(),
        })
        .parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: parsed.errors[0]!.message,
        });
      }

      if (!parsed.data?.user) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
        });
      }

      const user = parsed.data.user;

      return {
        user_id: user.user_id,
        ...(user.name != null && { name: user.name }),
        ...(user.email != null && { email: user.email }),
        ...(user.num_transcripts != null && { num_transcripts: user.num_transcripts }),
        ...(user.recent_transcript != null && { recent_transcript: user.recent_transcript }),
        ...(user.recent_meeting != null && { recent_meeting: user.recent_meeting }),
        ...(user.minutes_consumed != null && { minutes_consumed: user.minutes_consumed }),
        ...(user.is_admin != null && { is_admin: user.is_admin }),
        ...(user.integrations != null && { integrations: user.integrations }),
        ...(user.is_calendar_in_sync != null && { is_calendar_in_sync: user.is_calendar_in_sync }),
        ...(user.user_groups != null && { user_groups: user.user_groups }),
      };
    },
  });
}
