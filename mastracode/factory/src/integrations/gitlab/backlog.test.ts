import { describe, expect, it, vi } from 'vitest';

import { encodeSourceId, GitLabIntegration } from './integration.js';
import { ingestLinkedGitLabRepositoryBacklog } from './routes.js';

describe('GitLab linked repository backlog', () => {
  it('imports open MRs and issues across pages from the linked repository', async () => {
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab, 'sourceControlStorage', 'get').mockReturnValue({
      projectRepositories: { get: vi.fn().mockResolvedValue({ id: 'link-1', connectionId: 'connection-1' }) },
      connections: { get: vi.fn().mockResolvedValue({ integrationId: 'gitlab', factoryProjectId: 'factory-1' }) },
    } as never);
    vi.spyOn(gitlab, 'getLinkedRepository').mockResolvedValue({
      repository: { id: 'repo-1', externalId: '10', slug: 'acme/app' }, host: 'gitlab.com',
    } as never);
    vi.spyOn(gitlab.versionControl, 'getRepositoryTarget').mockResolvedValue({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' }, sourceId: '10:acme/app',
    });
    const pr = {
      id: '5', title: 'Review', url: 'https://gitlab.com/acme/app/-/merge_requests/5', author: 'rhys',
      assignees: [], requestedReviewers: [], body: '', state: 'open', draft: false, merged: false,
      mergeable: true, baseBranch: 'main', headBranch: 'feature', headSha: 'abc',
      createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z',
    } as const;
    const listPrs = vi.spyOn(gitlab.versionControl, 'listPullRequests')
      .mockResolvedValueOnce({ pullRequests: [pr], nextCursor: '2' })
      .mockResolvedValueOnce({ pullRequests: [], nextCursor: null });
    const sourceId = encodeSourceId({ host: 'gitlab.com', projectId: '10' });
    const listIssues = vi.spyOn(gitlab.intake, 'listIssues').mockResolvedValue({
      issues: [{
        id: '42', identifier: 'acme/app#42', title: 'Fix', url: 'https://gitlab.com/acme/app/-/issues/42',
        author: 'grace', state: 'opened', stateType: 'unstarted', priority: null, assignee: null,
        assignees: [], source: 'acme/app', sourceId, labels: [], commentCount: 0,
        createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
      }], nextCursor: null,
    });
    const ingest = vi.fn().mockResolvedValue({ status: 'committed' });

    await ingestLinkedGitLabRepositoryBacklog({
      gitlab, orgId: 'org1', projectRepositoryId: 'link-1', ingestFactoryEvent: ingest,
    });

    expect(listPrs).toHaveBeenCalledTimes(2);
    expect(listIssues).toHaveBeenCalledWith(expect.objectContaining({ sourceIds: [sourceId] }));
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ingest).toHaveBeenCalledWith(expect.objectContaining({
      event: 'Merge Request Hook', deliveryId: expect.stringMatching(/^poll:merge-request:/),
      payload: expect.objectContaining({ object_attributes: expect.objectContaining({ iid: 5, action: 'open' }) }),
    }));
    expect(ingest).toHaveBeenCalledWith(expect.objectContaining({
      event: 'Issue Hook', deliveryId: expect.stringMatching(/^poll:issue:/),
      payload: expect.objectContaining({ object_attributes: expect.objectContaining({ iid: 42, action: 'open' }) }),
    }));
  });
});
