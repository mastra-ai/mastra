/**
 * Initial database schema for MastraAdmin
 *
 * Tables:
 * - users: User accounts
 * - teams: Organizational units
 * - team_members: User-team relationships
 * - team_invites: Pending team invitations
 * - team_installations: External service installations (GitHub App, etc.)
 * - projects: Mastra project configurations
 * - project_env_vars: Encrypted environment variables
 * - project_api_tokens: API tokens for project access
 * - deployments: Deployment instances (production, staging, preview)
 * - builds: Build queue and history
 * - running_servers: Active server instances
 * - routes: Edge router registrations
 * - roles: Custom RBAC roles
 * - role_assignments: Role-user-resource mappings
 */

export const TABLES = {
  users: 'admin_users',
  teams: 'admin_teams',
  team_members: 'admin_team_members',
  team_invites: 'admin_team_invites',
  team_installations: 'admin_team_installations',
  projects: 'admin_projects',
  project_env_vars: 'admin_project_env_vars',
  project_api_tokens: 'admin_project_api_tokens',
  deployments: 'admin_deployments',
  builds: 'admin_builds',
  running_servers: 'admin_running_servers',
  routes: 'admin_routes',
  roles: 'admin_roles',
  role_assignments: 'admin_role_assignments',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/**
 * Schema definitions for each table
 */
export const TABLE_SCHEMAS: Record<TableName, string> = {
  // Users table
  [TABLES.users]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  `,

  // Teams table
  [TABLES.teams]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  `,

  // Team members table
  [TABLES.team_members]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES ${TABLES.teams}(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
  `,

  // Team invites table
  [TABLES.team_invites]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES ${TABLES.teams}(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES ${TABLES.users}(id),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  `,

  // Team installations table (GitHub App, etc.)
  [TABLES.team_installations]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES ${TABLES.teams}(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    installation_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    account_type VARCHAR(50),
    permissions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, provider, installation_id)
  `,

  // Projects table
  [TABLES.projects]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES ${TABLES.teams}(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_config JSONB NOT NULL,
    default_branch VARCHAR(255) DEFAULT 'main',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, slug)
  `,

  // Project environment variables table
  [TABLES.project_env_vars]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES ${TABLES.projects}(id) ON DELETE CASCADE,
    deployment_type VARCHAR(50),
    key VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, deployment_type, key)
  `,

  // Project API tokens table
  [TABLES.project_api_tokens]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES ${TABLES.projects}(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_prefix VARCHAR(10) NOT NULL,
    scopes JSONB DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES ${TABLES.users}(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  `,

  // Deployments table
  [TABLES.deployments]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES ${TABLES.projects}(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_build_id UUID,
    public_url TEXT,
    internal_host VARCHAR(255),
    internal_port INTEGER,
    env_var_overrides JSONB DEFAULT '[]',
    auto_shutdown BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, type, branch)
  `,

  // Builds table
  [TABLES.builds]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ${TABLES.deployments}(id) ON DELETE CASCADE,
    trigger VARCHAR(50) NOT NULL,
    triggered_by VARCHAR(255) NOT NULL,
    commit_sha VARCHAR(255),
    commit_message TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    logs TEXT DEFAULT '',
    error_message TEXT,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  `,

  // Running servers table
  [TABLES.running_servers]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ${TABLES.deployments}(id) ON DELETE CASCADE,
    build_id UUID NOT NULL REFERENCES ${TABLES.builds}(id),
    process_id INTEGER,
    container_id VARCHAR(255),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    health_status VARCHAR(50) NOT NULL DEFAULT 'starting',
    last_health_check TIMESTAMPTZ,
    memory_usage_mb REAL,
    cpu_percent REAL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    stopped_at TIMESTAMPTZ
  `,

  // Routes table
  [TABLES.routes]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ${TABLES.deployments}(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ${TABLES.projects}(id) ON DELETE CASCADE,
    subdomain VARCHAR(255) NOT NULL,
    target_host VARCHAR(255) NOT NULL,
    target_port INTEGER NOT NULL,
    public_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tls_enabled BOOLEAN DEFAULT true,
    provider_route_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_health_check TIMESTAMPTZ,
    UNIQUE(subdomain)
  `,

  // Roles table
  [TABLES.roles]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES ${TABLES.teams}(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, name)
  `,

  // Role assignments table
  [TABLES.role_assignments]: `
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES ${TABLES.roles}(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES ${TABLES.users}(id) ON DELETE CASCADE,
    resource_type VARCHAR(50),
    resource_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, user_id, resource_type, resource_id)
  `,
};

/**
 * Index definition type
 */
export interface IndexDefinition {
  table: TableName;
  columns: string[];
  unique?: boolean;
}

/**
 * Default indexes for performance
 */
export const DEFAULT_INDEXES: IndexDefinition[] = [
  // Users
  { table: TABLES.users, columns: ['email'], unique: true },
  { table: TABLES.users, columns: ['external_id'], unique: true },

  // Teams
  { table: TABLES.teams, columns: ['slug'], unique: true },

  // Team members
  { table: TABLES.team_members, columns: ['team_id'] },
  { table: TABLES.team_members, columns: ['user_id'] },
  { table: TABLES.team_members, columns: ['team_id', 'user_id'], unique: true },

  // Team invites
  { table: TABLES.team_invites, columns: ['team_id'] },
  { table: TABLES.team_invites, columns: ['email'] },
  { table: TABLES.team_invites, columns: ['token'], unique: true },

  // Team installations
  { table: TABLES.team_installations, columns: ['team_id'] },
  { table: TABLES.team_installations, columns: ['provider', 'installation_id'] },

  // Projects
  { table: TABLES.projects, columns: ['team_id'] },
  { table: TABLES.projects, columns: ['team_id', 'slug'], unique: true },

  // Project env vars
  { table: TABLES.project_env_vars, columns: ['project_id'] },
  { table: TABLES.project_env_vars, columns: ['project_id', 'deployment_type', 'key'], unique: true },

  // Project API tokens
  { table: TABLES.project_api_tokens, columns: ['project_id'] },
  { table: TABLES.project_api_tokens, columns: ['token_hash'], unique: true },

  // Deployments
  { table: TABLES.deployments, columns: ['project_id'] },
  { table: TABLES.deployments, columns: ['project_id', 'type'] },
  { table: TABLES.deployments, columns: ['status'] },
  { table: TABLES.deployments, columns: ['project_id', 'type', 'branch'], unique: true },

  // Builds
  { table: TABLES.builds, columns: ['deployment_id'] },
  { table: TABLES.builds, columns: ['status'] },
  { table: TABLES.builds, columns: ['status', 'queued_at'] }, // For queue ordering
  { table: TABLES.builds, columns: ['deployment_id', 'created_at DESC'] },

  // Running servers
  { table: TABLES.running_servers, columns: ['deployment_id'] },
  { table: TABLES.running_servers, columns: ['health_status'] },
  { table: TABLES.running_servers, columns: ['deployment_id', 'stopped_at'] },

  // Routes
  { table: TABLES.routes, columns: ['deployment_id'] },
  { table: TABLES.routes, columns: ['project_id'] },
  { table: TABLES.routes, columns: ['subdomain'], unique: true },
  { table: TABLES.routes, columns: ['status'] },

  // Roles
  { table: TABLES.roles, columns: ['team_id'] },
  { table: TABLES.roles, columns: ['team_id', 'name'], unique: true },

  // Role assignments
  { table: TABLES.role_assignments, columns: ['role_id'] },
  { table: TABLES.role_assignments, columns: ['user_id'] },
  { table: TABLES.role_assignments, columns: ['resource_type', 'resource_id'] },
];
