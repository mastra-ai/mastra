import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import { Octokit } from '@octokit/rest';
import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  ListIntakeSourcesInput,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import type {
  CommitCheck,
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
  PublishCommitCheckInput,
  PullRequestRef,
  RepositoriesAccess,
  RepositoryAccess,
  Review,
  ReviewComment,
  ReviewRef,
  SubmitReviewInput,
  UpdatePullRequestCommentInput,
  UpdatePullRequestInput,
  UpdateReviewInput,
  UpdateReviewersInput,
} from '../../../capabilities/version-control.js';
import { loose } from '../../../routes/route.js';
import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type {
  SourceControlInstallation,
  SourceControlStorageHandle,
} from '../../../storage/domains/source-control/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../../base.js';
import { attachDependabotRules } from '../../dependabot/rules.js';
import { createDependabotSync } from '../../dependabot/sync.js';
import type { DependabotSync, GithubDependabotAlert } from '../../dependabot/sync.js';
import { GithubAppIdentity } from '../../github/app-identity.js';
import type { GithubEventRules, GithubRuleOverrides } from '../../github/default-rules.js';
import { resolveGithubRules } from '../../github/default-rules.js';
import type {
  GithubIntegration,
  GithubRepositoryPermission,
  GithubTriageCommentUpsertInput,
  GithubTriageCommentUpsertResult,
  RepoListOptions,
  RepoSummary,
} from '../../github/integration.js';
import { attachGithubIssueReconciler } from '../../github/issue-reconciler.js';
import { DEFAULT_GITHUB_RECONCILE_INTERVAL_MS, GithubReconcileWorker } from '../../github/reconcile-worker.js';
import { reconcileInterval, reconciliationEnabled } from '../../github/reconciliation-config.js';
import { buildGithubRoutes, ingestLinkedRepositoryBacklog } from '../../github/routes.js';
import {
  attachGithubPullRequestDiscovery,
  attachGithubReconciler,
  attachGithubRules,
  openPullRequestLister,
} from '../../github/rules.js';
import type { ReconcileIssueState, ReconcilePullRequestState, ReconcileRepository } from '../../github/rules.js';
import type { GitIdentity } from '../../github/sandbox.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from '../../github/session-subscriptions.js';
import { settleOrAbort } from '../../github/settle-or-abort.js';
import type { GithubSubscriptionStorage } from '../../github/subscriptions.js';
import { parseAuthorizedBotsEnv } from '../../github/webhook.js';
import { PlatformConnectIntegration } from '../foundation/index.js';
import type { PlatformConnectEventDelivery, PlatformTopicSubscription } from '../foundation/index.js';
import { logPlatformBootInfo, logPlatformError, logPlatformInfo, logPlatformWarn } from '../logging.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import {
  connectGithubEventHandler,
  FACTORY_GITHUB_PROVIDER_KEY,
  FACTORY_REVIEWS_GITHUB_PROVIDER_KEY,
} from './connect-events.js';
import { GithubConnectTokens } from './connect-tokens.js';
import { ConnectGithubTransport, githubErrorStatus } from './connect-transport.js';
import { legacyGithubTopicSubscription } from './legacy-events.js';
import { LegacyGithubTransport, splitRepository } from './legacy-transport.js';
import type {
  LegacyGithubUserConnection,
  LegacyHiddenPersonalInstallReason,
  LegacyInstallationRepository,
} from './legacy-transport.js';
import { LinkedGithubRepositories } from './linked-repositories.js';
import { PlatformGithubModes } from './mode.js';
import type { PlatformGithubConnectInstallation, PlatformGithubModeRecord, PlatformGithubModeStorage } from './mode.js';
import type {
  GithubCall,
  GithubComment,
  GithubIssue,
  GithubPullRequest,
  GithubReview,
  GithubReviewComment,
  GithubReviewCommentCreate,
  GithubTransport,
} from './transport.js';
import { PlatformGithubVersionControl } from './version-control.js';

/** Why Platform withheld a personal-account installation from this org's credentials. */
type PlatformHiddenPersonalInstallReason = LegacyHiddenPersonalInstallReason;

/**
 * Status reason for a settled installation list. A personal install Platform withholds would otherwise
 * read as "nothing installed", so say so; any usable installation still means ready.
 */
function githubStatusReason(
  hasUsableInstallation: boolean,
  hiddenPersonalInstallReason?: PlatformHiddenPersonalInstallReason,
): 'ready' | 'personal_install_hidden' | 'not_connected' {
  if (hasUsableInstallation) return 'ready';
  return hiddenPersonalInstallReason ? 'personal_install_hidden' : 'not_connected';
}

type PlatformGithubUserConnection = LegacyGithubUserConnection;

/** The Mastra Factory GitHub apps' Connect provider keys. */
export const PLATFORM_GITHUB_PROVIDER_KEYS = [
  FACTORY_GITHUB_PROVIDER_KEY,
  FACTORY_REVIEWS_GITHUB_PROVIDER_KEY,
] as const;
/** Slugs of the Mastra Factory GitHub apps, which Factory also posts as. */
const FACTORY_GITHUB_APP_SLUG = 'mastra-factory';
const FACTORY_REVIEWS_GITHUB_APP_SLUG = 'mastra-factory-reviews';

const PAGE_SIZE = 30;
// Open issues list newest-first; missed opens are recent, so a bounded scan
// keeps each sweep's API cost flat on repositories with a large backlog.
const OPEN_ISSUE_DISCOVERY_MAX_PAGES = 5;
/** Intake config id that opts repositories into Dependabot alert sync. */
const DEPENDABOT_INTAKE_ID = 'dependabot';
const CHECK_TITLE_LIMIT = 255;
const CHECK_TEXT_LIMIT = 65_535;
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
 * installation tokens live ~60 minutes. A session re-mints the token it
 * installed after `GITHUB_TOKEN_REFRESH_AFTER_MS` (30 minutes), so a token
 * served from this cache is at most 50 minutes old when it is replaced.
 */
const REPOSITORY_ACCESS_CACHE_TTL_MS = 20 * 60_000;
/**
 * How long a collaborator permission lookup may be reused. The reconcile
 * sweep re-stamps every open card's author and the event tail gates every
 * human-authored event on it, so one login can cost dozens of identical
 * requests per cycle against the installation's REST budget. Revoked access
 * reads as trusted for at most this long.
 */
const COLLABORATOR_PERMISSION_CACHE_TTL_MS = 30 * 60_000;
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
  // Read-only CI visibility so sessions can verify checks and workflow runs.
  checks: 'read',
  actions: 'read',
  statuses: 'read',
} as const;

/** The Platform mints one installation token for at most this many named repositories. */
const MAX_REPOSITORIES_PER_TOKEN = 10;

function routeBaseUrl(ctx: IntegrationContext, requestUrl: string): string {
  return (ctx.baseUrl || new URL(requestUrl).origin).replace(/\/+$/, '');
}

export class PlatformGithubIntegration extends PlatformConnectIntegration implements FactoryIntegration {
  readonly #rules: GithubEventRules;

