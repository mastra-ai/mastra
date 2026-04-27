/**
 * @mastra/slack
 *
 * Slack channel integration for Mastra agents.
 *
 * @example
 * ```ts
 * import { Agent } from '@mastra/core/agent';
 * import { Mastra } from '@mastra/core/mastra';
 * import { SlackChannel } from '@mastra/slack';
 *
 * const slack = new SlackChannel({
 *   configToken: process.env.SLACK_CONFIG_TOKEN,
 *   refreshToken: process.env.SLACK_CONFIG_REFRESH_TOKEN,
 *   baseUrl: process.env.BASE_URL,
 * });
 *
 * const myAgent = new Agent({ id: 'my-agent', ... });
 *
 * slack.configure(myAgent, {
 *   name: 'My Bot',
 *   slashCommands: ['/ask', '/help'],
 * });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   channels: { slack },
 * });
 * ```
 *
 * @packageDocumentation
 */

export { SlackChannel } from './channel';
export { SlackManifestClient } from './client';
export { InMemorySlackStorage } from './storage';
export { MastraSlackStorageAdapter } from './mastra-storage-adapter';
export { verifySlackRequest, parseSlackFormBody } from './crypto';

// Re-export from @chat-adapter/slack for convenience
export { createSlackAdapter } from '@chat-adapter/slack';
export type { SlackAdapter } from '@chat-adapter/slack';

export type {
  SlackChannelConfig,
  SlackAgentConfig,
  SlackPendingAdapter,
  SlashCommandConfig,
  SlackMessage,
  SlackBlock,
  SlackInstallation,
  PendingInstallation,
  SlackStorage,
  SlackRoute,
  StoredConfigTokens,
} from './types';

export { isSlackPendingAdapter } from './types';
