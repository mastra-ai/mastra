import { describe, expect, it, vi } from 'vitest';

import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
import { GitLabApiClient, GitLabApiError } from './api.js';
import type { GitLabDiscussionPosition, GitLabMergeRequest, GitLabNote } from './api.js';
import { buildGitLabVersionControl } from './version-control.js';

const CONNECTION = { type: 'oauth' as const, accessToken: 'glpat-secret' };
const POSITION: GitLabDiscussionPosition = {
  position_type: 'text',
  base_sha: 'base-sha',
  start_sha: 'start-sha',
  head_sha: 'head-sha',
  old_path: 'src/app.ts',
  new_path: 'src/app.ts',
  new_line: 42,
};

function setup(repositoryAccessToken: string | null = 'glpat-secret') {
  const storage = new SourceControlStorageInMemory('gitlab');
  const api = new GitLabApiClient({
    baseUrl: 'https://gitlab.example.com',
    accessToken: 'glpat-secret',
    fetchImpl: vi.fn<typeof fetch>(),
  });
  const contextForConnection = vi.fn(async () => ({
    api,
    connection: { type: 'oauth' as const, accessToken: 'gitlab-connection:connection-1' },
    host: 'gitlab.example.com',
    repositoryAccessToken: repositoryAccessToken ? async () => repositoryAccessToken : undefined,
  }));
  const versionControl = buildGitLabVersionControl({ contextForConnection });
  versionControl.initialize({ storage });
  return { storage, versionControl, contextForConnection, api };
}

async function register(setupResult: ReturnType<typeof setup>) {
  const installation = await setupResult.versionControl.registerInstallation({
    orgId: 'org-1',
    userId: 'user-1',
    installation: {
      externalId: 'connection-1',
      accountName: 'acme',
      accountType: 'group',
      metadata: {
        connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' },
        scope: 'group',
      },
    },
  });
  const [repository] = await setupResult.versionControl.registerRepositories({
    orgId: 'org-1',
    installationId: installation.id,
    repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main', metadata: { archived: false } }],
  });
  return { installation, repository: repository! };
}

function mergeRequest(overrides: Partial<GitLabMergeRequest> = {}): GitLabMergeRequest {
  return {
    id: 1001,
    iid: 17,
    project_id: 101,
    title: 'Add feature',
    description: 'Details',
    state: 'opened',
    web_url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
    author: { id: 1, username: 'alice', name: 'Alice' },
    assignees: [{ id: 2, username: 'bob' }],
    reviewers: [{ id: 3, username: 'carol' }],
    labels: ['feature'],
    source_branch: 'feature',
    target_branch: 'main',
    sha: 'head-sha',
    merge_status: 'can_be_merged',
    draft: false,
    merged_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    ...overrides,
  };
}

function note(overrides: Partial<GitLabNote> = {}): GitLabNote {
  return {
    id: 91,
    body: 'Looks good',
    author: { id: 1, username: 'alice' },
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...overrides,
  };
}

