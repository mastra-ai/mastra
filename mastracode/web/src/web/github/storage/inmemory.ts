/**
 * In-memory GitHub storage for tests. Mirrors the pg implementation's
 * semantics — unique-index conflict behavior, race-free get-or-create, and
 * org-scoped reads — without a database.
 */

import { randomUUID } from 'node:crypto';

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

export class GithubStorageInMemory extends GithubStorage {
  installations: GithubInstallationRow[] = [];
  projects: GithubProjectRow[] = [];
  sandboxes: GithubProjectSandboxRow[] = [];
  worktrees: GithubWorktreeRow[] = [];
  subscriptions: GithubSignalSubscriptionRow[] = [];

  async init(_ctx: FactoryStorageContext): Promise<void> {
    // No DDL to run.
  }

  // ── Installations ─────────────────────────────────────────────────────────

  async listInstallations(orgId: string): Promise<GithubInstallationRow[]> {
    return this.installations.filter(row => row.orgId === orgId);
  }

  async getInstallation(orgId: string, installationId: number): Promise<GithubInstallationRow | null> {
    return this.installations.find(row => row.orgId === orgId && row.installationId === installationId) ?? null;
  }

  async insertInstallation(input: NewGithubInstallation): Promise<void> {
    if (await this.getInstallation(input.orgId, input.installationId)) return;
    this.installations.push({ id: randomUUID(), createdAt: new Date(), ...input });
  }

  async deleteInstallation(orgId: string, installationId: number): Promise<void> {
    const retained = this.installations.filter(row => !(row.orgId === orgId && row.installationId === installationId));
    this.installations.splice(0, this.installations.length, ...retained);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async getOrgProject(orgId: string, projectId: string): Promise<GithubProjectRow | null> {
    return this.projects.find(row => row.id === projectId && row.orgId === orgId) ?? null;
  }

  async getProjectById(projectId: string): Promise<GithubProjectRow | null> {
    return this.projects.find(row => row.id === projectId) ?? null;
  }

  async findProjectByRepo(installationId: number, repoFullName: string): Promise<GithubProjectRow | null> {
    return (
      this.projects.find(row => row.installationId === installationId && row.repoFullName === repoFullName) ?? null
    );
  }

  async upsertProject(input: UpsertGithubProjectInput): Promise<GithubProjectRow> {
    const existing = this.projects.find(row => row.orgId === input.orgId && row.repoId === input.repoId);
    if (existing) {
      existing.installationId = input.installationId;
      existing.repoFullName = input.repoFullName;
      existing.defaultBranch = input.defaultBranch;
      existing.sandboxWorkdir = input.sandboxWorkdir;
      return existing;
    }
    const created: GithubProjectRow = { id: randomUUID(), setupCommand: null, createdAt: new Date(), ...input };
    this.projects.push(created);
    return created;
  }

  async setProjectSetupCommand(projectId: string, setupCommand: string | null): Promise<void> {
    const row = this.projects.find(project => project.id === projectId);
    if (row) row.setupCommand = setupCommand;
  }

  // ── Project sandboxes ─────────────────────────────────────────────────────

  async getOrCreateSandbox(
    project: { id: string; sandboxWorkdir: string },
    userId: string,
  ): Promise<GithubProjectSandboxRow> {
    const existing = this.sandboxes.find(row => row.githubProjectId === project.id && row.userId === userId);
    if (existing) return existing;
    const created: GithubProjectSandboxRow = {
      id: randomUUID(),
      githubProjectId: project.id,
      userId,
      sandboxId: null,
      sandboxWorkdir: project.sandboxWorkdir,
      materializedAt: null,
      createdAt: new Date(),
    };
    this.sandboxes.push(created);
    return created;
  }

  async getSandboxById(id: string): Promise<GithubProjectSandboxRow | null> {
    return this.sandboxes.find(row => row.id === id) ?? null;
  }

  async setSandboxId(id: string, sandboxId: string): Promise<void> {
    const row = await this.getSandboxById(id);
    if (row) row.sandboxId = sandboxId;
  }

  async clearSandboxBinding(id: string): Promise<void> {
    const row = await this.getSandboxById(id);
    if (row) {
      row.sandboxId = null;
      row.materializedAt = null;
    }
  }

  async markSandboxMaterialized(id: string): Promise<void> {
    const row = await this.getSandboxById(id);
    if (row) row.materializedAt = new Date();
  }

  // ── Worktrees ─────────────────────────────────────────────────────────────

  async upsertWorktree(input: UpsertGithubWorktreeInput): Promise<void> {
    const existing = await this.getWorktree(input.githubProjectId, input.userId, input.branch);
    if (existing) {
      existing.baseBranch = input.baseBranch;
      existing.worktreePath = input.worktreePath;
      return;
    }
    this.worktrees.push({ id: randomUUID(), createdAt: new Date(), ...input });
  }

  async getWorktree(githubProjectId: string, userId: string, branch: string): Promise<GithubWorktreeRow | null> {
    return (
      this.worktrees.find(
        row => row.githubProjectId === githubProjectId && row.userId === userId && row.branch === branch,
      ) ?? null
    );
  }

  async findWorktreeByPath(
    githubProjectId: string,
    userId: string,
    worktreePath: string,
  ): Promise<GithubWorktreeRow | null> {
    return (
      this.worktrees.find(
        row => row.githubProjectId === githubProjectId && row.userId === userId && row.worktreePath === worktreePath,
      ) ?? null
    );
  }

  async deleteWorktree(githubProjectId: string, userId: string, branch: string): Promise<void> {
    const retained = this.worktrees.filter(
      row => !(row.githubProjectId === githubProjectId && row.userId === userId && row.branch === branch),
    );
    this.worktrees.splice(0, this.worktrees.length, ...retained);
  }

  // ── PR signal subscriptions ───────────────────────────────────────────────

  #matchesTarget(row: GithubSignalSubscriptionRow, input: SubscribeToPullRequestInput): boolean {
    return (
      row.orgId === input.orgId &&
      row.githubProjectId === input.githubProjectId &&
      row.repoId === input.repoId &&
      row.pullRequestNumber === input.pullRequestNumber &&
      row.sessionId === input.sessionId &&
      row.resourceId === input.resourceId &&
      row.threadId === input.threadId &&
      row.sessionScope === normalizedSessionScope(input.sessionScope)
    );
  }

