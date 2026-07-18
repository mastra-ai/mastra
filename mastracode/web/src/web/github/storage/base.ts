/**
 * GitHub integration storage domain: typed query surface over the five
 * GitHub app tables (`github_installations`, `github_projects`,
 * `github_project_sandboxes`, `github_worktrees`,
 * `github_signal_subscriptions`).
 *
 * The abstract base declares the contract and owns backend-agnostic
 * semantics (owned-project validation, subscription reopen-on-resubscribe).
 * `GithubStorageOps` declares portable schemas and performs all persistence
 * through the injected `FactoryStorage` operations. The `GithubIntegration`
 * instance hands it to the factory as its `storageDomain` — routes/webhook/tools
 * consume the typed domain, never a raw DB client.
 *
 * The tenancy model is **org-first** (see the table docs below): installations
 * and projects are org-owned; sandboxes and worktrees are `(project, user)`
 * owned; `user_id` on org-owned rows records who connected it (audit only).
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../storage/domain';

// ── Row types ───────────────────────────────────────────────────────────────

/** A GitHub App installation an org has connected (org-owned). */
export interface GithubInstallationRow {
  id: string;
  orgId: string;
  /** Stable user id of whoever connected it (audit only). */
  userId: string;
  /** GitHub numeric installation id. */
  installationId: number;
  /** GitHub account login the installation belongs to (user or org). */
  accountLogin: string | null;
  /** 'User' or 'Organization'. */
  accountType: string | null;
  createdAt: Date;
}

/** A repo an org has turned into a project (org-owned repo metadata). */
export interface GithubProjectRow {
  id: string;
  orgId: string;
  /** Stable user id of whoever created it (audit only). */
  userId: string;
  installationId: number;
  /** `owner/name`. */
  repoFullName: string;
  /** GitHub numeric repo id (stable across renames). */
  repoId: number;
  defaultBranch: string;
  /** Sandbox provider id, e.g. 'railway'. */
  sandboxProvider: string;
  /** Path inside the sandbox the repo is cloned into. */
  sandboxWorkdir: string;
  /** Optional shell command run in every fresh worktree; null when none. */
  setupCommand: string | null;
  createdAt: Date;
}

/** The per-(project, user) sandbox a project's repo is materialized into. */
export interface GithubProjectSandboxRow {
  id: string;
  githubProjectId: string;
  userId: string;
  /** Provider sandbox id once provisioned; null until first open. */
  sandboxId: string | null;
  sandboxWorkdir: string;
  /** Set when the repo has been cloned into the sandbox; null until then. */
  materializedAt: Date | null;
  createdAt: Date;
}

/** A git worktree / feature branch created inside a user's sandbox. */
export interface GithubWorktreeRow {
  id: string;
  orgId: string;
  userId: string;
  githubProjectId: string;
  branch: string;
  baseBranch: string;
  /** Absolute path of the worktree inside the sandbox (server-computed). */
  worktreePath: string;
  createdAt: Date;
}

export type GithubSignalSubscriptionSource = 'auto-gh-pr-create' | 'factory-pr-create' | 'explicit-tool';
export type GithubSignalSubscriptionStatus = 'open' | 'closed' | 'merged';

