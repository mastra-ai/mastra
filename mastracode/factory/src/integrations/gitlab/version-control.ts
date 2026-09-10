/**
 * GitLab's implementation of the `VersionControl` capability — merge requests
 * standing in for pull requests.
 *
 * TRANSLATION. The contract is shaped after GitHub, so three mappings carry the
 * weight:
 *   - Identity: a merge request is addressed per-project by `iid`, so a
 *     `pullRequestId` here is the `iid`, matching how issues already work.
 *   - State: GitLab has four states (`opened|closed|merged|locked`) where the
 *     contract has two plus a `merged` flag. `merged` and `locked` both report
 *     `closed`; `merged` additionally sets the flag.
 *   - Review: GitLab has no review object. Approvals are the only analogue, so
 *     an approval reads as an `approved` review and a plain note as
 *     `commented`. There is no pending-review draft to hold unsubmitted
 *     comments, which is why the pending-review operations are unsupported
 *     rather than emulated.
 *
 * WHY THROW. Operations GitLab cannot express raise
 * `UnsupportedVersionControlOperationError` instead of no-op'ing, so a caller
 * is never told a write succeeded when nothing happened.
 */

import type {
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  CreateReviewCommentInput,
  CreateReviewInput,
  DeletePullRequestCommentInput,
  DeleteReviewCommentInput,
  DismissReviewInput,
  InstallationInput,
  ListPullRequestCommentsInput,
  ListPullRequestsInput,
  ListReviewCommentsInput,
  ListReviewsInput,
  MergePullRequestInput,
  MergePullRequestResult,
  PullRequest,
  PullRequestComment,
  PullRequestCommentPage,
  PullRequestPage,
  RepoRemote,
  PullRequestRef,
  PullRequestState,
  RepositoryAccess,
  RepositoryInput,
  RequestedReviewers,
  Review,
  ReviewComment,
  ReviewCommentPage,
  ReviewPage,
  ReviewRef,
  SubmitReviewInput,
  UpdatePullRequestCommentInput,
  UpdatePullRequestInput,
  UpdateReviewCommentInput,
  UpdateReviewInput,
  UpdateReviewersInput,
  VersionControl,
} from '../../capabilities/version-control.js';
import { UnsupportedVersionControlOperationError } from '../../capabilities/version-control.js';
import type {
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import type {
  GitLabClient,
  GitLabDiscussion,
  GitLabDiscussionNote,
  GitLabMergeRequest,
  GitLabMergeRequestRef,
  GitLabNote,
} from './client.js';

const PROVIDER = 'GitLab';

function unsupported(operation: string, detail?: string): never {
  throw new UnsupportedVersionControlOperationError(PROVIDER, operation, detail);
}

/** `merged` and `locked` are both closed to the contract; only `merged` sets the flag. */
function mergeRequestState(state: GitLabMergeRequest['state']): PullRequestState {
  return state === 'opened' ? 'open' : 'closed';
}

/**
 * `checking` and `unchecked` mean GitLab has not finished deciding, which is
 * the contract's `null` (unknown) rather than `false` (known unmergeable).
 */
function mergeable(mr: GitLabMergeRequest): boolean | null {
  switch (mr.merge_status) {
    case 'can_be_merged':
      return true;
    case 'cannot_be_merged':
    case 'cannot_be_merged_recheck':
      return false;
    default:
      return null;
  }
}

export function toPullRequest(mr: GitLabMergeRequest): PullRequest {
  return {
    id: String(mr.iid),
    title: mr.title,
    url: mr.web_url,
    author: mr.author?.username ?? null,
    assignees: (mr.assignees ?? []).map(user => user.username),
    requestedReviewers: (mr.reviewers ?? []).map(user => user.username),
    labels: mr.labels ?? [],
    body: mr.description?.trim() ? mr.description : null,
    state: mergeRequestState(mr.state),
    draft: mr.draft ?? mr.work_in_progress ?? false,
    merged: mr.state === 'merged',
    mergeable: mergeable(mr),
    baseBranch: mr.target_branch,
    headBranch: mr.source_branch,
    headSha: mr.sha ?? '',
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
  };
}

function toComment(note: GitLabNote, mrUrl: string): PullRequestComment {
  return {
    id: String(note.id),
    // GitLab notes have no standalone URL; the anchor on the MR page is stable.
    url: `${mrUrl}#note_${note.id}`,
    author: note.author?.username ?? null,
    body: note.body,
    createdAt: note.created_at,
    updatedAt: note.updated_at ?? note.created_at,
  };
}

/** A diff-anchored note carries a `position`; a plain discussion note does not. */
function toReviewComment(note: GitLabDiscussionNote, mrUrl: string): ReviewComment | null {
  const position = note.position;
  const path = position?.new_path ?? position?.old_path;
  if (!position || !path) return null;
  return {
    ...toComment(note, mrUrl),
    path,
    line: position.new_line ?? position.old_line ?? null,
    // A note on the post-image is the right side; an old-line-only note is the left.
    side: position.new_line != null ? 'right' : position.old_line != null ? 'left' : null,
    commitId: position.head_sha ?? '',
    replyToId: null,
  };
}

export interface GitLabVersionControlDependencies {
  /** Resolves a client for the connection the caller presents. */
  clientForConnection(connection: { type: 'oauth'; accessToken: string }): GitLabClient;
  /** Resolves the org's stored connection, for repository access outside a request. */
  clientForOrg(orgId: string): Promise<GitLabClient | null>;
  /** The token behind the org's connection, for authenticated clone URLs. */
  accessTokenForOrg(orgId: string): Promise<string | null>;
  baseUrl: string;
}

export class GitLabVersionControl implements VersionControl {
  #storage: SourceControlStorageHandle | undefined;
  readonly #deps: GitLabVersionControlDependencies;

  constructor(deps: GitLabVersionControlDependencies) {
    this.#deps = deps;
  }

  initialize(input: { storage: SourceControlStorageHandle }): void {
    this.#storage = input.storage;
  }

  get #store(): SourceControlStorageHandle {
    if (!this.#storage) throw new Error('GitLab version control has not been initialized.');
    return this.#storage;
  }

  /** Only an OAuth/PAT connection is meaningful here; app installations are GitHub's model. */
  #client(connection: PullRequestRef['connection']): GitLabClient {
    if (connection.type !== 'oauth') {
      unsupported('app-installation credentials', 'GitLab authenticates with an OAuth grant or access token.');
    }
    return this.#deps.clientForConnection(connection);
  }

  #ref(input: { sourceId: string; pullRequestId: string }): GitLabMergeRequestRef {
    const iid = Number(input.pullRequestId);
    if (!Number.isSafeInteger(iid) || iid <= 0) {
      throw new Error(`GitLab merge-request id must be a positive iid, received '${input.pullRequestId}'.`);
    }
    return { projectId: input.sourceId, iid };
  }

  async #mergeRequest(input: PullRequestRef): Promise<GitLabMergeRequest> {
    const mr = await this.#client(input.connection).getMergeRequest(this.#ref(input));
    if (!mr) throw new Error(`GitLab merge request ${input.sourceId}!${input.pullRequestId} was not found.`);
    return mr;
  }

  async registerInstallation(input: {
    orgId: string;
    userId: string;
    installation: InstallationInput;
  }): Promise<SourceControlInstallation> {
    return this.#store.installations.upsert({
      orgId: input.orgId,
      connectedByUserId: input.userId,
      externalId: input.installation.externalId,
      accountName: input.installation.accountName,
      accountType: input.installation.accountType,
      providerMetadata: input.installation.metadata,
    });
  }

  async registerRepositories(input: {
    orgId: string;
    installationId: string;
    repositories: RepositoryInput[];
  }): Promise<SourceControlRepository[]> {
    return Promise.all(
      input.repositories.map(repository =>
        this.#store.repositories.upsert({
          orgId: input.orgId,
          input: {
            installationId: input.installationId,
            externalId: repository.externalId,
            slug: repository.slug,
            defaultBranch: repository.defaultBranch,
            providerMetadata: repository.metadata,
          },
        }),
      ),
    );
  }

  /**
   * How the sandbox addresses this GitLab instance over HTTPS.
   *
   * `oauth2` is GitLab's required username for token auth, and a merge request
   * head is fetchable under `refs/merge-requests/<iid>/head` — the analogue of
   * GitHub's `refs/pull/<n>/head`. No credential helper is supplied: `glab` is
   * not installed in the session sandbox, so on-demand blob fetches
   * authenticate through the tokenized origin instead of a CLI that would not
   * answer.
   */
  get remote(): RepoRemote {
    return {
      origin: this.#deps.baseUrl,
      tokenUser: 'oauth2',
      changeRef: iid => `refs/merge-requests/${iid}/head`,
    };
  }

  /**
   * GitLab has no short-lived installation token, so the clone rides the org's
   * own grant. `oauth2` is the required username for token auth over HTTPS.
   */
  async getRepositoryAccess(input: { orgId: string; repositoryId: string }): Promise<RepositoryAccess> {
    const repository = await this.#store.repositories.get({ orgId: input.orgId, id: input.repositoryId });
    if (!repository) throw new Error('Version-control repository not found.');
    const token = await this.#deps.accessTokenForOrg(input.orgId);
    if (!token) throw new Error('GitLab is not connected for this organization.');
    return {
      cloneUrl: `${this.#deps.baseUrl}/${repository.slug}.git`,
      authorization: { scheme: 'bearer', token },
    };
  }

  async listPullRequests(input: ListPullRequestsInput): Promise<PullRequestPage> {
    const state = input.state === undefined || input.state === 'all' ? 'all' : input.state === 'open' ? 'opened' : input.state;
    const page = await this.#client(input.connection).listMergeRequests({
      projectId: input.sourceId,
      state,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    });
    const pullRequests = page.items
      .map(toPullRequest)
      .filter(pr => input.includeDrafts !== false || !pr.draft);
    return { pullRequests, nextCursor: page.nextCursor };
  }

  async getPullRequest(input: PullRequestRef): Promise<PullRequest | null> {
    const mr = await this.#client(input.connection).getMergeRequest(this.#ref(input));
    return mr ? toPullRequest(mr) : null;
  }

  /**
   * GitLab has no draft flag on create; the convention is a `Draft:` title
   * prefix, which is what its own UI does.
   */
  async createPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const title = input.draft && !/^draft:/i.test(input.title) ? `Draft: ${input.title}` : input.title;
    const mr = await this.#client(input.connection).createMergeRequest({
      projectId: input.sourceId,
      title,
      ...(input.body === undefined ? {} : { description: input.body }),
      sourceBranch: input.headBranch,
      targetBranch: input.baseBranch,
    });
    return toPullRequest(mr);
  }

  async updatePullRequest(input: UpdatePullRequestInput): Promise<PullRequest> {
    const current = input.state === undefined ? null : await this.#mergeRequest(input);
    // `state_event` is rejected when it would be a no-op, so only send a real change.
    const stateEvent =
      input.state === undefined || current === null
        ? undefined
        : input.state === 'closed' && current.state === 'opened'
          ? ('close' as const)
          : input.state === 'open' && current.state === 'closed'
            ? ('reopen' as const)
            : undefined;
    const mr = await this.#client(input.connection).updateMergeRequest(this.#ref(input), {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.body === undefined ? {} : { description: input.body }),
      ...(input.baseBranch === undefined ? {} : { targetBranch: input.baseBranch }),
      ...(stateEvent === undefined ? {} : { stateEvent }),
    });
    return toPullRequest(mr);
  }

  async closePullRequest(input: PullRequestRef): Promise<PullRequest> {
    return this.updatePullRequest({ ...input, state: 'closed' });
  }

  /**
   * `rebase` is not a merge method GitLab's accept endpoint takes — it is a
   * separate endpoint that does not merge — so it is refused rather than
   * silently treated as a merge commit.
   */
  async mergePullRequest(input: MergePullRequestInput): Promise<MergePullRequestResult> {
    if (input.method === 'rebase') {
      unsupported('rebase merges', 'GitLab rebases through a separate endpoint that does not merge.');
    }
    const squash = input.method === 'squash';
    const commitMessage = input.commitMessage ?? input.commitTitle;
    const { mergeRequest, refusal } = await this.#client(input.connection).acceptMergeRequest(this.#ref(input), {
      ...(commitMessage === undefined ? {} : { commitMessage }),
      ...(squash ? { squash: true } : {}),
    });
    if (!mergeRequest) return { merged: false, message: refusal ?? 'GitLab declined the merge.', sha: null };
    return {
      merged: mergeRequest.state === 'merged',
      message: mergeRequest.state === 'merged' ? 'Merge request merged.' : `Merge request is ${mergeRequest.state}.`,
      sha: mergeRequest.merge_commit_sha ?? mergeRequest.squash_commit_sha ?? null,
    };
  }

  async listComments(input: ListPullRequestCommentsInput): Promise<PullRequestCommentPage> {
    const client = this.#client(input.connection);
    const ref = this.#ref(input);
    const [mr, page] = await Promise.all([
      this.#mergeRequest(input),
      client.listMergeRequestNotes(ref, input.cursor),
    ]);
    return { comments: page.items.map(note => toComment(note, mr.web_url)), nextCursor: page.nextCursor };
  }

  async createComment(input: CreatePullRequestCommentInput): Promise<PullRequestComment> {
    const [mr, note] = await Promise.all([
      this.#mergeRequest(input),
      this.#client(input.connection).createMergeRequestNote(this.#ref(input), input.body),
    ]);
    return toComment(note, mr.web_url);
  }

  /**
   * GitLab scopes a note update to its merge request, so the contract's
   * MR-less `{ sourceId, commentId }` cannot address one. Callers hold the MR,
   * so this is a contract gap rather than a provider gap.
   */
  async updateComment(_input: UpdatePullRequestCommentInput): Promise<PullRequestComment> {
    unsupported(
      'updating a comment without its merge request',
      'GitLab scopes notes to a merge request; use a discussion reply instead.',
    );
  }

  async deleteComment(_input: DeletePullRequestCommentInput): Promise<void> {
    unsupported(
      'deleting a comment without its merge request',
      'GitLab scopes notes to a merge request.',
    );
  }

  /** Approvals are GitLab's only review analogue, so the list is the approver set. */
  async listReviews(input: ListReviewsInput): Promise<ReviewPage> {
    const [mr, approvals] = await Promise.all([
      this.#mergeRequest(input),
      this.#client(input.connection).listMergeRequestApprovals(this.#ref(input)),
    ]);
    const reviews: Review[] = (approvals.approved_by ?? []).map(entry => ({
      // GitLab has no review id; the approver is the stable identity.
      id: `approval:${entry.user.username}`,
      url: mr.web_url,
      author: entry.user.username,
      body: null,
      state: 'approved',
      commitId: mr.sha ?? null,
      submittedAt: null,
    }));
    return { reviews, nextCursor: null };
  }

  async getReview(input: ReviewRef): Promise<Review | null> {
    const { reviews } = await this.listReviews(input);
    return reviews.find(review => review.id === input.reviewId) ?? null;
  }

  /**
   * A review maps onto GitLab's two real verbs: `approve` grants an approval,
   * and anything else posts a note. `request-changes` has no GitLab primitive —
   * an unapproval is not a recorded verdict — so it posts the body as a note,
   * which is where a human reviewer's objection lives too.
   */
  async createReview(input: CreateReviewInput): Promise<Review> {
    const client = this.#client(input.connection);
    const ref = this.#ref(input);
    const mr = await this.#mergeRequest(input);
    const event = input.event;

    if (event === undefined) {
      unsupported('pending reviews', 'GitLab has no unsubmitted review to hold comments.');
    }
    if (event === 'approve') {
      await client.approveMergeRequest(ref);
      if (input.body?.trim()) await client.createMergeRequestNote(ref, input.body);
      const approver = await client.getCurrentUser();
      return {
        id: `approval:${approver.username}`,
        url: mr.web_url,
        author: approver.username,
        body: input.body ?? null,
        state: 'approved',
        commitId: mr.sha ?? null,
        submittedAt: new Date().toISOString(),
      };
    }

    const note = await client.createMergeRequestNote(ref, input.body);
    return {
      id: String(note.id),
      url: `${mr.web_url}#note_${note.id}`,
      author: note.author?.username ?? null,
      body: note.body,
      state: event === 'request-changes' ? 'changes-requested' : 'commented',
      commitId: mr.sha ?? null,
      submittedAt: note.created_at,
    };
  }

  async updateReview(_input: UpdateReviewInput): Promise<Review> {
    unsupported('editing a submitted review', 'GitLab records approvals, which have no editable body.');
  }

  async submitReview(_input: SubmitReviewInput): Promise<Review> {
    unsupported('submitting a pending review', 'GitLab has no pending review; a review is created already submitted.');
  }

  /** Revoking an approval is the closest real action, and it is not a dismissal of someone else's. */
  async dismissReview(_input: DismissReviewInput): Promise<Review> {
    unsupported('dismissing a review', "GitLab cannot dismiss another user's approval.");
  }

  async deletePendingReview(_input: ReviewRef): Promise<void> {
    unsupported('pending reviews', 'GitLab has no unsubmitted review to discard.');
  }

  async listReviewComments(input: ListReviewCommentsInput): Promise<ReviewCommentPage> {
    const client = this.#client(input.connection);
    const ref = this.#ref(input);
    const [mr, page] = await Promise.all([
      this.#mergeRequest(input),
      client.listMergeRequestDiscussions(ref, input.cursor),
    ]);
    const comments = page.items.flatMap((discussion: GitLabDiscussion) =>
      discussion.notes.flatMap(note => {
        const comment = toReviewComment(note, mr.web_url);
        return comment ? [comment] : [];
      }),
    );
    return { comments, nextCursor: page.nextCursor };
  }

  /**
   * A reply threads into the existing discussion; a new anchored comment needs
   * the MR's `diff_refs`, which GitLab requires and the contract does not carry.
   */
  async createReviewComment(input: CreateReviewCommentInput): Promise<ReviewComment> {
    const client = this.#client(input.connection);
    const ref = this.#ref(input);
    const mr = await this.#mergeRequest(input);

    if (input.replyToId !== undefined) {
      const note = await client.addMergeRequestDiscussionNote(ref, input.replyToId, input.body);
      const comment = toReviewComment(note, mr.web_url);
      if (comment) return { ...comment, replyToId: input.replyToId };
      // A reply inherits its thread's anchor, which a bare note response omits.
      return { ...toComment(note, mr.web_url), path: '', line: null, side: null, commitId: input.commitId ?? '', replyToId: input.replyToId };
    }

    const headSha = mr.sha;
    if (!headSha) unsupported('anchored comments on an unresolved head', 'The merge request has no head sha.');
    const discussion = await client.createMergeRequestDiscussion(ref, {
      body: input.body,
      position: {
        // GitLab needs all three shas; the MR's own diff refs are authoritative,
        // so the caller's `commitId` is not substituted for them.
        baseSha: headSha,
        headSha,
        startSha: headSha,
        newPath: input.path,
        ...(input.side === 'left' ? { oldLine: input.line } : { newLine: input.line }),
      },
    });
    const note = discussion.notes[0];
    const comment = note ? toReviewComment(note, mr.web_url) : null;
    if (!comment) throw new Error('GitLab created the discussion but returned no anchored note.');
    return comment;
  }

  async updateReviewComment(_input: UpdateReviewCommentInput): Promise<ReviewComment> {
    unsupported(
      'updating a review comment without its merge request',
      'GitLab scopes discussion notes to a merge request.',
    );
  }

  async deleteReviewComment(_input: DeleteReviewCommentInput): Promise<void> {
    unsupported(
      'deleting a review comment without its merge request',
      'GitLab scopes discussion notes to a merge request.',
    );
  }

  async listRequestedReviewers(input: PullRequestRef): Promise<RequestedReviewers> {
    const mr = await this.#mergeRequest(input);
    // GitLab has no team reviewers on a merge request.
    return { users: (mr.reviewers ?? []).map(user => user.username), teams: [] };
  }

  async requestReviewers(input: UpdateReviewersInput): Promise<RequestedReviewers> {
    if (input.teams?.length) {
      unsupported('team reviewers', 'GitLab assigns reviewers individually.');
    }
    const mr = await this.#mergeRequest(input);
    const existing = (mr.reviewers ?? []).map(user => user.username);
    const merged = [...new Set([...existing, ...(input.users ?? [])])];
    return this.#setReviewers(input, merged);
  }

  async removeRequestedReviewers(input: UpdateReviewersInput): Promise<RequestedReviewers> {
    if (input.teams?.length) {
      unsupported('team reviewers', 'GitLab assigns reviewers individually.');
    }
    const mr = await this.#mergeRequest(input);
    const removing = new Set(input.users ?? []);
    const kept = (mr.reviewers ?? []).map(user => user.username).filter(username => !removing.has(username));
    return this.#setReviewers(input, kept);
  }

  /** GitLab sets reviewers by numeric id, so usernames resolve first. */
  async #setReviewers(input: PullRequestRef, usernames: string[]): Promise<RequestedReviewers> {
    const client = this.#client(input.connection);
    const ids = await Promise.all(
      usernames.map(async username => {
        const user = await client.findUserByUsername(username);
        if (!user) throw new Error(`GitLab user '${username}' was not found.`);
        return user.id;
      }),
    );
    const updated = await client.setMergeRequestReviewers(this.#ref(input), ids);
    return { users: (updated.reviewers ?? []).map(user => user.username), teams: [] };
  }
}
