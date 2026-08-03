import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultFactoryRules } from '../../../rules/defaults.js';
import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
import type { IntegrationContext } from '../../base.js';

import { createPlatformStorageForTests, mountApiRoutes } from '../test-utils.js';
import { GithubInstallationBrokenError } from './errors.js';
import { PlatformGithubIntegration } from './integration.js';

const config = {
  baseUrl: 'https://platform.example.com/v1',
  accessToken: 'platform-token',
};

function fakeAuth(tenant: { orgId?: string; userId: string } | undefined = { orgId: 'org-1', userId: 'user-1' }) {
  return {
    enabled: () => true,
    ensureUser: vi.fn(async () => ({ workosId: tenant?.userId ?? 'user-1', organizationId: tenant?.orgId })),
    tenant: () => tenant,
    isOrganizationAdmin: vi.fn(async () => true),
  };
}

const actor = { login: 'ada', avatarUrl: null, htmlUrl: 'https://github.com/ada' };
const issue = {
  number: 12,
  state: 'open' as const,
  title: 'Fix intake',
  body: 'Issue body',
  htmlUrl: 'https://github.com/acme/app/issues/12',
  labels: ['bug'],
  assignees: ['grace'],
  commentCount: 1,
  user: actor,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};
const pullRequest = {
  number: 34,
  title: 'Ship intake',
  body: 'Ready to ship',
  state: 'open' as const,
  htmlUrl: 'https://github.com/acme/app/pull/34',
  merged: false,
  mergeable: true,
  draft: false,
  head: { ref: 'feat/intake', sha: 'abc123' },
  base: { ref: 'main', repo: { id: 101, fullName: 'acme/app' } },
  user: actor,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubEnv('MASTRA_SHARED_API_URL', config.baseUrl);
  vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', config.accessToken);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function createIntegration(fetchImpl?: typeof fetch): PlatformGithubIntegration {
  if (fetchImpl) vi.stubGlobal('fetch', fetchImpl);
  return new PlatformGithubIntegration();
}

