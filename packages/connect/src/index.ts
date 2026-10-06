export { tools } from './tools.js';
export type {
  ToolsOptions,
  ToolsProviderOptions,
  ToolsResolver,
  ToolsResolverContext,
  ToolsWithInput,
} from './tools.js';
export { channels } from './channels.js';
export type {
  ChannelsOptions,
  ChannelsProviderOptions,
  ChannelsResolver,
  ChannelsResolverContext,
  ResolvedChannels,
} from './channels.js';
export type { ChannelProviderRegistration, ChannelInstance, ChannelRuntime } from './providers/channel-provider.js';
export { credential } from './credential.js';
export { MastraConnectError } from './errors.js';
export type { MastraConnectErrorCode } from './errors.js';
export type { ConnectClientOptions, ConnectionCredential, ProjectConnection } from './client.js';
export { PROVIDERS, CHANNELS } from './registry.js';
export type { ProviderRegistration } from './registry.js';
