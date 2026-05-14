export type {
  ToolIntegration,
  ToolIntegrationCapabilities,
  Connection,
  ToolIntegrationConfig,
  ToolIntegrations,
  ResolveToolsOpts,
  AuthorizeOpts,
  ToolService,
  ToolDescriptor,
  ToolMeta,
  ToolIntegrationHealth,
  AuthFlowStatus,
  ListToolsOpts,
  ListToolsResult,
  ListToolServicesResult,
  ListConnectionsOpts,
  ListConnectionsResult,
  ExistingConnection,
} from './tool-integration';

export { BaseToolIntegration } from './base';
export type { BaseToolIntegrationOptions } from './base';

export { DuplicateIntegrationError, UnknownIntegrationError } from './errors';

export { buildConnectionSuffix, resolveStoredToolIntegrations } from './runtime';
export type { ToolIntegrationLookup, ResolveStoredToolIntegrationsOpts } from './runtime';
