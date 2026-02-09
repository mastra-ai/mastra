# MastraAdmin Design Document

A self-hosted, open-source platform for deploying and managing Mastra servers with pluggable providers for authentication, storage, execution, billing, and observability.

---

## Overview

MastraAdmin is a self-hosted platform that enables teams to:

1. **User Management** - Login, invite team members
2. **GitHub Integration** - Install GitHub App, grant access to repositories
3. **Project Management** - List repos, clone, build, and run Mastra servers
4. **Configuration** - Manage environment variables and runtime settings
5. **Observability** - Traces, logs, and metrics backed by ClickHouse
6. **Access Control** - RBAC to lock down commands and resources

### Design Principles

- **Fully Open Source** - No feature gates or license keys required
- **Bring Your Own Provider (BYOP)** - Pluggable auth, storage, runner, billing, observability
- **Production Ready** - Based on battle-tested schema from Mastra Cloud
- **Self-Contained** - Can run completely air-gapped

---

## Research Summary

| Platform | Storage | Auth | Licensing | Key Takeaway |
|----------|---------|------|-----------|--------------|
| **Langfuse** | PostgreSQL + ClickHouse + Redis + S3 | SSO, RBAC | Open core + EE | Multi-database for scale |
| **Arize Phoenix** | PostgreSQL only | OAuth2, LDAP, Local | Fully open source | Simpler, no feature gates |
| **GitLab** | PostgreSQL | LDAP, SAML, OAuth, OmniAuth, SCIM | Free Core + Premium | Mature auth abstraction |

---

## Architecture

### BYOP (Bring Your Own Provider) Summary

| Component | Interface | Built-in Implementations |
|-----------|-----------|-------------------------|
| **Auth** | `AuthProvider` | Clerk, OIDC, Auth0, Keycloak |
| **Storage** | `AdminStorage` | PostgreSQL, LibSQL |
| **Observability** | `ObservabilityProvider` | ClickHouse, PostgreSQL (dev) |
| **Runner** | `ProjectRunner` | Local Process, Docker, Kubernetes |
| **Billing** | `BillingProvider` | Stripe, NoBilling |
| **Email** | `EmailProvider` | Resend, SendGrid, Console |
| **Encryption** | `EncryptionProvider` | AES-256, NoOp |

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              MastraAdmin                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │ AuthProvider│  │AdminStorage │  │ObservProvider │  │ ProjectRunner │ │
│  │   (BYOP)    │  │   (BYOP)    │  │    (BYOP)     │  │    (BYOP)     │ │
│  ├─────────────┤  ├─────────────┤  ├───────────────┤  ├───────────────┤ │
│  │ - Clerk     │  │ - Postgres  │  │ - ClickHouse  │  │ - LocalProc   │ │
│  │ - OIDC      │  │ - LibSQL    │  │ - Postgres    │  │ - Docker      │ │
│  │ - Auth0     │  │ - MongoDB   │  │   (dev only)  │  │ - Kubernetes  │ │
│  └─────────────┘  └─────────────┘  └───────────────┘  └───────────────┘ │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │GitHubService│  │ RBACManager │  │ EmailProvider │  │  Encryption   │ │
│  │  (Required) │  │  (Built-in) │  │    (BYOP)     │  │    (BYOP)     │ │
│  ├─────────────┤  ├─────────────┤  ├───────────────┤  ├───────────────┤ │
│  │ - App Auth  │  │ - Roles     │  │ - Resend      │  │ - AES-256-GCM │ │
│  │ - Repos     │  │ - Permissions│ │ - SendGrid    │  │ - NoOp (dev)  │ │
│  │ - Webhooks  │  │ - Conditions│  │ - Console     │  │ - AWS KMS     │ │
│  └─────────────┘  └─────────────┘  └───────────────┘  └───────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Data Flow Architecture                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PostgreSQL (OLTP)              ClickHouse (OLAP)                       │
│   ┌─────────────────┐            ┌─────────────────┐                     │
│   │ Users, Teams    │            │ Traces          │                     │
│   │ Projects, Builds│            │ Spans           │                     │
│   │ Env Vars, Roles │            │ Logs            │                     │
│   │ Invites, Tokens │            │ Metrics         │                     │
│   └─────────────────┘            │ Scores          │                     │
│                                  └─────────────────┘                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Entities

