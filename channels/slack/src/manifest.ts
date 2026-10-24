import type { SlackAppManifest } from './types';

/**
 * Slash command for manifest building.
 * Simplified version of SlashCommandConfig for manifest generation.
 */
export interface SlashCommand {
  command: string;
  description?: string;
  usageHint?: string;
}

/**
 * Default bot scopes required for agent functionality.
 */
export const DEFAULT_BOT_SCOPES = [
  // Messaging
  'chat:write',
  'chat:write.public',
  'im:write',

  // Reading messages
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',

  // Mentions and users
  'app_mentions:read',
  'users:read',

  // Reactions and files
  'reactions:write',
  'files:read',
  'files:write',

  // Assistant mode (enables thread context for DMs and AI Assistant surface)
  'assistant:write',
] as const;

/**
 * Default bot events to subscribe to.
 */
export const DEFAULT_BOT_EVENTS = [
  'app_mention',
  'message.channels',
  'message.groups',
  'message.im',
  'message.mpim',
] as const;

export interface BuildManifestOptions {
  /** Display name for the Slack app */
  name: string;

  /** Description shown in Slack */
  description?: string;

  /** URL for event webhooks */
  webhookUrl: string;

  /** URL for OAuth redirect */
  oauthRedirectUrl: string;

  /** URL for slash command webhooks (defaults to webhookUrl) */
  commandsUrl?: string;

  /** Slash commands to register */
  slashCommands?: SlashCommand[];
}

/**
 * Build a Slack app manifest for an agent.
 */
export function buildManifest(options: BuildManifestOptions): SlackAppManifest {
  const { name, description, webhookUrl, oauthRedirectUrl, commandsUrl = webhookUrl, slashCommands = [] } = options;

  const scopes: string[] = [...DEFAULT_BOT_SCOPES];
  const events: string[] = [...DEFAULT_BOT_EVENTS];

  // Add commands scope if we have slash commands
  if (slashCommands.length > 0) {
    scopes.push('commands');
  }

  // Slack docs say 140 but the API rejects at that length for short_desc.
  const MAX_DESC = 139;
  const rawDescription = description ?? `${name} - Powered by Mastra`;
  const shortDescription =
    rawDescription.length > MAX_DESC ? rawDescription.slice(0, MAX_DESC - 3) + '...' : rawDescription;

  const manifest: SlackAppManifest = {
    display_information: {
      name,
      description: shortDescription,
    },
    features: {
      app_home: {
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
      bot_user: {
        display_name: name,
        always_online: true,
      },
      // Required by Slack when `assistant:write` scope is present. Slack says
      // it will deprecate `assistant_view`, and its DM threads keep the
      // composer locked while a status shows. `agent_view` lets users reply
      // mid-run. Slack rejects a manifest that declares both.
      agent_view: {
        agent_description: shortDescription,
      },
    },
    oauth_config: {
      redirect_urls: [oauthRedirectUrl],
      scopes: {
        bot: scopes,
      },
    },
    settings: {
      event_subscriptions: {
        request_url: webhookUrl,
        bot_events: events,
      },
      interactivity: {
        is_enabled: true,
        request_url: webhookUrl,
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };

  // Add slash commands
  if (slashCommands.length > 0) {
    manifest.features!.slash_commands = slashCommands.map(cmd => ({
      command: cmd.command.startsWith('/') ? cmd.command : `/${cmd.command}`,
      description: cmd.description ?? `Run ${cmd.command}`,
      ...(cmd.usageHint ? { usage_hint: cmd.usageHint } : {}),
      url: commandsUrl,
    }));
  }

  return manifest;
}

/**
 * Overlay the provider-managed fields of `generated` onto the app's current
 * manifest, so customizations made at connect time (extra scopes, events,
 * App Home settings, suggested prompts) survive a drift update. Scopes and
 * events are merged, never dropped.
 */
export function applyManagedManifestFields(current: SlackAppManifest, generated: SlackAppManifest): SlackAppManifest {
  const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];
  // Slack rejects a manifest that declares both views.
  type Features = NonNullable<SlackAppManifest['features']>;
  const { assistant_view: legacyView, ...features } = (current.features ?? {}) as Features & {
    assistant_view?: Pick<NonNullable<Features['agent_view']>, 'suggested_prompts'>;
  };

  return {
    ...current,
    display_information: { ...current.display_information, ...generated.display_information },
    features: {
      ...features,
      bot_user: { ...features.bot_user, ...generated.features?.bot_user } as NonNullable<
        SlackAppManifest['features']
      >['bot_user'],
      agent_view: {
        suggested_prompts: legacyView?.suggested_prompts,
        ...features.agent_view,
        ...generated.features?.agent_view,
      } as NonNullable<SlackAppManifest['features']>['agent_view'],
      slash_commands: generated.features?.slash_commands,
    },
    oauth_config: {
      ...current.oauth_config,
      redirect_urls: generated.oauth_config?.redirect_urls,
      scopes: {
        ...current.oauth_config?.scopes,
        bot: union(current.oauth_config?.scopes?.bot, generated.oauth_config?.scopes?.bot),
      },
    },
    settings: {
      ...current.settings,
      event_subscriptions: {
        ...current.settings?.event_subscriptions,
        request_url: generated.settings?.event_subscriptions?.request_url,
        bot_events: union(
          current.settings?.event_subscriptions?.bot_events,
          generated.settings?.event_subscriptions?.bot_events,
        ),
      },
      interactivity: { ...current.settings?.interactivity, ...generated.settings?.interactivity },
    },
  };
}
