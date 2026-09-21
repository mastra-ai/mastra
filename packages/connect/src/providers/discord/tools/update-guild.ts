// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  botToken: z.string(),
});

export const updateGuildInputSchema = z.object({
  guild_id: z.string().describe('Guild ID to update. Example: "197038439483310086"'),
  name: z.string().min(2).max(100).optional().describe('Guild name (2-100 characters)'),
  region: z.string().optional().nullable().describe('Guild voice region id (deprecated)'),
  verification_level: z.number().int().min(0).max(4).optional().nullable().describe('Verification level (0-4)'),
  default_message_notifications: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .nullable()
    .describe('Default message notification level (0=ALL_MESSAGES, 1=ONLY_MENTIONS)'),
  explicit_content_filter: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .nullable()
    .describe('Explicit content filter level (0=DISABLED, 1=MEMBERS_WITHOUT_ROLES, 2=ALL_MEMBERS)'),
  afk_channel_id: z.string().optional().nullable().describe('ID of the AFK channel'),
  afk_timeout: z.number().int().optional().describe('AFK timeout in seconds (60, 300, 900, 1800, 3600)'),
  icon: z.string().optional().nullable().describe('Base64 1024x1024 png/jpeg/gif image for the guild icon'),
  owner_id: z.string().optional().describe('ID of the guild owner'),
  splash: z.string().optional().nullable().describe('Base64 16:9 png/jpeg image for the guild splash'),
  discovery_splash: z
    .string()
    .optional()
    .nullable()
    .describe('Base64 16:9 png/jpeg image for the guild discovery splash'),
  banner: z.string().optional().nullable().describe('Base64 16:9 png/jpeg image for the guild banner'),
  system_channel_id: z.string().optional().nullable().describe('ID of the channel where guild notices are posted'),
  system_channel_flags: z.number().int().optional().describe('System channel flags'),
  rules_channel_id: z.string().optional().nullable().describe('ID of the channel where Community guilds display rules'),
  public_updates_channel_id: z
    .string()
    .optional()
    .nullable()
    .describe('ID of the channel where admins/moderators receive notices'),
  preferred_locale: z.string().optional().nullable().describe('Preferred locale for Community guilds (e.g., "en-US")'),
  features: z.array(z.string()).optional().describe('Enabled guild features'),
  description: z.string().optional().nullable().describe('Guild description'),
  premium_progress_bar_enabled: z.boolean().optional().describe('Whether the boost progress bar should be enabled'),
  safety_alerts_channel_id: z
    .string()
    .optional()
    .nullable()
    .describe('ID of the channel where safety alerts are received'),
});

export const updateGuildOutputSchema = z.object({
  id: z.string().describe('Guild ID'),
  name: z.string().describe('Guild name'),
  icon: z.string().nullable().describe('Icon hash'),
  description: z.string().nullable().describe('Guild description'),
  splash: z.string().nullable().describe('Splash hash'),
  discovery_splash: z.string().nullable().describe('Discovery splash hash'),
  banner: z.string().nullable().describe('Banner hash'),
  owner_id: z.string().describe('Owner ID'),
  afk_channel_id: z.string().nullable().describe('AFK channel ID'),
  afk_timeout: z.number().describe('AFK timeout in seconds'),
  verification_level: z.number().describe('Verification level'),
  default_message_notifications: z.number().describe('Default message notifications level'),
  explicit_content_filter: z.number().describe('Explicit content filter level'),
  system_channel_id: z.string().nullable().describe('System channel ID'),
  system_channel_flags: z.number().describe('System channel flags'),
  rules_channel_id: z.string().nullable().describe('Rules channel ID'),
  public_updates_channel_id: z.string().nullable().describe('Public updates channel ID'),
  preferred_locale: z.string().describe('Preferred locale'),
  features: z.array(z.string()).describe('Enabled guild features'),
  premium_progress_bar_enabled: z.boolean().describe('Whether boost progress bar is enabled'),
  safety_alerts_channel_id: z.string().nullable().describe('Safety alerts channel ID'),
});