```typescript
interface User {
  id: string;
  authUserId: string;            // External auth provider ID
  firstName: string;
  lastName: string;
  email: string;
  photoURL?: string;
  activeTeamId?: string;
  activeProjectId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  createdById?: string;
  billing?: TeamBilling;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
}

interface TeamInvite {
  id: string;
  teamId: string;
  invitedById: string;
  receiverEmail: string;
  role: TeamMemberRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

interface TeamInstallation {
  id: string;
  teamId: string;
  installationId: number;        // GitHub's installation ID
  organizationName: string;
  status: 'active' | 'suspended' | 'unknown';
  createdAt: Date;
}
```

### Project Entities

```typescript
interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  repoUrl: string;
  branch: string;
  lastCommitSha?: string;
  teamInstallationId?: string;
  projectRoot: string;
  mastraDirectory: string;
  isMonorepo?: boolean;
  buildCommand?: string;
  installCommand?: string;
  port?: number;
  minScale?: number;
  resources?: { builder?: ResourceLimits; runner?: ResourceLimits };
  isHosting: boolean;
  isPlayground: boolean;
  isSandbox: boolean;
  activeBuildId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectEnvVar {
  id: string;
  projectId: string;
  key: string;
  value: string;                 // Encrypted at rest
  sensitive: boolean;
  createdAt: Date;
}

interface ProjectApiToken {
  id: string;
  projectId: string;
  name: string;
  token: string;                 // Hashed
  expiresAt?: Date;
  createdAt: Date;
}

interface Build {
  id: string;
  projectId: string;
  commitSha: string;
  commitBranch: string;
  status: 'queued' | 'building' | 'ready' | 'failed' | 'cancelled';
  buildLogs?: string;
  url?: string;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Provider Interfaces

### AuthProvider

```typescript
interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
}

abstract class AuthProvider {
  abstract init(): Promise<void>;
  abstract validateToken(token: string): Promise<AuthUser | null>;
  abstract getAuthorizationUrl?(state: string): string;
  abstract handleCallback?(code: string): Promise<AuthUser>;
}
```

**Implementations:** ClerkAuthProvider, OIDCAuthProvider, Auth0AuthProvider

### ProjectRunner

```typescript
interface CloneOptions {
  repoUrl: string;
  branch: string;
  commitSha: string;
  token?: string;
  projectRoot?: string;
}

interface BuildOptions {
  workDir: string;
  installCommand?: string;
  buildCommand?: string;
  env: Record<string, string>;
}

interface StartOptions {
  workDir: string;
  buildId: string;
  port?: number;
  env: Record<string, string>;
  resources?: ResourceLimits;
}

