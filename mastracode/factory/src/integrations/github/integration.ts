/**
 * `GithubIntegration` — the injectable GitHub App integration for the web
 * factory.
 *
 * The deploy entry (`src/mastra/index.ts`) reads the `GITHUB_APP_*` env vars
 * once, constructs an instance, and passes it to `MastraFactory` (the same
 * dependency-injection pattern as the auth adapter and the sandbox machine).
 * The factory seeds it into the runtime-config registry for the feature gate
 * (`./config.ts`) and hands the instance to every consumer explicitly — route
 * handlers receive it through `routes()`, the webhook fan-out and session
 * subscription tools through their deps.
 *
 * The class owns:
 *   - the GitHub App credentials (validated + PEM-normalized at construction),
 *   - every GitHub API operation the web surface performs (Octokit factories,
 *     token minting, installation/repo/issue/PR listings, OAuth exchange),
 *   - the webhook secret used to verify GitHub webhook deliveries,
 *   - its own HTTP surface: `routes()` returns the `/web/github/*` +
 *     `/auth/github/*` Mastra `apiRoutes`.
 *
 * A custom integration (different app per tenant, custom Octokit config) can
 * subclass this and override individual methods — everything downstream only
 * talks to the instance.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

import type { IntegrationConnection } from '../../capabilities/connection';
import type {
  CreateIntakeCommentInput,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  ListIntakeIssuesInput,
} from '../../capabilities/intake';
import type {
  PullRequest,
  PullRequestComment,
  Review,
  ReviewComment,
  VersionControl,
} from '../../capabilities/version-control';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../base';
import { runGithubIssueTriage } from './issue-triage.js';
import { buildGithubRoutes } from './routes.js';
import {
  createGithubSubscriptionTools,
  parseCreatedPullRequest,
  subscribeCurrentSessionToPullRequest,
} from './session-subscriptions.js';
import type { GithubSubscriptionStorage } from './subscriptions.js';

type InputOf<TMethod extends keyof VersionControl> = VersionControl[TMethod] extends (input: infer TInput) => unknown
  ? TInput
  : never;

/**
 * Normalize a PEM private key supplied via env. Env tooling tends to mangle
 * multi-line PEMs, so two single-line forms are supported:
 *   - `\n`-escaped: literal `\n` sequences become real newlines
 *   - fully flattened: newlines stripped entirely — the PEM is rebuilt by
 *     re-wrapping the base64 body (Node's decoder rejects header/body/footer
 *     on one line with `error:1E08010C:DECODER routines::unsupported`)
 */
export function normalizePrivateKey(raw: string): string {
  const key = raw.replace(/\\n/g, '\n');
  if (key.includes('\n')) return key;
  const flattened = key.trim().match(/^(-----BEGIN [A-Z0-9 ]+-----)\s*(.+?)\s*(-----END [A-Z0-9 ]+-----)$/);
  if (!flattened) return key;
  const body = flattened[2]!.replace(/\s+/g, '');
  return `${flattened[1]}\n${body.match(/.{1,64}/g)!.join('\n')}\n${flattened[3]}\n`;
}

export interface UserInstallation {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
}

export interface RepoSummary {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  installationId: number;
}

export type GithubRepositoryPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none';

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  author: string | null;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}

/** Page size for issue/PR listings; one GitHub API call per page. */
export const LIST_PAGE_SIZE = 30;

export interface IssuePage {
  issues: IssueSummary[];
  /** Next page number to request, or `null` when this was the last page. */
  nextPage: number | null;
}

export interface ListRepoOpenIssuesOptions {
  label?: string;
}

export interface GithubIntegrationConfig {
  /** GitHub App id (the numeric id, as a string). */
  appId: string;
  /**
   * App private key (PEM). Multi-line, `\n`-escaped, and fully flattened
   * single-line forms are all accepted (normalized at construction).
   */
  privateKey: string;
  /** OAuth client id of the GitHub App. */
  clientId: string;
  /** OAuth client secret of the GitHub App. */
  clientSecret: string;
  /** App slug — the URL name used to build the install URL. */
  slug: string;
  /**
   * Secret GitHub uses to sign webhook deliveries. Omitted → webhook
   * signature verification rejects all deliveries. Also serves as the default
   * replica-stable OAuth/install `state` secret (see `./config.ts`).
   */
  webhookSecret?: string;
}

