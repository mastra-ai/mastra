import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

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

const INSTALLATIONS = 'github_installations';
const PROJECTS = 'github_projects';
const SANDBOXES = 'github_project_sandboxes';
const WORKTREES = 'github_worktrees';
const SUBSCRIPTIONS = 'github_signal_subscriptions';

export const GITHUB_SCHEMAS: CollectionSchema[] = [
  {
    name: INSTALLATIONS,
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      user_id: { type: 'text' },
      installation_id: { type: 'bigint' },
      account_login: { type: 'text', nullable: true },
      account_type: { type: 'text', nullable: true },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [{ name: 'github_installations_org_installation_unique', columns: ['org_id', 'installation_id'] }],
  },
  {
    name: PROJECTS,
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      user_id: { type: 'text' },
      installation_id: { type: 'bigint' },
      repo_full_name: { type: 'text' },
      repo_id: { type: 'bigint' },
      default_branch: { type: 'text', default: 'main' },
      sandbox_provider: { type: 'text', default: 'railway' },
      sandbox_workdir: { type: 'text' },
      setup_command: { type: 'text', nullable: true },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [{ name: 'github_projects_org_repo_unique', columns: ['org_id', 'repo_id'] }],
  },
  {
    name: SANDBOXES,
    columns: {
      id: { type: 'uuid-pk' },
      github_project_id: { type: 'text' },
      user_id: { type: 'text' },
      sandbox_id: { type: 'text', nullable: true },
      sandbox_workdir: { type: 'text' },
      materialized_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      { name: 'github_project_sandboxes_project_user_unique', columns: ['github_project_id', 'user_id'] },
    ],
  },
  {
    name: WORKTREES,
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      user_id: { type: 'text' },
      github_project_id: { type: 'text' },
      branch: { type: 'text' },
      base_branch: { type: 'text' },
      worktree_path: { type: 'text' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      { name: 'github_worktrees_project_user_branch_unique', columns: ['github_project_id', 'user_id', 'branch'] },
    ],
  },
  {
    name: SUBSCRIPTIONS,
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      installation_id: { type: 'bigint' },
      github_project_id: { type: 'text' },
      repo_id: { type: 'bigint' },
      repo_full_name: { type: 'text' },
      pull_request_number: { type: 'bigint' },
      session_id: { type: 'text' },
      owner_id: { type: 'text' },
      resource_id: { type: 'text' },
      thread_id: { type: 'text' },
      session_scope: { type: 'text', default: '' },
      source: { type: 'text' },
      status: { type: 'text', default: 'open' },
      subscribed_by_user_id: { type: 'text', nullable: true },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'github_signal_subscriptions_target_pr_unique',
        columns: [
          'org_id',
          'github_project_id',
          'repo_id',
          'pull_request_number',
          'session_id',
          'resource_id',
          'thread_id',
          'session_scope',
        ],
      },
    ],
    indexes: [
      {
        name: 'github_signal_subscriptions_pr_lookup',
        columns: ['org_id', 'installation_id', 'repo_id', 'pull_request_number'],
      },
      {
        name: 'github_signal_subscriptions_thread_lookup',
        columns: ['resource_id', 'thread_id', 'session_scope'],
      },
    ],
  },
];

interface InstallationDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  installation_id: number;
  account_login: string | null;
  account_type: string | null;
  created_at: Date;
}

interface ProjectDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  installation_id: number;
  repo_full_name: string;
  repo_id: number;
  default_branch: string;
  sandbox_provider: string;
  sandbox_workdir: string;
  setup_command: string | null;
  created_at: Date;
}

interface SandboxDbRow extends Record<string, unknown> {
  id: string;
  github_project_id: string;
  user_id: string;
  sandbox_id: string | null;
  sandbox_workdir: string;
  materialized_at: Date | null;
  created_at: Date;
}

interface WorktreeDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  github_project_id: string;
  branch: string;
  base_branch: string;
  worktree_path: string;
  created_at: Date;
}

