/**
 * Postgres GitHub storage, bound to the shared pool from the `PostgresStore`
 * injected into `MastraFactory`. `init()` owns the idempotent DDL and binds
 * all typed GitHub queries to that shared pool.
 *
 * Pre-GA note: rows created before org scoping predate `org_id` and are left
 * NULL. Org-scoped reads require a non-null `org_id`, so legacy rows are
 * simply not returned; acceptable while the feature is behind env flags.
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../storage/domain';
import { GithubStorage, normalizedSessionScope } from './base';
import type {
  GithubInstallationRow,
  GithubProjectRow,
  GithubProjectSandboxRow,
  GithubSignalSubscriptionRow,
  GithubSignalSubscriptionStatus,
  GithubWebhookPullRequestTarget,
  GithubWorktreeRow,
  NewGithubInstallation,
  NewGithubSignalSubscription,
  PullRequestSubscriptionTarget,
  SubscribeToPullRequestInput,
  ThreadSubscriptionTarget,
  UpsertGithubProjectInput,
  UpsertGithubWorktreeInput,
} from './base';

/**
 * Idempotent DDL run at factory boot. Migrations stay inline (rather than
 * generated files) because the schema is small and only ever grows
 * additively; `CREATE ... IF NOT EXISTS` keeps init safe to re-run.
 */
export const GITHUB_DDL = `
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
ALTER TABLE github_projects ADD COLUMN IF NOT EXISTS setup_command text;

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

CREATE TABLE IF NOT EXISTS github_signal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  installation_id bigint NOT NULL,
  github_project_id uuid NOT NULL,
  repo_id bigint NOT NULL,
  repo_full_name text NOT NULL,
  pull_request_number bigint NOT NULL,
  session_id text NOT NULL,
  owner_id text NOT NULL,
  resource_id text NOT NULL,
  thread_id text NOT NULL,
  session_scope text NOT NULL DEFAULT '',
  source text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  subscribed_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE github_signal_subscriptions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE UNIQUE INDEX IF NOT EXISTS github_signal_subscriptions_target_pr_unique
  ON github_signal_subscriptions (
    org_id, github_project_id, repo_id, pull_request_number,
    session_id, resource_id, thread_id, session_scope
  );

CREATE INDEX IF NOT EXISTS github_signal_subscriptions_pr_lookup
  ON github_signal_subscriptions (org_id, installation_id, repo_id, pull_request_number);

CREATE INDEX IF NOT EXISTS github_signal_subscriptions_thread_lookup
  ON github_signal_subscriptions (resource_id, thread_id, session_scope);
`;

// pg returns bigint (int8) columns as strings; these mappers restore the
// numbers drizzle's `{ mode: 'number' }` used to produce.

interface InstallationDbRow {
  id: string;
  org_id: string;
  user_id: string;
  installation_id: string | number;
  account_login: string | null;
  account_type: string | null;
  created_at: Date;
}

function toInstallation(db: InstallationDbRow): GithubInstallationRow {
  return {
    id: db.id,
    orgId: db.org_id,
    userId: db.user_id,
    installationId: Number(db.installation_id),
    accountLogin: db.account_login,
    accountType: db.account_type,
    createdAt: db.created_at,
  };
}

interface ProjectDbRow {
  id: string;
  org_id: string;
  user_id: string;
  installation_id: string | number;
  repo_full_name: string;
  repo_id: string | number;
  default_branch: string;
  sandbox_provider: string;
  sandbox_workdir: string;
  setup_command: string | null;
  created_at: Date;
}

function toProject(db: ProjectDbRow): GithubProjectRow {
  return {
    id: db.id,
    orgId: db.org_id,
    userId: db.user_id,
    installationId: Number(db.installation_id),
    repoFullName: db.repo_full_name,
    repoId: Number(db.repo_id),
    defaultBranch: db.default_branch,
    sandboxProvider: db.sandbox_provider,
    sandboxWorkdir: db.sandbox_workdir,
    setupCommand: db.setup_command,
    createdAt: db.created_at,
  };
}

interface SandboxDbRow {
  id: string;
  github_project_id: string;
  user_id: string;
  sandbox_id: string | null;
  sandbox_workdir: string;
  materialized_at: Date | null;
  created_at: Date;
}

function toSandbox(db: SandboxDbRow): GithubProjectSandboxRow {
  return {
    id: db.id,
    githubProjectId: db.github_project_id,
    userId: db.user_id,
    sandboxId: db.sandbox_id,
    sandboxWorkdir: db.sandbox_workdir,
    materializedAt: db.materialized_at,
    createdAt: db.created_at,
  };
}