/** Human-readable names of the required config fields, for construction errors. */
const REQUIRED_FIELDS = ['appId', 'privateKey', 'clientId', 'clientSecret', 'slug'] as const;

export class GithubIntegration implements FactoryIntegration {
  /** Stable integration identifier (see `../factory-integration.ts`). */
  readonly id = 'github';
  readonly intake: Intake = {
    listSources: async ({ orgId }) => {
      const installations = await this.sourceControlStorage.installations.list({ orgId });
      const repositories = await Promise.all(
        installations.map(installation =>
          this.sourceControlStorage.repositories.list({ orgId, installationId: installation.id }),
        ),
      );
      return repositories.flat().map(repository => ({
        id: repository.id,
        name: repository.slug,
        type: 'repository',
        metadata: { defaultBranch: repository.defaultBranch },
      }));
    },
    listItems: async ({ orgId, sourceIds, cursor }) => {
      const page = cursor ? Number.parseInt(cursor, 10) : 1;
      const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
      const pages = await Promise.all(
        sourceIds.map(async sourceId => {
          const repository = await this.sourceControlStorage.repositories.get({ orgId, id: sourceId });
          if (!repository) return { items: [], hasNextPage: false };
          const installation = await this.sourceControlStorage.installations.get({
            orgId,
            id: repository.installationId,
          });
          if (!installation) return { items: [], hasNextPage: false };
          const installationId = Number.parseInt(installation.externalId, 10);
          if (!Number.isSafeInteger(installationId)) return { items: [], hasNextPage: false };
          const [issues, pullRequests] = await Promise.all([
            this.listRepoOpenIssues(installationId, repository.slug, requestedPage),
            this.versionControl.listPullRequests({
              connection: { type: 'app-installation', installationId },
              sourceId: repository.slug,
              includeDrafts: false,
              cursor: String(requestedPage),
            }),
          ]);
          return {
            items: [
              ...issues.issues.map(issue => ({
                source: { type: 'issue', externalId: `${repository.externalId}:${issue.number}`, url: issue.url },
                sourceId: repository.id,
                title: issue.title,
                status: 'open',
                labels: issue.labels,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
                metadata: { repository: repository.slug, number: issue.number, author: issue.author },
              })),
              ...pullRequests.pullRequests.map(pullRequest => ({
                source: {
                  type: 'pull-request',
                  externalId: `${repository.externalId}:${pullRequest.id}`,
                  url: pullRequest.url,
                },
                sourceId: repository.id,
                title: pullRequest.title,
                status: 'open',
                createdAt: pullRequest.createdAt,
                updatedAt: pullRequest.updatedAt,
                metadata: {
                  repository: repository.slug,
                  number: Number(pullRequest.id),
                  author: pullRequest.author,
                  baseBranch: pullRequest.baseBranch,
                  headBranch: pullRequest.headBranch,
                },
              })),
            ],
            hasNextPage: issues.nextPage !== null || pullRequests.nextCursor !== null,
          };
        }),
      );
      return {
        items: pages.flatMap(result => result.items),
        nextCursor: pages.some(result => result.hasNextPage) ? String(requestedPage + 1) : null,
      };
    },
    listIssues: input => this.#listIntakeIssues(input),
    getIssue: input => this.#getIntakeIssue(input),
    createComment: input => this.#createIntakeComment(input),
  };
  readonly versionControl: VersionControl = {
    initialize: ({ storage }) => {
      this.#sourceControlStorage = storage;
    },
    registerInstallation: ({ orgId, userId, installation }) =>
      this.sourceControlStorage.installations.upsert({
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
          this.sourceControlStorage.repositories.upsert({
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
      const repository = await this.sourceControlStorage.repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const installation = await this.sourceControlStorage.installations.get({
        orgId,
        id: repository.installationId,
      });
      if (!installation) throw new Error('Version-control installation not found.');
      const installationId = Number.parseInt(installation.externalId, 10);
      if (!Number.isSafeInteger(installationId)) throw new Error('GitHub installation id is invalid.');
      return {
        cloneUrl: `https://github.com/${repository.slug}.git`,
        authorization: { scheme: 'bearer', token: await this.mintInstallationToken(installationId) },
      };
    },
    listPullRequests: input => this.#listPullRequests(input),
    getPullRequest: input => this.#getPullRequest(input),
    createPullRequest: input => this.#createPullRequest(input),
    updatePullRequest: input => this.#updatePullRequest(input),
    closePullRequest: input => this.#closePullRequest(input),
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
    listRequestedReviewers: input => this.#listRequestedReviewers(input),
    requestReviewers: input => this.#requestReviewers(input),
    removeRequestedReviewers: input => this.#removeReviewers(input),
  };
  /**
   * The OAuth/install flow round-trips a signed `state` through GitHub, so a
   * multi-replica deploy needs a deployment-stable state secret.
   */
  readonly requiresStableStateSigner = true;

  readonly #appId: string;
  readonly #privateKey: string;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #slug: string;
  readonly #webhookSecret: string | undefined;
  #storage: IntegrationContext['storage'] | undefined;
  #sourceControlStorage: IntegrationContext['storage']['sourceControl'] | undefined;

  constructor(config: GithubIntegrationConfig) {
    const missing = REQUIRED_FIELDS.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(
        `GithubIntegration: missing required config field(s): ${missing.join(', ')}. ` +
          `Provide the full GitHub App credentials (appId, privateKey, clientId, clientSecret, slug) ` +
          `or omit the integration to disable GitHub-backed repositories.`,
      );
    }
    this.#appId = config.appId;
    this.#privateKey = normalizePrivateKey(config.privateKey);
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
    this.#slug = config.slug;
    this.#webhookSecret = config.webhookSecret || undefined;
  }

  /** App slug — the URL name used to build the install URL. */
  get slug(): string {
    return this.#slug;
  }

  get genericStorage(): IntegrationContext['storage']['generic'] {
    if (!this.#storage) throw new Error('GithubIntegration storage has not been initialized.');
    return this.#storage.generic;
  }

  get sourceControlStorage(): IntegrationContext['storage']['sourceControl'] {
    const storage = this.#sourceControlStorage ?? this.#storage?.sourceControl;
    if (!storage) throw new Error('GithubIntegration source-control storage has not been initialized.');
    return storage;
  }

  get integrationStorage(): GithubSubscriptionStorage {
    if (!this.#storage) throw new Error('GithubIntegration storage has not been initialized.');
    return this.#storage.generic as unknown as GithubSubscriptionStorage;
  }

  /** Secret GitHub uses to sign webhook deliveries, when configured. */
  get webhookSecret(): string | undefined {
    return this.#webhookSecret;
  }

  #appAuth() {
    return {
      appId: this.#appId,
      privateKey: this.#privateKey,
      clientId: this.#clientId,
      clientSecret: this.#clientSecret,
    };
  }

  /**
   * Octokit authenticated as the GitHub App itself (app JWT). Used for
   * app-level operations and to mint installation tokens.
   */
  getAppOctokit(): Octokit {
    return new Octokit({ authStrategy: createAppAuth, auth: this.#appAuth() });
  }

  /**
   * Octokit authenticated as a specific installation (installation access
   * token). Used to list repos and to operate on a repo on the user's behalf.
   */
  getInstallationOctokit(installationId: number): Octokit {
    return new Octokit({ authStrategy: createAppAuth, auth: { ...this.#appAuth(), installationId } });
  }

  /** Octokit authenticated as a user via their OAuth token (the identify step). */
  getUserOctokit(userToken: string): Octokit {
    return new Octokit({ auth: userToken });
  }

  /**
   * Mint a short-lived installation access token. Returned token is used only
   * server-side / inside the sandbox clone URL and never sent to the browser.
   */
  async mintInstallationToken(installationId: number): Promise<string> {
    const auth = createAppAuth(this.#appAuth());
    const installationAuth = await auth({ type: 'installation', installationId });
    return installationAuth.token;
  }

  /**
   * List the installations the authenticated user can access, via their OAuth
   * token (`GET /user/installations`).
   */
  async listUserInstallations(userToken: string): Promise<UserInstallation[]> {
    const octokit = this.getUserOctokit(userToken);
    const installations = await octokit.paginate(octokit.apps.listInstallationsForAuthenticatedUser, {
      per_page: 100,
    });
    return installations.map(inst => ({
      installationId: inst.id,
      accountLogin: inst.account && 'login' in inst.account ? inst.account.login : null,
      accountType: inst.account && 'type' in inst.account ? inst.account.type : null,
    }));
  }

  /** List repos accessible to an installation (paginated). */
  async listInstallationRepos(installationId: number): Promise<RepoSummary[]> {
    const octokit = this.getInstallationOctokit(installationId);
    const repos = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });
    return repos.map(repo => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      defaultBranch: repo.default_branch,
      private: repo.private,
      installationId,
    }));
  }

  /**
   * The authenticated user's permission level on a repo, through the
   * installation. `undefined` when the repo/user is not accessible.
   */
  async getRepositoryCollaboratorPermission(
    installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ): Promise<GithubRepositoryPermission | undefined> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return undefined;
    try {
      const { data } = await this.getInstallationOctokit(installationId).repos.getCollaboratorPermissionLevel({
        ...parts,
        username,
        request: { signal },
      });
      return data.permission as GithubRepositoryPermission;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch a single repo's metadata through an installation token and confirm
   * the installation actually has access to it. Returns `null` when the repo
   * is not accessible to the installation (so a client can't create a project
   * for an arbitrary repo under an installation id it merely owns).
   */
  async getInstallationRepo(installationId: number, repoFullName: string): Promise<RepoSummary | null> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return null;
    const octokit = this.getInstallationOctokit(installationId);
    try {
      const { data } = await octokit.repos.get(parts);
      return {
        id: data.id,
        fullName: data.full_name,
        name: data.name,
        owner: data.owner.login,
        defaultBranch: data.default_branch,
        private: data.private,
        installationId,
      };
    } catch {
      return null;
    }
  }

  async #listIntakeIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const installationId = getGithubInstallationId(input.connection);
    const repoFullName = getSingleSourceId(input.sourceIds, 'GitHub Intake requires exactly one repository source.');
    const page = parsePositiveCursor(input.cursor);
    const labels = normalizeLabels(input.labels);
    const result = await this.listRepoOpenIssues(installationId, repoFullName, page, {
      label: labels.length > 0 ? labels.join(',') : undefined,
    });
    return {
      issues: result.issues.map(issue => ({
        id: String(issue.number),
        identifier: `#${issue.number}`,
        title: issue.title,
        url: issue.url,
        author: issue.author,
        state: 'open',
        stateType: 'open',
        priority: null,
        assignee: null,
        source: repoFullName,
        labels: issue.labels,
        commentCount: issue.comments,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      })),
      nextCursor: result.nextPage === null ? null : String(result.nextPage),
    };
  }

  async #getIntakeIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const installationId = getGithubInstallationId(input.connection);
    const repoFullName = requireSourceId(input.sourceId, 'GitHub Intake requires a repository source.');
    const parts = splitRepoFullName(repoFullName);
    const issueNumber = parsePositiveInteger(input.issueId);
    if (!parts || issueNumber === null) return null;
    const octokit = this.getInstallationOctokit(installationId);
    try {
      const [{ data: issue }, comments] = await Promise.all([
        octokit.issues.get({ owner: parts.owner, repo: parts.repo, issue_number: issueNumber }),
        octokit.paginate(octokit.issues.listComments, {
          owner: parts.owner,
          repo: parts.repo,
          issue_number: issueNumber,
          per_page: 100,
        }),
      ]);
      if (issue.pull_request) return null;
      return {
        id: String(issue.number),
        identifier: `#${issue.number}`,
        title: issue.title,
        url: issue.html_url,
        author: issue.user?.login ?? null,
        state: issue.state,
        stateType: issue.state,
        priority: null,
        assignee: issue.assignee?.login ?? null,
        source: repoFullName,
        labels: issue.labels.map(label => (typeof label === 'string' ? label : (label.name ?? ''))).filter(Boolean),
        commentCount: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        description: issue.body?.trim() ? issue.body : null,
        comments: comments.map(comment => ({
          author: comment.user?.login ?? null,
          body: comment.body ?? '',
          createdAt: comment.created_at,
        })),
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async #createIntakeComment(input: CreateIntakeCommentInput): Promise<{ id: string; url: string } | null> {
    const installationId = getGithubInstallationId(input.connection);
    const repoFullName = requireSourceId(input.sourceId, 'GitHub Intake requires a repository source.');
    const parts = splitRepoFullName(repoFullName);
    const issueNumber = parsePositiveInteger(input.issueId);
    if (!parts || issueNumber === null) return null;
    const octokit = this.getInstallationOctokit(installationId);
    try {
      const { data } = await octokit.issues.createComment({
        owner: parts.owner,
        repo: parts.repo,
        issue_number: issueNumber,
        body: input.body,
      });
      return { id: String(data.id), url: data.html_url };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  #repositoryClient(connection: IntegrationConnection, sourceId: string) {
    const installationId = getGithubInstallationId(connection);
    const parts = splitRepoFullName(sourceId);
    if (!parts) throw new Error('GitHub pull requests require an owner/repository source.');
    return { octokit: this.getInstallationOctokit(installationId), parts };
  }

  async #listPullRequests(input: InputOf<'listPullRequests'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const page = parsePositiveCursor(input.cursor);
    const response = await octokit.pulls.list({
      ...parts,
      state: input.state ?? 'open',
      per_page: LIST_PAGE_SIZE,
      page,
    });
    const pullRequests = response.data
      .filter(pr => input.includeDrafts !== false || !pr.draft)
      .map(pr => parsePullRequest(pr));
    return {
      pullRequests,
      nextCursor: response.data.length === LIST_PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getPullRequest(input: InputOf<'getPullRequest'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const pullNumber = requirePullRequestNumber(input.pullRequestId);
    try {
      const { data } = await octokit.pulls.get({ ...parts, pull_number: pullNumber });
      return parsePullRequest(data);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async #createPullRequest(input: InputOf<'createPullRequest'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.create({
      ...parts,
      title: input.title,
      body: input.body,
      base: input.baseBranch,
      head: input.headBranch,
      draft: input.draft,
    });
    return parsePullRequest(data);
  }

  async #updatePullRequest(input: InputOf<'updatePullRequest'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.update({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      title: input.title,
      body: input.body === null ? '' : input.body,
      base: input.baseBranch,
      state: input.state,
    });
    return parsePullRequest(data);
  }

  async #closePullRequest(input: InputOf<'closePullRequest'>) {
    return this.#updatePullRequest({ ...input, state: 'closed' });
  }

  async #mergePullRequest(input: InputOf<'mergePullRequest'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.merge({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      commit_title: input.commitTitle,
      commit_message: input.commitMessage,
      merge_method: input.method,
    });
    return { merged: data.merged, message: data.message, sha: data.sha ?? null };
  }

  async #listComments(input: InputOf<'listComments'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const page = parsePositiveCursor(input.cursor);
    const response = await octokit.issues.listComments({
      ...parts,
      issue_number: requirePullRequestNumber(input.pullRequestId),
      per_page: LIST_PAGE_SIZE,
      page,
    });
    return {
      comments: response.data.map(comment => parsePullRequestComment(comment)),
      nextCursor: response.data.length === LIST_PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createComment(input: InputOf<'createComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.issues.createComment({
      ...parts,
      issue_number: requirePullRequestNumber(input.pullRequestId),
      body: input.body,
    });
    return parsePullRequestComment(data);
  }

  async #updateComment(input: InputOf<'updateComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.issues.updateComment({
      ...parts,
      comment_id: requirePositiveId(input.commentId, 'comment'),
      body: input.body,
    });
    return parsePullRequestComment(data);
  }

  async #deleteComment(input: InputOf<'deleteComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    await octokit.issues.deleteComment({ ...parts, comment_id: requirePositiveId(input.commentId, 'comment') });
  }

  async #listReviews(input: InputOf<'listReviews'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const page = parsePositiveCursor(input.cursor);
    const response = await octokit.pulls.listReviews({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      per_page: LIST_PAGE_SIZE,
      page,
    });
    return {
      reviews: response.data.map(review => parseReview(review)),
      nextCursor: response.data.length === LIST_PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #getReview(input: InputOf<'getReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    try {
      const { data } = await octokit.pulls.getReview({
        ...parts,
        pull_number: requirePullRequestNumber(input.pullRequestId),
        review_id: requirePositiveId(input.reviewId, 'review'),
      });
      return parseReview(data);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async #createReview(input: InputOf<'createReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.createReview({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      body: input.body,
      commit_id: input.commitId,
      event: input.event ? reviewEventToGithub(input.event) : undefined,
    });
    return parseReview(data);
  }

  async #updateReview(input: InputOf<'updateReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.updateReview({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      review_id: requirePositiveId(input.reviewId, 'review'),
      body: input.body,
    });
    return parseReview(data);
  }

  async #submitReview(input: InputOf<'submitReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.submitReview({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      review_id: requirePositiveId(input.reviewId, 'review'),
      body: input.body,
      event: reviewEventToGithub(input.event),
    });
    return parseReview(data);
  }

  async #dismissReview(input: InputOf<'dismissReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.dismissReview({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      review_id: requirePositiveId(input.reviewId, 'review'),
      message: input.message,
    });
    return parseReview(data);
  }

  async #deletePendingReview(input: InputOf<'deletePendingReview'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    await octokit.pulls.deletePendingReview({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      review_id: requirePositiveId(input.reviewId, 'review'),
    });
  }

  async #listReviewComments(input: InputOf<'listReviewComments'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const page = parsePositiveCursor(input.cursor);
    const response = await octokit.pulls.listReviewComments({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      per_page: LIST_PAGE_SIZE,
      page,
    });
    return {
      comments: response.data.map(comment => parseReviewComment(comment)),
      nextCursor: response.data.length === LIST_PAGE_SIZE ? String(page + 1) : null,
    };
  }

  async #createReviewComment(input: InputOf<'createReviewComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const pullNumber = requirePullRequestNumber(input.pullRequestId);
    if (input.replyToId) {
      const { data } = await octokit.pulls.createReplyForReviewComment({
        ...parts,
        pull_number: pullNumber,
        comment_id: requirePositiveId(input.replyToId, 'review comment'),
        body: input.body,
      });
      return parseReviewComment(data);
    }
    if (!input.commitId || !input.path || input.line === undefined || !input.side) {
      throw new Error('A review comment requires commitId, path, line, and side unless it is a reply.');
    }
    if ((input.startLine === undefined) !== (input.startSide === undefined)) {
      throw new Error('A multi-line review comment requires both startLine and startSide.');
    }
    const { data } = await octokit.pulls.createReviewComment({
      ...parts,
      pull_number: pullNumber,
      body: input.body,
      commit_id: input.commitId,
      path: input.path,
      line: input.line,
      side: input.side.toUpperCase() as 'LEFT' | 'RIGHT',
      start_line: input.startLine,
      start_side: input.startSide?.toUpperCase() as 'LEFT' | 'RIGHT' | undefined,
    });
    return parseReviewComment(data);
  }

  async #updateReviewComment(input: InputOf<'updateReviewComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.updateReviewComment({
      ...parts,
      comment_id: requirePositiveId(input.commentId, 'review comment'),
      body: input.body,
    });
    return parseReviewComment(data);
  }

  async #deleteReviewComment(input: InputOf<'deleteReviewComment'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    await octokit.pulls.deleteReviewComment({
      ...parts,
      comment_id: requirePositiveId(input.commentId, 'review comment'),
    });
  }

  async #listRequestedReviewers(input: InputOf<'listRequestedReviewers'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.listRequestedReviewers({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
    });
    return parseRequestedReviewers(data);
  }

  async #requestReviewers(input: InputOf<'requestReviewers'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.requestReviewers({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      reviewers: input.users ?? [],
      team_reviewers: input.teams ?? [],
    });
    return parseRequestedReviewers(data);
  }

  async #removeReviewers(input: InputOf<'removeRequestedReviewers'>) {
    const { octokit, parts } = this.#repositoryClient(input.connection, input.sourceId);
    const { data } = await octokit.pulls.removeRequestedReviewers({
      ...parts,
      pull_number: requirePullRequestNumber(input.pullRequestId),
      reviewers: input.users ?? [],
      team_reviewers: input.teams ?? [],
    });
    return parseRequestedReviewers(data);
  }

  /** Add labels to an issue (deduplicated; no-op on empty/malformed input). */
  async addIssueLabels(
    installationId: number,
    repoFullName: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return;
    const uniqueLabels = [...new Set(labels.map(label => label.trim()).filter(Boolean))];
    if (uniqueLabels.length === 0) return;
    const octokit = this.getInstallationOctokit(installationId);
    await octokit.issues.addLabels({
      owner: parts.owner,
      repo: parts.repo,
      issue_number: issueNumber,
      labels: uniqueLabels,
    });
  }

  /**
   * List one page of a repo's open issues through an installation token. The
   * issues API also returns pull requests, so those are filtered out (the
   * filter can make a non-final page shorter than the page size — `nextPage`
   * is derived from the raw response length, not the filtered one).
   */
  async listRepoOpenIssues(
    installationId: number,
    repoFullName: string,
    page: number,
    options: ListRepoOpenIssuesOptions = {},
  ): Promise<IssuePage> {
    const parts = splitRepoFullName(repoFullName);
    if (!parts) return { issues: [], nextPage: null };
    const octokit = this.getInstallationOctokit(installationId);
    const response = await octokit.issues.listForRepo({
      owner: parts.owner,
      repo: parts.repo,
      state: 'open',
      labels: options.label,
      per_page: LIST_PAGE_SIZE,
      page,
    });
    const issues = response.data
      .filter(issue => !issue.pull_request)
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        author: issue.user?.login ?? null,
        labels: issue.labels.map(label => (typeof label === 'string' ? label : (label.name ?? ''))).filter(Boolean),
        comments: issue.comments,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      }));
    return { issues, nextPage: response.data.length === LIST_PAGE_SIZE ? page + 1 : null };
  }

  /**
   * Build the GitHub App install URL. `state` is carried through the install
   * flow and validated on callback.
   */
  buildInstallUrl(state: string): string {
    const url = new URL(`https://github.com/apps/${this.#slug}/installations/new`);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * Build the OAuth identify URL (authorize) used to confirm the user's
   * identity and obtain a user token for listing their installations.
   */
  buildOAuthIdentifyUrl(state: string, redirectUri: string): string {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.#clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  /** Exchange an OAuth `code` for a user access token. */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error(`GitHub OAuth token exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!data.access_token) {
      throw new Error(
        `GitHub OAuth token exchange returned no token: ${data.error_description ?? data.error ?? 'unknown'}`,
      );
    }
    return data.access_token;
  }

  /**
   * The integration's HTTP surface: the `/web/github/*` + `/auth/github/*`
   * Mastra `apiRoutes` (webhook handler, install/OAuth flow, project +
   * worktree + session operations). The factory folds these into the server's
   * `apiRoutes` when the feature is ready. Handlers operate on this instance.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    this.#storage = ctx.storage;
    return buildGithubRoutes({
      github: this,
      auth: ctx.auth,
      fleet: ctx.fleet,
      storage: ctx.factoryStorage,
      stateSigner: ctx.stateSigner,
      baseUrl: ctx.baseUrl,
      controller: ctx.controller,
      runIssueTriage: ctx.controller
        ? input => runGithubIssueTriage({ controller: ctx.controller!, input })
        : undefined,
      emitAudit: ctx.hooks?.emitAudit,
      projects: ctx.storage.projects,
    });
  }

  /**
   * Session-scoped agent tools: PR subscribe/unsubscribe for sessions bound
   * to a GitHub-backed project. Empty for sessions outside a GitHub project.
   */
  sessionTools({ requestContext }: { requestContext: RequestContext }): IntegrationTools {
    return createGithubSubscriptionTools(requestContext, this);
  }

  async postToolObserver({
    toolContext,
    requestContext,
  }: Parameters<NonNullable<FactoryIntegration['postToolObserver']>>[0]): Promise<void> {
    const pullRequestUrl = parseCreatedPullRequest(toolContext);
    if (!pullRequestUrl || !requestContext) return;
    await subscribeCurrentSessionToPullRequest(requestContext, pullRequestUrl, 'auto-gh-pr-create', this);
  }

  /** Non-secret config snapshot for system diagnostics/startup logs. */
  diagnostics(): Record<string, unknown> {
    return {
      slug: this.#slug,
      webhookSecretConfigured: this.#webhookSecret !== undefined,
    };
  }
}