describe('buildGitLabVersionControl', () => {
  it('upserts installations and repositories with the resolved connection descriptor', async () => {
    const result = setup();
    const first = await register(result);

    const updatedInstallation = await result.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-2',
      installation: {
        externalId: 'connection-1',
        accountName: 'Acme Group',
        metadata: { connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' } },
      },
    });
    const [updatedRepository] = await result.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: first.installation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'trunk' }],
    });

    expect(updatedInstallation.id).toBe(first.installation.id);
    expect(updatedInstallation).toMatchObject({
      connectedByUserId: 'user-2',
      accountName: 'Acme Group',
      providerMetadata: {
        connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' },
        host: 'gitlab.example.com',
      },
    });
    expect(updatedRepository).toMatchObject({
      id: first.repository.id,
      slug: 'acme/app',
      defaultBranch: 'trunk',
    });
    expect(result.storage.installationsRows).toHaveLength(1);
    expect(result.storage.repositoriesRows).toHaveLength(1);
  });

  it('resolves the provider target without exposing repository credentials', async () => {
    const result = setup();
    const { repository } = await register(result);

    await expect(
      result.versionControl.getRepositoryTarget({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' },
      sourceId: 'acme/app',
    });
  });

  it('returns repository clone access from the stored installation connection', async () => {
    const result = setup();
    const { repository } = await register(result);

    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      cloneUrl: 'https://gitlab.example.com/acme/app.git',
      authorization: { scheme: 'bearer', token: 'glpat-secret', username: 'oauth2' },
    });
    expect(result.contextForConnection).toHaveBeenLastCalledWith({
      type: 'oauth',
      accessToken: 'gitlab-connection:connection-1',
    });
  });

  it('does not expose a Platform connection selector as a repository credential', async () => {
    const result = setup(null);
    const { repository } = await register(result);

    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 501 });
  });

  it('lists and normalizes merge requests while filtering drafts', async () => {
    const result = setup();
    vi.spyOn(result.api, 'listMergeRequests').mockResolvedValue([
      mergeRequest(),
      mergeRequest({ iid: 18, title: 'Draft: follow-up', draft: true }),
    ]);

    await expect(
      result.versionControl.listPullRequests({
        connection: CONNECTION,
        sourceId: 'acme/app',
        state: 'open',
        includeDrafts: false,
        cursor: '2',
      }),
    ).resolves.toEqual({
      pullRequests: [
        {
          id: '17',
          title: 'Add feature',
          url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
          author: 'alice',
          assignees: ['bob'],
          requestedReviewers: ['carol'],
          labels: ['feature'],
          body: 'Details',
          state: 'open',
          draft: false,
          merged: false,
          mergeable: true,
          baseBranch: 'main',
          headBranch: 'feature',
          headSha: 'head-sha',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-02T00:00:00Z',
        },
      ],
      nextCursor: null,
    });
    expect(result.api.listMergeRequests).toHaveBeenCalledWith('acme/app', { page: 2, state: 'opened' });
  });

  it('includes both closed and merged requests in provider-neutral closed listings', async () => {
    const result = setup();
    vi.spyOn(result.api, 'listMergeRequests').mockResolvedValue([
      mergeRequest({ iid: 17, state: 'closed' }),
      mergeRequest({ iid: 18, state: 'merged', merged_at: '2026-09-05T00:00:00Z' }),
      mergeRequest({ iid: 19, state: 'opened' }),
    ]);

    const page = await result.versionControl.listPullRequests({
      connection: CONNECTION,
      sourceId: 'acme/app',
      state: 'closed',
    });

    expect(page.pullRequests.map(pullRequest => ({ id: pullRequest.id, merged: pullRequest.merged }))).toEqual([
      { id: '17', merged: false },
      { id: '18', merged: true },
    ]);
    expect(result.api.listMergeRequests).toHaveBeenCalledWith('acme/app', { page: 1, state: 'all' });
  });

  it('creates, closes, and squash-merges merge requests with GitLab request fields', async () => {
    const result = setup();
    const create = vi
      .spyOn(result.api, 'createMergeRequest')
      .mockResolvedValue(mergeRequest({ title: 'Draft: Add feature', draft: true }));
    const update = vi.spyOn(result.api, 'updateMergeRequest').mockResolvedValue(mergeRequest({ state: 'closed' }));
    const merge = vi.spyOn(result.api, 'mergeMergeRequest').mockResolvedValue(
      mergeRequest({
        state: 'merged',
        merged_at: '2026-09-05T00:00:00Z',
        squash_commit_sha: 'squash-sha',
      }),
    );

    await result.versionControl.createPullRequest({
      connection: CONNECTION,
      sourceId: 'acme/app',
      title: 'Add feature',
      body: 'Details',
      baseBranch: 'main',
      headBranch: 'feature',
      draft: true,
    });
    await result.versionControl.closePullRequest({
      connection: CONNECTION,
      sourceId: 'acme/app',
      pullRequestId: '17',
    });
    await expect(
      result.versionControl.mergePullRequest({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        method: 'squash',
        commitTitle: 'Feature',
        commitMessage: 'Details',
      }),
    ).resolves.toEqual({ merged: true, message: 'Merge request merged.', sha: 'squash-sha' });
    await expect(
      result.versionControl.mergePullRequest({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        method: 'rebase',
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 501 });

    expect(create).toHaveBeenCalledWith('acme/app', {
      sourceBranch: 'feature',
      targetBranch: 'main',
      title: 'Draft: Add feature',
      description: 'Details',
    });
    expect(update).toHaveBeenCalledWith('acme/app', 17, {
      title: undefined,
      description: undefined,
      targetBranch: undefined,
      stateEvent: 'close',
    });
    expect(merge).toHaveBeenCalledWith('acme/app', 17, {
      squash: true,
      mergeCommitMessage: undefined,
      squashCommitMessage: 'Feature\n\nDetails',
    });
  });

  it('returns null for missing merge requests and rejects malformed ids', async () => {
    const result = setup();
    vi.spyOn(result.api, 'getMergeRequest').mockRejectedValue(new GitLabApiError('Not found', 404));

    await expect(
      result.versionControl.getPullRequest({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
      }),
    ).resolves.toBeNull();
    await expect(
      result.versionControl.getPullRequest({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: 'not-an-iid',
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
  });

  it('lists, creates, updates, and deletes merge request notes with packed ids', async () => {
    const result = setup();
    vi.spyOn(result.api, 'listMergeRequestNotes').mockResolvedValue([note(), note({ id: 93, system: true })]);
    vi.spyOn(result.api, 'createMergeRequestNote').mockResolvedValue(note({ id: 92, body: 'New comment' }));
    vi.spyOn(result.api, 'updateMergeRequestNote').mockResolvedValue(note({ body: 'Updated comment' }));
    vi.spyOn(result.api, 'deleteMergeRequestNote').mockResolvedValue();

    await expect(
      result.versionControl.listComments({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
      }),
    ).resolves.toMatchObject({ comments: [{ id: '17:91', author: 'alice', body: 'Looks good' }] });
    await expect(
      result.versionControl.createComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        body: 'New comment',
      }),
    ).resolves.toMatchObject({ id: '17:92', body: 'New comment' });
    await result.versionControl.updateComment({
      connection: CONNECTION,
      sourceId: 'acme/app',
      commentId: '17:91',
      body: 'Updated comment',
    });
    await result.versionControl.deleteComment({
      connection: CONNECTION,
      sourceId: 'acme/app',
      commentId: '17:91',
    });

    expect(result.api.updateMergeRequestNote).toHaveBeenCalledWith('acme/app', 17, 91, 'Updated comment');
    expect(result.api.deleteMergeRequestNote).toHaveBeenCalledWith('acme/app', 17, 91);
    await expect(
      result.versionControl.updateComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        commentId: '91',
        body: 'Invalid',
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
  });

  it('maps approvals to reviews and submits approve and comment reviews', async () => {
    const result = setup();
    vi.spyOn(result.api, 'getMergeRequestApprovals').mockResolvedValue({
      approved: true,
      approved_by: [{ user: { id: 3, username: 'carol' } }],
    });
    const approve = vi.spyOn(result.api, 'approveMergeRequest').mockResolvedValue(mergeRequest());
    const createNote = vi
      .spyOn(result.api, 'createMergeRequestNote')
      .mockImplementation(async (_projectId, _iid, body) =>
        note({ id: body === 'Approved with note' ? 93 : 94, body }),
      );

    await expect(
      result.versionControl.listReviews({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
      }),
    ).resolves.toMatchObject({
      reviews: [{ id: '17:approval:3', author: 'carol', state: 'approved' }],
      nextCursor: null,
    });
    await expect(
      result.versionControl.createReview({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        event: 'approve',
        body: ' Approved with note ',
        commitId: 'head-sha',
      }),
    ).resolves.toMatchObject({ state: 'approved', body: 'Approved with note' });
    await expect(
      result.versionControl.submitReview({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        reviewId: '17:pending',
        event: 'comment',
        body: ' Reviewed ',
      }),
    ).resolves.toMatchObject({ id: '17:comment:94', state: 'commented', body: 'Reviewed' });

    expect(approve).toHaveBeenCalledWith('acme/app', 17, 'head-sha');
    expect(createNote).toHaveBeenNthCalledWith(1, 'acme/app', 17, 'Approved with note');
    expect(createNote).toHaveBeenNthCalledWith(2, 'acme/app', 17, 'Reviewed');
    expect(approve.mock.invocationCallOrder[0]!).toBeLessThan(createNote.mock.invocationCallOrder[0]!);
  });

  it('rejects ambiguous review operations with explicit 501 errors', async () => {
    const result = setup();
    const reference = {
      connection: CONNECTION,
      sourceId: 'acme/app',
      pullRequestId: '17',
      reviewId: '17:pending',
    };

    await expect(
      result.versionControl.submitReview({ ...reference, event: 'request-changes', body: 'Please revise' }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 501 });
    await expect(result.versionControl.updateReview({ ...reference, body: 'Updated' })).rejects.toMatchObject<
      Partial<GitLabApiError>
    >({ status: 501 });
    await expect(result.versionControl.dismissReview({ ...reference, message: 'Dismiss' })).rejects.toMatchObject<
      Partial<GitLabApiError>
    >({ status: 501 });
    await expect(result.versionControl.deletePendingReview(reference)).rejects.toMatchObject<Partial<GitLabApiError>>({
      status: 501,
    });
  });

  it('creates, lists, replies to, updates, and deletes diff discussion comments', async () => {
    const result = setup();
    vi.spyOn(result.api, 'getMergeRequest').mockResolvedValue(
      mergeRequest({ diff_refs: { base_sha: 'base-sha', start_sha: 'start-sha', head_sha: 'head-sha' } }),
    );
    const createDiscussion = vi.spyOn(result.api, 'createMergeRequestDiscussion').mockResolvedValue({
      id: 'discussion-1',
      notes: [{ ...note({ id: 201, body: 'Please revise' }), position: POSITION }],
    });
    vi.spyOn(result.api, 'listMergeRequestDiscussions').mockResolvedValue([
      {
        id: 'discussion-1',
        notes: [
          { ...note({ id: 201, body: 'Please revise' }), position: POSITION },
          { ...note({ id: 202, body: 'General reply' }), position: null },
        ],
      },
    ]);
    vi.spyOn(result.api, 'getMergeRequestDiscussion').mockResolvedValue({
      id: 'discussion-1',
      notes: [{ ...note({ id: 201, body: 'Please revise' }), position: POSITION }],
    });
    const addNote = vi.spyOn(result.api, 'addMergeRequestDiscussionNote').mockResolvedValue({
      ...note({ id: 203, body: 'Reply' }),
      position: null,
    });
    const updateNote = vi.spyOn(result.api, 'updateMergeRequestDiscussionNote').mockResolvedValue({
      ...note({ id: 202, body: 'Updated reply' }),
      position: null,
    });
    const deleteNote = vi.spyOn(result.api, 'deleteMergeRequestDiscussionNote').mockResolvedValue();
    const resolveDiscussion = vi.spyOn(result.api, 'resolveMergeRequestDiscussion').mockResolvedValue({
      id: 'discussion-1',
      notes: [{ ...note({ id: 201, body: 'Please revise' }), position: POSITION, resolved: true }],
    });

    await expect(
      result.versionControl.createReviewComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        body: 'Please revise',
        commitId: 'head-sha',
        path: 'src/app.ts',
        line: 42,
        side: 'right',
        startLine: 40,
        startSide: 'right',
      }),
    ).resolves.toMatchObject({
      id: '17:discussion-1:201',
      path: 'src/app.ts',
      line: 42,
      side: 'right',
      commitId: 'head-sha',
    });
    expect(createDiscussion).toHaveBeenCalledWith('acme/app', 17, {
      body: 'Please revise',
      commitId: 'head-sha',
      position: {
        position_type: 'text',
        base_sha: 'base-sha',
        start_sha: 'start-sha',
        head_sha: 'head-sha',
        old_path: 'src/app.ts',
        new_path: 'src/app.ts',
        old_line: undefined,
        new_line: 42,
        line_range: {
          start: {
            line_code: '216381173f187cf4c2baf119193855699f4bc616_0_40',
            type: 'new',
            old_line: undefined,
            new_line: 40,
          },
          end: {
            line_code: '216381173f187cf4c2baf119193855699f4bc616_0_42',
            type: 'new',
            old_line: undefined,
            new_line: 42,
          },
        },
      },
    });

    await expect(
      result.versionControl.listReviewComments({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
      }),
    ).resolves.toMatchObject({
      comments: [
        { id: '17:discussion-1:201', replyToId: null },
        { id: '17:discussion-1:202', replyToId: '17:discussion-1:201', path: 'src/app.ts', line: 42 },
      ],
      nextCursor: null,
    });
    await expect(
      result.versionControl.createReviewComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        body: 'Reply',
        replyToId: '17:discussion-1:201',
      }),
    ).resolves.toMatchObject({ id: '17:discussion-1:203', replyToId: '17:discussion-1:201' });
    await expect(
      result.versionControl.updateReviewComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        commentId: '17:discussion-1:202',
        body: 'Updated reply',
      }),
    ).resolves.toMatchObject({
      id: '17:discussion-1:202',
      replyToId: '17:discussion-1:201',
      path: 'src/app.ts',
      line: 42,
    });
    await result.versionControl.deleteReviewComment({
      connection: CONNECTION,
      sourceId: 'acme/app',
      commentId: '17:discussion-1:201',
    });
    await result.versionControl.resolveReviewThread?.({
      connection: CONNECTION,
      sourceId: 'acme/app',
      commentId: '17:discussion-1:202',
      resolved: true,
    });

    expect(addNote).toHaveBeenCalledWith('acme/app', 17, 'discussion-1', 'Reply');
    expect(updateNote).toHaveBeenCalledWith('acme/app', 17, 'discussion-1', 202, 'Updated reply');
    expect(deleteNote).toHaveBeenCalledWith('acme/app', 17, 'discussion-1', 201);
    expect(resolveDiscussion).toHaveBeenCalledWith('acme/app', 17, 'discussion-1', true);
  });

  it('rejects new diff comments while GitLab diff refs are unavailable', async () => {
    const result = setup();
    vi.spyOn(result.api, 'getMergeRequest').mockResolvedValue(mergeRequest({ diff_refs: null }));

    await expect(
      result.versionControl.createReviewComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        body: 'Please revise',
        commitId: 'head-sha',
        path: 'src/app.ts',
        line: 42,
        side: 'right',
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 409 });
  });

  it('rejects a diff comment prepared against a stale merge request head', async () => {
    const result = setup();
    const createDiscussion = vi.spyOn(result.api, 'createMergeRequestDiscussion');
    vi.spyOn(result.api, 'getMergeRequest').mockResolvedValue(
      mergeRequest({ diff_refs: { base_sha: 'base-sha', start_sha: 'start-sha', head_sha: 'new-head' } }),
    );

    await expect(
      result.versionControl.createReviewComment({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        body: 'Please revise',
        commitId: 'old-head',
        path: 'src/app.ts',
        line: 42,
        side: 'right',
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 409 });
    expect(createDiscussion).not.toHaveBeenCalled();
  });

  it('lists, adds, and removes user reviewers while rejecting teams', async () => {
    const result = setup();
    const existing = mergeRequest({ reviewers: [{ id: 2, username: 'bob' }] });
    const withAlice = mergeRequest({
      reviewers: [
        { id: 2, username: 'bob' },
        { id: 1, username: 'alice' },
      ],
    });
    const aliceOnly = mergeRequest({ reviewers: [{ id: 1, username: 'alice' }] });
    vi.spyOn(result.api, 'getMergeRequest')
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(withAlice);
    vi.spyOn(result.api, 'listProjectMembers').mockResolvedValue([{ id: 1, username: 'alice', name: 'Alice' }]);
    const setReviewers = vi
      .spyOn(result.api, 'setMergeRequestReviewers')
      .mockResolvedValueOnce(withAlice)
      .mockResolvedValueOnce(aliceOnly);

    await expect(
      result.versionControl.listRequestedReviewers({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
      }),
    ).resolves.toEqual({ users: ['bob'], teams: [] });
    await expect(
      result.versionControl.requestReviewers({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        users: ['alice'],
      }),
    ).resolves.toEqual({ users: ['bob', 'alice'], teams: [] });
    await expect(
      result.versionControl.removeRequestedReviewers({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        users: ['bob'],
      }),
    ).resolves.toEqual({ users: ['alice'], teams: [] });

    expect(result.api.listProjectMembers).toHaveBeenCalledWith('acme/app', { query: 'alice' });
    expect(setReviewers).toHaveBeenNthCalledWith(1, 'acme/app', 17, [2, 1]);
    expect(setReviewers).toHaveBeenNthCalledWith(2, 'acme/app', 17, [1]);
    await expect(
      result.versionControl.requestReviewers({
        connection: CONNECTION,
        sourceId: 'acme/app',
        pullRequestId: '17',
        teams: ['backend'],
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 501 });
  });

  it('rejects malformed connection metadata and repository references', async () => {
    const result = setup();

    await expect(
      result.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: 'connection-1' },
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });

    const { installation, repository } = await register(result);
    installation.providerMetadata.connection = { type: 'oauth', accessToken: '' };
    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 500 });
    await expect(
      result.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [
          { externalId: '102', slug: 'acme/valid', defaultBranch: 'main' },
          { externalId: '103', slug: '../escape', defaultBranch: 'main' },
        ],
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
    expect(result.storage.repositoriesRows).toHaveLength(1);
    await expect(
      result.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '104', slug: 'acme/repo?token=leak', defaultBranch: 'main' }],
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
  });
});
