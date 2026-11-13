import type { ConnectClient } from '@mastra/connect';

import type { GithubDependabotAlert } from '../../dependabot/sync.js';
import type { GithubRepositoryPermission } from '../../github/integration.js';
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

export const LEGACY_API_PREFIX = '/v1/server';

/** Bound on the shared collaborator lookup; callers race their own signal against it. */
const COLLABORATOR_PERMISSION_LOOKUP_TIMEOUT_MS = 10_000;

/** A legacy GitHub App installation as the platform lists it. */
export type LegacyGithubInstallation = {
  installationId: number;
  accountLogin: string;
  accountType: string;
  suspendedAt: string | null;
  usable: boolean;
};

/** Why Platform withheld a personal-account installation from this org's credentials. */
export type LegacyHiddenPersonalInstallReason = 'personal_install_requires_single_member_org';

export type LegacyGithubUserConnection = {
  connected: boolean;
  githubUsername: string | null;
  reason?: 'token-invalid' | 'no-accessible-installation' | 'missing-permissions' | 'verification-unavailable' | null;
};

export type LegacyInstallationRepository = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt?: string | null;
};

/**
 * Today's platform GitHub routes (`/v1/server/github*`), unchanged: every
 * request, header and response is what Platform GitHub sent and received
 * before the transport existed. Writes made for a user carry
 * `x-acting-user-id`; the platform resolves the credential and attribution.
 */
export class LegacyGithubTransport implements GithubTransport {
  readonly kind = 'legacy';
  readonly #client: ConnectClient;

  constructor(client: ConnectClient) {
    this.#client = client;
  }

  // —— GitHub App routes, legacy only ——

  async listInstallations(): Promise<{
    installations: LegacyGithubInstallation[];
    /** Platform sends null when it withholds nothing. */
    hiddenPersonalInstallReason?: LegacyHiddenPersonalInstallReason | null;
  }> {
    return this.#client.request('GET', `${LEGACY_API_PREFIX}/github-app/installations`);
  }

