// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInfoInputSchema = z.object({
  user_id: z.string().describe('Slack user ID. Example: "U12345678"'),
});

export const getUserInfoOutputSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  name: z.string(),
  real_name: z.string().optional(),
  display_name: z.string().optional(),
  email: z.string().optional(),
  avatar_url: z.string().optional(),
  is_bot: z.boolean(),
  is_admin: z.boolean().optional(),
  is_owner: z.boolean().optional(),
  is_primary_owner: z.boolean().optional(),
  is_restricted: z.boolean().optional(),
  is_ultra_restricted: z.boolean().optional(),
  is_app_user: z.boolean().optional(),
  updated: z.number().optional(),
});

export function getUserInfoTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_user_info',
    description: "Retrieve a user's account details, including profile and avatar fields",
    inputSchema: getUserInfoInputSchema,
    outputSchema: getUserInfoOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserInfoOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.info
      const response = await platformProxy.get({
        endpoint: 'users.info',
        params: {
          user: input.user_id,
        },
        retries: 3,
      });

      if (!response.data || !response.data.user) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
          user_id: input.user_id,
        });
      }

      const user = response.data.user;
      const profile = user.profile || {};

      return {
        id: user.id,
        team_id: user.team_id,
        name: user.name,
        real_name: profile.real_name || undefined,
        display_name: profile.display_name || undefined,
        email: profile.email || undefined,
        avatar_url: profile.image_512 || profile.image_192 || profile.image_72 || profile.image_48 || undefined,
        is_bot: user.is_bot || false,
        is_admin: user.is_admin,
        is_owner: user.is_owner,
        is_primary_owner: user.is_primary_owner,
        is_restricted: user.is_restricted,
        is_ultra_restricted: user.is_ultra_restricted,
        is_app_user: user.is_app_user,
        updated: user.updated,
      };
    },
  });
}