abstract class ProjectRunner {
  abstract init(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract clone(options: CloneOptions): Promise<string>;
  abstract build(options: BuildOptions): Promise<BuildResult>;
  abstract start(options: StartOptions): Promise<StartResult>;
  abstract stop(buildId: string): Promise<void>;
  abstract getLogs(buildId: string): Promise<string>;
  abstract healthCheck(buildId: string): Promise<HealthStatus>;
}
```

**Implementations:** LocalProcessRunner, DockerRunner, KubernetesRunner

### BillingProvider

```typescript
abstract class BillingProvider {
  abstract init(): Promise<void>;
  abstract createCustomer(teamId: string, email: string): Promise<string>;
  abstract createSubscription(teamId: string, priceId: string): Promise<Subscription>;
  abstract cancelSubscription(subscriptionId: string): Promise<void>;
  abstract getSubscription(teamId: string): Promise<Subscription | null>;
  abstract handleWebhook(payload: unknown, signature: string): Promise<void>;
}
```

**Implementations:** StripeBillingProvider, NoBillingProvider

### EmailProvider

```typescript
abstract class EmailProvider {
  abstract sendTeamInvite(params: TeamInviteEmailParams): Promise<void>;
  abstract sendBuildNotification(params: BuildNotificationParams): Promise<void>;
}
```

**Implementations:** ResendEmailProvider, SendGridEmailProvider, ConsoleEmailProvider

### EncryptionProvider

```typescript
abstract class EncryptionProvider {
  abstract encrypt(plaintext: string): Promise<string>;
  abstract decrypt(ciphertext: string): Promise<string>;
}
```

**Implementations:** AES256Encryption, NoOpEncryption, AWSKMSEncryption

---

## Observability

Observability data is stored separately in ClickHouse for high-volume analytical queries.

### Why ClickHouse?

- High-volume ingestion (millions of events/second)
- Optimized for time-series data
- 10-20x compression ratios
- Sub-second queries on billions of rows

### Observability Data Model

```typescript
interface Trace {
  id: string;
  projectId: string;
  buildId?: string;
  name: string;
  sessionId?: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  totalTokens?: number;
  totalCost?: number;
  tags?: string[];
  createdAt: Date;
}

interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  projectId: string;
  name: string;
  type: 'llm' | 'tool' | 'retrieval' | 'embedding' | 'agent' | 'workflow' | 'memory' | 'custom';
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'error';
  level: 'debug' | 'info' | 'warn' | 'error';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  toolName?: string;
  createdAt: Date;
}

interface Log {
  id: string;
  projectId: string;
  buildId?: string;
  traceId?: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  logger?: string;
  attributes?: Record<string, unknown>;
  errorStack?: string;
  createdAt: Date;
}

interface Metric {
  id: string;
  projectId: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit?: string;
  tags: Record<string, string>;
  timestamp: Date;
}

interface Score {
  id: string;
  projectId: string;
  traceId: string;
  name: string;
  value: number;
  source: 'manual' | 'automatic' | 'user_feedback';
  createdAt: Date;
}
```

### ObservabilityProvider Interface

```typescript
abstract class ObservabilityProvider {
  abstract init(): Promise<void>;
  abstract shutdown(): Promise<void>;

  // Traces
  abstract createTrace(trace: CreateTraceInput): Promise<Trace>;
  abstract updateTrace(id: string, input: UpdateTraceInput): Promise<Trace>;
  abstract getTrace(id: string): Promise<Trace | null>;
  abstract listTraces(filter: TraceFilter): Promise<PaginatedResult<Trace>>;

  // Spans
  abstract createSpan(span: CreateSpanInput): Promise<Span>;
  abstract listSpans(traceId: string): Promise<Span[]>;

  // Logs
  abstract ingestLogs(logs: CreateLogInput[]): Promise<void>;
  abstract queryLogs(filter: LogFilter): Promise<PaginatedResult<Log>>;
  abstract streamLogs(filter: LogFilter): AsyncIterable<Log>;

  // Metrics
  abstract recordMetrics(metrics: CreateMetricInput[]): Promise<void>;
  abstract queryMetrics(query: MetricQuery): Promise<MetricResult[]>;

  // Scores
  abstract createScore(score: CreateScoreInput): Promise<Score>;
  abstract listScores(filter: ScoreFilter): Promise<PaginatedResult<Score>>;

  // Analytics
  abstract getProjectStats(projectId: string, timeRange: TimeRange): Promise<ProjectStats>;
  abstract getUsageByModel(projectId: string, timeRange: TimeRange): Promise<ModelUsage[]>;
  abstract getCostBreakdown(projectId: string, timeRange: TimeRange): Promise<CostBreakdown>;

  // Retention
  abstract applyRetentionPolicy(projectId: string, retentionDays: number): Promise<number>;
}
```

**Implementations:** ClickHouseObservability, PostgresObservability (dev)

---

## RBAC & Permissions

Role-Based Access Control enables fine-grained control over who can perform actions.

### Permission Model

```typescript
interface Permission {
  resource: Resource;
  action: Action;
  conditions?: PermissionCondition[];
}