interface SubscriptionDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  installation_id: number;
  github_project_id: string;
  repo_id: number;
  repo_full_name: string;
  pull_request_number: number;
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

function toInstallation(row: InstallationDbRow): GithubInstallationRow {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    installationId: row.installation_id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    createdAt: row.created_at,
  };
}

function toProject(row: ProjectDbRow): GithubProjectRow {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    installationId: row.installation_id,
    repoFullName: row.repo_full_name,
    repoId: row.repo_id,
    defaultBranch: row.default_branch,
    sandboxProvider: row.sandbox_provider,
    sandboxWorkdir: row.sandbox_workdir,
    setupCommand: row.setup_command,
    createdAt: row.created_at,
  };
}

function toSandbox(row: SandboxDbRow): GithubProjectSandboxRow {
  return {
    id: row.id,
    githubProjectId: row.github_project_id,
    userId: row.user_id,
    sandboxId: row.sandbox_id,
    sandboxWorkdir: row.sandbox_workdir,
    materializedAt: row.materialized_at,
    createdAt: row.created_at,
  };
}

function toWorktree(row: WorktreeDbRow): GithubWorktreeRow {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    githubProjectId: row.github_project_id,
    branch: row.branch,
    baseBranch: row.base_branch,
    worktreePath: row.worktree_path,
    createdAt: row.created_at,
  };
}

