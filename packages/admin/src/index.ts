// Main class
export { MastraAdmin } from './mastra-admin';
export type {
  MastraAdminConfig,
  ObservabilityConfig,
  AdminAuthProvider,
  CreateTeamInput,
  CreateProjectInput,
  CreateDeploymentInput,
  TriggerBuildInput,
} from './mastra-admin';

// Logger
export type { AdminLogger } from './logger';
export { ConsoleAdminLogger, NoopAdminLogger } from './logger';

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
export * from './rbac';

// Storage
export type { AdminStorage, PaginationParams, PaginatedResult } from './storage/base';

// File Storage
export type { FileStorageProvider } from './file-storage/base';

// Observability
export type {
  Trace,
  Span,
  SpanEvent,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
} from './observability/types';
export type {
  ObservabilityWriterConfig,
  ObservabilityWriterInterface,
} from './observability/writer';
export type {
  TimeRange,
  QueryPagination,
  TraceQueryFilter,
  SpanQueryFilter,
  LogQueryFilter,
  MetricQueryFilter,
  ScoreQueryFilter,
  MetricAggregation,
  ObservabilityQueryProvider,
} from './observability/query-provider';

// Runner
export type { ProjectRunner, BuildOptions, RunOptions, LogStreamCallback } from './runner/base';

// Router
export type { EdgeRouterProvider } from './router/base';

// Source
export type { ProjectSourceProvider } from './source/base';

// Billing
export type { BillingProvider, SubscriptionInfo, UsageMetrics } from './billing/base';
export { NoBillingProvider } from './billing/no-billing';

// Email
export type { EmailProvider, EmailOptions, EmailTemplate } from './email/base';
export { ConsoleEmailProvider } from './email/console';

// Encryption
export type { EncryptionProvider } from './encryption/base';
export { NodeCryptoEncryptionProvider } from './encryption/node-crypto';