/** A session's subscription to a pull request's webhook signals. */
export interface GithubSignalSubscriptionRow {
  id: string;
  orgId: string;
  installationId: number;
  githubProjectId: string;
  repoId: number;
  repoFullName: string;
  pullRequestNumber: number;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  sessionScope: string;
  source: GithubSignalSubscriptionSource;
  status: GithubSignalSubscriptionStatus;
  subscribedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Input types ─────────────────────────────────────────────────────────────

export interface NewGithubInstallation {
  orgId: string;
  userId: string;
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
}

export interface UpsertGithubProjectInput {
  orgId: string;
  userId: string;
  installationId: number;
  repoFullName: string;
  repoId: number;
  defaultBranch: string;
  sandboxProvider: string;
  sandboxWorkdir: string;
}

export interface UpsertGithubWorktreeInput {
  orgId: string;
  userId: string;
  githubProjectId: string;
  branch: string;
  baseBranch: string;
  worktreePath: string;
}

export interface SubscribeToPullRequestInput {
  orgId: string;
  installationId: number;
  githubProjectId: string;
  repoId: number;
  pullRequestNumber: number;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
  source: GithubSignalSubscriptionSource;
  subscribedByUserId?: string;
}

export interface ThreadSubscriptionTarget {
  orgId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
}

export interface PullRequestSubscriptionTarget {
  orgId: string;
  installationId: number;
  repoId: number;
  pullRequestNumber: number;
}

export type GithubWebhookPullRequestTarget = Omit<PullRequestSubscriptionTarget, 'orgId'>;

/** Full column set for a subscription insert (repoFullName resolved from the project). */
export type NewGithubSignalSubscription = Omit<
  GithubSignalSubscriptionRow,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

export function normalizedSessionScope(scope: string | undefined): string {
  return scope ?? '';
}

// ── Domain ──────────────────────────────────────────────────────────────────

export abstract class GithubStorage implements FactoryStorageDomain {
  readonly name = 'github';

  /** Run idempotent DDL and bind to the shared connection. */
  abstract init(ctx: FactoryStorageContext): Promise<void>;

  // ── Installations ─────────────────────────────────────────────────────────

  abstract listInstallations(orgId: string): Promise<GithubInstallationRow[]>;
  abstract getInstallation(orgId: string, installationId: number): Promise<GithubInstallationRow | null>;
  /** Insert unless the org already has this installation (conflict → no-op). */
  abstract insertInstallation(input: NewGithubInstallation): Promise<void>;
  abstract deleteInstallation(orgId: string, installationId: number): Promise<void>;

  // ── Projects ──────────────────────────────────────────────────────────────

  /** Org-scoped project lookup; null when absent or owned by another org. */
  abstract getOrgProject(orgId: string, projectId: string): Promise<GithubProjectRow | null>;
  /** Unscoped lookup by id (project-id → org resolution for agent tools). */
  abstract getProjectById(projectId: string): Promise<GithubProjectRow | null>;
  /** Webhook-side lookup: resolve the project from (installation, repo). */
  abstract findProjectByRepo(installationId: number, repoFullName: string): Promise<GithubProjectRow | null>;
  /** Insert or, when `(orgId, repoId)` exists, refresh the repo metadata. */
  abstract upsertProject(input: UpsertGithubProjectInput): Promise<GithubProjectRow>;
  abstract setProjectSetupCommand(projectId: string, setupCommand: string | null): Promise<void>;

  // ── Project sandboxes ─────────────────────────────────────────────────────

  /**
   * Load (or create) the per-(project, user) sandbox binding row. The binding
   * inherits its workdir from the org-owned project; `sandboxId` /
   * `materializedAt` stay null until first open. Race-safe: concurrent
   * creates converge on the row protected by the unique index.
   */
  abstract getOrCreateSandbox(
    project: { id: string; sandboxWorkdir: string },
    userId: string,
  ): Promise<GithubProjectSandboxRow>;
  abstract getSandboxById(id: string): Promise<GithubProjectSandboxRow | null>;
  /** Persist the provider sandbox id after provisioning. */
  abstract setSandboxId(id: string, sandboxId: string): Promise<void>;
  /** Clear the binding (sandboxId + materializedAt) after teardown. */
  abstract clearSandboxBinding(id: string): Promise<void>;
  /** Stamp the binding once the repo has been cloned into the sandbox. */
  abstract markSandboxMaterialized(id: string): Promise<void>;

  // ── Worktrees ─────────────────────────────────────────────────────────────

  /** Insert or, when `(project, user, branch)` exists, refresh base/path. */
  abstract upsertWorktree(input: UpsertGithubWorktreeInput): Promise<void>;
  abstract getWorktree(githubProjectId: string, userId: string, branch: string): Promise<GithubWorktreeRow | null>;
  abstract findWorktreeByPath(
    githubProjectId: string,
    userId: string,
    worktreePath: string,
  ): Promise<GithubWorktreeRow | null>;
  abstract deleteWorktree(githubProjectId: string, userId: string, branch: string): Promise<void>;

