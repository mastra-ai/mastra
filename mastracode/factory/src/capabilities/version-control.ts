import type {
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { IntegrationConnection } from './connection.js';

export interface InstallationInput {
  externalId: string;
  accountName?: string | null;
  accountType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RepositoryInput {
  externalId: string;
  slug: string;
  defaultBranch: string;
  metadata?: Record<string, unknown>;
}

export interface RepositoryAccess {
  cloneUrl: string;
  authorization?: { scheme: 'bearer'; token: string };
}

export type PullRequestState = 'open' | 'closed';

export interface PullRequest {
  id: string;
  title: string;
  url: string;
  author: string | null;
  assignees?: string[];
  requestedReviewers?: string[];
  labels?: string[];
  body: string | null;
  state: PullRequestState;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestPage {
  pullRequests: PullRequest[];
  nextCursor: string | null;
}

export interface PullRequestRef {
  connection: IntegrationConnection;
  sourceId: string;
  pullRequestId: string;
  /** End user the write should be attributed to, when the provider supports acting on a user's behalf. */
  actingUserId?: string;
}

export interface ListPullRequestsInput {
  connection: IntegrationConnection;
  sourceId: string;
  state?: PullRequestState | 'all';
  includeDrafts?: boolean;
  cursor?: string;
}

export interface CreatePullRequestInput {
  connection: IntegrationConnection;
  sourceId: string;
  title: string;
  body?: string;
  baseBranch: string;
  headBranch: string;
  draft?: boolean;
  /** End user the write should be attributed to, when the provider supports acting on a user's behalf. */
  actingUserId?: string;
}

export interface UpdatePullRequestInput extends PullRequestRef {
  title?: string;
  body?: string | null;
  baseBranch?: string;
  state?: PullRequestState;
}

export interface MergePullRequestInput extends PullRequestRef {
  commitTitle?: string;
  commitMessage?: string;
  method?: 'merge' | 'squash' | 'rebase';
}

export interface MergePullRequestResult {
  merged: boolean;
  message: string;
  sha: string | null;
}

export interface PullRequestComment {
  id: string;
  url: string;
  author: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestCommentPage {
  comments: PullRequestComment[];
  nextCursor: string | null;
}

export interface ListPullRequestCommentsInput extends PullRequestRef {
  cursor?: string;
}

export interface CreatePullRequestCommentInput extends PullRequestRef {
  body: string;
}

export interface UpdatePullRequestCommentInput {
  connection: IntegrationConnection;
  sourceId: string;
  commentId: string;
  body: string;
  actingUserId?: string;
}

export interface DeletePullRequestCommentInput {
  connection: IntegrationConnection;
  sourceId: string;
  commentId: string;
  actingUserId?: string;
}

export type ReviewState = 'pending' | 'commented' | 'approved' | 'changes-requested' | 'dismissed';

export interface Review {
  id: string;
  url: string | null;
  author: string | null;
  body: string | null;
  state: ReviewState;
  commitId: string | null;
  submittedAt: string | null;
}

export interface ReviewPage {
  reviews: Review[];
  nextCursor: string | null;
}

export interface ListReviewsInput extends PullRequestRef {
  cursor?: string;
}

type CreateReviewBase = PullRequestRef & { commitId?: string };

type ReviewSubmission = { event: 'approve'; body?: string } | { event: 'request-changes' | 'comment'; body: string };

export type CreateReviewInput = CreateReviewBase & (ReviewSubmission | { event?: undefined; body?: string });

export interface ReviewRef extends PullRequestRef {
  reviewId: string;
}

export interface UpdateReviewInput extends ReviewRef {
  body: string;
}

export type SubmitReviewInput = ReviewRef & ReviewSubmission;

export interface DismissReviewInput extends ReviewRef {
  message: string;
}

export interface ReviewComment extends PullRequestComment {
  path: string;
  line: number | null;
  side: 'left' | 'right' | null;
  commitId: string;
  replyToId: string | null;
}

export interface ReviewCommentPage {
  comments: ReviewComment[];
  nextCursor: string | null;
}

export interface ListReviewCommentsInput extends PullRequestRef {
  cursor?: string;
}

interface CreateReviewCommentBase extends PullRequestRef {
  body: string;
}

export type CreateReviewCommentInput = CreateReviewCommentBase &
  (
    | {
        replyToId: string;
        commitId?: never;
        path?: never;
        line?: never;
        side?: never;
        startLine?: never;
        startSide?: never;
      }
    | {
        replyToId?: never;
        commitId: string;
        path: string;
        line: number;
        side: 'left' | 'right';
        startLine?: number;
        startSide?: 'left' | 'right';
      }
  );

export type UpdateReviewCommentInput = UpdatePullRequestCommentInput;
export type DeleteReviewCommentInput = DeletePullRequestCommentInput;

export interface RequestedReviewers {
  users: string[];
  teams: string[];
}

export interface UpdateReviewersInput extends PullRequestRef {
  users?: string[];
  teams?: string[];
}

/**
 * Raised when a provider has no analogue for a contract operation.
 *
 * The contract is shaped after GitHub, so a provider that implements it
 * faithfully will still have gaps — GitLab, for instance, has no pending-review
 * object to delete. Throwing this is the honest answer: a silent no-op would
 * let a caller believe a write landed when nothing happened.
 */
export class UnsupportedVersionControlOperationError extends Error {
  readonly provider: string;
  readonly operation: string;

  constructor(provider: string, operation: string, detail?: string) {
    super(`${provider} does not support ${operation}.${detail ? ` ${detail}` : ''}`);
    this.name = 'UnsupportedVersionControlOperationError';
    this.provider = provider;
    this.operation = operation;
  }
}

/** Fixed repository, pull-request lifecycle, review, comment, and reviewer contract. */
export interface VersionControl {
  initialize(input: { storage: SourceControlStorageHandle }): void;
  registerInstallation(input: {
    orgId: string;
    userId: string;
    installation: InstallationInput;
  }): Promise<SourceControlInstallation>;
  registerRepositories(input: {
    orgId: string;
    installationId: string;
    repositories: RepositoryInput[];
  }): Promise<SourceControlRepository[]>;
  getRepositoryAccess(input: { orgId: string; repositoryId: string }): Promise<RepositoryAccess>;
  listPullRequests(input: ListPullRequestsInput): Promise<PullRequestPage>;
  getPullRequest(input: PullRequestRef): Promise<PullRequest | null>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  updatePullRequest(input: UpdatePullRequestInput): Promise<PullRequest>;
  closePullRequest(input: PullRequestRef): Promise<PullRequest>;
  mergePullRequest(input: MergePullRequestInput): Promise<MergePullRequestResult>;
  listComments(input: ListPullRequestCommentsInput): Promise<PullRequestCommentPage>;
  createComment(input: CreatePullRequestCommentInput): Promise<PullRequestComment>;
  updateComment(input: UpdatePullRequestCommentInput): Promise<PullRequestComment>;
  deleteComment(input: DeletePullRequestCommentInput): Promise<void>;
  listReviews(input: ListReviewsInput): Promise<ReviewPage>;
  getReview(input: ReviewRef): Promise<Review | null>;
  createReview(input: CreateReviewInput): Promise<Review>;
  updateReview(input: UpdateReviewInput): Promise<Review>;
  submitReview(input: SubmitReviewInput): Promise<Review>;
  dismissReview(input: DismissReviewInput): Promise<Review>;
  deletePendingReview(input: ReviewRef): Promise<void>;
  listReviewComments(input: ListReviewCommentsInput): Promise<ReviewCommentPage>;
  createReviewComment(input: CreateReviewCommentInput): Promise<ReviewComment>;
  updateReviewComment(input: UpdateReviewCommentInput): Promise<ReviewComment>;
  deleteReviewComment(input: DeleteReviewCommentInput): Promise<void>;
  listRequestedReviewers(input: PullRequestRef): Promise<RequestedReviewers>;
  requestReviewers(input: UpdateReviewersInput): Promise<RequestedReviewers>;
  removeRequestedReviewers(input: UpdateReviewersInput): Promise<RequestedReviewers>;
}

/**
 * How a provider addresses a repository over HTTPS.
 *
 * Git itself is provider-neutral; only the host and the username half of token
 * auth differ. GitHub wants `x-access-token`, GitLab wants `oauth2`, and each
 * has its own host — so a deployment whose codebase lives on GitLab needs this
 * to be data rather than a literal baked into the URL builders.
 */
export interface RepoRemote {
  /** Origin with no trailing slash: `https://github.com`, `https://gitlab.example.com`. */
  origin: string;
  /** Username half of HTTPS token auth. */
  tokenUser: string;
  /**
   * The ref namespace a proposed change is fetchable under, as a template
   * taking the change number. GitHub publishes `refs/pull/<n>/head`; GitLab
   * publishes `refs/merge-requests/<iid>/head`. Without this a review session
   * would clone the base tip and never see the change it was opened to review.
   */
  changeRef: (changeNumber: number) => string;
  /**
   * Git credential helper for on-demand blob fetches in a blob-less history,
   * or `undefined` when the provider has no CLI to answer them. GitHub's `gh`
   * serves them from the session token; a GitLab session has no equivalent
   * installed, so it authenticates through the tokenized origin instead.
   */
  credentialHelper?: string;
}

/**
 * Past file contents of a blob-less history load on demand; git asks gh, which
 * answers from the session's `GH_TOKEN`, so no credential is ever written.
 */
const GH_CREDENTIAL_HELPER = '!gh auth git-credential';

export const GITHUB_REMOTE: RepoRemote = {
  origin: 'https://github.com',
  tokenUser: 'x-access-token',
  changeRef: number => `refs/pull/${number}/head`,
  credentialHelper: GH_CREDENTIAL_HELPER,
};
