import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultFactoryRules } from '../../../rules/defaults.js';
import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
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
  it('updates the oldest Platform-owned triage marker across comment pages and learns the actual writer', async () => {
    const older = { id: 10, body: '<!-- mastra-factory-triage --> oldest', htmlUrl: 'https://github.com/acme/app/issues/7#issuecomment-10', user: { login: 'mastra-platform[bot]', avatarUrl: null, htmlUrl: 'https://github.com/apps/mastra-platform' }, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ comments: [
        { ...older, id: 20, user: { ...older.user, login: 'person' } },
        { ...older, id: 30 },
        ...Array.from({ length: 28 }, (_, index) => ({ ...older, id: 100 + index, body: 'unmarked', user: { ...older.user, login: 'person' } })),
      ] }))
      .mockResolvedValueOnce(json({ comments: [older] }))
      .mockResolvedValueOnce(json({ ...older, user: { ...older.user, login: 'actual-factory-writer[bot]' } }));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.upsertFactoryTriageComment({ installationId: 7, repository: 'acme/app', issueNumber: 7, body: '<!-- mastra-factory-triage -->\nFinal' }),
    ).resolves.toEqual({ action: 'updated', commentId: '10', url: older.htmlUrl });

    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}${new URL(String(url)).search}`)).toEqual([
      'GET /v1/server/github/repos/acme/app/issues/7/comments?page=1&per_page=30',
      'GET /v1/server/github/repos/acme/app/issues/7/comments?page=2&per_page=30',
      'PATCH /v1/server/github/repos/acme/app/issues/comments/10',
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[2]![1]?.body))).toEqual({ body: '<!-- mastra-factory-triage -->\nFinal' });
    expect(integration.isFactoryCommentAuthor('actual-factory-writer[bot]')).toBe(true);
  });

  it('creates a triage marker through the Platform proxy when no Factory marker exists', async () => {
    const created = { id: 42, body: '<!-- mastra-factory-triage --> Pending', htmlUrl: 'https://github.com/acme/app/issues/7#issuecomment-42', user: { login: 'mastra-platform[bot]', avatarUrl: null, htmlUrl: 'https://github.com/apps/mastra-platform' }, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ comments: [{ ...created, id: 9, user: { ...created.user, login: 'person' } }] }))
      .mockResolvedValueOnce(json(created));
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.upsertFactoryTriageComment({ installationId: 7, repository: 'acme/app', issueNumber: 7, body: '<!-- mastra-factory-triage -->\nPending' }),
    ).resolves.toEqual({ action: 'created', commentId: '42', url: created.htmlUrl });
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}${new URL(String(url)).search}`)).toEqual([
      'GET /v1/server/github/repos/acme/app/issues/7/comments?page=1&per_page=30',
      'POST /v1/server/github/repos/acme/app/issues/7/comments',
    ]);
  });

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
      nextCursor: '2',
    });
    await expect(
      integration.versionControl.listPullRequests({ connection: installationConnection, sourceId: 'acme/app' }),
    ).resolves.toEqual({
      pullRequests: [expect.objectContaining({ id: '34', baseBranch: 'main', headBranch: 'feat/intake' })],
      nextCursor: null,
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('label=bug%2Curgent');
  });

  it('continues platform issue pagination after a short filtered page and stops on an empty page', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      return json({ issues: url.searchParams.get('page') === '1' ? [issue] : [] });
    });
    const integration = createIntegration(fetchImpl);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    const firstPage = await integration.intake.listIssues({
      connection,
      sourceIds: ['acme/app'],
      cursor: '1',
    });
    const secondPage = await integration.intake.listIssues({
      connection,
      sourceIds: ['acme/app'],
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(firstPage).toMatchObject({ issues: [expect.objectContaining({ id: '12' })], nextCursor: '2' });
    expect(secondPage).toEqual({ issues: [], nextCursor: null });
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

  it('exposes platform-backed routes and session tools without local callback or webhook routes', async () => {
    const seed = await createPlatformStorageForTests();
    const integration = createIntegration();
    const context = {
      auth: fakeAuth(),
      sandbox: { enabled: true, provider: 'stub' },
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
      'github_upsert_factory_triage_comment',
      'github_subscribe_pr',
      'github_unsubscribe_pr',
    ]);
    expect(integration.workers(context).map(worker => worker.name)).toEqual(['platform-github-events']);
    expect(integration.diagnostics()).toEqual({
      mode: 'platform',
      endpointHost: 'platform.example.com',
      polling: { enabled: true },
      reconcile: {
        pullRequests: { enabled: true },
        issues: { enabled: true },
      },
    });
    expect(JSON.stringify(integration.diagnostics())).not.toContain(config.accessToken);
  });

  it('maps pull request relevance from the Platform reconcile response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({
        title: 'Ship intake',
        html_url: 'https://github.com/acme/app/pull/34',
        state: 'closed',
        draft: false,
        merged: true,
        created_at: '2026-07-01T00:00:00Z',
        user: { login: 'ada' },
        assignees: [{ login: 'linus' }],
        requested_reviewers: [{ login: 'margaret' }],
        labels: [{ name: 'bug' }, 'urgent'],
        merged_by: { login: 'grace' },
        head: { ref: 'feat/intake' },
        base: { ref: 'main' },
      }),
    );
    const integration = createIntegration(fetchImpl);

    await expect(
      integration.fetchPullRequestState({ installationId: 7, repository: 'acme/app', number: 34 }),
    ).resolves.toEqual({
      title: 'Ship intake',
      url: 'https://github.com/acme/app/pull/34',
      state: 'closed',
      draft: false,
      merged: true,
      assignees: ['linus'],
      requestedReviewers: ['margaret'],
      labels: ['bug', 'urgent'],
      headBranch: 'feat/intake',
      baseBranch: 'main',
      author: 'ada',
      createdAt: '2026-07-01T00:00:00Z',
      mergedBy: 'grace',
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://platform.example.com/v1/server/github/repos/acme/app/pulls/34',
    );
  });

  it('attaches GitHub rules to polled issue ingress', async () => {
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
    const onEvent = vi.fn();
    const context = {
      auth: fakeAuth(),
      // Only presence is read here; the callback is never invoked.
      sandbox: (() => ({})) as never,
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
      sandbox: { enabled: true, provider: 'stub' },
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
      sandbox: { enabled: true, provider: 'stub' },
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
      sandbox: { enabled: true, provider: 'stub' },
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

  it('defaults the Platform base URL and requires a platform credential', () => {
    vi.stubEnv('MASTRA_SHARED_API_URL', '');
    expect(new PlatformGithubIntegration().diagnostics()).toMatchObject({ endpointHost: 'platform.mastra.ai' });

    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'injected-token');
    expect(() => new PlatformGithubIntegration()).not.toThrow();

    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    expect(() => new PlatformGithubIntegration()).toThrow(/MASTRA_PLATFORM_ACCESS_TOKEN/);
  });

  it('exposes an explicitly configured GitHub App slug to webhook rules', () => {
    expect(new PlatformGithubIntegration({ slug: 'factory-app' }).slug).toBe('factory-app');
    expect(new PlatformGithubIntegration().slug).toBeUndefined();
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
      reconcile: {
        pullRequests: { enabled: false },
        issues: { enabled: false },
      },
    });
  });

  it('reuses a resolved collaborator permission instead of re-requesting it per card and event', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ permission: 'write', roleName: 'write', user: actor }))
      .mockResolvedValueOnce(json({ error: 'rate limited' }, 403))
      .mockResolvedValueOnce(json({ permission: 'read', roleName: 'read', user: actor }));
    const integration = createIntegration(fetchImpl);

    await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'Grace')).resolves.toBe('write');
    await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace')).resolves.toBe('write');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // A failed lookup is not cached: the next call for that login retries.
    await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'hank')).resolves.toBeUndefined();
    await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'hank')).resolves.toBe('read');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('shares one in-flight request between overlapping lookups for the same login', async () => {
    let release!: (value: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => (release = resolve)));
    const integration = createIntegration(fetchImpl);

    const first = integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace');
    const second = integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'GRACE');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    release(json({ permission: 'write', roleName: 'write', user: actor }));
    await expect(Promise.all([first, second])).resolves.toEqual(['write', 'write']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a coalesced lookup alive for other callers when one caller's signal aborts", async () => {
    let release!: (value: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => (release = resolve)));
    const integration = createIntegration(fetchImpl);
    const aborter = new AbortController();

    const aborted = integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace', aborter.signal);
    const patient = integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace');
    aborter.abort();
    await expect(aborted).resolves.toBeUndefined();

    release(json({ permission: 'write', roleName: 'write', user: actor }));
    await expect(patient).resolves.toBe('write');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // The shared request never carried the caller's signal.
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(false);
  });

  it('re-requests a collaborator permission once the cache entry expires', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ permission: 'write', roleName: 'write', user: actor }))
        .mockResolvedValueOnce(json({ permission: 'read', roleName: 'read', user: actor }));
      const integration = createIntegration(fetchImpl);

      await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace')).resolves.toBe('write');
      vi.advanceTimersByTime(29 * 60_000);
      await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace')).resolves.toBe('write');
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2 * 60_000);
      await expect(integration.getRepositoryCollaboratorPermission(7, 'acme/app', 'grace')).resolves.toBe('read');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the reconciliation worker alive when polling is disabled', async () => {
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_ENABLED', 'false');
    const seed = await createPlatformStorageForTests();
    const integration = createIntegration();
    const context = {
      controller: {},
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
      },
    } as unknown as IntegrationContext;
    integration.versionControl.initialize({ storage: context.storage.sourceControl });

    const workers = integration.workers(context);
    expect(workers).toHaveLength(1);
    expect(integration.diagnostics()).toMatchObject({
      polling: { enabled: false },
      reconcile: {
        pullRequests: { enabled: true },
        issues: { enabled: true },
      },
    });
  });

  it('allows issue reconciliation to override a disabled legacy reconcile switch', async () => {
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_ENABLED', 'false');
    vi.stubEnv('MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED', 'false');
    vi.stubEnv('MASTRACODE_PLATFORM_GITHUB_ISSUE_RECONCILE_ENABLED', 'true');
    const seed = await createPlatformStorageForTests();
    const integration = createIntegration();
    const context = {
      controller: {},
      storage: {
        generic: seed.integrations.forIntegration('github'),
        sourceControl: seed.sourceControl.forIntegration('github'),
      },
    } as unknown as IntegrationContext;
    integration.versionControl.initialize({ storage: context.storage.sourceControl });

    const workers = integration.workers(context);
    expect(workers).toHaveLength(1);
    expect(integration.diagnostics()).toMatchObject({
      reconcile: {
        pullRequests: { enabled: false },
        issues: { enabled: true },
      },
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


});
