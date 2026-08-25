import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';
import type { Context } from 'hono';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import type {
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  CreateReviewCommentInput,
  CreateReviewInput,
  DeletePullRequestCommentInput,
  DismissReviewInput,
  ListPullRequestCommentsInput,
  ListPullRequestsInput,
  ListReviewCommentsInput,
  ListReviewsInput,
  MergePullRequestInput,
  PullRequest,
  PullRequestComment,
  PullRequestRef,
  RepositoryAccess,
  Review,
  ReviewComment,
  ReviewRef,
  SubmitReviewInput,
  UpdatePullRequestCommentInput,
  UpdatePullRequestInput,
  UpdateReviewInput,
  UpdateReviewersInput,
  VersionControl,
} from '../../../capabilities/version-control.js';
import { withBaseCheckpointWebhookTrigger } from '../../../sandbox/base-checkpoint-triggers.js';
import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type {
  SourceControlInstallation,
  SourceControlStorageHandle,
} from '../../../storage/domains/source-control/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../../base.js';
import { GithubAppIdentity } from '../../github/app-identity.js';
import type { GithubIntegration, GithubRepositoryPermission, RepoSummary } from '../../github/integration.js';
import { attachGithubIssueReconciler } from '../../github/issue-reconciler.js';
import { reconcileInterval, reconciliationEnabled } from '../../github/reconciliation-config.js';
import { buildGithubRoutes } from '../../github/routes.js';
import { attachGithubReconciler, attachGithubRules } from '../../github/rules.js';
import type { ReconcileIssueState, ReconcilePullRequestState } from '../../github/rules.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from '../../github/session-subscriptions.js';
import type { GithubSubscriptionStorage } from '../../github/subscriptions.js';
import { parseAuthorizedBotsEnv } from '../../github/webhook.js';
import {
  logPlatformInfo,
  logPlatformWarn,
  PlatformApiClient,
  PlatformApiError,
  platformApiClientConfigFromEnv,
} from '../api-client.js';
import { PlatformGithubEventWorker } from './event-worker.js';
import type { PlatformGithubEventStorage } from './event-worker.js';

type GithubActor = { login: string; avatarUrl: string | null; htmlUrl: string | null } | null;

type PlatformGithubInstallation = {
  installationId: number;
  accountLogin: string;
  accountType: string;
  suspendedAt: string | null;
  usable: boolean;
};

type PlatformGithubUserConnection = {
  connected: boolean;
  githubUsername: string | null;
  reason?: 'token-invalid' | 'no-accessible-installation' | 'missing-permissions' | 'verification-unavailable' | null;
};

type GithubIssue = {
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  htmlUrl: string;
  labels: string[];
  assignees: string[];
  commentCount: number;
  user: GithubActor;
  createdAt: string;
  updatedAt: string;
};

type GithubComment = {
  id: number;
  body: string;
  htmlUrl: string;
  user: GithubActor;
  createdAt: string;
  updatedAt: string;
};

type GithubPullRequest = {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  merged: boolean;
  mergeable: boolean | null;
  draft: boolean;
  head: { ref: string; sha: string };
  base: { ref: string; repo: { id: number; fullName: string } };
  user: GithubActor;
  assignees?: string[];
  requestedReviewers?: string[];
  labels?: string[];
  createdAt: string;
  updatedAt: string;
};

type GithubReview = {
  id: number;
  htmlUrl: string | null;
  body: string | null;
  state: 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';
  commitId: string | null;
  submittedAt: string | null;
  user: GithubActor;
};

type GithubReviewComment = GithubComment & {
  path: string;
  line: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  commitId: string;
  replyToId: number | null;
};

const PAGE_SIZE = 30;
const API_PREFIX = '/v1/server';
/**
 * Slug of the GitHub App this integration posts as. Platform credentials do not
 * carry their own identity, so Factory cannot otherwise recognise its own
 * writes — and failing to recognise them makes Factory wake itself. Override
 * with `MASTRA_PLATFORM_GITHUB_APP_SLUG` when pointing at a non-production App.
 */
const PLATFORM_GITHUB_APP_SLUG = 'mastra-platform';
/**
 * How long an installation's repository listing may be reused. The repos
 * route and token minting both call it — often several times within one UI
 * interaction — and each call is a full Platform round trip.
 */
const INSTALLATION_REPOS_CACHE_TTL_MS = 30_000;
/**
 * How long a minted repository-scoped token may be reused. GitHub
 * installation tokens live ~60 minutes; 5 minutes keeps a wide validity
 * margin while collapsing the per-session-materialization mint round trip.
 */
const REPOSITORY_ACCESS_CACHE_TTL_MS = 5 * 60_000;
/**
 * Upper bound for both TTL caches. Entries expire lazily on re-access, so
 * without a hard cap keys that stop being queried would accumulate for the
 * integration's (long) lifetime. Insertion-order eviction — matches the
 * bounded verification cache in `@mastra/auth-studio`.
 */
const MAX_CACHE_ENTRIES = 1000;

