export { tools } from './tools.js';
export type {
  ToolsOptions,
  ToolsOptionsInput,
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
export { userConnectRoutes } from './user-connect-routes.js';
export type { UserConnectRoutesOptions, UserConnectIdentityContext } from './user-connect-routes.js';
export { CONNECT_PROMPT_TOOL_KEY } from './connect-prompt-tool.js';
export type { ConnectPromptPayload, ConnectPromptProvider } from './connect-prompt-tool.js';
export { MastraConnectError } from './errors.js';
export type { MastraConnectErrorCode } from './errors.js';
export type {
  ConnectClientOptions,
  ConnectionContext,
  ConnectionCredential,
  ProjectConnection,
  ProxyRequestOptions,
  ProxyResponse,
  ResolvedClient,
} from './client.js';
export {
  getConnectionContext,
  listProjectConnections,
  proxyRequest,
  proxyRequestWithResponse,
  resolveClient,
} from './client.js';
export { PROVIDERS, CHANNELS } from './registry.js';
export type { ProviderRegistration } from './registry.js';
