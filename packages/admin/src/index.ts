// Main class
export { MastraAdmin } from './mastra-admin';
export type {
  MastraAdminConfig,
  ObservabilityConfig,
  CreateTeamInput,
  CreateProjectInput,
  CreateDeploymentInput,
  TriggerBuildInput,
} from './mastra-admin';

// Orchestrator
export { BuildOrchestrator } from './orchestrator';
export type { BuildJob, BuildContext, BuildResult } from './orchestrator';

// Types
export type {
  User,
  Team,
  TeamSettings,
  TeamMember,
  TeamInvite,
  Project,
  LocalSourceConfig,
  GitHubSourceConfig,
  EncryptedEnvVar,
  Deployment,
  Build,
  RunningServer,
  RouteConfig,
  RouteInfo,
  RouteHealthStatus,
  ProjectSource,
  ChangeEvent,
  FileInfo,
  ProjectApiToken,
} from './types';

// Constants
export {
  RegisteredAdminComponent,
  DeploymentStatus,
  DeploymentType,
  BuildStatus,
  BuildTrigger,
  HealthStatus,
  SourceType,
  TeamRole,
  RouteStatus,
} from './constants';

// Errors
export { MastraAdminError, AdminErrorDomain, AdminErrorCategory } from './errors';

// Re-export from submodules
export * from './license';
export * from './providers';
export * from './rbac';