function setBounded<K, V>(cache: Map<K, V>, key: K, value: V): void {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

const REPOSITORY_TOKEN_PERMISSIONS = {
  contents: 'write',
  issues: 'write',
  pull_requests: 'write',
} as const;

function loose(c: unknown): Context {
  return c as Context;
}

function routeBaseUrl(ctx: IntegrationContext, requestUrl: string): string {
  return (ctx.baseUrl || new URL(requestUrl).origin).replace(/\/+$/, '');
}

export class PlatformGithubIntegration implements FactoryIntegration {
  readonly id = 'github';
  readonly #client: PlatformApiClient;
  readonly #endpointHost: string;
  readonly #slug: string | undefined;
  /**
   * Factory's own GitHub identity. Platform credentials do not carry the login
   * they post as, so this starts from the configured slug (usually absent on a
   * Platform deployment) and is corrected the first time Factory writes.
   */
  readonly identity: GithubAppIdentity;
  /**
   * Extra reviewer bot logins this deployment trusts for author-gated
   * notifications, merged over the built-in defaults.
   */
  readonly authorizedBots: readonly string[];
  readonly #pollingEnabled: boolean;
  readonly #pollingIntervalMs: number | undefined;
  readonly #pullRequestReconcileEnabled: boolean;
  readonly #issueReconcileEnabled: boolean;
  readonly #pullRequestReconcileIntervalMs: number | undefined;
  readonly #issueReconcileIntervalMs: number | undefined;
  #storage: SourceControlStorageHandle | undefined;
  #integrationStorage: GithubSubscriptionStorage | undefined;
  /** installationId → cached repository listing (TTL-bounded). */
  readonly #installationReposCache = new Map<number, { repos: RepoSummary[]; expiresAt: number }>();
  /** `orgId:repositoryId` → cached repository access (TTL-bounded). */
  readonly #repositoryAccessCache = new Map<string, { access: RepositoryAccess; expiresAt: number }>();

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: async ({ orgId, userId }) => {
      const installations = await this.#client.request<{
        installations: Array<{
          installationId: number;
          accountLogin: string;
          accountType: string;
          suspendedAt: string | null;
          usable: boolean;
        }>;
      }>('GET', `${API_PREFIX}/github-app/installations`);
      const usable = installations.installations.filter(
        installation => installation.usable && !installation.suspendedAt,
      );
      const repositories = await Promise.all(
        usable.map(async installation => {
          const storedInstallation = await this.versionControl.registerInstallation({
            orgId,
            userId,
            installation: {
              externalId: String(installation.installationId),
              accountName: installation.accountLogin,
              accountType: installation.accountType,
            },
          });
          const result = await this.#client.request<{
            repositories: Array<{
              id: number;
              fullName: string;
              private: boolean;
              defaultBranch: string;
              htmlUrl: string;
            }>;
          }>('GET', `${API_PREFIX}/github-app/installations/${installation.installationId}/repositories`);
          await this.versionControl.registerRepositories({
            orgId,
            installationId: storedInstallation.id,
            repositories: result.repositories.map(repository => ({
              externalId: String(repository.id),
              slug: repository.fullName,
              defaultBranch: repository.defaultBranch,
              metadata: { private: repository.private, url: repository.htmlUrl },
            })),
          });
          return result.repositories.map(repository => ({ repository, installation }));
        }),
      );
      return repositories.flat().map(({ repository, installation }) => ({
        id: repository.fullName,
        name: repository.fullName,
        type: 'repository',
        metadata: {
          installationId: installation.installationId,
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          repositoryId: repository.id,
          defaultBranch: repository.defaultBranch,
          private: repository.private,
          url: repository.htmlUrl,
        },
      }));
    },
    listItems: async ({ sourceIds, cursor }) => {
      const page = parsePositiveCursor(cursor);
      const pages = await Promise.all(
        sourceIds.map(async sourceId => {
          const connection = { type: 'app-installation' as const, installationId: 1 };
          const [issues, pullRequests] = await Promise.all([
            this.#listIssues(connection, sourceId, page),
            this.#listPullRequests({ connection, sourceId, includeDrafts: false, cursor: String(page) }),
          ]);
          return {
            items: [
              ...issues.issues.map(issue => ({
                source: { type: 'issue', externalId: `${sourceId}:${issue.id}`, url: issue.url },
                sourceId,
                title: issue.title,
                status: issue.state ?? undefined,
                labels: issue.labels,
                assignee: issue.assignee,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
                metadata: { repository: sourceId, number: Number(issue.id), author: issue.author },
              })),
              ...pullRequests.pullRequests.map(pullRequest => ({
                source: { type: 'pull-request', externalId: `${sourceId}:${pullRequest.id}`, url: pullRequest.url },
                sourceId,
                title: pullRequest.title,
                status: pullRequest.state,
                createdAt: pullRequest.createdAt,
                updatedAt: pullRequest.updatedAt,
                metadata: {
                  repository: sourceId,
                  number: Number(pullRequest.id),
                  author: pullRequest.author,
                  baseBranch: pullRequest.baseBranch,
                  headBranch: pullRequest.headBranch,
                },
              })),
            ],
            hasNextPage: issues.nextCursor !== null || pullRequests.nextCursor !== null,
          };
        }),
      );
      return {
        items: pages.flatMap(result => result.items),
        nextCursor: pages.some(result => result.hasNextPage) ? String(page + 1) : null,
      };
    },
    listIssues: async input => {
      requireGithubConnection(input.connection);
      const sourceId = requireSingleSource(input.sourceIds, 'GitHub Intake requires exactly one repository source.');
      return this.#listIssues(input.connection, sourceId, parsePositiveCursor(input.cursor), input.labels);
    },
    getIssue: input => this.#getIssue(input.connection, input.sourceId, input.issueId),
    createComment: input => this.#createIssueComment(input),
    updateIssue: input => this.#updateIntakeIssue(input),
  };

  readonly versionControl: VersionControl = {
    initialize: ({ storage }) => {
      this.#storage = storage;
    },
    registerInstallation: ({ orgId, userId, installation }) =>
      this.storage.installations.upsert({
        orgId,
        connectedByUserId: userId,
        externalId: installation.externalId,
        accountName: installation.accountName,
        accountType: installation.accountType,
        providerMetadata: installation.metadata,
      }),
    registerRepositories: ({ orgId, installationId, repositories }) =>
      Promise.all(
        repositories.map(repository =>
          this.storage.repositories.upsert({
            orgId,
            input: {
              installationId,
              externalId: repository.externalId,
              slug: repository.slug,
              defaultBranch: repository.defaultBranch,
              providerMetadata: repository.metadata,
            },
          }),
        ),
      ),
    getRepositoryAccess: async ({ orgId, repositoryId }) => {
      // Every session materialization requests access; reuse a recent grant
      // instead of re-minting through the Platform each time. The TTL keeps
      // a wide margin under GitHub's ~60min installation-token lifetime.
      const cacheKey = `${orgId}:${repositoryId}`;
      const cached = this.#repositoryAccessCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.access;
      this.#repositoryAccessCache.delete(cacheKey);

      const repository = await this.storage.repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const cloneUrl = `https://github.com/${repository.slug}.git`;
      const installation = await this.storage.installations.get({ orgId, id: repository.installationId });
      if (!installation) throw new Error('Version-control installation not found.');
      const installationId = parsePositiveInteger(installation.externalId);
      if (installationId === null) throw new Error('GitHub installation id is invalid.');
      const repositoryName = splitRepository(repository.slug).repo;

      try {
        const token = await this.#client.request<{ token: string }>(
          'POST',
          `${API_PREFIX}/github-app/installations/${installationId}/token`,
          { repositories: [repositoryName], permissions: REPOSITORY_TOKEN_PERMISSIONS },
        );
        const access: RepositoryAccess = {
          cloneUrl,
          authorization: { scheme: 'bearer', token: token.token },
        };
        setBounded(this.#repositoryAccessCache, cacheKey, {
          access,
          expiresAt: Date.now() + REPOSITORY_ACCESS_CACHE_TTL_MS,
        });
        return access;
      } catch (err) {
        // Recover from stale installation: when a GitHub App is uninstalled and reinstalled,
        // GitHub assigns a new installation ID. Platform creates a new installation row,
        // and Factory's intake.listSources creates a new local installation row with the
        // new externalId. Try to find the new installation by accountName.
        if (!isDeadInstallation(err) || !installation.accountName) throw err;
        const installations = await this.storage.installations.list({ orgId });
        const newInstallation = installations.find(
          inst => inst.accountName === installation.accountName && inst.id !== installation.id,
        );
        if (!newInstallation) throw err;
        const newInstallationId = parsePositiveInteger(newInstallation.externalId);
        if (newInstallationId === null) throw err;

        // Persist the migration so we don't hit the recovery path on every call.
        await this.storage.repositories.migrateInstallation({
          orgId,
          id: repositoryId,
          newInstallationId: newInstallation.id,
        });

        const token = await this.#client.request<{ token: string }>(
          'POST',
          `${API_PREFIX}/github-app/installations/${newInstallationId}/token`,
          { repositories: [repositoryName], permissions: REPOSITORY_TOKEN_PERMISSIONS },
        );
        const access: RepositoryAccess = {
          cloneUrl,
          authorization: { scheme: 'bearer', token: token.token },
        };
        setBounded(this.#repositoryAccessCache, cacheKey, {
          access,
          expiresAt: Date.now() + REPOSITORY_ACCESS_CACHE_TTL_MS,
        });
        return access;
      }
    },
    listPullRequests: input => this.#listPullRequests(input),
    getPullRequest: input => this.#getPullRequest(input),
    createPullRequest: input => this.#createPullRequest(input),
    updatePullRequest: input => this.#updatePullRequest(input),
    closePullRequest: input => this.#updatePullRequest({ ...input, state: 'closed' }),
    mergePullRequest: input => this.#mergePullRequest(input),
    listComments: input => this.#listComments(input),
    createComment: input => this.#createComment(input),
    updateComment: input => this.#updateComment(input),
    deleteComment: input => this.#deleteComment(input),
    listReviews: input => this.#listReviews(input),
    getReview: input => this.#getReview(input),
    createReview: input => this.#createReview(input),
    updateReview: input => this.#updateReview(input),
    submitReview: input => this.#submitReview(input),
    dismissReview: input => this.#dismissReview(input),
    deletePendingReview: input => this.#deletePendingReview(input),
    listReviewComments: input => this.#listReviewComments(input),
    createReviewComment: input => this.#createReviewComment(input),
    updateReviewComment: input => this.#updateReviewComment(input),
    deleteReviewComment: input => this.#deleteReviewComment(input),
    listRequestedReviewers: input => this.#requestedReviewers('GET', input),
    requestReviewers: input => this.#requestedReviewers('POST', input),
    removeRequestedReviewers: input => this.#requestedReviewers('DELETE', input),
  };

  constructor(
    options: {
      /** GitHub App slug used to recognize Factory's own webhook writes. */
      slug?: string;
    } = {},
  ) {
    const config = platformApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(config);
    this.#endpointHost = new URL(config.baseUrl).host;
    this.#slug = options.slug;
    // Identity is deliberately NOT taken from `options.slug`. That slug names
    // the deployment's own self-hosted GitHub App, which is a different App
    // than the one this integration posts as — and on a Platform deployment it
    // is legitimately unset. Borrowing it is what left every self-loop guard
    // comparing against `undefined[bot]`. This integration *is* the Platform
    // App, so it names itself, with an override for non-production Apps.
    this.identity = new GithubAppIdentity(
      process.env.MASTRA_PLATFORM_GITHUB_APP_SLUG?.trim() || PLATFORM_GITHUB_APP_SLUG,
    );
    this.authorizedBots = parseAuthorizedBotsEnv(process.env.MASTRACODE_GITHUB_AUTHORIZED_BOTS) ?? [];
    this.#pollingEnabled = process.env.MASTRA_PLATFORM_GITHUB_POLLING_ENABLED?.trim().toLowerCase() !== 'false';
    this.#pollingIntervalMs = optionalPositiveIntegerEnv('MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS');
    const legacyReconcileEnabled = process.env.MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED;
    this.#pullRequestReconcileEnabled = reconciliationEnabled(
      process.env.MASTRACODE_PLATFORM_GITHUB_PR_RECONCILE_ENABLED,
      legacyReconcileEnabled,
    );
    this.#issueReconcileEnabled = reconciliationEnabled(
      process.env.MASTRACODE_PLATFORM_GITHUB_ISSUE_RECONCILE_ENABLED,
      legacyReconcileEnabled,
    );
    const legacyReconcileIntervalMs = reconcileInterval(process.env.MASTRACODE_PLATFORM_GITHUB_RECONCILE_INTERVAL_MS);
    this.#pullRequestReconcileIntervalMs =
      reconcileInterval(process.env.MASTRACODE_PLATFORM_GITHUB_PR_RECONCILE_INTERVAL_MS) ?? legacyReconcileIntervalMs;
    this.#issueReconcileIntervalMs =
      reconcileInterval(process.env.MASTRACODE_PLATFORM_GITHUB_ISSUE_RECONCILE_INTERVAL_MS) ?? legacyReconcileIntervalMs;
  }

  /** GitHub App slug when the deployment explicitly provides it. */
  get slug(): string | undefined {
    return this.#slug;
  }

  get storage(): SourceControlStorageHandle {
    if (!this.#storage) throw new Error('PlatformGithubIntegration source-control storage has not been initialized.');
    return this.#storage;
  }

  get sourceControlStorage(): SourceControlStorageHandle {
    return this.storage;
  }

  get integrationStorage(): GithubSubscriptionStorage {
    if (!this.#integrationStorage) {
      throw new Error('PlatformGithubIntegration generic storage has not been initialized.');
    }
    return this.#integrationStorage;
  }

  /** Resolve a stored GitHub locator without scanning installations or repositories. */
  async #resolveIntakeDispatch({
    orgId,
    externalSource,
  }: {
    orgId: string;
    externalSource: { type: string; externalId: string };
  }): Promise<{ connection: IntegrationConnection; sourceId: string; issueId: string } | null> {
    const target = parseGithubExternalTarget(externalSource.externalId);
    if (!target) return null;
    const repository = target.repository.includes('/')
      ? target.repository
      : (await this.storage.repositories.findByExternalId({ orgId, externalId: target.repository }))?.slug;
    if (!repository) return null;
    return {
      connection: { type: 'app-installation', installationId: 1 },
      sourceId: repository,
      issueId: target.issueId,
    };
  }

  initialize({ storage }: { storage: IntegrationStorageHandle }): void {
    this.#integrationStorage = storage as unknown as GithubSubscriptionStorage;
    logPlatformInfo('Platform GitHub integration initialized', {
      endpointHost: this.#endpointHost,
      pollingEnabled: this.#pollingEnabled,
      pollingIntervalMs: this.#pollingIntervalMs,
      pullRequestReconcileEnabled: this.#pullRequestReconcileEnabled,
      issueReconcileEnabled: this.#issueReconcileEnabled,
    });
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    const ingestFactoryEvent = withBaseCheckpointWebhookTrigger(attachGithubRules(this, ctx), ctx.baseCheckpoints);
    return [
      this.#statusRoute(ctx),
      this.#connectRoute(ctx),
      this.#connectUserRoute(ctx),
      ...buildGithubRoutes({
        auth: ctx.auth,
        fleet: ctx.fleet,
        storage: ctx.factoryStorage,
        github: this as unknown as GithubIntegration,
        stateSigner: ctx.stateSigner,
        baseUrl: ctx.baseUrl,
        controller: ctx.controller,
        memorySettings: ctx.storage.memorySettings,
        projects: ctx.storage.projects,
        emitAudit: ctx.hooks?.emitAudit,
        ingestFactoryEvent,
      }).filter(
        route =>
          route.path !== '/web/github/status' &&
          route.path !== '/web/github/webhook' &&
          !route.path.startsWith('/auth/github/'),
      ),
    ];
  }

  #statusRoute(ctx: IntegrationContext): ApiRoute {
    return registerApiRoute('/web/github/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        await ctx.auth.ensureUser(loose(c));
        const tenant = ctx.auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);
        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            sandboxEnabled: ctx.fleet.enabled,
            organizationRequired: true,
            connected: false,
            installations: [],
            userConnected: false,
            userGithubUsername: null,
            reason: 'organization_required',
            diagnostics: this.diagnostics(),
          });
        }

        const [installations, userConnection] = await Promise.all([
          this.#syncInstallations(tenant.orgId, tenant.userId),
          this.#fetchUserConnection(tenant.userId),
        ]);
        return c.json({
          enabled: true,
          sandboxEnabled: ctx.fleet.enabled,
          connected: installations.length > 0,
          installations: installations.map(installation => ({
            installationId: Number(installation.externalId),
            accountLogin: installation.accountName,
            accountType: installation.accountType,
          })),
          userConnected: userConnection.connected,
          userGithubUsername: userConnection.githubUsername,
          reason: installations.length > 0 ? 'ready' : 'not_connected',
          diagnostics: this.diagnostics(),
        });
      },
    });
  }

  #connectRoute(ctx: IntegrationContext): ApiRoute {
    return registerApiRoute('/auth/github/connect', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        await ctx.auth.ensureUser(loose(c));
        const tenant = ctx.auth.tenant(loose(c));
        if (!tenant?.orgId) return c.json({ error: 'unauthorized' }, 401);

        const redirectTo = c.req.query('redirectTo') || c.req.query('return_to') || '/';
        const originator = routeBaseUrl(ctx, c.req.url);
        logPlatformInfo('Starting Platform GitHub connect flow', {
          orgId: tenant.orgId,
          redirectTo,
          originator,
        });
        const query = new URLSearchParams({
          action: 'install',
          redirectTo,
          originator,
        });
        const { url } = await this.#client.request<{ url: string }>(
          'GET',
          `${API_PREFIX}/github-app/install-url?${query}`,
        );
        return c.redirect(url);
      },
    });
  }

  #connectUserRoute(ctx: IntegrationContext): ApiRoute {
    return registerApiRoute('/auth/github/connect-user', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        await ctx.auth.ensureUser(loose(c));
        const tenant = ctx.auth.tenant(loose(c));
        if (!tenant?.orgId) return c.json({ error: 'unauthorized' }, 401);

        const redirectTo = c.req.query('redirectTo') || c.req.query('return_to') || '/';
        const originator = routeBaseUrl(ctx, c.req.url);
        logPlatformInfo('Starting Platform GitHub user authorization flow', {
          orgId: tenant.orgId,
          redirectTo,
          originator,
        });
        const query = new URLSearchParams({
          userId: tenant.userId,
          redirectTo,
          originator,
        });
        const { url } = await this.#client.request<{ url: string }>(
          'GET',
          `${API_PREFIX}/github-app/authenticate?${query}`,
        );
        return c.redirect(url);
      },
    });
  }

  /**
   * Personal GitHub connection status for the acting user. Returns
   * not-connected when the platform predates the user-connection endpoint.
   */
  async #fetchUserConnection(userId: string): Promise<PlatformGithubUserConnection> {
    try {
      const connection = await this.#client.request<PlatformGithubUserConnection>(
        'GET',
        `${API_PREFIX}/github-app/user-connection?${new URLSearchParams({ userId })}`,
      );
      if (!connection.connected && connection.reason) {
        logPlatformWarn('Platform GitHub user connection verification failed', {
          userId,
          reason: connection.reason,
        });
      }
      return connection;
    } catch {
      return { connected: false, githubUsername: null };
    }
  }

  async #syncInstallations(orgId: string, userId: string): Promise<SourceControlInstallation[]> {
    const result = await this.#client.request<{ installations: PlatformGithubInstallation[] }>(
      'GET',
      `${API_PREFIX}/github-app/installations`,
    );
    const usableInstallations = result.installations.filter(
      installation => installation.usable && !installation.suspendedAt,
    );
    return Promise.all(
      usableInstallations.map(installation =>
        this.versionControl.registerInstallation({
          orgId,
          userId,
          installation: {
            externalId: String(installation.installationId),
            accountName: installation.accountLogin,
            accountType: installation.accountType,
          },
        }),
      ),
    );
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!this.#pollingEnabled && !this.#pullRequestReconcileEnabled && !this.#issueReconcileEnabled) return [];
    if (!ctx.controller) {
      throw new Error('Platform GitHub event polling requires the mounted Mastra Code controller.');
    }
    return [
      new PlatformGithubEventWorker({
        client: this.#client,
        controller: ctx.controller,
        github: this,
        storage: ctx.storage.generic as unknown as PlatformGithubEventStorage,
        ingestFactoryEvent: withBaseCheckpointWebhookTrigger(attachGithubRules(this, ctx), ctx.baseCheckpoints),
        reconcileFactoryState: this.#pullRequestReconcileEnabled
          ? attachGithubReconciler(this, ctx, input => this.fetchPullRequestState(input))
          : undefined,
        reconcileIssuesFactoryState: this.#issueReconcileEnabled
          ? attachGithubIssueReconciler(this, ctx, input => this.fetchIssueState(input))
          : undefined,
        ...(ctx.baseCheckpoints ? { sweepBaseCheckpoints: () => ctx.baseCheckpoints!.sweep() } : {}),
        pollEventsEnabled: this.#pollingEnabled,
        intervalMs: this.#pollingIntervalMs,
        pullRequestReconcileIntervalMs: this.#pullRequestReconcileIntervalMs,
        issueReconcileIntervalMs: this.#issueReconcileIntervalMs,
        // Resolved lazily: workers are constructed before versionControl
        // storage is initialized, and the worker only reads these slices once
        // it is running.
        sourceControl: {
          projectRepositories: {
            listConfiguredExternalKeys: () => this.storage.projectRepositories.listConfiguredExternalKeys(),
            listByExternalRepository: args => this.storage.projectRepositories.listByExternalRepository(args),
          },
          repositories: {
            findByExternalId: args => this.storage.repositories.findByExternalId(args),
          },
        },
      }),
    ];
  }

  /**
   * Reads live PR state through the Platform GitHub proxy for the merge
   * reconciler. Returns undefined when the PR cannot be resolved (missing,
   * proxy error) so a sweep never fabricates a merge.
   */
  async fetchPullRequestState(input: {
    installationId: number;
    repository: string;
    number: number;
  }): Promise<ReconcilePullRequestState | undefined> {
    let repository: { owner: string; repo: string };
    try {
      repository = splitRepository(input.repository);
    } catch {
      return undefined;
    }
    try {
      const result = await this.#client.request<{
        title?: string;
        html_url?: string;
        state?: string;
        draft?: boolean;
        merged?: boolean;
        created_at?: string;
        user?: { login?: string } | null;
        assignees?: Array<{ login?: string }> | null;
        requested_reviewers?: Array<{ login?: string }> | null;
        labels?: Array<{ name?: string } | string> | null;
        merged_by?: { login?: string } | null;
        head?: { ref?: string };
        base?: { ref?: string };
      }>(
        'GET',
        `${API_PREFIX}/github/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/pulls/${input.number}`,
      );
      return {
        title: result.title ?? `PR ${input.number}`,
        url: result.html_url ?? `https://github.com/${input.repository}/pull/${input.number}`,
        state: result.state === 'closed' ? 'closed' : 'open',
        draft: result.draft === true,
        merged: result.merged === true,
        assignees: (result.assignees ?? []).flatMap(assignee => (assignee.login ? [assignee.login] : [])),
        requestedReviewers: (result.requested_reviewers ?? []).flatMap(reviewer =>
          reviewer.login ? [reviewer.login] : [],
        ),
        labels: (result.labels ?? []).flatMap(label =>
          typeof label === 'string' ? [label] : label.name ? [label.name] : [],
        ),
        headBranch: result.head?.ref ?? '',
        baseBranch: result.base?.ref ?? '',
        ...(result.user?.login ? { author: result.user.login } : {}),
        ...(result.created_at ? { createdAt: result.created_at } : {}),
        ...(result.merged_by?.login ? { mergedBy: result.merged_by.login } : {}),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Reads live issue state through the Platform GitHub proxy for the
   * reconciler. Returns undefined when the issue cannot be resolved (missing,
   * is actually a PR, proxy error) so a sweep never fabricates a close.
   */
  async fetchIssueState(input: {
    installationId: number;
    repository: string;
    number: number;
  }): Promise<ReconcileIssueState | undefined> {
    let repository: { owner: string; repo: string };
    try {
      repository = splitRepository(input.repository);
    } catch {
      return undefined;
    }
    try {
      const result = await this.#client.request<{
        title?: string;
        html_url?: string;
        state?: string;
        state_reason?: string | null;
        created_at?: string;
        updated_at?: string;
        user?: { login?: string } | null;
        assignees?: Array<{ login?: string }> | null;
        labels?: Array<{ name?: string } | string> | null;
        pull_request?: unknown;
      }>(
        'GET',
        `${API_PREFIX}/github/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/issues/${input.number}`,
      );
      if (result.pull_request) return undefined;
      return {
        title: result.title ?? `Issue ${input.number}`,
        url: result.html_url ?? `https://github.com/${input.repository}/issues/${input.number}`,
        state: result.state === 'closed' ? 'closed' : 'open',
        ...(result.state_reason ? { stateReason: result.state_reason } : {}),
        assignees: (result.assignees ?? []).flatMap(assignee => (assignee.login ? [assignee.login] : [])),
        labels: (result.labels ?? []).map(label => (typeof label === 'string' ? label : label.name)).filter((name): name is string => Boolean(name)),
        ...(result.user?.login ? { author: result.user.login } : {}),
        ...(result.created_at ? { createdAt: result.created_at } : {}),
        ...(result.updated_at ? { updatedAt: result.updated_at } : {}),
      };
    } catch {
      return undefined;
    }
  }

  sessionTools({ requestContext }: { requestContext: RequestContext }): IntegrationTools {
    return createGithubSubscriptionTools(requestContext, this as unknown as GithubIntegration);
  }

  async postToolObserver({
    toolContext,
    requestContext,
  }: Parameters<NonNullable<FactoryIntegration['postToolObserver']>>[0]): Promise<void> {
    const pullRequestUrl = parseCreatedPullRequest(toolContext);
    if (!pullRequestUrl || !requestContext) return;
    await subscribeCurrentSessionToPullRequest(
      requestContext,
      pullRequestUrl,
      'auto-gh-pr-create',
      this as unknown as GithubIntegration,
    );
  }

  diagnostics(): Record<string, unknown> {
    return {
      mode: 'platform',
      endpointHost: this.#endpointHost,
      polling: {
        enabled: this.#pollingEnabled,
        ...(this.#pollingIntervalMs === undefined ? {} : { intervalMs: this.#pollingIntervalMs }),
      },
      reconcile: {
        pullRequests: {
          enabled: this.#pullRequestReconcileEnabled,
          ...(this.#pullRequestReconcileIntervalMs === undefined
            ? {}
            : { intervalMs: this.#pullRequestReconcileIntervalMs }),
        },
        issues: {
          enabled: this.#issueReconcileEnabled,
          ...(this.#issueReconcileIntervalMs === undefined ? {} : { intervalMs: this.#issueReconcileIntervalMs }),
        },
      },
    };
  }

  async getRepositoryCollaboratorPermission(
    _installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ): Promise<GithubRepositoryPermission | undefined> {
    let repository: { owner: string; repo: string };
    try {
      repository = splitRepository(repoFullName);
    } catch {
      return undefined;
    }
    try {
      const result = await this.#client.request<{ permission: GithubRepositoryPermission }>(
        'GET',
        `${API_PREFIX}/github/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/collaborators/${encodeURIComponent(username)}/permission`,
        undefined,
        { signal },
      );
      return result.permission;
    } catch {
      return undefined;
    }
  }

  async listInstallationRepos(installationId: number): Promise<RepoSummary[]> {
    // Hot in two places — the repos route and token minting (which re-lists
    // only to validate the 1–10 repo rule). A short TTL collapses repeat
    // Platform round trips within one UI interaction.
    const cached = this.#installationReposCache.get(installationId);
    if (cached && cached.expiresAt > Date.now()) return cached.repos;
    this.#installationReposCache.delete(installationId);

    const result = await this.#client.request<{
      repositories: Array<{
        id: number;
        owner: string;
        name: string;
        fullName: string;
        private: boolean;
        defaultBranch: string;
      }>;
    }>('GET', `${API_PREFIX}/github-app/installations/${installationId}/repositories`);
    const repos = result.repositories.map(repository => ({ ...repository, installationId }));
    setBounded(this.#installationReposCache, installationId, {
      repos,
      expiresAt: Date.now() + INSTALLATION_REPOS_CACHE_TTL_MS,
    });
    return repos;
  }

  async mintInstallationToken(installationId: number): Promise<string> {
    const repositories = await this.listInstallationRepos(installationId);
    if (repositories.length === 0 || repositories.length > 10) {
      throw new Error('Platform GitHub token minting requires between one and ten installation repositories.');
    }
    const result = await this.#client.request<{ token: string }>(
      'POST',
      `${API_PREFIX}/github-app/installations/${installationId}/token`,
      { repositories: repositories.map(repository => repository.name), permissions: REPOSITORY_TOKEN_PERMISSIONS },
    );
    return result.token;
  }

  async addIssueLabels(
    _installationId: number,
    sourceId: string,
    issueNumber: number,
    labels: string[],
  ): Promise<string[]> {
    const result = await this.#client.request<{ labels: string[] }>(
      'POST',
      repositoryPath(sourceId, `issues/${issueNumber}/labels`),
      { labels },
    );
    return result.labels;
  }

  getInstallationOctokit(_installationId: number): ReturnType<GithubIntegration['getInstallationOctokit']> {
    return {
      pulls: {
        get: async ({ owner, repo, pull_number }: { owner: string; repo: string; pull_number: number }) => {
          const data = await this.#client.request<GithubPullRequest>(
            'GET',
            repositoryPath(`${owner}/${repo}`, `pulls/${pull_number}`),
          );
          return { data: { base: { repo: { id: data.base.repo.id } } } };
        },
      },
    } as unknown as ReturnType<GithubIntegration['getInstallationOctokit']>;
  }

  async #listIssues(connection: IntegrationConnection, sourceId: string, page: number, labels?: string[]) {
    requireGithubConnection(connection);
    const path = repositoryPath(sourceId, 'issues');
    const query = new URLSearchParams({ state: 'open', page: String(page), per_page: String(PAGE_SIZE) });
    const normalizedLabels = normalizeLabels(labels);
    if (normalizedLabels.length > 0) query.set('label', normalizedLabels.join(','));
    const result = await this.#client.request<{ issues: GithubIssue[] }>('GET', `${path}?${query}`);
    return {
      issues: result.issues.map(issue => parseIntakeIssue(sourceId, issue)),
      nextCursor: result.issues.length > 0 ? String(page + 1) : null,
    };
  }

  async #getIssue(connection: IntegrationConnection, sourceId: string | undefined, issueId: string) {
    requireGithubConnection(connection);
    const repository = requireSource(sourceId, 'GitHub Intake requires a repository source.');
    const issueNumber = requirePositiveId(issueId, 'issue');
    try {
      const [issue, comments] = await Promise.all([
        this.#client.request<GithubIssue>('GET', repositoryPath(repository, `issues/${issueNumber}`)),
        this.#client.request<{ comments: GithubComment[] }>(
          'GET',
          `${repositoryPath(repository, `issues/${issueNumber}/comments`)}?per_page=100`,
        ),
      ]);
      return parseIntakeIssueDetail(repository, issue, comments.comments);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #updateIntakeIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    requireGithubConnection(input.connection);
    const repository = requireSource(input.sourceId, 'GitHub Intake requires a repository source.');
    const issueNumber = requirePositiveId(input.issueId, 'issue');
    if (input.state.kind === 'byName') {
      logPlatformWarn(`Platform GitHub: updateIssue byName is not supported (name=${input.state.name}); ignoring.`);
      return null;
    }
    const targetState: 'open' | 'closed' =
      input.state.stateType === 'unstarted' || input.state.stateType === 'started' ? 'open' : 'closed';
    const stateReason: 'completed' | 'not_planned' | null =
      targetState === 'closed' ? (input.state.stateType === 'canceled' ? 'not_planned' : 'completed') : null;
    // Reject PR targets: probe the pulls endpoint. A 200 means the number is a
    // pull request, not an issue. Factory does not close PRs via updateIssue —
    // PR merges/closes go through the version-control pipeline.
    try {
      await this.#client.request<GithubPullRequest>('GET', repositoryPath(repository, `pulls/${issueNumber}`));
      logPlatformWarn(`Platform GitHub: updateIssue rejected — target ${repository}#${issueNumber} is a pull request.`);
      return null;
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // 404 on pulls means it's an issue (or nothing) — fall through to PATCH.
    }
    try {
      const issue = await this.#client.request<GithubIssue>(
        'PATCH',
        repositoryPath(repository, `issues/${issueNumber}`),
        {
          state: targetState,
          ...(stateReason ? { state_reason: stateReason } : {}),
        },
        { actingUserId: input.actingUserId },
      );
      return parseIntakeIssue(repository, issue);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Learn Factory's own login from a write it just made. Skipped when the write
   * was made on behalf of a user — that comment is authored by the human, and
   * recording it would teach Factory to mistake a person for itself.
   */
  #observeSelfAuthor(comment: GithubComment, actingUserId: string | undefined): void {
    if (actingUserId) return;
    this.identity.observeSelfAuthor(comment.user?.login);
  }

  async #createIssueComment(input: CreateIntakeCommentInput) {
    requireGithubConnection(input.connection);
    const repository = requireSource(input.sourceId, 'GitHub Intake requires a repository source.');
    const issueNumber = requirePositiveId(input.issueId, 'issue');
    try {
      const comment = await this.#client.request<GithubComment>(
        'POST',
        repositoryPath(repository, `issues/${issueNumber}/comments`),
        { body: input.body },
        { actingUserId: input.actingUserId },
      );
      this.#observeSelfAuthor(comment, input.actingUserId);
      return { id: String(comment.id), url: comment.htmlUrl };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #listPullRequests(input: ListPullRequestsInput) {
    requireGithubConnection(input.connection);
    const page = parsePositiveCursor(input.cursor);
    const query = new URLSearchParams({
      state: input.state ?? 'open',
      page: String(page),
      per_page: String(PAGE_SIZE),
    });
    const result = await this.#client.request<{ pullRequests: GithubPullRequest[] }>(
      'GET',
      `${repositoryPath(input.sourceId, 'pulls')}?${query}`,
    );
    return {
      pullRequests: result.pullRequests
        .filter(pullRequest => input.includeDrafts !== false || !pullRequest.draft)
        .map(parsePullRequest),
      nextCursor: result.pullRequests.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getPullRequest(input: PullRequestRef) {
    try {
      return parsePullRequest(
        await this.#client.request<GithubPullRequest>('GET', pullRequestPath(input, input.pullRequestId)),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #createPullRequest(input: CreatePullRequestInput) {
    requireGithubConnection(input.connection);
    const result = await this.#client.request<GithubPullRequest>(
      'POST',
      repositoryPath(input.sourceId, 'pulls'),
      {
        head: input.headBranch,
        base: input.baseBranch,
        title: input.title,
        body: input.body,
        draft: input.draft,
      },
      { actingUserId: input.actingUserId },
    );
    return parsePullRequest(result);
  }

  async #updatePullRequest(input: UpdatePullRequestInput) {
    const result = await this.#client.request<GithubPullRequest>(
      'PATCH',
      pullRequestPath(input, input.pullRequestId),
      {
        title: input.title,
        body: input.body === null ? '' : input.body,
        base: input.baseBranch,
        state: input.state,
      },
      { actingUserId: input.actingUserId },
    );
    return parsePullRequest(result);
  }

  #mergePullRequest(input: MergePullRequestInput) {
    return this.#client.request<{ merged: boolean; message: string; sha: string | null }>(
      'PUT',
      `${pullRequestPath(input, input.pullRequestId)}/merge`,
      { commitTitle: input.commitTitle, commitMessage: input.commitMessage, method: input.method },
      { actingUserId: input.actingUserId },
    );
  }

  async #listComments(input: ListPullRequestCommentsInput) {
    const page = parsePositiveCursor(input.cursor);
    const result = await this.#client.request<{ comments: GithubComment[] }>(
      'GET',
      `${repositoryPath(input.sourceId, `issues/${requirePositiveId(input.pullRequestId, 'pull request')}/comments`)}?page=${page}&per_page=${PAGE_SIZE}`,
    );
    return {
      comments: result.comments.map(parseComment),
      nextCursor: result.comments.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createComment(input: CreatePullRequestCommentInput) {
    const comment = await this.#client.request<GithubComment>(
      'POST',
      repositoryPath(input.sourceId, `issues/${requirePositiveId(input.pullRequestId, 'pull request')}/comments`),
      { body: input.body },
      { actingUserId: input.actingUserId },
    );
    this.#observeSelfAuthor(comment, input.actingUserId);
    return parseComment(comment);
  }

  async #updateComment(input: UpdatePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    const comment = await this.#client.request<GithubComment>(
      'PATCH',
      repositoryPath(input.sourceId, `issues/comments/${requirePositiveId(input.commentId, 'comment')}`),
      { body: input.body },
      { actingUserId: input.actingUserId },
    );
    return parseComment(comment);
  }

  async #deleteComment(input: DeletePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    await this.#client.request<void>(
      'DELETE',
      repositoryPath(input.sourceId, `issues/comments/${requirePositiveId(input.commentId, 'comment')}`),
      undefined,
      { actingUserId: input.actingUserId },
    );
  }

  async #listReviews(input: ListReviewsInput) {
    const page = parsePositiveCursor(input.cursor);
    const result = await this.#client.request<{ reviews: GithubReview[] }>(
      'GET',
      `${pullRequestPath(input, input.pullRequestId)}/reviews?page=${page}&per_page=${PAGE_SIZE}`,
    );
    return {
      reviews: result.reviews.map(parseReview),
      nextCursor: result.reviews.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getReview(input: ReviewRef) {
    try {
      return parseReview(
        await this.#client.request<GithubReview>(
          'GET',
          `${pullRequestPath(input, input.pullRequestId)}/reviews/${requirePositiveId(input.reviewId, 'review')}`,
        ),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #createReview(input: CreateReviewInput) {
    const review = await this.#client.request<GithubReview>(
      'POST',
      `${pullRequestPath(input, input.pullRequestId)}/reviews`,
      { body: input.body, commitId: input.commitId, event: input.event ? reviewEvent(input.event) : undefined },
      { actingUserId: input.actingUserId },
    );
    return parseReview(review);
  }

  async #updateReview(input: UpdateReviewInput) {
    const review = await this.#client.request<GithubReview>(
      'PUT',
      `${pullRequestPath(input, input.pullRequestId)}/reviews/${requirePositiveId(input.reviewId, 'review')}`,
      { body: input.body },
      { actingUserId: input.actingUserId },
    );
    return parseReview(review);
  }

  async #submitReview(input: SubmitReviewInput) {
    const review = await this.#client.request<GithubReview>(
      'POST',
      `${pullRequestPath(input, input.pullRequestId)}/reviews/${requirePositiveId(input.reviewId, 'review')}/events`,
      { body: input.body, event: reviewEvent(input.event) },
      { actingUserId: input.actingUserId },
    );
    return parseReview(review);
  }

  async #dismissReview(input: DismissReviewInput) {
    const review = await this.#client.request<GithubReview>(
      'PUT',
      `${pullRequestPath(input, input.pullRequestId)}/reviews/${requirePositiveId(input.reviewId, 'review')}/dismissals`,
      { message: input.message },
      { actingUserId: input.actingUserId },
    );
    return parseReview(review);
  }

  async #deletePendingReview(input: ReviewRef) {
    await this.#client.request<void>(
      'DELETE',
      `${pullRequestPath(input, input.pullRequestId)}/reviews/${requirePositiveId(input.reviewId, 'review')}`,
      undefined,
      { actingUserId: input.actingUserId },
    );
  }

  async #listReviewComments(input: ListReviewCommentsInput) {
    const page = parsePositiveCursor(input.cursor);
    const result = await this.#client.request<{ comments: GithubReviewComment[] }>(
      'GET',
      `${pullRequestPath(input, input.pullRequestId)}/comments?page=${page}&per_page=${PAGE_SIZE}`,
    );
    return {
      comments: result.comments.map(parseReviewComment),
      nextCursor: result.comments.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createReviewComment(input: CreateReviewCommentInput) {
    let body: Record<string, unknown>;
    if (input.replyToId !== undefined) {
      body = { body: input.body, replyToId: requirePositiveId(input.replyToId, 'review comment') };
    } else {
      if (!input.commitId || !input.path || input.line === undefined || !input.side) {
        throw new Error('A review comment requires commitId, path, line, and side unless it is a reply.');
      }
      body = {
        body: input.body,
        commitId: input.commitId,
        path: input.path,
        line: input.line,
        side: input.side.toUpperCase(),
        startLine: input.startLine,
        startSide: input.startSide?.toUpperCase(),
      };
    }
    return parseReviewComment(
      await this.#client.request<GithubReviewComment>(
        'POST',
        `${pullRequestPath(input, input.pullRequestId)}/comments`,
        body,
        { actingUserId: input.actingUserId },
      ),
    );
  }

  async #updateReviewComment(input: UpdatePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    return parseReviewComment(
      await this.#client.request<GithubReviewComment>(
        'PATCH',
        repositoryPath(input.sourceId, `pulls/comments/${requirePositiveId(input.commentId, 'review comment')}`),
        { body: input.body },
        { actingUserId: input.actingUserId },
      ),
    );
  }

  async #deleteReviewComment(input: DeletePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    await this.#client.request<void>(
      'DELETE',
      repositoryPath(input.sourceId, `pulls/comments/${requirePositiveId(input.commentId, 'review comment')}`),
      undefined,
      { actingUserId: input.actingUserId },
    );
  }

  #requestedReviewers(method: 'GET' | 'POST' | 'DELETE', input: UpdateReviewersInput) {
    requireGithubConnection(input.connection);
    return this.#client.request<{ users: string[]; teams: string[] }>(
      method,
      `${pullRequestPath(input, input.pullRequestId)}/requested-reviewers`,
      method === 'GET' ? undefined : { users: input.users, teams: input.teams },
      method === 'GET' ? undefined : { actingUserId: input.actingUserId },
    );
  }
}