export function updateGuildTool(proxy: PlatformProxy) {
  return createTool({
    id: 'discord_update_guild',
    description: 'Update a guild in Discord',
    inputSchema: updateGuildInputSchema,
    outputSchema: updateGuildOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateGuildOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ botToken: string }>();

      if (!metadata?.botToken) {
        throw new platformProxy.ActionError({
          type: 'invalid_metadata',
          message: 'botToken is required in metadata.',
        });
      }

      // Build the update payload - only include fields that were provided
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, unknown> = {};

      if (input.name !== undefined) {
        payload['name'] = input.name;
      }
      if (input.region !== undefined) {
        payload['region'] = input.region;
      }
      if (input.verification_level !== undefined) {
        payload['verification_level'] = input.verification_level;
      }
      if (input.default_message_notifications !== undefined) {
        payload['default_message_notifications'] = input.default_message_notifications;
      }
      if (input.explicit_content_filter !== undefined) {
        payload['explicit_content_filter'] = input.explicit_content_filter;
      }
      if (input.afk_channel_id !== undefined) {
        payload['afk_channel_id'] = input.afk_channel_id;
      }
      if (input.afk_timeout !== undefined) {
        payload['afk_timeout'] = input.afk_timeout;
      }
      if (input.icon !== undefined) {
        payload['icon'] = input.icon;
      }
      if (input.owner_id !== undefined) {
        payload['owner_id'] = input.owner_id;
      }
      if (input.splash !== undefined) {
        payload['splash'] = input.splash;
      }
      if (input.discovery_splash !== undefined) {
        payload['discovery_splash'] = input.discovery_splash;
      }
      if (input.banner !== undefined) {
        payload['banner'] = input.banner;
      }
      if (input.system_channel_id !== undefined) {
        payload['system_channel_id'] = input.system_channel_id;
      }
      if (input.system_channel_flags !== undefined) {
        payload['system_channel_flags'] = input.system_channel_flags;
      }
      if (input.rules_channel_id !== undefined) {
        payload['rules_channel_id'] = input.rules_channel_id;
      }
      if (input.public_updates_channel_id !== undefined) {
        payload['public_updates_channel_id'] = input.public_updates_channel_id;
      }
      if (input.preferred_locale !== undefined) {
        payload['preferred_locale'] = input.preferred_locale;
      }
      if (input.features !== undefined) {
        payload['features'] = input.features;
      }
      if (input.description !== undefined) {
        payload['description'] = input.description;
      }
      if (input.premium_progress_bar_enabled !== undefined) {
        payload['premium_progress_bar_enabled'] = input.premium_progress_bar_enabled;
      }
      if (input.safety_alerts_channel_id !== undefined) {
        payload['safety_alerts_channel_id'] = input.safety_alerts_channel_id;
      }

      // https://discord.com/developers/docs/resources/guild#modify-guild
      const response = await platformProxy.patch({
        endpoint: `/api/v10/guilds/${input.guild_id}`,
        headers: {
          Authorization: `Bot ${metadata.botToken}`,
        },
        data: payload,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Guild not found or could not be updated',
          guild_id: input.guild_id,
        });
      }

      const ProviderGuildSchema = z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable(),
        description: z.string().nullable(),
        splash: z.string().nullable(),
        discovery_splash: z.string().nullable(),
        banner: z.string().nullable(),
        owner_id: z.string(),
        afk_channel_id: z.string().nullable(),
        afk_timeout: z.number(),
        verification_level: z.number(),
        default_message_notifications: z.number(),
        explicit_content_filter: z.number(),
        system_channel_id: z.string().nullable(),
        system_channel_flags: z.number(),
        rules_channel_id: z.string().nullable(),
        public_updates_channel_id: z.string().nullable(),
        preferred_locale: z.string(),
        features: z.array(z.string()),
        premium_progress_bar_enabled: z.boolean(),
        safety_alerts_channel_id: z.string().nullable(),
      });

      const guild = ProviderGuildSchema.parse(response.data);

      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        description: guild.description,
        splash: guild.splash,
        discovery_splash: guild.discovery_splash,
        banner: guild.banner,
        owner_id: guild.owner_id,
        afk_channel_id: guild.afk_channel_id,
        afk_timeout: guild.afk_timeout,
        verification_level: guild.verification_level,
        default_message_notifications: guild.default_message_notifications,
        explicit_content_filter: guild.explicit_content_filter,
        system_channel_id: guild.system_channel_id,
        system_channel_flags: guild.system_channel_flags,
        rules_channel_id: guild.rules_channel_id,
        public_updates_channel_id: guild.public_updates_channel_id,
        preferred_locale: guild.preferred_locale,
        features: guild.features,
        premium_progress_bar_enabled: guild.premium_progress_bar_enabled,
        safety_alerts_channel_id: guild.safety_alerts_channel_id,
      };
    },
  });
}
