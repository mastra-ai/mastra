import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';

import { createPlatformStorageForTests, mountApiRoutes } from '../test-utils.js';
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

    await expect(integration.mintInstallationToken(7)).resolves.toBe('ghs_installation');
    expect(JSON.parse(String((fetchImpl.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      repositories: ['app'],
      permissions: { contents: 'write', issues: 'write', pull_requests: 'write' },
    });
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
    });
    expect(JSON.stringify(integration.diagnostics())).not.toContain(config.accessToken);
  });

  it('forwards polled issues to the Factory ingestion hook', async () => {
    const seed = await createPlatformStorageForTests();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
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
    const ingestGithubEvent = vi.fn(async () => ({ status: 'committed' as const }));
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
      hooks: { ingestGithubEvent },
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
    expect(ingestGithubEvent).toHaveBeenCalledOnce();
    expect(ingestGithubEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'poll:101:issue:12:2026-07-01T00:00:00Z',
        event: 'issues',
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
});
