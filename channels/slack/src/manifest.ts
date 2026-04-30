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

  const manifest: SlackAppManifest = {
    display_information: {
      name,
      description: description ?? `${name} - Powered by Mastra`,
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
