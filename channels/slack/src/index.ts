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
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   channels: { slack },
 * });
 *
 * // Connect an agent to Slack (creates app, returns OAuth URL)
 * const { authorizationUrl } = await slack.connect('my-agent', {
 *   name: 'My Bot',
 *   slashCommands: ['/ask', '/help'],
 * });
 * ```
 *
 * @packageDocumentation
 */

export { SlackChannel } from './channel';
export { SlackManifestClient } from './client';
export { verifySlackRequest, parseSlackFormBody } from './crypto';
export { buildManifest, DEFAULT_BOT_SCOPES, DEFAULT_BOT_EVENTS } from './manifest';

// Re-export from @chat-adapter/slack for convenience
export { createSlackAdapter } from '@chat-adapter/slack';
export type { SlackAdapter } from '@chat-adapter/slack';

// Zod schemas for parsing channel storage data
export {
  SlackInstallationDataSchema,
  SlackPendingDataSchema,
  SlackConfigDataSchema,
  type SlackInstallationData,
  type SlackPendingData,
  type SlackConfigData,
  type SlackInstallation,
  type SlackPendingInstallation,
  type SlackConfigTokens,
} from './schemas';

export type {
  SlackChannelConfig,
  SlackConnectOptions,
  SlackAppManifest,
  SlashCommandConfig,
  SlackMessage,
  SlackBlock,
  SlackRoute,
} from './types';
