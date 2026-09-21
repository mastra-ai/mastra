// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const lookupUserByEmailInputSchema = z.object({
  email: z.string().email().describe('Email address of the user to look up. Example: "user@example.com"'),
});

export const lookupUserByEmailOutputSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  name: z.string(),
  real_name: z.string().optional(),
  email: z.string(),
  is_admin: z.boolean(),
  is_bot: z.boolean(),
  is_restricted: z.boolean(),
  is_ultra_restricted: z.boolean(),
  is_deleted: z.boolean(),
  profile: z.object({
    avatar_hash: z.string().optional(),
    status_text: z.string().optional(),
    status_emoji: z.string().optional(),
    real_name: z.string().optional(),
    display_name: z.string().optional(),
    email: z.string().optional(),
    image_24: z.string().optional(),
    image_32: z.string().optional(),
    image_48: z.string().optional(),
    image_72: z.string().optional(),
    image_192: z.string().optional(),
    image_512: z.string().optional(),
  }),
});

export function lookupUserByEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_lookup_user_by_email',
    description: 'Look up a user by email address',
    inputSchema: lookupUserByEmailInputSchema,
    outputSchema: lookupUserByEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof lookupUserByEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.dev/reference/methods/users.lookupByEmail
      const response = await platformProxy.get({
        endpoint: 'users.lookupByEmail',
        params: {
          email: input.email,
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        const errorMsg = response.data?.error || 'User not found';
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: errorMsg,
          email: input.email,
        });
      }

      const user = response.data.user;

      return {
        id: user.id,
        team_id: user.team_id,
        name: user.name,
        real_name: user.real_name ?? undefined,
        email: user.profile?.email || input.email,
        is_admin: user.is_admin || false,
        is_bot: user.is_bot || false,
        is_restricted: user.is_restricted || false,
        is_ultra_restricted: user.is_ultra_restricted || false,
        is_deleted: user.deleted || false,
        profile: {
          avatar_hash: user.profile?.avatar_hash ?? undefined,
          status_text: user.profile?.status_text ?? undefined,
          status_emoji: user.profile?.status_emoji ?? undefined,
          real_name: user.profile?.real_name ?? undefined,
          display_name: user.profile?.display_name ?? undefined,
          email: user.profile?.email ?? undefined,
          image_24: user.profile?.image_24 ?? undefined,
          image_32: user.profile?.image_32 ?? undefined,
          image_48: user.profile?.image_48 ?? undefined,
          image_72: user.profile?.image_72 ?? undefined,
          image_192: user.profile?.image_192 ?? undefined,
          image_512: user.profile?.image_512 ?? undefined,
        },
      };
    },
  });
}