interface WorktreeDbRow {
  id: string;
  org_id: string;
  user_id: string;
  github_project_id: string;
  branch: string;
  base_branch: string;
  worktree_path: string;
  created_at: Date;
}

function toWorktree(db: WorktreeDbRow): GithubWorktreeRow {
  return {
    id: db.id,
    orgId: db.org_id,
    userId: db.user_id,
    githubProjectId: db.github_project_id,
    branch: db.branch,
    baseBranch: db.base_branch,
    worktreePath: db.worktree_path,
    createdAt: db.created_at,
  };
}

interface SubscriptionDbRow {
  id: string;
  org_id: string;
  installation_id: string | number;
  github_project_id: string;
  repo_id: string | number;
  repo_full_name: string;
  pull_request_number: string | number;
  session_id: string;
  owner_id: string;
  resource_id: string;
  thread_id: string;
  session_scope: string;
  source: GithubSignalSubscriptionRow['source'];
  status: GithubSignalSubscriptionStatus;
  subscribed_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toSubscription(db: SubscriptionDbRow): GithubSignalSubscriptionRow {
  return {
    id: db.id,
    orgId: db.org_id,
    installationId: Number(db.installation_id),
    githubProjectId: db.github_project_id,
    repoId: Number(db.repo_id),
    repoFullName: db.repo_full_name,
    pullRequestNumber: Number(db.pull_request_number),
    sessionId: db.session_id,
    ownerId: db.owner_id,
    resourceId: db.resource_id,
    threadId: db.thread_id,
    sessionScope: db.session_scope,
    source: db.source,
    status: db.status,
    subscribedByUserId: db.subscribed_by_user_id,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export class GithubStoragePG extends GithubStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(GITHUB_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[GithubStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  // ── Installations ─────────────────────────────────────────────────────────

  async listInstallations(orgId: string): Promise<GithubInstallationRow[]> {
    const { rows } = await this.#db.query<InstallationDbRow>('SELECT * FROM github_installations WHERE org_id = $1', [
      orgId,
    ]);
    return rows.map(toInstallation);
  }

  async getInstallation(orgId: string, installationId: number): Promise<GithubInstallationRow | null> {
    const { rows } = await this.#db.query<InstallationDbRow>(
      'SELECT * FROM github_installations WHERE org_id = $1 AND installation_id = $2',
      [orgId, installationId],
    );
    return rows[0] ? toInstallation(rows[0]) : null;
  }

  async insertInstallation(input: NewGithubInstallation): Promise<void> {
    await this.#db.query(
      `INSERT INTO github_installations (org_id, user_id, installation_id, account_login, account_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (org_id, installation_id) DO NOTHING`,
      [input.orgId, input.userId, input.installationId, input.accountLogin, input.accountType],
    );
  }