  // ── PR signal subscriptions ───────────────────────────────────────────────

  /**
   * Subscribe a session to a PR's webhook signals. Validates the project is
   * owned by the org and matches the (installation, repo) target, then
   * inserts — or, when the exact target already exists, reopens it if it had
   * been retired. Idempotent per unique target.
   */
  async subscribeToPullRequest(input: SubscribeToPullRequestInput): Promise<GithubSignalSubscriptionRow> {
    const project = await this.#loadOwnedProject(input);
    const created = await this.insertSubscriptionIfAbsent({
      orgId: input.orgId,
      installationId: input.installationId,
      githubProjectId: input.githubProjectId,
      repoId: input.repoId,
      repoFullName: project.repoFullName,
      pullRequestNumber: input.pullRequestNumber,
      sessionId: input.sessionId,
      ownerId: input.ownerId,
      resourceId: input.resourceId,
      threadId: input.threadId,
      sessionScope: normalizedSessionScope(input.sessionScope),
      subscribedByUserId: input.subscribedByUserId ?? null,
      source: input.source,
    });
    if (created) return created;

    const existing = await this.findSubscriptionByTarget(input);
    if (!existing) throw new Error('GitHub signal subscription conflict could not be resolved.');
    if (existing.status !== 'open') {
      const updatedAt = new Date();
      await this.setSubscriptionStatus(existing.id, 'open', updatedAt);
      return { ...existing, status: 'open', updatedAt };
    }
    return existing;
  }

  /** Remove the exact subscription target after validating org ownership. */
  async unsubscribeFromPullRequest(input: SubscribeToPullRequestInput): Promise<void> {
    await this.#loadOwnedProject(input);
    await this.deleteSubscriptionByTarget(input);
  }

  async #loadOwnedProject(input: SubscribeToPullRequestInput): Promise<GithubProjectRow> {
    const project = await this.getOrgProject(input.orgId, input.githubProjectId);
    if (!project || project.installationId !== input.installationId || project.repoId !== input.repoId) {
      throw new Error('GitHub project not found for this organization and repository.');
    }
    return project;
  }

  /** Insert unless the exact unique target exists (conflict → null). */
  protected abstract insertSubscriptionIfAbsent(
    values: NewGithubSignalSubscription,
  ): Promise<GithubSignalSubscriptionRow | null>;
  /** Look up the row matching the exact unique subscription target. */
  protected abstract findSubscriptionByTarget(
    input: SubscribeToPullRequestInput,
  ): Promise<GithubSignalSubscriptionRow | null>;
  /** Delete the row matching the exact unique subscription target. */
  protected abstract deleteSubscriptionByTarget(input: SubscribeToPullRequestInput): Promise<void>;
  protected abstract setSubscriptionStatus(
    id: string,
    status: GithubSignalSubscriptionStatus,
    updatedAt: Date,
  ): Promise<void>;

  abstract listPullRequestSubscriptionsForThread(
    input: ThreadSubscriptionTarget,
  ): Promise<GithubSignalSubscriptionRow[]>;
  abstract listPullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<GithubSignalSubscriptionRow[]>;
  /** Webhook-side lookup (no org): all sessions watching this PR. */
  abstract listPullRequestSubscriptionsForWebhook(
    input: GithubWebhookPullRequestTarget,
    options?: { includeTerminal?: boolean },
  ): Promise<GithubSignalSubscriptionRow[]>;
  /** Mark one subscription's PR state (open/closed/merged). */
  async retirePullRequestSubscription(id: string, status: GithubSignalSubscriptionStatus): Promise<void> {
    await this.setSubscriptionStatus(id, status, new Date());
  }
  /** Delete every subscription targeting a PR (org-scoped cleanup). */
  abstract retirePullRequestSubscriptions(input: PullRequestSubscriptionTarget): Promise<void>;
}