interface GithubPullRequestData {
  number: number;
  title: string;
  html_url: string;
  user: { login?: string } | null;
  body?: string | null;
  state: string;
  draft?: boolean | null;
  merged?: boolean;
  merged_at?: string | null;
  mergeable?: boolean | null;
  base: { ref: string };
  head: { ref: string; sha: string };
  created_at: string;
  updated_at: string;
}

interface GithubCommentData {
  id: number;
  html_url: string;
  user: { login?: string } | null;
  body?: string | null;
  created_at: string;
  updated_at: string;
}

interface GithubReviewData {
  id: number;
  html_url?: string;
  user: { login?: string } | null;
  body?: string | null;
  state: string;
  commit_id?: string | null;
  submitted_at?: string | null;
}

interface GithubReviewCommentData extends GithubCommentData {
  path: string;
  line?: number | null;
  side?: string | null;
  commit_id: string;
  in_reply_to_id?: number | null;
}

function parsePullRequest(pr: GithubPullRequestData): PullRequest {
  return {
    id: String(pr.number),
    title: pr.title,
    url: pr.html_url,
    author: pr.user?.login ?? null,
    body: pr.body?.trim() ? pr.body : null,
    state: pr.state === 'closed' ? 'closed' : 'open',
    draft: pr.draft ?? false,
    merged: pr.merged ?? Boolean(pr.merged_at),
    mergeable: typeof pr.mergeable === 'boolean' ? pr.mergeable : null,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
  };
}

