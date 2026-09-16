import { describe, expect, it, vi } from 'vitest';

import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
import { GitLabApiClient, GitLabApiError } from './api.js';
import type { GitLabMergeRequest, GitLabNote } from './api.js';
import { buildGitLabVersionControl, tokenUrl } from './version-control.js';

const CONNECTION = { type: 'oauth' as const, accessToken: 'glpat-secret' };

function setup() {
  const storage = new SourceControlStorageInMemory('gitlab');
  const api = new GitLabApiClient({
    baseUrl: 'https://gitlab.example.com',
    accessToken: 'glpat-secret',
    fetchImpl: vi.fn<typeof fetch>(),
  });
  const contextForConnection = vi.fn(async () => ({
    api,
    connection: { type: 'oauth' as const, accessToken: 'glpat-secret' },
    host: 'gitlab.example.com',
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
        connection: { type: 'oauth', accessToken: 'glpat-secret' },
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

  it('returns repository clone access from the stored installation connection', async () => {
    const result = setup();
    const { repository } = await register(result);

    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      cloneUrl: 'https://gitlab.example.com/acme/app.git',
      authorization: { scheme: 'bearer', token: 'glpat-secret' },
    });
    expect(result.contextForConnection).toHaveBeenLastCalledWith({
      type: 'oauth',
      accessToken: 'glpat-secret',
    });
    expect(tokenUrl('gitlab.example.com', 'acme/app', 'glpat-secret')).toBe(
      'https://oauth2:glpat-secret@gitlab.example.com/acme/app.git',
    );
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
        repositories: [{ externalId: '102', slug: '../escape', defaultBranch: 'main' }],
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
  });
});
