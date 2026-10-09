import type { ChannelPlatformInfo, ChannelInstallationInfo, GetSystemPackagesResponse } from '@mastra/client-js';

export const systemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: false,
};

export const emptyPlatforms: ChannelPlatformInfo[] = [];

export const slackPlatform: ChannelPlatformInfo[] = [
  {
    id: 'slack',
    name: 'Slack',
    isConfigured: true,
  },
];

export const slackAndDiscordPlatforms: ChannelPlatformInfo[] = [
  {
    id: 'slack',
    name: 'Slack',
    isConfigured: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    isConfigured: false,
  },
];

export const slackInstallations: ChannelInstallationInfo[] = [
  {
    id: 'install-1',
    platform: 'slack',
    agentId: 'agent-1',
    status: 'active',
    displayName: 'Workspace',
  },
];

export const noSlackInstallations: ChannelInstallationInfo[] = [];

export const pendingSlackInstallations: ChannelInstallationInfo[] = [
  {
    id: 'install-1',
    platform: 'slack',
    agentId: 'agent-1',
    status: 'pending',
  },
];

export const activeDiscordInstallations: ChannelInstallationInfo[] = [
  {
    id: 'install-2',
    platform: 'discord',
    agentId: 'agent-1',
    status: 'active',
    displayName: 'Server',
  },
];

export const slackDiscordConfiguredPlatforms: ChannelPlatformInfo[] = [
  { id: 'slack', name: 'Slack', isConfigured: true },
  { id: 'discord', name: 'Discord', isConfigured: true },
  { id: 'telegram', name: 'Telegram', isConfigured: false },
];