  /**
   * An installation's repositories. With a `query` or `limit`, the platform
   * searches or trims the listing, most recently pushed first.
   */
  async listInstallationRepositories(
    installationId: number,
    search?: { query?: string; limit?: number },
  ): Promise<LegacyInstallationRepository[]> {
    const params = new URLSearchParams();
    if (search?.query) params.set('q', search.query.slice(0, 100));
    if (search?.limit) params.set('limit', String(search.limit));
    const query = params.size > 0 ? `?${params}` : '';
    const result = await this.#client.request<{ repositories: LegacyInstallationRepository[] }>(
      'GET',
      `${LEGACY_API_PREFIX}/github-app/installations/${installationId}/repositories${query}`,
    );
    return result.repositories;
  }

  /** A token for at most ten named repositories of one installation. */
  async mintRepositoryToken(
    installationId: number,
    repositories: string[],
    permissions: Record<string, string>,
  ): Promise<string> {
    const { token } = await this.#client.request<{ token: string }>(
      'POST',
      `${LEGACY_API_PREFIX}/github-app/installations/${installationId}/token`,
      { body: { repositories, permissions } },
    );
    return token;
  }

  async installUrl(query: URLSearchParams): Promise<string> {
    const { url } = await this.#client.request<{ url: string }>(
      'GET',
      `${LEGACY_API_PREFIX}/github-app/install-url?${query}`,
    );
    return url;
  }

  async authenticateUrl(query: URLSearchParams): Promise<string> {
    const { url } = await this.#client.request<{ url: string }>(
      'GET',
      `${LEGACY_API_PREFIX}/github-app/authenticate?${query}`,
    );
    return url;
  }

  userConnection(userId: string): Promise<LegacyGithubUserConnection> {
    return this.#client.request(
      'GET',
      `${LEGACY_API_PREFIX}/github-app/user-connection?${new URLSearchParams({ userId })}`,
    );
  }

  // —— Repository operations ——

  getPullRequest(call: GithubCall, number: number): Promise<GithubPullRequest> {
    return this.#request('GET', repositoryPath(call, `pulls/${number}`));
  }

  async listPullRequests(call: GithubCall, query: GithubPage & { state: string }): Promise<GithubPullRequest[]> {
    const params = new URLSearchParams({
      state: query.state,
      page: String(query.page),
      per_page: String(query.perPage),
    });
    const result = await this.#request<{ pullRequests: GithubPullRequest[] }>(
      'GET',
      `${repositoryPath(call, 'pulls')}?${params}`,
    );
    return result.pullRequests;
  }

  createPullRequest(
    call: GithubCall,
    body: { head: string; base: string; title: string; body?: string; draft?: boolean },
  ): Promise<GithubPullRequest> {
    return this.#request('POST', repositoryPath(call, 'pulls'), { body, ...actingUser(call) });
  }

  updatePullRequest(
    call: GithubCall,
    number: number,
    body: { title?: string; body?: string; base?: string; state?: 'open' | 'closed' },
  ): Promise<GithubPullRequest> {
    return this.#request('PATCH', repositoryPath(call, `pulls/${number}`), { body, ...actingUser(call) });
  }

  mergePullRequest(
    call: GithubCall,
    number: number,
    body: { commitTitle?: string; commitMessage?: string; method?: 'merge' | 'squash' | 'rebase' },
  ): Promise<{ merged: boolean; message: string; sha: string | null }> {
    return this.#request('PUT', repositoryPath(call, `pulls/${number}/merge`), { body, ...actingUser(call) });
  }

  getIssue(call: GithubCall, number: number): Promise<GithubIssue> {
    return this.#request('GET', repositoryPath(call, `issues/${number}`));
  }

  async listIssues(call: GithubCall, query: GithubPage & { state: 'open'; labels?: string[] }): Promise<GithubIssue[]> {
    const params = new URLSearchParams({
      state: query.state,
      page: String(query.page),
      per_page: String(query.perPage),
    });
    if (query.labels && query.labels.length > 0) params.set('label', query.labels.join(','));
    const result = await this.#request<{ issues: GithubIssue[] }>('GET', `${repositoryPath(call, 'issues')}?${params}`);
    return result.issues;
  }

  updateIssue(
    call: GithubCall,
    number: number,
    body: { state: 'open' | 'closed'; stateReason?: 'completed' | 'not_planned' },
  ): Promise<GithubIssue> {
    return this.#request('PATCH', repositoryPath(call, `issues/${number}`), {
      body: { state: body.state, ...(body.stateReason ? { state_reason: body.stateReason } : {}) },
      ...actingUser(call),
    });
  }

  async addIssueLabels(call: GithubCall, number: number, labels: string[]): Promise<string[]> {
    const result = await this.#request<{ labels: string[] }>('POST', repositoryPath(call, `issues/${number}/labels`), {
      body: { labels },
    });
    return result.labels;
  }

  async removeIssueLabel(call: GithubCall, number: number, label: string): Promise<void> {
    await this.#request('DELETE', repositoryPath(call, `issues/${number}/labels/${encodeURIComponent(label)}`));
  }

  async listIssueComments(
    call: GithubCall,
    number: number,
    query: Partial<GithubPage> & { perPage: number },
  ): Promise<GithubComment[]> {
    const params =
      query.page === undefined
        ? `per_page=${query.perPage}`
        : new URLSearchParams({ page: String(query.page), per_page: String(query.perPage) }).toString();
    const result = await this.#request<{ comments: GithubComment[] }>(
      'GET',
      `${repositoryPath(call, `issues/${number}/comments`)}?${params}`,
    );
    return result.comments;
  }

  createIssueComment(call: GithubCall, number: number, body: string): Promise<GithubComment> {
    return this.#request('POST', repositoryPath(call, `issues/${number}/comments`), {
      body: { body },
      ...actingUser(call),
    });
  }

  updateIssueComment(call: GithubCall, commentId: number, body: string): Promise<GithubComment> {
    return this.#request('PATCH', repositoryPath(call, `issues/comments/${commentId}`), {
      body: { body },
      ...actingUser(call),
    });
  }

  async deleteIssueComment(call: GithubCall, commentId: number): Promise<void> {
    await this.#request('DELETE', repositoryPath(call, `issues/comments/${commentId}`), { ...actingUser(call) });
  }

  async listReviews(call: GithubCall, number: number, query: GithubPage): Promise<GithubReview[]> {
    const result = await this.#request<{ reviews: GithubReview[] }>(
      'GET',
      `${repositoryPath(call, `pulls/${number}/reviews`)}?page=${query.page}&per_page=${query.perPage}`,
    );
    return result.reviews;
  }

  getReview(call: GithubCall, number: number, reviewId: number): Promise<GithubReview> {
    return this.#request('GET', repositoryPath(call, `pulls/${number}/reviews/${reviewId}`));
  }

  createReview(
    call: GithubCall,
    number: number,
    body: { body?: string; commitId?: string; event?: GithubReviewEvent },
  ): Promise<GithubReview> {
    return this.#request('POST', repositoryPath(call, `pulls/${number}/reviews`), { body, ...actingUser(call) });
  }

  updateReview(call: GithubCall, number: number, reviewId: number, body: string): Promise<GithubReview> {
    return this.#request('PUT', repositoryPath(call, `pulls/${number}/reviews/${reviewId}`), {
      body: { body },
      ...actingUser(call),
    });
  }

  submitReview(
    call: GithubCall,
    number: number,
    reviewId: number,
    body: { body?: string; event: GithubReviewEvent },
  ): Promise<GithubReview> {
    return this.#request('POST', repositoryPath(call, `pulls/${number}/reviews/${reviewId}/events`), {
      body,
      ...actingUser(call),
    });
  }

  dismissReview(call: GithubCall, number: number, reviewId: number, message: string): Promise<GithubReview> {
    return this.#request('PUT', repositoryPath(call, `pulls/${number}/reviews/${reviewId}/dismissals`), {
      body: { message },
      ...actingUser(call),
    });
  }

  async deletePendingReview(call: GithubCall, number: number, reviewId: number): Promise<void> {
    await this.#request('DELETE', repositoryPath(call, `pulls/${number}/reviews/${reviewId}`), { ...actingUser(call) });
  }

  async listReviewComments(call: GithubCall, number: number, query: GithubPage): Promise<GithubReviewComment[]> {
    const result = await this.#request<{ comments: GithubReviewComment[] }>(
      'GET',
      `${repositoryPath(call, `pulls/${number}/comments`)}?page=${query.page}&per_page=${query.perPage}`,
    );
    return result.comments;
  }

  createReviewComment(call: GithubCall, number: number, body: GithubReviewCommentCreate): Promise<GithubReviewComment> {
    return this.#request('POST', repositoryPath(call, `pulls/${number}/comments`), { body, ...actingUser(call) });
  }

  updateReviewComment(call: GithubCall, commentId: number, body: string): Promise<GithubReviewComment> {
    return this.#request('PATCH', repositoryPath(call, `pulls/comments/${commentId}`), {
      body: { body },
      ...actingUser(call),
    });
  }

  async deleteReviewComment(call: GithubCall, commentId: number): Promise<void> {
    await this.#request('DELETE', repositoryPath(call, `pulls/comments/${commentId}`), { ...actingUser(call) });
  }

  listRequestedReviewers(call: GithubCall, number: number): Promise<GithubReviewers> {
    return this.#request('GET', repositoryPath(call, `pulls/${number}/requested-reviewers`), {});
  }

  requestReviewers(call: GithubCall, number: number, reviewers: Partial<GithubReviewers>): Promise<GithubReviewers> {
    return this.#request('POST', repositoryPath(call, `pulls/${number}/requested-reviewers`), {
      body: { users: reviewers.users, teams: reviewers.teams },
      ...actingUser(call),
    });
  }

  removeRequestedReviewers(
    call: GithubCall,
    number: number,
    reviewers: Partial<GithubReviewers>,
  ): Promise<GithubReviewers> {
    return this.#request('DELETE', repositoryPath(call, `pulls/${number}/requested-reviewers`), {
      body: { users: reviewers.users, teams: reviewers.teams },
      ...actingUser(call),
    });
  }

  createCheckRun(call: GithubCall, body: GithubCheckRunCreate): Promise<{ id: number; htmlUrl: string }> {
    return this.#request('POST', repositoryPath(call, 'check-runs'), { body, ...actingUser(call) });
  }

  async getCollaboratorPermission(call: GithubCall, username: string): Promise<GithubRepositoryPermission> {
    const result = await this.#request<{ permission: GithubRepositoryPermission }>(
      'GET',
      repositoryPath(call, `collaborators/${encodeURIComponent(username)}/permission`),
      { signal: AbortSignal.timeout(COLLABORATOR_PERMISSION_LOOKUP_TIMEOUT_MS) },
    );
    return result.permission;
  }

  async listDependabotAlerts(call: GithubCall, state: 'open' | 'closed'): Promise<GithubDependabotAlert[]> {
    // GitHub has no "closed" alert state; closed covers the three terminal states. The 100 most
    // recently updated are enough to close cards for recently fixed or dismissed alerts.
    const query = new URLSearchParams({
      state: state === 'open' ? 'open' : 'fixed,dismissed,auto_dismissed',
      per_page: '100',
      sort: 'updated',
      direction: 'desc',
    });
    const result = await this.#request<{ alerts: GithubDependabotAlert[] }>(
      'GET',
      `${repositoryPath(call, 'dependabot/alerts')}?${query}`,
    );
    return result.alerts;
  }

  #request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    init?: { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal },
  ): Promise<T> {
    return this.#client.request<T>(method, path, init);
  }
}

export function splitRepository(sourceId: string): { owner: string; repo: string } {
  const slash = sourceId.indexOf('/');
  if (slash <= 0 || slash === sourceId.length - 1) {
    throw new Error('GitHub capabilities require an owner/repository source.');
  }
  return { owner: sourceId.slice(0, slash), repo: sourceId.slice(slash + 1) };
}

function repositoryPath(call: GithubCall, suffix: string): string {
  const { owner, repo } = splitRepository(call.repository);
  return `${LEGACY_API_PREFIX}/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${suffix}`;
}

/** Names the Factory user a write acts for, so the platform authors it with that user's GitHub connection. */
function actingUser(call: GithubCall): { headers?: Record<string, string> } {
  return call.actingUserId ? { headers: { 'x-acting-user-id': call.actingUserId } } : {};
}
