import { createHash } from 'node:crypto';

import type { IntegrationConnection } from '../../capabilities/connection.js';
import type {
  PullRequest,
  PullRequestComment,
  RequestedReviewers,
  Review,
  ReviewComment,
  VersionControl,
} from '../../capabilities/version-control.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import {
  GITLAB_DISCUSSIONS_PAGE_SIZE,
  GITLAB_MERGE_REQUESTS_PAGE_SIZE,
  GITLAB_NOTES_PAGE_SIZE,
  GitLabApiError,
} from './api.js';
import type {
  GitLabApiClient,
  GitLabDiscussionNote,
  GitLabDiscussionPosition,
  GitLabMember,
  GitLabMergeRequest,
  GitLabNote,
  GitLabUser,
} from './api.js';

export interface GitLabVersionControlContext {
  api: GitLabApiClient;
  connection: IntegrationConnection;
  host: string;
  repositoryAccessToken?: () => Promise<string>;
}

export interface GitLabVersionControlDependencies {
  contextForConnection(connection: IntegrationConnection): Promise<GitLabVersionControlContext>;
}

export function buildGitLabVersionControl(deps: GitLabVersionControlDependencies): VersionControl {
  let storage: SourceControlStorageHandle | undefined;

  const sourceControlStorage = (): SourceControlStorageHandle => {
    if (!storage) throw new Error('GitLab VersionControl is not initialized.');
    return storage;
  };

  const listPullRequests: VersionControl['listPullRequests'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const page = parsePositiveCursor(input.cursor);
    const state = input.state === 'open' ? 'opened' : input.state === 'closed' ? 'all' : (input.state ?? 'opened');
    const mergeRequests = await context.api.listMergeRequests(input.sourceId, { page, state });
    return {
      pullRequests: mergeRequests
        .filter(mergeRequest => input.state !== 'closed' || mergeRequest.state === 'closed' || mergeRequest.state === 'merged')
        .filter(mergeRequest => input.includeDrafts !== false || !isDraft(mergeRequest))
        .map(toPullRequest),
      nextCursor: mergeRequests.length === GITLAB_MERGE_REQUESTS_PAGE_SIZE ? String(page + 1) : null,
    };
  };

  const getPullRequest: VersionControl['getPullRequest'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    try {
      return toPullRequest(
        await context.api.getMergeRequest(input.sourceId, requirePositiveId(input.pullRequestId, 'merge request')),
      );
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
  };

  const createPullRequest: VersionControl['createPullRequest'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const title = input.draft && !/^(?:draft:|\[draft\])/i.test(input.title) ? `Draft: ${input.title}` : input.title;
    return toPullRequest(
      await context.api.createMergeRequest(input.sourceId, {
        sourceBranch: input.headBranch,
        targetBranch: input.baseBranch,
        title,
        description: input.body,
      }),
    );
  };

  const updatePullRequest: VersionControl['updatePullRequest'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    return toPullRequest(
      await context.api.updateMergeRequest(input.sourceId, requirePositiveId(input.pullRequestId, 'merge request'), {
        title: input.title,
        description: input.body === null ? '' : input.body,
        targetBranch: input.baseBranch,
        stateEvent: input.state === 'closed' ? 'close' : input.state === 'open' ? 'reopen' : undefined,
      }),
    );
  };

  const closePullRequest: VersionControl['closePullRequest'] = input =>
    updatePullRequest({ ...input, state: 'closed' });

  const mergePullRequest: VersionControl['mergePullRequest'] = async input => {
    if (input.method === 'rebase') {
      throw notSupported('GitLab rebases merge requests asynchronously; rebase-and-merge is not supported.');
    }
    const context = await deps.contextForConnection(input.connection);
    const commitMessage = combinedCommitMessage(input.commitTitle, input.commitMessage);
    const result = await context.api.mergeMergeRequest(
      input.sourceId,
      requirePositiveId(input.pullRequestId, 'merge request'),
      {
        squash: input.method === 'squash',
        mergeCommitMessage: input.method === 'squash' ? undefined : commitMessage,
        squashCommitMessage: input.method === 'squash' ? commitMessage : undefined,
      },
    );
    const merged = result.state === 'merged' || Boolean(result.merged_at);
    return {
      merged,
      message: result.message ?? (merged ? 'Merge request merged.' : 'Merge request was not merged.'),
      sha: result.squash_commit_sha ?? result.merge_commit_sha ?? result.sha ?? null,
    };
  };

  const listComments: VersionControl['listComments'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const page = parsePositiveCursor(input.cursor);
    const notes = await context.api.listMergeRequestNotes(input.sourceId, mergeRequestIid, { page });
    return {
      comments: notes
        .filter(note => !note.system && note.type !== 'DiffNote')
        .map(note => toPullRequestComment(context.host, input.sourceId, mergeRequestIid, note)),
      nextCursor: notes.length === GITLAB_NOTES_PAGE_SIZE ? String(page + 1) : null,
    };
  };

  const createComment: VersionControl['createComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const note = await context.api.createMergeRequestNote(input.sourceId, mergeRequestIid, input.body);
    return toPullRequestComment(context.host, input.sourceId, mergeRequestIid, note);
  };

  const updateComment: VersionControl['updateComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const { mergeRequestIid, noteId } = parseNoteId(input.commentId);
    const note = await context.api.updateMergeRequestNote(input.sourceId, mergeRequestIid, noteId, input.body);
    return toPullRequestComment(context.host, input.sourceId, mergeRequestIid, note);
  };

  const deleteComment: VersionControl['deleteComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const { mergeRequestIid, noteId } = parseNoteId(input.commentId);
    await context.api.deleteMergeRequestNote(input.sourceId, mergeRequestIid, noteId);
  };

  const listReviews: VersionControl['listReviews'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const approvals = await context.api.getMergeRequestApprovals(input.sourceId, mergeRequestIid);
    return {
      reviews: (approvals.approved_by ?? []).map(({ user }) =>
        toApprovalReview(context.host, input.sourceId, mergeRequestIid, user),
      ),
      nextCursor: null,
    };
  };

  const getReview: VersionControl['getReview'] = async () => null;

  const createReview: VersionControl['createReview'] = async input =>
    submitReviewAction(deps, {
      connection: input.connection,
      sourceId: input.sourceId,
      pullRequestId: input.pullRequestId,
      event: input.event,
      body: input.body,
      commitId: input.commitId,
    });

  const updateReview: VersionControl['updateReview'] = async () => {
    // FLAGGED FOR MANUAL REVIEW (spec §6.2)
    throw notSupported('GitLab does not expose mutable pending review objects.');
  };

  const submitReview: VersionControl['submitReview'] = async input =>
    submitReviewAction(deps, {
      connection: input.connection,
      sourceId: input.sourceId,
      pullRequestId: input.pullRequestId,
      event: input.event,
      body: input.body,
    });

  const dismissReview: VersionControl['dismissReview'] = async () => {
    // FLAGGED FOR MANUAL REVIEW (spec §6.2)
    throw notSupported('GitLab approval dismissal has no GitHub review equivalent.');
  };

  const deletePendingReview: VersionControl['deletePendingReview'] = async () => {
    // FLAGGED FOR MANUAL REVIEW (spec §6.2)
    throw notSupported('GitLab does not expose pending review objects.');
  };

  const listReviewComments: VersionControl['listReviewComments'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const page = parsePositiveCursor(input.cursor);
    const discussions = await context.api.listMergeRequestDiscussions(input.sourceId, mergeRequestIid, { page });
    return {
      comments: discussions.flatMap(discussion => {
        const position = discussionPosition(discussion.notes);
        if (!position) return [];
        const root = discussion.notes.find(note => note.position) ?? discussion.notes[0];
        const replyToId = root ? packDiscussionNoteId(mergeRequestIid, discussion.id, root.id) : null;
        return discussion.notes
          .filter(note => !note.system)
          .map(note =>
            toReviewComment(
              context.host,
              input.sourceId,
              mergeRequestIid,
              discussion.id,
              note,
              note === root ? null : replyToId,
              position,
            ),
          );
      }),
      nextCursor: discussions.length === GITLAB_DISCUSSIONS_PAGE_SIZE ? String(page + 1) : null,
    };
  };

  const createReviewComment: VersionControl['createReviewComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    if (input.replyToId) {
      const thread = parseReviewReplyId(input.replyToId);
      if (thread.mergeRequestIid !== mergeRequestIid) {
        throw new GitLabApiError('GitLab discussion does not belong to the requested merge request.', 400);
      }
      const discussion = await context.api.getMergeRequestDiscussion(
        input.sourceId,
        mergeRequestIid,
        thread.discussionId,
      );
      const position = discussionPosition(discussion.notes);
      if (!position) throw new GitLabApiError('GitLab discussion is not anchored to a diff.', 400);
      const root = discussion.notes.find(note => note.position) ?? discussion.notes[0];
      if (!root) throw new GitLabApiError('GitLab discussion response did not include a note.', 502);
      const note = await context.api.addMergeRequestDiscussionNote(
        input.sourceId,
        mergeRequestIid,
        thread.discussionId,
        input.body,
      );
      return toReviewComment(
        context.host,
        input.sourceId,
        mergeRequestIid,
        thread.discussionId,
        note,
        packDiscussionNoteId(mergeRequestIid, thread.discussionId, root.id),
        position,
      );
    }

    const mergeRequest = await context.api.getMergeRequest(input.sourceId, mergeRequestIid);
    if (!mergeRequest.diff_refs) {
      throw new GitLabApiError('GitLab merge request diff refs are not ready.', 409);
    }
    if (mergeRequest.diff_refs.head_sha !== input.commitId) {
      throw new GitLabApiError('GitLab merge request changed since this review comment was prepared.', 409);
    }
    const { path, line, side } = input;
    if (typeof path !== 'string' || typeof line !== 'number' || (side !== 'left' && side !== 'right')) {
      throw new GitLabApiError('GitLab diff review comment position is invalid.', 400);
    }
    if ((input.startLine === undefined) !== (input.startSide === undefined)) {
      throw new GitLabApiError('A multi-line GitLab review comment requires both startLine and startSide.', 400);
    }
    const position: GitLabDiscussionPosition = {
      position_type: 'text',
      ...mergeRequest.diff_refs,
      old_path: path,
      new_path: path,
      old_line: side === 'left' ? line : undefined,
      new_line: side === 'right' ? line : undefined,
      ...(input.startLine !== undefined && input.startSide
        ? {
            line_range: {
              start: discussionLine(path, input.startLine, input.startSide),
              end: discussionLine(path, line, side),
            },
          }
        : {}),
    };
    const discussion = await context.api.createMergeRequestDiscussion(input.sourceId, mergeRequestIid, {
      body: input.body,
      commitId: input.commitId,
      position,
    });
    const note = discussion.notes.find(candidate => candidate.position) ?? discussion.notes[0];
    if (!note) throw new GitLabApiError('GitLab discussion response did not include a note.', 502);
    return toReviewComment(context.host, input.sourceId, mergeRequestIid, discussion.id, note, null, position);
  };

  const updateReviewComment: VersionControl['updateReviewComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const reference = parseDiscussionNoteId(input.commentId);
    const discussion = await context.api.getMergeRequestDiscussion(
      input.sourceId,
      reference.mergeRequestIid,
      reference.discussionId,
    );
    const position = discussionPosition(discussion.notes);
    if (!position) throw new GitLabApiError('GitLab discussion is not anchored to a diff.', 400);
    const root = discussion.notes.find(candidate => candidate.position) ?? discussion.notes[0];
    if (!root) throw new GitLabApiError('GitLab discussion response did not include a note.', 502);
    const note = await context.api.updateMergeRequestDiscussionNote(
      input.sourceId,
      reference.mergeRequestIid,
      reference.discussionId,
      reference.noteId,
      input.body,
    );
    return toReviewComment(
      context.host,
      input.sourceId,
      reference.mergeRequestIid,
      reference.discussionId,
      note,
      note.id === root.id ? null : packDiscussionNoteId(reference.mergeRequestIid, reference.discussionId, root.id),
      position,
    );
  };

  const deleteReviewComment: VersionControl['deleteReviewComment'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const reference = parseDiscussionNoteId(input.commentId);
    await context.api.deleteMergeRequestDiscussionNote(
      input.sourceId,
      reference.mergeRequestIid,
      reference.discussionId,
      reference.noteId,
    );
  };

  const resolveReviewThread: NonNullable<VersionControl['resolveReviewThread']> = async input => {
    const context = await deps.contextForConnection(input.connection);
    const reference = parseDiscussionNoteId(input.commentId);
    await context.api.resolveMergeRequestDiscussion(
      input.sourceId,
      reference.mergeRequestIid,
      reference.discussionId,
      input.resolved,
    );
  };

  const listRequestedReviewers: VersionControl['listRequestedReviewers'] = async input => {
    const context = await deps.contextForConnection(input.connection);
    const mergeRequest = await context.api.getMergeRequest(
      input.sourceId,
      requirePositiveId(input.pullRequestId, 'merge request'),
    );
    return toRequestedReviewers(mergeRequest);
  };

  const requestReviewers: VersionControl['requestReviewers'] = async input => {
    rejectTeamReviewers(input.teams);
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const mergeRequest = await context.api.getMergeRequest(input.sourceId, mergeRequestIid);
    const requestedMembers = await resolveMembers(context.api, input.sourceId, input.users ?? []);
    const currentIds = await reviewerIds(context.api, input.sourceId, mergeRequest.reviewers ?? []);
    const reviewerIdsToSet = [...new Set([...currentIds, ...requestedMembers.map(member => member.id)])];
    return toRequestedReviewers(
      await context.api.setMergeRequestReviewers(input.sourceId, mergeRequestIid, reviewerIdsToSet),
    );
  };

  const removeRequestedReviewers: VersionControl['removeRequestedReviewers'] = async input => {
    rejectTeamReviewers(input.teams);
    const context = await deps.contextForConnection(input.connection);
    const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
    const mergeRequest = await context.api.getMergeRequest(input.sourceId, mergeRequestIid);
    const removals = new Set((input.users ?? []).map(username => username.toLowerCase()));
    const retained = (mergeRequest.reviewers ?? []).filter(user => !removals.has(user.username.toLowerCase()));
    const retainedIds = await reviewerIds(context.api, input.sourceId, retained);
    return toRequestedReviewers(
      await context.api.setMergeRequestReviewers(input.sourceId, mergeRequestIid, retainedIds),
    );
  };

  return {
    initialize: input => {
      storage = input.storage;
    },
    registerInstallation: async ({ orgId, userId, installation }) => {
      const requestedConnection = parseConnection(installation.metadata?.connection);
      if (!requestedConnection) {
        throw new GitLabApiError('GitLab installation metadata must include a valid connection.', 400);
      }
      const context = await deps.contextForConnection(requestedConnection);
      return sourceControlStorage().installations.upsert({
        orgId,
        connectedByUserId: userId,
        externalId: installation.externalId,
        accountName: installation.accountName,
        accountType: installation.accountType,
        providerMetadata: {
          ...installation.metadata,
          connection: context.connection,
          host: normalizeHost(context.host),
        },
      });
    },
    registerRepositories: async ({ orgId, installationId, repositories }) => {
      const normalizedRepositories = repositories.map(repository => ({
        ...repository,
        slug: normalizeSlug(repository.slug),
      }));
      return await Promise.all(
        normalizedRepositories.map(repository =>
          sourceControlStorage().repositories.upsert({
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
      );
    },
    getRepositoryTarget: async ({ orgId, repositoryId }) => {
      const repository = await sourceControlStorage().repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const installation = await sourceControlStorage().installations.get({
        orgId,
        id: repository.installationId,
      });
      if (!installation) throw new Error('Version-control installation not found.');
      const connection = parseConnection(installation.providerMetadata.connection);
      if (!connection) throw new GitLabApiError('GitLab installation connection metadata is invalid.', 500);
      return { connection, sourceId: repository.slug };
    },
    getRepositoryAccess: async ({ orgId, repositoryId }) => {
      const repository = await sourceControlStorage().repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const installation = await sourceControlStorage().installations.get({
        orgId,
        id: repository.installationId,
      });
      if (!installation) throw new Error('Version-control installation not found.');
      const connection = parseConnection(installation.providerMetadata.connection);
      if (!connection) throw new GitLabApiError('GitLab installation connection metadata is invalid.', 500);
      const context = await deps.contextForConnection(connection);
      if (!context.repositoryAccessToken) {
        throw notSupported('This GitLab connection does not expose credentials for repository cloning.');
      }
      const token = await context.repositoryAccessToken();
      const host = normalizeHost(context.host);
      const slug = normalizeSlug(repository.slug);
      return {
        cloneUrl: `https://${host}/${slug}.git`,
        authorization: { scheme: 'bearer', token, username: 'oauth2' },
      };
    },
    listPullRequests,
    getPullRequest,
    createPullRequest,
    updatePullRequest,
    closePullRequest,
    mergePullRequest,
    listComments,
    resolveReviewThread,
    createComment,
    updateComment,
    deleteComment,
    listReviews,
    getReview,
    createReview,
    updateReview,
    submitReview,
    dismissReview,
    deletePendingReview,
    listReviewComments,
    createReviewComment,
    updateReviewComment,
    deleteReviewComment,
    listRequestedReviewers,
    requestReviewers,
    removeRequestedReviewers,
  };
}

async function submitReviewAction(
  deps: GitLabVersionControlDependencies,
  input: {
    connection: IntegrationConnection;
    sourceId: string;
    pullRequestId: string;
    event: 'approve' | 'request-changes' | 'comment' | undefined;
    body?: string;
    commitId?: string;
  },
): Promise<Review> {
  const context = await deps.contextForConnection(input.connection);
  const mergeRequestIid = requirePositiveId(input.pullRequestId, 'merge request');
  if (input.event === 'request-changes') {
    // FLAGGED FOR MANUAL REVIEW (spec §6.2)
    throw notSupported('GitLab has no first-class request-changes review event.');
  }
  if (input.event === undefined) {
    // FLAGGED FOR MANUAL REVIEW (spec §6.2)
    throw notSupported('GitLab has no first-class pending review object.');
  }
  if (input.event === 'approve') {
    const body = input.body?.trim();
    await context.api.approveMergeRequest(input.sourceId, mergeRequestIid, input.commitId);
    const comment = body
      ? toPullRequestComment(
          context.host,
          input.sourceId,
          mergeRequestIid,
          await context.api.createMergeRequestNote(input.sourceId, mergeRequestIid, body),
        )
      : null;
    return {
      id: String(mergeRequestIid) + ':approval',
      url: comment?.url ?? mergeRequestUrl(context.host, input.sourceId, mergeRequestIid),
      author: comment?.author ?? null,
      body: comment?.body ?? null,
      state: 'approved',
      commitId: null,
      submittedAt: comment?.createdAt ?? null,
    };
  }
  const body = input.body?.trim();
  if (!body) throw new GitLabApiError('GitLab comment reviews require a body.', 400);
  const note = await context.api.createMergeRequestNote(input.sourceId, mergeRequestIid, body);
  const comment = toPullRequestComment(context.host, input.sourceId, mergeRequestIid, note);
  return {
    id: `${mergeRequestIid}:comment:${note.id}`,
    url: comment.url,
    author: comment.author,
    body: comment.body,
    state: 'commented',
    commitId: null,
    submittedAt: note.created_at,
  };
}

function toApprovalReview(host: string, sourceId: string, mergeRequestIid: number, user: GitLabUser): Review {
  return {
    id: `${mergeRequestIid}:approval:${user.id ?? user.username}`,
    url: mergeRequestUrl(host, sourceId, mergeRequestIid),
    author: displayName(user),
    body: null,
    state: 'approved',
    commitId: null,
    submittedAt: null,
  };
}

function toReviewComment(
  host: string,
  sourceId: string,
  mergeRequestIid: number,
  discussionId: string,
  note: GitLabDiscussionNote,
  replyToId: string | null,
  fallbackPosition?: GitLabDiscussionPosition,
): ReviewComment {
  const position = note.position ?? fallbackPosition;
  if (!position) throw new GitLabApiError('GitLab review comment is missing its diff position.', 502);
  const base = toPullRequestComment(host, sourceId, mergeRequestIid, note);
  const side = position.new_line !== null && position.new_line !== undefined ? 'right' : 'left';
  return {
    ...base,
    id: packDiscussionNoteId(mergeRequestIid, discussionId, note.id),
    path: side === 'right' ? position.new_path : position.old_path,
    line: side === 'right' ? (position.new_line ?? null) : (position.old_line ?? null),
    side,
    commitId: position.head_sha,
    replyToId,
  };
}

function mergeRequestUrl(host: string, sourceId: string, mergeRequestIid: number): string {
  return `https://${normalizeHost(host)}/${normalizeSlug(sourceId)}/-/merge_requests/${mergeRequestIid}`;
}

function packDiscussionId(mergeRequestIid: number, discussionId: string): string {
  if (!discussionId || discussionId.includes(':')) {
    throw new GitLabApiError('GitLab discussion id is invalid.', 400);
  }
  return `${mergeRequestIid}:${discussionId}`;
}

function packDiscussionNoteId(mergeRequestIid: number, discussionId: string, noteId: number): string {
  return `${packDiscussionId(mergeRequestIid, discussionId)}:${noteId}`;
}

function parseReviewReplyId(value: string): { mergeRequestIid: number; discussionId: string } {
  const parts = value.split(':');
  if (parts.length === 2) return parseDiscussionId(value);
  if (parts.length === 3 && parts[1]) {
    requirePositiveId(parts[2]!, 'discussion note');
    return {
      mergeRequestIid: requirePositiveId(parts[0]!, 'merge request'),
      discussionId: parts[1],
    };
  }
  throw new GitLabApiError('GitLab review reply id is invalid.', 400);
}

function parseDiscussionId(value: string): { mergeRequestIid: number; discussionId: string } {
  const parts = value.split(':');
  if (parts.length !== 2 || !parts[1]) throw new GitLabApiError('GitLab discussion id is invalid.', 400);
  return {
    mergeRequestIid: requirePositiveId(parts[0]!, 'merge request'),
    discussionId: parts[1],
  };
}

function parseDiscussionNoteId(value: string): { mergeRequestIid: number; discussionId: string; noteId: number } {
  const parts = value.split(':');
  if (parts.length !== 3 || !parts[1]) throw new GitLabApiError('GitLab discussion note id is invalid.', 400);
  return {
    mergeRequestIid: requirePositiveId(parts[0]!, 'merge request'),
    discussionId: parts[1],
    noteId: requirePositiveId(parts[2]!, 'discussion note'),
  };
}

function discussionPosition(notes: GitLabDiscussionNote[]): GitLabDiscussionPosition | undefined {
  return notes.find(note => note.position)?.position ?? undefined;
}

function discussionLine(path: string, line: number, side: 'left' | 'right') {
  const pathHash = createHash('sha1').update(path).digest('hex');
  const oldLine = side === 'left' ? line : undefined;
  const newLine = side === 'right' ? line : undefined;
  return {
    line_code: `${pathHash}_${oldLine ?? 0}_${newLine ?? 0}`,
    type: side === 'left' ? ('old' as const) : ('new' as const),
    old_line: oldLine,
    new_line: newLine,
  };
}

function toRequestedReviewers(mergeRequest: GitLabMergeRequest): RequestedReviewers {
  return {
    users: (mergeRequest.reviewers ?? []).map(user => user.username),
    teams: [],
  };
}

async function resolveMembers(api: GitLabApiClient, sourceId: string, usernames: string[]): Promise<GitLabMember[]> {
  return Promise.all(usernames.map(username => resolveMember(api, sourceId, username)));
}

async function resolveMember(api: GitLabApiClient, sourceId: string, username: string): Promise<GitLabMember> {
  const normalized = username.trim();
  if (!normalized) throw new GitLabApiError('GitLab reviewer username is invalid.', 400);
  const members = await api.listProjectMembers(sourceId, { query: normalized });
  const member = members.find(candidate => candidate.username.toLowerCase() === normalized.toLowerCase());
  if (!member) throw new GitLabApiError(`GitLab reviewer ${normalized} is not a project member.`, 404);
  return member;
}

async function reviewerIds(api: GitLabApiClient, sourceId: string, users: GitLabUser[]): Promise<number[]> {
  return Promise.all(
    users.map(async user => user.id ?? (await resolveMember(api, sourceId, user.username)).id),
  );
}

function rejectTeamReviewers(teams: string[] | undefined): void {
  if (!teams?.length) return;
  // FLAGGED FOR MANUAL REVIEW (spec §6.2)
  throw notSupported('GitLab merge requests do not have a direct team-reviewer equivalent.');
}

function notSupported(message: string): GitLabApiError {
  return new GitLabApiError(message, 501);
}

function toPullRequest(mergeRequest: GitLabMergeRequest): PullRequest {
  return {
    id: String(mergeRequest.iid),
    title: mergeRequest.title,
    url: mergeRequest.web_url,
    author: displayName(mergeRequest.author),
    assignees: mergeRequest.assignees?.map(user => user.username),
    requestedReviewers: mergeRequest.reviewers?.map(user => user.username),
    labels: mergeRequest.labels,
    body: mergeRequest.description?.trim() ? mergeRequest.description : null,
    state: mergeRequest.state === 'closed' || mergeRequest.state === 'merged' ? 'closed' : 'open',
    draft: isDraft(mergeRequest),
    merged: mergeRequest.state === 'merged' || Boolean(mergeRequest.merged_at),
    mergeable: mergeableState(mergeRequest.merge_status),
    baseBranch: mergeRequest.target_branch,
    headBranch: mergeRequest.source_branch,
    headSha: mergeRequest.sha,
    createdAt: mergeRequest.created_at,
    updatedAt: mergeRequest.updated_at,
  };
}

function toPullRequestComment(
  host: string,
  sourceId: string,
  mergeRequestIid: number,
  note: GitLabNote,
): PullRequestComment {
  return {
    id: `${mergeRequestIid}:${note.id}`,
    url: `https://${normalizeHost(host)}/${normalizeSlug(sourceId)}/-/merge_requests/${mergeRequestIid}#note_${note.id}`,
    author: displayName(note.author),
    body: note.body,
    createdAt: note.created_at,
    updatedAt: note.updated_at ?? note.created_at,
  };
}

function displayName(user: { name?: string | null; username: string } | null | undefined): string | null {
  return user?.username || user?.name?.trim() || null;
}

function isDraft(mergeRequest: GitLabMergeRequest): boolean {
  return mergeRequest.draft ?? mergeRequest.work_in_progress ?? /^(?:draft:|\[draft\])/i.test(mergeRequest.title);
}

function mergeableState(status: string | undefined): boolean | null {
  if (status === 'can_be_merged') return true;
  if (status === 'cannot_be_merged') return false;
  return null;
}

function combinedCommitMessage(title: string | undefined, body: string | undefined): string | undefined {
  const parts = [title?.trim(), body?.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

function parseNoteId(value: string): { mergeRequestIid: number; noteId: number } {
  const parts = value.split(':');
  if (parts.length !== 2) throw new GitLabApiError('GitLab merge request note id is invalid.', 400);
  return {
    mergeRequestIid: requirePositiveId(parts[0]!, 'merge request'),
    noteId: requirePositiveId(parts[1]!, 'note'),
  };
}

function parsePositiveCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 1;
  const page = parsePositiveInteger(cursor);
  if (page === null) throw new GitLabApiError('GitLab cursor must be a positive page number.', 400);
  return page;
}

function requirePositiveId(value: string, resource: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed === null) throw new GitLabApiError(`GitLab ${resource} id must be a positive integer.`, 400);
  return parsed;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseConnection(value: unknown): IntegrationConnection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const connection = value as Record<string, unknown>;
  if (connection.type === 'oauth' && typeof connection.accessToken === 'string' && connection.accessToken.length > 0) {
    return { type: 'oauth', accessToken: connection.accessToken };
  }
  if (
    connection.type === 'app-installation' &&
    Number.isSafeInteger(connection.installationId) &&
    Number(connection.installationId) > 0
  ) {
    return { type: 'app-installation', installationId: Number(connection.installationId) };
  }
  return null;
}

function normalizeHost(value: string): string {
  const host = value.trim();
  if (!host || host.includes('/') || host.includes('@')) throw new GitLabApiError('GitLab host is invalid.', 400);
  let parsed: URL;
  try {
    parsed = new URL(`https://${host}`);
  } catch {
    throw new GitLabApiError('GitLab host is invalid.', 400);
  }
  if (parsed.host !== host) throw new GitLabApiError('GitLab host is invalid.', 400);
  return host;
}

function normalizeSlug(value: string): string {
  const slug = value.replace(/^\/+|\/+$/g, '');
  const segments = slug.split('/');
  if (!slug || segments.some(segment => !/^[A-Za-z0-9_.-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new GitLabApiError('GitLab repository slug is invalid.', 400);
  }
  return slug;
}
