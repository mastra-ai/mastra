import type { ChannelPlatformInfo } from '@mastra/client-js';

export const discordPlatform: ChannelPlatformInfo = {
  id: 'discord',
  name: 'Discord',
  isConfigured: true,
};

export const unconfiguredDiscordPlatform: ChannelPlatformInfo = {
  id: 'discord',
  name: 'Discord',
  isConfigured: false,
};

export const slackPlatform: ChannelPlatformInfo = {
  id: 'slack',
  name: 'Slack',
  isConfigured: true,
};
