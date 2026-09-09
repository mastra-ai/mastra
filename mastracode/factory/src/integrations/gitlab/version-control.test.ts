import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationConnection } from '../../capabilities/connection.js';
import { UnsupportedVersionControlOperationError } from '../../capabilities/version-control.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import { GitLabClient } from './client.js';
import type { GitLabMergeRequest } from './client.js';
import { GitLabVersionControl } from './version-control.js';

// ── fetch harness ────────────────────────────────────────────────────────
// The real client runs against a stubbed `fetch`, so these specs assert the
// wire format GitLab would actually receive — the translation layer is the
// whole point of this file, and a mocked client would hide it.
interface Captured {
  url: URL;
  method: string;
  body: unknown;
}

let captured: Captured[] = [];
let respond: (request: Captured) => Response;

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  captured = [];
  respond = () => json({});
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const request: Captured = {
      url: input instanceof URL ? input : new URL(String(input)),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    captured.push(request);
    return respond(request);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const connection: IntegrationConnection = { type: 'oauth', accessToken: 'gl-token' };
const ref = { connection, sourceId: '42', pullRequestId: '7' };

function versionControl(options: { repositorySlug?: string | null; token?: string | null } = {}): GitLabVersionControl {
  const vc = new GitLabVersionControl({
    clientForConnection: c => new GitLabClient({ baseUrl: 'https://gitlab.com', accessToken: c.accessToken }),
    clientForOrg: async () => new GitLabClient({ baseUrl: 'https://gitlab.com', accessToken: 'gl-token' }),
    accessTokenForOrg: async () => (options.token === undefined ? 'gl-token' : options.token),
    baseUrl: 'https://gitlab.com',
  });
  const slug = options.repositorySlug;
  vc.initialize({
    storage: {
      integrationId: 'gitlab',
      repositories: {
        get: async () => (slug === null ? null : { slug: slug ?? 'acme/widgets' }),
      },
      installations: {},
    } as unknown as SourceControlStorageHandle,
  });
  return vc;
}

function mergeRequest(overrides: Partial<GitLabMergeRequest> = {}): GitLabMergeRequest {
  return {
    id: 9001,
    iid: 7,
    project_id: 42,
    title: 'Add GitLab support',
    description: 'Body text',
    state: 'opened',
    web_url: 'https://gitlab.com/acme/widgets/-/merge_requests/7',
    author: { username: 'ada' },
    assignees: [{ username: 'grace' }],
    reviewers: [{ username: 'linus' }],
    labels: ['backend'],
    draft: false,
    merge_status: 'can_be_merged',
    source_branch: 'factory/gitlab-7',
    target_branch: 'main',
    sha: 'abc123',
    merge_commit_sha: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('GitLabVersionControl merge-request translation', () => {
  it('maps an open merge request onto the pull-request contract', async () => {
    respond = () => json(mergeRequest());

    const pr = await versionControl().getPullRequest(ref);

    expect(pr).toEqual({
      // The contract's id is the per-project iid, matching how issues are addressed.
      id: '7',
      title: 'Add GitLab support',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/7',
      author: 'ada',
      assignees: ['grace'],
      requestedReviewers: ['linus'],
      labels: ['backend'],
      body: 'Body text',
      state: 'open',
      draft: false,
      merged: false,
      mergeable: true,
      // source/target invert into head/base.
      baseBranch: 'main',
      headBranch: 'factory/gitlab-7',
      headSha: 'abc123',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });
    expect(captured[0]?.url.pathname).toBe('/api/v4/projects/42/merge_requests/7');
  });

  it('reports a merged request as closed and merged, not open', async () => {
    respond = () => json(mergeRequest({ state: 'merged' }));

    const pr = await versionControl().getPullRequest(ref);

    expect(pr?.state).toBe('closed');
    expect(pr?.merged).toBe(true);
  });

  it('reports a locked request as closed but not merged', async () => {
    respond = () => json(mergeRequest({ state: 'locked' }));

    const pr = await versionControl().getPullRequest(ref);

    expect(pr?.state).toBe('closed');
    expect(pr?.merged).toBe(false);
  });

  it('reports an undecided merge status as unknown rather than unmergeable', async () => {
    // `checking` means GitLab has not finished; calling that `false` would tell
    // a caller the branch conflicts when it may merge cleanly.
    respond = () => json(mergeRequest({ merge_status: 'checking' }));

    await expect(versionControl().getPullRequest(ref)).resolves.toMatchObject({ mergeable: null });

    respond = () => json(mergeRequest({ merge_status: 'cannot_be_merged' }));
    await expect(versionControl().getPullRequest(ref)).resolves.toMatchObject({ mergeable: false });
  });

  it('reads a legacy work_in_progress flag as draft', async () => {
    respond = () => json(mergeRequest({ draft: undefined, work_in_progress: true }));

    await expect(versionControl().getPullRequest(ref)).resolves.toMatchObject({ draft: true });
  });

  it('returns null for a merge request that does not exist', async () => {
    respond = () => json({ message: '404 Not found' }, { status: 404 });

    await expect(versionControl().getPullRequest(ref)).resolves.toBeNull();
  });

  it('rejects a merge-request id that is not a positive iid', async () => {
    await expect(versionControl().getPullRequest({ ...ref, pullRequestId: 'abc' })).rejects.toThrow(/positive iid/);
    await expect(versionControl().getPullRequest({ ...ref, pullRequestId: '0' })).rejects.toThrow(/positive iid/);
  });
});

describe('GitLabVersionControl lifecycle', () => {
  it('creates a merge request with branches in GitLab vocabulary', async () => {
    respond = () => json(mergeRequest());

    await versionControl().createPullRequest({
      connection,
      sourceId: '42',
      title: 'Add GitLab support',
      body: 'Body text',
      baseBranch: 'main',
      headBranch: 'factory/gitlab-7',
    });

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.body).toMatchObject({
      title: 'Add GitLab support',
      source_branch: 'factory/gitlab-7',
      target_branch: 'main',
    });
  });

  it('marks a draft with the title prefix GitLab uses, since it has no create-time flag', async () => {
    respond = () => json(mergeRequest());

    await versionControl().createPullRequest({
      connection,
      sourceId: '42',
      title: 'Add GitLab support',
      baseBranch: 'main',
      headBranch: 'factory/gitlab-7',
      draft: true,
    });

    expect(captured[0]?.body).toMatchObject({ title: 'Draft: Add GitLab support' });
  });

  it('does not double-prefix a title that already says Draft', async () => {
    respond = () => json(mergeRequest());

    await versionControl().createPullRequest({
      connection,
      sourceId: '42',
      title: 'Draft: Add GitLab support',
      baseBranch: 'main',
      headBranch: 'factory/gitlab-7',
      draft: true,
    });

    expect(captured[0]?.body).toMatchObject({ title: 'Draft: Add GitLab support' });
  });

  it('closes an open merge request with a state event', async () => {
    respond = () => json(mergeRequest());

    await versionControl().closePullRequest(ref);

    const put = captured.find(request => request.method === 'PUT');
    expect(put?.body).toMatchObject({ state_event: 'close' });
  });

  it('omits the state event when the request is already closed', async () => {
    // GitLab rejects a `state_event` that would be a no-op, so re-closing a
    // closed request must not send one.
    respond = () => json(mergeRequest({ state: 'closed' }));

    await versionControl().closePullRequest(ref);

    const put = captured.find(request => request.method === 'PUT');
    expect(put?.body).not.toHaveProperty('state_event');
  });

  it('clears a description when the body is explicitly null', async () => {
    respond = () => json(mergeRequest());

    await versionControl().updatePullRequest({ ...ref, body: null });

    const put = captured.find(request => request.method === 'PUT');
    expect(put?.body).toMatchObject({ description: null });
  });

  it('squashes when asked and reports the resulting sha', async () => {
    respond = request =>
      request.url.pathname.endsWith('/merge')
        ? json(mergeRequest({ state: 'merged', squash_commit_sha: 'squashed1' }))
        : json(mergeRequest());

    const result = await versionControl().mergePullRequest({ ...ref, method: 'squash', commitMessage: 'Ship it' });

    expect(result).toEqual({ merged: true, message: 'Merge request merged.', sha: 'squashed1' });
    const merge = captured.find(request => request.url.pathname.endsWith('/merge'));
    expect(merge?.body).toMatchObject({ squash: true, squash_commit_message: 'Ship it' });
  });

  it('reports a declined merge as unmerged rather than throwing', async () => {
    // A merge GitLab refuses (pipeline failing, conflicts) is an answer the
    // caller must report, not an infrastructure failure.
    respond = request =>
      request.url.pathname.endsWith('/merge')
        ? json({ message: 'Method Not Allowed' }, { status: 405 })
        : json(mergeRequest());

    const result = await versionControl().mergePullRequest(ref);

    expect(result.merged).toBe(false);
    expect(result.sha).toBeNull();
    expect(result.message).toContain('405');
  });

  it('refuses a rebase merge instead of silently merging a different way', async () => {
    await expect(versionControl().mergePullRequest({ ...ref, method: 'rebase' })).rejects.toBeInstanceOf(
      UnsupportedVersionControlOperationError,
    );
  });
});

describe('GitLabVersionControl comments and reviews', () => {
  it('anchors a note url on the merge-request page, since notes have none', async () => {
    respond = request =>
      request.url.pathname.endsWith('/notes')
        ? json([{ id: 5, body: 'Looks good', system: false, author: { username: 'ada' }, created_at: 'T1' }])
        : json(mergeRequest());

    const page = await versionControl().listComments(ref);

    expect(page.comments[0]).toMatchObject({
      id: '5',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/7#note_5',
      author: 'ada',
      // GitLab omits updated_at on an unedited note; the contract requires one.
      updatedAt: 'T1',
    });
  });

  it('drops system notes, which are activity rather than discussion', async () => {
    respond = request =>
      request.url.pathname.endsWith('/notes')
        ? json([
            { id: 5, body: 'Looks good', system: false, author: { username: 'ada' }, created_at: 'T1' },
            { id: 6, body: 'changed target branch', system: true, author: null, created_at: 'T2' },
          ])
        : json(mergeRequest());

    const page = await versionControl().listComments(ref);

    expect(page.comments).toHaveLength(1);
  });

  it('reads approvals as approved reviews, GitLab having no review object', async () => {
    respond = request =>
      request.url.pathname.endsWith('/approvals')
        ? json({ approved_by: [{ user: { username: 'grace' } }] })
        : json(mergeRequest());

    const page = await versionControl().listReviews(ref);

    expect(page.reviews).toEqual([
      { id: 'approval:grace', url: mergeRequest().web_url, author: 'grace', body: null, state: 'approved', commitId: 'abc123', submittedAt: null },
    ]);
  });

  it('approves through the approve endpoint and posts the body as a note', async () => {
    respond = request =>
      request.url.pathname.endsWith('/user') ? json({ username: 'factory-bot' }) : json(mergeRequest());

    const review = await versionControl().createReview({ ...ref, event: 'approve', body: 'Ship it' });

    expect(review.state).toBe('approved');
    expect(review.author).toBe('factory-bot');
    expect(captured.some(request => request.url.pathname.endsWith('/approve'))).toBe(true);
    expect(captured.some(request => request.url.pathname.endsWith('/notes'))).toBe(true);
  });

  it('does not post an empty note when approving without a body', async () => {
    respond = request =>
      request.url.pathname.endsWith('/user') ? json({ username: 'factory-bot' }) : json(mergeRequest());

    await versionControl().createReview({ ...ref, event: 'approve' });

    expect(captured.some(request => request.url.pathname.endsWith('/notes'))).toBe(false);
  });

  it('records a changes-requested verdict as a note, GitLab having no such primitive', async () => {
    respond = request =>
      request.url.pathname.endsWith('/notes')
        ? json({ id: 8, body: 'Needs work', system: false, author: { username: 'ada' }, created_at: 'T1' })
        : json(mergeRequest());

    const review = await versionControl().createReview({ ...ref, event: 'request-changes', body: 'Needs work' });

    expect(review.state).toBe('changes-requested');
    expect(review.body).toBe('Needs work');
    // Not an approval — no approve call may leak into a rejection.
    expect(captured.some(request => request.url.pathname.endsWith('/approve'))).toBe(false);
  });

  it('keeps only diff-anchored notes as review comments', async () => {
    respond = request =>
      request.url.pathname.endsWith('/discussions')
        ? json([
            {
              id: 'd1',
              individual_note: false,
              notes: [
                {
                  id: 11,
                  body: 'This line leaks',
                  system: false,
                  author: { username: 'ada' },
                  created_at: 'T1',
                  position: { new_path: 'src/app.ts', new_line: 42, head_sha: 'abc123' },
                },
                // A thread's plain reply carries no position and is not a line comment.
                { id: 12, body: 'Agreed', system: false, author: { username: 'grace' }, created_at: 'T2' },
              ],
            },
          ])
        : json(mergeRequest());

    const page = await versionControl().listReviewComments(ref);

    expect(page.comments).toHaveLength(1);
    expect(page.comments[0]).toMatchObject({ path: 'src/app.ts', line: 42, side: 'right', commitId: 'abc123' });
  });

  it('reads an old-line-only note as a left-side comment', async () => {
    respond = request =>
      request.url.pathname.endsWith('/discussions')
        ? json([
            {
              id: 'd1',
              individual_note: true,
              notes: [
                {
                  id: 11,
                  body: 'Deleted line',
                  system: false,
                  author: { username: 'ada' },
                  created_at: 'T1',
                  position: { old_path: 'src/app.ts', old_line: 7, head_sha: 'abc123' },
                },
              ],
            },
          ])
        : json(mergeRequest());

    const page = await versionControl().listReviewComments(ref);

    expect(page.comments[0]).toMatchObject({ path: 'src/app.ts', line: 7, side: 'left' });
  });

  it('anchors a new review comment with the merge requests own diff shas', async () => {
    respond = request =>
      request.url.pathname.endsWith('/discussions')
        ? json({
            id: 'd1',
            individual_note: false,
            notes: [
              {
                id: 11,
                body: 'This line leaks',
                system: false,
                author: { username: 'ada' },
                created_at: 'T1',
                position: { new_path: 'src/app.ts', new_line: 42, head_sha: 'abc123' },
              },
            ],
          })
        : json(mergeRequest());

    await versionControl().createReviewComment({
      ...ref,
      body: 'This line leaks',
      commitId: 'caller-supplied',
      path: 'src/app.ts',
      line: 42,
      side: 'right',
    });

    const post = captured.find(request => request.method === 'POST');
    expect(post?.body).toMatchObject({
      position: { position_type: 'text', new_path: 'src/app.ts', new_line: 42, head_sha: 'abc123' },
    });
  });

  it('threads a reply into its existing discussion', async () => {
    respond = request =>
      request.url.pathname.includes('/discussions/')
        ? json({ id: 12, body: 'Agreed', system: false, author: { username: 'grace' }, created_at: 'T2' })
        : json(mergeRequest());

    const comment = await versionControl().createReviewComment({ ...ref, body: 'Agreed', replyToId: 'd1' });

    expect(comment.replyToId).toBe('d1');
    expect(captured.some(request => request.url.pathname.includes('/discussions/d1/notes'))).toBe(true);
  });
});

describe('GitLabVersionControl reviewers', () => {
  it('adds a reviewer by resolving the username to an id', async () => {
    respond = request =>
      request.url.pathname === '/api/v4/users'
        ? json([{ id: 77, username: 'grace' }])
        : json(mergeRequest({ reviewers: [{ username: 'linus' }, { username: 'grace' }] }));

    const result = await versionControl().requestReviewers({ ...ref, users: ['grace'] });

    expect(result).toEqual({ users: ['linus', 'grace'], teams: [] });
    // Existing reviewers are preserved, so a request does not silently displace one.
    const put = captured.find(request => request.method === 'PUT');
    expect(put?.body).toMatchObject({ reviewer_ids: expect.arrayContaining([77]) });
  });

  it('fails loudly when a reviewer username does not resolve', async () => {
    respond = request => (request.url.pathname === '/api/v4/users' ? json([]) : json(mergeRequest()));

    await expect(versionControl().requestReviewers({ ...ref, users: ['nobody'] })).rejects.toThrow(/was not found/);
  });

  it('removes only the named reviewer', async () => {
    respond = request =>
      request.url.pathname === '/api/v4/users'
        ? json([{ id: 78, username: 'linus' }])
        : json(mergeRequest({ reviewers: [{ username: 'linus' }] }));

    await versionControl().removeRequestedReviewers({ ...ref, users: ['grace'] });

    const put = captured.find(request => request.method === 'PUT');
    expect(put?.body).toMatchObject({ reviewer_ids: [78] });
  });

  it('refuses team reviewers rather than dropping them silently', async () => {
    await expect(versionControl().requestReviewers({ ...ref, teams: ['core'] })).rejects.toBeInstanceOf(
      UnsupportedVersionControlOperationError,
    );
  });
});

describe('GitLabVersionControl unsupported operations', () => {
  // Each of these throws rather than no-op'ing, so a caller is never told a
  // write landed when GitLab has no way to perform it.
  const cases: [string, (vc: GitLabVersionControl) => Promise<unknown>][] = [
    ['pending review creation', vc => vc.createReview({ ...ref, body: 'draft' })],
    ['submitting a pending review', vc => vc.submitReview({ ...ref, reviewId: '1', event: 'approve' })],
    ['editing a submitted review', vc => vc.updateReview({ ...ref, reviewId: '1', body: 'edited' })],
    ['dismissing a review', vc => vc.dismissReview({ ...ref, reviewId: '1', message: 'stale' })],
    ['discarding a pending review', vc => vc.deletePendingReview({ ...ref, reviewId: '1' })],
    ['updating a comment without its MR', vc => vc.updateComment({ connection, sourceId: '42', commentId: '5', body: 'x' })],
    ['deleting a comment without its MR', vc => vc.deleteComment({ connection, sourceId: '42', commentId: '5' })],
    ['app-installation credentials', vc => vc.getPullRequest({ ...ref, connection: { type: 'app-installation', installationId: 1 } })],
  ];

  for (const [name, invoke] of cases) {
    it(`refuses ${name}`, async () => {
      respond = () => json(mergeRequest());
      await expect(invoke(versionControl())).rejects.toBeInstanceOf(UnsupportedVersionControlOperationError);
    });
  }

  it('names the provider and operation so the failure is actionable', async () => {
    await expect(versionControl().deletePendingReview({ ...ref, reviewId: '1' })).rejects.toThrow(
      /GitLab does not support pending reviews/,
    );
  });
});

describe('GitLabVersionControl repository access', () => {
  it('builds a clone url from the instance base url and repository slug', async () => {
    const access = await versionControl().getRepositoryAccess({ orgId: 'org-1', repositoryId: 'repo-1' });

    expect(access).toEqual({
      cloneUrl: 'https://gitlab.com/acme/widgets.git',
      authorization: { scheme: 'bearer', token: 'gl-token' },
    });
  });

  it('fails when the organization has no GitLab connection', async () => {
    await expect(
      versionControl({ token: null }).getRepositoryAccess({ orgId: 'org-1', repositoryId: 'repo-1' }),
    ).rejects.toThrow(/not connected/);
  });

  it('fails when the repository is unknown', async () => {
    await expect(
      versionControl({ repositorySlug: null }).getRepositoryAccess({ orgId: 'org-1', repositoryId: 'repo-1' }),
    ).rejects.toThrow(/repository not found/);
  });

  it('refuses to serve access before initialization', async () => {
    const vc = new GitLabVersionControl({
      clientForConnection: c => new GitLabClient({ baseUrl: 'https://gitlab.com', accessToken: c.accessToken }),
      clientForOrg: async () => null,
      accessTokenForOrg: async () => 'gl-token',
      baseUrl: 'https://gitlab.com',
    });

    await expect(vc.getRepositoryAccess({ orgId: 'org-1', repositoryId: 'repo-1' })).rejects.toThrow(
      /has not been initialized/,
    );
  });
});