type Resource =
  | 'team' | 'team.members' | 'team.invites' | 'team.billing' | 'team.installations'
  | 'project' | 'project.env_vars' | 'project.headers' | 'project.auth' | 'project.tokens'
  | 'build'
  | 'observability.traces' | 'observability.logs' | 'observability.metrics'
  | '*';

type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage' | '*';

interface PermissionCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'exists';
  value: string | string[] | boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  inherits?: string[];
  isSystem?: boolean;
}

interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  scope: { type: 'global' } | { type: 'team'; teamId: string } | { type: 'project'; projectId: string };
  createdAt: Date;
}
```

### Built-in Roles

| Role | Scope | Description |
|------|-------|-------------|
| `team:owner` | Team | Full control over team and all projects |
| `team:admin` | Team | Manage team settings, members, and projects |
| `team:developer` | Team | Create and manage projects, deploy builds |
| `team:viewer` | Team | Read-only access |
| `project:admin` | Project | Full control over specific project |
| `project:deployer` | Project | Deploy and manage builds only |
| `project:viewer` | Project | Read-only access to specific project |

### Permission Matrix

| Role | Team | Members | Projects | Env Vars | Builds | Logs |
|------|------|---------|----------|----------|--------|------|
| **team:owner** | CRUD | CRUD | CRUD | CRUD | CRUD+X | R |
| **team:admin** | RU | CRUD | CRUD | CRUD | CRUD+X | R |
| **team:developer** | R | R | CRU | CRUD | CR+X | R |
| **team:viewer** | R | R | R | - | R | R |
| **project:admin** | - | - | CRUD | CRUD | CRUD+X | R |
| **project:deployer** | - | - | R | - | CR+X | R |
| **project:viewer** | - | - | R | - | R | R |

*C=Create, R=Read, U=Update, D=Delete, X=Execute (deploy/stop/restart)*

### RBACManager Interface

```typescript
class RBACManager {
  // Role management
  getRole(roleId: string): Role | undefined;
  listRoles(): Role[];
  createRole(role: Role): Promise<Role>;
  deleteRole(roleId: string): Promise<void>;

  // Permission checking
  can(userId: string, resource: Resource, action: Action, context?: PermissionContext): Promise<boolean>;
  assertCan(userId: string, resource: Resource, action: Action, context?: PermissionContext): Promise<void>;
  getEffectivePermissions(userId: string, context?: PermissionContext): Promise<Permission[]>;

  // Role assignment
  assignRole(input: AssignRoleInput): Promise<RoleAssignment>;
  revokeRole(assignmentId: string): Promise<void>;
  getUserRoles(userId: string, scope?: RoleScope): Promise<RoleAssignment[]>;
}

interface PermissionContext {
  userId?: string;
  teamId?: string;
  projectId?: string;
  projectTeamId?: string;
  buildId?: string;
}
```

---

## MastraAdmin API

### Configuration

```typescript
interface MastraAdminConfig {
  id: string;
  auth: AuthProvider;
  storage: AdminStorage;
  runner: ProjectRunner;
  github: GitHubAppConfig;
  observability?: ObservabilityProvider;
  billing?: BillingProvider;
  encryption?: EncryptionProvider;
  email?: EmailProvider;
  rbac?: { customRoles?: Role[] };
  hooks?: AdminHooks;
}

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret?: string;
}
```

### MastraAdmin Methods

```typescript
class MastraAdmin {
  // Accessors
  get auth(): AuthProvider;
  get storage(): AdminStorage;
  get runner(): ProjectRunner;
  get github(): GitHubService;
  get observability(): ObservabilityProvider | undefined;
  get rbac(): RBACManager;

  // Lifecycle
  init(): Promise<void>;
  shutdown(): Promise<void>;

