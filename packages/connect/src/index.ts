export { tools } from './tools.js';
export type { ToolsOptions, ToolsIntegrationOptions, ToolsResolver } from './tools.js';
export { connect } from './connect.js';
export type { ConnectOptions, ConnectIntegrationOptions, ConnectTools } from './connect.js';
export { channels } from './channels.js';
export type {
  ChannelsOptions,
  ChannelsIntegrationOptions,
  ChannelsResolver,
  ChannelsResolverContext,
  ResolvedChannels,
} from './channels.js';
export type { ChannelProviderRegistration, ChannelBuildContext } from './providers/channel-provider.js';
export { credential } from './credential.js';
export { environment } from './environment.js';
export type { ConnectEnvironment, EnvironmentIntegrationOptions, EnvironmentOptions } from './environment.js';
export { MastraConnectError } from './errors.js';
export type { MastraConnectErrorCode } from './errors.js';
export type { ConnectClientOptions, ConnectionCredential, ProjectConnection } from './client.js';
export type { ProviderToolsOptions, ProxyToolConfig, ProxyToolContext } from './toolset.js';
export { defineProxyTool, resolveConnectionId, applyAllowTools } from './toolset.js';
export { TOOLS, PROVIDERS, CHANNELS, findRegistration, findChannelRegistration } from './registry.js';
export type { McpProviderRegistration, ProviderRegistration, ProxyProviderRegistration } from './registry.js';
