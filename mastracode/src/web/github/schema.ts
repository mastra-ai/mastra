/**
 * Drizzle schema for the separate application Postgres backing the GitHub App
 * integration. This database is distinct from Mastra's own storage: it holds
 * only the GitHub App installations a user has connected and the repos they have
 * turned into MastraCode Web projects. No agent memory or Mastra data lives here.
 *
 * Rows are always scoped by `user_id` (the stable WorkOS user id) so a user can
 * only ever see and operate on their own installations and projects.
 */

import { bigint, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * A GitHub App installation a user has connected. One user may have several
 * installations (e.g. one personal account + several orgs).
 */
export const githubInstallations = pgTable(
  'github_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable WorkOS user id (`workosId`/`id`). */
    userId: text('user_id').notNull(),
    /** GitHub numeric installation id. */
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    /** GitHub account login the installation belongs to (user or org). */
    accountLogin: text('account_login'),
    /** 'User' or 'Organization'. */
    accountType: text('account_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('github_installations_user_installation_unique').on(table.userId, table.installationId)],
);

/**
 * A repo a user has turned into a project. The repo is materialized lazily into
 * a per-project cloud sandbox (no local clone). `sandboxId` / `materializedAt`
 * are null until the project is first opened.
 */
export const githubProjects = pgTable(
  'github_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable WorkOS user id. */
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
    /** Provider sandbox id once provisioned; null until first open. */
    sandboxId: text('sandbox_id'),
    /** Path inside the sandbox the repo is cloned into. */
    sandboxWorkdir: text('sandbox_workdir').notNull(),
    /** Set when the repo has been cloned into the sandbox; null until then. */
    materializedAt: timestamp('materialized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('github_projects_user_repo_unique').on(table.userId, table.repoId)],
);

export type GithubInstallationRow = typeof githubInstallations.$inferSelect;
export type GithubProjectRow = typeof githubProjects.$inferSelect;
export type NewGithubInstallationRow = typeof githubInstallations.$inferInsert;
export type NewGithubProjectRow = typeof githubProjects.$inferInsert;

/**
 * Idempotent DDL run on boot when the feature is enabled. We keep migrations
 * inline (rather than drizzle-kit generated files) because the schema is small
 * and only ever grows additively; `CREATE TABLE IF NOT EXISTS` keeps boot safe
 * to re-run.
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

CREATE UNIQUE INDEX IF NOT EXISTS github_installations_user_installation_unique
  ON github_installations (user_id, installation_id);

CREATE TABLE IF NOT EXISTS github_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  installation_id bigint NOT NULL,
  repo_full_name text NOT NULL,
  repo_id bigint NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  sandbox_provider text NOT NULL DEFAULT 'railway',
  sandbox_id text,
  sandbox_workdir text NOT NULL,
  materialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS github_projects_user_repo_unique
  ON github_projects (user_id, repo_id);
`;