function parsePullRequestComment(comment: GithubCommentData): PullRequestComment {
  return {
    id: String(comment.id),
    url: comment.html_url,
    author: comment.user?.login ?? null,
    body: comment.body ?? '',
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

function parseReview(review: GithubReviewData): Review {
  return {
    id: String(review.id),
    url: review.html_url ?? null,
    author: review.user?.login ?? null,
    body: review.body?.trim() ? review.body : null,
    state: parseReviewState(review.state),
    commitId: review.commit_id ?? null,
    submittedAt: review.submitted_at ?? null,
  };
}

function parseReviewComment(comment: GithubReviewCommentData): ReviewComment {
  const parsed = parsePullRequestComment(comment);
  const side = comment.side?.toLowerCase();
  return {
    ...parsed,
    path: comment.path,
    line: comment.line ?? null,
    side: side === 'left' || side === 'right' ? side : null,
    commitId: comment.commit_id,
    replyToId: comment.in_reply_to_id ? String(comment.in_reply_to_id) : null,
  };
}

function parseRequestedReviewers(data: {
  users?: Array<{ login?: string }> | null;
  teams?: Array<{ slug?: string }> | null;
  requested_reviewers?: Array<{ login?: string }> | null;
  requested_teams?: Array<{ slug?: string }> | null;
}) {
  return {
    users: (data.users ?? data.requested_reviewers ?? []).flatMap(user => (user.login ? [user.login] : [])),
    teams: (data.teams ?? data.requested_teams ?? []).flatMap(team => (team.slug ? [team.slug] : [])),
  };
}

function parseReviewState(state: string): Review['state'] {
  if (state === 'PENDING') return 'pending';
  if (state === 'COMMENTED') return 'commented';
  if (state === 'APPROVED') return 'approved';
  if (state === 'CHANGES_REQUESTED') return 'changes-requested';
  if (state === 'DISMISSED') return 'dismissed';
  throw new Error(`Unsupported GitHub review state: ${state}`);
}

function reviewEventToGithub(event: Exclude<InputOf<'createReview'>['event'], undefined>) {
  if (event === 'approve') return 'APPROVE' as const;
  if (event === 'request-changes') return 'REQUEST_CHANGES' as const;
  return 'COMMENT' as const;
}

function requirePullRequestNumber(value: string): number {
  return requirePositiveId(value, 'pull request');
}

function requirePositiveId(value: string, resource: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed === null) throw new Error(`GitHub ${resource} id must be a positive integer.`);
  return parsed;
}

function getGithubInstallationId(connection: IntegrationConnection): number {
  if (connection.type !== 'app-installation') {
    throw new Error('GitHub capabilities require an app-installation connection.');
  }
  return connection.installationId;
}

function getSingleSourceId(sourceIds: string[], message: string): string {
  if (sourceIds.length !== 1) throw new Error(message);
  return sourceIds[0]!;
}

function normalizeLabels(labels: string[] | undefined): string[] {
  return [...new Set((labels ?? []).map(label => label.trim()).filter(Boolean))];
}

function requireSourceId(sourceId: string | undefined, message: string): string {
  if (!sourceId) throw new Error(message);
  return sourceId;
}

function parsePositiveCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 1;
  const page = parsePositiveInteger(cursor);
  if (page === null) throw new Error('GitHub cursor must be a positive page number.');
  return page;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/** Split an `owner/name` full name into its parts, or `null` when malformed. */
function splitRepoFullName(repoFullName: string): { owner: string; repo: string } | null {
  const slash = repoFullName.indexOf('/');
  if (slash <= 0 || slash === repoFullName.length - 1) return null;
  return { owner: repoFullName.slice(0, slash), repo: repoFullName.slice(slash + 1) };
}
