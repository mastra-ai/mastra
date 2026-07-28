import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { SandboxFleet } from '../../sandbox/fleet.js';
import { createStateSigner } from '../../state-signing.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { GithubIntegration, normalizePrivateKey } from './integration.js';

// Real RSA key so we can prove Node's PEM decoder accepts the normalized
// output (the failure mode is `error:1E08010C:DECODER routines::unsupported`).
const { privateKey: pem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function validConfig() {
  return {
    appId: '12345',
    privateKey: pem,
    clientId: 'Iv1.client',
    clientSecret: 'shhh',
    slug: 'test-app',
    webhookSecret: 'hook-secret',
  };
}

function pullRequestData() {
  return {
    number: 34,
    title: 'Ship intake',
    html_url: 'https://github.com/acme/app/pull/34',
    user: { login: 'ada' },
    body: 'Ready to ship',
    state: 'open',
    base: { ref: 'main' },
    head: { ref: 'feat/intake', sha: 'abc123' },
    draft: false,
    merged: false,
    mergeable: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
  };
}

function commentData() {
  return {
    id: 91,
    html_url: 'https://github.com/acme/app/pull/34#issuecomment-91',
    user: { login: 'grace' },
    body: 'Looks good',
    created_at: '2026-07-03T00:00:00Z',
    updated_at: '2026-07-03T00:00:00Z',
  };
}

describe('normalizePrivateKey', () => {
  it('passes a proper multi-line PEM through unchanged', () => {
    expect(normalizePrivateKey(pem)).toBe(pem);
    expect(() => createPrivateKey(normalizePrivateKey(pem))).not.toThrow();
  });

  it('converts \\n-escaped single-line PEMs', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => createPrivateKey(normalizePrivateKey(escaped))).not.toThrow();
  });

  it('rebuilds fully flattened PEMs (newlines stripped by env tooling)', () => {
    const flattened = pem.replace(/\n/g, '');
    expect(flattened).not.toContain('\n');
    const normalized = normalizePrivateKey(flattened);
    expect(() => createPrivateKey(normalized)).not.toThrow();
  });

  it('leaves non-PEM values untouched', () => {
    expect(normalizePrivateKey('not-a-key')).toBe('not-a-key');
  });
});

describe('GithubIntegration constructor', () => {
  it('constructs from a full config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.id).toBe('github');
    expect(github.requiresStableStateSigner).toBe(true);
    expect(github.slug).toBe('test-app');
    expect(github.webhookSecret).toBe('hook-secret');
  });

  it('throws listing every missing required field', () => {
    expect(() => new GithubIntegration({ ...validConfig(), appId: '', slug: '' })).toThrow(/appId, slug/);
  });

  it('treats an empty webhook secret as unconfigured', () => {
    const github = new GithubIntegration({ ...validConfig(), webhookSecret: '' });
    expect(github.webhookSecret).toBeUndefined();
  });

  it('normalizes an \\n-escaped private key at construction', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => new GithubIntegration({ ...validConfig(), privateKey: escaped })).not.toThrow();
  });
});

