import { describe, expect, it, vi } from 'vitest';

import { createGithubReviewPublisher } from './review-publisher.js';

const PR_URL = 'https://github.com/acme/repo/pull/17';
const ITEM = { externalSource: { type: 'pull-request' as const, externalId: 'github-pr:17', url: PR_URL } };

const storage = {
  connections: {
    list: async () => [
      {
        id: 'connection-1',
        factoryProjectId: 'project-1',
        integrationId: 'github',
        installationId: 'installation-1',
        createdByUserId: 'user-1',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      },
    ],
  },
  installations: {
    get: async () => ({
      id: 'installation-1',
      integrationId: 'github',
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '4242',
      accountName: 'acme',
      accountType: 'organization',
      providerMetadata: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
    }),
  },
  projectRepositories: {
    list: async () => [{ id: 'project-repository-1', connectionId: 'connection-1', repositoryId: 'repository-1' }],
  },
  repositories: {
    get: async () => ({ id: 'repository-1', installationId: 'installation-1', externalId: '99', slug: 'acme/repo' }),
  },
};

function publisherWith(createReview: () => Promise<{ url: string }>) {
  const createComment = vi.fn(async () => ({ url: `${PR_URL}#issuecomment-1` }));
  const versionControl = { createReview: vi.fn(createReview), createComment };
  return {
    versionControl,
    publish: createGithubReviewPublisher({ storage, versionControl }).publish,
  };
}

const INPUT = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  item: ITEM,
  verdict: 'request-changes' as const,
  body: 'Verdict: request changes\n',
};

describe('github review publisher', () => {
  it('submits the verdict as a review against the repository the card pins', async () => {
    const { versionControl, publish } = publisherWith(async () => ({ url: `${PR_URL}#pullrequestreview-1` }));

    expect(await publish(INPUT)).toEqual({ url: `${PR_URL}#pullrequestreview-1`, event: 'request-changes' });
    expect(versionControl.createReview).toHaveBeenCalledWith({
      connection: { type: 'app-installation', installationId: 4242 },
      sourceId: 'acme/repo',
      pullRequestId: '17',
      event: 'request-changes',
      body: INPUT.body,
    });
    expect(versionControl.createComment).not.toHaveBeenCalled();
  });

  // A comment *review* would land on `pullRequestReviewSubmitted`, which ignores
  // anything but `changes_requested`, and the author would never be woken.
  it('falls back to a pull request comment when GitHub refuses a self-review', async () => {
    const { versionControl, publish } = publisherWith(async () => {
      throw Object.assign(new Error('Unprocessable Entity'), { status: 422 });
    });

    expect(await publish(INPUT)).toEqual({ url: `${PR_URL}#issuecomment-1`, event: 'comment' });
    expect(versionControl.createReview).toHaveBeenCalledOnce();
    expect(versionControl.createComment).toHaveBeenCalledWith({
      connection: { type: 'app-installation', installationId: 4242 },
      sourceId: 'acme/repo',
      pullRequestId: '17',
      body: INPUT.body,
    });
  });

  it('rethrows anything that is not GitHub refusing the verdict', async () => {
    const { versionControl, publish } = publisherWith(async () => {
      throw Object.assign(new Error('Bad credentials'), { status: 401 });
    });

    await expect(publish(INPUT)).rejects.toThrow('Bad credentials');
    expect(versionControl.createComment).not.toHaveBeenCalled();
  });
});
