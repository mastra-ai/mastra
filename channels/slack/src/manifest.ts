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

  /** Additional bot scopes */
  additionalScopes?: string[];

  /** Additional bot events */
  additionalEvents?: string[];

  /** Enable interactivity (buttons, modals, etc.) */
  interactivity?: boolean;
}

/**
 * Build a Slack app manifest for an agent.
 */
export function buildManifest(options: BuildManifestOptions): SlackAppManifest {
  const {
    name,
    description,
    webhookUrl,
    oauthRedirectUrl,
    commandsUrl = webhookUrl,
    slashCommands = [],
    additionalScopes = [],
    additionalEvents = [],
    interactivity = true,
  } = options;

  const scopes = [...new Set([...DEFAULT_BOT_SCOPES, ...additionalScopes])];
  const events = [...new Set([...DEFAULT_BOT_EVENTS, ...additionalEvents])];

  // Add commands:write scope if we have slash commands
  if (slashCommands.length > 0 && !scopes.includes('commands')) {
    scopes.push('commands');
  }

  const manifest: SlackAppManifest = {
    display_information: {
      name,
      description: description ?? `${name} - Powered by Mastra`,
    },
    features: {
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
      url: commandsUrl,
    }));
  }

  // Add interactivity
  if (interactivity) {
    manifest.settings!.interactivity = {
      is_enabled: true,
      request_url: webhookUrl,
    };
  }

  return manifest;
}