describe('PlatformGithubIntegration', () => {
  it('lists platform-owned installations and repositories as Intake sources', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          installations: [
            {
              installationId: 7,
              accountLogin: 'acme',
              accountType: 'Organization',
              suspendedAt: null,
              usable: true,
            },
            {
              installationId: 8,
              accountLogin: 'old',
              accountType: 'Organization',
              suspendedAt: '2026-07-01T00:00:00Z',
              usable: false,
            },
          ],
          pendingRequests: [],
        }),
      )
      .mockResolvedValueOnce(
        json({
          repositories: [
            {
              id: 101,
              owner: 'acme',
              name: 'app',
              fullName: 'acme/app',
              private: true,
              defaultBranch: 'main',
              htmlUrl: 'https://github.com/acme/app',
            },
          ],
        }),
      );
    const { sourceControl } = await createPlatformStorageForTests();
    const integration = createIntegration(fetchImpl);
    const storage = sourceControl.forIntegration('github');
    integration.versionControl.initialize({ storage });

    await expect(integration.intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      {
        id: 'acme/app',
        name: 'acme/app',
        type: 'repository',
        metadata: expect.objectContaining({ installationId: 7, repositoryId: 101, defaultBranch: 'main' }),
      },
    ]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://platform.example.com/v1/server/github-app/installations',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer platform-token' }) }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://platform.example.com/v1/server/github-app/installations/7/repositories',
      expect.anything(),
    );
    const [storedInstallation] = await storage.installations.list({ orgId: 'org-1' });
    expect(storedInstallation).toMatchObject({ externalId: '7', accountName: 'acme' });
    await expect(
      storage.repositories.list({ orgId: 'org-1', installationId: storedInstallation!.id }),
    ).resolves.toEqual([expect.objectContaining({ externalId: '101', slug: 'acme/app' })]);
  });

  it('normalizes issue and PR resources through the shared capabilities', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/issues?')) return json({ issues: [issue] });
      if (url.includes('/pulls?')) return json({ pullRequests: [pullRequest] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const oauthConnection = { type: 'oauth' as const, accessToken: 'unused-provider-token' };
    const installationConnection = { type: 'app-installation' as const, installationId: 7 };

    await expect(
      integration.intake.listIssues({
        connection: oauthConnection,
        sourceIds: ['acme/app'],
        labels: ['bug', 'urgent'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: '12',
          identifier: '#12',
          source: 'acme/app',
          author: 'ada',
          assignee: 'grace',
          labels: ['bug'],
        }),
      ],
      nextCursor: null,
    });
    await expect(
      integration.versionControl.listPullRequests({ connection: installationConnection, sourceId: 'acme/app' }),
    ).resolves.toEqual({
      pullRequests: [expect.objectContaining({ id: '34', baseBranch: 'main', headBranch: 'feat/intake' })],
      nextCursor: null,
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('label=bug%2Curgent');
  });

  it('fetches issue details, creates comments, and preserves not-found semantics', async () => {
    const comment = {
      id: 91,
      body: 'Looking now',
      htmlUrl: 'https://github.com/acme/app/issues/12#issuecomment-91',
      user: { login: 'grace', avatarUrl: null, htmlUrl: null },
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-03T00:00:00Z',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(issue))
      .mockResolvedValueOnce(json({ comments: [comment] }))
      .mockResolvedValueOnce(json(comment))
      .mockResolvedValueOnce(json({ detail: 'Not found' }, 404))
      .mockResolvedValueOnce(json({ detail: 'Not found' }, 404));
    const integration = createIntegration(fetchImpl);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    await expect(integration.intake.getIssue({ connection, sourceId: 'acme/app', issueId: '12' })).resolves.toEqual(
      expect.objectContaining({
        description: 'Issue body',
        comments: [{ author: 'grace', body: 'Looking now', createdAt: comment.createdAt }],
      }),
    );
    await expect(
      integration.intake.createComment({ connection, sourceId: 'acme/app', issueId: '12', body: 'Done' }),
    ).resolves.toEqual({ id: '91', url: comment.htmlUrl });
    await expect(integration.intake.getIssue({ connection, sourceId: 'acme/app', issueId: '99' })).resolves.toBeNull();
  });

  it('updates issue state via PATCH after probing the pulls endpoint', async () => {
    const closedIssue = { ...issue, state: 'closed' as const };
    const fetchImpl = vi
      .fn<typeof fetch>()
      // Pulls probe → 404 (it's an issue, not a PR)
      .mockResolvedValueOnce(json({ detail: 'Not found' }, 404))
      // PATCH issue → returns closed issue
      .mockResolvedValueOnce(json(closedIssue));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.updateIssue({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
        issueId: '12',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toMatchObject({ id: '12', state: 'closed' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/repos/acme/app/pulls/12');
    expect((fetchImpl.mock.calls[1]?.[1] as RequestInit).method).toBe('PATCH');
    const patchBody = JSON.parse(String((fetchImpl.mock.calls[1]?.[1] as RequestInit).body)) as {
      state: string;
      state_reason: string;
    };
    expect(patchBody).toEqual({ state: 'closed', state_reason: 'completed' });
  });

  it('refuses to update a pull request through updateIssue', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      // Pulls probe → 200 (target IS a PR)
      .mockResolvedValueOnce(json(pullRequest));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.updateIssue({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
        issueId: '34',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();

    // Only the pulls probe was made — no PATCH.
    expect(fetchImpl.mock.calls).toHaveLength(1);
  });

  it('ignores byName targets on updateIssue (GitHub has no custom states)', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.updateIssue({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
        issueId: '12',
        state: { kind: 'byName', name: 'In Review' },
      }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('propagates platform rate limits through GitHub capabilities', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Rate limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '9' },
      }),
    );
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: ['acme/app'],
      }),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 9 });
  });

  it('maps PR, review, inline-comment, and reviewer writes onto platform routes', async () => {
    const review = {
      id: 55,
      htmlUrl: 'https://github.com/acme/app/pull/34#pullrequestreview-55',
      body: 'Ship it',
      state: 'APPROVED' as const,
      commitId: 'abc123',
      submittedAt: '2026-07-03T00:00:00Z',
      user: actor,
    };
    const reviewComment = {
      id: 77,
      body: 'Nit',
      htmlUrl: 'https://github.com/acme/app/pull/34#discussion_r77',
      path: 'src/a.ts',
      line: 10,
      side: 'RIGHT' as const,
      commitId: 'abc123',
      replyToId: null,
      user: actor,
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-03T00:00:00Z',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(pullRequest))
      .mockResolvedValueOnce(json(review))
      .mockResolvedValueOnce(json(reviewComment))
      .mockResolvedValueOnce(json({ users: ['grace'], teams: ['platform'] }));
    const integration = createIntegration(fetchImpl);
    const ref = {
      connection: { type: 'app-installation' as const, installationId: 7 },
      sourceId: 'acme/app',
      pullRequestId: '34',
    };

    await integration.versionControl.createPullRequest({
      connection: ref.connection,
      sourceId: ref.sourceId,
      title: 'Ship intake',
      baseBranch: 'main',
      headBranch: 'feat/intake',
    });
    await integration.versionControl.createReview({ ...ref, event: 'approve', body: 'Ship it' });
    await integration.versionControl.createReviewComment({
      ...ref,
      body: 'Nit',
      commitId: 'abc123',
      path: 'src/a.ts',
      line: 10,
      side: 'right',
    });
    await expect(
      integration.versionControl.requestReviewers({ ...ref, users: ['grace'], teams: ['platform'] }),
    ).resolves.toEqual({
      users: ['grace'],
      teams: ['platform'],
    });

    expect(fetchImpl.mock.calls.map(call => [String(call[0]), (call[1] as RequestInit).method])).toEqual([
      ['https://platform.example.com/v1/server/github/repos/acme/app/pulls', 'POST'],
      ['https://platform.example.com/v1/server/github/repos/acme/app/pulls/34/reviews', 'POST'],
      ['https://platform.example.com/v1/server/github/repos/acme/app/pulls/34/comments', 'POST'],
      ['https://platform.example.com/v1/server/github/repos/acme/app/pulls/34/requested-reviewers', 'POST'],
    ]);
    expect(JSON.parse(String((fetchImpl.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({ event: 'APPROVE' });
    expect(JSON.parse(String((fetchImpl.mock.calls[2]?.[1] as RequestInit).body))).toMatchObject({ side: 'RIGHT' });
    for (const call of fetchImpl.mock.calls) {
      expect((call[1] as RequestInit).headers).not.toHaveProperty('x-acting-user-id');
    }
  });

  it('sends the acting user header on writes when actingUserId is provided', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(pullRequest))
      .mockResolvedValueOnce(
        json({
          id: 91,
          body: 'Done',
          htmlUrl: 'https://github.com/acme/app/issues/12#issuecomment-91',
          user: actor,
          createdAt: '2026-07-03T00:00:00Z',
          updatedAt: '2026-07-03T00:00:00Z',
        }),
      );
    const integration = createIntegration(fetchImpl);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    await integration.versionControl.createPullRequest({
      connection,
      sourceId: 'acme/app',
      title: 'Ship intake',
      baseBranch: 'main',
      headBranch: 'feat/intake',
      actingUserId: 'user-42',
    });
    await integration.intake.createComment({
      connection,
      sourceId: 'acme/app',
      issueId: '12',
      body: 'Done',
      actingUserId: 'user-42',
    });

    for (const call of fetchImpl.mock.calls) {
      expect((call[1] as RequestInit).headers).toMatchObject({ 'x-acting-user-id': 'user-42' });
    }
  });

  it('maps every version-control operation to its platform endpoint', async () => {
    const comment = {
      id: 91,
      body: 'Looks good',
      htmlUrl: 'https://github.com/acme/app/issues/34#issuecomment-91',
      user: actor,
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: '2026-07-03T00:00:00Z',
    };
    const review = {
      id: 55,
      htmlUrl: 'https://github.com/acme/app/pull/34#pullrequestreview-55',
      body: 'Ship it',
      state: 'APPROVED' as const,
      commitId: 'abc123',
      submittedAt: '2026-07-03T00:00:00Z',
      user: actor,
    };
    const reviewComment = {
      ...comment,
      id: 77,
      htmlUrl: 'https://github.com/acme/app/pull/34#discussion_r77',
      path: 'src/a.ts',
      line: 10,
      side: 'RIGHT' as const,
      commitId: 'abc123',
      replyToId: null,
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const pathname = new URL(url).pathname;
      const method = init?.method;
      if (method === 'DELETE') return json(undefined, 204);
      if (pathname.endsWith('/merge')) return json({ merged: true, message: 'merged', sha: 'def456' });
      if (url.includes('/requested-reviewers')) return json({ users: ['grace'], teams: ['platform'] });
      if (url.includes('/pulls/comments/')) return json(reviewComment);
      if (url.includes('/issues/comments/')) return json(comment);
      if (url.includes('/reviews/')) return json(review);
      if (url.includes('/reviews')) return method === 'GET' ? json({ reviews: [review] }) : json(review);
      if (url.includes('/pulls/34/comments')) {
        return method === 'GET' ? json({ comments: [reviewComment] }) : json(reviewComment);
      }
      if (url.includes('/issues/34/comments')) return method === 'GET' ? json({ comments: [comment] }) : json(comment);
      if (pathname.endsWith('/pulls')) {
        return method === 'GET' ? json({ pullRequests: [pullRequest] }) : json(pullRequest);
      }
      return json(pullRequest);
    });
    const integration = createIntegration(fetchImpl);
    const connection = { type: 'app-installation' as const, installationId: 7 };
    const sourceId = 'acme/app';
    const ref = { connection, sourceId, pullRequestId: '34' };

    await integration.versionControl.listPullRequests({ connection, sourceId });
    await integration.versionControl.getPullRequest(ref);
    await integration.versionControl.createPullRequest({
      connection,
      sourceId,
      title: 'Ship intake',
      baseBranch: 'main',
      headBranch: 'feat/intake',
    });
    await integration.versionControl.updatePullRequest({ ...ref, title: 'Ship all intake' });
    await integration.versionControl.closePullRequest(ref);
    await integration.versionControl.mergePullRequest({ ...ref, method: 'squash' });
    await integration.versionControl.listComments(ref);
    await integration.versionControl.createComment({ ...ref, body: 'Looks good' });
    await integration.versionControl.updateComment({ connection, sourceId, commentId: '91', body: 'Updated' });
    await integration.versionControl.deleteComment({ connection, sourceId, commentId: '91' });
    await integration.versionControl.listReviews(ref);
    await integration.versionControl.getReview({ ...ref, reviewId: '55' });
    await integration.versionControl.createReview({ ...ref, event: 'approve', body: 'Ship it' });
    await integration.versionControl.updateReview({ ...ref, reviewId: '55', body: 'Updated' });
    await integration.versionControl.submitReview({ ...ref, reviewId: '55', event: 'approve', body: 'Ship it' });
    await integration.versionControl.dismissReview({ ...ref, reviewId: '55', message: 'Outdated' });
    await integration.versionControl.deletePendingReview({ ...ref, reviewId: '55' });
    await integration.versionControl.listReviewComments(ref);
    await integration.versionControl.createReviewComment({
      ...ref,
      body: 'Nit',
      commitId: 'abc123',
      path: 'src/a.ts',
      line: 10,
      side: 'right',
    });
    await integration.versionControl.updateReviewComment({
      connection,
      sourceId,
      commentId: '77',
      body: 'Updated nit',
    });
    await integration.versionControl.deleteReviewComment({ connection, sourceId, commentId: '77' });
    await integration.versionControl.listRequestedReviewers(ref);
    await integration.versionControl.requestReviewers({ ...ref, users: ['grace'] });
    await integration.versionControl.removeRequestedReviewers({ ...ref, teams: ['platform'] });

    expect(
      fetchImpl.mock.calls.map(call => `${(call[1] as RequestInit).method} ${new URL(String(call[0])).pathname}`),
    ).toEqual([
      'GET /v1/server/github/repos/acme/app/pulls',
      'GET /v1/server/github/repos/acme/app/pulls/34',
      'POST /v1/server/github/repos/acme/app/pulls',
      'PATCH /v1/server/github/repos/acme/app/pulls/34',
      'PATCH /v1/server/github/repos/acme/app/pulls/34',
      'PUT /v1/server/github/repos/acme/app/pulls/34/merge',
      'GET /v1/server/github/repos/acme/app/issues/34/comments',
      'POST /v1/server/github/repos/acme/app/issues/34/comments',
      'PATCH /v1/server/github/repos/acme/app/issues/comments/91',
      'DELETE /v1/server/github/repos/acme/app/issues/comments/91',
      'GET /v1/server/github/repos/acme/app/pulls/34/reviews',
      'GET /v1/server/github/repos/acme/app/pulls/34/reviews/55',
      'POST /v1/server/github/repos/acme/app/pulls/34/reviews',
      'PUT /v1/server/github/repos/acme/app/pulls/34/reviews/55',
      'POST /v1/server/github/repos/acme/app/pulls/34/reviews/55/events',
      'PUT /v1/server/github/repos/acme/app/pulls/34/reviews/55/dismissals',
      'DELETE /v1/server/github/repos/acme/app/pulls/34/reviews/55',
      'GET /v1/server/github/repos/acme/app/pulls/34/comments',
      'POST /v1/server/github/repos/acme/app/pulls/34/comments',
      'PATCH /v1/server/github/repos/acme/app/pulls/comments/77',
      'DELETE /v1/server/github/repos/acme/app/pulls/comments/77',
      'GET /v1/server/github/repos/acme/app/pulls/34/requested-reviewers',
      'POST /v1/server/github/repos/acme/app/pulls/34/requested-reviewers',
      'DELETE /v1/server/github/repos/acme/app/pulls/34/requested-reviewers',
    ]);
  });

  it('mints a repository-scoped platform token for git access', async () => {
    const { sourceControl } = await createPlatformStorageForTests();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ token: 'ghs_scoped', expiresAt: '2026-07-21T18:00:00Z' }));
    const integration = createIntegration(fetchImpl);
    integration.versionControl.initialize({ storage: sourceControl.forIntegration('github') });
    const installation = await integration.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '7', accountName: 'acme', accountType: 'Organization' },
    });
    const [repository] = await integration.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
    });

    await expect(
      integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository!.id }),
    ).resolves.toEqual({
      cloneUrl: 'https://github.com/acme/app.git',
      authorization: { scheme: 'bearer', token: 'ghs_scoped' },
    });
    expect(JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      repositories: ['app'],
      permissions: { contents: 'write', issues: 'write', pull_requests: 'write' },
    });
  });

  it('requests all write permissions when minting an installation token', async () => {
    const { sourceControl } = await createPlatformStorageForTests();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          repositories: [
            {
              id: 101,
              owner: 'acme',
              name: 'app',
              fullName: 'acme/app',
              private: true,
              defaultBranch: 'main',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ token: 'ghs_installation', expiresAt: '2026-07-21T18:00:00Z' }));
    const integration = createIntegration(fetchImpl);
    integration.versionControl.initialize({ storage: sourceControl.forIntegration('github') });

    await expect(integration.mintInstallationToken(7, 'org-1')).resolves.toBe('ghs_installation');
    expect(JSON.parse(String((fetchImpl.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      repositories: ['app'],
      permissions: { contents: 'write', issues: 'write', pull_requests: 'write' },
    });
  });

  it.each([404, 409])(
    'marks an installation broken and evicts its repository cache when token minting returns %s',
    async status => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const installation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
        accountName: 'acme',
        accountType: 'Organization',
      });
      const repositories = {
        repositories: [
          { id: 101, owner: 'acme', name: 'app', fullName: 'acme/app', private: true, defaultBranch: 'main' },
        ],
      };
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(repositories))
        .mockResolvedValueOnce(json({ error: 'Installation unavailable' }, status))
        .mockResolvedValueOnce(json(repositories));
      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await integration.listInstallationRepos(7);
      const error = await integration.mintInstallationToken(7, 'org-1').catch(err => err);

      expect(error).toBeInstanceOf(GithubInstallationBrokenError);
      expect(error).toMatchObject({
        code: 'github_installation_broken',
        installationId: 7,
        accountLogin: 'acme',
        orgId: 'org-1',
      });
      await expect(storage.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
        brokenAt: expect.any(Number),
      });

      await expect(integration.mintInstallationToken(7, 'org-1')).rejects.toBeInstanceOf(
        GithubInstallationBrokenError,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      await integration.listInstallationRepos(7);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    },
  );

  it('reuses installation repository listings within the cache TTL', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
        json({
          repositories: [
            { id: 101, owner: 'acme', name: 'app', fullName: 'acme/app', private: true, defaultBranch: 'main' },
          ],
        }),
      );
      const integration = createIntegration(fetchImpl);

      const first = await integration.listInstallationRepos(7);
      const second = await integration.listInstallationRepos(7);
      expect(second).toBe(first);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      // A different installation is a different cache entry.
      await integration.listInstallationRepos(8);
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      // Expired entries are refetched.
      vi.advanceTimersByTime(31_000);
      await integration.listInstallationRepos(7);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts the oldest installation listing once the cache bound is reached', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json({ repositories: [] }));
      const integration = createIntegration(fetchImpl);

      // Fill the cache past its 1000-entry bound; installation 1 is oldest.
      for (let installationId = 1; installationId <= 1001; installationId++) {
        await integration.listInstallationRepos(installationId);
      }
      expect(fetchImpl).toHaveBeenCalledTimes(1001);

      // Installation 1 was evicted (refetches); a recent entry is still cached.
      await integration.listInstallationRepos(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1002);
      await integration.listInstallationRepos(1001);
      expect(fetchImpl).toHaveBeenCalledTimes(1002);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses repository access grants within the cache TTL', async () => {
    vi.useFakeTimers();
    try {
      const { sourceControl } = await createPlatformStorageForTests();
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => json({ token: 'ghs_scoped', expiresAt: '2026-07-21T18:00:00Z' }));
      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage: sourceControl.forIntegration('github') });
      const installation = await integration.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: '7', accountName: 'acme', accountType: 'Organization' },
      });
      const [repository] = await integration.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
      });

      const input = { orgId: 'org-1', repositoryId: repository!.id };
      const first = await integration.versionControl.getRepositoryAccess(input);
      const second = await integration.versionControl.getRepositoryAccess(input);
      expect(second).toBe(first);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      // Expired grants re-mint through the platform.
      vi.advanceTimersByTime(5 * 60_000 + 1_000);
      await integration.versionControl.getRepositoryAccess(input);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidates cached repository access when the database is repointed to another installation', async () => {
    const { sourceControl } = await createPlatformStorageForTests();
    const storage = sourceControl.forIntegration('github');
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ token: 'ghs_old', expiresAt: '2026-07-21T18:00:00Z' }))
      .mockResolvedValueOnce(json({ token: 'ghs_new', expiresAt: '2026-07-21T18:00:00Z' }));
    const integration = createIntegration(fetchImpl);
    integration.versionControl.initialize({ storage });
    const oldInstallation = await integration.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '7', accountName: 'acme', accountType: 'Organization' },
    });
    const newInstallation = await integration.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '8', accountName: 'acme', accountType: 'Organization' },
    });
    const [repository] = await integration.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: oldInstallation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
    });

    await expect(
      integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository!.id }),
    ).resolves.toMatchObject({ authorization: { token: 'ghs_old' } });
    await storage.repositories.migrateInstallation({
      orgId: 'org-1',
      id: repository!.id,
      newInstallationId: newInstallation.id,
    });
    await expect(
      integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository!.id }),
    ).resolves.toMatchObject({ authorization: { token: 'ghs_new' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('exposes platform-backed routes and session tools without local callback or webhook routes', async () => {
    const seed = await createPlatformStorageForTests();
    const integration = createIntegration();
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: true },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
    integration.versionControl.initialize({ storage: context.storage.sourceControl });
    const routes = integration.routes(context);

    expect(integration.id).toBe('github');
    expect(routes.map(route => route.path)).toEqual(
      expect.arrayContaining([
        '/web/github/status',
        '/auth/github/connect',
        '/web/github/subscriptions',
        '/web/github/repos',
        '/web/github/projects/:id/issues',
        '/web/github/projects/:id/prs',
        '/web/github/projects/:id/pr',
      ]),
    );
    expect(routes.some(route => route.path === '/auth/github/callback')).toBe(false);
    expect(routes.some(route => route.path === '/web/github/webhook')).toBe(false);
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    requestContext.set('controller', {
      resourceId: 'resource-1',
      threadId: 'thread-1',
      scope: '/worktrees/a',
      session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
      getState: () => ({ factoryProjectId: 'resource-1', projectRepositoryId: 'project-repository-1' }),
    });
    expect(Object.keys(integration.sessionTools({ requestContext }))).toEqual([
      'github_refresh_token',
      'github_subscribe_pr',
      'github_unsubscribe_pr',
    ]);
    expect(integration.workers(context).map(worker => worker.name)).toEqual(['platform-github-events']);
    expect(integration.diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'platform.example.com',
      polling: { enabled: true },
      reconcile: { enabled: true },
    });
    expect(JSON.stringify(integration.diagnostics())).not.toContain(config.accessToken);
  });

  it('attaches GitHub rules to polled issue ingress', async () => {
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/github-app/installations/7/token')) return json({ token: 'ghs_rules' });
      if (url.includes('/issues?')) return json({ issues: [issue] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const sourceControl = seed.sourceControl.forIntegration('github');
    const project = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'App' },
    });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '7',
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '101', slug: 'acme/app', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const projectRepository = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/tmp/app',
    });
    const onEvent = vi.fn();
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: false },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl,
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      rules: {
        config: defaultFactoryRules({
          version: 'test-rules',
          overrides: { github: { issueOpened: { onEvent } } },
        }),
        workItems: seed.workItems,
      },
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic });
    integration.versionControl.initialize({ storage: sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const response = await app.request(`/web/github/projects/${projectRepository.id}/issues`);

    expect(response.status).toBe(200);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'poll:101:issue:12:2026-07-01T00:00:00Z',
        event: 'issueOpened',
      }),
    );
  });

  it('uses platform installations for status and platform install URL for connect redirects', async () => {
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/github-app/installations')) {
        return json({
          installations: [
            {
              installationId: 7,
              accountLogin: 'acme',
              accountType: 'Organization',
              suspendedAt: null,
              usable: true,
            },
          ],
          pendingRequests: [],
        });
      }
      if (url.includes('/github-app/user-connection')) {
        return json({ connected: true, githubUsername: 'ada' });
      }
      if (url.includes('/github-app/install-url')) {
        return json({ url: 'https://github.com/apps/mastra/installations/new?state=platform-state' });
      }
      if (url.includes('/github-app/authenticate')) {
        return json({ url: 'https://github.com/login/oauth/authorize?client_id=abc&state=platform-state' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: true },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
    integration.versionControl.initialize({ storage: context.storage.sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const status = await app.request('/web/github/status');
    await expect(status.json()).resolves.toMatchObject({
      enabled: true,
      connected: true,
      installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
      brokenInstallations: [],
      userConnected: true,
      userGithubUsername: 'ada',
      reason: 'ready',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://platform.example.com/v1/server/github-app/user-connection?userId=user-1',
      expect.anything(),
    );
    await expect(context.storage.sourceControl.installations.list({ orgId: 'org-1' })).resolves.toEqual([
      expect.objectContaining({ externalId: '7', accountName: 'acme' }),
    ]);

    const connect = await app.request('/auth/github/connect');
    expect(connect.status).toBe(302);
    expect(connect.headers.get('location')).toBe(
      'https://github.com/apps/mastra/installations/new?state=platform-state',
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://platform.example.com/v1/server/github-app/install-url?action=install&redirectTo=%2F&originator=https%3A%2F%2Ffactory.example',
      expect.anything(),
    );

    const connectUser = await app.request('/auth/github/connect-user');
    expect(connectUser.status).toBe(302);
    expect(connectUser.headers.get('location')).toBe(
      'https://github.com/login/oauth/authorize?client_id=abc&state=platform-state',
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://platform.example.com/v1/server/github-app/authenticate?userId=user-1&redirectTo=%2F&originator=https%3A%2F%2Ffactory.example',
      expect.anything(),
    );
  });

  it('preserves broken state until the completed reconnect callback confirms the installation', async () => {
    const seed = await createPlatformStorageForTests();
    const sourceControl = seed.sourceControl.forIntegration('github');
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '7',
      accountName: 'acme',
      accountType: 'Organization',
    });
    const otherInstallation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '8',
      accountName: 'other-org',
      accountType: 'Organization',
    });
    await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: '101',
        slug: 'acme/app',
        defaultBranch: 'main',
        providerMetadata: {},
      },
    });
    let installationIsLive = false;
    let repositoryAccessRestored = false;
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/github-app/installations/7/token')) {
        return repositoryAccessRestored
          ? json({ token: 'ghs_reconnected', expiresAt: '2026-08-03T18:00:00Z' })
          : json({ error: 'Installation unavailable' }, 404);
      }
      if (url.includes('/github-app/installations/7/repositories')) {
        return json({
          repositories: [
            {
              id: 101,
              fullName: 'acme/app',
              private: true,
              defaultBranch: 'main',
              htmlUrl: 'https://github.com/acme/app',
              owner: 'acme',
              name: 'app',
            },
          ],
        });
      }
      if (url.endsWith('/github-app/installations')) {
        return json({
          installations: installationIsLive
            ? [
                {
                  installationId: 7,
                  accountLogin: 'acme',
                  accountType: 'Organization',
                  suspendedAt: null,
                  usable: true,
                },
              ]
            : [],
          pendingRequests: [],
        });
      }
      if (url.includes('/github-app/user-connection')) {
        return json({ connected: false, githubUsername: null });
      }
      if (url.includes('/github-app/install-url')) {
        return json({ url: 'https://github.com/apps/mastra/installations/new?state=platform-state' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const context = {
      auth: fakeAuth(),
      fleet: {
        enabled: true,
        provider: 'local',
        computeWorkdir: (repo: string) => `/workspace/${repo.split('/').pop()}`,
      },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl,
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic });
    integration.versionControl.initialize({ storage: sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const brokenStatus = await app.request('/web/github/status');
    await expect(brokenStatus.json()).resolves.toMatchObject({
      connected: false,
      installations: [],
      brokenInstallations: [
        {
          installationId: 7,
          accountLogin: 'acme',
          accountType: 'Organization',
          brokenAt: expect.any(Number),
        },
        {
          installationId: 8,
          accountLogin: 'other-org',
          accountType: 'Organization',
          brokenAt: expect.any(Number),
        },
      ],
      reason: 'not_connected',
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
      brokenAt: expect.any(Number),
    });

    installationIsLive = true;
    const stillBrokenStatus = await app.request('/web/github/status');
    await expect(stillBrokenStatus.json()).resolves.toMatchObject({
      connected: false,
      installations: [],
      brokenInstallations: [
        { installationId: 7, accountLogin: 'acme', brokenAt: expect.any(Number) },
        { installationId: 8, accountLogin: 'other-org', brokenAt: expect.any(Number) },
      ],
      reason: 'not_connected',
    });

    const reconnect = await app.request('/auth/github/connect');
    expect(reconnect.status).toBe(302);
    expect(reconnect.headers.get('location')).toBe(
      'https://github.com/apps/mastra/installations/new?state=platform-state',
    );
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
      brokenAt: expect.any(Number),
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: otherInstallation.id })).resolves.toMatchObject({
      brokenAt: expect.any(Number),
    });

    const otherTenantApp = new Hono();
    const otherTenantContext = {
      ...context,
      auth: fakeAuth({ orgId: 'org-2', userId: 'user-2' }),
    } as unknown as IntegrationContext;
    mountApiRoutes(otherTenantApp as never, integration.routes(otherTenantContext));
    const otherTenantConfirmation = await otherTenantApp.request(
      '/web/github/installations/7/confirm-reconnect',
      { method: 'POST' },
    );
    expect(otherTenantConfirmation.status).toBe(404);

    const failedConfirmation = await app.request('/web/github/installations/7/confirm-reconnect', {
      method: 'POST',
    });
    expect(failedConfirmation.status).toBe(424);
    await expect(failedConfirmation.json()).resolves.toMatchObject({
      error: 'github_installation_broken',
      installationId: 7,
      accountLogin: 'acme',
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
      brokenAt: expect.any(Number),
    });

    repositoryAccessRestored = true;
    const confirmedReconnect = await app.request('/web/github/installations/7/confirm-reconnect', {
      method: 'POST',
    });
    expect(confirmedReconnect.status).toBe(204);

    const callbackRefresh = await app.request('/web/github/repos');
    expect(callbackRefresh.status).toBe(200);
    await expect(callbackRefresh.json()).resolves.toMatchObject({ repos: [{ fullName: 'acme/app' }] });

    const recoveredStatus = await app.request('/web/github/status');
    await expect(recoveredStatus.json()).resolves.toMatchObject({
      connected: true,
      installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
      brokenInstallations: [{ installationId: 8, accountLogin: 'other-org', brokenAt: expect.any(Number) }],
      reason: 'ready',
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
      brokenAt: null,
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: otherInstallation.id })).resolves.toMatchObject({
      brokenAt: expect.any(Number),
    });

    let releasePassiveUpsert: () => void = () => {};
    let signalPassiveUpsert: () => void = () => {};
    const passiveUpsertGate = new Promise<void>(resolve => {
      releasePassiveUpsert = resolve;
    });
    const passiveUpsertStarted = new Promise<void>(resolve => {
      signalPassiveUpsert = resolve;
    });
    const originalUpsert = sourceControl.installations.upsert;
    const upsertSpy = vi.spyOn(sourceControl.installations, 'upsert').mockImplementation(async input => {
      if (input.preserveBroken) {
        signalPassiveUpsert();
        await passiveUpsertGate;
      }
      return originalUpsert(input);
    });

    const racingStatus = app.request('/web/github/status');
    await passiveUpsertStarted;
    await sourceControl.installations.markBroken({
      orgId: 'org-1',
      id: installation.id,
      brokenAt: 1_700_000_000_000,
    });
    releasePassiveUpsert();

    await expect((await racingStatus).json()).resolves.toMatchObject({
      connected: false,
      installations: [],
      brokenInstallations: [
        { installationId: 7, accountLogin: 'acme', brokenAt: 1_700_000_000_000 },
        { installationId: 8, accountLogin: 'other-org', brokenAt: expect.any(Number) },
      ],
    });
    upsertSpy.mockRestore();
  });

  it('retains but does not surface a broken installation superseded by a healthy same-account replacement', async () => {
    const seed = await createPlatformStorageForTests();
    const sourceControl = seed.sourceControl.forIntegration('github');
    const oldInstallation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '7',
      accountName: 'acme',
      accountType: 'Organization',
    });
    await sourceControl.installations.markBroken({
      orgId: 'org-1',
      id: oldInstallation.id,
      brokenAt: 1_700_000_000_000,
    });
    await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '456',
      accountName: 'acme',
      accountType: 'Organization',
    });

    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/github-app/installations')) {
        return json({
          installations: [
            {
              installationId: 456,
              accountLogin: 'acme',
              accountType: 'Organization',
              suspendedAt: null,
              usable: true,
            },
          ],
          pendingRequests: [],
        });
      }
      if (url.includes('/github-app/user-connection')) {
        return json({ connected: false, githubUsername: null });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: true },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl,
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic });
    integration.versionControl.initialize({ storage: sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const status = await app.request('/web/github/status');

    await expect(status.json()).resolves.toMatchObject({
      connected: true,
      installations: [{ installationId: 456, accountLogin: 'acme' }],
      brokenInstallations: [],
      reason: 'ready',
    });
    await expect(sourceControl.installations.get({ orgId: 'org-1', id: oldInstallation.id })).resolves.toMatchObject({
      brokenAt: 1_700_000_000_000,
    });
  });

  it('logs the user-connection verification failure reason', async () => {
    const warningLog = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/github-app/installations')) {
        return json({ installations: [], pendingRequests: [] });
      }
      if (url.includes('/github-app/user-connection')) {
        return json({
          connected: false,
          githubUsername: 'ada',
          reason: 'missing-permissions',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: true },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
    integration.versionControl.initialize({ storage: context.storage.sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const status = await app.request('/web/github/status');

    await expect(status.json()).resolves.toMatchObject({
      userConnected: false,
      userGithubUsername: 'ada',
    });
    const logged = warningLog.mock.calls.map(call => String(call[0])).join('\n');
    expect(logged).toContain('[Mastra Factory] WARN Platform GitHub user connection verification failed');
    expect(logged).toContain('"userId":"user-1"');
    expect(logged).toContain('"reason":"missing-permissions"');
    warningLog.mockRestore();
  });

  it('reports userConnected false when the platform lacks the user-connection endpoint', async () => {
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('/github-app/installations')) {
        return json({ installations: [], pendingRequests: [] });
      }
      if (url.includes('/github-app/user-connection')) {
        return json({ error: 'Not found' }, 404);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = createIntegration(fetchImpl);
    const context = {
      auth: fakeAuth(),
      fleet: { enabled: true },
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
        projects: seed.projects,
        intake: seed.intake,
      },
      controller: {},
      stateSigner: {},
      baseUrl: 'https://factory.example',
    } as unknown as IntegrationContext;
    integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
    integration.versionControl.initialize({ storage: context.storage.sourceControl });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, integration.routes(context));

    const status = await app.request('/web/github/status');
    await expect(status.json()).resolves.toMatchObject({
      enabled: true,
      connected: false,
      userConnected: false,
      userGithubUsername: null,
      reason: 'not_connected',
    });
  });

  it('defaults the Platform base URL and requires MASTRA_PLATFORM_SECRET_KEY', () => {
    vi.stubEnv('MASTRA_SHARED_API_URL', '');
    expect(new PlatformGithubIntegration().diagnostics()).toMatchObject({ endpointHost: 'platform.mastra.ai' });

    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'legacy-token');
    expect(() => new PlatformGithubIntegration()).toThrow(/MASTRA_PLATFORM_SECRET_KEY/);
  });

  it('can disable polling and resolves collaborator permissions through the platform API', async () => {
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_ENABLED', 'false');
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS', '9000');
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED', 'false');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        permission: 'maintain',
        roleName: 'maintain',
        user: actor,
      }),
    );
    const integration = createIntegration(fetchImpl);

    await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace')).resolves.toBe('maintain');
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://platform.example.com/v1/server/github/repos/acme/app/collaborators/grace/permission',
    );
    expect(integration.workers({} as IntegrationContext)).toEqual([]);
    expect(integration.diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'platform.example.com',
      polling: { enabled: false, intervalMs: 9_000 },
      reconcile: { enabled: false },
    });
  });

  it('keeps the reconcile worker alive when polling is disabled but reconcile stays enabled', () => {
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_ENABLED', 'false');
    const integration = createIntegration();

    const workers = integration.workers({ controller: {}, storage: { generic: {} } } as unknown as IntegrationContext);
    expect(workers).toHaveLength(1);
    expect(integration.diagnostics()).toMatchObject({
      polling: { enabled: false },
      reconcile: { enabled: true },
    });
  });

  describe('resolveIntakeDispatch', () => {
    it('derives repository + issue number from the intake externalId format', async () => {
      const integration = createIntegration();
      await expect(
        integration.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: 'acme/app:34' },
        }),
      ).resolves.toEqual({
        connection: { type: 'app-installation', installationId: 1 },
        sourceId: 'acme/app',
        issueId: '34',
      });
    });

    it('resolves numeric repository locators with one direct storage lookup', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const integration = createIntegration();
      const storage = sourceControl.forIntegration('github');
      integration.versionControl.initialize({ storage });
      const installation = await integration.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: '7', accountName: 'acme', accountType: 'Organization' },
      });
      await integration.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main' }],
      });

      await expect(
        integration.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: 'github:101:issue:12' },
        }),
      ).resolves.toMatchObject({ sourceId: 'acme/app', issueId: '12' });
    });

    it('returns null when the target cannot be derived', async () => {
      const integration = createIntegration();
      await expect(
        integration.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: 'github-issue:7' },
        }),
      ).resolves.toBeNull();
    });
  });

  describe('installation recovery', () => {
    it.each([404, 409])(
      'classifies a dead installation, marks it broken, and evicts mint caches on %s',
      async status => {
        const { sourceControl } = await createPlatformStorageForTests();
        const storage = sourceControl.forIntegration('github');
        const installation = await storage.installations.upsert({
          orgId: 'org-1',
          connectedByUserId: 'user-1',
          externalId: '7',
          accountName: 'acme',
          accountType: 'Organization',
        });
        const repository = await storage.repositories.upsert({
          orgId: 'org-1',
          input: {
            installationId: installation.id,
            externalId: '101',
            slug: 'acme/app',
            defaultBranch: 'main',
          },
        });
        const repositories = {
          repositories: [
            { id: 101, owner: 'acme', name: 'app', fullName: 'acme/app', private: true, defaultBranch: 'main' },
          ],
        };
        const fetchImpl = vi.fn<typeof fetch>(async input => {
          const url = String(input);
          if (url.endsWith('/repositories')) return json(repositories);
          if (url.endsWith('/token')) return json({ error: 'Installation unavailable' }, status);
          throw new Error(`Unexpected request: ${url}`);
        });
        const integration = createIntegration(fetchImpl);
        integration.versionControl.initialize({ storage });

        await integration.listInstallationRepos(7);
        const error = await integration.versionControl
          .getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id })
          .catch(err => err);

        expect(error).toBeInstanceOf(GithubInstallationBrokenError);
        expect(error).toMatchObject({
          code: 'github_installation_broken',
          installationId: 7,
          accountLogin: 'acme',
          orgId: 'org-1',
        });
        await expect(storage.installations.get({ orgId: 'org-1', id: installation.id })).resolves.toMatchObject({
          brokenAt: expect.any(Number),
        });

        await expect(
          integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
        ).rejects.toBeInstanceOf(GithubInstallationBrokenError);
        expect(fetchImpl).toHaveBeenCalledTimes(2);

        await integration.listInstallationRepos(7);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
      },
    );

    it('retries immediately after explicit re-registration clears the broken state', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const installation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
        accountName: 'acme',
        accountType: 'Organization',
      });
      const repository = await storage.repositories.upsert({
        orgId: 'org-1',
        input: {
          installationId: installation.id,
          externalId: '101',
          slug: 'acme/app',
          defaultBranch: 'main',
        },
      });
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ error: 'Installation unavailable' }, 404))
        .mockResolvedValueOnce(json({ token: 'ghs_reconnected', expiresAt: '2026-07-21T18:00:00Z' }));
      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
      ).rejects.toBeInstanceOf(GithubInstallationBrokenError);
      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
      ).rejects.toBeInstanceOf(GithubInstallationBrokenError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await integration.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: '7', accountName: 'acme', accountType: 'Organization' },
      });
      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
      ).resolves.toMatchObject({ authorization: { token: 'ghs_reconnected' } });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('recovers when a GitHub App installation is reinstalled with a new installation ID', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');

      // Create an OLD installation (simulating before reinstall)
      const oldInstallation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7', // OLD GitHub installation ID
        accountName: 'acme',
        accountType: 'Organization',
      });

      // Create an OLD repository for the OLD installation
      const oldRepository = await storage.repositories.upsert({
        orgId: 'org-1',
        input: {
          installationId: oldInstallation.id,
          externalId: '101',
          slug: 'acme/app',
          defaultBranch: 'main',
        },
      });

      // Create a NEW installation (simulating after reinstall)
      // This would be created by intake.listSources after the reinstall
      const newInstallation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '456', // NEW GitHub installation ID
        accountName: 'acme', // Same account name
        accountType: 'Organization',
      });

      // NOTE: We don't create a new repository row here.
      // In a real scenario, intake.listSources creates the installation row,
      // but repositories are registered lazily. The recovery flow will
      // migrate the old repository's installation_id to the new installation.

      // Mock Platform API:
      // - Returns 404 for OLD installation token request
      // - Returns token for NEW installation token request
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Installation not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(json({ token: 'ghs_recovered', expiresAt: '2026-07-21T18:00:00Z' }));

      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      // Try to get repository access using OLD repository
      // This should recover and succeed using the NEW installation
      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: oldRepository.id }),
      ).resolves.toEqual({
        cloneUrl: 'https://github.com/acme/app.git',
        authorization: { scheme: 'bearer', token: 'ghs_recovered' },
      });

      // Verify the repository's installation_id was migrated to the new installation
      const migratedRepository = await storage.repositories.get({ orgId: 'org-1', id: oldRepository.id });
      expect(migratedRepository?.installationId).toBe(newInstallation.id);
      await expect(storage.installations.get({ orgId: 'org-1', id: oldInstallation.id })).resolves.toMatchObject({
        brokenAt: null,
      });
    });

    /** Old installation on `7`, new one on `456`, both owned by `acme`. */
    async function seedReinstalledOrg(storage: SourceControlStorageHandle) {
      const oldInstallation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
        accountName: 'acme',
        accountType: 'Organization',
      });
      const oldRepository = await storage.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: oldInstallation.id, externalId: '101', slug: 'acme/app', defaultBranch: 'main' },
      });
      const newInstallation = await storage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '456',
        accountName: 'acme',
        accountType: 'Organization',
      });
      return { oldInstallation, oldRepository, newInstallation };
    }

    it('recovers when Platform reports the installation as suspended or soft-deleted', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const { oldRepository, newInstallation } = await seedReinstalledOrg(storage);

      // Platform answers 409 while its own row still exists but is unusable.
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ type: 'conflict', detail: 'GitHub App installation is not available.' }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(json({ token: 'ghs_recovered', expiresAt: '2026-07-21T18:00:00Z' }));

      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: oldRepository.id }),
      ).resolves.toEqual({
        cloneUrl: 'https://github.com/acme/app.git',
        authorization: { scheme: 'bearer', token: 'ghs_recovered' },
      });

      const migratedRepository = await storage.repositories.get({ orgId: 'org-1', id: oldRepository.id });
      expect(migratedRepository?.installationId).toBe(newInstallation.id);
    });

    it('still runs same-account migration when the stored installation is already broken', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const { oldInstallation, oldRepository, newInstallation } = await seedReinstalledOrg(storage);
      await storage.installations.markBroken({ orgId: 'org-1', id: oldInstallation.id, brokenAt: Date.now() });

      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ token: 'ghs_recovered', expiresAt: '2026-07-21T18:00:00Z' }));
      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: oldRepository.id }),
      ).resolves.toMatchObject({ authorization: { token: 'ghs_recovered' } });
      await expect(storage.repositories.get({ orgId: 'org-1', id: oldRepository.id })).resolves.toMatchObject({
        installationId: newInstallation.id,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://platform.example.com/v1/server/github-app/installations/456/token',
        expect.anything(),
      );
    });

    it('does not mint against either installation when both same-account candidates are already broken', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const { oldInstallation, oldRepository, newInstallation } = await seedReinstalledOrg(storage);
      await storage.installations.markBroken({ orgId: 'org-1', id: oldInstallation.id, brokenAt: Date.now() });
      await storage.installations.markBroken({ orgId: 'org-1', id: newInstallation.id, brokenAt: Date.now() });

      const fetchImpl = vi.fn<typeof fetch>();
      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: oldRepository.id }),
      ).rejects.toMatchObject({ code: 'github_installation_broken', installationId: 7 });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('leaves the repository alone when the mint fails for a transient reason', async () => {
      const { sourceControl } = await createPlatformStorageForTests();
      const storage = sourceControl.forIntegration('github');
      const { oldInstallation, oldRepository } = await seedReinstalledOrg(storage);

      // A 502 covers a dead installation and a GitHub outage alike — migrating on it
      // would repoint healthy repositories during an incident.
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'github_app_token_mint_failed' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const integration = createIntegration(fetchImpl);
      integration.versionControl.initialize({ storage });

      await expect(
        integration.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: oldRepository.id }),
      ).rejects.toThrow();

      const repository = await storage.repositories.get({ orgId: 'org-1', id: oldRepository.id });
      expect(repository?.installationId).toBe(oldInstallation.id);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('runIssueTriage wiring', () => {
    async function buildTriageApp(options: {
      constructorRunIssueTriage?: (input: any) => Promise<any>;
      controller?: object | undefined;
    }) {
      const seed = await createPlatformStorageForTests();
      const fetchImpl = vi.fn<typeof fetch>(async input => {
        const url = String(input);
        // addIssueLabels calls the platform label endpoint
        if (url.includes('/labels')) return json({ labels: ['auto-triaged'] });
        throw new Error(`Unexpected fetch: ${url}`);
      });
      // Stub fetch BEFORE constructing the integration — PlatformApiClient
      // captures `globalThis.fetch` at construction time.
      vi.stubGlobal('fetch', fetchImpl);
      const integration = options.constructorRunIssueTriage
        ? new PlatformGithubIntegration({ runIssueTriage: options.constructorRunIssueTriage })
        : new PlatformGithubIntegration();

      const sourceControl = seed.sourceControl.forIntegration('github');
      const project = await seed.projects.create({
        orgId: 'org-1',
        userId: 'user-1',
        input: { name: 'Test App' },
      });
      const installation = await sourceControl.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
      });
      const repository = await sourceControl.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId: '101', slug: 'acme/app', defaultBranch: 'main' },
      });
      const connection = await sourceControl.connections.create({
        orgId: 'org-1',
        factoryProjectId: project.id,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const projectRepository = await sourceControl.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'user-1',
        sandboxProvider: 'local',
        sandboxWorkdir: '/tmp/app',
      });

      const context = {
        auth: fakeAuth(),
        fleet: { enabled: true },
        storage: {
          generic: seed.integrations.forIntegration('github'),
          sourceControl,
          projects: seed.projects,
          intake: seed.intake,
        },
        controller: options.controller,
        stateSigner: {},
      } as unknown as IntegrationContext;
      integration.initialize?.({ storage: context.storage.generic, projects: context.storage.projects });
      integration.versionControl.initialize({ storage: sourceControl });

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
        await next();
      });
      mountApiRoutes(app as never, integration.routes(context));

      return { app, projectRepository };
    }

    function triageRequest(projectRepositoryId: string) {
      return [
        `/web/github/projects/${projectRepositoryId}/issues/42/triage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: 'Fix the bug',
            url: 'https://github.com/acme/app/issues/42',
            labels: ['bug'],
          }),
        },
      ] as const;
    }

    it('derives runIssueTriage from the controller when no explicit option is given', async () => {
      const createSession = vi.fn(async () => {
        throw new Error('mock-createSession-called');
      });
      const { app, projectRepository } = await buildTriageApp({
        controller: { createSession },
      });

      const res = await app.request(...triageRequest(projectRepository.id));
      // The route attempted the controller-derived runner (which invokes
      // runGithubIssueTriage → controller.createSession) rather than
      // returning 503 triage_unavailable.
      expect(res.status).not.toBe(503);
      expect(createSession).toHaveBeenCalledOnce();
    });

    it('uses an explicit constructor runIssueTriage over the controller default', async () => {
      const explicitRunner = vi.fn(async () => ({ threadId: 'explicit-thread' }));
      const { app, projectRepository } = await buildTriageApp({
        constructorRunIssueTriage: explicitRunner,
        controller: {}, // controller present but the explicit option should win
      });

      const res = await app.request(...triageRequest(projectRepository.id));
      expect(res.status).toBe(202);
      expect(explicitRunner).toHaveBeenCalledOnce();
      await expect(res.json()).resolves.toMatchObject({ ok: true, threadId: 'explicit-thread' });
    });

    it('returns 503 triage_unavailable when neither controller nor option is provided', async () => {
      const { app, projectRepository } = await buildTriageApp({
        controller: undefined,
      });

      const res = await app.request(...triageRequest(projectRepository.id));
      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual({ error: 'triage_unavailable' });
    });
  });
});