  get rules(): GithubEventRules {
    return this.#rules;
  }
  readonly #legacy: LegacyGithubTransport;
  readonly #modes = new PlatformGithubModes(() => this.integrationStorage as unknown as PlatformGithubModeStorage);
  readonly #tokens = new GithubConnectTokens(this.connect);
  /** One Connect transport per switched installation, keeping its token cache warm. */
  readonly #connectTransports = new Map<string, ConnectGithubTransport>();
  readonly #githubApiUrl: string | undefined;
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
  readonly #pullRequestReconcileEnabled: boolean;
  readonly #issueReconcileEnabled: boolean;
  readonly #pullRequestReconcileIntervalMs: number | undefined;
  readonly #issueReconcileIntervalMs: number | undefined;
  readonly #pullRequestDiscoveryIntervalMs: number | undefined;
  #integrationStorage: GithubSubscriptionStorage | undefined;
  #ingestFactoryEvent: ReturnType<typeof attachGithubRules>;
  #reconcileWorker: GithubReconcileWorker | undefined;
  #connectEvents: ((event: PlatformConnectEventDelivery) => Promise<void>) | undefined;
  readonly #linkedRepositories = new LinkedGithubRepositories(() => ({
    listConfiguredExternalKeys: () => this.storage.projectRepositories.listConfiguredExternalKeys(),
    listByExternalRepository: args => this.storage.projectRepositories.listByExternalRepository(args),
    onLinkedRepositoriesChanged: listener => this.storage.onLinkedRepositoriesChanged(listener),
    linkedRepositoryChangesShared: () => this.storage.linkedRepositoryChangesShared(),
  }));
  /** installationId → cached repository listing (TTL-bounded). */
  readonly #installationReposCache = new Map<number, { repos: RepoSummary[]; expiresAt: number }>();
  /** `orgId:repositoryId` → cached repository access (TTL-bounded). */
  readonly #repositoryAccessCache = new Map<string, { access: RepositoryAccess; expiresAt: number }>();
  /**
   * In-flight mints by the same key as `#repositoryAccessCache`. Sessions that
   * boot together all miss the cache at once; without this each one minted its
   * own token and drained the Platform's per-installation mint budget.
   */
  readonly #repositoryAccessInFlight = new Map<string, Promise<RepositoryAccess | undefined>>();

  #mintOnce<T extends RepositoryAccess | undefined>(cacheKey: string, mint: () => Promise<T>): Promise<T> {
    const cached = this.#repositoryAccessCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.access as T);
    this.#repositoryAccessCache.delete(cacheKey);
    const inFlight = this.#repositoryAccessInFlight.get(cacheKey);
    if (inFlight) return inFlight as Promise<T>;
    const pending = mint().finally(() => this.#repositoryAccessInFlight.delete(cacheKey));
    this.#repositoryAccessInFlight.set(cacheKey, pending);
    return pending;
  }
  /** `owner/repo:login` → cached collaborator permission (TTL-bounded). */
  readonly #collaboratorPermissionCache = new Map<
    string,
    { permission: GithubRepositoryPermission; expiresAt: number }
  >();
  /** Same key → lookup already in flight, so overlapping callers share one request. */
  readonly #collaboratorPermissionInFlight = new Map<string, Promise<GithubRepositoryPermission | undefined>>();

  /** Dependabot opt-in: its sources are the same repositories; cards arrive through the alert sync, not intake items. */
  readonly additionalIntakes = [
    {
      id: DEPENDABOT_INTAKE_ID,
      intake: {
        listSources: (input: ListIntakeSourcesInput) => this.intake.listSources(input),
        listItems: async () => ({ items: [], nextCursor: null }),
      },
    },
  ] as const;

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: async ({ orgId, userId }) => {
      const usable = await this.#sourceInstallations(orgId);
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
          const result = {
            repositories: await this.#installationRepositories(installation.installationId, orgId),
          };
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
    listItems: async ({ orgId, sourceIds, cursor }) => {
      const page = parsePositiveCursor(cursor);
      const pages = await Promise.all(
        sourceIds.map(async sourceId => {
          const connection = { type: 'app-installation' as const, installationId: 1, orgId };
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
                labels: pullRequest.labels,
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

  readonly versionControl: PlatformGithubVersionControl = new PlatformGithubVersionControl(this, {
    getRepositoryTarget: async ({ orgId, repositoryId }) => {
      const repository = await this.storage.repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const installation = await this.storage.installations.get({ orgId, id: repository.installationId });
      if (!installation) throw new Error('Version-control installation not found.');
      const installationId = parsePositiveInteger(installation.externalId);
      if (installationId === null) throw new Error('GitHub installation id is invalid.');
      return {
        connection: { type: 'app-installation', installationId, orgId },
        sourceId: repository.slug,
      };
    },
    getRepositoryAccess: async ({ orgId, repositoryId }) => {
      // Every session materialization requests access; reuse a recent grant
      // instead of re-minting through the Platform each time. The TTL keeps
      // a wide margin under GitHub's ~60min installation-token lifetime.
      const cacheKey = `${orgId}:${repositoryId}`;
      return this.#mintOnce(cacheKey, async () => {
        const repository = await this.storage.repositories.get({ orgId, id: repositoryId });
        if (!repository) throw new Error('Version-control repository not found.');
        const cloneUrl = `https://github.com/${repository.slug}.git`;
        const installation = await this.storage.installations.get({ orgId, id: repository.installationId });
        if (!installation) throw new Error('Version-control installation not found.');
        const installationId = parsePositiveInteger(installation.externalId);
        if (installationId === null) throw new Error('GitHub installation id is invalid.');
        const repositoryName = splitRepository(repository.slug).repo;

        try {
          const token = {
            token: await this.#repositoryToken({ orgId, installationId }, [repositoryName]),
          };
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
          // After several reinstalls the account can have more than one stale row. Try the
          // newest installations first and only repoint the repository at one that works,
          // so a dead candidate is never persisted.
          const candidates = (await this.storage.installations.list({ orgId }))
            .map((inst, index) => ({ inst, index }))
            .filter(({ inst }) => inst.accountName === installation.accountName && inst.id !== installation.id)
            .sort((a, b) => b.inst.createdAt.getTime() - a.inst.createdAt.getTime() || b.index - a.index)
            .map(({ inst }) => inst);

          for (const candidate of candidates) {
            const candidateInstallationId = parsePositiveInteger(candidate.externalId);
            if (candidateInstallationId === null) continue;

            let token: { token: string };
            try {
              token = {
                token: await this.#repositoryToken({ orgId, installationId: candidateInstallationId }, [
                  repositoryName,
                ]),
              };
            } catch (candidateErr) {
              if (isDeadInstallation(candidateErr)) continue;
              throw candidateErr;
            }

            // Persist the migration so we don't hit the recovery path on every call.
            await this.storage.repositories.migrateInstallation({
              orgId,
              id: repositoryId,
              newInstallationId: candidate.id,
            });

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
          throw err;
        }
      });
    },
    getRepositoriesAccess: async ({ orgId, repositoryIds }) => {
      const ids = [...new Set(repositoryIds)];
      if (ids.length === 0 || ids.length > MAX_REPOSITORIES_PER_TOKEN) return undefined;
      const cacheKey = `${orgId}:${[...ids].sort().join(',')}`;
      return this.#mintOnce(cacheKey, async () => {
        const repositories = await Promise.all(ids.map(id => this.storage.repositories.get({ orgId, id })));
        if (repositories.some(repository => !repository)) throw new Error('Version-control repository not found.');
        const found = repositories as NonNullable<(typeof repositories)[number]>[];
        // One token covers one installation; an environment spanning several
        // cannot be served by a single credential.
        const installationIds = new Set(found.map(repository => repository.installationId));
        if (installationIds.size !== 1) return undefined;
        const installation = await this.storage.installations.get({ orgId, id: found[0]!.installationId });
        if (!installation) throw new Error('Version-control installation not found.');
        const installationId = parsePositiveInteger(installation.externalId);
        if (installationId === null) throw new Error('GitHub installation id is invalid.');

        const token = {
          token: await this.#repositoryToken(
            { orgId, installationId },
            found.map(repository => splitRepository(repository.slug).repo),
          ),
        };
        const authorization = { scheme: 'bearer' as const, token: token.token };
        const expiresAt = Date.now() + REPOSITORY_ACCESS_CACHE_TTL_MS;
        // Each repository's access under the shared token, handed only to the
        // caller that asked for the set. It is never cached under a single
        // repository's key, where it would widen that repository's own token.
        const access: RepositoriesAccess = {
          cloneUrl: `https://github.com/${found[0]!.slug}.git`,
          authorization,
          repositories: Object.fromEntries(
            found.map(repository => [
              repository.id,
              { cloneUrl: `https://github.com/${repository.slug}.git`, authorization },
            ]),
          ),
        };
        setBounded(this.#repositoryAccessCache, cacheKey, { access, expiresAt });
        return access;
      });
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
    publishCommitCheck: input => this.#publishCommitCheck(input),
  });

  constructor(
    options: {
      /** Replace an event handler, or disable it with null; omitted events keep defaults. */
      rules?: GithubRuleOverrides;
      /** GitHub App slug used to recognize Factory's own webhook writes. */
      slug?: string;
      /** Connect client, or options for one; defaults to the platform environment. */
      connect?: PlatformConnectOption;
      /** GitHub REST API the Mastra Factory apps' tokens call. Defaults to `https://api.github.com`. */
      githubApiUrl?: string;
    } = {},
  ) {
    super({
      id: 'github',
      providerKeys: PLATFORM_GITHUB_PROVIDER_KEYS,
      ...(options.connect ? { connect: options.connect } : {}),
    });
    this.#rules = resolveGithubRules(options.rules);
    this.#legacy = new LegacyGithubTransport(this.connect);
    this.#endpointHost = new URL(this.connect.baseUrl).host;
    this.#slug = options.slug;
    this.#githubApiUrl = options.githubApiUrl;
    // Identity is deliberately NOT taken from `options.slug`. That slug names
    // the deployment's own self-hosted GitHub App, which is a different App
    // than the one this integration posts as — and on a Platform deployment it
    // is legitimately unset. Borrowing it is what left every self-loop guard
    // comparing against `undefined[bot]`. This integration *is* the Platform
    // App, so it names itself, with an override for non-production Apps.
    this.identity = new GithubAppIdentity(
      process.env.MASTRA_PLATFORM_GITHUB_APP_SLUG?.trim() || PLATFORM_GITHUB_APP_SLUG,
      [
        process.env.MASTRA_FACTORY_GITHUB_APP_SLUG?.trim() || FACTORY_GITHUB_APP_SLUG,
        process.env.MASTRA_FACTORY_REVIEWS_GITHUB_APP_SLUG?.trim() || FACTORY_REVIEWS_GITHUB_APP_SLUG,
      ],
    );
    this.authorizedBots = parseAuthorizedBotsEnv(process.env.MASTRACODE_GITHUB_AUTHORIZED_BOTS) ?? [];
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
      reconcileInterval(process.env.MASTRACODE_PLATFORM_GITHUB_ISSUE_RECONCILE_INTERVAL_MS) ??
      legacyReconcileIntervalMs;
    this.#pullRequestDiscoveryIntervalMs = reconcileInterval(
      process.env.MASTRACODE_PLATFORM_GITHUB_PR_DISCOVERY_INTERVAL_MS,
    );
  }

  /** Commit authorship follows the Platform App's authoritative writer identity. */
  get gitIdentity(): GitIdentity | undefined {
    const login = this.identity.login;
    return login ? { login } : undefined;
  }

  /** GitHub App slug when the deployment explicitly provides it. */
  get slug(): string | undefined {
    return this.#slug;
  }

  isFactoryCommentAuthor(login: string | null | undefined): boolean {
    return typeof login === 'string' && this.identity.matches(login);
  }

  get storage(): SourceControlStorageHandle {
    return this.versionControl.storage;
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
      connection: { type: 'app-installation', installationId: 1, orgId },
      sourceId: repository,
      issueId: target.issueId,
    };
  }

  initialize({ storage }: { storage: IntegrationStorageHandle }): void {
    this.#integrationStorage = storage as unknown as GithubSubscriptionStorage;
    logPlatformBootInfo('Platform GitHub integration initialized', {
      endpointHost: this.#endpointHost,
      pullRequestReconcileEnabled: this.#pullRequestReconcileEnabled,
      issueReconcileEnabled: this.#issueReconcileEnabled,
    });
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    const ingestFactoryEvent = attachGithubRules(this, ctx);
    this.#ingestFactoryEvent = ingestFactoryEvent;
    return [
      this.#statusRoute(ctx),
      this.#connectRoute(ctx),
      this.#connectUserRoute(ctx),
      ...buildGithubRoutes({
        auth: ctx.auth,
        sandbox: ctx.sandbox,
        storage: ctx.factoryStorage,
        github: this as unknown as GithubIntegration,
        stateSigner: ctx.stateSigner,
        baseUrl: ctx.baseUrl,
        controller: ctx.controller,
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

  /**
   * Import a newly linked repository's open issues and pull requests onto
   * the board. No-op until routes are mounted with rules configured.
   */
  async ingestLinkedRepositoryBacklog(args: { orgId: string; projectRepositoryId: string }): Promise<void> {
    await ingestLinkedRepositoryBacklog({
      github: this as unknown as GithubIntegration,
      ...args,
      ingestFactoryEvent: this.#ingestFactoryEvent,
    });
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
            sandboxEnabled: !!ctx.sandbox,
            organizationRequired: true,
            connected: false,
            installations: [],
            userConnected: false,
            userGithubUsername: null,
            reason: 'organization_required',
            diagnostics: this.diagnostics(),
          });
        }

        const [{ installations, hiddenPersonalInstallReason }, userConnection] = await Promise.all([
          this.#syncInstallations(tenant.orgId, tenant.userId),
          this.#fetchUserConnection(tenant.userId),
        ]);
        return c.json({
          enabled: true,
          sandboxEnabled: !!ctx.sandbox,
          connected: installations.length > 0,
          installations: installations.map(installation => ({
            installationId: Number(installation.externalId),
            accountLogin: installation.accountName,
            accountType: installation.accountType,
          })),
          userConnected: userConnection.connected,
          userGithubUsername: userConnection.githubUsername,
          reason: githubStatusReason(installations.length > 0, hiddenPersonalInstallReason),
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
        const url = await this.#legacy.installUrl(query);
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
        const url = await this.#legacy.authenticateUrl(query);
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
      const connection: PlatformGithubUserConnection = await this.#legacy.userConnection(userId);
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

  async hasActiveConnections(): Promise<boolean> {
    const result = await this.#legacy.listInstallations();
    return result.installations.some(installation => installation.usable && !installation.suspendedAt);
  }

  async #syncInstallations(
    orgId: string,
    userId: string,
  ): Promise<{
    installations: SourceControlInstallation[];
    hiddenPersonalInstallReason?: PlatformHiddenPersonalInstallReason;
  }> {
    const result = await this.#legacy.listInstallations();
    const usableInstallations = result.installations.filter(
      installation => installation.usable && !installation.suspendedAt,
    );
    const installations = await Promise.all(
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
    return { installations, hiddenPersonalInstallReason: result.hiddenPersonalInstallReason ?? undefined };
  }

  /**
   * The hourly reconcile: pull requests, issues, missed opens and Dependabot
   * alerts. Events arrive through the deployment's events worker
   * ({@link platformTopicSubscriptions}); this only covers what they miss.
   */
  workers(ctx: IntegrationContext): MastraWorker[] {
    const reconcile = this.#pullRequestReconcileEnabled
      ? attachGithubReconciler(this, ctx, input => this.fetchPullRequestState(input))
      : undefined;
    const discover = this.#pullRequestReconcileEnabled
      ? attachGithubPullRequestDiscovery(this, ctx, openPullRequestLister(this.versionControl))
      : undefined;
    const reconcileIssues = this.#issueReconcileEnabled
      ? attachGithubIssueReconciler(
          this,
          ctx,
          input => this.fetchIssueState(input),
          input => this.listOpenIssueStates(input),
        )
      : undefined;
    const syncDependabot = this.#issueReconcileEnabled ? this.#dependabotSync(ctx) : undefined;
    // Without the Factory runtime there is nothing to reconcile.
    if (!reconcile && !discover && !reconcileIssues && !syncDependabot) return [];
    const worker = new GithubReconcileWorker({
      name: 'platform-github-reconcile',
      leaseKey: 'platform-github:reconcile',
      reconcile,
      discover,
      reconcileIssues,
      syncDependabot,
      beforeSweep: targets => this.#refreshRepositoryNames(targets),
      ...(this.#pullRequestReconcileIntervalMs === undefined
        ? {}
        : { intervalMs: this.#pullRequestReconcileIntervalMs }),
      ...(this.#issueReconcileIntervalMs === undefined ? {} : { issueIntervalMs: this.#issueReconcileIntervalMs }),
      // Opens arrive as events, so discovery only covers gaps: hourly, unlike the self-hosted default.
      discoveryIntervalMs: this.#pullRequestDiscoveryIntervalMs ?? DEFAULT_GITHUB_RECONCILE_INTERVAL_MS,
      dependabotIntervalMs: DEFAULT_GITHUB_RECONCILE_INTERVAL_MS,
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
    });
    this.#reconcileWorker = worker;
    return [worker];
  }

  override requestReconcile(): void {
    this.#reconcileWorker?.requestRun();
  }

  /** The legacy GitHub App's webhooks, read from the `github-app` topic. */
  platformTopicSubscriptions(ctx: IntegrationContext): readonly PlatformTopicSubscription[] {
    if (!ctx.controller) {
      throw new Error('Platform GitHub events require the mounted Mastra Code controller.');
    }
    return [
      legacyGithubTopicSubscription({
        delivery: { controller: ctx.controller, github: this, ingestFactoryEvent: attachGithubRules(this, ctx) },
        repositories: this.#linkedRepositories,
        modes: this.#modes,
        reconcile: () => this.requestReconcile(),
        onDependabotAlert: () => this.#reconcileWorker?.requestRun(['dependabot']),
      }),
    ];
  }

  /**
   * `factory-github` webhooks from the `connect` topic, for orgs that switched
   * to the Mastra Factory apps. `factory-reviews-github` events are ignored.
   */
  protected override async handleConnectEvent(
    event: PlatformConnectEventDelivery,
    ctx: IntegrationContext,
  ): Promise<void> {
    if (!ctx.controller) {
      throw new Error('Platform GitHub events require the mounted Mastra Code controller.');
    }
    this.#connectEvents ??= connectGithubEventHandler({
      delivery: { controller: ctx.controller, github: this, ingestFactoryEvent: attachGithubRules(this, ctx) },
      repositories: this.#linkedRepositories,
      modes: this.#modes,
      onDependabotAlert: () => this.#reconcileWorker?.requestRun(['dependabot']),
      logger: {
        debug: () => {},
        warn: (message: string, fields?: Record<string, unknown>) => logPlatformWarn(message, fields),
        error: (message: string, fields?: Record<string, unknown>) => logPlatformError(message, fields),
      },
    });
    await this.#connectEvents(event);
  }

  /** Repositories renamed on GitHub keep their id; sweep them under the name the platform reports now. */
  async #refreshRepositoryNames(targets: ReconcileRepository[]): Promise<void> {
    for (const installationId of new Set(targets.map(target => target.installationId))) {
      try {
        const names = new Map(
          (await this.#installationRepositories(installationId)).map(repository => [
            repository.id,
            repository.fullName,
          ]),
        );
        for (const target of targets) {
          const name = target.installationId === installationId ? names.get(target.id) : undefined;
          if (name) target.fullName = name;
        }
      } catch (error) {
        logPlatformWarn('Platform GitHub repository name refresh failed', {
          installationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  #dependabotSync(ctx: IntegrationContext): DependabotSync | undefined {
    const ingest = attachDependabotRules(ctx);
    if (!ingest) return undefined;
    return createDependabotSync({
      listAlerts: input => this.listDependabotAlerts(input),
      listProjects: args => this.storage.projectRepositories.listByExternalRepository(args),
      // Opt-in per repo: the org's `dependabot` intake config must be enabled and list the repo.
      repositoryEnabled: async ({ orgId, repository }) => {
        const config = (await ctx.storage.intake.getConfig({ orgId, integrationIds: [DEPENDABOT_INTAKE_ID] }))[
          DEPENDABOT_INTAKE_ID
        ];
        return Boolean(config?.enabled && config.sourceIds?.includes(repository));
      },
      ingest,
      userId: 'factory-rule-dispatcher',
    });
  }

  /** Lists a repository's Dependabot alerts in one state through the Platform GitHub proxy. */
  async listDependabotAlerts(input: {
    installationId: number;
    repository: string;
    state: 'open' | 'closed';
  }): Promise<GithubDependabotAlert[]> {
    splitRepository(input.repository);
    const github = await this.#github(installationConnection(input.installationId), input.repository);
    return github.listDependabotAlerts({ repository: input.repository }, input.state);
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
    try {
      splitRepository(input.repository);
    } catch {
      return undefined;
    }
    try {
      const github = await this.#github(installationConnection(input.installationId), input.repository);
      // Read with GitHub's REST field names, as before the transport existed.
      // The platform route answers in camelCase, so the renamed fields read as
      // absent here (recorded as a follow-up, not changed in this move).
      const result = (await github.getPullRequest({ repository: input.repository }, input.number)) as unknown as {
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
      };
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
    try {
      splitRepository(input.repository);
    } catch {
      return undefined;
    }
    try {
      const github = await this.#github(installationConnection(input.installationId), input.repository);
      // Read with GitHub's REST field names, as before the transport existed (see fetchPullRequestState).
      const result = (await github.getIssue({ repository: input.repository }, input.number)) as unknown as {
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
      };
      if (result.pull_request) return undefined;
      return {
        title: result.title ?? `Issue ${input.number}`,
        url: result.html_url ?? `https://github.com/${input.repository}/issues/${input.number}`,
        state: result.state === 'closed' ? 'closed' : 'open',
        ...(result.state_reason ? { stateReason: result.state_reason } : {}),
        assignees: (result.assignees ?? []).flatMap(assignee => (assignee.login ? [assignee.login] : [])),
        labels: (result.labels ?? [])
          .map(label => (typeof label === 'string' ? label : label.name))
          .filter((name): name is string => Boolean(name)),
        ...(result.user?.login ? { author: result.user.login } : {}),
        ...(result.created_at ? { createdAt: result.created_at } : {}),
        ...(result.updated_at ? { updatedAt: result.updated_at } : {}),
      };
    } catch {
      return undefined;
    }
  }

  async listOpenIssueStates(input: {
    installationId: number;
    repository: string;
  }): Promise<Array<ReconcileIssueState & { number: number }>> {
    const issues: Array<ReconcileIssueState & { number: number }> = [];
    const github = await this.#github(installationConnection(input.installationId), input.repository);
    for (let page = 1; page <= OPEN_ISSUE_DISCOVERY_MAX_PAGES; page += 1) {
      splitRepository(input.repository);
      const result = {
        issues: await github.listIssues({ repository: input.repository }, { state: 'open', page, perPage: PAGE_SIZE }),
      };
      for (const issue of result.issues) {
        issues.push({
          number: issue.number,
          title: issue.title,
          url: issue.htmlUrl,
          state: 'open',
          assignees: issue.assignees,
          labels: issue.labels,
          ...(issue.user?.login ? { author: issue.user.login } : {}),
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        });
      }
      if (result.issues.length < PAGE_SIZE) break;
    }
    return issues;
  }

  async upsertFactoryTriageComment(input: GithubTriageCommentUpsertInput): Promise<GithubTriageCommentUpsertResult> {
    const comments: GithubComment[] = [];
    splitRepository(input.repository);
    const github = await this.#github(installationConnection(input.installationId), input.repository);
    const call = { repository: input.repository };
    for (let page = 1; ; page += 1) {
      const result = await github.listIssueComments(call, input.issueNumber, { page, perPage: PAGE_SIZE });
      comments.push(...result);
      if (result.length < PAGE_SIZE) break;
    }
    const existing = comments
      .filter(
        comment =>
          comment.body.includes('<!-- mastra-factory-triage -->') && this.isFactoryCommentAuthor(comment.user?.login),
      )
      .sort((left, right) => left.id - right.id)[0];
    if (existing) {
      const comment = await github.updateIssueComment(call, existing.id, input.body);
      this.#observeSelfAuthor(comment, undefined);
      return { action: 'updated', commentId: String(comment.id), url: comment.htmlUrl };
    }
    const comment = await github.createIssueComment(call, input.issueNumber, input.body);
    this.#observeSelfAuthor(comment, undefined);
    return { action: 'created', commentId: String(comment.id), url: comment.htmlUrl };
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
      events: { topics: ['github-app'] },
      reconcile: {
        pullRequests: {
          enabled: this.#pullRequestReconcileEnabled,
          ...(this.#pullRequestReconcileIntervalMs === undefined
            ? {}
            : { intervalMs: this.#pullRequestReconcileIntervalMs }),
          ...(this.#pullRequestDiscoveryIntervalMs === undefined
            ? {}
            : { discoveryIntervalMs: this.#pullRequestDiscoveryIntervalMs }),
        },
        issues: {
          enabled: this.#issueReconcileEnabled,
          ...(this.#issueReconcileIntervalMs === undefined ? {} : { intervalMs: this.#issueReconcileIntervalMs }),
        },
      },
    };
  }

  async getRepositoryCollaboratorPermission(
    installationId: number,
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
    const cacheKey = `${repository.owner}/${repository.repo}:${username.toLowerCase()}`;
    const cached = this.#collaboratorPermissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.permission;
    this.#collaboratorPermissionCache.delete(cacheKey);
    const inFlight = this.#collaboratorPermissionInFlight.get(cacheKey);
    if (inFlight) return settleOrAbort(inFlight, signal, undefined);
    const lookup = (async () => {
      try {
        const github = await this.#github(installationConnection(installationId), repoFullName);
        const permission = await github.getCollaboratorPermission({ repository: repoFullName }, username);
        // Failures are not cached: a rate-limited or aborted lookup must retry
        // on the next call rather than pin the login as unknown.
        setBounded(this.#collaboratorPermissionCache, cacheKey, {
          permission,
          expiresAt: Date.now() + COLLABORATOR_PERMISSION_CACHE_TTL_MS,
        });
        return permission;
      } catch {
        return undefined;
      } finally {
        this.#collaboratorPermissionInFlight.delete(cacheKey);
      }
    })();
    this.#collaboratorPermissionInFlight.set(cacheKey, lookup);
    return settleOrAbort(lookup, signal, undefined);
  }

  async listInstallationRepos(installationId: number, options?: RepoListOptions): Promise<RepoSummary[]> {
    // A narrowed listing (the repo picker) asks the Platform to search or
    // trim, so accounts with hundreds of repositories never page them all.
    if (options?.query || options?.limit) {
      const repositories = await this.#legacy.listInstallationRepositories(installationId, {
        query: options.query,
        limit: options.limit,
      });
      // A refresh means the grant may have changed, so a cached full listing
      // could now miss a repository this narrowed one shows.
      if (options.fresh) this.#installationReposCache.delete(installationId);
      return repositories.map(repository => ({ ...repository, installationId }));
    }

    // Read by single-repository lookups and token minting (which re-lists
    // only to validate the 1–10 repo rule). A short TTL collapses repeat
    // Platform round trips within one UI interaction; `fresh` skips it so an
    // explicit refresh picks up repositories just granted on GitHub.
    const cached = this.#installationReposCache.get(installationId);
    if (!options?.fresh && cached && cached.expiresAt > Date.now()) return cached.repos;
    this.#installationReposCache.delete(installationId);

    const result = { repositories: await this.#installationRepositories(installationId) };
    const repos = result.repositories.map(repository => ({ ...repository, installationId }));
    setBounded(this.#installationReposCache, installationId, {
      repos,
      expiresAt: Date.now() + INSTALLATION_REPOS_CACHE_TTL_MS,
    });
    return repos;
  }

  /**
   * The Platform has no single-repository endpoint, so use a cached full
   * listing when one is warm and otherwise search the installation by name,
   * which stays fast on accounts with hundreds of repositories. The search is
   * capped, so a miss falls back to the full listing rather than answering no.
   */
  async getInstallationRepo(installationId: number, repoFullName: string): Promise<RepoSummary | null> {
    const find = (repositories: RepoSummary[]) =>
      repositories.find(repository => repository.fullName === repoFullName) ?? null;
    const cached = this.#installationReposCache.get(installationId);
    if (cached && cached.expiresAt > Date.now()) return find(cached.repos);
    const searched = find(
      await this.listInstallationRepos(installationId, {
        query: repoFullName.split('/').pop() ?? repoFullName,
        limit: 100,
      }),
    );
    return searched ?? find(await this.listInstallationRepos(installationId));
  }

  async mintInstallationToken(installationId: number): Promise<string> {
    const repositories = await this.listInstallationRepos(installationId);
    if (repositories.length === 0 || repositories.length > MAX_REPOSITORIES_PER_TOKEN) {
      throw new Error('Platform GitHub token minting requires between one and ten installation repositories.');
    }
    return this.#repositoryToken(
      { installationId },
      repositories.map(repository => repository.name),
    );
  }

  async addIssueLabels(
    installationId: number,
    sourceId: string,
    issueNumber: number,
    labels: string[],
  ): Promise<string[]> {
    splitRepository(sourceId);
    const github = await this.#github(installationConnection(installationId), sourceId);
    return github.addIssueLabels({ repository: sourceId }, issueNumber, labels);
  }

  async removeIssueLabel(installationId: number, sourceId: string, issueNumber: number, label: string): Promise<void> {
    const name = label.trim();
    if (!name) return;
    splitRepository(sourceId);
    const github = await this.#github(installationConnection(installationId), sourceId);
    await github.removeIssueLabel({ repository: sourceId }, issueNumber, name);
  }

  getInstallationOctokit(installationId: number): ReturnType<GithubIntegration['getInstallationOctokit']> {
    return {
      pulls: {
        get: async ({ owner, repo, pull_number }: { owner: string; repo: string; pull_number: number }) => {
          const github = await this.#github(installationConnection(installationId), `${owner}/${repo}`);
          const data = await github.getPullRequest({ repository: `${owner}/${repo}` }, pull_number);
          return { data: { base: { repo: { id: data.base.repo.id } }, head: { ref: data.head.ref } } };
        },
      },
    } as unknown as ReturnType<GithubIntegration['getInstallationOctokit']>;
  }

  async #listIssues(connection: IntegrationConnection, sourceId: string, page: number, labels?: string[]) {
    requireGithubConnection(connection);
    splitRepository(sourceId);
    const normalizedLabels = normalizeLabels(labels);
    const github = await this.#github(connection, sourceId);
    const result = {
      issues: await github.listIssues(
        { repository: sourceId },
        {
          state: 'open',
          page,
          perPage: PAGE_SIZE,
          ...(normalizedLabels.length > 0 ? { labels: normalizedLabels } : {}),
        },
      ),
    };
    return {
      issues: result.issues.map(issue => parseIntakeIssue(sourceId, issue)),
      nextCursor: result.issues.length > 0 ? String(page + 1) : null,
    };
  }

  async #getIssue(connection: IntegrationConnection, sourceId: string | undefined, issueId: string) {
    requireGithubConnection(connection);
    const repository = requireSource(sourceId, 'GitHub Intake requires a repository source.');
    const issueNumber = requirePositiveId(issueId, 'issue');
    splitRepository(repository);
    const github = await this.#github(connection, repository);
    try {
      const [issue, comments] = await Promise.all([
        github.getIssue({ repository }, issueNumber),
        github.listIssueComments({ repository }, issueNumber, { perPage: 100 }),
      ]);
      return parseIntakeIssueDetail(repository, issue, comments);
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
    splitRepository(repository);
    const github = await this.#github(input.connection, repository);
    const call = { repository, ...(input.actingUserId ? { actingUserId: input.actingUserId } : {}) };
    try {
      await github.getPullRequest({ repository }, issueNumber);
      logPlatformWarn(`Platform GitHub: updateIssue rejected — target ${repository}#${issueNumber} is a pull request.`);
      return null;
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // 404 on pulls means it's an issue (or nothing) — fall through to PATCH.
    }
    try {
      const issue = await github.updateIssue(call, issueNumber, {
        state: targetState,
        ...(stateReason ? { stateReason } : {}),
      });
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
    splitRepository(repository);
    const github = await this.#github(input.connection, repository);
    try {
      const comment = await github.createIssueComment(
        { repository, ...(input.actingUserId ? { actingUserId: input.actingUserId } : {}) },
        issueNumber,
        input.body,
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
    splitRepository(input.sourceId);
    const github = await this.#github(input.connection, input.sourceId);
    const result = {
      pullRequests: await github.listPullRequests(
        { repository: input.sourceId },
        { state: input.state ?? 'open', page, perPage: PAGE_SIZE },
      ),
    };
    return {
      pullRequests: result.pullRequests
        .filter(pullRequest => input.includeDrafts !== false || !pullRequest.draft)
        .map(parsePullRequest),
      nextCursor: result.pullRequests.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getPullRequest(input: PullRequestRef) {
    const { github, call, number } = await this.#pullRequestCall(input);
    try {
      return parsePullRequest(await github.getPullRequest(call, number));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #createPullRequest(input: CreatePullRequestInput) {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const github = await this.#github(input.connection, input.sourceId);
    const result = await github.createPullRequest(
      { repository: input.sourceId, ...(input.actingUserId ? { actingUserId: input.actingUserId } : {}) },
      { head: input.headBranch, base: input.baseBranch, title: input.title, body: input.body, draft: input.draft },
    );
    const created = parsePullRequest(result);
    if (input.actingUserId && github instanceof ConnectGithubTransport) {
      await this.#assignOpener(github, input.sourceId, result.number, input.actingUserId, created);
    } else if (input.actingUserId && input.connection.type === 'app-installation') {
      try {
        const user = await this.#fetchUserConnection(input.actingUserId);
        const login = user.githubUsername;
        if (user.connected && login) {
          const { owner, repo } = splitRepository(input.sourceId);
          const token = await this.#repositoryToken(input.connection, [repo]);
          const octokit = new Octokit({ auth: token, request: { timeout: 15_000 } });
          const { data } = await octokit.issues.addAssignees({
            owner,
            repo,
            issue_number: result.number,
            assignees: [login],
          });
          if (!data.assignees?.some(assignee => assignee.login?.toLowerCase() === login.toLowerCase())) {
            logPlatformWarn('GitHub did not assign the PR opener', { url: created.url, login });
          } else {
            created.assignees = data.assignees.flatMap(assignee => (assignee.login ? [assignee.login] : []));
          }
        }
      } catch (error) {
        logPlatformWarn('Failed to assign the PR opener', {
          url: created.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return created;
  }

  /**
   * Assigns a pull request to the person it was opened for, with their own
   * GitHub token. Best effort: a missing connection or a refusal only warns.
   */
  async #assignOpener(
    github: ConnectGithubTransport,
    repository: string,
    number: number,
    userId: string,
    created: ReturnType<typeof parsePullRequest>,
  ): Promise<void> {
    try {
      const login = await github.userLogin(userId);
      if (!login) return;
      const { owner, repo } = splitRepository(repository);
      const data = await github.asUser(userId, 'assignPullRequestOpener', async octokit => {
        const response = await octokit.issues.addAssignees({ owner, repo, issue_number: number, assignees: [login] });
        return response.data;
      });
      if (!data?.assignees?.some(assignee => assignee.login?.toLowerCase() === login.toLowerCase())) {
        logPlatformWarn('GitHub did not assign the PR opener', { url: created.url, login });
      } else {
        created.assignees = data.assignees.flatMap(assignee => (assignee.login ? [assignee.login] : []));
      }
    } catch (error) {
      logPlatformWarn('Failed to assign the PR opener', {
        url: created.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async #updatePullRequest(input: UpdatePullRequestInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const result = await github.updatePullRequest(call, number, {
      title: input.title,
      body: input.body === null ? '' : input.body,
      base: input.baseBranch,
      state: input.state,
    });
    return parsePullRequest(result);
  }

  async #mergePullRequest(input: MergePullRequestInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    return github.mergePullRequest(call, number, {
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
      method: input.method,
    });
  }

  async #listComments(input: ListPullRequestCommentsInput) {
    const page = parsePositiveCursor(input.cursor);
    const number = requirePositiveId(input.pullRequestId, 'pull request');
    splitRepository(input.sourceId);
    const github = await this.#github(input.connection, input.sourceId);
    const result = {
      comments: await github.listIssueComments({ repository: input.sourceId }, number, { page, perPage: PAGE_SIZE }),
    };
    return {
      comments: result.comments.map(parseComment),
      nextCursor: result.comments.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createComment(input: CreatePullRequestCommentInput) {
    const number = requirePositiveId(input.pullRequestId, 'pull request');
    splitRepository(input.sourceId);
    const github = await this.#github(input.connection, input.sourceId);
    const comment = await github.createIssueComment(actingCall(input.sourceId, input.actingUserId), number, input.body);
    this.#observeSelfAuthor(comment, input.actingUserId);
    return parseComment(comment);
  }

  async #updateComment(input: UpdatePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const commentId = requirePositiveId(input.commentId, 'comment');
    const github = await this.#github(input.connection, input.sourceId);
    const comment = await github.updateIssueComment(
      actingCall(input.sourceId, input.actingUserId),
      commentId,
      input.body,
    );
    return parseComment(comment);
  }

  async #deleteComment(input: DeletePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const commentId = requirePositiveId(input.commentId, 'comment');
    const github = await this.#github(input.connection, input.sourceId);
    await github.deleteIssueComment(actingCall(input.sourceId, input.actingUserId), commentId);
  }

  async #listReviews(input: ListReviewsInput) {
    const page = parsePositiveCursor(input.cursor);
    const { github, call, number } = await this.#pullRequestCall(input);
    const result = { reviews: await github.listReviews(call, number, { page, perPage: PAGE_SIZE }) };
    return {
      reviews: result.reviews.map(parseReview),
      nextCursor: result.reviews.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getReview(input: ReviewRef) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const reviewId = requirePositiveId(input.reviewId, 'review');
    try {
      return parseReview(await github.getReview(call, number, reviewId));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #createReview(input: CreateReviewInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const review = await github.createReview(call, number, {
      body: input.body,
      commitId: input.commitId,
      event: input.event ? reviewEvent(input.event) : undefined,
    });
    return parseReview(review);
  }

  async #publishCommitCheck(input: PublishCommitCheckInput): Promise<CommitCheck> {
    requireGithubConnection(input.connection);
    // Every call creates a new run; GitHub shows the latest run per app and name.
    splitRepository(input.sourceId);
    const github = await this.#github(input.connection, input.sourceId);
    const run = await github.createCheckRun(actingCall(input.sourceId, input.actingUserId), {
      name: input.name,
      headSha: input.headSha,
      ...(input.status === 'in-progress'
        ? { status: 'in_progress' as const }
        : { status: 'completed' as const, conclusion: input.status }),
      output: {
        title: input.title.slice(0, CHECK_TITLE_LIMIT),
        summary: input.summary.slice(0, CHECK_TEXT_LIMIT),
        ...(input.details ? { text: input.details.slice(0, CHECK_TEXT_LIMIT) } : {}),
      },
    });
    return { id: String(run.id), name: input.name, headSha: input.headSha, status: input.status, url: run.htmlUrl };
  }

  async #updateReview(input: UpdateReviewInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const review = await github.updateReview(call, number, requirePositiveId(input.reviewId, 'review'), input.body);
    return parseReview(review);
  }

  async #submitReview(input: SubmitReviewInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const review = await github.submitReview(call, number, requirePositiveId(input.reviewId, 'review'), {
      body: input.body,
      event: reviewEvent(input.event),
    });
    return parseReview(review);
  }

  async #dismissReview(input: DismissReviewInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    const review = await github.dismissReview(call, number, requirePositiveId(input.reviewId, 'review'), input.message);
    return parseReview(review);
  }

  async #deletePendingReview(input: ReviewRef) {
    const { github, call, number } = await this.#pullRequestCall(input);
    await github.deletePendingReview(call, number, requirePositiveId(input.reviewId, 'review'));
  }

  async #listReviewComments(input: ListReviewCommentsInput) {
    const page = parsePositiveCursor(input.cursor);
    const { github, call, number } = await this.#pullRequestCall(input);
    const result = { comments: await github.listReviewComments(call, number, { page, perPage: PAGE_SIZE }) };
    return {
      comments: result.comments.map(parseReviewComment),
      nextCursor: result.comments.length === PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createReviewComment(input: CreateReviewCommentInput) {
    let body: GithubReviewCommentCreate;
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
    const { github, call, number } = await this.#pullRequestCall(input);
    return parseReviewComment(await github.createReviewComment(call, number, body));
  }

  async #updateReviewComment(input: UpdatePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const commentId = requirePositiveId(input.commentId, 'review comment');
    const github = await this.#github(input.connection, input.sourceId);
    return parseReviewComment(
      await github.updateReviewComment(actingCall(input.sourceId, input.actingUserId), commentId, input.body),
    );
  }

  async #deleteReviewComment(input: DeletePullRequestCommentInput) {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const commentId = requirePositiveId(input.commentId, 'review comment');
    const github = await this.#github(input.connection, input.sourceId);
    await github.deleteReviewComment(actingCall(input.sourceId, input.actingUserId), commentId);
  }

  /**
   * A token for at most ten named repositories of one installation. Agent
   * sandboxes get these, never an installation-wide token.
   */
  async #repositoryToken(target: { installationId: number; orgId?: string }, repositories: string[]): Promise<string> {
    const org = await this.#connectOrg({ type: 'app-installation', ...target });
    if (!org) {
      return this.#legacy.mintRepositoryToken(target.installationId, repositories, REPOSITORY_TOKEN_PERMISSIONS);
    }
    // Connect hands out installation-wide tokens only. Sandboxes never get one.
    throw new GithubTokenScopeUnavailableError();
  }

  /** The installations an org's repositories come from: its switched installations, or the legacy app's usable ones. */
  async #sourceInstallations(
    orgId: string,
  ): Promise<Array<{ installationId: number; accountLogin: string; accountType: string }>> {
    const record = this.#integrationStorage ? await this.#modes.get(orgId) : undefined;
    if (record?.mode === 'connect') {
      return (record.installations ?? []).map(installation => ({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType ?? 'Organization',
      }));
    }
    const installations = await this.#legacy.listInstallations();
    return installations.installations.filter(installation => installation.usable && !installation.suspendedAt);
  }

  /** Every repository an installation reaches, from whichever app it belongs to. */
  async #installationRepositories(installationId: number, orgId?: string): Promise<LegacyInstallationRepository[]> {
    const transport = await this.#connectTransport(
      { type: 'app-installation', installationId, ...(orgId ? { orgId } : {}) },
      undefined,
    );
    return transport
      ? transport.listInstallationRepositories()
      : this.#legacy.listInstallationRepositories(installationId);
  }

  /**
   * The transport serving a connection. The org's mode is the only branch
   * point: an org that has not switched, and any connection whose org can't be
   * named, stays on the legacy routes. A switched org never falls back to them.
   */
  async #github(connection: IntegrationConnection, repository?: string): Promise<GithubTransport> {
    return (await this.#connectTransport(connection, repository)) ?? this.#legacy;
  }

  /** The switched org a connection belongs to, or null when it runs on the legacy app. */
  async #connectOrg(
    connection: IntegrationConnection,
  ): Promise<{ orgId: string; record: PlatformGithubModeRecord } | null> {
    if (connection.type !== 'app-installation' || !this.#integrationStorage) return null;
    const orgId = connection.orgId ?? (await this.#modes.orgForInstallation(connection.installationId));
    if (!orgId) return null;
    const record = await this.#modes.get(orgId);
    return record.mode === 'connect' ? { orgId, record } : null;
  }

  /**
   * The Connect transport for a switched org's installation: the one the
   * connection names, else the one installed on the repository's owner.
   */
  async #connectTransport(
    connection: IntegrationConnection,
    repository: string | undefined,
  ): Promise<ConnectGithubTransport | null> {
    const org = await this.#connectOrg(connection);
    if (!org || connection.type !== 'app-installation') return null;
    const installations = org.record.installations ?? [];
    const owner = repository ? splitRepository(repository).owner.toLowerCase() : undefined;
    const installation =
      installations.find(candidate => candidate.installationId === connection.installationId) ??
      (owner ? installations.find(candidate => candidate.accountLogin.toLowerCase() === owner) : undefined);
    if (!installation) throw new PlatformGithubInstallationNotFoundError(org.orgId, repository);
    await this.#requireActive(installation);
    return this.#transportFor(installation);
  }

  /** Both apps' connections must be live: a switched org never falls back to the legacy app. */
  async #requireActive(installation: PlatformGithubConnectInstallation): Promise<void> {
    const [github, reviews] = await Promise.all([
      this.connectionFor(FACTORY_GITHUB_PROVIDER_KEY, connection => connection.id === installation.connectionId),
      this.connectionFor(
        FACTORY_REVIEWS_GITHUB_PROVIDER_KEY,
        connection => connection.id === installation.reviewsConnectionId,
      ),
    ]);
    if (!github || !reviews) {
      throw new PlatformGithubConnectionInactiveError(
        installation.accountLogin,
        !github ? 'factory-github' : 'factory-reviews-github',
      );
    }
  }

  #transportFor(installation: PlatformGithubConnectInstallation): ConnectGithubTransport {
    const key = `${installation.installationId}:${installation.connectionId}:${installation.reviewsConnectionId}`;
    let transport = this.#connectTransports.get(key);
    if (!transport) {
      transport = new ConnectGithubTransport({
        installation,
        tokens: this.#tokens,
        isFactoryLogin: login => this.isFactoryCommentAuthor(login),
        ...(this.#githubApiUrl ? { baseUrl: this.#githubApiUrl } : {}),
      });
      this.#connectTransports.set(key, transport);
    }
    return transport;
  }

  /** Validates a pull request reference in the order the legacy routes did, then picks its transport. */
  async #pullRequestCall(input: {
    connection: IntegrationConnection;
    sourceId: string;
    pullRequestId: string;
    actingUserId?: string;
  }): Promise<{ github: GithubTransport; call: GithubCall; number: number }> {
    requireGithubConnection(input.connection);
    splitRepository(input.sourceId);
    const number = requirePositiveId(input.pullRequestId, 'pull request');
    return {
      github: await this.#github(input.connection, input.sourceId),
      call: actingCall(input.sourceId, input.actingUserId),
      number,
    };
  }

  async #requestedReviewers(method: 'GET' | 'POST' | 'DELETE', input: UpdateReviewersInput) {
    const { github, call, number } = await this.#pullRequestCall(input);
    if (method === 'GET') return github.listRequestedReviewers({ repository: call.repository }, number);
    const reviewers = { users: input.users, teams: input.teams };
    return method === 'POST'
      ? github.requestReviewers(call, number, reviewers)
      : github.removeRequestedReviewers(call, number, reviewers);
  }
}

