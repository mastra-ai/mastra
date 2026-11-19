import { Octokit } from '@octokit/rest';

import type { GithubDependabotAlert } from '../../dependabot/sync.js';
import type { GithubRepositoryPermission } from '../../github/integration.js';
import { REVIEW_STATUS_COMMENT_MARKER } from '../../github/review-status-comment.js';
import { platformErrorStatus } from '../platform-connect.js';
import {
  isPullRequestIssue,
  toComment,
  toIssue,
  toPullRequest,
  toReview,
  toReviewComment,
  toReviewers,
  withAttribution,
} from './connect-adapters.js';
import type {
  RawComment,
  RawIssue,
  RawPullRequest,
  RawReview,
  RawReviewComment,
  RawReviewers,
} from './connect-adapters.js';
import type { GithubConnectTokens } from './connect-tokens.js';
import type { LegacyInstallationRepository } from './legacy-transport.js';
import { splitRepository } from './legacy-transport.js';
import type { PlatformGithubConnectInstallation } from './mode.js';
import type {
  GithubCall,
  GithubCheckRunCreate,
  GithubComment,
  GithubIssue,
  GithubPage,
  GithubPullRequest,
  GithubReview,
  GithubReviewComment,
  GithubReviewCommentCreate,
  GithubReviewEvent,
  GithubReviewers,
  GithubTransport,
} from './transport.js';

const GITHUB_API_URL = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 15_000;
const COLLABORATOR_PERMISSION_LOOKUP_TIMEOUT_MS = 10_000;

/** A GitHub REST failure, carrying GitHub's status. */
export class GithubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

/** The HTTP status of a failed GitHub call, from either transport. */
export function githubErrorStatus(error: unknown): number | undefined {
  return platformErrorStatus(error) ?? (error instanceof GithubApiError ? error.status : undefined);
}

/**
 * A pending human review can only be changed by its author, through that
 * author's own GitHub connection (as the platform requires today).
 */
export class GithubReviewAuthorRequiredError extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'GithubReviewAuthorRequiredError';
  }
}

/** Which token a call runs with. */
export type GithubTokenClass = 'default' | 'review' | 'user';

export interface ConnectGithubTransportOptions {
  /** The switched org the installation belongs to; users' own tokens are looked up in it. */
  orgId: string;
  installation: PlatformGithubConnectInstallation;
  tokens: GithubConnectTokens;
  /** Whether a login is one of Factory's own GitHub apps. */
  isFactoryLogin: (login: string | null | undefined) => boolean;
  /** GitHub REST base URL; tests point it at a stub. */
  baseUrl?: string;
  /** Observes which token class served each call (tests). */
  onToken?: (event: { operation: string; tokenClass: GithubTokenClass }) => void;
}

type Token = { tokenClass: GithubTokenClass; key: string; value: string };

/**
 * Platform GitHub for an org that switched to the Mastra Factory apps: calls
 * GitHub directly through Octokit. Reviews (writes, reads that must see the
 * app's pending review, review comments, the review-status comment, check
 * runs) run as `factory-reviews-github`; everything else as `factory-github`.
 * A write made for a person uses that person's own GitHub token (their
 * end-user connection, else their pasted PAT) when they have one; otherwise it runs as the app and names them in the body, as
 * the platform does.
 */
export class ConnectGithubTransport implements GithubTransport {
  readonly kind = 'connect';
  readonly installation: PlatformGithubConnectInstallation;
  readonly #orgId: string;
  readonly #tokens: GithubConnectTokens;
  readonly #isFactoryLogin: (login: string | null | undefined) => boolean;
  readonly #baseUrl: string;
  readonly #onToken: ConnectGithubTransportOptions['onToken'];
  readonly #logins = new Map<string, string>();

  constructor(options: ConnectGithubTransportOptions) {
    this.installation = options.installation;
    this.#orgId = options.orgId;
    this.#tokens = options.tokens;
    this.#isFactoryLogin = options.isFactoryLogin;
    this.#baseUrl = (options.baseUrl ?? GITHUB_API_URL).replace(/\/+$/, '');
    this.#onToken = options.onToken;
  }

