/**
 * Drizzle schema for the separate application Postgres backing the GitHub App
 * integration. This database is distinct from Mastra's own storage: it holds
 * only the GitHub App installations an org has connected and the repos they have
 * turned into MastraCode Web projects. No agent memory or Mastra data lives here.
 *
 * The tenancy model is **org-first**:
 * - A GitHub App installation and the projects (connected repos) are owned by a
 *   WorkOS **organization** (`org_id`). The same repo can be connected
 *   independently by different orgs.
 * - The per-user build artifacts — the sandbox a repo is materialized into and
 *   the worktrees/branches created in it — are owned by `(org, user)`. Each user
 *   in an org gets their own sandbox + worktrees for the org's project.
 *
 * `user_id` on the installation/project rows records *who connected it* (audit)
 * and no longer scopes reads; org-scoped reads use `org_id`.
 */

import { bigint, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * A GitHub App installation an org has connected. The installation is org-owned:
 * any user in the org can list repos and create projects from it.
 */
export const githubInstallations = pgTable(
  'github_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id. */
    orgId: text('org_id').notNull(),
    /** Stable WorkOS user id of whoever connected it (audit only). */
    userId: text('user_id').notNull(),
    /** GitHub numeric installation id. */
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    /** GitHub account login the installation belongs to (user or org). */
    accountLogin: text('account_login'),
    /** 'User' or 'Organization'. */
    accountType: text('account_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('github_installations_org_installation_unique').on(table.orgId, table.installationId)],
);

/**
 * A repo an org has turned into a project. The project is pure org-level repo
 * metadata; the per-user sandbox the repo is materialized into lives in
 * `github_project_sandboxes`. One project per repo per org.
 */
export const githubProjects = pgTable(
  'github_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id. */
    orgId: text('org_id').notNull(),
    /** Stable WorkOS user id of whoever created it (audit only). */
    userId: text('user_id').notNull(),
    /** Installation the repo is accessed through. */
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    /** `owner/name`. */
    repoFullName: text('repo_full_name').notNull(),
    /** GitHub numeric repo id (stable across renames). */
    repoId: bigint('repo_id', { mode: 'number' }).notNull(),
    /** Repo default branch, used as the clone branch. */
    defaultBranch: text('default_branch').notNull().default('main'),
    /** Sandbox provider id, e.g. 'railway'. */
    sandboxProvider: text('sandbox_provider').notNull().default('railway'),
    /** Path inside the sandbox the repo is cloned into. */
    sandboxWorkdir: text('sandbox_workdir').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('github_projects_org_repo_unique').on(table.orgId, table.repoId)],
);

/**
 * The per-user sandbox a project's repo is materialized into. Each `(project,
 * user)` gets its own sandbox + checkout, so two users in the same org work in
 * isolation against the org's project. `sandboxId` / `materializedAt` are null
 * until the user first opens the project.
 */
export const githubProjectSandboxes = pgTable(
  'github_project_sandboxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Project (org-owned) this sandbox materializes. */
    githubProjectId: uuid('github_project_id').notNull(),
    /** Owning WorkOS user id (the sandbox belongs to this user only). */
    userId: text('user_id').notNull(),
    /** Provider sandbox id once provisioned; null until first open. */
    sandboxId: text('sandbox_id'),
    /** Path inside the sandbox the repo is cloned into. */
    sandboxWorkdir: text('sandbox_workdir').notNull(),
    /** Set when the repo has been cloned into the sandbox; null until then. */
    materializedAt: timestamp('materialized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('github_project_sandboxes_project_user_unique').on(table.githubProjectId, table.userId)],
);

/**
 * A git worktree / feature branch created inside a user's sandbox for a unit of
 * work. Owned by `(org, user)`; one row per `(githubProjectId, userId, branch)`
 * so two users in an org can use the same branch name in their own trees.
 */
export const githubWorktrees = pgTable(
  'github_worktrees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id. */
    orgId: text('org_id').notNull(),
    /** Owning WorkOS user id (the worktree belongs to this user only). */
    userId: text('user_id').notNull(),
    /** Project the worktree belongs to. */
    githubProjectId: uuid('github_project_id').notNull(),
    /** The feature branch this worktree checks out. */
    branch: text('branch').notNull(),
    /** The branch this worktree's branch was forked from. */
    baseBranch: text('base_branch').notNull(),
    /** Absolute path of the worktree inside the sandbox (server-computed). */
    worktreePath: text('worktree_path').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('github_worktrees_project_user_branch_unique').on(table.githubProjectId, table.userId, table.branch),
  ],
);

/**
 * Stable mapping from a tenant key (the sha256 of an `(org, user)` identity, see
 * `tenant-storage.ts`) to the Turso database provisioned for that tenant. Only
 * the durable `db_name`/`hostname` are persisted — never the auth token, which
 * is minted fresh per resolution. The row is written once, on first provision,
 * with `onConflictDoNothing` so concurrent replicas converge on a single DB.
 */
export const tenantDatabases = pgTable('tenant_databases', {
  /** sha256 hex of the `(org, user)` identity (the tenant key). */
  tenantKey: text('tenant_key').primaryKey(),
  /** Turso database name (deterministic, derived from the tenant key). */
  dbName: text('db_name').notNull(),
  /** Turso database hostname, e.g. `<db>-<org>.turso.io`. */
  hostname: text('hostname').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GithubInstallationRow = typeof githubInstallations.$inferSelect;
export type GithubProjectRow = typeof githubProjects.$inferSelect;
export type GithubProjectSandboxRow = typeof githubProjectSandboxes.$inferSelect;
export type GithubWorktreeRow = typeof githubWorktrees.$inferSelect;
export type NewGithubInstallationRow = typeof githubInstallations.$inferInsert;
export type NewGithubProjectRow = typeof githubProjects.$inferInsert;
export type NewGithubProjectSandboxRow = typeof githubProjectSandboxes.$inferInsert;
export type NewGithubWorktreeRow = typeof githubWorktrees.$inferInsert;
export type TenantDatabaseRow = typeof tenantDatabases.$inferSelect;
export type NewTenantDatabaseRow = typeof tenantDatabases.$inferInsert;

/**
 * Idempotent DDL run on boot when the feature is enabled. We keep migrations
 * inline (rather than drizzle-kit generated files) because the schema is small
 * and only ever grows additively; `CREATE TABLE IF NOT EXISTS` keeps boot safe
 * to re-run. New org-scoping columns/indexes are added with
 * `ADD COLUMN IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` so existing
 * deployments migrate forward without a separate migration step.
 *
 * Pre-GA note: existing rows predate `org_id` and are left NULL. Org-scoped
 * reads require a non-null `org_id`, so legacy rows are simply not returned;
 * this is acceptable while the feature is behind env flags and not yet GA.
 */
export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  installation_id bigint NOT NULL,
  account_login text,
  account_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE github_installations ADD COLUMN IF NOT EXISTS org_id text;

CREATE UNIQUE INDEX IF NOT EXISTS github_installations_org_installation_unique
  ON github_installations (org_id, installation_id);

CREATE TABLE IF NOT EXISTS github_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  installation_id bigint NOT NULL,
  repo_full_name text NOT NULL,
  repo_id bigint NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  sandbox_provider text NOT NULL DEFAULT 'railway',
  sandbox_workdir text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE github_projects ADD COLUMN IF NOT EXISTS org_id text;

CREATE UNIQUE INDEX IF NOT EXISTS github_projects_org_repo_unique
  ON github_projects (org_id, repo_id);

CREATE TABLE IF NOT EXISTS github_project_sandboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_project_id uuid NOT NULL,
  user_id text NOT NULL,
  sandbox_id text,
  sandbox_workdir text NOT NULL,
  materialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS github_project_sandboxes_project_user_unique
  ON github_project_sandboxes (github_project_id, user_id);

CREATE TABLE IF NOT EXISTS github_worktrees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  github_project_id uuid NOT NULL,
  branch text NOT NULL,
  base_branch text NOT NULL,
  worktree_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE github_worktrees ADD COLUMN IF NOT EXISTS org_id text;

CREATE UNIQUE INDEX IF NOT EXISTS github_worktrees_project_user_branch_unique
  ON github_worktrees (github_project_id, user_id, branch);

CREATE TABLE IF NOT EXISTS tenant_databases (
  tenant_key text PRIMARY KEY,
  db_name text NOT NULL,
  hostname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