  async deleteInstallation(orgId: string, installationId: number): Promise<void> {
    await this.#db.query('DELETE FROM github_installations WHERE org_id = $1 AND installation_id = $2', [
      orgId,
      installationId,
    ]);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async getOrgProject(orgId: string, projectId: string): Promise<GithubProjectRow | null> {
    const { rows } = await this.#db.query<ProjectDbRow>('SELECT * FROM github_projects WHERE id = $1 AND org_id = $2', [
      projectId,
      orgId,
    ]);
    return rows[0] ? toProject(rows[0]) : null;
  }

  async getProjectById(projectId: string): Promise<GithubProjectRow | null> {
    const { rows } = await this.#db.query<ProjectDbRow>('SELECT * FROM github_projects WHERE id = $1', [projectId]);
    return rows[0] ? toProject(rows[0]) : null;
  }

  async findProjectByRepo(installationId: number, repoFullName: string): Promise<GithubProjectRow | null> {
    const { rows } = await this.#db.query<ProjectDbRow>(
      'SELECT * FROM github_projects WHERE installation_id = $1 AND repo_full_name = $2',
      [installationId, repoFullName],
    );
    return rows[0] ? toProject(rows[0]) : null;
  }

  async upsertProject(input: UpsertGithubProjectInput): Promise<GithubProjectRow> {
    const { rows } = await this.#db.query<ProjectDbRow>(
      `INSERT INTO github_projects
         (org_id, user_id, installation_id, repo_full_name, repo_id,
          default_branch, sandbox_provider, sandbox_workdir)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, repo_id) DO UPDATE SET
         installation_id = EXCLUDED.installation_id,
         repo_full_name = EXCLUDED.repo_full_name,
         default_branch = EXCLUDED.default_branch,
         sandbox_workdir = EXCLUDED.sandbox_workdir
       RETURNING *`,
      [
        input.orgId,
        input.userId,
        input.installationId,
        input.repoFullName,
        input.repoId,
        input.defaultBranch,
        input.sandboxProvider,
        input.sandboxWorkdir,
      ],
    );
    return toProject(rows[0]!);
  }

  async setProjectSetupCommand(projectId: string, setupCommand: string | null): Promise<void> {
    await this.#db.query('UPDATE github_projects SET setup_command = $2 WHERE id = $1', [projectId, setupCommand]);
  }

  // ── Project sandboxes ─────────────────────────────────────────────────────

  async getOrCreateSandbox(
    project: { id: string; sandboxWorkdir: string },
    userId: string,
  ): Promise<GithubProjectSandboxRow> {
    const select = () =>
      this.#db.query<SandboxDbRow>(
        'SELECT * FROM github_project_sandboxes WHERE github_project_id = $1 AND user_id = $2',
        [project.id, userId],
      );

    const existing = (await select()).rows[0];
    if (existing) return toSandbox(existing);

    const { rows } = await this.#db.query<SandboxDbRow>(
      `INSERT INTO github_project_sandboxes (github_project_id, user_id, sandbox_workdir)
       VALUES ($1, $2, $3)
       ON CONFLICT (github_project_id, user_id) DO NOTHING
       RETURNING *`,
      [project.id, userId, project.sandboxWorkdir],
    );
    if (rows[0]) return toSandbox(rows[0]);

    // Lost a race: another request inserted the binding first. Re-read it.
    const row = (await select()).rows[0];
    return toSandbox(row!);
  }

  async getSandboxById(id: string): Promise<GithubProjectSandboxRow | null> {
    const { rows } = await this.#db.query<SandboxDbRow>('SELECT * FROM github_project_sandboxes WHERE id = $1', [id]);
    return rows[0] ? toSandbox(rows[0]) : null;
  }

  async setSandboxId(id: string, sandboxId: string): Promise<void> {
    await this.#db.query('UPDATE github_project_sandboxes SET sandbox_id = $2 WHERE id = $1', [id, sandboxId]);
  }

  async clearSandboxBinding(id: string): Promise<void> {
    await this.#db.query(
      'UPDATE github_project_sandboxes SET sandbox_id = NULL, materialized_at = NULL WHERE id = $1',
      [id],
    );
  }

  async markSandboxMaterialized(id: string): Promise<void> {
    await this.#db.query('UPDATE github_project_sandboxes SET materialized_at = now() WHERE id = $1', [id]);
  }

  // ── Worktrees ─────────────────────────────────────────────────────────────

  async upsertWorktree(input: UpsertGithubWorktreeInput): Promise<void> {
    await this.#db.query(
      `INSERT INTO github_worktrees (org_id, user_id, github_project_id, branch, base_branch, worktree_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (github_project_id, user_id, branch) DO UPDATE SET
         base_branch = EXCLUDED.base_branch,
         worktree_path = EXCLUDED.worktree_path`,
      [input.orgId, input.userId, input.githubProjectId, input.branch, input.baseBranch, input.worktreePath],
    );
  }

  async getWorktree(githubProjectId: string, userId: string, branch: string): Promise<GithubWorktreeRow | null> {
    const { rows } = await this.#db.query<WorktreeDbRow>(
      'SELECT * FROM github_worktrees WHERE github_project_id = $1 AND user_id = $2 AND branch = $3',
      [githubProjectId, userId, branch],
    );
    return rows[0] ? toWorktree(rows[0]) : null;
  }

  async findWorktreeByPath(
    githubProjectId: string,
    userId: string,
    worktreePath: string,
  ): Promise<GithubWorktreeRow | null> {
    const { rows } = await this.#db.query<WorktreeDbRow>(
      'SELECT * FROM github_worktrees WHERE github_project_id = $1 AND user_id = $2 AND worktree_path = $3',
      [githubProjectId, userId, worktreePath],
    );
    return rows[0] ? toWorktree(rows[0]) : null;
  }

  async deleteWorktree(githubProjectId: string, userId: string, branch: string): Promise<void> {
    await this.#db.query('DELETE FROM github_worktrees WHERE github_project_id = $1 AND user_id = $2 AND branch = $3', [
      githubProjectId,
      userId,
      branch,
    ]);
  }

  // ── PR signal subscriptions ───────────────────────────────────────────────

  protected async insertSubscriptionIfAbsent(
    values: NewGithubSignalSubscription,
  ): Promise<GithubSignalSubscriptionRow | null> {
    const { rows } = await this.#db.query<SubscriptionDbRow>(
      `INSERT INTO github_signal_subscriptions
         (org_id, installation_id, github_project_id, repo_id, repo_full_name,
          pull_request_number, session_id, owner_id, resource_id, thread_id,
          session_scope, source, subscribed_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (org_id, github_project_id, repo_id, pull_request_number,
                    session_id, resource_id, thread_id, session_scope) DO NOTHING
       RETURNING *`,
      [
        values.orgId,
        values.installationId,
        values.githubProjectId,
        values.repoId,
        values.repoFullName,
        values.pullRequestNumber,
        values.sessionId,
        values.ownerId,
        values.resourceId,
        values.threadId,
        values.sessionScope,
        values.source,
        values.subscribedByUserId,
      ],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  }

  static readonly #TARGET_WHERE = `org_id = $1 AND github_project_id = $2 AND repo_id = $3
     AND pull_request_number = $4 AND session_id = $5 AND resource_id = $6
     AND thread_id = $7 AND session_scope = $8`;

  #targetParams(input: SubscribeToPullRequestInput): unknown[] {
    return [
      input.orgId,
      input.githubProjectId,
      input.repoId,
      input.pullRequestNumber,
      input.sessionId,
      input.resourceId,
      input.threadId,
      normalizedSessionScope(input.sessionScope),
    ];
  }

  protected async findSubscriptionByTarget(
    input: SubscribeToPullRequestInput,
  ): Promise<GithubSignalSubscriptionRow | null> {
    const { rows } = await this.#db.query<SubscriptionDbRow>(
      `SELECT * FROM github_signal_subscriptions WHERE ${GithubStoragePG.#TARGET_WHERE}`,
      this.#targetParams(input),
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  }

  protected async deleteSubscriptionByTarget(input: SubscribeToPullRequestInput): Promise<void> {
    await this.#db.query(
      `DELETE FROM github_signal_subscriptions WHERE ${GithubStoragePG.#TARGET_WHERE}`,
      this.#targetParams(input),
    );
  }

  protected async setSubscriptionStatus(
    id: string,
    status: GithubSignalSubscriptionStatus,
    updatedAt: Date,
  ): Promise<void> {
    await this.#db.query('UPDATE github_signal_subscriptions SET status = $2, updated_at = $3 WHERE id = $1', [
      id,
      status,
      updatedAt,
    ]);
  }

  async listPullRequestSubscriptionsForThread(input: ThreadSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    const { rows } = await this.#db.query<SubscriptionDbRow>(
      `SELECT * FROM github_signal_subscriptions
       WHERE org_id = $1 AND resource_id = $2 AND thread_id = $3 AND session_scope = $4`,
      [input.orgId, input.resourceId, input.threadId, normalizedSessionScope(input.sessionScope)],
    );
    return rows.map(toSubscription);
  }

  async listPullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    const { rows } = await this.#db.query<SubscriptionDbRow>(
      `SELECT * FROM github_signal_subscriptions
       WHERE org_id = $1 AND installation_id = $2 AND repo_id = $3 AND pull_request_number = $4`,
      [input.orgId, input.installationId, input.repoId, input.pullRequestNumber],
    );
    return rows.map(toSubscription);
  }

  async listPullRequestSubscriptionsForWebhook(
    input: GithubWebhookPullRequestTarget,
    options: { includeTerminal?: boolean } = {},
  ): Promise<GithubSignalSubscriptionRow[]> {
    const statusFilter = options.includeTerminal ? '' : ` AND status = 'open'`;
    const { rows } = await this.#db.query<SubscriptionDbRow>(
      `SELECT * FROM github_signal_subscriptions
       WHERE installation_id = $1 AND repo_id = $2 AND pull_request_number = $3${statusFilter}`,
      [input.installationId, input.repoId, input.pullRequestNumber],
    );
    return rows.map(toSubscription);
  }

  async retirePullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<void> {
    await this.#db.query(
      `DELETE FROM github_signal_subscriptions
       WHERE org_id = $1 AND installation_id = $2 AND repo_id = $3 AND pull_request_number = $4`,
      [input.orgId, input.installationId, input.repoId, input.pullRequestNumber],
    );
  }
}
