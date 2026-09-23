// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserProfileInputSchema = z.object({
  user_id: z.string().describe('User ID to get profile information for. Example: "U0123456789"'),
});

const ProfileSchema = z
  .object({
    avatar_hash: z.string().optional(),
    status_text: z.string().optional(),
    status_emoji: z.string().optional(),
    status_expiration: z.number().optional(),
    real_name: z.string().optional(),
    display_name: z.string().optional(),
    real_name_normalized: z.string().optional(),
    display_name_normalized: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional(),
    phone: z.string().optional(),
    skype: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    image_original: z.string().optional(),
    image_24: z.string().optional(),
    image_32: z.string().optional(),
    image_48: z.string().optional(),
    image_72: z.string().optional(),
    image_192: z.string().optional(),
    image_512: z.string().optional(),
    team: z.string().optional(),
    fields: z.unknown().optional(),
  })
  .passthrough();

export const getUserProfileOutputSchema = z.object({
  id: z.string(),
  team_id: z.string().optional(),
  name: z.string().optional(),
  real_name: z.string().optional(),
  display_name: z.string().optional(),
  email: z.string().optional(),
  profile: ProfileSchema,
  deleted: z.boolean(),
  is_admin: z.boolean(),
  is_owner: z.boolean(),
  is_primary_owner: z.boolean(),
  is_restricted: z.boolean(),
  is_ultra_restricted: z.boolean(),
  is_bot: z.boolean(),
  is_app_user: z.boolean(),
  has_2fa: z.boolean(),
  tz: z.string().optional(),
  tz_label: z.string().optional(),
  tz_offset: z.number().optional(),
  updated: z.number().optional(),
});

export function getUserProfileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_user_profile',
    description: "Retrieve a user's detailed profile, status, and custom fields",
    inputSchema: getUserProfileInputSchema,
    outputSchema: getUserProfileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserProfileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.info
      const response = await platformProxy.get({
        endpoint: 'users.info',
        params: {
          user: input.user_id,
        },
        retries: 3,
      });

      if (!response.data?.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to fetch user profile',
        });
      }

      const user = response.data.user;

      if (!user) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `User not found: ${input.user_id}`,
          user_id: input.user_id,
        });
      }

      return {
        id: user.id,
        team_id: user.team_id ?? undefined,
        name: user.name ?? undefined,
        real_name: user.real_name ?? undefined,
        display_name: user.profile?.display_name ?? undefined,
        email: user.profile?.email ?? undefined,
        profile: {
          avatar_hash: user.profile?.avatar_hash ?? undefined,
          status_text: user.profile?.status_text ?? undefined,
          status_emoji: user.profile?.status_emoji ?? undefined,
          status_expiration: user.profile?.status_expiration ?? undefined,
          real_name: user.profile?.real_name ?? undefined,
          display_name: user.profile?.display_name ?? undefined,
          real_name_normalized: user.profile?.real_name_normalized ?? undefined,
          display_name_normalized: user.profile?.display_name_normalized ?? undefined,
          email: user.profile?.email ?? undefined,
          title: user.profile?.title ?? undefined,
          phone: user.profile?.phone ?? undefined,
          skype: user.profile?.skype ?? undefined,
          first_name: user.profile?.first_name ?? undefined,
          last_name: user.profile?.last_name ?? undefined,
          image_original: user.profile?.image_original ?? undefined,
          image_24: user.profile?.image_24 ?? undefined,
          image_32: user.profile?.image_32 ?? undefined,
          image_48: user.profile?.image_48 ?? undefined,
          image_72: user.profile?.image_72 ?? undefined,
          image_192: user.profile?.image_192 ?? undefined,
          image_512: user.profile?.image_512 ?? undefined,
          team: user.profile?.team ?? undefined,
          fields: user.profile?.fields ?? undefined,
        },
        deleted: user.deleted ?? false,
        is_admin: user.is_admin ?? false,
        is_owner: user.is_owner ?? false,
        is_primary_owner: user.is_primary_owner ?? false,
        is_restricted: user.is_restricted ?? false,
        is_ultra_restricted: user.is_ultra_restricted ?? false,
        is_bot: user.is_bot ?? false,
        is_app_user: user.is_app_user ?? false,
        has_2fa: user.has_2fa ?? false,
        tz: user.tz ?? undefined,
        tz_label: user.tz_label ?? undefined,
        tz_offset: user.tz_offset ?? undefined,
        updated: user.updated ?? undefined,
      };
    },
  });
}