  // —— Installation ——

  /** Every repository the `factory-github` installation can reach. */
  async listInstallationRepositories(): Promise<LegacyInstallationRepository[]> {
    const repositories: LegacyInstallationRepository[] = [];
    for (let page = 1; ; page++) {
      const data = await this.#run('listInstallationRepositories', 'default', undefined, octokit =>
        this.#get<{ repositories: RawRepository[] }>(octokit, 'GET /installation/repositories', {
          per_page: 100,
          page,
        }),
      );
      repositories.push(...data.repositories.map(toRepository));
      if (data.repositories.length < 100) return repositories;
    }
  }

  // —— Pull requests ——

  async getPullRequest(call: GithubCall, number: number): Promise<GithubPullRequest> {
    const raw = await this.#read(call, 'getPullRequest', 'default', octokit =>
      this.#get<RawPullRequest>(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        ...repo(call),
        pull_number: number,
      }),
    );
    return toPullRequest(raw);
  }

  async listPullRequests(call: GithubCall, query: GithubPage & { state: string }): Promise<GithubPullRequest[]> {
    const raw = await this.#read(call, 'listPullRequests', 'default', octokit =>
      this.#get<RawPullRequest[]>(octokit, 'GET /repos/{owner}/{repo}/pulls', {
        ...repo(call),
        state: query.state,
        page: query.page,
        per_page: query.perPage,
      }),
    );
    return raw.map(toPullRequest);
  }

  async createPullRequest(
    call: GithubCall,
    body: { head: string; base: string; title: string; body?: string; draft?: boolean },
  ): Promise<GithubPullRequest> {
    const raw = await this.#write(call, 'createPullRequest', 'default', (octokit, attribution) =>
      this.#get<RawPullRequest>(octokit, 'POST /repos/{owner}/{repo}/pulls', {
        ...repo(call),
        head: body.head,
        base: body.base,
        title: body.title,
        ...defined('body', withAttribution(body.body, attribution)),
        ...defined('draft', body.draft),
      }),
    );
    return toPullRequest(raw);
  }

  async updatePullRequest(
    call: GithubCall,
    number: number,
    body: { title?: string; body?: string; base?: string; state?: 'open' | 'closed' },
  ): Promise<GithubPullRequest> {
    const raw = await this.#write(call, 'updatePullRequest', 'default', (octokit, attribution) =>
      this.#get<RawPullRequest>(octokit, 'PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        ...repo(call),
        pull_number: number,
        ...defined('title', body.title),
        ...defined('body', body.body !== undefined ? withAttribution(body.body, attribution) : undefined),
        ...defined('base', body.base),
        ...defined('state', body.state),
      }),
    );
    return toPullRequest(raw);
  }

  async mergePullRequest(
    call: GithubCall,
    number: number,
    body: { commitTitle?: string; commitMessage?: string; method?: 'merge' | 'squash' | 'rebase' },
  ): Promise<{ merged: boolean; message: string; sha: string | null }> {
    const raw = await this.#write(call, 'mergePullRequest', 'default', octokit =>
      this.#get<{ merged: boolean; message: string; sha?: string | null }>(
        octokit,
        'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
        {
          ...repo(call),
          pull_number: number,
          ...defined('commit_title', body.commitTitle),
          ...defined('commit_message', body.commitMessage),
          ...defined('merge_method', body.method),
        },
      ),
    );
    return { merged: raw.merged, message: raw.message, sha: raw.sha ?? null };
  }

  // —— Issues ——

  async getIssue(call: GithubCall, number: number): Promise<GithubIssue> {
    const raw = await this.#read(call, 'getIssue', 'default', octokit =>
      this.#get<RawIssue>(octokit, 'GET /repos/{owner}/{repo}/issues/{issue_number}', {
        ...repo(call),
        issue_number: number,
      }),
    );
    return toIssue(raw);
  }

  async listIssues(call: GithubCall, query: GithubPage & { state: 'open'; labels?: string[] }): Promise<GithubIssue[]> {
    const raw = await this.#read(call, 'listIssues', 'default', octokit =>
      this.#get<RawIssue[]>(octokit, 'GET /repos/{owner}/{repo}/issues', {
        ...repo(call),
        state: query.state,
        page: query.page,
        per_page: query.perPage,
        ...(query.labels && query.labels.length > 0 ? { labels: query.labels.join(',') } : {}),
      }),
    );
    return raw.filter(issue => !isPullRequestIssue(issue)).map(toIssue);
  }

  async updateIssue(
    call: GithubCall,
    number: number,
    body: { state: 'open' | 'closed'; stateReason?: 'completed' | 'not_planned' },
  ): Promise<GithubIssue> {
    const raw = await this.#write(call, 'updateIssue', 'default', octokit =>
      this.#get<RawIssue>(octokit, 'PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        ...repo(call),
        issue_number: number,
        state: body.state,
        ...defined('state_reason', body.stateReason),
      }),
    );
    return toIssue(raw);
  }

  async addIssueLabels(call: GithubCall, number: number, labels: string[]): Promise<string[]> {
    const raw = await this.#read(call, 'addIssueLabels', 'default', octokit =>
      this.#get<Array<{ name: string }>>(octokit, 'POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
        ...repo(call),
        issue_number: number,
        labels,
      }),
    );
    return raw.map(label => label.name);
  }

  async removeIssueLabel(call: GithubCall, number: number, label: string): Promise<void> {
    await this.#read(call, 'removeIssueLabel', 'default', octokit =>
      this.#get(octokit, 'DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
        ...repo(call),
        issue_number: number,
        name: label,
      }),
    );
  }

  // —— Issue and pull request conversation comments ——

  async listIssueComments(
    call: GithubCall,
    number: number,
    query: Partial<GithubPage> & { perPage: number },
  ): Promise<GithubComment[]> {
    const raw = await this.#read(call, 'listIssueComments', 'default', octokit =>
      this.#get<RawComment[]>(octokit, 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        ...repo(call),
        issue_number: number,
        per_page: query.perPage,
        ...defined('page', query.page),
      }),
    );
    return raw.map(toComment);
  }

  async createIssueComment(call: GithubCall, number: number, body: string): Promise<GithubComment> {
    const raw = await this.#write(call, 'createIssueComment', commentClass(body), (octokit, attribution) =>
      this.#get<RawComment>(octokit, 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        ...repo(call),
        issue_number: number,
        body: withAttribution(body, attribution) ?? body,
      }),
    );
    return toComment(raw);
  }

  async updateIssueComment(call: GithubCall, commentId: number, body: string): Promise<GithubComment> {
    const raw = await this.#write(call, 'updateIssueComment', commentClass(body), octokit =>
      this.#get<RawComment>(octokit, 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
        ...repo(call),
        comment_id: commentId,
        body,
      }),
    );
    return toComment(raw);
  }

  async deleteIssueComment(call: GithubCall, commentId: number): Promise<void> {
    await this.#write(call, 'deleteIssueComment', 'default', octokit =>
      this.#get(octokit, 'DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}', {
        ...repo(call),
        comment_id: commentId,
      }),
    );
  }

  // —— Reviews ——

  async listReviews(call: GithubCall, number: number, query: GithubPage): Promise<GithubReview[]> {
    const raw = await this.#read(call, 'listReviews', 'review', octokit =>
      this.#get<RawReview[]>(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        ...repo(call),
        pull_number: number,
        page: query.page,
        per_page: query.perPage,
      }),
    );
    return raw.map(toReview);
  }

  async getReview(call: GithubCall, number: number, reviewId: number): Promise<GithubReview> {
    const review = await this.#findReview(call, number, reviewId);
    if (!review) throw new GithubApiError(404, `Review ${reviewId} not found`);
    return toReview(review);
  }

  async createReview(
    call: GithubCall,
    number: number,
    body: { body?: string; commitId?: string; event?: GithubReviewEvent },
  ): Promise<GithubReview> {
    const raw = await this.#write(call, 'createReview', 'review', (octokit, attribution) =>
      this.#get<RawReview>(octokit, 'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        ...repo(call),
        pull_number: number,
        ...defined('body', body.body !== undefined ? withAttribution(body.body, attribution) : undefined),
        ...defined('commit_id', body.commitId),
        ...defined('event', body.event),
      }),
    );
    return toReview(raw);
  }

  async updateReview(call: GithubCall, number: number, reviewId: number, body: string): Promise<GithubReview> {
    const raw = await this.#reviewWrite(call, number, reviewId, 'updateReview', (octokit, attribution) =>
      this.#get<RawReview>(octokit, 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}', {
        ...repo(call),
        pull_number: number,
        review_id: reviewId,
        body: withAttribution(body, attribution) ?? body,
      }),
    );
    return toReview(raw);
  }

  async submitReview(
    call: GithubCall,
    number: number,
    reviewId: number,
    body: { body?: string; event: GithubReviewEvent },
  ): Promise<GithubReview> {
    const raw = await this.#reviewWrite(call, number, reviewId, 'submitReview', (octokit, attribution) =>
      this.#get<RawReview>(octokit, 'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events', {
        ...repo(call),
        pull_number: number,
        review_id: reviewId,
        event: body.event,
        ...defined('body', body.body !== undefined ? withAttribution(body.body, attribution) : undefined),
      }),
    );
    return toReview(raw);
  }

  async dismissReview(call: GithubCall, number: number, reviewId: number, message: string): Promise<GithubReview> {
    const raw = await this.#write(call, 'dismissReview', 'review', (octokit, attribution) =>
      this.#get<RawReview>(octokit, 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals', {
        ...repo(call),
        pull_number: number,
        review_id: reviewId,
        message: withAttribution(message, attribution) ?? message,
      }),
    );
    return toReview(raw);
  }

  async deletePendingReview(call: GithubCall, number: number, reviewId: number): Promise<void> {
    await this.#reviewWrite(call, number, reviewId, 'deletePendingReview', octokit =>
      this.#get(octokit, 'DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}', {
        ...repo(call),
        pull_number: number,
        review_id: reviewId,
      }),
    );
  }

  // —— Review comments ——

  async listReviewComments(call: GithubCall, number: number, query: GithubPage): Promise<GithubReviewComment[]> {
    const raw = await this.#read(call, 'listReviewComments', 'review', octokit =>
      this.#get<RawReviewComment[]>(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
        ...repo(call),
        pull_number: number,
        page: query.page,
        per_page: query.perPage,
      }),
    );
    return raw.map(toReviewComment);
  }

  async createReviewComment(
    call: GithubCall,
    number: number,
    body: GithubReviewCommentCreate,
  ): Promise<GithubReviewComment> {
    const raw = await this.#write(call, 'createReviewComment', 'review', (octokit, attribution) => {
      const text = withAttribution(body.body, attribution) ?? body.body;
      if ('replyToId' in body) {
        return this.#get<RawReviewComment>(
          octokit,
          'POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies',
          { ...repo(call), pull_number: number, comment_id: body.replyToId, body: text },
        );
      }
      return this.#get<RawReviewComment>(octokit, 'POST /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
        ...repo(call),
        pull_number: number,
        body: text,
        commit_id: body.commitId,
        path: body.path,
        line: body.line,
        side: body.side,
        ...defined('start_line', body.startLine),
        ...(body.startSide ? { start_side: body.startSide } : {}),
      });
    });
    return toReviewComment(raw);
  }

  async updateReviewComment(call: GithubCall, commentId: number, body: string): Promise<GithubReviewComment> {
    const raw = await this.#write(call, 'updateReviewComment', 'review', octokit =>
      this.#get<RawReviewComment>(octokit, 'PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}', {
        ...repo(call),
        comment_id: commentId,
        body,
      }),
    );
    return toReviewComment(raw);
  }

  async deleteReviewComment(call: GithubCall, commentId: number): Promise<void> {
    await this.#write(call, 'deleteReviewComment', 'review', octokit =>
      this.#get(octokit, 'DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}', {
        ...repo(call),
        comment_id: commentId,
      }),
    );
  }

  // —— Requested reviewers ——

  async listRequestedReviewers(call: GithubCall, number: number): Promise<GithubReviewers> {
    const raw = await this.#read(call, 'listRequestedReviewers', 'default', octokit =>
      this.#get<RawReviewers>(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
        ...repo(call),
        pull_number: number,
      }),
    );
    return toReviewers(raw);
  }

  async requestReviewers(
    call: GithubCall,
    number: number,
    reviewers: Partial<GithubReviewers>,
  ): Promise<GithubReviewers> {
    const raw = await this.#write(call, 'requestReviewers', 'default', octokit =>
      this.#get<RawReviewers>(octokit, 'POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
        ...repo(call),
        pull_number: number,
        reviewers: reviewers.users ?? [],
        team_reviewers: reviewers.teams ?? [],
      }),
    );
    return toReviewers(raw);
  }

  async removeRequestedReviewers(
    call: GithubCall,
    number: number,
    reviewers: Partial<GithubReviewers>,
  ): Promise<GithubReviewers> {
    const raw = await this.#write(call, 'removeRequestedReviewers', 'default', octokit =>
      this.#get<RawReviewers>(octokit, 'DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers', {
        ...repo(call),
        pull_number: number,
        reviewers: reviewers.users ?? [],
        team_reviewers: reviewers.teams ?? [],
      }),
    );
    return toReviewers(raw);
  }

  // —— Checks, permissions, alerts ——

  /** Check runs can only be created by a GitHub App, so they always run as the Reviews app. */
  async createCheckRun(call: GithubCall, body: GithubCheckRunCreate): Promise<{ id: number; htmlUrl: string }> {
    const raw = await this.#read(call, 'createCheckRun', 'review', octokit =>
      this.#get<{ id: number; html_url: string }>(octokit, 'POST /repos/{owner}/{repo}/check-runs', {
        ...repo(call),
        name: body.name,
        head_sha: body.headSha,
        status: body.status,
        ...defined('conclusion', body.conclusion),
        output: {
          title: body.output.title,
          summary: body.output.summary,
          ...defined('text', body.output.text),
        },
      }),
    );
    return { id: raw.id, htmlUrl: raw.html_url };
  }

  async getCollaboratorPermission(call: GithubCall, username: string): Promise<GithubRepositoryPermission> {
    const signal = AbortSignal.timeout(COLLABORATOR_PERMISSION_LOOKUP_TIMEOUT_MS);
    const raw = await this.#read({ ...call, signal }, 'getCollaboratorPermission', 'default', octokit =>
      this.#get<{ permission: GithubRepositoryPermission }>(
        octokit,
        'GET /repos/{owner}/{repo}/collaborators/{username}/permission',
        { ...repo(call), username },
      ),
    );
    return raw.permission;
  }

  async listDependabotAlerts(call: GithubCall, state: 'open' | 'closed'): Promise<GithubDependabotAlert[]> {
    // Same query the legacy route sends GitHub.
    return this.#read(call, 'listDependabotAlerts', 'default', octokit =>
      this.#get<GithubDependabotAlert[]>(octokit, 'GET /repos/{owner}/{repo}/dependabot/alerts', {
        ...repo(call),
        state: state === 'open' ? 'open' : 'fixed,dismissed,auto_dismissed',
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      }),
    );
  }

  // —— The acting user ——

  /** The user's GitHub login, when they have their own GitHub token. */
  async userLogin(userId: string, signal?: AbortSignal): Promise<string | null> {
    const user = await this.#tokens.userToken(this.#orgId, userId);
    if (!user) return null;
    return this.#login(user.token, signal);
  }

  /** Runs `fn` with the user's own token; null when they have none. */
  async asUser<T>(
    userId: string,
    operation: string,
    fn: (octokit: Octokit) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const user = await this.#tokens.userToken(this.#orgId, userId);
    if (!user) return null;
    return this.#withToken(operation, { tokenClass: 'user', key: userId, value: user.token }, signal, fn);
  }

  /** Runs `fn` with the `factory-github` installation's token. */
  asApp<T>(operation: string, fn: (octokit: Octokit) => Promise<T>, signal?: AbortSignal): Promise<T> {
    return this.#run(operation, 'default', signal, fn);
  }

  // —— Token routing ——

  /** A call that never acts for a person. */
  #read<T>(
    call: GithubCall,
    operation: string,
    tokenClass: 'default' | 'review',
    fn: (octokit: Octokit) => Promise<T>,
  ) {
    return this.#run(operation, tokenClass, call.signal, fn);
  }

  /**
   * A write, as the app, naming the acting user in the body. This is what the
   * legacy platform does for every write a person's identity doesn't change on
   * GitHub, and it keeps Factory's own comments and pull requests recognisable
   * to its self-loop guards.
   */
  async #write<T>(
    call: GithubCall,
    operation: string,
    tokenClass: 'default' | 'review',
    fn: (octokit: Octokit, attribution: string | undefined) => Promise<T>,
  ): Promise<T> {
    const attribution = call.actingUserId ? await this.#attribution(call.actingUserId, call.signal) : undefined;
    return this.#run(operation, tokenClass, call.signal, octokit => fn(octokit, attribution));
  }

  /** How a write names the person it was made for: their GitHub login when known, else their Factory id. */
  async #attribution(userId: string, signal: AbortSignal | undefined): Promise<string> {
    const user = await this.#tokens.userToken(this.#orgId, userId).catch(() => null);
    const login = user ? await this.#login(user.token, signal).catch(() => null) : null;
    return `@${login ?? userId}`;
  }

  /**
   * A write to one existing review. Factory's own reviews are changed by the
   * Reviews app; a person's pending review only by that person.
   */
  async #reviewWrite<T>(
    call: GithubCall,
    number: number,
    reviewId: number,
    operation: string,
    fn: (octokit: Octokit, attribution: string | undefined) => Promise<T>,
  ): Promise<T> {
    const review = await this.#findReview(call, number, reviewId);
    if (!review) {
      throw new GithubApiError(
        404,
        'Review not found. For a pending human review, its author must connect GitHub or add a GitHub token in Factory. A pending review the Mastra GitHub App started before the switch to the Mastra Factory apps can no longer be changed.',
      );
    }
    const author = review.user?.login;
    if (this.#isFactoryLogin(author)) {
      const attribution = call.actingUserId ? await this.#attribution(call.actingUserId, call.signal) : undefined;
      return this.#run(operation, 'review', call.signal, octokit => fn(octokit, attribution));
    }
    const user = call.actingUserId ? await this.#tokens.userToken(this.#orgId, call.actingUserId) : null;
    if (!user)
      throw new GithubReviewAuthorRequiredError(
        'Only the review author can modify this review: connect GitHub or add a GitHub token in Factory.',
      );
    const login = await this.#login(user.token, call.signal);
    if (!author || login.toLowerCase() !== author.toLowerCase()) {
      throw new GithubReviewAuthorRequiredError(
        'Only the original review author can update, submit, or delete this review, using their own GitHub connection or token.',
      );
    }
    return this.#withToken(
      operation,
      { tokenClass: 'user', key: call.actingUserId!, value: user.token },
      call.signal,
      octokit => fn(octokit, undefined),
    );
  }

  /** The Reviews app sees its own pending reviews; a person's pending review is visible only to them. */
  async #findReview(call: GithubCall, number: number, reviewId: number): Promise<RawReview | null> {
    const read = (octokit: Octokit) =>
      this.#get<RawReview>(octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}', {
        ...repo(call),
        pull_number: number,
        review_id: reviewId,
      });
    const found = await orNull(this.#run('getReview', 'review', call.signal, read));
    if (found || !call.actingUserId) return found;
    return orNull(this.asUser(call.actingUserId, 'getReview', read, call.signal));
  }

  async #run<T>(
    operation: string,
    tokenClass: 'default' | 'review',
    signal: AbortSignal | undefined,
    fn: (octokit: Octokit) => Promise<T>,
  ): Promise<T> {
    const connectionId =
      tokenClass === 'review' ? this.installation.reviewsConnectionId : this.installation.connectionId;
    const value = await this.#tokens.installationToken(connectionId);
    return this.#withToken(operation, { tokenClass, key: connectionId, value }, signal, fn);
  }

  /** Runs once; when GitHub rejects the token, drops it and retries once with a fresh one. */
  async #withToken<T>(
    operation: string,
    token: Token,
    signal: AbortSignal | undefined,
    fn: (octokit: Octokit) => Promise<T>,
  ): Promise<T> {
    this.#onToken?.({ operation, tokenClass: token.tokenClass });
    try {
      return await this.#call(token.value, signal, fn);
    } catch (error) {
      if (!(error instanceof GithubApiError) || error.status !== 401) throw error;
      const fresh = await this.#refresh(token);
      return this.#call(fresh, signal, fn);
    }
  }

  async #refresh(token: Token): Promise<string> {
    if (token.tokenClass === 'user') {
      this.#tokens.invalidateUser(this.#orgId, token.key);
      const user = await this.#tokens.userToken(this.#orgId, token.key);
      if (!user) throw new GithubApiError(401, 'Your GitHub connection or token is no longer valid.');
      return user.token;
    }
    this.#tokens.invalidateInstallation(token.key);
    return this.#tokens.installationToken(token.key);
  }

  async #call<T>(token: string, signal: AbortSignal | undefined, fn: (octokit: Octokit) => Promise<T>): Promise<T> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const octokit = new Octokit({
      auth: token,
      baseUrl: this.#baseUrl,
      // Failures are thrown to the caller; request logging would duplicate them.
      log: { debug: () => {}, info: () => {}, warn: console.warn, error: () => {} },
      request: { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
    });
    try {
      return await fn(octokit);
    } catch (error) {
      throw toGithubApiError(error);
    }
  }

  async #get<T = unknown>(octokit: Octokit, route: string, params: Record<string, unknown>): Promise<T> {
    const response = await octokit.request(route, params);
    return response.data as T;
  }

  async #login(token: string, signal?: AbortSignal): Promise<string> {
    const cached = this.#logins.get(token);
    if (cached) return cached;
    const user = await this.#call(token, signal, octokit => this.#get<{ login: string }>(octokit, 'GET /user', {}));
    this.#logins.clear();
    this.#logins.set(token, user.login);
    return user.login;
  }
}

type RawRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  html_url: string;
  pushed_at?: string | null;
  owner: { login: string; type?: string };
};

function toRepository(raw: RawRepository): LegacyInstallationRepository {
  return {
    id: raw.id,
    owner: raw.owner.login,
    name: raw.name,
    fullName: raw.full_name,
    private: raw.private,
    defaultBranch: raw.default_branch ?? 'main',
    htmlUrl: raw.html_url,
    pushedAt: raw.pushed_at ?? null,
  };
}

function repo(call: GithubCall): { owner: string; repo: string } {
  return splitRepository(call.repository);
}

/** The review-status comment is the Reviews app's; every other comment is `factory-github`'s. */
function commentClass(body: string): 'default' | 'review' {
  return body.includes(REVIEW_STATUS_COMMENT_MARKER) ? 'review' : 'default';
}

function defined<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

async function orNull<T>(promise: Promise<T | null>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) return null;
    throw error;
  }
}

/** An Octokit failure as a `GithubApiError` carrying GitHub's status; anything else unchanged. */
export function toGithubApiError(error: unknown): unknown {
  if (error instanceof GithubApiError) return error;
  if (error instanceof Error && typeof (error as { status?: unknown }).status === 'number') {
    return new GithubApiError((error as unknown as { status: number }).status, error.message);
  }
  return error;
}