function toSubscription(row: SubscriptionDbRow): GithubSignalSubscriptionRow {
  return {
    id: row.id,
    orgId: row.org_id,
    installationId: row.installation_id,
    githubProjectId: row.github_project_id,
    repoId: row.repo_id,
    repoFullName: row.repo_full_name,
    pullRequestNumber: row.pull_request_number,
    sessionId: row.session_id,
    ownerId: row.owner_id,
    resourceId: row.resource_id,
    threadId: row.thread_id,
    sessionScope: row.session_scope,
    source: row.source,
    status: row.status,
    subscribedByUserId: row.subscribed_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GithubStorageOps extends GithubStorage {
  #ops?: FactoryStorageOps;

  async init({ storage }: FactoryStorageContext): Promise<void> {
    await storage.ensureCollections(GITHUB_SCHEMAS);
    this.#ops = storage.ops;
  }

  get #db(): FactoryStorageOps {
    if (!this.#ops) throw new Error('[GithubStorageOps] Not initialized — init() has not succeeded.');
    return this.#ops;
  }

  async listInstallations(orgId: string): Promise<GithubInstallationRow[]> {
    return (await this.#db.findMany<InstallationDbRow>(INSTALLATIONS, { org_id: orgId })).map(toInstallation);
  }

  async getInstallation(orgId: string, installationId: number): Promise<GithubInstallationRow | null> {
    const row = await this.#db.findOne<InstallationDbRow>(INSTALLATIONS, {
      org_id: orgId,
      installation_id: installationId,
    });
    return row ? toInstallation(row) : null;
  }

  async insertInstallation(input: NewGithubInstallation): Promise<void> {
    try {
      await this.#db.insertOne(INSTALLATIONS, {
        org_id: input.orgId,
        user_id: input.userId,
        installation_id: input.installationId,
        account_login: input.accountLogin,
        account_type: input.accountType,
        created_at: new Date(),
      });
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
    }
  }

  async deleteInstallation(orgId: string, installationId: number): Promise<void> {
    await this.#db.deleteMany(INSTALLATIONS, { org_id: orgId, installation_id: installationId });
  }

  async getOrgProject(orgId: string, projectId: string): Promise<GithubProjectRow | null> {
    const row = await this.#db.findOne<ProjectDbRow>(PROJECTS, { id: projectId, org_id: orgId });
    return row ? toProject(row) : null;
  }

  async getProjectById(projectId: string): Promise<GithubProjectRow | null> {
    const row = await this.#db.findOne<ProjectDbRow>(PROJECTS, { id: projectId });
    return row ? toProject(row) : null;
  }

  async findProjectByRepo(installationId: number, repoFullName: string): Promise<GithubProjectRow | null> {
    const row = await this.#db.findOne<ProjectDbRow>(PROJECTS, {
      installation_id: installationId,
      repo_full_name: repoFullName,
    });
    return row ? toProject(row) : null;
  }

  async upsertProject(input: UpsertGithubProjectInput): Promise<GithubProjectRow> {
    const row = await this.#db.upsertOne<ProjectDbRow>(PROJECTS, ['org_id', 'repo_id'], {
      org_id: input.orgId,
      user_id: input.userId,
      installation_id: input.installationId,
      repo_full_name: input.repoFullName,
      repo_id: input.repoId,
      default_branch: input.defaultBranch,
      sandbox_provider: input.sandboxProvider,
      sandbox_workdir: input.sandboxWorkdir,
      created_at: new Date(),
    });
    return toProject(row);
  }

  async setProjectSetupCommand(projectId: string, setupCommand: string | null): Promise<void> {
    await this.#db.updateMany(PROJECTS, { id: projectId }, { setup_command: setupCommand });
  }

  async getOrCreateSandbox(
    project: { id: string; sandboxWorkdir: string },
    userId: string,
  ): Promise<GithubProjectSandboxRow> {
    const where = { github_project_id: project.id, user_id: userId };
    const existing = await this.#db.findOne<SandboxDbRow>(SANDBOXES, where);
    if (existing) return toSandbox(existing);

    try {
      return toSandbox(
        await this.#db.insertOne<SandboxDbRow>(SANDBOXES, {
          ...where,
          sandbox_id: null,
          sandbox_workdir: project.sandboxWorkdir,
          materialized_at: null,
          created_at: new Date(),
        }),
      );
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const raced = await this.#db.findOne<SandboxDbRow>(SANDBOXES, where);
      if (!raced) throw error;
      return toSandbox(raced);
    }
  }

  async getSandboxById(id: string): Promise<GithubProjectSandboxRow | null> {
    const row = await this.#db.findOne<SandboxDbRow>(SANDBOXES, { id });
    return row ? toSandbox(row) : null;
  }

  async setSandboxId(id: string, sandboxId: string): Promise<void> {
    await this.#db.updateMany(SANDBOXES, { id }, { sandbox_id: sandboxId });
  }

  async clearSandboxBinding(id: string): Promise<void> {
    await this.#db.updateMany(SANDBOXES, { id }, { sandbox_id: null, materialized_at: null });
  }

  async markSandboxMaterialized(id: string): Promise<void> {
    await this.#db.updateMany(SANDBOXES, { id }, { materialized_at: new Date() });
  }

  async upsertWorktree(input: UpsertGithubWorktreeInput): Promise<void> {
    await this.#db.upsertOne(WORKTREES, ['github_project_id', 'user_id', 'branch'], {
      org_id: input.orgId,
      user_id: input.userId,
      github_project_id: input.githubProjectId,
      branch: input.branch,
      base_branch: input.baseBranch,
      worktree_path: input.worktreePath,
      created_at: new Date(),
    });
  }

  async getWorktree(githubProjectId: string, userId: string, branch: string): Promise<GithubWorktreeRow | null> {
    const row = await this.#db.findOne<WorktreeDbRow>(WORKTREES, {
      github_project_id: githubProjectId,
      user_id: userId,
      branch,
    });
    return row ? toWorktree(row) : null;
  }

  async findWorktreeByPath(
    githubProjectId: string,
    userId: string,
    worktreePath: string,
  ): Promise<GithubWorktreeRow | null> {
    const row = await this.#db.findOne<WorktreeDbRow>(WORKTREES, {
      github_project_id: githubProjectId,
      user_id: userId,
      worktree_path: worktreePath,
    });
    return row ? toWorktree(row) : null;
  }

  async deleteWorktree(githubProjectId: string, userId: string, branch: string): Promise<void> {
    await this.#db.deleteMany(WORKTREES, { github_project_id: githubProjectId, user_id: userId, branch });
  }

  #subscriptionTarget(input: SubscribeToPullRequestInput): CollectionWhere {
    return {
      org_id: input.orgId,
      github_project_id: input.githubProjectId,
      repo_id: input.repoId,
      pull_request_number: input.pullRequestNumber,
      session_id: input.sessionId,
      resource_id: input.resourceId,
      thread_id: input.threadId,
      session_scope: normalizedSessionScope(input.sessionScope),
    };
  }

  protected async insertSubscriptionIfAbsent(
    values: NewGithubSignalSubscription,
  ): Promise<GithubSignalSubscriptionRow | null> {
    const now = new Date();
    try {
      const row = await this.#db.insertOne<SubscriptionDbRow>(SUBSCRIPTIONS, {
        org_id: values.orgId,
        installation_id: values.installationId,
        github_project_id: values.githubProjectId,
        repo_id: values.repoId,
        repo_full_name: values.repoFullName,
        pull_request_number: values.pullRequestNumber,
        session_id: values.sessionId,
        owner_id: values.ownerId,
        resource_id: values.resourceId,
        thread_id: values.threadId,
        session_scope: values.sessionScope,
        source: values.source,
        status: 'open',
        subscribed_by_user_id: values.subscribedByUserId,
        created_at: now,
        updated_at: now,
      });
      return toSubscription(row);
    } catch (error) {
      if (error instanceof UniqueViolationError) return null;
      throw error;
    }
  }

  protected async findSubscriptionByTarget(
    input: SubscribeToPullRequestInput,
  ): Promise<GithubSignalSubscriptionRow | null> {
    const row = await this.#db.findOne<SubscriptionDbRow>(SUBSCRIPTIONS, this.#subscriptionTarget(input));
    return row ? toSubscription(row) : null;
  }

  protected async deleteSubscriptionByTarget(input: SubscribeToPullRequestInput): Promise<void> {
    await this.#db.deleteMany(SUBSCRIPTIONS, this.#subscriptionTarget(input));
  }

  protected async setSubscriptionStatus(
    id: string,
    status: GithubSignalSubscriptionStatus,
    updatedAt: Date,
  ): Promise<void> {
    await this.#db.updateMany(SUBSCRIPTIONS, { id }, { status, updated_at: updatedAt });
  }

  async listPullRequestSubscriptionsForThread(input: ThreadSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    const rows = await this.#db.findMany<SubscriptionDbRow>(SUBSCRIPTIONS, {
      org_id: input.orgId,
      resource_id: input.resourceId,
      thread_id: input.threadId,
      session_scope: normalizedSessionScope(input.sessionScope),
    });
    return rows.map(toSubscription);
  }

  async listPullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    const rows = await this.#db.findMany<SubscriptionDbRow>(SUBSCRIPTIONS, {
      org_id: input.orgId,
      installation_id: input.installationId,
      repo_id: input.repoId,
      pull_request_number: input.pullRequestNumber,
    });
    return rows.map(toSubscription);
  }

  async listPullRequestSubscriptionsForWebhook(
    input: GithubWebhookPullRequestTarget,
    options: { includeTerminal?: boolean } = {},
  ): Promise<GithubSignalSubscriptionRow[]> {
    const rows = await this.#db.findMany<SubscriptionDbRow>(SUBSCRIPTIONS, {
      installation_id: input.installationId,
      repo_id: input.repoId,
      pull_request_number: input.pullRequestNumber,
      ...(options.includeTerminal ? {} : { status: 'open' }),
    });
    return rows.map(toSubscription);
  }

  async retirePullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<void> {
    await this.#db.deleteMany(SUBSCRIPTIONS, {
      org_id: input.orgId,
      installation_id: input.installationId,
      repo_id: input.repoId,
      pull_request_number: input.pullRequestNumber,
    });
  }
}
