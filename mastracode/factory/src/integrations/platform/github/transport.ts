import type { GithubDependabotAlert } from '../../dependabot/sync.js';
import type { GithubRepositoryPermission } from '../../github/integration.js';

/**
 * The GitHub shapes Platform GitHub works in: the camelCase shapes of the
 * platform's legacy `/v1/server/github*` routes. The legacy transport passes
 * them through; the Connect transport adapts GitHub's REST responses into them.
 */
export type GithubActor = { login: string; avatarUrl: string | null; htmlUrl: string | null } | null;

export type GithubIssue = {
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

export type GithubComment = {
  id: number;
  body: string;
  htmlUrl: string;
  user: GithubActor;
  createdAt: string;
  updatedAt: string;
};

export type GithubPullRequest = {
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

export type GithubReview = {
  id: number;
  htmlUrl: string | null;
  body: string | null;
  state: 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';
  commitId: string | null;
  submittedAt: string | null;
  user: GithubActor;
};

export type GithubReviewComment = GithubComment & {
  path: string;
  line: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  commitId: string;
  replyToId: number | null;
};

export type GithubReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export type GithubReviewCommentCreate =
  | { body: string; replyToId: number }
  | {
      body: string;
      commitId: string;
      path: string;
      line: number;
      side: string;
      startLine?: number;
      startSide?: string;
    };

export type GithubCheckRunCreate = {
  name: string;
  headSha: string;
  status: 'in_progress' | 'completed';
  conclusion?: string;
  output: { title: string; summary: string; text?: string };
};

export type GithubReviewers = { users: string[]; teams: string[] };

/** Who a call is for. `repository` is `owner/repo`. */
export interface GithubCall {
  repository: string;
  /** The Factory user a write is made for. Only set from the run's authenticated owner. */
  actingUserId?: string;
  signal?: AbortSignal;
}

export interface GithubPage {
  page: number;
  perPage: number;
}

/**
 * Every GitHub operation Platform GitHub makes, one typed method each.
 * {@link LegacyGithubTransport} is today's platform routes; the Connect
 * transport calls GitHub directly. Which one serves an org is decided only by
 * the org's mode.
 */
export interface GithubTransport {
  readonly kind: 'legacy' | 'connect';

  getPullRequest(call: GithubCall, number: number): Promise<GithubPullRequest>;
  listPullRequests(call: GithubCall, query: GithubPage & { state: string }): Promise<GithubPullRequest[]>;
  createPullRequest(
    call: GithubCall,
    body: { head: string; base: string; title: string; body?: string; draft?: boolean },
  ): Promise<GithubPullRequest>;
  updatePullRequest(
    call: GithubCall,
    number: number,
    body: { title?: string; body?: string; base?: string; state?: 'open' | 'closed' },
  ): Promise<GithubPullRequest>;
  mergePullRequest(
    call: GithubCall,
    number: number,
    body: { commitTitle?: string; commitMessage?: string; method?: 'merge' | 'squash' | 'rebase' },
  ): Promise<{ merged: boolean; message: string; sha: string | null }>;

  getIssue(call: GithubCall, number: number): Promise<GithubIssue>;
  listIssues(call: GithubCall, query: GithubPage & { state: 'open'; labels?: string[] }): Promise<GithubIssue[]>;
  updateIssue(
    call: GithubCall,
    number: number,
    body: { state: 'open' | 'closed'; stateReason?: 'completed' | 'not_planned' },
  ): Promise<GithubIssue>;
  addIssueLabels(call: GithubCall, number: number, labels: string[]): Promise<string[]>;
  removeIssueLabel(call: GithubCall, number: number, label: string): Promise<void>;

  /** Without `page`, the first `perPage` comments. */
  listIssueComments(
    call: GithubCall,
    number: number,
    query: Partial<GithubPage> & { perPage: number },
  ): Promise<GithubComment[]>;
  createIssueComment(call: GithubCall, number: number, body: string): Promise<GithubComment>;
  updateIssueComment(call: GithubCall, commentId: number, body: string): Promise<GithubComment>;
  deleteIssueComment(call: GithubCall, commentId: number): Promise<void>;

  listReviews(call: GithubCall, number: number, query: GithubPage): Promise<GithubReview[]>;
  getReview(call: GithubCall, number: number, reviewId: number): Promise<GithubReview>;
  createReview(
    call: GithubCall,
    number: number,
    body: { body?: string; commitId?: string; event?: GithubReviewEvent },
  ): Promise<GithubReview>;
  updateReview(call: GithubCall, number: number, reviewId: number, body: string): Promise<GithubReview>;
  submitReview(
    call: GithubCall,
    number: number,
    reviewId: number,
    body: { body?: string; event: GithubReviewEvent },
  ): Promise<GithubReview>;
  dismissReview(call: GithubCall, number: number, reviewId: number, message: string): Promise<GithubReview>;
  deletePendingReview(call: GithubCall, number: number, reviewId: number): Promise<void>;

  listReviewComments(call: GithubCall, number: number, query: GithubPage): Promise<GithubReviewComment[]>;
  createReviewComment(call: GithubCall, number: number, body: GithubReviewCommentCreate): Promise<GithubReviewComment>;
  updateReviewComment(call: GithubCall, commentId: number, body: string): Promise<GithubReviewComment>;
  deleteReviewComment(call: GithubCall, commentId: number): Promise<void>;

  listRequestedReviewers(call: GithubCall, number: number): Promise<GithubReviewers>;
  requestReviewers(call: GithubCall, number: number, reviewers: Partial<GithubReviewers>): Promise<GithubReviewers>;
  removeRequestedReviewers(
    call: GithubCall,
    number: number,
    reviewers: Partial<GithubReviewers>,
  ): Promise<GithubReviewers>;

  createCheckRun(call: GithubCall, body: GithubCheckRunCreate): Promise<{ id: number; htmlUrl: string }>;
  getCollaboratorPermission(call: GithubCall, username: string): Promise<GithubRepositoryPermission>;
  listDependabotAlerts(call: GithubCall, state: 'open' | 'closed'): Promise<GithubDependabotAlert[]>;
}

/** Thrown when an org's mode has no transport for an operation. */
export class GithubTransportUnavailableError extends Error {
  readonly orgId: string | undefined;

  constructor(message: string, orgId?: string) {
    super(message);
    this.name = 'GithubTransportUnavailableError';
    this.orgId = orgId;
  }
}