describe('GithubIntegration capability surface', () => {
  it('normalizes GitHub issues through the shared Intake contract', async () => {
    const github = new GithubIntegration(validConfig());
    const listForRepo = vi.fn(async () => ({
      data: [
        {
          number: 12,
          title: 'Fix intake',
          html_url: 'https://github.com/acme/app/issues/12',
          user: { login: 'ada' },
          labels: [{ name: 'bug' }],
          comments: 3,
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-02T00:00:00Z',
        },
      ],
    }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { listForRepo } } as any);

    await expect(
      github.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: ['acme/app'],
        labels: ['bug', 'urgent'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: '12',
          identifier: '#12',
          source: 'acme/app',
          state: 'open',
          labels: ['bug'],
          commentCount: 3,
        }),
      ],
      nextCursor: null,
    });
    expect(listForRepo).toHaveBeenCalledWith(expect.objectContaining({ labels: 'bug,urgent' }));
  });

  it('fetches issue details and creates comments through the shared Intake contract', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({
      data: {
        number: 12,
        title: 'Fix intake',
        html_url: 'https://github.com/acme/app/issues/12',
        user: { login: 'ada' },
        state: 'open',
        assignee: null,
        labels: [{ name: 'bug' }],
        comments: 1,
        body: 'Issue body',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      },
    }));
    const createComment = vi.fn(async () => ({
      data: { id: 99, html_url: 'https://github.com/acme/app/issues/12#issuecomment-99' },
    }));
    const paginate = vi.fn(async () => [
      { user: { login: 'grace' }, body: 'Looking now', created_at: '2026-07-03T00:00:00Z' },
    ]);
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({
      issues: { get, listComments: vi.fn(), createComment },
      paginate,
    } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    await expect(github.intake.getIssue({ connection, sourceId: 'acme/app', issueId: '12' })).resolves.toMatchObject({
      description: 'Issue body',
      comments: [{ author: 'grace', body: 'Looking now' }],
    });
    await expect(
      github.intake.createComment({ connection, sourceId: 'acme/app', issueId: '12', body: 'Done' }),
    ).resolves.toEqual({ id: '99', url: 'https://github.com/acme/app/issues/12#issuecomment-99' });
  });

  it('maps byType stateTypes to open/closed and updates the GitHub issue', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({ data: { number: 12, pull_request: null } }));
    const update = vi.fn(async () => ({
      data: {
        number: 12,
        title: 'Fix intake',
        html_url: 'https://github.com/acme/app/issues/12',
        user: { login: 'ada' },
        state: 'closed',
        assignee: null,
        labels: [] as string[],
        comments: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      },
    }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { get, update } } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    await expect(
      github.intake.updateIssue({
        connection,
        sourceId: 'acme/app',
        issueId: '12',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toMatchObject({ id: '12', state: 'closed' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed', state_reason: 'completed', issue_number: 12 }),
    );
  });

  it('sets state_reason=not_planned when the target is canceled', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({ data: { number: 12, pull_request: null } }));
    const update = vi.fn(async () => ({
      data: {
        number: 12,
        title: 'x',
        html_url: 'u',
        user: null,
        state: 'closed',
        assignee: null,
        labels: [] as string[],
        comments: 0,
        created_at: 'a',
        updated_at: 'b',
      },
    }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { get, update } } as any);

    await github.intake.updateIssue({
      connection: { type: 'app-installation', installationId: 7 },
      sourceId: 'acme/app',
      issueId: '12',
      state: { kind: 'byType', stateType: 'canceled' },
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ state: 'closed', state_reason: 'not_planned' }));
  });

  it('refuses to close a pull request through updateIssue', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({ data: { number: 34, pull_request: { url: 'x' } } }));
    const update = vi.fn();
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { get, update } } as any);

    await expect(
      github.intake.updateIssue({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
        issueId: '34',
        state: { kind: 'byType', stateType: 'completed' },
      }),
    ).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('ignores byName targets (GitHub has no custom states)', async () => {
    const github = new GithubIntegration(validConfig());
    const update = vi.fn();
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { get: vi.fn(), update } } as any);

    await expect(
      github.intake.updateIssue({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
        issueId: '12',
        state: { kind: 'byName', name: 'In Review' },
      }),
    ).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('normalizes pull requests through the shared VersionControl contract', async () => {
    const github = new GithubIntegration(validConfig());
    const list = vi.fn(async () => ({ data: [pullRequestData()] }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ pulls: { list } } as any);

    await expect(
      github.versionControl.listPullRequests({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
      }),
    ).resolves.toEqual({
      pullRequests: [
        expect.objectContaining({ id: '34', baseBranch: 'main', headBranch: 'feat/intake', headSha: 'abc123' }),
      ],
      nextCursor: null,
    });
  });

  it('implements the full pull-request lifecycle through VersionControl', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({ data: pullRequestData() }));
    const create = vi.fn(async () => ({ data: pullRequestData() }));
    const update = vi.fn(async () => ({ data: pullRequestData() }));
    const merge = vi.fn(async () => ({ data: { merged: true, message: 'merged', sha: 'merge-sha' } }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ pulls: { get, create, update, merge } } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };
    const ref = { connection, sourceId: 'acme/app', pullRequestId: '34' };

    await expect(github.versionControl.getPullRequest(ref)).resolves.toMatchObject({ id: '34', state: 'open' });
    await expect(
      github.versionControl.createPullRequest({
        connection,
        sourceId: 'acme/app',
        title: 'Ship intake',
        body: 'Ready to ship',
        baseBranch: 'main',
        headBranch: 'feat/intake',
        draft: true,
      }),
    ).resolves.toMatchObject({ id: '34' });
    await github.versionControl.updatePullRequest({ ...ref, title: 'Ship all intake', body: null });
    await github.versionControl.closePullRequest(ref);
    await expect(github.versionControl.mergePullRequest({ ...ref, method: 'squash' })).resolves.toEqual({
      merged: true,
      message: 'merged',
      sha: 'merge-sha',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'acme', repo: 'app', base: 'main', head: 'feat/intake', draft: true }),
    );
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ pull_number: 34, body: '' }));
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ pull_number: 34, state: 'closed' }));
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ pull_number: 34, merge_method: 'squash' }));
  });

  it('implements conversation and inline review comment CRUD through VersionControl', async () => {
    const github = new GithubIntegration(validConfig());
    const issueComment = commentData();
    const reviewComment = { ...commentData(), path: 'src/app.ts', line: 12, side: 'RIGHT', commit_id: 'abc123' };
    const issues = {
      listComments: vi.fn(async () => ({ data: [issueComment] })),
      createComment: vi.fn(async () => ({ data: issueComment })),
      updateComment: vi.fn(async () => ({ data: issueComment })),
      deleteComment: vi.fn(async () => undefined),
    };
    const pulls = {
      listReviewComments: vi.fn(async () => ({ data: [reviewComment] })),
      createReviewComment: vi.fn(async () => ({ data: reviewComment })),
      createReplyForReviewComment: vi.fn(async () => ({ data: { ...reviewComment, in_reply_to_id: 91 } })),
      updateReviewComment: vi.fn(async () => ({ data: reviewComment })),
      deleteReviewComment: vi.fn(async () => undefined),
    };
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues, pulls } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };
    const ref = { connection, sourceId: 'acme/app', pullRequestId: '34' };

    await expect(github.versionControl.listComments(ref)).resolves.toMatchObject({ comments: [{ id: '91' }] });
    await github.versionControl.createComment({ ...ref, body: 'Looks good' });
    await github.versionControl.updateComment({ connection, sourceId: 'acme/app', commentId: '91', body: 'Updated' });
    await github.versionControl.deleteComment({ connection, sourceId: 'acme/app', commentId: '91' });
    await expect(github.versionControl.listReviewComments(ref)).resolves.toMatchObject({
      comments: [{ id: '91', path: 'src/app.ts', line: 12, side: 'right' }],
    });
    await github.versionControl.createReviewComment({
      ...ref,
      body: 'Fix this',
      commitId: 'abc123',
      path: 'src/app.ts',
      line: 12,
      side: 'right',
    });
    await github.versionControl.createReviewComment({ ...ref, body: 'Agreed', replyToId: '91' });
    await github.versionControl.updateReviewComment({
      connection,
      sourceId: 'acme/app',
      commentId: '91',
      body: 'Updated',
    });
    await github.versionControl.deleteReviewComment({ connection, sourceId: 'acme/app', commentId: '91' });

    expect(pulls.createReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 34, commit_id: 'abc123', path: 'src/app.ts', line: 12, side: 'RIGHT' }),
    );
    expect(pulls.createReplyForReviewComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 91 }));
  });

  it('implements reviews and reviewer requests through VersionControl', async () => {
    const github = new GithubIntegration(validConfig());
    const review = {
      id: 55,
      html_url: 'https://github.com/acme/app/pull/34#pullrequestreview-55',
      user: { login: 'grace' },
      body: 'Approved',
      state: 'APPROVED',
      commit_id: 'abc123',
      submitted_at: '2026-07-03T00:00:00Z',
    };
    const pulls = {
      listReviews: vi.fn(async () => ({ data: [review] })),
      getReview: vi.fn(async () => ({ data: review })),
      createReview: vi.fn(async () => ({ data: review })),
      updateReview: vi.fn(async () => ({ data: { ...review, state: 'PENDING' } })),
      submitReview: vi.fn(async () => ({ data: review })),
      dismissReview: vi.fn(async () => ({ data: { ...review, state: 'DISMISSED' } })),
      deletePendingReview: vi.fn(async () => undefined),
      listRequestedReviewers: vi.fn(async () => ({ data: { users: [{ login: 'grace' }], teams: [{ slug: 'core' }] } })),
      requestReviewers: vi.fn(async () => ({
        data: { requested_reviewers: [{ login: 'grace' }], requested_teams: [{ slug: 'core' }] },
      })),
      removeRequestedReviewers: vi.fn(async () => ({ data: { requested_reviewers: [], requested_teams: [] } })),
    };
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ pulls } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };
    const ref = { connection, sourceId: 'acme/app', pullRequestId: '34' };

    await expect(github.versionControl.listReviews(ref)).resolves.toMatchObject({ reviews: [{ state: 'approved' }] });
    await expect(github.versionControl.getReview({ ...ref, reviewId: '55' })).resolves.toMatchObject({ id: '55' });
    await github.versionControl.createReview({ ...ref, body: 'Approved', event: 'approve' });
    await github.versionControl.updateReview({ ...ref, reviewId: '55', body: 'Pending update' });
    await github.versionControl.submitReview({ ...ref, reviewId: '55', body: 'Approved', event: 'approve' });
    await github.versionControl.dismissReview({ ...ref, reviewId: '55', message: 'Superseded' });
    await github.versionControl.deletePendingReview({ ...ref, reviewId: '55' });
    await expect(github.versionControl.listRequestedReviewers(ref)).resolves.toEqual({
      users: ['grace'],
      teams: ['core'],
    });
    await expect(
      github.versionControl.requestReviewers({ ...ref, users: ['grace'], teams: ['core'] }),
    ).resolves.toEqual({
      users: ['grace'],
      teams: ['core'],
    });
    await expect(github.versionControl.removeRequestedReviewers({ ...ref, users: ['grace'] })).resolves.toEqual({
      users: [],
      teams: [],
    });

    expect(pulls.createReview).toHaveBeenCalledWith(expect.objectContaining({ event: 'APPROVE' }));
    expect(pulls.dismissReview).toHaveBeenCalledWith(expect.objectContaining({ review_id: 55 }));
  });
});