  // User management
  getOrCreateUser(authUser: AuthUser): Promise<User>;
  setActiveTeam(userId: string, teamId: string): Promise<void>;
  setActiveProject(userId: string, projectId: string): Promise<void>;

  // Team management
  createTeam(input: CreateTeamInput, actorId: string): Promise<Team>;
  inviteToTeam(input: InviteInput, actorId: string): Promise<TeamInvite>;
  acceptInvite(token: string, userId: string): Promise<TeamMember>;

  // GitHub integration
  getGitHubInstallUrl(teamId: string): string;
  handleGitHubInstallation(installationId: number, teamId: string, account: GitHubAccount): Promise<TeamInstallation>;
  listRepositories(installationId: string): Promise<GitHubRepository[]>;

  // Project management
  createProject(input: CreateProjectInput, actorId: string): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput, actorId: string): Promise<Project>;
  deleteProject(projectId: string, actorId: string): Promise<void>;

  // Environment variables
  setEnvVar(input: SetEnvVarInput, actorId: string): Promise<ProjectEnvVar>;
  getEnvVars(projectId: string, decrypt?: boolean): Promise<ProjectEnvVar[]>;
  deleteEnvVar(projectId: string, key: string, actorId: string): Promise<void>;

  // Builds
  createBuild(input: CreateBuildInput, actorId: string): Promise<Build>;
  stopBuild(buildId: string, actorId: string): Promise<void>;
  getBuildLogs(buildId: string): Promise<string>;

  // API tokens
  createProjectApiToken(input: CreateTokenInput, actorId: string): Promise<{ token: ProjectApiToken; plainToken: string }>;
  validateProjectApiToken(plainToken: string): Promise<ProjectApiToken | null>;

  // Observability
  getProjectTraces(projectId: string, filter?: TraceFilter): Promise<PaginatedResult<Trace>>;
  getProjectLogs(projectId: string, filter?: LogFilter): Promise<PaginatedResult<Log>>;
  getProjectStats(projectId: string, timeRange: TimeRange): Promise<ProjectStats>;
  streamBuildLogs(buildId: string): AsyncIterable<Log>;

  // RBAC
  assignUserRole(input: AssignRoleInput, actorId: string): Promise<RoleAssignment>;
  revokeUserRole(assignmentId: string, actorId: string): Promise<void>;
  getUserPermissions(userId: string, context?: PermissionContext): Promise<Permission[]>;
}
```

---

## Database Schema

### PostgreSQL (Transactional Data)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  active_team_id UUID,
  active_project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by_id UUID REFERENCES users(id),
  stripe_customer_id TEXT,
  is_trialing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, team_id, id)
);

-- Team Invites
CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  invited_by_id UUID NOT NULL REFERENCES users(id),
  receiver_email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GitHub Installations
CREATE TABLE team_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  installation_id BIGINT NOT NULL,
  organization_name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  team_installation_id UUID REFERENCES team_installations(id),
  project_root TEXT DEFAULT './',
  mastra_directory TEXT DEFAULT 'src/mastra',
  build_command TEXT,
  install_command TEXT,
  port INTEGER,
  is_hosting BOOLEAN DEFAULT TRUE,
  active_build_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, slug)
);

-- Project Env Vars
CREATE TABLE project_env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, key)
);

-- Project API Tokens
CREATE TABLE project_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Builds
CREATE TABLE builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  commit_sha TEXT NOT NULL,
  commit_branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  build_logs TEXT,
  url TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles (custom roles only; built-in are in code)
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  inherits JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Assignments
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_team_id UUID REFERENCES teams(id),
  scope_project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id, scope_type, scope_team_id, scope_project_id)
);
```

### ClickHouse (Observability Data)