function installationConnection(installationId: number): IntegrationConnection {
  return { type: 'app-installation', installationId };
}

function actingCall(repository: string, actingUserId: string | undefined): GithubCall {
  return { repository, ...(actingUserId ? { actingUserId } : {}) };
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

/**
 * Names the Factory user a platform GitHub write acts for, so the platform
 * authors it with that user's GitHub connection instead of the App bot.
 */
function isNotFound(error: unknown): boolean {
  return githubErrorStatus(error) === 404;
}

// Platform answers 404 when the installation row is gone, 409 when it is suspended or soft-deleted.
// A 502 also covers a dead installation but is indistinguishable from a transient GitHub outage.
function isDeadInstallation(error: unknown): boolean {
  const status = githubErrorStatus(error);
  return status === 404 || status === 409;
}

/** A switched org has no Mastra Factory app installation for the repository's owner. */
export class PlatformGithubInstallationNotFoundError extends Error {
  readonly status = 404;

  constructor(orgId: string, repository: string | undefined) {
    super(
      `Org ${orgId} switched to the Mastra Factory GitHub apps, but none of its installations serves ${repository ?? 'this connection'}.`,
    );
    this.name = 'PlatformGithubInstallationNotFoundError';
  }
}

/** One of a switched org's Mastra Factory app connections is no longer active. */
export class PlatformGithubConnectionInactiveError extends Error {
  readonly status = 409;

  constructor(accountLogin: string, providerKey: string) {
    super(`The ${providerKey} connection for ${accountLogin} is not active. Reconnect it in Factory settings.`);
    this.name = 'PlatformGithubConnectionInactiveError';
  }
}

/**
 * Agent sandboxes only get tokens scoped to the repositories they work on.
 * Connect issues installation-wide tokens, so a switched org can't mint one.
 */
export class GithubTokenScopeUnavailableError extends Error {
  readonly status = 409;
  readonly code = 'sandbox_token_scope_unavailable';

  constructor() {
    super(
      'Repository-scoped GitHub tokens are not available for the Mastra Factory GitHub apps yet, so Factory will not hand an agent sandbox an installation-wide token.',
    );
    this.name = 'GithubTokenScopeUnavailableError';
  }
}
