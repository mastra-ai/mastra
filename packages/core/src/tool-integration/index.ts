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
} from './tool-integration';

export { BaseToolIntegration } from './base';
export type { BaseToolIntegrationOptions } from './base';

export { DuplicateIntegrationError, UnknownIntegrationError } from './errors';
