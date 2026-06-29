export type {
  // Legacy surface
  ToolProvider,
  ToolProviderInfo,
  ToolProviderToolkit,
  ToolProviderToolInfo,
  ToolProviderListResult,
  ListToolProviderToolsOptions,
  ResolveToolProviderToolsOptions,
  // V2 surface
  ToolProviderCapabilities,
  ToolProviderConnection,
  ToolProviderConnectionScope,
  ToolProviderToolMeta,
  ToolProviderConfig,
  ToolProviders,
  ToolProviderHealth,
  ListToolsOpts,
  ListToolsResult,
  ListToolkitsResult,
  ResolveToolsOpts,
  AuthorizeOpts,
  AuthFlowStatus,
  ConnectionField,
  ListConnectionsOpts,
  ListConnectionsResult,
  ExistingConnection,
} from './types';

export { SHARED_BUCKET_ID } from './types';

export { BaseToolProvider } from './base';
export type { BaseToolProviderOptions } from './base';

export { resolveStoredToolProviders, buildConnectionSuffix } from './runtime';
export type { ToolProviderLookup, ResolveStoredToolProvidersOpts } from './runtime';

export { DuplicateToolProviderError, UnknownToolProviderError } from './errors';