```sql
-- Traces
CREATE TABLE traces (
  id String,
  project_id String,
  build_id Nullable(String),
  name String,
  session_id Nullable(String),
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration Nullable(UInt64),
  status Enum8('running' = 1, 'success' = 2, 'error' = 3),
  input Nullable(String),
  output Nullable(String),
  total_tokens Nullable(UInt64),
  total_cost Nullable(Float64),
  tags Array(String),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, start_time, id)
TTL start_time + INTERVAL 90 DAY;

-- Spans
CREATE TABLE spans (
  id String,
  trace_id String,
  parent_span_id Nullable(String),
  project_id String,
  name String,
  type Enum8('llm'=1, 'tool'=2, 'retrieval'=3, 'embedding'=4, 'agent'=5, 'workflow'=6, 'memory'=7, 'custom'=8),
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  status Enum8('running' = 1, 'success' = 2, 'error' = 3),
  level Enum8('debug' = 1, 'info' = 2, 'warn' = 3, 'error' = 4),
  model Nullable(String),
  prompt_tokens Nullable(UInt64),
  completion_tokens Nullable(UInt64),
  cost Nullable(Float64),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, trace_id, start_time, id)
TTL start_time + INTERVAL 90 DAY;

-- Logs
CREATE TABLE logs (
  id String,
  project_id String,
  build_id Nullable(String),
  trace_id Nullable(String),
  timestamp DateTime64(3),
  level Enum8('debug'=1, 'info'=2, 'warn'=3, 'error'=4, 'fatal'=5),
  message String,
  logger Nullable(String),
  attributes Nullable(String),
  error_stack Nullable(String),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
TTL timestamp + INTERVAL 30 DAY;

-- Metrics
CREATE TABLE metrics (
  id String,
  project_id String,
  name String,
  type Enum8('counter' = 1, 'gauge' = 2, 'histogram' = 3),
  value Float64,
  unit Nullable(String),
  tags Map(String, String),
  timestamp DateTime64(3),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, name, timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- Scores
CREATE TABLE scores (
  id String,
  project_id String,
  trace_id String,
  name String,
  value Float64,
  source Enum8('manual' = 1, 'automatic' = 2, 'user_feedback' = 3),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, trace_id, created_at, id)
TTL created_at + INTERVAL 365 DAY;
```

---

## Package Structure

```
packages/admin/
├── src/
│   ├── index.ts                    # Public exports
│   ├── base.ts                     # MastraAdmin class
│   ├── types.ts                    # Core types
│   ├── errors.ts                   # Error classes
│   ├── auth/
│   │   ├── base.ts                 # AuthProvider abstract
│   │   └── providers/              # Clerk, OIDC, Auth0
│   ├── github/
│   │   ├── service.ts              # GitHub API wrapper
│   │   └── webhooks.ts             # Webhook handlers
│   ├── runner/
│   │   ├── base.ts                 # ProjectRunner abstract
│   │   └── providers/              # Local, Docker, Kubernetes
│   ├── storage/
│   │   └── base.ts                 # AdminStorage abstract
│   ├── observability/
│   │   └── base.ts                 # ObservabilityProvider abstract
│   ├── rbac/
│   │   ├── manager.ts              # RBACManager
│   │   ├── roles.ts                # Built-in roles
│   │   └── types.ts                # Permission types
│   ├── billing/
│   │   └── base.ts                 # BillingProvider abstract
│   ├── email/
│   │   └── base.ts                 # EmailProvider abstract
│   └── encryption/
│       └── base.ts                 # EncryptionProvider abstract
├── package.json
└── tsconfig.json

# Storage implementations
packages/admin-pg/                   # PostgreSQL storage

# Observability implementations
packages/admin-clickhouse/           # ClickHouse observability
packages/admin-observability-pg/     # PostgreSQL observability (dev)
```

---

## Next Steps

1. Create `packages/admin` with base classes and interfaces
2. Create `packages/admin-pg` for PostgreSQL storage
3. Create `packages/admin-clickhouse` for ClickHouse observability
4. Implement auth providers (start with OIDC)
5. Implement runners (start with LocalProcessRunner, then Docker)
6. Create Docker Compose for self-hosted deployment
7. Documentation and self-hosting guide