  protected async insertSubscriptionIfAbsent(
    values: NewGithubSignalSubscription,
  ): Promise<GithubSignalSubscriptionRow | null> {
    const conflict = this.subscriptions.some(
      row =>
        row.orgId === values.orgId &&
        row.githubProjectId === values.githubProjectId &&
        row.repoId === values.repoId &&
        row.pullRequestNumber === values.pullRequestNumber &&
        row.sessionId === values.sessionId &&
        row.resourceId === values.resourceId &&
        row.threadId === values.threadId &&
        row.sessionScope === values.sessionScope,
    );
    if (conflict) return null;
    const now = new Date();
    const created: GithubSignalSubscriptionRow = {
      id: randomUUID(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      ...values,
    };
    this.subscriptions.push(created);
    return created;
  }

  protected async findSubscriptionByTarget(
    input: SubscribeToPullRequestInput,
  ): Promise<GithubSignalSubscriptionRow | null> {
    return this.subscriptions.find(row => this.#matchesTarget(row, input)) ?? null;
  }

  protected async deleteSubscriptionByTarget(input: SubscribeToPullRequestInput): Promise<void> {
    const retained = this.subscriptions.filter(row => !this.#matchesTarget(row, input));
    this.subscriptions.splice(0, this.subscriptions.length, ...retained);
  }

  protected async setSubscriptionStatus(
    id: string,
    status: GithubSignalSubscriptionStatus,
    updatedAt: Date,
  ): Promise<void> {
    const row = this.subscriptions.find(subscription => subscription.id === id);
    if (row) {
      row.status = status;
      row.updatedAt = updatedAt;
    }
  }

  async listPullRequestSubscriptionsForThread(input: ThreadSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    const scope = normalizedSessionScope(input.sessionScope);
    return this.subscriptions.filter(
      row =>
        row.orgId === input.orgId &&
        row.resourceId === input.resourceId &&
        row.threadId === input.threadId &&
        row.sessionScope === scope,
    );
  }

  async listPullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]> {
    return this.subscriptions.filter(
      row =>
        row.orgId === input.orgId &&
        row.installationId === input.installationId &&
        row.repoId === input.repoId &&
        row.pullRequestNumber === input.pullRequestNumber,
    );
  }

  async listPullRequestSubscriptionsForWebhook(
    input: GithubWebhookPullRequestTarget,
    options: { includeTerminal?: boolean } = {},
  ): Promise<GithubSignalSubscriptionRow[]> {
    return this.subscriptions.filter(
      row =>
        row.installationId === input.installationId &&
        row.repoId === input.repoId &&
        row.pullRequestNumber === input.pullRequestNumber &&
        (options.includeTerminal ? true : row.status === 'open'),
    );
  }

  async retirePullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<void> {
    const retained = this.subscriptions.filter(
      row =>
        !(
          row.orgId === input.orgId &&
          row.installationId === input.installationId &&
          row.repoId === input.repoId &&
          row.pullRequestNumber === input.pullRequestNumber
        ),
    );
    this.subscriptions.splice(0, this.subscriptions.length, ...retained);
  }
}