function repositoryPath(sourceId: string, suffix: string): string {
  const { owner, repo } = splitRepository(sourceId);
  return `${API_PREFIX}/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${suffix}`;
}

function pullRequestPath(
  input: { connection: IntegrationConnection; sourceId: string },
  pullRequestId: string,
): string {
  requireGithubConnection(input.connection);
  return repositoryPath(input.sourceId, `pulls/${requirePositiveId(pullRequestId, 'pull request')}`);
}

function splitRepository(sourceId: string): { owner: string; repo: string } {
  const slash = sourceId.indexOf('/');
  if (slash <= 0 || slash === sourceId.length - 1) {
    throw new Error('GitHub capabilities require an owner/repository source.');
  }
  return { owner: sourceId.slice(0, slash), repo: sourceId.slice(slash + 1) };
}

function parseIntakeIssue(sourceId: string, issue: GithubIssue): IntakeIssue {
  return {
    id: String(issue.number),
    identifier: `#${issue.number}`,
    title: issue.title,
    url: issue.htmlUrl,
    author: issue.user?.login ?? null,
    state: issue.state,
    stateType: issue.state,
    priority: null,
    assignee: issue.assignees[0] ?? null,
    assignees: issue.assignees,
    source: sourceId,
    labels: issue.labels,
    commentCount: issue.commentCount,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function parseIntakeIssueDetail(sourceId: string, issue: GithubIssue, comments: GithubComment[]): IntakeIssueDetail {
  return {
    ...parseIntakeIssue(sourceId, issue),
    description: issue.body?.trim() ? issue.body : null,
    comments: comments.map(comment => ({
      author: comment.user?.login ?? null,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

function parsePullRequest(pullRequest: GithubPullRequest): PullRequest {
  return {
    id: String(pullRequest.number),
    title: pullRequest.title,
    url: pullRequest.htmlUrl,
    author: pullRequest.user?.login ?? null,
    assignees: pullRequest.assignees ?? [],
    requestedReviewers: pullRequest.requestedReviewers ?? [],
    labels: pullRequest.labels ?? [],
    body: pullRequest.body?.trim() ? pullRequest.body : null,
    state: pullRequest.state,
    draft: pullRequest.draft,
    merged: pullRequest.merged,
    mergeable: pullRequest.mergeable,
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    createdAt: pullRequest.createdAt,
    updatedAt: pullRequest.updatedAt,
  };
}

function parseComment(comment: GithubComment): PullRequestComment {
  return {
    id: String(comment.id),
    url: comment.htmlUrl,
    author: comment.user?.login ?? null,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function parseReview(review: GithubReview): Review {
  const states: Record<GithubReview['state'], Review['state']> = {
    PENDING: 'pending',
    COMMENTED: 'commented',
    APPROVED: 'approved',
    CHANGES_REQUESTED: 'changes-requested',
    DISMISSED: 'dismissed',
  };
  return {
    id: String(review.id),
    url: review.htmlUrl,
    author: review.user?.login ?? null,
    body: review.body?.trim() ? review.body : null,
    state: states[review.state],
    commitId: review.commitId,
    submittedAt: review.submittedAt,
  };
}

function parseReviewComment(comment: GithubReviewComment): ReviewComment {
  return {
    ...parseComment(comment),
    path: comment.path,
    line: comment.line,
    side: comment.side?.toLowerCase() as 'left' | 'right' | null,
    commitId: comment.commitId,
    replyToId: comment.replyToId === null ? null : String(comment.replyToId),
  };
}

function requireGithubConnection(connection: IntegrationConnection): void {
  if (connection.type !== 'app-installation' && connection.type !== 'oauth') {
    throw new Error('GitHub capabilities require a GitHub connection.');
  }
}

function requireSingleSource(sourceIds: string[], message: string): string {
  if (sourceIds.length !== 1) throw new Error(message);
  return sourceIds[0]!;
}

function requireSource(sourceId: string | undefined, message: string): string {
  if (!sourceId) throw new Error(message);
  return sourceId;
}

function normalizeLabels(labels: string[] | undefined): string[] {
  return [...new Set((labels ?? []).map(label => label.trim()).filter(Boolean))];
}

function parsePositiveCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 1;
  const parsed = parsePositiveInteger(cursor);
  if (parsed === null) throw new Error('GitHub cursor must be a positive page number.');
  return parsed;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseGithubExternalTarget(externalId: string): { repository: string; issueId: string } | null {
  const match =
    externalId.match(/^(.+\/.+):(\d+)$/) ??
    externalId.match(/^github:(\d+):(?:issue|pull-request):(\d+)$/) ??
    externalId.match(/^(\d+):(\d+)$/);
  if (!match?.[1] || !match[2] || parsePositiveInteger(match[2]) === null) return null;
  return { repository: match[1], issueId: match[2] };
}

function optionalPositiveIntegerEnv(name: 'MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS'): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = parsePositiveInteger(value);
  if (parsed === null) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function requirePositiveId(value: string, resource: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed === null) throw new Error(`GitHub ${resource} id must be a positive integer.`);
  return parsed;
}

function reviewEvent(event: 'approve' | 'request-changes' | 'comment') {
  if (event === 'approve') return 'APPROVE' as const;
  if (event === 'request-changes') return 'REQUEST_CHANGES' as const;
  return 'COMMENT' as const;
}

function isNotFound(error: unknown): boolean {
  return error instanceof PlatformApiError && error.status === 404;
}

// Platform answers 404 when the installation row is gone, 409 when it is suspended or soft-deleted.
// A 502 also covers a dead installation but is indistinguishable from a transient GitHub outage.
function isDeadInstallation(error: unknown): boolean {
  return error instanceof PlatformApiError && (error.status === 404 || error.status === 409);
}