describe('GithubIntegration FactoryIntegration surface', () => {
  it('routes() returns the GitHub HTTP surface as ApiRoute[]', async () => {
    const { integrations, sourceControl, projects, intake } = await createFactoryStorageForTests();
    const github = new GithubIntegration(validConfig());
    const routes = github.routes({
      auth: fakeRouteAuth(),
      fleet: new SandboxFleet(),
      stateSigner: createStateSigner('secret'),
      storage: {
        generic: integrations.forIntegration(github.id),
        sourceControl: sourceControl.forIntegration(github.id),
        projects,
        intake,
      },
    });
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.path).toMatch(/^\/(web|auth)\/github\/|^\/web\/user-sessions\//);
    }
  });

  it('registers provider installations and repositories through its version-control capability', async () => {
    const { sourceControl } = await createFactoryStorageForTests();
    const github = new GithubIntegration(validConfig());
    github.versionControl.initialize({ storage: sourceControl.forIntegration(github.id) });

    const installation = await github.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '42', accountName: 'octo', accountType: 'Organization' },
    });
    const [repository] = await github.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '101', slug: 'octo/widgets', defaultBranch: 'main' }],
    });

    expect(repository).toMatchObject({
      installationId: installation.id,
      externalId: '101',
      slug: 'octo/widgets',
      defaultBranch: 'main',
    });
    await expect(github.intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      {
        id: repository!.id,
        name: 'octo/widgets',
        type: 'repository',
        metadata: { defaultBranch: 'main' },
      },
    ]);
  });

  it('diagnostics() exposes only non-secret config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.diagnostics()).toEqual({ slug: 'test-app', webhookSecretConfigured: true });
  });

  describe('resolveIntakeDispatch', () => {
    async function createGithubWithRepo() {
      const { sourceControl } = await createFactoryStorageForTests();
      const github = new GithubIntegration(validConfig());
      github.versionControl.initialize({ storage: sourceControl.forIntegration(github.id) });
      const installation = await github.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: '42', accountName: 'octo', accountType: 'Organization' },
      });
      await github.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '101', slug: 'octo/widgets', defaultBranch: 'main' }],
      });
      return github;
    }

    it('derives the target from the stored external source locator', async () => {
      const github = await createGithubWithRepo();
      await expect(
        github.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: '101:7' },
        }),
      ).resolves.toEqual({
        connection: { type: 'app-installation', installationId: 42 },
        sourceId: 'octo/widgets',
        issueId: '7',
      });
    });

    it('supports legacy locators that still identify the repository and issue', async () => {
      const github = await createGithubWithRepo();
      await expect(
        github.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: 'github:101:issue:11' },
        }),
      ).resolves.toMatchObject({ sourceId: 'octo/widgets', issueId: '11' });
      await expect(
        github.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: '101:13' },
        }),
      ).resolves.toMatchObject({ sourceId: 'octo/widgets', issueId: '13' });
    });

    it('returns null when the repository or issue number cannot be derived', async () => {
      const github = await createGithubWithRepo();
      await expect(
        github.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: '999:7' },
        }),
      ).resolves.toBeNull();
      await expect(
        github.intake.resolveIntakeDispatch!({
          orgId: 'org-1',
          externalSource: { type: 'issue', externalId: 'not-a-known-format' },
        }),
      ).resolves.toBeNull();
    });
  });
});
